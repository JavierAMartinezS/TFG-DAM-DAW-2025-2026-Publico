<?php

namespace App\Entity;

use App\Repository\SugerenciaRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\Usuario;
use App\Entity\Viaje;

#[ORM\Entity(repositoryClass: SugerenciaRepository::class)]
class Sugerencia
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(type: Types::TEXT)]
    private ?string $mensaje = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTime $fecha = null;

    #[ORM\Column(options: ['default' => 1])]
    private ?int $nivelPrioridad = 1;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $contenidoJson = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $notasAdicionales = null;

    #[ORM\ManyToOne(inversedBy: 'sugerencias')]
    private ?Usuario $usuario = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Viaje $viaje = null;

    public function __construct()
    {
        $this->fecha = new \DateTime();
        $this->nivelPrioridad = 1;
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

    public function getContenidoJson(): ?string
    {
        return $this->contenidoJson;
    }

    public function setContenidoJson(?string $contenidoJson): static
    {
        $this->contenidoJson = $contenidoJson;

        return $this;
    }

    public function getNotasAdicionales(): ?string
    {
        return $this->notasAdicionales;
    }

    public function setNotasAdicionales(?string $notasAdicionales): static
    {
        $this->notasAdicionales = $notasAdicionales;

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

    public function getViaje(): ?Viaje
    {
        return $this->viaje;
    }

    public function setViaje(?Viaje $viaje): static
    {
        $this->viaje = $viaje;

        return $this;
    }
}
