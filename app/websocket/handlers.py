"""
WebSocket обработчики для pixel-battle

Управляет WebSocket соединениями, подключением/отключением клиентов
"""

import asyncio
import json
import time
import logging
from quart import websocket
from app.services.broadcast import broadcast_service
from app.services.pixel import get_pixel_service
from app.websocket.messages import MessageProcessor
import config

logger = logging.getLogger(__name__)


class WebSocketHandler:
    """Класс для управления WebSocket соединениями"""
    
    def __init__(self):
        self.message_processor = MessageProcessor()
        
    async def handle_websocket_connection(self) -> None:
        """
        Основной обработчик WebSocket соединения
        
        Управляет полным жизненным циклом соединения:
        - Подключение и инициализация клиента
        - Обработка входящих сообщений
        - Корректное отключение
        """
        client_id = self._generate_client_id()
        
        try:
            # Инициализируем клиента
            await self._initialize_client(client_id)
            
            # Обрабатываем сообщения в цикле
            await self._handle_message_loop(client_id)
            
        except asyncio.CancelledError:
            logger.info(f"Client {client_id} connection cancelled")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            # Всегда выполняем очистку
            await self._cleanup_client(client_id)
    
    def _generate_client_id(self) -> str:
        """
        Генерирует уникальный идентификатор клиента
        
        Returns:
            Строковый идентификатор клиента
        """
        return f"client_{time.time()}_{id(websocket._get_current_object())}"
    
    async def _initialize_client(self, client_id: str) -> None:
        """
        Инициализация нового клиента
        
        Args:
            client_id: Идентификатор клиента
        """
        # Регистрируем соединение
        broadcast_service.add_connection(websocket._get_current_object())
        config.ONLINE_USER += 1
        
        # Инициализируем в pixel service
        pixel_service = get_pixel_service()
        if pixel_service:
            pixel_service.initialize_client(client_id)
        
        logger.info(f"New client connected. ID: {client_id}, Total users: {config.ONLINE_USER}")
        
        # Отправляем инициализационное сообщение
        await self._send_initialization_message()
        
        # Уведомляем всех о новом пользователе
        await broadcast_service.broadcast_user_count(config.ONLINE_USER)
    
    async def _send_initialization_message(self) -> None:
        """Отправка инициализационного сообщения новому клиенту"""
        try:
            # Получаем текущие активные пиксели (используем кэш для скорости)
            current_pixels = config.canvas.get_active_pixels()
            
            init_message = {
                'type': 'init',
                'pixels': current_pixels,
                'online_users': config.ONLINE_USER,
                'canvas_info': {
                    'width': config.CANVAS_WIDTH,
                    'height': config.CANVAS_HEIGHT,
                    'cooldown_time': config.COOLDOWN_TIME
                }
            }
            
            await websocket.send(json.dumps(init_message))
            logger.debug(f"Sent initialization message with {len(current_pixels)} pixels")
            
        except Exception as e:
            logger.error(f"Error sending initialization message: {e}")
            raise
    
    async def _handle_message_loop(self, client_id: str) -> None:
        """
        Основной цикл обработки сообщений от клиента
        
        Args:
            client_id: Идентификатор клиента
        """
        while True:
            try:
                # Получаем сообщение от клиента
                data = await websocket.receive()
                
                # Обрабатываем сообщение через message processor
                await self.message_processor.process_message(client_id, data, websocket)
                
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON from client {client_id}: {e}")
                await self._send_error_message('Invalid JSON format')
                
            except Exception as e:
                logger.error(f"Unexpected error handling message from {client_id}: {e}")
                await self._send_error_message('Unexpected server error')
                # Продолжаем обработку других сообщений
    
    async def _send_error_message(self, message: str) -> None:
        """
        Отправка сообщения об ошибке клиенту
        
        Args:
            message: Текст ошибки
        """
        try:
            error_response = {
                'type': 'error',
                'message': message
            }
            await websocket.send(json.dumps(error_response))
        except Exception as e:
            logger.error(f"Failed to send error message: {e}")
    
    async def _cleanup_client(self, client_id: str) -> None:
        """
        Очистка ресурсов при отключении клиента
        
        Args:
            client_id: Идентификатор клиента
        """
        try:
            # Удаляем соединение из активных
            connection_removed = broadcast_service.remove_connection(websocket._get_current_object())
            
            if connection_removed:
                config.ONLINE_USER -= 1
                logger.info(f"Client {client_id} disconnected. Total users: {config.ONLINE_USER}")
                
                # Уведомляем остальных клиентов об изменении количества пользователей
                await broadcast_service.broadcast_user_count(config.ONLINE_USER)
            
            # Очищаем данные клиента в pixel service
            pixel_service = get_pixel_service()
            if pixel_service:
                pixel_service.cleanup_client(client_id)
                
        except Exception as e:
            logger.error(f"Error during client cleanup {client_id}: {e}")


# Глобальный обработчик WebSocket
websocket_handler = WebSocketHandler()


async def handle_websocket() -> None:
    """
    Функция-обертка для обработки WebSocket соединений
    
    Используется в Blueprint регистрации
    """
    await websocket_handler.handle_websocket_connection()
