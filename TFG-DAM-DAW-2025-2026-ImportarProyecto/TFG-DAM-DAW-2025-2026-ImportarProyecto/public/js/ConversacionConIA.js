const chatWindow = document.querySelector(".ia-chat-window");
const sidebar = document.querySelector(".ia-map-sidebar");
const input = document.querySelector(".ia-chat-input input");
const button = document.querySelector(".ia-chat-input button");
const mapPanel = document.querySelector(".ia-map-panel");
const mapCanvas = document.querySelector(".ia-map-canvas");
const mapToggle = document.querySelector(".ia-map-toggle");
const PREVIEW_MAX_MARKER_DISTANCE_KM = 500;
let tarjetaSeleccionada = null;
let viajesMostrados = [];
let spinnerChat = null;
let previewMap = null;
let previewMapRun = 0;

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
    if (!contenedor) return;

    contenedor.className = "ia-selected-actions";
    contenedor.innerHTML = `
        <button class="btn btn-warning ia-preview-map-btn" type="button">Visualizar en el mapa</button>
        <div class="ia-selected-actions-grid">
            <button class="btn btn-success ia-save-trip" type="button">Guardar viaje</button>
            <button class="btn btn-danger ia-discard-trip" type="button">Descartar viaje</button>
        </div>
    `;

    contenedor.querySelector(".ia-preview-map-btn").onclick = () => {
        visualizarViajeEnMapa(tarjetaSeleccionada);
    };

    contenedor.querySelector(".ia-discard-trip").onclick = () => {
        tarjetaSeleccionada.remove();
        tarjetaSeleccionada = null;
    };

    contenedor.querySelector(".ia-save-trip").onclick = async () => {
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

function previewEscapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function previewNormalizePlace(raw) {
    return String(raw || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/[*_`#]/g, " ")
        .replace(/[()[\]{}]/g, " ")
        .replace(/\s+(EUR|euros?)\b.*$/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[.,;:!?-]+$/g, "")
        .trim();
}

function previewCleanupCandidate(raw) {
    return previewNormalizePlace(String(raw || "")
        .split(/[.;!?]/)[0]
        .split(/\b(?:por|para|despues|durante|donde|cuando|regreso|alojamiento)\b/i)[0]);
}

function previewIsValidPlace(label) {
    if (!label) return false;
    const blocked = new Set([
        "llegada", "visita", "entrada", "manana", "tarde", "noche",
        "desayuno", "comida", "cena", "presupuesto", "dia", "check in",
        "check-in", "hotel", "regreso", "salida", "actividad", "plan",
        "tipo de viaje", "viajeros", "fechas", "fechas duracion", "itinerario",
        "costo", "coste", "presupuesto total", "eur", "ia", "un", "una"
    ]);
    const low = label.toLowerCase();
    if (blocked.has(low)) return false;
    if (label.length < 2 || label.length > 80) return false;
    if (/\d/.test(label)) return false;
    if (/^[A-Z]{1,3}$/.test(label)) return false;
    if (/^(el|la|los|las|un|una|unos|unas)\s/i.test(label)) return false;
    return true;
}

function previewSplitCompositePlace(label) {
    const separators = [",", " - ", " / ", " | "];
    for (const separator of separators) {
        if (label.includes(separator)) {
            return label.split(separator).map((part) => previewNormalizePlace(part)).filter(Boolean);
        }
    }
    return [label];
}

function previewUnique(values) {
    const out = [];
    const seen = new Set();
    values.forEach((value) => {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            out.push(value);
        }
    });
    return out;
}

function previewExtractPlacesFromDayHeaders(text) {
    if (!text) return [];

    const results = [];
    const dayPattern = /^(?:dia|d[i\u00ed]a|day)\s*\d+\s*(?::|-|->)\s*(.+)$/i;

    String(text).split(/\r?\n/).forEach((line) => {
        const match = previewNormalizePlace(line).match(dayPattern);
        if (!match || !match[1]) return;

        const candidate = previewCleanupCandidate(match[1]);
        previewSplitCompositePlace(candidate).forEach((part) => {
            if (previewIsValidPlace(part)) results.push(part);
        });
    });

    return previewUnique(results);
}

function previewExtractPlacesFromBody(text) {
    if (!text) return [];

    const letter = "A-Za-z\\u00c0-\\u017f";
    const patterns = [
        new RegExp(`\\b(?:llegada|regreso|visita|excursion|excursi\\u00f3n|traslado|dirigimos|salimos|vamos)\\s+(?:a|al|en|hacia)\\s+([A-Z\\u00c0-\\u017f][${letter}' -]{1,58})`, "gi"),
        new RegExp(`\\b(?:en|hacia|a)\\s+([A-Z\\u00c0-\\u017f][${letter}' -]{1,58})`, "gi")
    ];

    const raw = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const candidate = previewCleanupCandidate(match[1]);
            if (previewIsValidPlace(candidate)) raw.push(candidate);
        }
    }

    return previewUnique(raw);
}

function previewExtractFromText(text) {
    let places = previewExtractPlacesFromDayHeaders(text);
    if (places.length === 0) places = previewExtractPlacesFromBody(text);
    return places.slice(0, 8);
}

function previewFallbackPlace(title) {
    if (!title) return null;

    const letter = "A-Za-z\\u00c0-\\u017f";
    const patterns = [
        new RegExp(`\\ben\\s+([A-Z\\u00c0-\\u017f][${letter}' -]+)`, "i"),
        new RegExp(`\\b(?:a las|a los|al|a|de)\\s+([A-Z\\u00c0-\\u017f][${letter}' -]+)`, "i")
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            const candidate = previewNormalizePlace(match[1])
                .replace(/^(el|la|los|las)\s+/i, "")
                .replace(/^(islas?|islands?)\s+/i, "");
            if (previewIsValidPlace(candidate)) return candidate;
        }
    }

    const words = title.split(/\s+/).filter(Boolean);
    const capitalized = words.filter((word) => /^[A-Z\u00c0-\u017f]/.test(word));
    if (capitalized.length > 0) {
        const candidate = previewNormalizePlace(capitalized.slice(-2).join(" "));
        if (previewIsValidPlace(candidate)) return candidate;
    }

    return null;
}

function previewBuildContext(title, description) {
    const source = `${title || ""}\n${description || ""}`;
    if (/azores|a\u00e7ores/i.test(source)) {
        return "Azores, Portugal";
    }

    const fallback = previewFallbackPlace(title);
    return fallback || "";
}

function previewMapIcon(number) {
    return L.divIcon({
        className: "",
        html: `<span class="viaje-map-marker-label">${number}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
    });
}

async function previewFetchGeocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    const lat = parseFloat(top.lat);
    const lon = parseFloat(top.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon, displayName: top.display_name || query };
}

async function previewGeocodePlace(place, context = "") {
    const cleanPlace = previewNormalizePlace(place);
    const queries = previewUnique([
        context ? `${cleanPlace}, ${context}` : "",
        cleanPlace,
    ].filter(Boolean));

    for (const query of queries) {
        const geo = await previewFetchGeocode(query);
        if (geo) {
            return {
                place: cleanPlace,
                lat: geo.lat,
                lon: geo.lon,
                displayName: geo.displayName,
            };
        }
        await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return null;
}

async function previewGeocodePlaces(places, context, runId) {
    const out = [];
    for (const place of places) {
        if (runId !== previewMapRun) return [];
        try {
            const geo = await previewGeocodePlace(place, context);
            if (geo) out.push(geo);
        } catch (_) {
            // Continue with the next place.
        }
        await new Promise((resolve) => setTimeout(resolve, 220));
    }
    return out;
}

function previewHaversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const r = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function previewBuildConnectedComponents(points, maxKm) {
    const n = points.length;
    const visited = new Array(n).fill(false);
    const components = [];

    for (let i = 0; i < n; i += 1) {
        if (visited[i]) continue;
        const stack = [i];
        visited[i] = true;
        const component = [];

        while (stack.length > 0) {
            const current = stack.pop();
            component.push(current);
            for (let j = 0; j < n; j += 1) {
                if (!visited[j] && previewHaversineKm(points[current], points[j]) <= maxKm) {
                    visited[j] = true;
                    stack.push(j);
                }
            }
        }

        components.push(component);
    }

    return components;
}

function previewFilterByDistanceCluster(points, maxKm) {
    if (points.length <= 1) return points;

    const components = previewBuildConnectedComponents(points, maxKm);
    components.sort((a, b) => b.length - a.length);
    let best = components[0].map((idx) => points[idx]);

    for (let round = 0; round < 2; round += 1) {
        const center = {
            lat: best.reduce((sum, p) => sum + p.lat, 0) / best.length,
            lon: best.reduce((sum, p) => sum + p.lon, 0) / best.length,
        };
        const refined = best.filter((p) => previewHaversineKm(p, center) <= maxKm);
        if (refined.length === best.length || refined.length === 0) break;
        best = refined;
    }

    return best;
}

function previewBuildSmartRoute(points) {
    if (points.length <= 2) return points.slice();

    const pending = points.slice(1);
    const route = [points[0]];
    while (pending.length > 0) {
        const current = route[route.length - 1];
        let bestIndex = 0;
        let bestDistance = previewHaversineKm(current, pending[0]);
        pending.forEach((candidate, index) => {
            const distance = previewHaversineKm(current, candidate);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });
        route.push(pending.splice(bestIndex, 1)[0]);
    }
    return route;
}

async function visualizarViajeEnMapa(card) {
    if (!mapCanvas || typeof L === "undefined") return;

    const runId = ++previewMapRun;
    const title = card.dataset.titulo || "Viaje";
    const description = card.dataset.plan || "";
    if (!description) return;
    const sourceText = [
        title,
        description,
        window.viaje?.tipoViaje || "",
        window.viaje?.fechas || "",
        window.viaje?.presupuesto ? `${window.viaje.presupuesto} EUR` : "",
    ].join("\n");

    setMapPanelOpen(true);
    if (previewMap) {
        previewMap.remove();
        previewMap = null;
    }

    mapCanvas.innerHTML = `
        <div class="ia-map-preview-shell">
            <div class="ia-map-preview-header">
                <strong>${previewEscapeHtml(title)}</strong>
                <span>Previsualizacion temporal</span>
            </div>
            <div id="iaPreviewMap" class="ia-map-preview-map"></div>
            <p class="ia-map-preview-status">Generando mapa del ultimo viaje pulsado...</p>
        </div>
    `;

    const status = mapCanvas.querySelector(".ia-map-preview-status");
    const mapNode = mapCanvas.querySelector("#iaPreviewMap");
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (runId !== previewMapRun || !mapNode) return;

    previewMap = L.map(mapNode, {
        center: [40.4168, -3.7038],
        zoom: 5,
        scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
    }).addTo(previewMap);

    const places = previewExtractFromText(sourceText);
    if (places.length === 0) {
        const fallback = previewFallbackPlace(title);
        if (fallback) places.push(fallback);
    }

    if (places.length === 0) {
        L.marker([40.4168, -3.7038])
            .addTo(previewMap)
            .bindPopup(`No se detectaron ciudades en la descripcion de "${previewEscapeHtml(title)}".`)
            .openPopup();
        if (status) status.textContent = "No se detectaron ciudades en la descripcion. Prueba con lineas tipo Dia 1: Lugar.";
        return;
    }

    const context = previewBuildContext(title, description);
    let geocoded = await previewGeocodePlaces(places, context, runId);
    if (runId !== previewMapRun) return;

    if (geocoded.length === 0) {
        const fallback = previewFallbackPlace(title);
        if (fallback && !places.some((place) => place.toLowerCase() === fallback.toLowerCase())) {
            const fallbackGeo = await previewGeocodePlace(fallback, context);
            if (fallbackGeo) geocoded = [fallbackGeo];
        }
    }

    if (geocoded.length === 0) {
        L.marker([40.4168, -3.7038])
            .addTo(previewMap)
            .bindPopup(`No se pudieron ubicar lugares para "${previewEscapeHtml(title)}".`)
            .openPopup();
        if (status) status.textContent = `Se detectaron posibles lugares (${places.join(", ")}), pero no se pudieron ubicar en el mapa.`;
        return;
    }

    const filtered = previewFilterByDistanceCluster(geocoded, PREVIEW_MAX_MARKER_DISTANCE_KM);
    const route = previewBuildSmartRoute(filtered);

    route.forEach((place, index) => {
        L.marker([place.lat, place.lon], { icon: previewMapIcon(index + 1) })
            .addTo(previewMap)
            .bindPopup(`
                <strong>${previewEscapeHtml(place.place)}</strong><br>
                <small>${previewEscapeHtml(place.displayName || "")}</small>
            `);
    });

    if (route.length > 1) {
        L.polyline(route.map((place) => [place.lat, place.lon]), {
            color: "#ffc107",
            weight: 5,
            opacity: 0.82,
            dashArray: "10 8",
        }).addTo(previewMap);
    }

    const bounds = L.latLngBounds(route.map((place) => [place.lat, place.lon]));
    previewMap.fitBounds(bounds, { padding: [28, 28] });
    setTimeout(() => previewMap && previewMap.invalidateSize(), 120);
    if (status) {
        const discarded = geocoded.length - filtered.length;
        const base = `Ruta detectada: ${route.map((place, index) => `${index + 1}. ${place.place}`).join(" -> ")}.`;
        status.textContent = discarded > 0
            ? `${base} Se descartaron ${discarded} por estar fuera de ${PREVIEW_MAX_MARKER_DISTANCE_KM} km del grupo principal.`
            : base;
    }
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
        card.dataset.descripcion = v.descripcion || "";
        card.classList.add("card", "mb-3");
        card.style.background = "#3E4D57";
        card.style.color = "#fff";
        card.style.padding = "1rem";

        card.innerHTML = `
            <h4 class="text-center">${v.titulo}</h4>
            <p class="text-center">${v.descripcion}</p>
            <div class="ia-trip-card-actions">
                <button class="btn btn-light btn-sm ia-select-trip" type="button">Seleccionar</button>
            </div>
        `;

        card.querySelector(".ia-select-trip").onclick = () => {
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
