/**
 * Check if a new point is an immediate return leg (overlaps the previous segment).
 * @param {Array<{lat: number, lon: number}>} routePoints - Array of existing route points.
 * @param {{lat: number, lon: number}} point - The new point to check.
 * @param {number} [index=routePoints.length] - Position index for the new point in the route.
 * @returns {boolean} True if the new point matches the point two steps back.
 */
export function isImmediateReturn(routePoints, point, index = routePoints.length) {
  if (index < 2) return false;
  const prevPrev = routePoints[index - 2];
  return prevPrev.lat === point.lat && prevPrev.lon === point.lon;
}