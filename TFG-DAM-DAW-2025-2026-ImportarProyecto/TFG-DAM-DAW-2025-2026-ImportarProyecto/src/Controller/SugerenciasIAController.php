<?php

namespace App\Controller;

use App\Entity\Sugerencia;
use App\Entity\Usuario;
use App\Entity\Viaje;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class SugerenciasIAController extends AbstractController
{
    private const OLLAMA_URL = 'http://localhost:11434/api/chat';
    private const OLLAMA_MODEL = 'llama3';

    #[Route('/sugerencias-ia', name: 'app_sugerencias_ia', methods: ['GET'])]
    public function index(EntityManagerInterface $em): Response
    {
        $usuario = $this->getUser();
        if (!$usuario instanceof Usuario) {
            return $this->redirectToRoute('app_login');
        }

        $viajes = $em->getRepository(Viaje::class)->findBy(['usuario' => $usuario], ['id' => 'DESC']);
        $sugerenciasPorViaje = [];
        foreach ($em->getRepository(Sugerencia::class)->findBy(['usuario' => $usuario]) as $sugerencia) {
            if ($sugerencia->getViaje()) {
                $sugerenciasPorViaje[$sugerencia->getViaje()->getId()] = [
                    'sugerencias' => json_decode((string) $sugerencia->getContenidoJson(), true) ?: null,
                    'notas' => $sugerencia->getNotasAdicionales() ?? '',
                ];
            }
        }

        return $this->render('inicio/SugerenciasIA.html.twig', [
            'viajes' => $viajes,
            'sugerenciasPorViaje' => $sugerenciasPorViaje,
        ]);
    }

    #[Route('/api/sugerencias-ia/viaje/{id}', name: 'api_sugerencias_ia_viaje', methods: ['POST'])]
    public function generarPorViaje(int $id, EntityManagerInterface $em, HttpClientInterface $httpClient): JsonResponse
    {
        $usuario = $this->getUser();
        if (!$usuario instanceof Usuario) {
            return new JsonResponse(['ok' => false, 'error' => 'Debes iniciar sesion.'], 401);
        }

        $viaje = $em->getRepository(Viaje::class)->find($id);
        if (!$viaje || $viaje->getUsuario()?->getId() !== $usuario->getId()) {
            return new JsonResponse(['ok' => false, 'error' => 'Viaje no encontrado'], 404);
        }

        $tipo = $viaje->getTipoViaje()?->getNombre() ?? 'No definido';
        $presupuesto = $viaje->getPresupuestoEstimado();
        $presupuestoTexto = $presupuesto !== null ? number_format($presupuesto, 2, '.', '') . ' EUR' : 'No definido';
        $fechaInicio = $viaje->getFechaInicio()?->format('Y-m-d') ?? 'Flexible';
        $fechaFin = $viaje->getFechaFin()?->format('Y-m-d') ?? 'Flexible';
        $temporada = $this->inferirTemporada($viaje);
        $descripcion = trim((string) ($viaje->getDescripcion() ?? ''));
        $descripcionPrompt = $descripcion !== '' ? substr($descripcion, 0, 4000) : 'Sin descripcion detallada.';

        $schema = <<<'JSON'
{
  "resumen": "string",
  "donde_comer": ["string"],
  "cafes": ["string"],
  "alojamiento": ["string"],
  "visitas_por_clima": {
    "sol": ["string"],
    "lluvia": ["string"],
    "calor": ["string"],
    "frio": ["string"],
    "viento": ["string"]
  },
  "transportes": ["string"],
  "movilidad_local": ["string"],
  "presupuesto": ["string"],
  "seguridad": ["string"],
  "salud": ["string"],
  "equipaje": ["string"],
  "apps_utiles": ["string"],
  "costumbres_locales": ["string"],
  "planes_noche": ["string"],
  "compras_y_souvenirs": ["string"],
  "trampas_a_evitar": ["string"],
  "checklist_antes_de_viajar": ["string"],
  "plan_b_emergencia": ["string"]
}
JSON;

        $prompt = "Genera una guia de sugerencias ultra completa para este viaje.
Idioma: espanol obligatorio.
No uses ingles.
No escribas nada fuera del JSON.
No inventes datos absurdos.
Si no conoces un sitio concreto, recomienda zonas/barrios o tipos de lugar.

Debes devolver exactamente este JSON:
{$schema}

Reglas de calidad:
- Entre 4 y 8 recomendaciones por array.
- En visitas_por_clima, minimo 3 recomendaciones por clima.
- Recomendaciones accionables y practicas.
- Incluye explicitamente: comida, cafes, alojamiento, que visitar segun clima, transportes.
- Incluye tambien seguridad, ahorro, salud, apps utiles, equipaje y plan de emergencia.
- Todo coherente con el destino y datos del viaje.

Contexto del viaje:
Nombre: {$viaje->getNombre()}
Tipo: {$tipo}
Fechas: {$fechaInicio} a {$fechaFin}
Temporada estimada: {$temporada}
Presupuesto total: {$presupuestoTexto}
Descripcion:
{$descripcionPrompt}";

        $payload = [
            'model' => self::OLLAMA_MODEL,
            'stream' => false,
            'format' => 'json',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un asistente experto en viajes, logistica, seguridad y ahorro. Respondes en espanol y sigues estrictamente el formato pedido.',
                ],
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
        ];

        $response = $httpClient->request('POST', self::OLLAMA_URL, [
            'json' => $payload,
            'timeout' => 180,
        ]);

        $decoded = json_decode($response->getContent(false), true);
        $raw = $decoded['message']['content'] ?? '';
        if (!is_string($raw) || trim($raw) === '') {
            return new JsonResponse(['ok' => false, 'error' => 'Respuesta vacia de Ollama'], 500);
        }

        $final = json_decode($raw, true);
        if (!is_array($final)) {
            if (preg_match('/\{[\s\S]*\}/', $raw, $matches)) {
                $final = json_decode($matches[0], true);
            }
        }

        if (!is_array($final)) {
            return new JsonResponse([
                'ok' => false,
                'error' => 'No se pudo parsear el JSON de sugerencias',
                'raw' => substr($raw, 0, 900),
            ], 500);
        }

        $sugerencia = $em->getRepository(Sugerencia::class)->findOneBy([
            'usuario' => $usuario,
            'viaje' => $viaje,
        ]) ?? new Sugerencia();

        $sugerencia->setUsuario($usuario);
        $sugerencia->setViaje($viaje);
        $sugerencia->setMensaje('Sugerencias IA para ' . $viaje->getNombre());
        $sugerencia->setFecha(new \DateTime());
        $sugerencia->setNivelPrioridad(1);
        $sugerencia->setContenidoJson(json_encode($final, JSON_UNESCAPED_UNICODE));

        $em->persist($sugerencia);
        $em->flush();

        return new JsonResponse([
            'ok' => true,
            'viajeId' => $viaje->getId(),
            'sugerencias' => $final,
            'notas' => $sugerencia->getNotasAdicionales() ?? '',
        ]);
    }

    #[Route('/api/sugerencias-ia/viaje/{id}/chat', name: 'api_sugerencias_ia_chat', methods: ['POST'])]
    public function chatViaje(int $id, Request $request, EntityManagerInterface $em, HttpClientInterface $httpClient): JsonResponse
    {
        $usuario = $this->getUser();
        if (!$usuario instanceof Usuario) {
            return new JsonResponse(['ok' => false, 'error' => 'Debes iniciar sesion.'], 401);
        }

        $viaje = $em->getRepository(Viaje::class)->find($id);
        if (!$viaje || $viaje->getUsuario()?->getId() !== $usuario->getId()) {
            return new JsonResponse(['ok' => false, 'error' => 'Viaje no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $mensaje = trim((string) ($data['mensaje'] ?? ''));
        if ($mensaje === '') {
            return new JsonResponse(['ok' => false, 'error' => 'Mensaje vacio'], 400);
        }

        $sugerencia = $em->getRepository(Sugerencia::class)->findOneBy([
            'usuario' => $usuario,
            'viaje' => $viaje,
        ]);

        $session = $request->getSession();
        $historyKey = 'sugerencias_ia_chat_' . $usuario->getId() . '_' . $viaje->getId();
        $history = $this->normalizeChatHistory($session->get($historyKey, []));

        $payload = [
            'model' => self::OLLAMA_MODEL,
            'stream' => false,
            'messages' => array_merge([
                [
                    'role' => 'system',
                    'content' => 'Eres un asistente de viaje. Responde en espanol, breve y practico. Usa el viaje, su descripcion, las sugerencias guardadas y los ultimos mensajes de la conversacion como contexto.',
                ],
                [
                    'role' => 'user',
                    'content' => "Viaje: {$viaje->getNombre()}
Descripcion: " . substr((string) $viaje->getDescripcion(), 0, 2500) . "
Sugerencias guardadas: " . substr((string) ($sugerencia?->getContenidoJson() ?? ''), 0, 2500) . "
Notas adicionales: " . substr((string) ($sugerencia?->getNotasAdicionales() ?? ''), 0, 1200) . "

Usa tambien los ultimos mensajes reales que recibiras despues de este contexto. Si el usuario hace referencia a algo dicho antes, conectalo con ese historial.",
                ],
            ], $history, [
                [
                    'role' => 'user',
                    'content' => $mensaje,
                ],
            ]),
        ];

        $response = $httpClient->request('POST', self::OLLAMA_URL, [
            'json' => $payload,
            'timeout' => 120,
        ]);

        $decoded = json_decode($response->getContent(false), true);
        $respuesta = trim((string) ($decoded['message']['content'] ?? ''));

        if ($respuesta === '') {
            return new JsonResponse(['ok' => false, 'error' => 'La IA no devolvio respuesta.'], 500);
        }

        $history[] = ['role' => 'user', 'content' => $mensaje];
        $history[] = ['role' => 'assistant', 'content' => $respuesta];
        $session->set($historyKey, array_slice($history, -5));

        return new JsonResponse(['ok' => true, 'respuesta' => $respuesta]);
    }

    #[Route('/api/sugerencias-ia/viaje/{id}/nota', name: 'api_sugerencias_ia_nota', methods: ['POST'])]
    public function guardarNota(int $id, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $usuario = $this->getUser();
        if (!$usuario instanceof Usuario) {
            return new JsonResponse(['ok' => false, 'error' => 'Debes iniciar sesion.'], 401);
        }

        $viaje = $em->getRepository(Viaje::class)->find($id);
        if (!$viaje || $viaje->getUsuario()?->getId() !== $usuario->getId()) {
            return new JsonResponse(['ok' => false, 'error' => 'Viaje no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $nota = trim((string) ($data['nota'] ?? ''));
        if ($nota === '') {
            return new JsonResponse(['ok' => false, 'error' => 'Nota vacia'], 400);
        }

        $sugerencia = $em->getRepository(Sugerencia::class)->findOneBy([
            'usuario' => $usuario,
            'viaje' => $viaje,
        ]) ?? new Sugerencia();

        $actuales = trim((string) ($sugerencia->getNotasAdicionales() ?? ''));
        $linea = '[' . (new \DateTime())->format('d/m/Y H:i') . '] ' . $nota;

        $sugerencia->setUsuario($usuario);
        $sugerencia->setViaje($viaje);
        $sugerencia->setMensaje('Sugerencias IA para ' . $viaje->getNombre());
        $sugerencia->setNivelPrioridad(1);
        $sugerencia->setFecha(new \DateTime());
        $sugerencia->setNotasAdicionales($actuales === '' ? $linea : $actuales . "\n" . $linea);

        $em->persist($sugerencia);
        $em->flush();

        return new JsonResponse([
            'ok' => true,
            'notas' => $sugerencia->getNotasAdicionales(),
        ]);
    }

    private function inferirTemporada(Viaje $viaje): string
    {
        $fecha = $viaje->getFechaInicio();
        if (!$fecha) {
            return 'No definida';
        }

        $mes = (int) $fecha->format('n');
        if (in_array($mes, [12, 1, 2], true)) {
            return 'Invierno';
        }
        if (in_array($mes, [3, 4, 5], true)) {
            return 'Primavera';
        }
        if (in_array($mes, [6, 7, 8], true)) {
            return 'Verano';
        }

        return 'Otono';
    }

    /**
     * @param mixed $history
     * @return array<int, array{role: string, content: string}>
     */
    private function normalizeChatHistory(mixed $history): array
    {
        if (!is_array($history)) {
            return [];
        }

        $normalized = [];
        foreach ($history as $message) {
            if (!is_array($message)) {
                continue;
            }

            $role = (string) ($message['role'] ?? '');
            $content = trim((string) ($message['content'] ?? ''));
            if (!in_array($role, ['user', 'assistant'], true) || $content === '') {
                continue;
            }

            $normalized[] = [
                'role' => $role,
                'content' => substr($content, 0, 1600),
            ];
        }

        return array_slice($normalized, -5);
    }
}
