// ============================================
// GestureEngine.js — MediaPipe Hands wrapper
// ============================================
import { HandClassifier } from './HandClassifier.js'
import { GESTURE_ICONS, GESTURE_LABELS } from '../config.js'

export class GestureEngine {
  constructor({ videoEl, overlayEl, onGesture, onStatus }) {
    this.video = videoEl
    this.overlay = overlayEl
    this.onGesture = onGesture   // (gesture, action) => void
    this.onStatus = onStatus     // (statusText) => void

    this.classifier = new HandClassifier()
    this.running = false
    this.handsModel = null
    this.camera = null
    this.overlayCtx = this.overlay ? this.overlay.getContext('2d') : null
  }

  async init() {
    this.onStatus?.('Requesting camera...')

    // Camera access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      this.video.srcObject = stream
      await this.video.play()
    } catch (err) {
      this.onStatus?.('Camera denied — use keyboard mode')
      throw new Error('Camera access denied: ' + err.message)
    }

    this.onStatus?.('Loading gesture model...')

    // Load MediaPipe Hands
    try {
      await this._loadMediaPipe()
    } catch (err) {
      this.onStatus?.('Gesture model unavailable — use keyboard mode')
      throw new Error('MediaPipe load failed: ' + err.message)
    }

    this.running = true
    this.onStatus?.('Ready ✓')
  }

  async _loadMediaPipe() {
    // Dynamically import MediaPipe (CDN loaded via index.html or inline)
    return new Promise((resolve, reject) => {
      const check = () => {
        if (typeof window.Hands !== 'undefined' && typeof window.Camera !== 'undefined') {
          this._setupModel()
          resolve()
        } else {
          reject(new Error('MediaPipe Hands not loaded'))
        }
      }

      // Small delay to allow CDN scripts to execute
      if (typeof window.Hands !== 'undefined') {
        check()
      } else {
        // Load from CDN dynamically
        const s1 = document.createElement('script')
        s1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
        s1.crossOrigin = 'anonymous'
        s1.onload = () => {
          const s2 = document.createElement('script')
          s2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
          s2.crossOrigin = 'anonymous'
          s2.onload = () => setTimeout(() => check(), 200)
          s2.onerror = reject
          document.head.appendChild(s2)
        }
        s1.onerror = reject
        document.head.appendChild(s1)
      }
    })
  }

  _setupModel() {
    this.handsModel = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    })

    this.handsModel.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,          // 0 = lite (faster), 1 = full
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    })

    this.handsModel.onResults((results) => this._onResults(results))

    // Start camera loop
    this.camera = new window.Camera(this.video, {
      onFrame: async () => {
        if (this.running) {
          await this.handsModel.send({ image: this.video })
        }
      },
      width: 640,
      height: 480,
    })
    this.camera.start()
  }

  _onResults(results) {
    // Clear overlay
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height)
    }

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.onGesture?.('NEUTRAL', null)
      this.onStatus?.('No hand detected')
      return
    }

    const landmarks = results.multiHandLandmarks[0]

    // Draw skeleton on overlay
    if (this.overlayCtx) {
      this._drawSkeleton(landmarks)
    }

    // Classify gesture
    const { state, action } = this.classifier.process(landmarks)
    const icon = GESTURE_ICONS[state] || '🖐'
    const label = GESTURE_LABELS[state] || state
    this.onStatus?.(`${icon} ${label}`)
    this.onGesture?.(state, action)
  }

  _drawSkeleton(lm) {
    const ctx = this.overlayCtx
    const W = this.overlay.width, H = this.overlay.height

    // Connections
    const connections = [
      [0,1],[1,2],[2,3],[3,4],       // thumb
      [0,5],[5,6],[6,7],[7,8],       // index
      [0,9],[9,10],[10,11],[11,12],  // middle
      [0,13],[13,14],[14,15],[15,16],// ring
      [0,17],[17,18],[18,19],[19,20],// pinky
      [5,9],[9,13],[13,17]           // palm
    ]

    ctx.strokeStyle = '#378ADD'
    ctx.lineWidth = 1.5
    connections.forEach(([a, b]) => {
      ctx.beginPath()
      ctx.moveTo(lm[a].x * W, lm[a].y * H)
      ctx.lineTo(lm[b].x * W, lm[b].y * H)
      ctx.stroke()
    })

    // Landmark dots
    lm.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#f0a500' : (i % 4 === 0 ? '#e24b4a' : '#79b8ff')
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, i === 0 ? 5 : 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  stop() {
    this.running = false
    this.camera?.stop()
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop())
    }
  }
}

