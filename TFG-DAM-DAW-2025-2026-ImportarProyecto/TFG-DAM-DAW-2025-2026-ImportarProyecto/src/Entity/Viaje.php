<?php

namespace App\Entity;

use App\Repository\ViajeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\Collection;
use Doctrine\Common\Collections\ArrayCollection;
use App\Entity\Usuario;
use App\Entity\Itinerario;
use App\Entity\TipoViaje;
use App\Entity\Ciudad;

#[ORM\Entity(repositoryClass: ViajeRepository::class)]
class Viaje
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $nombre = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    private ?\DateTime $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    private ?\DateTime $fechaFin = null;

    #[ORM\Column(nullable: true)]
    private ?float $presupuestoEstimado = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $descripcion = null;

    #[ORM\ManyToOne(targetEntity: TipoViaje::class, inversedBy: 'viajes')]
    private ?TipoViaje $tipoViaje = null;

    #[ORM\OneToMany(mappedBy: 'viaje', targetEntity: Ciudad::class, cascade: ['persist', 'remove'])]
    private Collection $ciudades;

    #[ORM\OneToOne(mappedBy: 'viaje', targetEntity: Itinerario::class, cascade: ['persist', 'remove'])]
    private ?Itinerario $itinerario = null; 

    #[ORM\ManyToOne(inversedBy: 'viajes')]
    #[ORM\JoinColumn(nullable: true)]
    private ?Usuario $usuario = null;

    public function __construct()
    {
        $this->ciudades = new ArrayCollection();
    }

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

    public function getFechaInicio(): ?\DateTime
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(\DateTime $fechaInicio): static
    {
        $this->fechaInicio = $fechaInicio;
        return $this;
    }

    public function getFechaFin(): ?\DateTime
    {
        return $this->fechaFin;
    }

    public function setFechaFin(\DateTime $fechaFin): static
    {
        $this->fechaFin = $fechaFin;
        return $this;
    }

    public function getPresupuestoEstimado(): ?float
    {
        return $this->presupuestoEstimado;
    }

    public function setPresupuestoEstimado(?float $presupuestoEstimado): static
    {
        $this->presupuestoEstimado = $presupuestoEstimado;
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

    public function getTipoViaje(): ?TipoViaje
    {
        return $this->tipoViaje;
    }

    public function setTipoViaje(?TipoViaje $tipoViaje): static
    {
        $this->tipoViaje = $tipoViaje;
        return $this;
    }

    public function getUsuario(): ?Usuario
    {
        return $this->usuario;
    }

    public function setUsuario(?Usuario $usuario): static
    {
        $this->usuario = $usuario;
        return $this;
    }
}