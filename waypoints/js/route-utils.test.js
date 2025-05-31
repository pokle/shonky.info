const assert = require('assert');

(async () => {
  const { isImmediateReturn } = await import('./route-utils.js');

  const makePoints = arr => arr.map(([lat, lon]) => ({ lat, lon }));

  // No previous points -> not a return leg
  assert.strictEqual(isImmediateReturn(makePoints([]), { lat: 0, lon: 0 }), false);
  assert.strictEqual(isImmediateReturn(makePoints([[0, 0]]), { lat: 0, lon: 0 }), false);

  // Out-and-back: A -> B -> A should be detected
  assert.strictEqual(
    isImmediateReturn(makePoints([[0, 0], [1, 1]]), { lat: 0, lon: 0 }),
    true
  );

  // Not an immediate reversal (different point)
  assert.strictEqual(
    isImmediateReturn(makePoints([[0, 0], [1, 1]]), { lat: 2, lon: 2 }),
    false
  );

  // Using index override (rebuild scenario)
  assert.strictEqual(
    isImmediateReturn(makePoints([[0, 0], [1, 1], [2, 2]]), { lat: 1, lon: 1 }, 3),
    true
  );

  console.log('✅ route-utils tests passed');
})();