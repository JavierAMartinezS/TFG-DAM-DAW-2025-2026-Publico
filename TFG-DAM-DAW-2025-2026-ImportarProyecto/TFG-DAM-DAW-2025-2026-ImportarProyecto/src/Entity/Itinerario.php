<?php

namespace App\Entity;

use App\Repository\ItinerarioRepository;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\Viaje;

#[ORM\Entity(repositoryClass: ItinerarioRepository::class)]
class Itinerario
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $notasGenerales = null;

    #[ORM\OneToOne(inversedBy: 'itinerario')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Viaje $viaje = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int $id): static
    {
        $this->id = $id;

        return $this;
    }

    public function getNotasGenerales(): ?string
    {
        return $this->notasGenerales;
    }

    public function setNotasGenerales(?string $notasGenerales): static
    {
        $this->notasGenerales = $notasGenerales;

        return $this;
    }
}
