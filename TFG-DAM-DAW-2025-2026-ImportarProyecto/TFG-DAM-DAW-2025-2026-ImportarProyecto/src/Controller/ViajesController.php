<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

final class ViajesController extends AbstractController
{
    #[Route('/viajes', name: 'app_viaje')]
    public function index(): Response
    {
        return $this->render('inicio/Viajes.html.twig');
    }

    #[Route('/guardar-datos-viaje', name: 'guardar_datos_viaje', methods: ['POST'])]
    public function guardarDatosViaje(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $request->getSession()->set('viaje_ia', $data);
        return new JsonResponse(['ok' => true]);
    }
}