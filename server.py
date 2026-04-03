import asyncio
import websockets
import pydirectinput
import json

# Disable the fail-safe so gestures near screen edges don't crash the script
pydirectinput.FAILSAFE = False

action_map = {
    'jump': 'up',
    'slide': 'down',
    'left': 'left',
    'right': 'right'
}

# Keep track of keys currently held down to prevent stuck keys and ensure safe release
held_keys = set()

async def release_all():
    if not held_keys: return
    print(f"🛑 Releasing all held keys: {held_keys}")
    for key in list(held_keys):
        pydirectinput.keyUp(key)
        held_keys.remove(key)

async def handle_client(websocket, path=None):
    print("✅ Web UI connected! Ready for multi-game gestures.")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get('type') # 'tap', 'hold', 'release'
                action = data.get('action', '').lower()
                
                if action not in action_map: continue
                key = action_map[action]

                if msg_type == 'tap':
                    print(f"💥 Tap: [{key}]")
                    pydirectinput.press(key)
                elif msg_type == 'hold':
                    if key not in held_keys:
                        print(f"🟢 Holding Down: [{key}]")
                        pydirectinput.keyDown(key)
                        held_keys.add(key)
                elif msg_type == 'release':
                    if key in held_keys:
                        print(f"🔴 Releasing: [{key}]")
                        pydirectinput.keyUp(key)
                        held_keys.remove(key)

            except Exception as e:
                print(f"Error processing message {message}: {e}")
    except websockets.exceptions.ConnectionClosed:
        print("❌ Web UI disconnected. Failsafe triggered: Awaiting reconnect...")
    finally:
        # Failsafe: if browser crashes or disconnects, release gas/brake!
        await release_all()

async def main():
    print("=====================================================")
    print("🏃 Gesture-to-Keyboard Server started (Multi-Game Mode)!")
    print("Listening for continuous gestures on ws://localhost:8765")
    print("=====================================================")
    server = await websockets.serve(handle_client, "localhost", 8765)
    await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        asyncio.run(release_all())
