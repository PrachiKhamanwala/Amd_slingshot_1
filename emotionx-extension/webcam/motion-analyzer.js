// Approximates motion and simple facial-region dynamics for MVP.

export class MotionAnalyzer {
  constructor() {
    this.prevFrame = null;
    this.lastBlinkState = null;
    this.blinkCount = 0;
    this.lastHeadCenter = null;
  }

  analyze(imageData) {
    if (!imageData) return null;
    const { data, width, height } = imageData;

    const centerX = Math.floor(width * 0.5);
    const centerY = Math.floor(height * 0.45);
    const radius = Math.floor(Math.min(width, height) * 0.25);

    let motionSum = 0;
    let samples = 0;

    if (this.prevFrame) {
      const prev = this.prevFrame.data;
      for (let y = centerY - radius; y < centerY + radius; y++) {
        for (let x = centerX - radius; x < centerX + radius; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          if (dx * dx + dy * dy > radius * radius) continue;
          const idx = (y * width + x) * 4;
          const dr = data[idx] - prev[idx];
          const dg = data[idx + 1] - prev[idx + 1];
          const db = data[idx + 2] - prev[idx + 2];
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          motionSum += dist;
          samples++;
        }
      }
    }

    const motionIntensity = samples ? Math.min(1, motionSum / (samples * 20)) : 0;

    const eyeRow = centerY - Math.floor(radius * 0.3);
    let eyeBrightSum = 0;
    let eyeCount = 0;
    for (let x = centerX - radius * 0.4; x < centerX + radius * 0.4; x++) {
      const idx = (eyeRow * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      eyeBrightSum += lum;
      eyeCount++;
    }
    const eyeOpenness = eyeCount ? Math.min(1, eyeBrightSum / (eyeCount * 255)) : 0.5;

    const isBlink = eyeOpenness < 0.35;
    if (this.lastBlinkState === false && isBlink) {
      this.blinkCount += 1;
    }
    this.lastBlinkState = isBlink;

    const mouthRow = centerY + Math.floor(radius * 0.3);
    let mouthBrightSum = 0;
    let mouthCount = 0;
    for (let x = centerX - radius * 0.3; x < centerX + radius * 0.3; x++) {
      const idx = (mouthRow * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      mouthBrightSum += lum;
      mouthCount++;
    }
    const smile = mouthCount ? Math.min(1, mouthBrightSum / (mouthCount * 255)) : 0.5;

    const browRow = centerY - Math.floor(radius * 0.6);
    let browBright = 0;
    let browCount = 0;
    for (let x = centerX - radius * 0.4; x < centerX + radius * 0.4; x++) {
      const idx = (browRow * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      browBright += lum;
      browCount++;
    }
    const browTension = browCount ? Math.min(1, browBright / (browCount * 255)) : 0.5;

    const headTop = centerY - radius;
    const headBottom = centerY + radius;
    let headMassX = 0;
    let headMassCount = 0;
    for (let y = headTop; y <= headBottom; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy > radius * radius) continue;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        headMassX += lum * x;
        headMassCount += lum;
      }
    }

    let headMovement = 0;
    if (headMassCount > 0) {
      const centerXNorm = headMassX / headMassCount;
      if (this.lastHeadCenter != null) {
        const dxNorm = (centerXNorm - this.lastHeadCenter) / width;
        headMovement = Math.min(1, Math.abs(dxNorm) * 8);
      }
      this.lastHeadCenter = centerXNorm;
    }

    const normFactor = radius || 1;

    this.prevFrame = {
      data: new Uint8ClampedArray(data),
      width,
      height
    };

    return {
      smile,
      eyeOpenness,
      motionIntensity,
      blinkRate: this.blinkCount,
      headMovement,
      browTension,
      normFactor
    };
  }
}

