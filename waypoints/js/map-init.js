/**
 * Map initialization and base layers
 */

// Global map reference
let map;

/**
 * Initialize the map with base layers and controls
 * @returns {L.Map} The initialized Leaflet map
 */
function initializeMap() {
    // Initialize the map
    map = L.map("map").setView([-36.19, 147.89], 10); // Approximate Corryong coordinates

    // Define base map layers
    const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 18
        }
    );

    const streetLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }
    );

    // Add satellite layer to map by default
    satelliteLayer.addTo(map);

    // Add Leaflet's built-in layer control for switching base maps
    const baseLayers = {
        Satellite: satelliteLayer,
        "Street Map": streetLayer
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

    return map;
}

// Export the functions and map reference
export { map, initializeMap };
