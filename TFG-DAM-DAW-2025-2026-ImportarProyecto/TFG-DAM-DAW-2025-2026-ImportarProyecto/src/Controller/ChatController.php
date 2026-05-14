<?php

namespace App\Controller;

use App\Entity\Usuario;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class ChatController extends AbstractController
{
    private const OLLAMA_URL = 'http://localhost:11434/api/chat';
    private const OLLAMA_MODEL = 'llama3';
    private const SPANISH_RULE = 'Idioma obligatorio: responde siempre en espanol. No uses ingles ni otros idiomas.';
    private const DAY_PLACE_RULE = 'Cuando escribas itinerarios, cada jornada DEBE empezar con el formato exacto "Dia X: Lugar principal". "Lugar principal" debe ser una ciudad, pueblo o lugar geografico real y concreto (por ejemplo parque natural, parque nacional o zona tematica real). No uses etiquetas genericas como "Llegada", "Visita", "Entrada", "Manana" o similares como lugar.';

    #[Route('/api/chat/ollama', name: 'chat_ollama', methods: ['POST'])]
    public function chat(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        if (!$this->getUser() instanceof Usuario) {
            return new JsonResponse(['error' => 'Debes iniciar sesion para generar viajes.'], 401);
        }

        $data = json_decode($request->getContent(), true);

        $tipoViaje = $data['tipoViaje'] ?? '';
        $viajeros = $data['numViajeros'] ?? '';
        $fechas = $data['fechas'] ?? '';
        $presupuesto = $data['presupuesto'] ?? '';
        $viajesExcluidos = $data['viajesExcluidos'] ?? [];

        $request->getSession()->set('viaje_base', [
            'tipoViaje' => $tipoViaje,
            'numViajeros' => $viajeros,
            'fechas' => $fechas,
            'presupuesto' => $presupuesto,
        ]);

        $lineaExclusiones = '';
        if (is_array($viajesExcluidos) && count($viajesExcluidos) > 0) {
            $lineaExclusiones = "\nNo propongas estos destinos o titulos ya mostrados: " . implode(', ', $viajesExcluidos);
        }

        $payload = [
            'model' => self::OLLAMA_MODEL,
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un planificador de viajes profesional. Cumples estrictamente las condiciones del usuario y no improvisas. ' . self::SPANISH_RULE,
                ],
                [
                    'role' => 'user',
                    'content' => "Genera 5 viajes reales distintos cumpliendo obligatoriamente:
Tipo de viaje: {$tipoViaje}
Viajeros: {$viajeros}
Fechas/duracion: {$fechas}
Presupuesto maximo: {$presupuesto} EUR{$lineaExclusiones}

Devuelve SOLO un JSON valido con estructura:
{
  \"viajes\": [
    {\"titulo\":\"string\",\"descripcion\":\"string\"}
  ]
}

No inventes datos y escribe todos los textos solo en espanol.",
                ],
            ],
        ];

        $response = $httpClient->request('POST', self::OLLAMA_URL, [
            'json' => $payload,
            'timeout' => 180,
        ]);

        $decoded = json_decode($response->getContent(false), true);

        if (!isset($decoded['message']['content'])) {
            return new JsonResponse(['error' => 'Respuesta invalida de Ollama'], 500);
        }

        $raw = $decoded['message']['content'];
        if (!preg_match('/\{[\s\S]*\}/', $raw, $matches)) {
            return new JsonResponse(['error' => 'No se encontro JSON en la respuesta', 'raw' => $raw], 500);
        }

        $final = json_decode($matches[0], true);

        if (!$final || !isset($final['viajes'])) {
            return new JsonResponse(['error' => 'JSON invalido o sin viajes', 'raw' => $matches[0]], 500);
        }

        return new JsonResponse($final);
    }

    #[Route('/api/chat/seleccion', name: 'chat_seleccion', methods: ['POST'])]
    public function seleccionarViaje(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        if (!$this->getUser() instanceof Usuario) {
            return new JsonResponse(['respuesta' => 'Debes iniciar sesion para generar itinerarios.'], 401);
        }

        $data = json_decode($request->getContent(), true);
        $viaje = $data['viaje'] ?? '';

        $base = $request->getSession()->get('viaje_base', []);
        $request->getSession()->set('viaje_seleccionado', $viaje);

        $payload = [
            'model' => self::OLLAMA_MODEL,
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => "Eres un planificador experto. El destino elegido es {$viaje}. Toda respuesta debe basarse exclusivamente en este destino. " . self::SPANISH_RULE . ' ' . self::DAY_PLACE_RULE,
                ],
                [
                    'role' => 'user',
                    'content' => "Con estos datos obligatorios:
Tipo de viaje: " . ($base['tipoViaje'] ?? '') . "
Viajeros: " . ($base['numViajeros'] ?? '') . "
Fechas/duracion: " . ($base['fechas'] ?? '') . "
Presupuesto: " . ($base['presupuesto'] ?? '') . " EUR

Genera un itinerario realista y detallado dia a dia para {$viaje}.
Formato obligatorio de encabezados:
Dia 1: <Lugar principal>
Dia 2: <Lugar principal>
...
No omitas el lugar principal en ninguna jornada.
Responde solo en espanol.",
                ],
            ],
        ];

        $response = $httpClient->request('POST', self::OLLAMA_URL, [
            'json' => $payload,
            'timeout' => 180,
        ]);

        $decoded = json_decode($response->getContent(false), true);

        return new JsonResponse(['respuesta' => $decoded['message']['content'] ?? 'Error generando itinerario']);
    }

    #[Route('/api/chat/conversacion', name: 'chat_conversacion', methods: ['POST'])]
    public function conversacion(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        if (!$this->getUser() instanceof Usuario) {
            return new JsonResponse(['respuesta' => 'Debes iniciar sesion para usar la IA.'], 401);
        }

        $data = json_decode($request->getContent(), true);
        $mensaje = $data['mensaje'] ?? '';

        $base = $request->getSession()->get('viaje_base');
        $destino = $request->getSession()->get('viaje_seleccionado');

        if (!$base || !$destino) {
            return new JsonResponse(['respuesta' => 'Primero debes seleccionar un viaje.']);
        }

        $payload = [
            'model' => self::OLLAMA_MODEL,
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => "Destino fijo: {$destino}. Responde siempre en base a este lugar y no cambies de ciudad o pais. " . self::SPANISH_RULE . ' ' . self::DAY_PLACE_RULE,
                ],
                [
                    'role' => 'user',
                    'content' => "Contexto obligatorio:
Tipo de viaje: " . ($base['tipoViaje'] ?? '') . "
Viajeros: " . ($base['numViajeros'] ?? '') . "
Fechas/duracion: " . ($base['fechas'] ?? '') . "
Presupuesto: " . ($base['presupuesto'] ?? '') . " EUR

Pregunta del usuario:
{$mensaje}

Si devuelves un plan por dias, usa siempre el formato \"Dia X: Lugar principal\".
Responde solo en espanol.",
                ],
            ],
        ];

        $response = $httpClient->request('POST', self::OLLAMA_URL, [
            'json' => $payload,
            'timeout' => 180,
        ]);

        $decoded = json_decode($response->getContent(false), true);

        return new JsonResponse(['respuesta' => $decoded['message']['content'] ?? 'Error en la respuesta']);
    }
}
