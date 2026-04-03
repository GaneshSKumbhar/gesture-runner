import './style.css'
import { GestureEngine } from './gesture/GestureEngine.js'
import { GESTURES } from './config.js'

const camVideo = document.getElementById('camVideo')
const camCanvas = document.getElementById('camCanvas')
const gestureFlash = document.getElementById('gestureFlash')
const camStatusText = document.getElementById('camStatus')
const camStatusDot = document.querySelector('.cam-dot')
const serverStatusText = document.getElementById('serverStatusText')
const serverStateDot = document.getElementById('serverStateDot')
const gestureList = document.getElementById('gestureList')

const btnSubway = document.getElementById('btnSubway')
const btnHill = document.getElementById('btnHill')

let activeMode = 'subway' // 'subway' or 'hill'

// --- Mode Switching UI ---
function updateInstructions() {
  if (activeMode === 'subway') {
    gestureList.innerHTML = `
      <li>
        <div class="icon">🖐</div>
        <div class="info"><span class="action">Open Hand (4+ Fingers)</span><span class="key">TAP JUMP (Up)</span></div>
      </li>
      <li>
        <div class="icon">👌</div>
        <div class="info"><span class="action">3 Fingers</span><span class="key">TAP ROLL (Down)</span></div>
      </li>
      <li>
        <div class="icon">☝️</div>
        <div class="info"><span class="action">1 Finger</span><span class="key">TAP LEFT</span></div>
      </li>
      <li>
        <div class="icon">✌️</div>
        <div class="info"><span class="action">2 Fingers</span><span class="key">TAP RIGHT</span></div>
      </li>
      <li style="opacity: 0.6">
        <div class="icon">✊</div>
        <div class="info"><span class="action">Closed Fist</span><span class="key">Neutral (Running)</span></div>
      </li>
    `
  } else {
    gestureList.innerHTML = `
      <li>
        <div class="icon">✌️</div>
        <div class="info"><span class="action">2 Fingers Open</span><span class="key">HOLD GAS (Right Arrow)</span></div>
      </li>
      <li>
        <div class="icon">☝️</div>
        <div class="info"><span class="action">1 Finger Open</span><span class="key">HOLD BRAKE (Left Arrow)</span></div>
      </li>
      <li style="opacity: 0.6">
        <div class="icon">✊</div>
        <div class="info"><span class="action">Fist / Rest</span><span class="key">Release All Pedals</span></div>
      </li>
    `
  }
}

btnSubway.addEventListener('click', () => {
  activeMode = 'subway'
  btnSubway.classList.add('active')
  btnHill.classList.remove('active')
  updateInstructions()
  // Ensure we release any held keys if switching
  if (ws && ws.readyState === WebSocket.OPEN && lastHeldAction) {
    ws.send(JSON.stringify({ type: 'release', action: lastHeldAction }))
    lastHeldAction = null
    gestureFlash.className = 'gesture-flash hidden'
  }
})

btnHill.addEventListener('click', () => {
  activeMode = 'hill'
  btnHill.classList.add('active')
  btnSubway.classList.remove('active')
  updateInstructions()
})

updateInstructions() // Initial load

// --- WebSocket Connection ---
let ws = null
let isConnected = false

function connectWebSocket() {
  serverStatusText.textContent = 'Connecting...'
  serverStateDot.className = 'dot'
  ws = new WebSocket('ws://localhost:8765')
  
  ws.onopen = () => {
    isConnected = true
    serverStatusText.textContent = 'PC Connected'
    serverStateDot.className = 'dot connected'
  }
  ws.onclose = () => {
    isConnected = false
    serverStatusText.textContent = 'Disconnected. Retrying...'
    serverStateDot.className = 'dot'
    setTimeout(connectWebSocket, 3000)
  }
}
connectWebSocket()

function triggerVisualFlash(action) {
  gestureFlash.className = `gesture-flash flash-${action} active`
  gestureFlash.classList.remove('hidden')
}

// --- Gesture Handlers ---
let lastHeldAction = null 

// Engine receives continuous `state` and momentary `action`
const engine = new GestureEngine({
  videoEl: camVideo,
  overlayEl: camCanvas,
  onGesture: (state, actionResponse) => {
    if (!isConnected || ws.readyState !== WebSocket.OPEN) return

    if (activeMode === 'subway') {
      // Subway surfers depends on pulsed 'taps' defined by the HandClassifier cooldown
      if (actionResponse && actionResponse !== 'NEUTRAL') {
        const action = actionResponse.toLowerCase()
        triggerVisualFlash(action)
        ws.send(JSON.stringify({ type: 'tap', action }))
        setTimeout(() => { gestureFlash.className = 'gesture-flash hidden' }, 300)
      }
    } 
    else if (activeMode === 'hill') {
      // Hill climb depends purely on continuous 'state' HOLDing
      let mappedHold = null
      
      // User requested 1 finger = Left (Brake), 2 fingers = Right (Race)
      if (state === GESTURES.LEFT) mappedHold = 'left' // Brake
      else if (state === GESTURES.RIGHT) mappedHold = 'right' // Gas

      // State transition checking
      if (lastHeldAction !== mappedHold) {
        
        // Release whatever we were previously holding
        if (lastHeldAction) {
          ws.send(JSON.stringify({ type: 'release', action: lastHeldAction }))
          gestureFlash.className = 'gesture-flash hidden'
        }
        
        // Hold the new action (if it isn't neutral)
        if (mappedHold) {
          ws.send(JSON.stringify({ type: 'hold', action: mappedHold }))
          triggerVisualFlash(mappedHold)
        }

        lastHeldAction = mappedHold
      }
    }
  },
  onStatus: (text) => {
    camStatusText.textContent = text
  }
})

// Initialize gesture engine on load
async function startApp() {
  try {
    camStatusDot.classList.add('active')
    await engine.init()
  } catch (err) {
    camStatusText.textContent = 'Camera Error'
    camStatusDot.classList.remove('active')
    document.getElementById('camError').classList.remove('hidden')
  }
}

startApp()
