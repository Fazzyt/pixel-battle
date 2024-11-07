from quart import Quart, websocket, render_template
import asyncio
import json
import time
from datetime import datetime
import logging

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Quart(__name__)

# Canvas settings
CANVAS_WIDTH = 1600
CANVAS_HEIGHT = 400
COOLDOWN_TIME = 60  # Cooldown time in seconds

# Initialize canvas and user data
canvas = [[{"color": "#FFFFFF", "last_update": 0} for _ in range(CANVAS_WIDTH)] for _ in range(CANVAS_HEIGHT)]
active_connections = set()
user_last_pixel = {}
online_users = 0

# Optimization settings
BATCH_SIZE = 100
canvas_updates = []
last_broadcast_time = time.time()

@app.route('/')
async def index():
    return await render_template('index.html')

@app.websocket('/ws')
async def ws():
    global online_users
    client_id = str(time.time())
    user_last_pixel[client_id] = 0
    active_connections.add(websocket._get_current_object())
    online_users += 1
    
    logger.info(f"New client connected. ID: {client_id}, Total users: {online_users}")
    
    try:
        # Prepare current canvas state
        current_pixels = []
        for y in range(CANVAS_HEIGHT):
            for x in range(CANVAS_WIDTH):
                if canvas[y][x]['color'] != "#FFFFFF":
                    current_pixels.append({
                        'x': x,
                        'y': y,
                        'color': canvas[y][x]['color']
                    })

        # Send initial state
        await websocket.send(json.dumps({
            'type': 'init',
            'pixels': current_pixels,
            'online_users': online_users
        }))
        
        # Notify all users about new user
        await broadcast(json.dumps({
            'type': 'user_count',
            'count': online_users
        }))

        while True:
            data = await websocket.receive()
            message = json.loads(data)
            logger.debug(f"Received message from client {client_id}: {message}")
            
            if message['type'] == 'pixel_update':
                current_time = time.time()
                if current_time - user_last_pixel[client_id] < COOLDOWN_TIME:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': f'Wait {COOLDOWN_TIME} seconds between pixels'
                    }))
                    continue

                x, y, color = message['x'], message['y'], message['color']
                if 0 <= x < CANVAS_WIDTH and 0 <= y < CANVAS_HEIGHT:
                    canvas[y][x] = {"color": color, "last_update": current_time}
                    user_last_pixel[client_id] = current_time
                    
                    update = {
                        'type': 'pixel_update',
                        'x': x,
                        'y': y,
                        'color': color
                    }
                    
                    logger.debug(f"Broadcasting pixel update: {update}")
                    await broadcast(json.dumps(update))
                else:
                    logger.warning(f"Invalid pixel coordinates: x={x}, y={y}")

    except asyncio.CancelledError:
        logger.info(f"Client {client_id} connection cancelled")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: { e}")
    finally:
        active_connections.remove(websocket._get_current_object())
        online_users -= 1
        logger.info(f"Client {client_id} disconnected. Total users: {online_users}")
        await broadcast(json.dumps({
            'type': 'user_count',
            'count': online_users
        }))

async def broadcast(message):
    for connection in active_connections:
        await connection.send(message)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)