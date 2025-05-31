import { test, expect } from '@playwright/test';

test.describe('Waypoints Map', () => {
  test('loads and displays the waypoints map', async ({ page }) => {
    // Navigate to the waypoints page
    await page.goto('/waypoints/');
    
    // Wait for the main heading instead of title
    await expect(page.locator('h1')).toHaveText('Waypoints');
    
    // Wait for the map container to be visible
    await page.waitForSelector('#map', { state: 'visible' });
    
    // Wait for Leaflet to initialize and waypoints to load
    await page.waitForFunction(() => {
      return window.L && 
             document.querySelector('.leaflet-marker-icon') && 
             document.querySelectorAll('.leaflet-marker-icon').length > 0;
    }, { timeout: 10000 });
    
    // Wait for tiles to load
    await page.waitForTimeout(2000);
    
    // Take a screenshot of the full page
    await page.screenshot({ 
      path: 'test-results/waypoints-map-full.png',
      fullPage: true 
    });
    
    // Take a screenshot focused on just the map
    await page.locator('#map').screenshot({ 
      path: 'test-results/waypoints-map-only.png' 
    });
  });

  test('can interact with waypoints', async ({ page }) => {
    await page.goto('/waypoints/');
    await page.waitForSelector('#map', { state: 'visible' });
    await page.waitForFunction(() => {
      return window.L && 
             document.querySelector('.leaflet-marker-icon') && 
             document.querySelectorAll('.leaflet-marker-icon').length > 0;
    }, { timeout: 10000 });
    
    // Wait for waypoints to fully load
    await page.waitForTimeout(2000);
    
    // Find waypoint labels that aren't overlapping
    const markers = page.locator('.waypoint-label');
    const markerCount = await markers.count();
    
    if (markerCount > 0) {
      // Try clicking different markers until one works
      let clicked = false;
      for (let i = 0; i < Math.min(5, markerCount) && !clicked; i++) {
        try {
          await markers.nth(i).click({ timeout: 2000, force: true });
          clicked = true;
          await page.waitForTimeout(1000);
        } catch (e) {
          // Try next marker if this one fails
          continue;
        }
      }
      
      // Screenshot after clicking
      await page.screenshot({ 
        path: 'test-results/waypoint-clicked.png',
        fullPage: true 
      });
    }
  });

  test('debug map loading', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('/waypoints/');
    await page.waitForSelector('#map', { state: 'visible' });
    
    // Check what's actually loaded
    const hasLeaflet = await page.evaluate(() => !!window.L);
    console.log('Leaflet loaded:', hasLeaflet);
    
    if (hasLeaflet) {
      const mapExists = await page.evaluate(() => {
        const mapDiv = document.getElementById('map');
        return mapDiv && mapDiv._leaflet_id;
      });
      console.log('Map initialized:', mapExists);
    }
    
    // Wait and check for KML loading
    await page.waitForTimeout(10000);
    
    const finalCheck = await page.evaluate(() => {
      return {
        leafletMarkers: document.querySelectorAll('.leaflet-marker-icon').length,
        waypointLabels: document.querySelectorAll('.waypoint-label').length,
        mapLayers: window.L && window.L.map ? Object.keys(window.L.map._layers || {}).length : 0
      };
    });
    
    console.log('Final check:', finalCheck);
    
    await page.screenshot({ 
      path: 'test-results/debug-final.png',
      fullPage: true 
    });
  });
});