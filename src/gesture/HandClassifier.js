import { GESTURES } from '../config.js'

export class HandClassifier {
  constructor() {
    this.cooldown = 0
    this.cooldownFrames = 8
    
    // We add a short history buffer so "transitional" frames (like 1 finger popping up before the 2nd) are ignored.
    this.gestureBuffer = []
    this.requiredStableFrames = 3 // A gesture must be consistently detected for 3 frames to become active
    
    this.currentState = GESTURES.NEUTRAL // The continuous stable state of the hand
  }

  process(landmarks) {
    if (this.cooldown > 0) this.cooldown--;

    if (!landmarks || landmarks.length < 21) {
      this._updateState(GESTURES.NEUTRAL)
      return { state: this.currentState, action: null }
    }

    const isUp = (tipIdx, mcpIdx) => {
      return landmarks[tipIdx].y < landmarks[mcpIdx].y - 0.015
    }

    const indexUp = isUp(8, 5)
    const middleUp = isUp(12, 9)
    const ringUp = isUp(16, 13)
    const pinkyUp = isUp(20, 17)

    let upCount = 0
    if (indexUp) upCount++
    if (middleUp) upCount++
    if (ringUp) upCount++
    if (pinkyUp) upCount++

    let rawDetection = GESTURES.NEUTRAL

    if (upCount === 0) {
      rawDetection = GESTURES.NEUTRAL
    } else if (upCount >= 4) {
      rawDetection = GESTURES.JUMP // Open Palm
    } else if (upCount === 3) {
      rawDetection = GESTURES.SLIDE 
    } else if (upCount === 2 && indexUp && middleUp) {
      rawDetection = GESTURES.RIGHT // Only triggers if explicitly 2
    } else if (upCount === 1 && indexUp) {
      rawDetection = GESTURES.LEFT  // Only triggers if explicitly 1
    }

    // Attempt to stabilize the raw detection
    this._updateState(rawDetection)

    // For Subway Surfers (pulse action)
    let action = null
    if (this.currentState !== GESTURES.NEUTRAL && this.cooldown === 0) {
      action = this.currentState
      this.cooldown = this.cooldownFrames
    }

    // Return continuous state (for Hill Climb holding) and pulse action (for Subway Surfers)
    return { state: this.currentState, action: action }
  }

  _updateState(raw) {
    this.gestureBuffer.push(raw)
    if (this.gestureBuffer.length > this.requiredStableFrames) {
      this.gestureBuffer.shift()
    }
    
    // Check if all recent frames are identical
    const isStable = this.gestureBuffer.length === this.requiredStableFrames && 
                     this.gestureBuffer.every(g => g === raw)
                     
    if (isStable) {
      this.currentState = raw
    }
  }

  reset() {
    this.cooldown = 0
    this.gestureBuffer = []
    this.currentState = GESTURES.NEUTRAL
  }
}
