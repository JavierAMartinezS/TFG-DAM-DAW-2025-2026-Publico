document.addEventListener("DOMContentLoaded", () => {
    const mapa = L.map('mapaInicioCard', {
        center: [40.4168, -3.7038], 
        zoom: 18,
        scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapa);

    L.marker([40.4168, -3.7038]).addTo(mapa)
        .bindPopup('Así se representarán tus destinos en el mapa')
        .openPopup();
});
