import asyncio
import json
import time
import logging

from quart import Quart, websocket, render_template
from datetime import datetime

import config as config

from database import DatabaseManager

logger = logging.getLogger(__name__)

app = Quart(__name__)

db_manager = DatabaseManager()

@app.route('/')
async def index():
    return await render_template(
        'index.html', 
        colors = config.colors,
        canvas_width = config.CANVAS_WIDTH,
        canvas_height = config.CANVAS_HEIGHT,
        pixel_size = config.PIXEL_SIZE,
        cooldown_time = config.COOLDOWN_TIME
        )



@app.websocket('/ws')
async def ws():
    
    # Генерация уникального идентификатора клиента
    client_id = str(time.time())
    config.USER_LAST_PIXEL[client_id] = 0
    config.ACTIVE_CONNECTIONS.add(websocket._get_current_object())
    config.ONLINE_USER += 1
    
    logger.info(f"New client connected. ID: {client_id}, Total users: {config.ONLINE_USER}")
    
    try:
        current_pixels = []
        for y in range(config.CANVAS_HEIGHT):
            for x in range(config.CANVAS_WIDTH):
                if config.canvas[y][x]['color'] != "#FFFFFF":
                    current_pixels.append({
                        'x': x,
                        'y': y,
                        'color': config.canvas[y][x]['color']
                    })

        await websocket.send(json.dumps({
            'type': 'init',
            'pixels': current_pixels,
            'online_users': config.ONLINE_USER
        }))
        
        await broadcast(json.dumps({
            'type': 'user_count',
            'count': config.ONLINE_USER
        }))

        while True:
            try:
                data = await websocket.receive()
                message = json.loads(data)
                logger.debug(f"Received message from client {client_id}: {message}")
                
                if message['type'] == 'pixel_update':
                    current_time = time.time()
                    
                    # Cooldown check
                    if current_time - config.USER_LAST_PIXEL[client_id] < config.COOLDOWN_TIME:
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': f'Wait {config.COOLDOWN_TIME} seconds between pixels'
                        }))
                        continue

                    # Validate input data types
                    try:
                        x = int(message['x'])
                        y = int(message['y'])
                        color = str(message['color'])
                    except (ValueError, KeyError) as e:
                        logger.warning(f"Invalid input data: {e}")
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Invalid pixel data'
                        }))
                        continue

                    # Validate coordinates with strict bounds checking
                    if (0 <= x < config.CANVAS_WIDTH and 
                        0 <= y < config.CANVAS_HEIGHT and
                        color in config.colors):  # Дополнительная проверка цвета
                        
                        # Update canvas
                        config.canvas[y][x] = {
                            "color": color, 
                            "last_update": current_time
                        }
                        config.USER_LAST_PIXEL[client_id] = current_time
                        
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
                        # Логируем попытку установить пиксель с некорректными данными
                        logger.warning(
                            f"Invalid pixel data from client {client_id}: "
                            f"x={x}, y={y}, color={color}"
                        )
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Invalid pixel coordinates or color'
                        }))

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from client {client_id}")
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': 'Invalid JSON format'
                }))
            except Exception as e:
                logger.error(f"Unexpected error handling message: {e}")
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': 'Unexpected server error'
                }))

    except asyncio.CancelledError:
        logger.info(f"Client {client_id} connection cancelled")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        # Cleanup on disconnect
        clean_up(client_id= client_id)
        

async def broadcast(message):
    for connection in config.ACTIVE_CONNECTIONS.copy():  # Создаем копию для безопасности
        try:
            await connection.send(message)
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            # Удаляем проблемное соединение
            config.ACTIVE_CONNECTIONS.discard(connection)

async def clean_up( client_id: int):

    config.ACTIVE_CONNECTIONS.remove(websocket._get_current_object())

    config.ONLINE_USER -= 1
    logger.info(f"Client {client_id} disconnected. Total users: {config.ONLINE_USER}")
    return await broadcast( json.dumps({
                        'type': 'user_count',
                        'count': config.ONLINE_USER
                        }))

@app.before_serving
async def startup():
    await db_manager.init_db()
    
    saved_pixels = await db_manager.load_canvas()
    for pixel in saved_pixels:
        config.canvas[pixel['y']][pixel['x']] = {
            'color': pixel['color'], 
            'last_update': pixel.get('last_update', 0)
        }

if __name__ == '__main__':
    # Run the Quart app
    app.run(
        host= config.HOST, 
        port= config.PORT, 
        debug= config.DEBUG,
    )