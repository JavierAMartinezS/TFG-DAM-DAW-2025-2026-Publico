<?php

namespace App\Controller;

use App\Entity\Usuario;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class SecurityController extends AbstractController
{
    #[Route('/login', name: 'app_login')]
    public function login(AuthenticationUtils $authenticationUtils): Response
    {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_inicio');
        }

        return $this->render('security/login.html.twig', [
            'last_username' => $authenticationUtils->getLastUsername(),
            'error' => $authenticationUtils->getLastAuthenticationError(),
        ]);
    }

    #[Route('/registro', name: 'app_registro', methods: ['GET', 'POST'])]
    public function registro(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher
    ): Response {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_inicio');
        }

        $error = null;
        $nombre = trim((string) $request->request->get('nombre', ''));
        $email = trim((string) $request->request->get('email', ''));

        if ($request->isMethod('POST')) {
            $password = (string) $request->request->get('password', '');
            $passwordConfirm = (string) $request->request->get('password_confirm', '');

            if ($nombre === '' || $email === '' || $password === '') {
                $error = 'Completa todos los campos obligatorios.';
            } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $error = 'Introduce un email valido.';
            } elseif (strlen($password) < 6) {
                $error = 'La contrasena debe tener al menos 6 caracteres.';
            } elseif ($password !== $passwordConfirm) {
                $error = 'Las contrasenas no coinciden.';
            } elseif ($entityManager->getRepository(Usuario::class)->findOneBy(['email' => $email])) {
                $error = 'Ya existe una cuenta con ese email.';
            } else {
                $usuario = new Usuario();
                $usuario->setNombre($nombre);
                $usuario->setEmail($email);
                $usuario->setPassword($passwordHasher->hashPassword($usuario, $password));
                $usuario->setFechaRegistro(new \DateTime());

                $entityManager->persist($usuario);
                $entityManager->flush();

                $this->addFlash('success', 'Cuenta creada correctamente. Ya puedes iniciar sesion.');

                return $this->redirectToRoute('app_login');
            }
        }

        return $this->render('security/registro.html.twig', [
            'error' => $error,
            'nombre' => $nombre,
            'email' => $email,
        ]);
    }

    #[Route('/logout', name: 'app_logout')]
    public function logout(): void
    {
        throw new \LogicException('This method can be blank: it will be intercepted by the logout key on your firewall.');
    }
}
