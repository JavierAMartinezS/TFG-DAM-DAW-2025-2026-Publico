<?php

namespace App\Controller;

use App\Entity\Viaje;
use Doctrine\ORM\EntityManagerInterface;
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
        $viajes = $em->getRepository(Viaje::class)->findBy([], ['id' => 'DESC']);

        return $this->render('inicio/SugerenciasIA.html.twig', [
            'viajes' => $viajes,
        ]);
    }

    #[Route('/api/sugerencias-ia/viaje/{id}', name: 'api_sugerencias_ia_viaje', methods: ['POST'])]
    public function generarPorViaje(int $id, EntityManagerInterface $em, HttpClientInterface $httpClient): JsonResponse
    {
        $viaje = $em->getRepository(Viaje::class)->find($id);
        if (!$viaje) {
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

        return new JsonResponse([
            'ok' => true,
            'viajeId' => $viaje->getId(),
            'sugerencias' => $final,
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
}
