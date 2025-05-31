# Waypoints Map

This directory contains the interactive waypoints map for hang gliding GPS waypoints, primarily focused on Corryong and other locations in Victoria, Australia.

## URL Parameter Pattern

The waypoints map uses the URL hash (after the `#`) to store route information and potentially other parameters in the future. The current format is:

```
https://shonky.info/waypoints/#route=WAYPOINT1,WAYPOINT2,WAYPOINT3
```

Where:
- `route=` parameter contains a comma-separated list of waypoint names
- Waypoint names are URL-encoded to handle spaces and special characters
- Multiple parameters can be combined with `&` (e.g., `#route=ELLIOT,MITTA&param2=value`)

## Features

1. **Interactive Waypoint Map**
   - Displays Corryong waypoints on an interactive map
   - Map loads automatically when the page is opened
   - Toggle between satellite and street map views
   - Special 5km radius circle around ELLIOT waypoint for competition start
   
2. **Route Planning**
   - Click on waypoints to add them to a route
   - Shows distances between consecutive waypoints
   - Calculates and displays total route distance
   - Remove waypoints from route using X buttons in the list
   - Click the most recently added point again to remove it
   - Cursor changes to indicate when clicking will remove a point
   - Reset button to clear the entire route
   
3. **Route Sharing**
   - Routes are stored in the URL for sharing
   - Copy button to easily copy the shareable URL
   - Opening a shared URL automatically loads the specified route
   - URLs use waypoint names for human readability

## Files

- `index.html` - The main interactive map and route planning interface
- Various waypoint files in different formats (GPX, KML, WPT, CUP)

## Development

This is a simple static HTML application using:
- [Leaflet.js](https://leafletjs.com/) for the interactive map
- [mini.css](https://minicss.org/) for basic styling
- Standard JavaScript with no build process or dependencies

When adding new features, be sure to update this documentation.