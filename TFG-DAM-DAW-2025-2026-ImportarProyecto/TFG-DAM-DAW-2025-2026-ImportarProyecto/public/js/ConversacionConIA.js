const chatWindow = document.querySelector(".ia-chat-window");
const sidebar = document.querySelector(".ia-map-sidebar");
const input = document.querySelector(".ia-chat-input input");
const button = document.querySelector(".ia-chat-input button");
const mapPanel = document.querySelector(".ia-map-panel");
const mapCanvas = document.querySelector(".ia-map-canvas");
const mapToggle = document.querySelector(".ia-map-toggle");
let tarjetaSeleccionada = null;
let viajesMostrados = [];
let spinnerChat = null;

function setMapPanelOpen(isOpen) {
    if (!mapPanel || !mapToggle) return;
    mapPanel.classList.toggle("is-open", isOpen);
    if (mapCanvas) {
        mapCanvas.classList.toggle("is-open", isOpen);
    }
    mapToggle.setAttribute("aria-expanded", String(isOpen));
    mapToggle.setAttribute("aria-label", isOpen ? "Cerrar mapa" : "Abrir mapa");
}

function addBotMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("bot-bubble");
    div.innerHTML = formatBotText(msg);
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function formatBotText(text) {
    return text.replace(/\n/g, "<br>").replace(/\*\s(.+?)\s/g, "• $1 ");
}

function addUserMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("user-bubble");
    div.textContent = msg;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showChatSpinner() {
    spinnerChat = document.createElement("div");
    spinnerChat.className = "bot-bubble";
    spinnerChat.innerHTML = `<div class="spinner-grow" role="status" style="width:10px;height:10px;"><span class="visually-hidden">Loading...</span></div>`;
    chatWindow.appendChild(spinnerChat);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeChatSpinner() {
    if (spinnerChat) {
        spinnerChat.remove();
        spinnerChat = null;
    }
}

function createSidebarSpinner() {
    const div = document.createElement("div");
    div.className = "d-flex justify-content-center my-3";
    div.innerHTML = `<div class="spinner-border" role="status"></div>`;
    sidebar.appendChild(div);
    return div;
}

function transformarTarjetaSeleccionada() {
    if (!tarjetaSeleccionada) return;

    const contenedor = tarjetaSeleccionada.querySelector("div");
    const titulo = tarjetaSeleccionada.dataset.titulo;
    const plan = tarjetaSeleccionada.dataset.plan;

    contenedor.innerHTML = `
        <div style="display:flex;justify-content:space-between">
            <button class="btn btn-success" style="width:45%;padding:0.75rem">Guardar viaje</button>
            <button class="btn btn-danger" style="width:45%;padding:0.75rem">Descartar viaje</button>
        </div>
    `;

    contenedor.querySelector(".btn-danger").onclick = () => {
        tarjetaSeleccionada.remove();
        tarjetaSeleccionada = null;
    };

    contenedor.querySelector(".btn-success").onclick = async () => {
        const data = {
            nombre: tarjetaSeleccionada.dataset.titulo,
            descripcion: tarjetaSeleccionada.dataset.plan || '',
            tipoViajeId: mapTipoViaje(window.viaje.tipoViaje),
            presupuestoEstimado: window.viaje.presupuesto || null,
            fechaInicio: window.viaje.fechaInicioExacta || null,
            fechaFin: window.viaje.fechaFinExacta || null,
            duracion: window.viaje.duracion || null,
            usuarioId: null
        };

        const res = await fetch("/api/viajes/guardar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (res.status === 401) {
            window.location.href = "/login";
        } else if (res.ok) {
            tarjetaSeleccionada.remove();
            tarjetaSeleccionada = null;
            await renderMisViajes();
        } else {
            alert("Error al guardar el viaje.");
        }
    };

}

function mapTipoViaje(tipo) {
    const tipos = ["Aventura", "Relax", "Cultural", "Romántico", "Playa", "Ciudad", "Familiar"];
    const index = tipos.indexOf(tipo);
    return index >= 0 ? index : 0;
}

function seleccionarViaje(titulo) {
    showChatSpinner();

    fetch("/api/chat/seleccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viaje: titulo })
    })
    .then(res => res.json())
    .then(data => {
        removeChatSpinner();
        if (data.respuesta) {
            addBotMessage(data.respuesta);
            tarjetaSeleccionada.dataset.plan = data.respuesta;
            transformarTarjetaSeleccionada();
        }
    })
    .catch(() => {
        removeChatSpinner();
        addBotMessage("Error al generar el itinerario.");
    });
}

function renderTarjetas(viajes) {
    sidebar.innerHTML = "";
    viajes.forEach(v => {
        viajesMostrados.push(v.titulo);
        const card = document.createElement("div");
        card.dataset.titulo = v.titulo;
        card.classList.add("card", "mb-3");
        card.style.background = "#3E4D57";
        card.style.color = "#fff";
        card.style.padding = "1rem";

        card.innerHTML = `<h4 class="text-center">${v.titulo}</h4><p class="text-center">${v.descripcion}</p><div style="text-align:center"><button class="btn btn-light btn-sm" style="width:90%">Seleccionar</button></div>`;
        card.querySelector("button").onclick = () => {
            tarjetaSeleccionada = card;
            addUserMessage(`Elijo el viaje: ${v.titulo}`);
            seleccionarViaje(v.titulo);
        };
        sidebar.appendChild(card);
    });

    const otro = document.createElement("div");
    otro.classList.add("card");
    otro.style.background = "#3E4D57";
    otro.style.color = "#fff";
    otro.style.padding = "1rem";
    otro.innerHTML = `<h4 class="text-center">Otro destino</h4><p class="text-center">Quiero ver otras opciones</p><div style="text-align:center"><button class="btn btn-light btn-sm" style="width:90%">Seleccionar</button></div>`;
    otro.querySelector("button").onclick = () => {
        addUserMessage("Quiero ver otros viajes");
        addBotMessage("Voy a generar nuevas propuestas para ti.");
        iniciarGeneracionViajes();
    };
    sidebar.appendChild(otro);
}

function iniciarGeneracionViajes() {
    const spinner = createSidebarSpinner();

    fetch("/api/chat/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            tipoViaje: window.viaje.tipoViaje,
            numViajeros: window.viaje.numViajeros,
            fechas: window.viaje.fechas,
            presupuesto: window.viaje.presupuesto,
            viajesExcluidos: viajesMostrados
        })
    })
    .then(res => res.json())
    .then(data => {
        spinner.remove();
        if (!data.viajes) {
            addBotMessage("No he podido generar nuevos viajes.");
            return;
        }
        renderTarjetas(data.viajes);
    })
    .catch(() => {
        spinner.remove();
        addBotMessage("Error conectando con la IA.");
    });
}

function enviarMensajeIA(texto) {
    showChatSpinner();

    fetch("/api/chat/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mensaje: texto,
            tipoViaje: window.viaje.tipoViaje,
            numViajeros: window.viaje.numViajeros,
            fechas: window.viaje.fechas,
            presupuesto: window.viaje.presupuesto
        })
    })
    .then(res => res.json())
    .then(data => {
        removeChatSpinner();
        if (data.respuesta) {
            addBotMessage(data.respuesta);
        }
    })
    .catch(() => {
        removeChatSpinner();
        addBotMessage("Ha ocurrido un error al generar la respuesta.");
    });
}

async function renderMisViajes() {
    const container = document.querySelector(".accordion-body");
    container.innerHTML = "";

    const res = await fetch("/api/viajes/listar");
    if (!res.ok) return;
    const viajes = await res.json();

    viajes.forEach(v => {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.marginBottom = "0.5rem";
        div.style.width = "100%";

        const nombre = document.createElement("span");
        nombre.textContent = v.nombre;

        const botones = document.createElement("div");
        botones.style.display = "flex";
        botones.style.gap = "0.5rem";

        const ver = document.createElement("button");
        ver.className = "btn btn-primary btn-sm";
        ver.textContent = "Ver detalles";
        ver.onclick = () => {
            window.location.href = `/viajes/${v.id}`;
        };

        const eliminar = document.createElement("button");
        eliminar.className = "btn btn-danger btn-sm";
        eliminar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/></svg>`;
        eliminar.onclick = async () => {
            await fetch(`/api/viajes/eliminar/${v.id}`, { method: "DELETE" });
            renderMisViajes();
        };

        botones.appendChild(ver);
        botones.appendChild(eliminar);

        div.appendChild(nombre);
        div.appendChild(botones);

        container.appendChild(div);
    });
}

window.addEventListener("DOMContentLoaded", () => {
    addBotMessage("He analizado tus datos para el viaje. Generando viajes...");
    iniciarGeneracionViajes();
    renderMisViajes();
});

if (mapToggle) {
    mapToggle.addEventListener("click", () => {
        setMapPanelOpen(!mapPanel.classList.contains("is-open"));
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        setMapPanelOpen(false);
    }
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 1300) {
        setMapPanelOpen(false);
    }
});

button.addEventListener("click", () => {
    const msg = input.value.trim();
    if (!msg) return;
    addUserMessage(msg);
    input.value = "";
    enviarMensajeIA(msg);
});

input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        button.click();
    }
});
