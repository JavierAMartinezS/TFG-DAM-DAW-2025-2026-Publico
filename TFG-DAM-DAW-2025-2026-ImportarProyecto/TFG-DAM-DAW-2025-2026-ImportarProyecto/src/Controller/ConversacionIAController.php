<?php

namespace App\Controller;

use App\Entity\Usuario;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

final class ConversacionIAController extends AbstractController
{
    #[Route('/conversacion-ia', name: 'conversacion_ia')]
    public function conversacionIA(Request $request): Response
    {
        if (!$this->getUser() instanceof Usuario) {
            return $this->redirectToRoute('app_login');
        }

        $viaje = $request->getSession()->get('viaje_ia', null);
        return $this->render('inicio/ConversacionIA.html.twig', [
            'viaje' => $viaje
        ]);
    }
}
