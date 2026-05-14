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

final class ViajesController extends AbstractController
{
    #[Route('/viajes', name: 'app_viaje')]
    public function index(): Response
    {
        return $this->render('inicio/Viajes.html.twig');
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
}
