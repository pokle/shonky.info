# KIRO.md

This file provides guidance to Kiro when working with code in this repository.

## Project Analysis (Initial Assessment)

**shonky.info** is a personal website for hang gliding enthusiasts, originally set up with Claude Code assistance.

### Project Overview
- Static HTML site using mini.css framework
- Deployed on Cloudflare Pages (auto-deploy via git)
- Serves hang gliding GPS waypoints in multiple formats
- Features interactive waypoints editor with route planning
- Includes YouTube video integration

### Technical Architecture

**Frontend Stack:**
- Vanilla HTML/CSS/JS with mini.css framework
- Leaflet.js for interactive mapping
- Modular JavaScript architecture

**Key Components:**
- `/index.html` - Main landing page with YouTube embeds
- `/waypoints/` - Interactive waypoints editor and file repository
- `/waypoints/js/` - Modular JS: main.js, map-init.js, route.js, waypoints.js, route-utils.js
- `/functions/` - Cloudflare Pages Functions for API endpoints

**Testing & Deployment:**
- Playwright E2E tests with visual regression testing
- pnpm package management
- Cloudflare Pages deployment

### Key Features Analysis

**Waypoints Editor (`/waypoints/index.html`):**
- Sophisticated Leaflet.js-based interactive map
- Route planning with distance calculations
- Waypoint visualization and interaction
- URL sharing for routes
- Support for multiple GPS formats (GPX, KML, WPT, CUP)

**API Layer:**
- `/functions/api/posts.js` - Static JSON endpoint
- `/functions/api/[[id]].js` - Dynamic path parameter endpoint

### Code Quality Observations
- Well-structured modular JavaScript
- Comprehensive CSS styling for map components
- Good separation of concerns
- Thorough test coverage with Playwright
- Clean project structure

### Development Workflow
- Tests: `pnpm test` (includes Playwright browser install)
- Test variants: `pnpm test:headed`, `pnpm test:ui`
- Deployment: Push to git repository

### Areas for Potential Enhancement
- Could benefit from TypeScript for better type safety
- API layer could be expanded for dynamic waypoint management
- Mobile responsiveness could be optimized further
- Consider adding PWA features for offline waypoint access

### Context for Future Work
This is a functional, well-architected project serving the hang gliding community. Any modifications should maintain the clean, simple aesthetic while preserving the core waypoint management and route planning functionality.