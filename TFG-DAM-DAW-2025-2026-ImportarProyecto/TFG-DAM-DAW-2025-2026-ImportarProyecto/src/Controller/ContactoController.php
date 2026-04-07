<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class ContactoController extends AbstractController
{
    #[Route('/contacto', name: 'app_contacto', methods: ['GET', 'POST'])]
    public function index(Request $request): Response
    {
        if ($request->isMethod('POST')) {
            $this->addFlash('success', 'Mensaje enviado correctamente. Te responderemos lo antes posible.');
            return $this->redirectToRoute('app_contacto');
        }

        return $this->render('inicio/contacto.html.twig');
    }
}

