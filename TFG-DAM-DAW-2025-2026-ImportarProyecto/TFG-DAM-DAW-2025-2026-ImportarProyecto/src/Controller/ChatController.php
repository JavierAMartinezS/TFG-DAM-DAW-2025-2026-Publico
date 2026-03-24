<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class ChatController extends AbstractController
{
    #[Route('/api/chat/ollama', name: 'chat_ollama', methods: ['POST'])]
    public function chat(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $tipoViaje = $data['tipoViaje'] ?? '';
        $viajeros = $data['numViajeros'] ?? '';
        $fechas = $data['fechas'] ?? '';
        $presupuesto = $data['presupuesto'] ?? '';

        $request->getSession()->set('viaje_base', [
            'tipoViaje' => $tipoViaje,
            'numViajeros' => $viajeros,
            'fechas' => $fechas,
            'presupuesto' => $presupuesto
        ]);

        $payload = [
            'model' => 'llama3',
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un planificador de viajes profesional. Cumples estrictamente las condiciones del usuario y no improvisas.'
                ],
                [
                    'role' => 'user',
                    'content' => "Genera 5 viajes reales distintos cumpliendo obligatoriamente:
                    Tipo de viaje: {$tipoViaje}
                    Viajeros: {$viajeros}
                    Fechas/duración: {$fechas}
                    Presupuesto máximo: {$presupuesto} €

                    Devuelve SOLO un JSON válido con estructura:
                    {
                    \"viajes\": [
                        {\"titulo\":\"string\",\"descripcion\":\"string\"}
                    ]
                    }

                    No repitas destinos anteriores ni inventes datos.
                    Los viajes deben estar detallados en castellano (español)"
                ]
            ]
        ];

        $response = $httpClient->request('POST', 'http://localhost:11434/api/chat', [
            'json' => $payload,
            'timeout' => 180
        ]);

        $decoded = json_decode($response->getContent(false), true);

        if (!isset($decoded['message']['content'])) {
            return new JsonResponse(['error' => 'Respuesta inválida de Ollama'], 500);
        }

        $raw = $decoded['message']['content'];
        if (!preg_match('/\{[\s\S]*\}/', $raw, $matches)) {
            return new JsonResponse(['error' => 'No se encontró JSON en la respuesta', 'raw' => $raw], 500);
        }

        $final = json_decode($matches[0], true);

        if (!$final || !isset($final['viajes'])) {
            return new JsonResponse(['error' => 'JSON inválido o sin viajes', 'raw' => $matches[0]], 500);
        }

        return new JsonResponse($final);
    }

    #[Route('/api/chat/seleccion', name: 'chat_seleccion', methods: ['POST'])]
    public function seleccionarViaje(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $viaje = $data['viaje'] ?? '';

        $base = $request->getSession()->get('viaje_base', []);
        $request->getSession()->set('viaje_seleccionado', $viaje);

        $payload = [
            'model' => 'llama3',
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => "Eres un planificador experto. El destino elegido es {$viaje}. Toda respuesta futura debe basarse EXCLUSIVAMENTE en este destino."
                ],
                [
                    'role' => 'user',
                    'content' => "Con estos datos obligatorios:
                    Tipo de viaje: {$base['tipoViaje']}
                    Viajeros: {$base['numViajeros']}
                    Fechas/duración: {$base['fechas']}
                    Presupuesto: {$base['presupuesto']} €

                    Genera un itinerario realista y detallado día a día para {$viaje}."
                ]
            ]
        ];

        $response = $httpClient->request('POST', 'http://localhost:11434/api/chat', [
            'json' => $payload,
            'timeout' => 180
        ]);

        $decoded = json_decode($response->getContent(false), true);

        return new JsonResponse(['respuesta' => $decoded['message']['content'] ?? 'Error generando itinerario']);
    }

    #[Route('/api/chat/conversacion', name: 'chat_conversacion', methods: ['POST'])]
    public function conversacion(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $mensaje = $data['mensaje'] ?? '';

        $base = $request->getSession()->get('viaje_base');
        $destino = $request->getSession()->get('viaje_seleccionado');

        if (!$base || !$destino) {
            return new JsonResponse(['respuesta' => 'Primero debes seleccionar un viaje.']);
        }

        $payload = [
            'model' => 'llama3',
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => "Destino fijo: {$destino}. Responde SIEMPRE en base a este lugar. No cambies de ciudad ni país bajo ningún concepto."
                ],
                [
                    'role' => 'user',
                    'content' => "Contexto obligatorio:
                    Tipo de viaje: {$base['tipoViaje']}
                    Viajeros: {$base['numViajeros']}
                    Fechas/duración: {$base['fechas']}
                    Presupuesto: {$base['presupuesto']} €

                    Pregunta del usuario:
                    {$mensaje}"
                ]
            ]
        ];

        $response = $httpClient->request('POST', 'http://localhost:11434/api/chat', [
            'json' => $payload,
            'timeout' => 180
        ]);

        $decoded = json_decode($response->getContent(false), true);

        return new JsonResponse(['respuesta' => $decoded['message']['content'] ?? 'Error en la respuesta']);
    }
}