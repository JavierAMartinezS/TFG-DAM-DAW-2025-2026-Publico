const MAX_MARKER_DISTANCE_KM = 500;
const MAX_EXPLORE_DISTANCE_KM = 90;
const EXPLORE_TARGET_COUNT = 6;
const EXPLORE_SOFT_ATTEMPT_LIMIT = 12;
const EXPLORE_HARD_ATTEMPT_LIMIT = 25;
const WALKING_KMH = 4.5;
const DRIVING_KMH = 55;

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function normalizePlace(raw) {
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

function cleanupCandidate(raw) {
    return normalizePlace(String(raw || "")
        .split(/[.;!?]/)[0]
        .split(/\b(?:por|para|despues|durante|donde|cuando|regreso|alojamiento)\b/i)[0]);
}

function isValidPlaceLabel(label) {
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

function splitCompositePlace(label) {
    const separators = [",", " - ", " / ", " | "];
    for (const separator of separators) {
        if (label.includes(separator)) {
            return label.split(separator).map((part) => normalizePlace(part)).filter(Boolean);
        }
    }
    return [label];
}

function uniqueByLower(values) {
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

function extractPlacesFromDayHeaders(text) {
    if (!text) return [];

    const results = [];
    String(text).split(/\r?\n/).forEach((line) => {
        const cleanLine = normalizePlace(line);
        const match = cleanLine.match(/^(?:dia|d[i\u00ed]a|day)\s*\d+\s*(?::|-|->)\s*(.+)$/i);
        if (!match || !match[1]) return;

        const candidate = cleanupCandidate(match[1]);
        splitCompositePlace(candidate).forEach((part) => {
            if (isValidPlaceLabel(part)) results.push(part);
        });
    });

    return uniqueByLower(results);
}

function extractPlacesFromBody(text) {
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
            const candidate = cleanupCandidate(match[1]);
            if (isValidPlaceLabel(candidate)) raw.push(candidate);
        }
    }

    return uniqueByLower(raw);
}

function extractFallbackPlaceFromTitle(title) {
    if (!title) return null;

    const letter = "A-Za-z\\u00c0-\\u017f";
    const patterns = [
        new RegExp(`\\ben\\s+([A-Z\\u00c0-\\u017f][${letter}' -]+)`, "i"),
        new RegExp(`\\b(?:a las|a los|al|a|de)\\s+([A-Z\\u00c0-\\u017f][${letter}' -]+)`, "i")
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            const candidate = normalizePlace(match[1])
                .replace(/^(el|la|los|las)\s+/i, "")
                .replace(/^(islas?|islands?)\s+/i, "");
            if (isValidPlaceLabel(candidate)) return candidate;
        }
    }

    const words = title.split(/\s+/).filter(Boolean);
    const capitalized = words.filter((word) => /^[A-Z\u00c0-\u017f]/.test(word));
    if (capitalized.length > 0) {
        const candidate = normalizePlace(capitalized.slice(-2).join(" "));
        if (isValidPlaceLabel(candidate)) return candidate;
    }

    return null;
}

function extractGeocodeContext(title, description) {
    const source = `${title || ""}\n${description || ""}`;
    if (/azores|a\u00e7ores/i.test(source)) {
        return "Azores, Portugal";
    }

    const fallback = extractFallbackPlaceFromTitle(title);
    return fallback || "";
}

async function fetchGeocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const top = data[0];
    const lat = parseFloat(top.lat);
    const lon = parseFloat(top.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

    return {
        lat,
        lon,
        displayName: top.display_name || query,
    };
}

async function geocodePlace(place, context = "") {
    const cleanPlace = normalizePlace(place);
    const queries = uniqueByLower([
        context ? `${cleanPlace}, ${context}` : "",
        cleanPlace,
    ].filter(Boolean));

    for (const query of queries) {
        const geo = await fetchGeocode(query);
        if (geo) {
            return {
                id: `${cleanPlace.toLowerCase()}-${geo.lat.toFixed(5)}-${geo.lon.toFixed(5)}`,
                place: cleanPlace,
                lat: geo.lat,
                lon: geo.lon,
                displayName: geo.displayName,
                category: "ruta",
                source: "base",
            };
        }
        await new Promise((resolve) => setTimeout(resolve, 180));
    }

    return null;
}

async function geocodePlaces(places, context = "") {
    const out = [];
    for (const place of places) {
        try {
            const geo = await geocodePlace(place, context);
            if (geo) out.push(geo);
        } catch (_) {
            // continue with the next place
        }
        await new Promise((resolve) => setTimeout(resolve, 220));
    }
    return out;
}

function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const r = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildConnectedComponents(points, maxKm) {
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
                if (!visited[j] && haversineKm(points[current], points[j]) <= maxKm) {
                    visited[j] = true;
                    stack.push(j);
                }
            }
        }

        components.push(component);
    }

    return components;
}

function filterByDistanceCluster(points, maxKm) {
    if (points.length <= 1) return points;

    const components = buildConnectedComponents(points, maxKm);
    components.sort((a, b) => b.length - a.length);
    let best = components[0].map((idx) => points[idx]);

    for (let round = 0; round < 2; round += 1) {
        const center = {
            lat: best.reduce((sum, p) => sum + p.lat, 0) / best.length,
            lon: best.reduce((sum, p) => sum + p.lon, 0) / best.length,
        };
        const refined = best.filter((p) => haversineKm(p, center) <= maxKm);
        if (refined.length === best.length || refined.length === 0) break;
        best = refined;
    }

    return best;
}

function loadMapState(tripId) {
    try {
        const raw = localStorage.getItem(`trip-map-state-${tripId}`);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
            visited: Array.isArray(parsed.visited) ? parsed.visited : [],
            suggested: Array.isArray(parsed.suggested) ? parsed.suggested : [],
            removed: Array.isArray(parsed.removed) ? parsed.removed : [],
        };
    } catch (_) {
        return { favorites: [], visited: [], suggested: [], removed: [] };
    }
}

function saveMapState(tripId, state) {
    localStorage.setItem(`trip-map-state-${tripId}`, JSON.stringify(state));
}

function estimateTime(distanceKm) {
    const speed = distanceKm <= 2.5 ? WALKING_KMH : DRIVING_KMH;
    const minutes = Math.max(4, Math.round((distanceKm / speed) * 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function buildSmartRoute(points) {
    if (points.length <= 2) return points.slice();

    const pending = points.slice(1);
    const route = [points[0]];
    while (pending.length > 0) {
        const current = route[route.length - 1];
        let bestIndex = 0;
        let bestDistance = haversineKm(current, pending[0]);
        pending.forEach((candidate, index) => {
            const distance = haversineKm(current, candidate);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });
        route.push(pending.splice(bestIndex, 1)[0]);
    }
    return route;
}

function nearestRouteDistanceKm(place, routePlaces) {
    if (!routePlaces.length) return 0;
    return routePlaces.reduce((min, routePlace) => Math.min(min, haversineKm(place, routePlace)), Infinity);
}

function isNearRoute(place, routePlaces, maxKm = MAX_EXPLORE_DISTANCE_KM) {
    return nearestRouteDistanceKm(place, routePlaces) <= maxKm;
}

function markerIcon(number, suggested = false) {
    return L.divIcon({
        className: "",
        html: `<span class="viaje-map-marker-label ${suggested ? "suggested" : ""}">${number}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
    });
}

function addFallbackMarker(map, title, statusElement, message) {
    const madrid = { lat: 40.4168, lon: -3.7038 };
    L.marker([madrid.lat, madrid.lon])
        .addTo(map)
        .bindPopup(`No se pudieron ubicar lugares diarios para "${escapeHtml(title)}".`)
        .openPopup();
    if (statusElement) {
        statusElement.textContent = message || "No se detectaron lugares validos en la descripcion.";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const mapNode = document.getElementById("mapaViajeDetalle");
    const statusElement = document.getElementById("viajeMapaEstado");
    if (!mapNode || typeof L === "undefined") return;

    const detalle = window.viajeDetalle || {};
    const title = detalle.nombre || "Viaje";
    const description = detalle.descripcion || "";
    const tripId = detalle.id || "actual";
    const state = loadMapState(tripId);
    const markersLayer = L.layerGroup();
    const routeLayer = L.layerGroup();
    let currentPlaces = [];
    let currentRoute = [];

    const map = L.map("mapaViajeDetalle", {
        center: [40.4168, -3.7038],
        zoom: 5,
        scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    markersLayer.addTo(map);
    routeLayer.addTo(map);
    L.control.layers(null, {
        "Lugares": markersLayer,
        "Ruta inteligente": routeLayer,
    }, { collapsed: false }).addTo(map);

    const placeList = document.getElementById("viajeMapPlaces");
    const routePanel = document.getElementById("viajeRoutePanel");
    const explorePanel = document.getElementById("viajeExplorePanel");
    const routeButton = document.getElementById("btnRutaInteligente");
    const exploreButton = document.getElementById("btnExplorarCerca");
    const fitButton = document.getElementById("btnAjustarMapa");
    const geocodeContext = extractGeocodeContext(title, description);
    let routeAnchors = [];

    function persist() {
        saveMapState(tripId, state);
    }

    function fitToPlaces() {
        if (!currentPlaces.length) return;
        const bounds = L.latLngBounds(currentPlaces.map((p) => [p.lat, p.lon]));
        map.fitBounds(bounds, { padding: [28, 28] });
    }

    function toggleArrayValue(array, value) {
        const index = array.indexOf(value);
        if (index >= 0) {
            array.splice(index, 1);
        } else {
            array.push(value);
        }
    }

    function renderMarkers() {
        markersLayer.clearLayers();
        currentPlaces.forEach((place, index) => {
            const isFavorite = state.favorites.includes(place.id);
            const isVisited = state.visited.includes(place.id);
            const prefix = isFavorite ? "Favorito" : (isVisited ? "Visitado" : "Lugar");
            L.marker([place.lat, place.lon], { icon: markerIcon(index + 1, place.source === "suggested") })
                .addTo(markersLayer)
                .bindPopup(`
                    <strong>${escapeHtml(place.place)}</strong><br>
                    ${escapeHtml(prefix)} &middot; ${escapeHtml(place.category || "ruta")}<br>
                    <small>${escapeHtml(place.displayName || "")}</small>
                `);
        });
    }

    function renderPlaces() {
        if (!placeList) return;
        placeList.innerHTML = "";
        if (!currentPlaces.length) {
            placeList.innerHTML = '<p class="text-muted mb-0">No hay lugares detectados todavia.</p>';
            return;
        }

        currentPlaces.forEach((place, index) => {
            const isFavorite = state.favorites.includes(place.id);
            const isVisited = state.visited.includes(place.id);
            const item = document.createElement("div");
            item.className = `viaje-map-place ${isVisited ? "visited" : ""}`;

            const titleNode = document.createElement("div");
            titleNode.className = "viaje-map-place-title";
            titleNode.innerHTML = `<span>${index + 1}. ${escapeHtml(place.place)}</span><span>${isFavorite ? "&hearts;" : ""}</span>`;
            item.appendChild(titleNode);

            const small = document.createElement("small");
            small.className = "text-muted";
            small.textContent = place.category || "ruta";
            item.appendChild(small);

            const actions = document.createElement("div");
            actions.className = "viaje-map-place-actions";

            const focus = document.createElement("button");
            focus.className = "btn btn-outline-primary btn-sm";
            focus.type = "button";
            focus.textContent = "Ver";
            focus.addEventListener("click", () => map.setView([place.lat, place.lon], 14));

            const favorite = document.createElement("button");
            favorite.className = `btn btn-sm ${isFavorite ? "btn-danger" : "btn-outline-danger"}`;
            favorite.type = "button";
            favorite.textContent = "Favorito";
            favorite.addEventListener("click", () => {
                toggleArrayValue(state.favorites, place.id);
                persist();
                renderPlaces();
                renderMarkers();
            });

            const visited = document.createElement("button");
            visited.className = `btn btn-sm ${isVisited ? "btn-success" : "btn-outline-success"}`;
            visited.type = "button";
            visited.textContent = "Visitado";
            visited.addEventListener("click", () => {
                toggleArrayValue(state.visited, place.id);
                persist();
                renderPlaces();
                renderMarkers();
            });

            const remove = document.createElement("button");
            remove.className = "btn btn-sm btn-outline-secondary";
            remove.type = "button";
            remove.textContent = "Eliminar";
            remove.addEventListener("click", () => {
                currentPlaces = currentPlaces.filter((p) => p.id !== place.id);
                state.favorites = state.favorites.filter((id) => id !== place.id);
                state.visited = state.visited.filter((id) => id !== place.id);
                state.suggested = state.suggested.filter((p) => p.id !== place.id);
                if (!state.removed.includes(place.id)) {
                    state.removed.push(place.id);
                }
                persist();
                currentRoute = currentRoute.length ? buildSmartRoute(currentPlaces) : [];
                refreshMapUi();
                if (currentPlaces.length) {
                    fitToPlaces();
                }
            });

            actions.appendChild(focus);
            actions.appendChild(favorite);
            actions.appendChild(visited);
            actions.appendChild(remove);
            item.appendChild(actions);
            placeList.appendChild(item);
        });
    }

    function renderRoute(route) {
        routeLayer.clearLayers();
        if (!routePanel) return;
        routePanel.innerHTML = "";

        if (route.length === 0) {
            routePanel.innerHTML = '<p class="text-muted mb-0">No hay puntos suficientes para crear una ruta.</p>';
            return;
        }

        if (route.length > 1) {
            L.polyline(route.map((p) => [p.lat, p.lon]), {
                color: "#ffc107",
                weight: 5,
                opacity: 0.82,
                dashArray: "10 8",
            }).addTo(routeLayer);
        }

        route.forEach((place, index) => {
            const step = document.createElement("div");
            step.className = "viaje-route-step";
            let detail = "Punto de inicio";
            if (index > 0) {
                const distance = haversineKm(route[index - 1], place);
                detail = `${distance.toFixed(1)} km desde el punto anterior - ${estimateTime(distance)}`;
            }
            step.innerHTML = `<strong>Dia ${index + 1}: ${escapeHtml(place.place)}</strong><small>${escapeHtml(detail)}</small>`;
            routePanel.appendChild(step);
        });
    }

    function refreshMapUi() {
        renderMarkers();
        renderPlaces();
        if (currentRoute.length) {
            renderRoute(currentRoute);
        }
    }

    function addSuggestedPlace(place) {
        if (currentPlaces.some((p) => p.id === place.id || p.place.toLowerCase() === place.place.toLowerCase())) {
            return;
        }
        state.removed = state.removed.filter((id) => id !== place.id);
        currentPlaces.push(place);
        state.suggested = currentPlaces.filter((p) => p.source === "suggested");
        persist();
        refreshMapUi();
        fitToPlaces();
    }

    async function requestExploreBatch(excludedNames) {
        const center = currentPlaces[0] || null;
        const res = await fetch(`/api/viajes/${tripId}/mapa/explorar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                lat: center ? center.lat : null,
                lon: center ? center.lon : null,
                zona: center ? center.place : title,
                contexto: geocodeContext,
                lugaresRuta: routeAnchors.map((place) => place.place),
                lugaresExcluidos: excludedNames,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error();
        return Array.isArray(data.lugares) ? data.lugares : [];
    }

    function shouldKeepExploring(validCount, attempts) {
        if (validCount >= EXPLORE_TARGET_COUNT) return false;
        if (attempts < EXPLORE_SOFT_ATTEMPT_LIMIT) return true;
        if (validCount >= 2) return false;
        if (attempts < EXPLORE_HARD_ATTEMPT_LIMIT) return true;
        return false;
    }

    function updateExploreProgress(validCount, attempts) {
        if (!explorePanel) return;
        explorePanel.innerHTML = `<p class="text-muted mb-0">Validando sitios cercanos... ${validCount} validos de ${attempts} comprobados.</p>`;
    }

    async function discoverValidatedExploreItems() {
        const anchors = routeAnchors.length ? routeAnchors : currentPlaces;
        const valid = [];
        const excluded = new Set(currentPlaces.map((place) => place.place.toLowerCase()));
        let attempts = 0;
        let batches = 0;

        updateExploreProgress(0, 0);

        while (shouldKeepExploring(valid.length, attempts) && batches < 8) {
            batches += 1;
            const batch = await requestExploreBatch(Array.from(excluded));
            if (!batch.length) break;

            for (const item of batch) {
                if (!shouldKeepExploring(valid.length, attempts)) break;

                const name = normalizePlace(item.nombre || "");
                if (!name) continue;

                attempts += 1;
                updateExploreProgress(valid.length, attempts);

                const key = name.toLowerCase();
                if (excluded.has(key)) continue;
                excluded.add(key);

                const geo = await geocodePlace(name, geocodeContext || title);
                if (!geo || !isNearRoute(geo, anchors)) continue;

                valid.push({
                    nombre: name,
                    categoria: item.categoria || "recomendado",
                    motivo: item.motivo || "Encaja con el viaje.",
                    geo,
                });
            }
        }

        return valid.slice(0, EXPLORE_TARGET_COUNT);
    }

    function renderExploreItems(items) {
        if (!explorePanel) return;
        explorePanel.innerHTML = "";
        if (!items.length) {
            explorePanel.innerHTML = '<p class="text-muted mb-0">La IA no encontro sitios cercanos claros.</p>';
            return;
        }

        items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "viaje-explore-item";
            row.innerHTML = `
                <strong>${escapeHtml(item.nombre)}</strong>
                <small>${escapeHtml(item.categoria || "plan")} &middot; ${escapeHtml(item.motivo || "Encaja con el viaje.")}</small>
            `;

            const button = document.createElement("button");
            button.className = "btn btn-sm btn-primary mt-2";
            button.type = "button";
            button.textContent = "Anadir al mapa";
            button.addEventListener("click", () => {
                button.disabled = true;
                addSuggestedPlace({
                    ...item.geo,
                    category: item.categoria || "recomendado",
                    source: "suggested",
                });
                button.textContent = "Anadido";
            });

            row.appendChild(button);
            explorePanel.appendChild(row);
        });
    }

    let places = extractPlacesFromDayHeaders(description);
    if (places.length === 0) places = extractPlacesFromBody(description);
    if (places.length === 0) {
        const fallback = extractFallbackPlaceFromTitle(title);
        if (fallback) places = [fallback];
    }

    if (places.length === 0) {
        addFallbackMarker(map, title, statusElement, "No se detectaron ciudades en la descripcion. Prueba con lineas tipo Dia 1: Lugar.");
        renderPlaces();
        return;
    }

    let geocoded = await geocodePlaces(places, geocodeContext);
    if (geocoded.length === 0) {
        const fallback = extractFallbackPlaceFromTitle(title);
        if (fallback && !places.some((place) => place.toLowerCase() === fallback.toLowerCase())) {
            const fallbackGeo = await geocodePlace(fallback, geocodeContext);
            if (fallbackGeo) geocoded = [fallbackGeo];
        }
    }

    if (geocoded.length === 0) {
        addFallbackMarker(map, title, statusElement, `Se detectaron posibles lugares (${places.join(", ")}), pero no se pudieron ubicar en el mapa.`);
        renderPlaces();
        return;
    }

    const filtered = filterByDistanceCluster(geocoded, MAX_MARKER_DISTANCE_KM);
    routeAnchors = filtered.slice();
    const originalSuggestedCount = (state.suggested || []).length;
    const safeSuggested = (state.suggested || []).filter((place) => isNearRoute(place, routeAnchors));
    state.suggested = safeSuggested;
    currentPlaces = filtered.concat(safeSuggested).filter((place) => !state.removed.includes(place.id));
    if (state.removed.length || safeSuggested.length !== originalSuggestedCount) {
        persist();
    }
    refreshMapUi();
    fitToPlaces();

    const discarded = geocoded.length - filtered.length;
    if (statusElement) {
        const base = `Lugares detectados: ${filtered.map((p) => p.place).join(", ")}.`;
        statusElement.textContent = discarded > 0
            ? `${base} Se descartaron ${discarded} por estar fuera de ${MAX_MARKER_DISTANCE_KM} km del grupo principal.`
            : base;
    }

    if (routeButton) {
        routeButton.addEventListener("click", () => {
            currentRoute = buildSmartRoute(currentPlaces);
            renderRoute(currentRoute);
            if (statusElement) {
                statusElement.textContent = "Ruta inteligente generada por cercania con tiempos estimados.";
            }
        });
    }

    if (fitButton) {
        fitButton.addEventListener("click", fitToPlaces);
    }

    if (exploreButton) {
        exploreButton.addEventListener("click", async () => {
            exploreButton.disabled = true;
            if (explorePanel) {
                explorePanel.innerHTML = '<p class="text-muted mb-0">Buscando recomendaciones cercanas con IA...</p>';
            }

            try {
                const validItems = await discoverValidatedExploreItems();
                renderExploreItems(validItems);
            } catch (_) {
                if (explorePanel) {
                    explorePanel.innerHTML = '<p class="text-muted mb-0">No se pudieron generar recomendaciones ahora mismo.</p>';
                }
            } finally {
                exploreButton.disabled = false;
            }
        });
    }
});
