<?php

namespace App\Controller;

use App\Entity\Viaje;
use App\Entity\Usuario;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class ViajesController extends AbstractController
{
    private const OLLAMA_URL = 'http://localhost:11434/api/chat';
    private const OLLAMA_MODEL = 'llama3';

    #[Route('/viajes', name: 'app_viaje')]
    public function index(): Response
    {
        return $this->render('inicio/Viajes.html.twig');
    }

    #[Route('/mapa-interactivo', name: 'app_mapa_interactivo', methods: ['GET'])]
    public function mapaInteractivo(EntityManagerInterface $em): Response
    {
        $usuario = $this->getUser();
        if (!$usuario instanceof Usuario) {
            return $this->redirectToRoute('app_login');
        }

        $viajes = $em->getRepository(Viaje::class)->findBy(['usuario' => $usuario], ['id' => 'DESC']);

        return $this->render('inicio/MapaInteractivo.html.twig', [
            'viajes' => $viajes,
        ]);
    }

    #[Route('/viajes/{id}', name: 'app_viaje_detalle', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detalle(int $id, EntityManagerInterface $em): Response
    {
        $usuario = $this->getUser();
        if (!$usuario instanceof Usuario) {
            return $this->redirectToRoute('app_login');
        }

        $viaje = $em->getRepository(Viaje::class)->find($id);

        if (!$viaje || $viaje->getUsuario()?->getId() !== $usuario->getId()) {
            throw $this->createNotFoundException('Viaje no encontrado.');
        }

        $duracionDias = null;
        if ($viaje->getFechaInicio() && $viaje->getFechaFin()) {
            $duracionDias = $viaje->getFechaInicio()->diff($viaje->getFechaFin())->days + 1;
        }

        return $this->render('inicio/ViajeDetalle.html.twig', [
            'viaje' => $viaje,
            'duracionDias' => $duracionDias,
        ]);
    }

    #[Route('/guardar-datos-viaje', name: 'guardar_datos_viaje', methods: ['POST'])]
    public function guardarDatosViaje(Request $request): JsonResponse
    {
        if (!$this->getUser() instanceof Usuario) {
            return new JsonResponse(['ok' => false, 'redirect' => $this->generateUrl('app_login')], 401);
        }

        $data = json_decode($request->getContent(), true);
        $request->getSession()->set('viaje_ia', $data);
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/viajes/{id}/mapa/explorar', name: 'api_viaje_mapa_explorar', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function explorarMapa(int $id, Request $request, EntityManagerInterface $em, HttpClientInterface $httpClient): JsonResponse
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
        $lat = is_numeric($data['lat'] ?? null) ? (float) $data['lat'] : null;
        $lon = is_numeric($data['lon'] ?? null) ? (float) $data['lon'] : null;
        $zona = trim((string) ($data['zona'] ?? ''));
        $contexto = trim((string) ($data['contexto'] ?? ''));
        $lugaresRuta = array_values(array_filter(array_map('trim', array_map('strval', is_array($data['lugaresRuta'] ?? null) ? $data['lugaresRuta'] : []))));
        $lugaresRutaTexto = $lugaresRuta ? implode(', ', array_slice($lugaresRuta, 0, 12)) : 'No disponibles';
        $lugaresExcluidos = array_values(array_filter(array_map('trim', array_map('strval', is_array($data['lugaresExcluidos'] ?? null) ? $data['lugaresExcluidos'] : []))));
        $lugaresExcluidosTexto = $lugaresExcluidos ? implode(', ', array_slice($lugaresExcluidos, 0, 35)) : 'Ninguno';
        $tipo = $viaje->getTipoViaje()?->getNombre() ?? 'No definido';
        $coordenadas = $lat !== null && $lon !== null ? "{$lat}, {$lon}" : 'No disponibles';

        $schema = <<<'JSON'
{
  "lugares": [
    {
      "nombre": "string",
      "categoria": "restaurante|mirador|playa|monumento|naturaleza|plan oculto",
      "motivo": "string"
    }
  ]
}
JSON;

        $payload = [
            'model' => self::OLLAMA_MODEL,
            'stream' => false,
            'format' => 'json',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un guia local experto. Respondes siempre en espanol y solo con JSON valido.',
                ],
                [
                    'role' => 'user',
                    'content' => "Recomienda sitios cercanos para anadir a un mapa interactivo.
Devuelve exactamente este JSON:
{$schema}

Reglas:
- 8 lugares como maximo.
- Mezcla restaurantes, miradores, playas si aplica, monumentos, naturaleza y planes ocultos.
- Deben encajar con el estilo del viaje.
- Recomienda SOLO sitios dentro de la misma ciudad, isla, comarca o ruta indicada.
- Si hay coordenadas, prioriza sitios a menos de 60 km de la zona de referencia.
- Si hay lugares de ruta, usa solo lugares cercanos a esos puntos. No propongas otros paises, continentes ni ciudades lejanas.
- Usa nombres reales y especificos faciles de localizar en un mapa. Evita nombres genericos como Centro, Playa, Mirador o Restaurante.
- No repitas ni recomiendes lugares ya excluidos.
- No escribas texto fuera del JSON.

Viaje: {$viaje->getNombre()}
Tipo de viaje: {$tipo}
Zona de referencia: {$zona}
Contexto geografico: {$contexto}
Lugares ya detectados en la ruta: {$lugaresRutaTexto}
Lugares ya excluidos o ya presentes: {$lugaresExcluidosTexto}
Coordenadas aproximadas: {$coordenadas}
Descripcion:
" . substr((string) $viaje->getDescripcion(), 0, 2500),
                ],
            ],
        ];

        try {
            $response = $httpClient->request('POST', self::OLLAMA_URL, [
                'json' => $payload,
                'timeout' => 120,
            ]);
            $decoded = json_decode($response->getContent(false), true);
            $raw = (string) ($decoded['message']['content'] ?? '');
            $final = json_decode($raw, true);
            if (!is_array($final) && preg_match('/\{[\s\S]*\}/', $raw, $matches)) {
                $final = json_decode($matches[0], true);
            }
        } catch (\Throwable) {
            return new JsonResponse(['ok' => false, 'error' => 'No se pudieron generar sitios cercanos ahora mismo.'], 500);
        }

        $lugares = [];
        $lugaresRaw = is_array($final) ? ($final['lugares'] ?? []) : [];
        foreach ($lugaresRaw as $lugar) {
            if (!is_array($lugar)) {
                continue;
            }
            $nombre = trim((string) ($lugar['nombre'] ?? ''));
            if ($nombre === '') {
                continue;
            }
            $lugares[] = [
                'nombre' => $nombre,
                'categoria' => trim((string) ($lugar['categoria'] ?? 'plan oculto')),
                'motivo' => trim((string) ($lugar['motivo'] ?? 'Encaja con el viaje.')),
            ];
        }

        return new JsonResponse(['ok' => true, 'lugares' => array_slice($lugares, 0, 8)]);
    }
}
