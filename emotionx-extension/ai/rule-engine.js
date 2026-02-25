// Lightweight, swappable scoring functions for EmotionX.
// These act as placeholders for future ML models (e.g. TensorFlow.js).

export function modelBehavior(features, baseline) {
  if (!features) return null;

  const {
    normalizedVelocity = 0,
    normalizedAcceleration = 0,
    normalizedHoverTime = 0,
    directionVariance = 0,
    motionBurstFrequency = 0
  } = features;

  const arousal =
    0.4 * normalizedVelocity +
    0.3 * normalizedAcceleration +
    0.2 * motionBurstFrequency +
    0.1 * directionVariance;

  const focus = Math.max(0, 1 - directionVariance) * (1 + 0.2 * normalizedHoverTime);

  let emotion = 'neutral';
  let rawScore = 0.55;

  if (arousal < 0.6 && focus > 1.1) {
    emotion = 'calm';
    rawScore = 0.65 + 0.1 * focus;
  } else if (arousal > 1.4 && directionVariance > 0.7) {
    emotion = 'frustrated';
    rawScore = 0.7 + 0.15 * Math.min(1.5, arousal - 1);
  } else if (arousal > 1.2 && motionBurstFrequency > 0.8) {
    emotion = 'impulsive';
    rawScore = 0.7 + 0.12 * Math.min(1.5, motionBurstFrequency);
  } else if (focus > 1.2 && arousal >= 0.8 && arousal <= 1.2) {
    emotion = 'engaged';
    rawScore = 0.7 + 0.1 * (focus - 1);
  }

  const confidence = Math.max(0.5, Math.min(0.95, rawScore));

  return { emotion, confidence, score: confidence };
}

export function modelWebcam(features) {
  if (!features) return null;

  const {
    emotion = 'neutral',
    confidence = 0.55,
    blinkRate = 0,
    headMovement = 0,
    browTension = 0
  } = features;

  const stabilityPenalty = 0.1 * Math.max(0, headMovement - 0.5) + 0.1 * Math.max(0, blinkRate - 0.6);
  const tensionBoost = 0.1 * browTension;

  let adjusted = confidence + tensionBoost - stabilityPenalty;
  adjusted = Math.max(0.4, Math.min(0.98, adjusted));

  return { emotion, confidence: adjusted, score: adjusted };
}
