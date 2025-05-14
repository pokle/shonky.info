/**
 * Waypoint handling and display
 */
import { map } from './map-init.js';
import { addWaypointToRoute } from './route.js';

// Store waypoints and related data
const waypointMap = new Map(); // To store waypoints by name
const labelMarkers = new Map(); // Map of name to label marker
let elliottMarker = null; // Reference to the ELLIOT marker
let elliotCircle = null; // 5km radius circle around ELLIOT

/**
 * Load waypoints from KML file
 * @param {string} kmlFilePath - Path to the KML file to load
 * @returns {Promise} - Promise that resolves when waypoints are loaded
 */
function loadWaypoints(kmlFilePath) {
    return fetch(kmlFilePath)
        .then((response) => response.text())
        .then((kmlData) => {
            // Parse the KML data
            const parser = new DOMParser();
            const kml = parser.parseFromString(
                kmlData,
                "text/xml"
            );

            // Extract waypoints from the KML file
            const placemarks = kml.getElementsByTagName("Placemark");
            processPlacemarks(placemarks);
            
            // A brief timeout to ensure map renders properly after showing
            setTimeout(function() {
                map.invalidateSize();
            }, 100);
        })
        .catch((error) => {
            console.error("Error loading KML:", error);
        });
}

/**
 * Process placemarks from KML file and add them to the map
 * @param {NodeList} placemarks - The placemarks from the KML file
 */
function processPlacemarks(placemarks) {
    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        
        // Get the name from name tag
        const name = placemark.getElementsByTagName("name")[0]?.textContent || "Unnamed";
        const desc = placemark.getElementsByTagName("description")[0]?.textContent || "";
        const point = placemark.getElementsByTagName("Point")[0];

        if (point) {
            const coords = point.getElementsByTagName("coordinates")[0]?.textContent || "";
            if (coords) {
                const [longitude, latitude, altitude] = coords.trim().split(",").map(parseFloat);
                
                // Format altitude display if available
                const altDisplay = altitude && altitude > 0 ? ` (${Math.round(altitude)}m)` : '';
                
                // Create label icon that auto-sizes to content
                const labelIcon = L.divIcon({
                    className: 'waypoint-label',
                    html: `${name}${altDisplay}`,
                    iconSize: null, // Auto-size based on content
                    iconAnchor: [0, 10] // Anchored at the bottom-left of the text
                });

                // Create simple dot marker instead of X
                const dotMarker = L.circleMarker([latitude, longitude], {
                    radius: 4,
                    fillColor: '#fff',
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1
                })
                .addTo(map)
                .bindPopup(`<b>${name}</b>${altDisplay}<br>${desc}`);
                
                // Store waypoint data for route planning
                waypointMap.set(name, {
                    marker: dotMarker,
                    lat: latitude,
                    lon: longitude,
                    name: name,
                    desc: desc,
                    altitude: altitude
                });
                
                // Add click event for route planning
                dotMarker.on('click', function() {
                    addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                });
                
                // Add mouse events to change cursor when hovering over the most recently added point
                dotMarker.on('mouseover', function() {
                    if (window.routePoints.length > 0 && window.routePoints[window.routePoints.length - 1].name === name) {
                        // Last point in route - use not-allowed cursor to indicate removal
                        L.DomUtil.addClass(dotMarker._path, 'last-point-hover');
                        dotMarker._path.style.cursor = 'not-allowed';
                    }
                });
                
                dotMarker.on('mouseout', function() {
                    L.DomUtil.removeClass(dotMarker._path, 'last-point-hover');
                    dotMarker._path.style.cursor = '';
                });
                
                // Special handling for ELLIOT marker (competition start point)
                if (name === "ELLIOT") {
                    handleElliotMarker(dotMarker, latitude, longitude);
                }
                
                // Create clickable label with higher z-index to appear above other markers
                const labelMarker = L.marker([latitude, longitude], {
                    icon: labelIcon,
                    keyboard: false,
                    zIndexOffset: 100 // Higher than default (0)
                }).addTo(map);
                
                // Store reference to the label marker
                labelMarkers.set(name, {
                    marker: labelMarker,
                    icon: labelIcon,
                    active: false
                });
                
                // Add click event to the label for route planning
                labelMarker.on('click', function() {
                    addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                });
                
                // Add mouse events to set cursor on label hover
                labelMarker.on('mouseover', function() {
                    if (window.routePoints.length > 0 && window.routePoints[window.routePoints.length - 1].name === name) {
                        // Use CSS to show not-allowed cursor via waypoint-label-last class in updateLabelStyles
                    }
                });
            }
        }
    }
}

/**
 * Special handling for the ELLIOT marker (competition start point)
 * @param {L.CircleMarker} marker - The marker for ELLIOT
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 */
function handleElliotMarker(marker, latitude, longitude) {
    elliottMarker = marker;
    
    // Add a 5km radius circle around ELLIOT (competition start circle)
    elliotCircle = L.circle([latitude, longitude], {
        radius: 5000, // 5km in meters
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5,5'
    }).addTo(map);
    
    // Add a radius label
    const radiusLabelIcon = L.divIcon({
        className: 'waypoint-label-static',
        html: '5km radius (competition start)',
        iconSize: null, // Auto-size based on content
        iconAnchor: [0, 10] // Anchored at the bottom-left of the text
    });
    
    // Position label slightly north of the circle edge
    const labelLat = latitude + (5 / 111.32); // ~5km north
    L.marker([labelLat, longitude], {
        icon: radiusLabelIcon,
        interactive: false,
        keyboard: false
    }).addTo(map);
}

/**
 * Update label styles based on active route points
 * @param {Array} routePoints - Array of route points
 * @param {boolean} isRoutingStarted - Whether routing has started
 */
function updateLabelStyles(routePoints, isRoutingStarted) {
    // If no route is active, reset all labels to normal
    if (!isRoutingStarted || routePoints.length === 0) {
        labelMarkers.forEach((data, name) => {
            // Create a new icon with the original class
            const newIcon = L.divIcon({
                className: 'waypoint-label',
                html: data.icon.options.html,
                iconSize: data.icon.options.iconSize,
                iconAnchor: data.icon.options.iconAnchor
            });
            data.marker.setIcon(newIcon);
            data.active = false;
        });
        return;
    }
    
    // Get active waypoint names
    const activeWaypoints = routePoints.map(point => point.name);
    
    // Get the last point in the route
    const lastPointName = routePoints[routePoints.length - 1].name;
    
    // Update all labels
    labelMarkers.forEach((data, name) => {
        let className;
        if (name === lastPointName) {
            // Last point in route - special styling to indicate it can be removed
            className = 'waypoint-label-last';
            data.active = true;
            data.marker.setZIndexOffset(1000); // Move to front
        } else if (activeWaypoints.includes(name)) {
            // Active waypoint
            className = 'waypoint-label-active';
            data.active = true;
            data.marker.setZIndexOffset(1000); // Move to front
        } else {
            // Dim non-active waypoints
            className = 'waypoint-label-dimmed';
            data.active = false;
            data.marker.setZIndexOffset(100);
        }
        
        // Create a new icon with the updated class
        const newIcon = L.divIcon({
            className: className,
            html: data.icon.options.html,
            iconSize: data.icon.options.iconSize,
            iconAnchor: data.icon.options.iconAnchor
        });
        data.marker.setIcon(newIcon);
    });
}

/**
 * Make sure the ELLIOT circle is visible
 */
function ensureElliotCircleVisible() {
    if (elliotCircle && !map.hasLayer(elliotCircle)) {
        elliotCircle.addTo(map);
    }
}

export { 
    loadWaypoints, 
    waypointMap, 
    updateLabelStyles, 
    ensureElliotCircleVisible
};