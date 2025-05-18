/**
 * Route planning functionality
 */
import { map } from './map-init.js';
import { waypointMap, updateLabelStyles, ensureElliotCircleVisible } from './waypoints.js';
import { isImmediateReturn } from './route-utils.js';

// Route planning variables
let routePoints = []; // To store selected waypoints for the route
let routePolylines = []; // To store the polylines between waypoints
let routeDistanceLabels = []; // To store distance labels
let segmentDistances = []; // To store distance of each segment
let segmentKeys = []; // To store segment key (prev->curr) for grouping indices
let segmentIsReturnFlags = []; // To store return-path flag for each segment
let totalDistance = 0; // Total route distance
let isRoutingStarted = false;

// Make routePoints accessible globally for other modules
window.routePoints = routePoints;

/**
 * Calculate distance between two points in kilometers
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

/**
 * Calculate an offset path for a line segment to avoid overlapping with existing path
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point 
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {boolean} isBackPath - Whether this is a return path that might overlap
 * @returns {Array} Array of [lat, lon] pairs for the offset path
 */
function calculateOffsetPath(lat1, lon1, lat2, lon2, isBackPath) {
    // If not a back path, just return the original points
    if (!isBackPath) {
        return [[lat1, lon1], [lat2, lon2]];
    }
    
    // Calculate the angle of the line
    const dx = lon2 - lon1;
    const dy = lat2 - lat1;
    const angle = Math.atan2(dy, dx);
    
    // Perpendicular angle (for offset)
    const perpAngle = angle + Math.PI / 2;
    
    // Calculate offset (about 50-100 meters depending on scale)
    // Convert to degrees - approximately 0.001 degree is about 100m
    const offsetDistance = 0.0005; // ~50 meters
    
    // Calculate offset coordinates
    const offsetLat = Math.sin(perpAngle) * offsetDistance;
    const offsetLon = Math.cos(perpAngle) * offsetDistance;
    
    // Create offset path (add offset to both points)
    return [
        [lat1 + offsetLat, lon1 + offsetLon],
        [lat2 + offsetLat, lon2 + offsetLon]
    ];
}

/**
 * Create distance label
 * @param {number} lat - Latitude for label placement
 * @param {number} lon - Longitude for label placement
 * @param {number} origLat - Original latitude (for reference)
 * @param {number} origLon - Original longitude (for reference)
 * @param {number} distance - Distance in kilometers
 * @param {boolean} isReturnPath - Whether this is a return path
 * @returns {L.Marker} The created marker
 */
function createDistanceLabel(lat, lon, origLat, origLon, distance, isReturnPath = false) {
    // Create label icon with appropriate color
    const distText = distance.toFixed(1) + ' km';
    const labelClass = isReturnPath ? 'distance-label-return' : 'distance-label';
    
    const distanceIcon = L.divIcon({
        className: labelClass,
        html: `<div style="width:100%;text-align:center;">${distText}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12]
    });
    
    // Create and return the marker with high z-index to stay on top
    return L.marker([lat, lon], {
        icon: distanceIcon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000 // Ensure distance labels stay on top
    }).addTo(map);
}

/**
 * Update distance label markers to prefix with segment indices for repeated segments.
 */
function updateDistanceLabels() {
    const keyIndicesMap = {};
    segmentKeys.forEach((key, idx) => {
        if (!keyIndicesMap[key]) keyIndicesMap[key] = [];
        keyIndicesMap[key].push(idx + 1);
    });
    routeDistanceLabels.forEach((marker, j) => {
        marker.setZIndexOffset(1000 + j);
        const key = segmentKeys[j];
        const indices = keyIndicesMap[key];
        const distance = segmentDistances[j];
        const labelClass = segmentIsReturnFlags[j] ? 'distance-label-return' : 'distance-label';
        const text = indices.join(', ') + ': ' + distance.toFixed(1) + ' km';
        const icon = L.divIcon({
            className: labelClass,
            html: `<div style="width:100%;text-align:center;">${text}</div>`,
            iconSize: [80, 24],
            iconAnchor: [40, 12]
        });
        marker.setIcon(icon);
    });
}

/**
 * Add a waypoint to the route
 * @param {L.CircleMarker} marker - The marker to add
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} name - Waypoint name
 * @param {number} altitude - Altitude
 * @returns {boolean} True if waypoint was added, false if it was a duplicate
 */
function addWaypointToRoute(marker, lat, lon, name, altitude) {
    // Check if this waypoint is the same as the last one in the route
    if (routePoints.length > 0) {
        const lastPoint = routePoints[routePoints.length - 1];
        if (lastPoint.name === name && lastPoint.lat === lat && lastPoint.lon === lon) {
            // This is a duplicate of the last point - don't add it
            console.log(`Prevented adding duplicate waypoint ${name}`);
            
            // Flash the marker to provide visual feedback
            const originalFillColor = marker.options.fillColor;
            const originalRadius = marker.options.radius;
            
            // Flash effect by changing marker style briefly
            marker.setStyle({
                radius: 8,
                fillColor: '#ff0000',
                fillOpacity: 0.8
            });
            
            // Reset after a short delay
            setTimeout(() => {
                marker.setStyle({
                    radius: originalRadius || 6,
                    fillColor: originalFillColor || '#ff4500',
                    fillOpacity: 1
                });
            }, 300);
            
            return false;
        }
    }
    
    // If this is the first point or routing hasn't started yet
    if (routePoints.length === 0 || !isRoutingStarted) {
        // Start the route
        isRoutingStarted = true;
        document.getElementById('route-control').style.display = 'block';
        
        // Show the undo button
        if (window.undoButtonControl) {
            window.undoButtonControl.style.display = 'block';
        }
        
        // Highlight the marker
        marker.setStyle({
            radius: 6,
            fillColor: '#ff4500',
            color: '#000'
        });
        
        // Add the point to our route
        routePoints.push({
            marker: marker,
            lat: lat,
            lon: lon,
            name: name,
            altitude: altitude
        });
        
        // Update the route start display
        document.getElementById('route-start').textContent = name;
        
        // Update label styles - first dim all labels
        updateLabelStyles(routePoints, isRoutingStarted);
        
        // Initialize the route points list
        updateRoutePointsList();
        
        return true;
    }
    
    // Get the previous point
    const prevPoint = routePoints[routePoints.length - 1];
    
    // Calculate distance
    const segmentDistance = calculateDistance(
        prevPoint.lat, prevPoint.lon, lat, lon
    );
    
    // Store the segment distance
    segmentDistances.push(segmentDistance);
    
    // Update total distance
    totalDistance += segmentDistance;
    document.getElementById('total-distance').textContent = totalDistance.toFixed(1) + ' km';
    
    const isReturnPath = isImmediateReturn(routePoints, { lat, lon });
    const segmentKey = `${prevPoint.name}->${name}`;
    segmentKeys.push(segmentKey);
    segmentIsReturnFlags.push(isReturnPath);
    
    // Create a line from the previous point to this one, with offset if needed
    const pathPoints = calculateOffsetPath(
        prevPoint.lat, prevPoint.lon, 
        lat, lon, 
        isReturnPath
    );
    
    // Different colors for outbound vs return paths
    const pathColor = isReturnPath ? '#2E86C1' : '#ff4500';
    
    const polyline = L.polyline(pathPoints, {
        color: pathColor,
        weight: 3,
        opacity: 0.8,
        // Add a dash pattern for return paths
        dashArray: isReturnPath ? '5, 8' : null
    }).addTo(map);
    
    // Add distance label at midpoint of the (possibly offset) path
    const midLat = (pathPoints[0][0] + pathPoints[1][0]) / 2;
    const midLon = (pathPoints[0][1] + pathPoints[1][1]) / 2;
    
    // For distance label placement, use the midpoint of the potentially offset path
    const distanceLabel = createDistanceLabel(
        midLat, midLon, 
        (prevPoint.lat + lat) / 2, (prevPoint.lon + lon) / 2, 
        segmentDistance, isReturnPath
    );
    
    // Highlight the marker
    marker.setStyle({
        radius: 6,
        fillColor: '#ff4500',
        color: '#000'
    });
    
    // Store the new point, polyline, and label
    routePoints.push({
        marker: marker,
        lat: lat,
        lon: lon,
        name: name,
        altitude: altitude
    });
    routePolylines.push(polyline);
    routeDistanceLabels.push(distanceLabel);
    updateDistanceLabels();
    
    // Update label styles to highlight active waypoints and dim others
    updateLabelStyles(routePoints, isRoutingStarted);
    
    // Update the route points list in the UI
    updateRoutePointsList();
    
    // Update URL with the new route
    updateRouteInUrl();
    
    return true;
}

/**
 * Update the route points list in the UI
 */
function updateRoutePointsList() {
    const routeListElement = document.getElementById('route-points-list');
    routeListElement.innerHTML = '';
    
    if (routePoints.length === 0) {
        routeListElement.innerHTML = '<div class="route-point-item">No points in route yet</div>';
        return;
    }
    
    // Add each point to the list
    routePoints.forEach((point, index) => {
        const pointElement = document.createElement('div');
        pointElement.className = 'route-point-item';
        
        const infoElement = document.createElement('div');
        infoElement.className = 'route-point-info';
        
        const nameElement = document.createElement('span');
        nameElement.className = 'route-point-name';
        nameElement.textContent = point.name;
        
        infoElement.appendChild(nameElement);
        
        // Add distance info if not the first point
        if (index > 0) {
            const distElement = document.createElement('div');
            distElement.className = 'route-point-distance';
            distElement.textContent = `+${segmentDistances[index-1].toFixed(1)} km`;
            infoElement.appendChild(distElement);
        }
        
        pointElement.appendChild(infoElement);
        
        // Add remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'route-point-remove';
        removeButton.innerHTML = '&times;';  // HTML entity for multiplication sign/X
        removeButton.setAttribute('title', 'Remove point');
        removeButton.setAttribute('data-index', index);
        removeButton.addEventListener('click', function() {
            removeRoutePoint(index);
        });
        
        pointElement.appendChild(removeButton);
        routeListElement.appendChild(pointElement);
    });
}

/**
 * Remove a point from the route
 * @param {number} index - Index of the point to remove
 */
function removeRoutePoint(index) {
    // Ignore if route is empty
    if (routePoints.length === 0) return;
    
    // Can't remove first point if it's the only one
    if (routePoints.length === 1) {
        resetRoute();
        return;
    }
    
    // Get the point to remove
    const pointToRemove = routePoints[index];
    
    // Reset that point's marker style
    pointToRemove.marker.setStyle({
        radius: 4,
        fillColor: '#fff',
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 1
    });
    
    // Remove the point from the route
    routePoints.splice(index, 1);
    
    // If we're removing the first point, we need special handling
    if (index === 0) {
        // Update the starting point display
        document.getElementById('route-start').textContent = routePoints[0].name;
    }
    
    // Remove all polylines and distance labels from map and rebuild
    routePolylines.forEach(polyline => map.removeLayer(polyline));
    routeDistanceLabels.forEach(label => map.removeLayer(label));
    
    // Clear arrays
    routePolylines = [];
    routeDistanceLabels = [];
    segmentDistances = [];
    segmentKeys = [];
    segmentIsReturnFlags = [];
    
    
    // Reset total distance and recalculate
    totalDistance = 0;
    
    // Rebuild the route connections
    for (let i = 1; i < routePoints.length; i++) {
        const prevPoint = routePoints[i-1];
        const currPoint = routePoints[i];
        
        // Calculate distance between these points
        const segmentDistance = calculateDistance(
            prevPoint.lat, prevPoint.lon, currPoint.lat, currPoint.lon
        );
        
        // Store the segment distance
        segmentDistances.push(segmentDistance);
        
        // Add to total distance
        totalDistance += segmentDistance;
        
        const isReturnPath = isImmediateReturn(routePoints, currPoint, i);
        const segmentKey = `${prevPoint.name}->${currPoint.name}`;
        segmentIsReturnFlags.push(isReturnPath);
        segmentKeys.push(segmentKey);
        
        // Calculate path points with offset if needed
        const pathPoints = calculateOffsetPath(
            prevPoint.lat, prevPoint.lon, 
            currPoint.lat, currPoint.lon, 
            isReturnPath
        );
        
        // Different colors for outbound vs return paths
        const pathColor = isReturnPath ? '#2E86C1' : '#ff4500';
        
        // Create the polyline with appropriate styling
        const polyline = L.polyline(pathPoints, {
            color: pathColor,
            weight: 3,
            opacity: 0.8,
            // Add a dash pattern for return paths
            dashArray: isReturnPath ? '5, 8' : null
        }).addTo(map);
        
        // Calculate midpoint for label placement
        const midLat = (pathPoints[0][0] + pathPoints[1][0]) / 2;
        const midLon = (pathPoints[0][1] + pathPoints[1][1]) / 2;
        
        // Add distance label
        const distLabel = createDistanceLabel(
            midLat, midLon,
            (prevPoint.lat + currPoint.lat) / 2, (prevPoint.lon + currPoint.lon) / 2,
            segmentDistance, isReturnPath
        );
        
        // Save to arrays
        routePolylines.push(polyline);
        routeDistanceLabels.push(distLabel);
    }
    
    updateDistanceLabels();
    // Update total distance display
    document.getElementById('total-distance').textContent = totalDistance.toFixed(1) + ' km';
    
    // Update label styles
    updateLabelStyles(routePoints, isRoutingStarted);
    
    // Update the route points list in the UI
    updateRoutePointsList();
    
    // Update URL with the new route
    updateRouteInUrl();
}

/**
 * Convert route to URL hash
 */
function updateRouteInUrl() {
    if (routePoints.length === 0) {
        // Clear route parameter if no points
        if (window.location.hash.includes('route=')) {
            // Remove just the route parameter, preserve other hash parameters if any
            let hashParts = window.location.hash.slice(1).split('&');
            hashParts = hashParts.filter(part => !part.startsWith('route='));
            window.location.hash = hashParts.length > 0 ? hashParts.join('&') : '';
        }
        
        // Hide share container or clear the field
        const shareUrlField = document.getElementById('share-url');
        if (shareUrlField) {
            shareUrlField.value = '';
        }
        return;
    }
    
    // Get waypoint names from the route
    const waypointNames = routePoints.map(point => encodeURIComponent(point.name));
    
    // Create route parameter
    const routeParam = `route=${waypointNames.join(',')}`;
    
    // Get existing hash parts excluding route
    let hashParts = window.location.hash.slice(1).split('&').filter(part => !part.startsWith('route='));
    
    // Add route parameter
    hashParts.push(routeParam);
    
    // Update URL without triggering page reload
    const newHash = hashParts.join('&');
    window.location.hash = newHash;
    
    // Update the share URL field
    const shareUrlField = document.getElementById('share-url');
    if (shareUrlField) {
        // Create a full absolute URL for sharing
        const baseUrl = window.location.href.split('#')[0];
        shareUrlField.value = `${baseUrl}#${newHash}`;
    }
}

/**
 * Load route from URL hash
 * @returns {boolean} True if route was loaded, false otherwise
 */
function loadRouteFromUrl() {
    if (!window.location.hash) return false;
    
    const hashParts = window.location.hash.slice(1).split('&');
    const routePart = hashParts.find(part => part.startsWith('route='));
    
    if (!routePart) return false;
    
    // Extract waypoint names
    const routeParam = routePart.replace('route=', '');
    if (!routeParam) return false;
    
    const waypointNames = routeParam.split(',').map(name => decodeURIComponent(name));
    
    // Reset any existing route first
    silentResetRoute();
    
    // Load each waypoint in order
    let loadedAnyPoint = false;
    waypointNames.forEach(name => {
        const waypointData = waypointMap.get(name);
        if (waypointData) {
            addWaypointToRoute(
                waypointData.marker, 
                waypointData.lat, 
                waypointData.lon, 
                waypointData.name, 
                waypointData.altitude
            );
            loadedAnyPoint = true;
        }
    });
    
    return loadedAnyPoint;
}

/**
 * Silent reset without updating URL (to prevent loops)
 */
function silentResetRoute() {
    // Remove polylines and distance labels from map
    routePolylines.forEach(polyline => map.removeLayer(polyline));
    routeDistanceLabels.forEach(label => map.removeLayer(label));
    
    // Reset marker styles
    routePoints.forEach(point => {
        point.marker.setStyle({
            radius: 4,
            fillColor: '#fff',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 1
        });
    });
    
    // Clear arrays
    routePoints = [];
    routePolylines = [];
    routeDistanceLabels = [];
    segmentDistances = [];
    segmentKeys = [];
    segmentIsReturnFlags = [];
    
    // Reset total distance
    totalDistance = 0;
    document.getElementById('total-distance').textContent = '0.0 km';
    document.getElementById('route-start').textContent = '';
    
    // Reset routing state
    isRoutingStarted = false;
    document.getElementById('route-control').style.display = 'none';
    
    // Hide the undo button
    if (window.undoButtonControl) {
        window.undoButtonControl.style.display = 'none';
    }
    
    // Reset all label styles
    updateLabelStyles(routePoints, isRoutingStarted);
    
    // Update the route points list
    updateRoutePointsList();
    
    // Make sure ELLIOT circle is still visible
    ensureElliotCircleVisible();
}

/**
 * Reset the route and update URL
 */
function resetRoute() {
    silentResetRoute();
    // Also update URL to remove route
    updateRouteInUrl();
}

/**
 * Initialize copy URL button functionality
 */
function initCopyUrlButton() {
    const copyUrlButton = document.getElementById('copy-url');
    if (copyUrlButton) {
        copyUrlButton.addEventListener('click', function() {
            const shareUrlField = document.getElementById('share-url');
            if (shareUrlField && shareUrlField.value) {
                // Select the text
                shareUrlField.select();
                shareUrlField.setSelectionRange(0, 99999); // For mobile devices
                
                // Copy to clipboard
                navigator.clipboard.writeText(shareUrlField.value)
                    .then(() => {
                        // Provide visual feedback that copy was successful
                        const originalText = copyUrlButton.textContent;
                        copyUrlButton.textContent = 'Copied!';
                        setTimeout(() => {
                            copyUrlButton.textContent = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy URL: ', err);
                        // Fallback for older browsers
                        try {
                            document.execCommand('copy');
                            const originalText = copyUrlButton.textContent;
                            copyUrlButton.textContent = 'Copied!';
                            setTimeout(() => {
                                copyUrlButton.textContent = originalText;
                            }, 2000);
                        } catch (e) {
                            console.error('Fallback copy failed: ', e);
                        }
                    });
            }
        });
    }
}

/**
 * Initialize route functionality
 */
function initRouteHandling() {
    // Set up reset button event listener
    document.getElementById('reset-route').addEventListener('click', resetRoute);
    
    // Create a custom Leaflet control for the undo button
    const UndoControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function(map) {
            // Create container 
            const container = L.DomUtil.create('div', 'leaflet-control-undo leaflet-bar');
            
            // Create button with the same styling as zoom controls
            const button = L.DomUtil.create('a', 'undo-button', container);
            
            button.innerHTML = '↩️';
            button.href = '#';
            button.title = 'Undo last waypoint';
            
            // Force exact matching dimensions with zoom controls
            button.style.width = '30px';
            button.style.height = '30px';
            button.style.lineHeight = '30px';
            button.style.fontSize = '16px';
            button.style.textAlign = 'center';
            button.style.fontWeight = 'bold';
            button.style.display = 'block';
            button.style.cursor = 'pointer';
            
            // Add the click event listener
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                if (routePoints.length > 0) {
                    removeRoutePoint(routePoints.length - 1);
                }
            });
            
            // Prevent click events from propagating to the map
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });
    
    // Add the undo control to the map
    const undoControl = new UndoControl();
    map.addControl(undoControl);
    
    // Get the undo button and hide it initially (will show when route exists)
    const undoButton = document.querySelector('.leaflet-control-undo');
    if (undoButton) {
        undoButton.style.display = 'none';
        
        // Store reference to update visibility
        window.undoButtonControl = undoButton;
    }
    
    // Initialize copy URL button
    initCopyUrlButton();
}

// Export the route variables and functions
export { 
    routePoints,
    initRouteHandling,
    loadRouteFromUrl,
    addWaypointToRoute,
    removeRoutePoint
};