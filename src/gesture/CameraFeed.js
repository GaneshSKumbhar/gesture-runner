// Webcam setup
export class CameraFeed {
  constructor(videoElement) {
    this.video = videoElement;
  }
  
  async init() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      this.video.srcObject = this.stream;
    } catch (err) {
      console.error('Camera access denied', err);
    }
  }
}
