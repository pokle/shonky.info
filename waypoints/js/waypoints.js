/**
 * Waypoint handling and display - Version 123
 */
import { map } from './map-init.js';
import { addWaypointToRoute, removeRoutePoint, routePoints } from './route.js';

// Store waypoints and related data
const waypointMap = new Map(); // To store waypoints by name
const labelMarkers = new Map(); // Map of name to label marker
let elliotMarker = null; // Reference to the ELLIOT marker
let elliotCircle = null; // 5km radius circle around ELLIOT

// Long press handling variables
const LONG_PRESS_DURATION = 600; // milliseconds
let pressTimer = null;
let pressStarted = false;
let currentPressedMarker = null;
let originalMarkerStyle = null;
let growthAnimation = null;
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_MOVE_THRESHOLD = 10; // pixels - how far can touch move and still count as a press

// Detect Safari browser
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Flag for context menu workaround
let contextMenuPrevented = false;

/**
 * Load waypoints from KML file
 * @param {string} kmlFilePath - Path to the KML file to load
 * @returns {Promise} - Promise that resolves when waypoints are loaded
 */
function loadWaypoints(kmlFilePath) {
    // Safari-specific workarounds
    if (isSafari || isIOS) {
        console.log("Safari/iOS detected - applying specialized event handling");

        // Prevent the Safari context menu (magnifying glass) from appearing
        document.addEventListener('contextmenu', function(e) {
            if (pressStarted || contextMenuPrevented) {
                // Safely prevent default if the method exists
                if (e && typeof e.preventDefault === 'function') {
                    e.preventDefault();
                }
                contextMenuPrevented = false;
                return false;
            }
        });

        // Disable touch action on the map container for Safari to prevent gesture conflicts
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.style.touchAction = 'none';
        }
    }

    // Set up global document events to handle long press cancellation
    document.addEventListener('mouseup', cancelPressTimer, { passive: false });
    document.addEventListener('touchend', function(e) {
        // Only prevent default if we're in the middle of a press
        if (pressStarted) {
            // Safely prevent default if the method exists
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault();
            }

            // Safari needs this extra safeguard
            if (isSafari || isIOS) {
                contextMenuPrevented = true;
            }
        }
        cancelPressTimer();
    }, { passive: false });

    // Handle touch move - cancel if moved too far
    document.addEventListener('touchmove', function(e) {
        if (pressStarted && e.touches.length > 0) {
            const touch = e.touches[0];
            const moveX = Math.abs(touch.clientX - touchStartX);
            const moveY = Math.abs(touch.clientY - touchStartY);

            // If moved beyond threshold, cancel the press
            if (moveX > TOUCH_MOVE_THRESHOLD || moveY > TOUCH_MOVE_THRESHOLD) {
                cancelPressTimer();
            }
        }
    }, { passive: true });

    // Prevent text selection during long press
    document.addEventListener('selectstart', function(e) {
        if (pressStarted) {
            e.preventDefault();
            return false;
        }
    });

    // For Safari, we need to handle gesture events to prevent pinch zoom during long press
    if (isSafari || isIOS) {
        document.addEventListener('gesturestart', function(e) {
            if (pressStarted) {
                // Safely prevent default if the method exists
                if (e && typeof e.preventDefault === 'function') {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        document.addEventListener('gesturechange', function(e) {
            if (pressStarted) {
                // Safely prevent default if the method exists
                if (e && typeof e.preventDefault === 'function') {
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }

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

                // Different handling for Safari/iOS vs other browsers
                if (isSafari || isIOS) {
                    // Safari-specific implementation
                    // For Safari, we use a simpler approach with fewer event types

                    // Touch start event - initializes the long press detection
                    dotMarker.on('touchstart', function(e) {
                        // Prevent all default behaviors to avoid Safari magnifying glass - safely check first
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }

                        // Only stop propagation if method exists
                        if (e && typeof e.stopPropagation === 'function') {
                            e.stopPropagation();
                        } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
                            e.originalEvent.stopPropagation();
                        }

                        // Store the touch position
                        if (e && e.touches && e.touches.length > 0) {
                            const touch = e.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                        } else if (e && e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 0) {
                            const touch = e.originalEvent.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                        }

                        // Start the press timer
                        startPressTimer(dotMarker, e);

                        // Set context menu prevention flag
                        contextMenuPrevented = true;
                    }, false); // false = not passive, so preventDefault works

                    // Mouse down event for non-touch devices
                    dotMarker.on('mousedown', function(e) {
                        // Safely prevent default if the method exists
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }
                        startPressTimer(dotMarker, e);
                    });

                    // Touch end - either completes a short tap or cancels long press
                    dotMarker.on('touchend', function(e) {
                        // Safely prevent default if the method exists
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }

                        // Only stop propagation if method exists
                        if (e && typeof e.stopPropagation === 'function') {
                            e.stopPropagation();
                        } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
                            e.originalEvent.stopPropagation();
                        }

                        // If it was a short tap, add the waypoint
                        if (pressStarted) {
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }
                    }, false);

                    // Handle mouse up similarly
                    dotMarker.on('mouseup', function(e) {
                        if (pressStarted) {
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }
                    });

                    // Cancel press on move out or touch cancel
                    dotMarker.on('mouseleave', cancelPressTimer);
                    dotMarker.on('touchcancel', cancelPressTimer);

                    // Add extra handler for context menu (right click or long press)
                    dotMarker.on('contextmenu', function(e) {
                        // Safely prevent default if the method exists
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }
                        return false;
                    });
                } else {
                    // Standard implementation for other browsers

                    // Use separate handlers for mousedown and touchstart
                    dotMarker.on('mousedown', function(e) {
                        startPressTimer(dotMarker, e);
                        // Prevent text selection during long press
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                        }
                    });

                    dotMarker.on('touchstart', function(e) {
                        // Pass the event to track touch coordinates
                        startPressTimer(dotMarker, e);
                        // Prevent default behaviors
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                        } else {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }, { passive: false });

                    // Handle mouse up events
                    dotMarker.on('mouseup', function(e) {
                        if (pressStarted) {
                            // Short click detected - add waypoint
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }
                    });

                    // Handle touch end events separately
                    dotMarker.on('touchend', function(e) {
                        if (pressStarted) {
                            // Short click detected - add waypoint
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }

                        // Prevent default for touch events
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                        } else {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }, { passive: false });

                    // Handle touch cancel events
                    dotMarker.on('touchcancel', function(e) {
                        cancelPressTimer();
                        e.stopPropagation();
                    }, { passive: true });

                    // Add mouseleave to cancel press if user moves out
                    dotMarker.on('mouseleave', function() {
                        cancelPressTimer();
                    });
                }

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

                // Different handling for Safari/iOS vs other browsers for labels
                if (isSafari || isIOS) {
                    // Safari-specific implementation for labels

                    // Touch start event - initializes the long press detection
                    labelMarker.on('touchstart', function(e) {
                        // Prevent all default behaviors to avoid Safari magnifying glass - safely check first
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }

                        // Only stop propagation if method exists
                        if (e && typeof e.stopPropagation === 'function') {
                            e.stopPropagation();
                        } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
                            e.originalEvent.stopPropagation();
                        }

                        // Store the touch position
                        if (e && e.touches && e.touches.length > 0) {
                            const touch = e.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                        } else if (e && e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 0) {
                            const touch = e.originalEvent.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                        }

                        // Start the press timer (use dotMarker which is what's in the route)
                        startPressTimer(dotMarker, e);

                        // Set context menu prevention flag
                        contextMenuPrevented = true;
                    }, false); // false = not passive, so preventDefault works

                    // Mouse down event for non-touch devices
                    labelMarker.on('mousedown', function(e) {
                        // Safely prevent default if the method exists
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }
                        startPressTimer(dotMarker, e);
                    });

                    // Touch end - either completes a short tap or cancels long press
                    labelMarker.on('touchend', function(e) {
                        // Safely prevent default if the method exists
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }

                        // Only stop propagation if method exists
                        if (e && typeof e.stopPropagation === 'function') {
                            e.stopPropagation();
                        } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
                            e.originalEvent.stopPropagation();
                        }

                        // If it was a short tap, add the waypoint
                        if (pressStarted) {
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }
                    }, false);

                    // Handle mouse up similarly
                    labelMarker.on('mouseup', function(e) {
                        if (pressStarted) {
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }
                    });

                    // Cancel press on move out or touch cancel
                    labelMarker.on('mouseleave', cancelPressTimer);
                    labelMarker.on('touchcancel', cancelPressTimer);

                    // Add extra handler for context menu (right click or long press)
                    labelMarker.on('contextmenu', function(e) {
                        // Safely prevent default if the method exists
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        } else if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
                            e.originalEvent.preventDefault();
                        }
                        return false;
                    });
                } else {
                    // Standard implementation for other browsers

                    // Use separate handlers for mousedown and touchstart
                    labelMarker.on('mousedown', function(e) {
                        startPressTimer(dotMarker, e); // Use dotMarker because that's in the route
                        // Prevent text selection during long press
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                        }
                    });

                    labelMarker.on('touchstart', function(e) {
                        // Pass the event to track touch coordinates
                        startPressTimer(dotMarker, e); // Use dotMarker because that's in the route
                        // Prevent default behaviors
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                        } else {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }, { passive: false });

                    // Handle mouse up events
                    labelMarker.on('mouseup', function(e) {
                        if (pressStarted) {
                            // Short click detected - add waypoint
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }
                    });

                    // Handle touch end events separately
                    labelMarker.on('touchend', function(e) {
                        if (pressStarted) {
                            // Short click detected - add waypoint
                            cancelPressTimer();
                            addWaypointToRoute(dotMarker, latitude, longitude, name, altitude);
                        }

                        // Prevent default for touch events
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                        } else {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }, { passive: false });

                    // Handle touch cancel events
                    labelMarker.on('touchcancel', function(e) {
                        cancelPressTimer();
                        e.stopPropagation();
                    }, { passive: true });

                    // Add mouseleave to cancel press if user moves out
                    labelMarker.on('mouseleave', function() {
                        cancelPressTimer();
                    });
                }
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
    elliotMarker = marker;

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

/**
 * Start the long press timer for a marker
 * @param {L.CircleMarker} marker - The marker being pressed
 * @param {Event} event - The initiating event (optional)
 */
function startPressTimer(marker, event) {
    // Store touch start position if it's a touch event
    if (event && event.type === 'touchstart' && event.touches && event.touches.length > 0) {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }

    // If already in a press, cancel it first
    if (pressStarted) {
        cancelPressTimer();
    }

    // Store the current marker and its original style
    currentPressedMarker = marker;
    originalMarkerStyle = {
        radius: marker.options.radius,
        fillColor: marker.options.fillColor,
        color: marker.options.color,
        weight: marker.options.weight,
        opacity: marker.options.opacity,
        fillOpacity: marker.options.fillOpacity
    };

    pressStarted = true;

    // Start the growth animation
    let growthStep = 0;
    const totalSteps = 10; // Number of steps for smooth animation
    const maxRadius = originalMarkerStyle.radius * 1.8; // Max 80% growth

    // Clear any existing animation
    if (growthAnimation) {
        clearInterval(growthAnimation);
    }

    // Start a new animation
    growthAnimation = setInterval(() => {
        if (!pressStarted) {
            clearInterval(growthAnimation);
            return;
        }

        growthStep++;
        if (growthStep <= totalSteps) {
            // Calculate new radius based on progress
            const progress = growthStep / totalSteps;
            const newRadius = originalMarkerStyle.radius + (maxRadius - originalMarkerStyle.radius) * progress;

            // Update marker style
            marker.setStyle({
                radius: newRadius
            });
        } else {
            // Animation complete
            clearInterval(growthAnimation);
        }
    }, 40); // Update every 40ms for smooth animation

    // Start the long press timer
    pressTimer = setTimeout(() => {
        if (pressStarted) {
            // Long press detected
            pressStarted = false;
            handleLongPress(marker);
        }
    }, LONG_PRESS_DURATION);
}

/**
 * Cancel the current press timer and reset the marker
 */
function cancelPressTimer() {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }

    if (growthAnimation) {
        clearInterval(growthAnimation);
        growthAnimation = null;
    }

    // If we were in the middle of a press, reset the marker style
    if (pressStarted && currentPressedMarker && originalMarkerStyle) {
        resetMarkerStyle();
    }

    pressStarted = false;
    currentPressedMarker = null;
    originalMarkerStyle = null;
}

/**
 * Reset marker style to original
 */
function resetMarkerStyle() {
    if (currentPressedMarker && originalMarkerStyle) {
        currentPressedMarker.setStyle(originalMarkerStyle);
    }
}

/**
 * Handle a long press on a marker - remove from route
 * @param {L.CircleMarker} marker - The marker that was long-pressed
 */
function handleLongPress(marker) {
    // Make sure we have a valid marker
    if (!marker) {
        console.error('Invalid marker in handleLongPress');
        return;
    }

    // Find if this waypoint is in the route
    const waypointIndex = routePoints.findIndex(point =>
        point.marker === marker
    );

    if (waypointIndex === -1) {
        // Not in route, do nothing
        resetMarkerStyle();
        return;
    }

    try {
        // Show removal animation
        const removedMarker = routePoints[waypointIndex].marker;

        // Animation steps:
        // 1. Flash red
        removedMarker.setStyle({
            radius: originalMarkerStyle.radius * 1.5,
            fillColor: '#ff0000',
            fillOpacity: 0.8,
            color: '#ff0000',
            weight: 2
        });

        // 2. Shrink and fade out
        setTimeout(() => {
            let step = 0;
            const fadeSteps = 10;
            const fadeInterval = setInterval(() => {
                try {
                    step++;
                    if (step <= fadeSteps) {
                        const progress = step / fadeSteps;
                        const newRadius = originalMarkerStyle.radius * (1.5 - progress);
                        const newOpacity = 0.8 * (1 - progress);

                        // Check if marker is still valid and on the map
                        if (removedMarker && map.hasLayer(removedMarker)) {
                            removedMarker.setStyle({
                                radius: newRadius,
                                fillOpacity: newOpacity,
                                opacity: newOpacity
                            });
                        }
                    } else {
                        clearInterval(fadeInterval);

                        // 3. Actually remove the waypoint
                        removeRoutePoint(waypointIndex);

                        // 4. Reset the marker style (the removeRoutePoint function handles this)
                    }
                } catch (error) {
                    console.error('Error in fade animation:', error);
                    clearInterval(fadeInterval);

                    // Still try to remove the waypoint even if animation fails
                    try {
                        removeRoutePoint(waypointIndex);
                    } catch (e) {
                        console.error('Error removing waypoint:', e);
                    }
                }
            }, 30);
        }, 200);
    } catch (error) {
        console.error('Error in handleLongPress:', error);

        // Attempt to remove the waypoint anyway, even if animation fails
        try {
            removeRoutePoint(waypointIndex);
        } catch (e) {
            console.error('Error removing waypoint:', e);
        }
    }
}

/**
 * Check if a point is in the active route
 * @param {string} name - Waypoint name
 * @returns {boolean} True if the waypoint is in the route
 */
function isWaypointInRoute(name) {
    return routePoints.some(point => point.name === name);
}

export {
    loadWaypoints,
    waypointMap,
    updateLabelStyles,
    ensureElliotCircleVisible,
    isWaypointInRoute
};
