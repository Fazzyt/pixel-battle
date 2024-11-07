from quart import Quart, websocket, render_template
import asyncio
import json
import time
from datetime import datetime
import logging

import config

# Импорт менеджера базы данных
from database import DatabaseManager

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Quart(__name__)

# Инициализация менеджера базы данных
db_manager = DatabaseManager()

# Initialize canvas and user data
canvas = [[{"color": "#FFFFFF", "last_update": 0} for _ in range(config.CANVAS_WIDTH)] for _ in range(config.CANVAS_HEIGHT)]
active_connections = set()
user_last_pixel = {}
online_users = 0

# Optimization settings
BATCH_SIZE = 100
canvas_updates = []
last_broadcast_time = time.time()

@app.route('/')
async def index():
    """Render main page"""
    return await render_template('index.html')

@app.websocket('/ws')
async def ws():
    """WebSocket connection handler"""
    global online_users
    
    # Генерация уникального идентификатора клиента
    client_id = str(time.time())
    user_last_pixel[client_id] = 0
    active_connections.add(websocket._get_current_object())
    online_users += 1
    
    logger.info(f"New client connected. ID: {client_id}, Total users: {online_users}")
    
    try:
        # Prepare current canvas state
        current_pixels = []
        for y in range(config.CANVAS_HEIGHT):
            for x in range(config.CANVAS_WIDTH):
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
                
                # Cooldown check
                if current_time - user_last_pixel[client_id] < config.COOLDOWN_TIME:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': f'Wait {config.COOLDOWN_TIME} seconds between pixels'
                    }))
                    continue

                x, y, color = message['x'], message['y'], message['color']
                
                # Validate coordinates
                if 0 <= x < config.CANVAS_WIDTH and 0 <= y < config.CANVAS_HEIGHT:
                    # Update canvas
                    canvas[y][x] = {"color": color, "last_update": current_time}
                    user_last_pixel[client_id] = current_time
                    
                    # Prepare update message
                    update = {
                        'type': 'pixel_update',
                        'x': x,
                        'y': y,
                        'color': color
                    }
                    
                    # Broadcast update and save to database
                    logger.debug(f"Broadcasting pixel update: {update}")
                    await broadcast(json.dumps(update))
                    
                    await db_manager.save_pixel(x, y, color, current_time)
                else:
                    logger.warning(f"Invalid pixel coordinates: x={x}, y={y}")

    except asyncio.CancelledError:
        logger.info(f"Client {client_id} connection cancelled")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        # Cleanup on disconnect
        active_connections.remove(websocket._get_current_object())
        online_users -= 1
        logger.info(f"Client {client_id} disconnected. Total users: {online_users}")
        await broadcast(json.dumps({
            'type': 'user_count',
            'count': online_users
        }))

async def broadcast(message):
    """Broadcast message to all active connections"""
    for connection in active_connections:
        try:
            await connection.send(message)
        except Exception as e:
            logger.error(f"Broadcast error: {e}")

@app.before_serving
async def startup():
    """Startup tasks"""
    # Initialize database
    await db_manager.init_db()
    
    # Load saved canvas
    saved_pixels = await db_manager.load_canvas()
    for pixel in saved_pixels:
        canvas[pixel['y']][pixel['x']] = {
            'color': pixel['color'], 
            'last_update': pixel.get('last_update', 0)
        }
    
    # Start periodic canvas save
    asyncio.create_task(db_manager.periodic_save(canvas))

async def background_tasks():
    """Additional background tasks"""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        logger.info(f"Background task: Online users {online_users}")


@app.before_serving
async def start_background_tasks():
    """Start all background tasks"""
    asyncio.create_task(background_tasks())

if __name__ == '__main__':
    # Run the Quart app
    app.run(
        host="0.0.0.0", 
        port=5000, 
        debug=True
    )