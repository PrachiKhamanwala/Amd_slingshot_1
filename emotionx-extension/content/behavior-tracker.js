// Tracks scroll, mouse, clicks, idle time and cart-like interactions.

class BehaviorTracker {
  constructor() {
    this.reset();
    this.idleTimeout = null;
    this.idleThresholdMs = 5000;
    this.flushIntervalMs = 4000;
    this.flushTimer = null;
  }

  reset() {
    this.data = {
      scrollDistances: [],
      scrollTimestamps: [],
      clicks: 0,
      hovers: 0,
      hoverDurations: [],
      cartAdds: 0,
      cartRemovals: 0,
      lastActiveAt: performance.now(),
      tabSwitches: 0
    };

    this.motionSamples = [];
    this.lastMousePos = null;
    this.lastVelocity = 0;
    this.lastAcceleration = 0;
    this.lastSampleTs = 0;

    this.emaVelocity = 0;
    this.emaAcceleration = 0;
    this.emaAlpha = 0.3;
  }

  start(onSnapshot) {
    this.onSnapshot = onSnapshot;

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('click', this.onClick, true);
    window.addEventListener('visibilitychange', this.onVisibilityChange);

    this.observeHovers();
    this.observeCartButtons();

    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  stop() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick, true);
    window.removeEventListener('visibilitychange', this.onVisibilityChange);

    if (this.flushTimer) window.clearInterval(this.flushTimer);
    if (this.idleTimeout) window.clearTimeout(this.idleTimeout);
  }

  touchActivity() {
    this.data.lastActiveAt = performance.now();
    if (this.idleTimeout) window.clearTimeout(this.idleTimeout);
    this.idleTimeout = window.setTimeout(() => {
      this.flush();
    }, this.idleThresholdMs);
  }

  onScroll = () => {
    const now = performance.now();
    const distance = Math.abs(window.scrollY - (this.lastScrollY || 0));
    this.lastScrollY = window.scrollY;

    this.data.scrollDistances.push(distance);
    this.data.scrollTimestamps.push(now);
    this.touchActivity();
  };

  onMouseMove = (e) => {
    const now = performance.now();

    if (this.lastMousePos) {
      const dt = now - this.lastSampleTs;
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;

      if (dt >= 40) {
        const velocity = this.computeVelocity(dx, dy, dt);
        const acceleration = this.computeAcceleration(this.lastVelocity, velocity, dt);
        const jerk = this.computeAcceleration(this.lastAcceleration, acceleration, dt);
        const direction = Math.atan2(dy, dx);

        this.emaVelocity = this.smoothEMA(velocity, this.emaVelocity, this.emaAlpha);
        this.emaAcceleration = this.smoothEMA(acceleration, this.emaAcceleration, this.emaAlpha);

        this.motionSamples.push({
          velocity: this.emaVelocity,
          acceleration: this.emaAcceleration,
          direction,
          jerk,
          timestamp: now
        });

        if (this.motionSamples.length > 50) {
          this.motionSamples.shift();
        }

        this.lastVelocity = velocity;
        this.lastAcceleration = acceleration;
        this.lastSampleTs = now;
      }
    } else {
      this.lastSampleTs = now;
    }

    this.lastMousePos = { x: e.clientX, y: e.clientY };
    this.touchActivity();
  };

  onClick = () => {
    this.data.clicks += 1;
    this.touchActivity();
  };

  onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.data.tabSwitches += 1;
      this.flush();
    }
  };

  observeHovers() {
    const hovered = new WeakMap();

    document.addEventListener(
      'mouseover',
      (e) => {
        const el = e.target;
        if (!el || hovered.has(el)) return;
        hovered.set(el, performance.now());
      },
      true
    );

    document.addEventListener(
      'mouseout',
      (e) => {
        const el = e.target;
        if (!el || !hovered.has(el)) return;
        const start = hovered.get(el);
        const dur = performance.now() - start;
        this.data.hovers += 1;
        this.data.hoverDurations.push(dur);
        hovered.delete(el);
      },
      true
    );
  }

  observeCartButtons() {
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target;
        if (!target) return;
        const text = String(target.textContent || '').toLowerCase();
        if (text.includes('add to cart') || text.includes('add to bag')) {
          this.data.cartAdds += 1;
        }
        if (text.includes('remove') || text.includes('delete')) {
          this.data.cartRemovals += 1;
        }
      },
      true
    );
  }

  flush() {
    if (!this.onSnapshot) return;

    const features = this.computeFeatures();
    this.reset();
    this.onSnapshot(features);
  }

  computeVelocity(dx, dy, dt) {
    if (dt <= 0) return 0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist / dt;
  }

  computeAcceleration(v1, v2, dt) {
    if (dt <= 0) return 0;
    return (v2 - v1) / dt;
  }

  smoothEMA(value, prev, alpha) {
    if (!isFinite(prev) || prev === 0) {
      return value;
    }
    return alpha * value + (1 - alpha) * prev;
  }

  calculateDirectionVariance(samples) {
    if (!samples.length) return 0;
    let sumSin = 0;
    let sumCos = 0;
    for (const s of samples) {
      sumSin += Math.sin(s.direction);
      sumCos += Math.cos(s.direction);
    }
    const n = samples.length;
    const meanSin = sumSin / n;
    const meanCos = sumCos / n;
    const R = Math.sqrt(meanSin * meanSin + meanCos * meanCos);
    return 1 - R;
  }

  computeFeatures() {
    const samples = this.motionSamples.slice();
    if (!samples.length) {
      return {
        avgVelocity: 0,
        avgAcceleration: 0,
        directionVariance: 0,
        motionBurstFrequency: 0,
        hoverTime: 0,
        timestamp: Date.now()
      };
    }

    const velocities = samples.map(s => Math.abs(s.velocity));
    const accelerations = samples.map(s => Math.abs(s.acceleration));

    const avgVelocity =
      velocities.reduce((a, b) => a + b, 0) / (velocities.length || 1);
    const avgAcceleration =
      accelerations.reduce((a, b) => a + b, 0) / (accelerations.length || 1);

    const directionVariance = this.calculateDirectionVariance(samples);

    const windowMs =
      samples[samples.length - 1].timestamp - samples[0].timestamp || 1;
    const burstThreshold = avgVelocity * 1.5 || 0.001;
    const bursts = samples.filter(s => s.velocity > burstThreshold).length;
    const motionBurstFrequency = (bursts / (windowMs / 1000)) || 0;

    const hoverDurations = this.data.hoverDurations || [];
    const hoverTime =
      hoverDurations.length > 0
        ? hoverDurations.reduce((a, b) => a + b, 0) / hoverDurations.length
        : 0;

    return {
      avgVelocity,
      avgAcceleration,
      directionVariance,
      motionBurstFrequency,
      hoverTime,
      timestamp: Date.now()
    };
  }
}

