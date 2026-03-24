<?php

namespace App\Controller;

use App\Entity\Viaje;
use App\Entity\TipoViaje;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/viajes')]
final class ApiViajeController extends AbstractController
{
    #[Route('/guardar', name: 'api_viajes_guardar', methods: ['POST'])]
    public function guardar(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $viaje = new Viaje();
        $viaje->setNombre($data['nombre'] ?? 'Viaje sin nombre');
        $viaje->setDescripcion($data['descripcion'] ?? '');
        $viaje->setPresupuestoEstimado($data['presupuestoEstimado'] ?? null);

        if (!empty($data['fechaInicio'])) {
            $viaje->setFechaInicio(new \DateTime($data['fechaInicio']));
        }
        if (!empty($data['fechaFin'])) {
            $viaje->setFechaFin(new \DateTime($data['fechaFin']));
        }

        $tipoViajeId = $data['tipoViajeId'] ?? 0;
        $tipoViaje = $em->getRepository(TipoViaje::class)->find($tipoViajeId);
        $viaje->setTipoViaje($tipoViaje);

        $viaje->setUsuario(null);

        $em->persist($viaje);
        $em->flush();

        return new JsonResponse(['ok' => true, 'id' => $viaje->getId()]);
    }

    #[Route('/listar', name: 'api_viajes_listar', methods: ['GET'])]
    public function listar(EntityManagerInterface $em): JsonResponse
    {
        $viajes = $em->getRepository(Viaje::class)->findBy([], ['id' => 'DESC']);
        $result = [];

        foreach ($viajes as $v) {
            $result[] = [
                'id' => $v->getId(),
                'nombre' => $v->getNombre(),
                'descripcion' => $v->getDescripcion(),
                'presupuestoEstimado' => $v->getPresupuestoEstimado(),
                'fechaInicio' => $v->getFechaInicio()?->format('Y-m-d'),
                'fechaFin' => $v->getFechaFin()?->format('Y-m-d'),
                'tipoViaje' => $v->getTipoViaje()?->getNombre(),
            ];
        }

        return new JsonResponse($result);
    }

    #[Route('/eliminar/{id}', name: 'api_viajes_eliminar', methods: ['DELETE'])]
    public function eliminar(int $id, EntityManagerInterface $em): JsonResponse
    {
        $viaje = $em->getRepository(Viaje::class)->find($id);
        if (!$viaje) {
            return new JsonResponse(['ok' => false, 'error' => 'Viaje no encontrado'], 404);
        }

        $em->remove($viaje);
        $em->flush();

        return new JsonResponse(['ok' => true]);
    }
}