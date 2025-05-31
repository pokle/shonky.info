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

    // Add a simple map type control
    addMapTypeControl(satelliteLayer, streetLayer);

    return map;
}

/**
 * Add a map type control to switch between satellite and street views
 * @param {L.TileLayer} satelliteLayer - The satellite map layer
 * @param {L.TileLayer} streetLayer - The street map layer
 */
function addMapTypeControl(satelliteLayer, streetLayer) {
    const mapTypeControl = L.control({position: 'topright'});

    mapTypeControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-type-control');
        div.innerHTML = 'Switch to Street Map';
        div.onclick = function() {
            if (map.hasLayer(satelliteLayer)) {
                map.removeLayer(satelliteLayer);
                map.addLayer(streetLayer);
                div.innerHTML = 'Switch to Satellite Map';
            } else {
                map.removeLayer(streetLayer);
                map.addLayer(satelliteLayer);
                div.innerHTML = 'Switch to Street Map';
            }
        };
        return div;
    };

    mapTypeControl.addTo(map);
}

// Export the functions and map reference
export { map, initializeMap };
