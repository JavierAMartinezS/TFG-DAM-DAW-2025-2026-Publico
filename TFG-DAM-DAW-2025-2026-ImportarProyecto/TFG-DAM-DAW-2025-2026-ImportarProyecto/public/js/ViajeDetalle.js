const MAX_MARKER_DISTANCE_KM = 500;

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function normalizePlace(raw) {
    return String(raw || "")
        .replace(/[*_`#]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isValidPlaceLabel(label) {
    if (!label) {
        return false;
    }

    const blocked = new Set([
        "llegada", "visita", "entrada", "manana", "mañana", "tarde", "noche",
        "desayuno", "comida", "cena", "presupuesto", "dia", "día", "check in",
        "check-in", "hotel", "regreso", "salida", "actividad", "plan"
    ]);

    const low = label.toLowerCase();
    if (blocked.has(low)) {
        return false;
    }
    if (label.length < 2 || label.length > 80) {
        return false;
    }
    if (/\d/.test(label)) {
        return false;
    }

    return true;
}

function splitCompositePlace(label) {
    const separators = [",", " - ", " / ", " | ", " y "];
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
    if (!text) {
        return [];
    }

    const results = [];
    const regex = /(?:^|\n)\s*(?:[-*]\s*)?(?:[*_]{0,2})\s*(?:dia|día|d[ií]a|dÃ­a|day)\s*\d+\s*:\s*([^\n]+?)\s*(?:[*_]{0,2})\s*(?=\n|$)/gim;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const rawPlace = normalizePlace(match[1]);
        splitCompositePlace(rawPlace).forEach((part) => {
            if (isValidPlaceLabel(part)) {
                results.push(part);
            }
        });
    }

    return uniqueByLower(results);
}

function extractPlacesFromBody(text) {
    if (!text) {
        return [];
    }

    const patterns = [
        /\b(?:llegada|regreso|visita|excursion|excursión|traslado)\s+(?:a|en)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ' -]{1,50})/gi,
        /\b(?:en|hacia)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ' -]{1,50})/gi
    ];

    const raw = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const candidate = normalizePlace(match[1]).split(/[.,;:!?()[\]{}]/)[0].trim();
            if (isValidPlaceLabel(candidate)) {
                raw.push(candidate);
            }
        }
    }

    return uniqueByLower(raw);
}

function extractFallbackPlaceFromTitle(title) {
    if (!title) {
        return null;
    }

    const patterns = [
        /\ben\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ' -]+)/,
        /\bde\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ' -]+)/
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            const candidate = normalizePlace(match[1]);
            if (isValidPlaceLabel(candidate)) {
                return candidate;
            }
        }
    }

    const words = title.split(/\s+/).filter(Boolean);
    const capitalized = words.filter((word) => /^[A-ZÁÉÍÓÚÑ]/.test(word));
    if (capitalized.length > 0) {
        const candidate = normalizePlace(capitalized.slice(-2).join(" "));
        if (isValidPlaceLabel(candidate)) {
            return candidate;
        }
    }

    return null;
}

async function geocodePlace(place) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
        return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    const top = data[0];
    const lat = parseFloat(top.lat);
    const lon = parseFloat(top.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return null;
    }

    return {
        place,
        lat,
        lon,
        displayName: top.display_name || place,
    };
}

async function geocodePlaces(places) {
    const out = [];
    for (const place of places) {
        try {
            const geo = await geocodePlace(place);
            if (geo) {
                out.push(geo);
            }
        } catch (_) {
            // ignore and continue
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
        if (visited[i]) {
            continue;
        }
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
    if (points.length <= 1) {
        return points;
    }

    const components = buildConnectedComponents(points, maxKm);
    components.sort((a, b) => b.length - a.length);
    let best = components[0].map((idx) => points[idx]);

    for (let round = 0; round < 2; round += 1) {
        const center = {
            lat: best.reduce((sum, p) => sum + p.lat, 0) / best.length,
            lon: best.reduce((sum, p) => sum + p.lon, 0) / best.length,
        };
        const refined = best.filter((p) => haversineKm(p, center) <= maxKm);
        if (refined.length === best.length || refined.length === 0) {
            break;
        }
        best = refined;
    }

    return best;
}

function addFallbackMarker(map, title, statusElement) {
    const madrid = { lat: 40.4168, lon: -3.7038 };
    L.marker([madrid.lat, madrid.lon])
        .addTo(map)
        .bindPopup(`No se detectaron lugares diarios validos para "${escapeHtml(title)}".`)
        .openPopup();
    if (statusElement) {
        statusElement.textContent = "No se detectaron lugares validos con el formato Dia X: Lugar.";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const mapNode = document.getElementById("mapaViajeDetalle");
    const statusElement = document.getElementById("viajeMapaEstado");
    if (!mapNode || typeof L === "undefined") {
        return;
    }

    const detalle = window.viajeDetalle || {};
    const title = detalle.nombre || "Viaje";
    const description = detalle.descripcion || "";

    const map = L.map("mapaViajeDetalle", {
        center: [40.4168, -3.7038],
        zoom: 5,
        scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
    }).addTo(map);

    let places = extractPlacesFromDayHeaders(description);
    if (places.length === 0) {
        places = extractPlacesFromBody(description);
    }
    if (places.length === 0) {
        const fallback = extractFallbackPlaceFromTitle(title);
        if (fallback) {
            places = [fallback];
        }
    }

    if (places.length === 0) {
        addFallbackMarker(map, title, statusElement);
        return;
    }

    const geocoded = await geocodePlaces(places);
    if (geocoded.length === 0) {
        addFallbackMarker(map, title, statusElement);
        return;
    }

    const filtered = filterByDistanceCluster(geocoded, MAX_MARKER_DISTANCE_KM);
    if (filtered.length === 0) {
        addFallbackMarker(map, title, statusElement);
        return;
    }

    const points = [];
    filtered.forEach((place) => {
        points.push([place.lat, place.lon]);
        L.marker([place.lat, place.lon])
            .addTo(map)
            .bindPopup(`<strong>${escapeHtml(place.place)}</strong><br>${escapeHtml(place.displayName)}`);
    });

    if (points.length === 1) {
        map.setView(points[0], 8);
    } else {
        map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
    }

    const discarded = geocoded.length - filtered.length;
    if (statusElement) {
        const base = `Lugares detectados: ${filtered.map((p) => p.place).join(", ")}.`;
        statusElement.textContent = discarded > 0
            ? `${base} Se descartaron ${discarded} por estar fuera de ${MAX_MARKER_DISTANCE_KM} km del grupo principal.`
            : base;
    }
});
