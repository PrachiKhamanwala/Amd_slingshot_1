// Manages webcam stream lifecycle and basic frame sampling.

export class CameraController {
  constructor() {
    this.stream = null;
    this.video = null;
    this.frameRequestId = null;
  }

  async start() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = this.stream;
    this.video = video;
    await video.play();
  }

  stop() {
    if (this.frameRequestId) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  getFrame(canvas) {
    if (!this.video) return null;
    const ctx = canvas.getContext('2d');
    canvas.width = this.video.videoWidth || 320;
    canvas.height = this.video.videoHeight || 240;
    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

