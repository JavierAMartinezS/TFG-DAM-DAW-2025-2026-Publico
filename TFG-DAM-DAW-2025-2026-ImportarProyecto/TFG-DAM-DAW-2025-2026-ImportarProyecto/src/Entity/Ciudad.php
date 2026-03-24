<?php

namespace App\Entity;

use App\Repository\CiudadRepository;
use App\Entity\Viaje;
use App\Entity\Actividad;
use App\Entity\CoordenadasGeograficas;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\Collection;

#[ORM\Entity(repositoryClass: CiudadRepository::class)]
class Ciudad
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $nombre = null;

    #[ORM\Column(length: 255)]
    private ?string $pais = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $descripcion = null;

    #[ORM\OneToMany(mappedBy: 'ciudad', targetEntity: Actividad::class)]
    private Collection $actividades;

    #[ORM\OneToOne(cascade: ['persist', 'remove'])]
    private ?CoordenadasGeograficas $coordenadas = null;

    #[ORM\ManyToOne(inversedBy: 'ciudades')]
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

    public function getNombre(): ?string
    {
        return $this->nombre;
    }

    public function setNombre(string $nombre): static
    {
        $this->nombre = $nombre;

        return $this;
    }

    public function getPais(): ?string
    {
        return $this->pais;
    }

    public function setPais(string $pais): static
    {
        $this->pais = $pais;

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
}
