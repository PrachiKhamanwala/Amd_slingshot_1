// High-level webcam emotion pipeline: camera + motion analyzer + emotion engine.

import { CameraController } from './camera-controller.js';
import { MotionAnalyzer } from './motion-analyzer.js';

export class ExpressionClassifier {
  constructor(engine) {
    this.camera = new CameraController();
    this.motionAnalyzer = new MotionAnalyzer();

    // Prefer a shared EmotionEngine instance if the caller passes one
    // (for true hybrid behavior + webcam decisions). Fall back to a
    // global EmotionEngine if available, otherwise remain webcam-only.
    this.engine = engine || (globalThis.EmotionEngine ? new globalThis.EmotionEngine() : null);

    this.canvas = document.createElement('canvas');
    this.running = false;
    this.onEmotion = null;
    this.lastProcessedAt = 0;
    this.emotionBuffer = [];
    this.bufferSize = 10;
  }

  async start(onEmotion) {
    if (this.running) return;
    if (!this.engine || typeof this.engine.processWebcamSample !== 'function') {
      throw new Error('ExpressionClassifier requires a compatible EmotionEngine instance.');
    }

    this.onEmotion = onEmotion;
    await this.camera.start();
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    this.camera.stop();
  }

  loop = () => {
    if (!this.running) return;
    const now = performance.now();
    if (now - this.lastProcessedAt >= 150) {
      this.lastProcessedAt = now;
      const frame = this.camera.getFrame(this.canvas);
      const signals = this.motionAnalyzer.analyze(frame);
      if (signals) {
        const webcamFeatures = this.buildWebcamFeatures(signals);
        const result = this.engine.processWebcamSample(webcamFeatures);
        if (result) {
          this.bufferEmotion(result);
          const majority = this.majorityFromBuffer();
          if (majority && this.onEmotion) {
            this.onEmotion({
              ...majority,
              webcamFeatures
            });
          }
        }
      }
    }
    requestAnimationFrame(this.loop);
  };

  buildWebcamFeatures(signals) {
    const {
      smile,
      eyeOpenness,
      motionIntensity,
      blinkRate,
      headMovement,
      browTension,
      normFactor
    } = signals;

    const normalizedBlinkRate = Math.min(1, blinkRate / 20);
    const normalizedHeadMovement = Math.min(1, headMovement);
    const normalizedBrowTension = Math.min(1, browTension);

    let emotion = 'neutral';
    let confidence = 0.6;

    if (smile > 0.6 && eyeOpenness > 0.4) {
      emotion = 'happy';
      confidence = 0.8;
    } else if (browTension > 0.6 && motionIntensity > 0.4) {
      emotion = 'frustrated';
      confidence = 0.78;
    } else if (motionIntensity < 0.25 && eyeOpenness > 0.5) {
      emotion = 'focused';
      confidence = 0.72;
    }

    return {
      emotion,
      confidence,
      blinkRate: normalizedBlinkRate,
      headMovement: normalizedHeadMovement,
      browTension: normalizedBrowTension,
      timestamp: Date.now(),
      normFactor
    };
  }

  bufferEmotion(result) {
    if (!result || !result.emotion) return;
    this.emotionBuffer.push(result);
    if (this.emotionBuffer.length > this.bufferSize) {
      this.emotionBuffer.shift();
    }
  }

  majorityFromBuffer() {
    if (!this.emotionBuffer.length) return null;
    const counts = new Map();
    let best = null;
    for (const r of this.emotionBuffer) {
      const key = r.emotion;
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      if (!best || next > counts.get(best)) {
        best = key;
      }
    }
    if (!best) return null;

    const filtered = this.emotionBuffer.filter(r => r.emotion === best);
    const confidence =
      filtered.reduce((acc, r) => acc + (r.confidence || 0), 0) /
        (filtered.length || 1) || 0.6;

    return {
      emotion: best,
      confidence,
      source: 'hybrid'
    };
  }
}

