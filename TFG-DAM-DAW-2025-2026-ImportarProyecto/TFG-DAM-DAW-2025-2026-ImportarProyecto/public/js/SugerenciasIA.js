const SECTION_CONFIG = [
    { key: "donde_comer", title: "Donde comer" },
    { key: "cafes", title: "Donde tomar cafe" },
    { key: "alojamiento", title: "Alojamiento recomendado" },
    { key: "transportes", title: "Transportes clave" },
    { key: "movilidad_local", title: "Movilidad en ciudad" },
    { key: "presupuesto", title: "Ahorro y presupuesto" },
    { key: "seguridad", title: "Seguridad" },
    { key: "salud", title: "Salud y bienestar" },
    { key: "equipaje", title: "Equipaje inteligente" },
    { key: "apps_utiles", title: "Apps utiles" },
    { key: "costumbres_locales", title: "Costumbres locales" },
    { key: "planes_noche", title: "Planes de noche" },
    { key: "compras_y_souvenirs", title: "Compras y souvenirs" },
    { key: "trampas_a_evitar", title: "Trampas a evitar" },
    { key: "checklist_antes_de_viajar", title: "Checklist antes de viajar" },
    { key: "plan_b_emergencia", title: "Plan B de emergencia" },
];

function asArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0);
}

function setLoading(card, loading, message) {
    const loadingNode = card.querySelector(".sug-loading");
    const statusNode = card.querySelector(".sug-status");
    const refreshBtn = card.querySelector(".sug-refresh-btn");
    if (loadingNode) {
        loadingNode.classList.toggle("d-none", !loading);
    }
    if (statusNode && message) {
        statusNode.textContent = message;
    }
    if (refreshBtn) {
        refreshBtn.disabled = loading;
    }
}

function setError(card, message) {
    const errorNode = card.querySelector(".sug-error");
    if (!errorNode) {
        return;
    }
    errorNode.classList.remove("d-none");
    errorNode.textContent = message;
}

function clearError(card) {
    const errorNode = card.querySelector(".sug-error");
    if (!errorNode) {
        return;
    }
    errorNode.classList.add("d-none");
    errorNode.textContent = "";
}

function createListSection(title, items) {
    if (!items.length) {
        return null;
    }

    const section = document.createElement("section");
    section.className = "sug-section";

    const h4 = document.createElement("h4");
    h4.textContent = title;
    section.appendChild(h4);

    const ul = document.createElement("ul");
    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
    });
    section.appendChild(ul);
    return section;
}

function createClimaSection(data) {
    const raw = (data && typeof data === "object") ? data : {};
    const sol = asArray(raw.sol);
    const lluvia = asArray(raw.lluvia);
    const calor = asArray(raw.calor);
    const frio = asArray(raw.frio);
    const viento = asArray(raw.viento);

    if (!sol.length && !lluvia.length && !calor.length && !frio.length && !viento.length) {
        return null;
    }

    const section = document.createElement("section");
    section.className = "sug-section";
    const h4 = document.createElement("h4");
    h4.textContent = "Visitas y plan segun clima";
    section.appendChild(h4);

    const grid = document.createElement("div");
    grid.className = "sug-clima-grid";

    const addSub = (label, items) => {
        if (!items.length) {
            return;
        }
        const sub = document.createElement("div");
        sub.className = "sug-clima-sub";
        const h5 = document.createElement("h5");
        h5.textContent = label;
        sub.appendChild(h5);
        const ul = document.createElement("ul");
        items.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
        });
        sub.appendChild(ul);
        grid.appendChild(sub);
    };

    addSub("Si hace sol", sol);
    addSub("Si llueve", lluvia);
    addSub("Si hace calor", calor);
    addSub("Si hace frio", frio);
    addSub("Si hay viento", viento);

    section.appendChild(grid);
    return section;
}

function renderSugerencias(card, sugerencias) {
    const contentNode = card.querySelector(".sug-content");
    if (!contentNode) {
        return;
    }

    contentNode.innerHTML = "";
    contentNode.classList.remove("d-none");

    const resumen = String((sugerencias && sugerencias.resumen) || "").trim();
    if (resumen) {
        const summaryNode = document.createElement("p");
        summaryNode.className = "sug-summary";
        summaryNode.textContent = resumen;
        contentNode.appendChild(summaryNode);
    }

    const grid = document.createElement("div");
    grid.className = "sug-sections-grid";

    const climaSection = createClimaSection((sugerencias && sugerencias.visitas_por_clima) || {});
    if (climaSection) {
        grid.appendChild(climaSection);
    }

    SECTION_CONFIG.forEach((entry) => {
        const items = asArray((sugerencias && sugerencias[entry.key]) || []);
        const node = createListSection(entry.title, items);
        if (node) {
            grid.appendChild(node);
        }
    });

    if (!grid.children.length) {
        const empty = document.createElement("p");
        empty.className = "mb-0 text-white-50";
        empty.textContent = "La IA no devolvio recomendaciones validas para este viaje.";
        contentNode.appendChild(empty);
        return;
    }

    contentNode.appendChild(grid);
    showAssistantPanel(card);
}

function showAssistantPanel(card) {
    const panel = card.querySelector(".sug-assistant-panel");
    if (panel) {
        panel.classList.remove("d-none");
    }
}

function renderNotas(card, notas) {
    const notesNode = card.querySelector(".sug-notes-content");
    if (!notesNode) {
        return;
    }

    const clean = String(notas || "").trim();
    if (!clean) {
        notesNode.textContent = "Sin notas guardadas todavia.";
        return;
    }

    notesNode.innerHTML = "";
    clean.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const item = document.createElement("p");
        item.textContent = line;
        notesNode.appendChild(item);
    });
}

function appendChatMessage(card, text, type = "bot", canSave = false) {
    const windowNode = card.querySelector(".sug-chat-window");
    if (!windowNode) {
        return;
    }

    const bubble = document.createElement("div");
    bubble.className = `sug-chat-bubble ${type}`;
    bubble.textContent = text;

    if (canSave) {
        const saveButton = document.createElement("button");
        saveButton.className = "btn btn-outline-light btn-sm sug-save-note";
        saveButton.type = "button";
        saveButton.textContent = "Guardar como nota";
        saveButton.addEventListener("click", () => guardarNota(card, text));
        bubble.appendChild(saveButton);
    }

    windowNode.appendChild(bubble);
    windowNode.scrollTop = windowNode.scrollHeight;
}

async function guardarNota(card, nota) {
    const viajeId = card.dataset.viajeId;
    try {
        const res = await fetch(`/api/sugerencias-ia/viaje/${viajeId}/nota`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nota }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            throw new Error();
        }
        renderNotas(card, data.notas || "");
        appendChatMessage(card, "Nota guardada en este viaje.", "bot", false);
    } catch (_) {
        appendChatMessage(card, "No se pudo guardar la nota ahora mismo.", "bot", false);
    }
}

async function enviarChat(card) {
    const input = card.querySelector(".sug-chat-input input");
    const button = card.querySelector(".sug-chat-send");
    const viajeId = card.dataset.viajeId;
    const mensaje = input ? input.value.trim() : "";

    if (!mensaje) {
        return;
    }

    appendChatMessage(card, mensaje, "user", false);
    input.value = "";
    if (button) button.disabled = true;

    try {
        const res = await fetch(`/api/sugerencias-ia/viaje/${viajeId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensaje }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            throw new Error();
        }
        appendChatMessage(card, data.respuesta || "No tengo respuesta para eso ahora mismo.", "bot", true);
    } catch (_) {
        appendChatMessage(card, "No he podido responder ahora mismo. Prueba otra vez en unos segundos.", "bot", false);
    } finally {
        if (button) button.disabled = false;
    }
}

async function generarParaCard(card, isAutoLoad = false) {
    const viajeId = card.dataset.viajeId;
    if (!viajeId) {
        return;
    }

    clearError(card);
    setLoading(card, true, isAutoLoad ? "Analizando viaje con IA..." : "Generando sugerencias...");

    try {
        const res = await fetch(`/api/sugerencias-ia/viaje/${viajeId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        const rawText = await res.text();
        let data = null;
        try {
            data = JSON.parse(rawText);
        } catch (_) {
            throw new Error("El servicio de sugerencias no respondio correctamente. Intenta de nuevo en unos segundos.");
        }

        if (!res.ok || !data.ok) {
            throw new Error("No se pudieron generar sugerencias en este momento. Vuelve a intentarlo.");
        }

        renderSugerencias(card, data.sugerencias || {});
        renderNotas(card, data.notas || "");
        const refreshBtn = card.querySelector(".sug-refresh-btn");
        if (refreshBtn) {
            refreshBtn.textContent = "Regenerar sugerencias";
        }
        setLoading(card, false, "Sugerencias IA listas.");
    } catch (error) {
        setLoading(card, false, "Error al generar sugerencias.");
        setError(card, String(error.message || "Error temporal al generar sugerencias. Intenta de nuevo."));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const cards = Array.from(document.querySelectorAll(".sug-trip-card"));
    const iniciales = window.sugerenciasIniciales || {};

    cards.forEach((card) => {
        const initial = iniciales[card.dataset.viajeId];
        if (initial && initial.sugerencias) {
            renderSugerencias(card, initial.sugerencias);
            renderNotas(card, initial.notas || "");
        }

        const btn = card.querySelector(".sug-refresh-btn");
        if (btn) {
            btn.addEventListener("click", () => {
                generarParaCard(card, false);
            });
        }

        const chatButton = card.querySelector(".sug-chat-send");
        const chatInput = card.querySelector(".sug-chat-input input");
        if (chatButton) {
            chatButton.addEventListener("click", () => enviarChat(card));
        }
        if (chatInput) {
            chatInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    enviarChat(card);
                }
            });
        }
    });
});
