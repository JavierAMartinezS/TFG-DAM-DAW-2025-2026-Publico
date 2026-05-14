const chat = document.getElementById("chatWindow");
let tipoViaje = null;
let numViajeros = null;
let fechas = null;
let presupuesto = null;

function addBotMessage(msg, html = "") {
    const div = document.createElement("div");
    div.classList.add("bot-bubble");
    div.innerHTML = msg + (html !== "" ? "<br>" + html : "");
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function addUserMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("user-bubble");
    div.textContent = msg;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function goToIA() {
    window.location.href = "/conversacion-ia";
}

function formatDate(input) {
    const date = new Date(input);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function startChat() {
    askTipoViaje();
}

function askTipoViaje() {
    addBotMessage("👋 ¡Hola! Vamos a preparar tu viaje.<br>¿Qué tipo de viaje buscas?");
    const select = `
        <select id="tipoViaje">
            <option value="">Selecciona...</option>
            <option>Aventura</option>
            <option>Relax</option>
            <option>Cultural</option>
            <option>Romántico</option>
            <option>Playa</option>
            <option>Ciudad</option>
            <option>Familiar</option>
        </select>
        <button onclick="saveTipoViaje()">Continuar</button>
    `;
    addBotMessage("", select);
}

function saveTipoViaje() {
    const val = document.getElementById("tipoViaje").value;
    if (!val) return;
    tipoViaje = val;
    addUserMessage(val);
    askNumViajeros();
}

function askNumViajeros() {
    addBotMessage("👥 Perfecto, ¿cuántos viajeros sois?");
    const html = `
        <input type="number" id="numViajeros" min="1" max="20" placeholder="Ej: 2">
        <button onclick="saveNumViajeros()">Continuar</button>
    `;
    addBotMessage("", html);
}

function saveNumViajeros() {
    const val = document.getElementById("numViajeros").value;
    if (!val) return;
    numViajeros = val;
    addUserMessage(val);
    askFechas();
}

function askFechas() {
    addBotMessage("📅 ¿Tienes fechas exactas o una duración aproximada?");
    const html = `
        <select id="modoFechas">
            <option value="">Elegir...</option>
            <option value="exactas">Fechas exactas</option>
            <option value="duracion">Duración estimada</option>
        </select>
        <div id="fechasCampos"></div>
        <button onclick="saveFechas()">Continuar</button>
    `;
    addBotMessage("", html);
    document.getElementById("modoFechas").addEventListener("change", (e) => {
        const box = document.getElementById("fechasCampos");
        if (e.target.value === "exactas") {
            box.innerHTML = `
                <label>Fecha inicio</label>
                <input type="date" id="fechaInicio">
                <label>Fecha fin</label>
                <input type="date" id="fechaFin">
            `;
        } else if (e.target.value === "duracion") {
            box.innerHTML = `
                <label>Duración (días)</label>
                <input type="number" id="duracionDias" min="1" placeholder="Ej: 7">
            `;
        } else {
            box.innerHTML = "";
        }
    });
}

function saveFechas() {
    const modo = document.getElementById("modoFechas").value;
    if (!modo) return;
    if (modo === "exactas") {
        const ini = document.getElementById("fechaInicio").value;
        const fin = document.getElementById("fechaFin").value;
        if (!ini || !fin) return;
        fechas = `Del ${formatDate(ini)} al ${formatDate(fin)}`;
    } else {
        const dur = document.getElementById("duracionDias").value;
        if (!dur) return;
        fechas = `${dur} días`;
    }
    addUserMessage(fechas);
    askPresupuesto();
}

function askPresupuesto() {
    addBotMessage("💰 ¿Cuál es vuestro presupuesto aproximado?");
    const html = `
        <input type="number" id="presupuesto" placeholder="Ej: 800">
        <button onclick="savePresupuesto()">Finalizar</button>
    `;
    addBotMessage("", html);
}

function savePresupuesto() {
    const val = document.getElementById("presupuesto").value;
    if (!val) return;
    presupuesto = val;
    addUserMessage(val);
    endChat();
}

function endChat() {
    addBotMessage("🎉 ¡Genial! Ya tengo toda la info básica.<br>Puedes continuar para crear tu viaje con IA.");
    const btn = document.createElement("button");
    btn.classList.add("full-action-button");
    btn.textContent = "Continuar con IA";
    btn.onclick = () => {
        let fechaInicio = null;
        let fechaFin = null;
        let duracionDias = null;

        const modoFechas = document.getElementById("modoFechas").value;

        if (modoFechas === "exactas") {
            fechaInicio = document.getElementById("fechaInicio").value;
            fechaFin = document.getElementById("fechaFin").value;
        } else if (modoFechas === "duracion") {
            duracionDias = parseInt(document.getElementById("duracionDias").value);
            fechaInicio = new Date();
            fechaFin = new Date();
            fechaFin.setDate(fechaInicio.getDate() + duracionDias);
            fechaInicio = fechaInicio.toISOString().split('T')[0];
            fechaFin = fechaFin.toISOString().split('T')[0];
        }

        const data = {
            tipoViaje,
            numViajeros,
            fechas,
            presupuesto,
            fechaInicioExacta: fechaInicio,
            fechaFinExacta: fechaFin,
            duracion: duracionDias
        };

        fetch('/guardar-datos-viaje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(async (res) => {
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) {
                addBotMessage("No he podido preparar el viaje. Intentalo de nuevo.");
                return;
            }
            goToIA();
        })
        .catch(() => addBotMessage("No he podido conectar con el servidor."));
    };

    chat.appendChild(btn);
    chat.scrollTop = chat.scrollHeight;
}

async function renderMisViajes() {
    const container = document.getElementById("mis-viajes");
    container.innerHTML = "";
    const res = await fetch("/api/viajes/listar");
    if (!res.ok) return;
    const viajes = await res.json();

    if (!viajes.length) {
        container.innerHTML = `
            <div class="mis-viajes-empty-state">
                <h4>Todavia no tienes viajes guardados</h4>
                <p>Crea un viaje con el asistente IA y aqui apareceran tus planes listos para revisar.</p>
            </div>
        `;
        return;
    }

    viajes.forEach(v => {
        const div = document.createElement("div");
        div.className = "mis-viaje-card";

        const cabecera = document.createElement("div");
        cabecera.className = "mis-viaje-card-header";

        const nombre = document.createElement("h5");
        nombre.className = "mis-viaje-title";
        nombre.textContent = v.nombre || "Viaje sin nombre";

        const tipo = document.createElement("span");
        tipo.className = "mis-viaje-type-badge";
        tipo.textContent = v.tipoViaje || "Sin tipo";

        cabecera.appendChild(nombre);
        cabecera.appendChild(tipo);

        const meta = document.createElement("div");
        meta.className = "mis-viaje-meta";

        const fechaInicio = v.fechaInicio ? v.fechaInicio : "Flexible";
        const fechaFin = v.fechaFin ? v.fechaFin : "Flexible";
        const presupuesto = v.presupuestoEstimado !== null && v.presupuestoEstimado !== undefined
            ? `${Number(v.presupuestoEstimado).toLocaleString("es-ES")} EUR`
            : "No definido";

        meta.innerHTML = `
            <span><strong>Fechas:</strong> ${fechaInicio} -> ${fechaFin}</span>
            <span><strong>Presupuesto:</strong> ${presupuesto}</span>
        `;

        const botones = document.createElement("div");
        botones.className = "mis-viaje-actions";

        const ver = document.createElement("button");
        ver.className = "btn btn-primary btn-sm px-3";
        ver.textContent = "Ver detalles";
        ver.onclick = () => {
            window.location.href = `/viajes/${v.id}`;
        };

        const eliminar = document.createElement("button");
        eliminar.className = "btn btn-outline-danger btn-sm px-3";
        eliminar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/></svg>`;
        eliminar.onclick = async () => {
            await fetch(`/api/viajes/eliminar/${v.id}`, { method: "DELETE" });
            renderMisViajes();
        };

        botones.appendChild(ver);
        botones.appendChild(eliminar);
        div.appendChild(cabecera);
        div.appendChild(meta);
        div.appendChild(botones);
        container.appendChild(div);
    });
}

window.addEventListener("DOMContentLoaded", () => {
    startChat();
    renderMisViajes();
});
