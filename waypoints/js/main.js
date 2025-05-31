/**
 * Main application script that orchestrates the waypoints map functionality
 */
import { initializeMap } from './map-init.js';
import { loadWaypoints } from './waypoints.js';
import { initRouteHandling, loadRouteFromUrl } from './route.js';

/**
 * Initialize the application
 */
function initApp() {
    // Initialize the map
    initializeMap();

    // Initialize routing functionality
    initRouteHandling();
    
    // Load waypoints from KML file
    loadWaypoints("Corryong 2021 waypoints.kml")
        .then(() => {
            // Try to load route from URL hash if present
            loadRouteFromUrl();
        })
        .catch((error) => {
            console.error("Error initializing application:", error);
        });
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", initApp);