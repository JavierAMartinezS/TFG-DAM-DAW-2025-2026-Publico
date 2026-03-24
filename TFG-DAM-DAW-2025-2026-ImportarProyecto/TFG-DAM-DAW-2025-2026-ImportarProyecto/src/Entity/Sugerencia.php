<?php

namespace App\Entity;

use App\Repository\SugerenciaRepository;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\Usuario;

#[ORM\Entity(repositoryClass: SugerenciaRepository::class)]
class Sugerencia
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $mensaje = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTime $fecha = null;

    #[ORM\Column]
    private ?int $nivelPrioridad = null;

    #[ORM\ManyToOne(inversedBy: 'sugerencias')]
    private ?Usuario $usuario = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int $id): static
    {
        $this->id = $id;

        return $this;
    }

    public function getMensaje(): ?string
    {
        return $this->mensaje;
    }

    public function setMensaje(string $mensaje): static
    {
        $this->mensaje = $mensaje;

        return $this;
    }

    public function getFecha(): ?\DateTime
    {
        return $this->fecha;
    }

    public function setFecha(?\DateTime $fecha): static
    {
        $this->fecha = $fecha;

        return $this;
    }

    public function getNivelPrioridad(): ?int
    {
        return $this->nivelPrioridad;
    }

    public function setNivelPrioridad(int $nivelPrioridad): static
    {
        $this->nivelPrioridad = $nivelPrioridad;

        return $this;
    }
}
