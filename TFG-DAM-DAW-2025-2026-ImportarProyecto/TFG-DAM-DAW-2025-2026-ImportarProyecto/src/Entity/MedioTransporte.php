<?php

namespace App\Entity;

use App\Repository\MedioTransporteRepository;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\Collection;
use App\Entity\Actividad;

#[ORM\Entity(repositoryClass: MedioTransporteRepository::class)]
class MedioTransporte
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $tipo = null;

    #[ORM\Column(nullable: true)]
    private ?int $tiempoEstimado = null;

    #[ORM\Column(nullable: true)]
    private ?float $costeEstimado = null;

    #[ORM\Column(nullable: true)]
    private ?float $huellaEstimada = null;

    #[ORM\OneToMany(mappedBy: 'medioTransporte', targetEntity: Actividad::class)]
    private Collection $actividades;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int $id): static
    {
        $this->id = $id;

        return $this;
    }

    public function getTipo(): ?string
    {
        return $this->tipo;
    }

    public function setTipo(string $tipo): static
    {
        $this->tipo = $tipo;

        return $this;
    }

    public function getTiempoEstimado(): ?int
    {
        return $this->tiempoEstimado;
    }

    public function setTiempoEstimado(?int $tiempoEstimado): static
    {
        $this->tiempoEstimado = $tiempoEstimado;

        return $this;
    }

    public function getCosteEstimado(): ?float
    {
        return $this->costeEstimado;
    }

    public function setCosteEstimado(?float $costeEstimado): static
    {
        $this->costeEstimado = $costeEstimado;

        return $this;
    }

    public function getHuellaEstimada(): ?float
    {
        return $this->huellaEstimada;
    }

    public function setHuellaEstimada(?float $huellaEstimada): static
    {
        $this->huellaEstimada = $huellaEstimada;

        return $this;
    }
}
