# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shonky.info is a simple personal website that:
1. Serves as a repository for hang gliding GPS waypoints in various formats (GPX, KML, WPT, CUP)
2. Displays YouTube videos from the owner's channel and curated hang gliding videos
3. Includes a minimal API implementation using Cloudflare Pages Functions

## Deployment

The site is deployed on Cloudflare Pages. Changes are deployed by pushing to the git repository.

## Project Structure

- `/index.html` - Main site page
- `/waypoints/` - Directory containing hang gliding GPS waypoints in various formats
  - `/waypoints/index.html` - Page listing available waypoint files
- `/functions/` - Contains Cloudflare Pages Functions
  - `/functions/api/posts.js` - Simple API endpoint returning static JSON
  - `/functions/api/[[id]].js` - API endpoint accepting a path parameter

## Development

The site is a static HTML site using the mini.css framework. There is no build process or package management.

### Adding New Waypoints

To add new waypoint files:
1. Add the file to the `/waypoints/` directory
2. Update `/waypoints/index.html` to include a link to the new file

### Modifying or Adding API Functions

Cloudflare Pages Functions can be added or modified in the `/functions/` directory:
1. Create or modify files in the appropriate directory
2. Use the Cloudflare Pages Functions API format with `onRequestGet()` or similar methods
3. Test locally with Cloudflare Pages local development tools (if needed)
4. Deploy by pushing to the git repository