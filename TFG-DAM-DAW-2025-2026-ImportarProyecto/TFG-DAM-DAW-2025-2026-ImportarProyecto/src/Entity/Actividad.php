<?php

namespace App\Entity;

use App\Repository\ActividadRepository;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\Ciudad;
use App\Entity\MedioTransporte;
use App\Entity\CoordenadasGeograficas;

#[ORM\Entity(repositoryClass: ActividadRepository::class)]
class Actividad
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $nombre = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $descripcion = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTime $fechaInicio = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTime $fechaFin = null;

    #[ORM\Column(nullable: true)]
    private ?float $costeEstimado = null;

    #[ORM\OneToOne(cascade: ['persist', 'remove'])]
    private ?CoordenadasGeograficas $coordenadas = null;    

    #[ORM\ManyToOne(targetEntity: MedioTransporte::class, inversedBy: 'actividades')]
    private ?MedioTransporte $medioTransporte = null;

    #[ORM\ManyToOne(inversedBy: 'actividades')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Ciudad $ciudad = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int $id): static
    {
        $this->id = $id;

        return $this;
    }

    public function getNombre(): ?string
    {
        return $this->nombre;
    }

    public function setNombre(string $nombre): static
    {
        $this->nombre = $nombre;

        return $this;
    }

    public function getDescripcion(): ?string
    {
        return $this->descripcion;
    }

    public function setDescripcion(?string $descripcion): static
    {
        $this->descripcion = $descripcion;

        return $this;
    }

    public function getFechaInicio(): ?\DateTime
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(?\DateTime $fechaInicio): static
    {
        $this->fechaInicio = $fechaInicio;

        return $this;
    }

    public function getFechaFin(): ?\DateTime
    {
        return $this->fechaFin;
    }

    public function setFechaFin(?\DateTime $fechaFin): static
    {
        $this->fechaFin = $fechaFin;

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
}
