// Converts raw behavioral tracking snapshots into normalized features.

function extractBehaviorFeatures(snapshot) {
  const now = performance.now();
  const idleMs = now - snapshot.lastActiveAt;

  const avgScrollSpeed =
    snapshot.scrollDistances.length > 0
      ? snapshot.scrollDistances.reduce((a, b) => a + b, 0) / snapshot.scrollDistances.length
      : 0;

  const mouseAvg =
    snapshot.mouseMovements.length > 0
      ? snapshot.mouseMovements.reduce((a, b) => a + b, 0) / snapshot.mouseMovements.length
      : 0;

  const hoverAvg =
    snapshot.hoverDurations.length > 0
      ? snapshot.hoverDurations.reduce((a, b) => a + b, 0) / snapshot.hoverDurations.length
      : 0;

  const cartFluctuation = snapshot.cartAdds + snapshot.cartRemovals;

  return {
    avgScrollSpeed,
    mouseAcceleration: mouseAvg,
    hoverTime: hoverAvg,
    clickRate: snapshot.clicks / 60, // rough per-minute proxy
    idleTime: idleMs,
    cartFluctuation,
    tabSwitches: snapshot.tabSwitches
  };
}

