import { modelBehavior, modelWebcam } from './rule-engine.js';

export class EmotionEngine {
  constructor() {
    this.behaviorBaseline = null;
    this.calibrationSamples = [];
    this.calibrationStart = null;
    this.isCalibrating = true;

    this.behaviorLatest = null;
    this.webcamLatest = null;

    this.emotionHistory = [];
    this.temporalWindow = 15;

    this.lastStableEmotion = null;
    this.lastStableUpdateAt = 0;
  }

  async loadBaseline() {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get('emotionx_behavior_baseline', data => {
          if (data && data.emotionx_behavior_baseline) {
            this.behaviorBaseline = data.emotionx_behavior_baseline;
            this.isCalibrating = false;
          }
          resolve(this.behaviorBaseline);
        });
      } catch {
        resolve(null);
      }
    });
  }

  async saveBaseline() {
    if (!this.behaviorBaseline) return;
    try {
      await chrome.storage.local.set({
        emotionx_behavior_baseline: this.behaviorBaseline
      });
    } catch {
      // ignore storage failures
    }
  }

  processBehaviorSample(rawFeatures) {
    if (!rawFeatures) return null;

    if (this.isCalibrating && !this.behaviorBaseline) {
      this.collectCalibrationSample(rawFeatures);
      return null;
    }

    const baseline = this.behaviorBaseline;
    const normalized = this.normalizeBehavior(rawFeatures, baseline);

    const behaviorResult = modelBehavior(normalized, baseline);
    this.behaviorLatest = behaviorResult ? { ...behaviorResult, features: normalized } : null;

    return this.computeHybridDecision();
  }

  processWebcamSample(webcamFeatures) {
    if (!webcamFeatures || webcamFeatures.confidence == null) return null;
    if (webcamFeatures.confidence < 0.75) {
      return null;
    }

    const webcamResult = modelWebcam(webcamFeatures);
    this.webcamLatest = webcamResult ? { ...webcamResult, features: webcamFeatures } : null;

    return this.computeHybridDecision();
  }

  inferFromFacialSignals(signals) {
    if (!signals) return null;
    const webcamFeatures = {
      emotion: signals.emotion || 'neutral',
      confidence: signals.confidence ?? 0.6,
      blinkRate: signals.blinkRate ?? 0,
      headMovement: signals.headMovement ?? signals.motionIntensity ?? 0,
      browTension: signals.browTension ?? signals.eyebrowRaise ?? 0,
      timestamp: signals.timestamp ?? Date.now()
    };

    return this.processWebcamSample(webcamFeatures);
  }

  collectCalibrationSample(features) {
    const now = features.timestamp || performance.now();
    if (!this.calibrationStart) {
      this.calibrationStart = now;
    }

    this.calibrationSamples.push(features);

    const elapsed = now - this.calibrationStart;
    if (elapsed >= 120000 || this.calibrationSamples.length >= 300) {
      const baseline = this.computeBaseline(this.calibrationSamples);
      this.behaviorBaseline = baseline;
      this.isCalibrating = false;
      this.calibrationSamples = [];
      this.saveBaseline();
    }
  }

  computeBaseline(samples) {
    if (!samples.length) {
      return {
        normalVelocity: 1,
        normalAcceleration: 1,
        normalHoverTime: 1500
      };
    }

    const sum = samples.reduce(
      (acc, s) => {
        acc.velocity += s.avgVelocity || 0;
        acc.acceleration += s.avgAcceleration || 0;
        acc.hoverTime += s.hoverTime || 0;
        return acc;
      },
      { velocity: 0, acceleration: 0, hoverTime: 0 }
    );

    const n = samples.length || 1;
    return {
      normalVelocity: sum.velocity / n || 1,
      normalAcceleration: sum.acceleration / n || 1,
      normalHoverTime: sum.hoverTime / n || 1500
    };
  }

  normalizeBehavior(features, baseline) {
    const base = baseline || {
      normalVelocity: Math.max(1, features.avgVelocity || 1),
      normalAcceleration: Math.max(1, features.avgAcceleration || 1),
      normalHoverTime: Math.max(1, features.hoverTime || 1500)
    };

    const normalizedVelocity = (features.avgVelocity || 0) / (base.normalVelocity || 1);
    const normalizedAcceleration = (features.avgAcceleration || 0) / (base.normalAcceleration || 1);
    const normalizedHoverTime = (features.hoverTime || 0) / (base.normalHoverTime || 1);

    return {
      ...features,
      normalizedVelocity,
      normalizedAcceleration,
      normalizedHoverTime
    };
  }

  computeHybridDecision() {
    const behavior = this.behaviorLatest;
    const webcam = this.webcamLatest;

    if (!behavior && !webcam) {
      return null;
    }

    let chosen = null;
    let source = 'behavior';

    if (webcam && behavior) {
      const behaviorScore = behavior.score ?? behavior.confidence ?? 0.6;
      const webcamScore = webcam.score ?? webcam.confidence ?? 0.6;
      const hybridScore = 0.6 * webcamScore + 0.4 * behaviorScore;

      source = 'hybrid';
      chosen =
        webcamScore >= behaviorScore
          ? { emotion: webcam.emotion, confidence: hybridScore }
          : { emotion: behavior.emotion, confidence: hybridScore };
    } else if (webcam) {
      source = 'hybrid';
      chosen = { emotion: webcam.emotion, confidence: webcam.confidence };
    } else {
      source = 'behavior';
      chosen = { emotion: behavior.emotion, confidence: behavior.confidence };
    }

    if (!chosen) return null;

    const smoothed = this.applyTemporalSmoothing({
      ...chosen,
      source
    });

    const stable = this.applyStabilityLayer(smoothed);
    return stable;
  }

  applyTemporalSmoothing(current) {
    this.emotionHistory.push(current);
    if (this.emotionHistory.length > this.temporalWindow) {
      this.emotionHistory.shift();
    }

    const counts = new Map();
    for (const e of this.emotionHistory) {
      if (!e.emotion) continue;
      counts.set(e.emotion, (counts.get(e.emotion) || 0) + 1);
    }

    let majorityEmotion = current.emotion;
    let maxCount = 0;
    counts.forEach((count, emotion) => {
      if (count > maxCount) {
        maxCount = count;
        majorityEmotion = emotion;
      }
    });

    const avgConfidence =
      this.emotionHistory.reduce((acc, e) => acc + (e.confidence || 0), 0) /
        (this.emotionHistory.length || 1) || current.confidence;

    return {
      emotion: majorityEmotion,
      confidence: avgConfidence,
      source: current.source
    };
  }

  applyStabilityLayer(current) {
    if (!current || !current.emotion) return null;

    const now = Date.now();
    const confidence = current.confidence ?? 0.6;

    const lastThree = this.emotionHistory.slice(-3);
    const stableSequence =
      lastThree.length === 3 && lastThree.every(e => e.emotion === current.emotion);

    if (!stableSequence || confidence < 0.7) {
      return null;
    }

    if (this.lastStableEmotion === current.emotion) {
      if (now - this.lastStableUpdateAt < 5000) {
        return null;
      }
    }

    this.lastStableEmotion = current.emotion;
    this.lastStableUpdateAt = now;

    return {
      emotion: current.emotion,
      confidence,
      source: current.source
    };
  }
}

