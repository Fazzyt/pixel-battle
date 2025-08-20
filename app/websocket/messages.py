"""
Обработчик WebSocket сообщений

Содержит логику для парсинга и обработки различных типов сообщений от клиентов
"""

import json
import logging
from typing import Dict, Any, Optional
from app.services.pixel import get_pixel_service
from app.services.broadcast import broadcast_service

logger = logging.getLogger(__name__)


class MessageProcessor:
    """Класс для обработки WebSocket сообщений"""
    
    def __init__(self):
        # Регистрируем обработчики для различных типов сообщений
        self.message_handlers = {
            'pixel_update': self._handle_pixel_update,
            'ping': self._handle_ping,
            'get_stats': self._handle_get_stats,
        }
    
    async def process_message(self, client_id: str, raw_data: str, websocket_conn) -> None:
        """
        Обработка входящего сообщения от клиента
        
        Args:
            client_id: Идентификатор клиента
            raw_data: Сырые данные сообщения (JSON строка)
            websocket_conn: WebSocket соединение для ответа
        """
        try:
            # Парсим JSON
            message = json.loads(raw_data)
            logger.debug(f"Received message from client {client_id}: {message}")
            
            # Валидируем структуру сообщения
            if not self._validate_message_structure(message):
                await self._send_error(websocket_conn, 'Invalid message structure')
                return
            
            message_type = message['type']
            
            # Находим соответствующий обработчик
            handler = self.message_handlers.get(message_type)
            if not handler:
                await self._send_error(websocket_conn, f'Unknown message type: {message_type}')
                return
            
            # Вызываем обработчик
            await handler(client_id, message, websocket_conn)
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode error from client {client_id}: {e}")
            await self._send_error(websocket_conn, 'Invalid JSON format')
        except Exception as e:
            logger.error(f"Error processing message from client {client_id}: {e}")
            await self._send_error(websocket_conn, 'Message processing error')
    
    def _validate_message_structure(self, message: Dict[str, Any]) -> bool:
        """
        Валидация базовой структуры сообщения
        
        Args:
            message: Распарсенное сообщение
            
        Returns:
            True если структура валидна
        """
        return (
            isinstance(message, dict) and 
            'type' in message and 
            isinstance(message['type'], str)
        )
    
    async def _handle_pixel_update(self, client_id: str, message: Dict[str, Any], websocket_conn) -> None:
        """
        Обработка обновления пикселя
        
        Args:
            client_id: Идентификатор клиента
            message: Сообщение с данными пикселя
            websocket_conn: WebSocket соединение
        """
        try:
            # Валидируем и извлекаем данные пикселя
            pixel_data = self._extract_pixel_data(message)
            if not pixel_data:
                await self._send_error(websocket_conn, 'Invalid pixel data')
                return
            
            x, y, color = pixel_data
            
            # Получаем pixel service
            pixel_service = get_pixel_service()
            if not pixel_service:
                await self._send_error(websocket_conn, 'Pixel service unavailable')
                return
            
            # Обрабатываем обновление пикселя
            result = await pixel_service.process_pixel_update(client_id, x, y, color)
            
            if not result['success']:
                # Отправляем ошибку клиенту
                await self._send_error(websocket_conn, result['message'])
                return
            
            # Если пиксель не изменился, не рассылаем обновление
            if not result.get('pixel_changed', False):
                return
            
            # Рассылаем обновление всем клиентам
            sent_count = await broadcast_service.broadcast_pixel_update(x, y, color)
            logger.debug(f"Pixel update broadcasted to {sent_count} clients")
            
        except Exception as e:
            logger.error(f"Error handling pixel update from client {client_id}: {e}")
            await self._send_error(websocket_conn, 'Failed to process pixel update')
    
    def _extract_pixel_data(self, message: Dict[str, Any]) -> Optional[tuple]:
        """
        Извлечение и валидация данных пикселя из сообщения
        
        Args:
            message: Сообщение от клиента
            
        Returns:
            Tuple (x, y, color) или None если данные невалидны
        """
        try:
            x = int(message['x'])
            y = int(message['y'])
            color = str(message['color'])
            return (x, y, color)
        except (ValueError, KeyError, TypeError) as e:
            logger.warning(f"Invalid pixel data extraction: {e}")
            return None
    
    async def _handle_ping(self, client_id: str, message: Dict[str, Any], websocket_conn) -> None:
        """
        Обработка ping сообщений (keep-alive)
        
        Args:
            client_id: Идентификатор клиента
            message: Ping сообщение
            websocket_conn: WebSocket соединение
        """
        try:
            # Отвечаем pong
            pong_response = {
                'type': 'pong',
                'timestamp': message.get('timestamp')
            }
            await websocket_conn.send(json.dumps(pong_response))
            
        except Exception as e:
            logger.error(f"Error handling ping from client {client_id}: {e}")
    
    async def _handle_get_stats(self, client_id: str, message: Dict[str, Any], websocket_conn) -> None:
        """
        Обработка запроса статистики
        
        Args:
            client_id: Идентификатор клиента
            message: Сообщение с запросом статистики
            websocket_conn: WebSocket соединение
        """
        try:
            pixel_service = get_pixel_service()
            if not pixel_service:
                await self._send_error(websocket_conn, 'Pixel service unavailable')
                return
            
            # Получаем статистику
            canvas_stats = pixel_service.get_canvas_stats()
            
            stats_response = {
                'type': 'stats_response',
                'stats': {
                    'canvas': canvas_stats,
                    'connections': {
                        'active': broadcast_service.get_connection_count(),
                        'your_id': client_id
                    }
                }
            }
            
            await websocket_conn.send(json.dumps(stats_response))
            
        except Exception as e:
            logger.error(f"Error handling stats request from client {client_id}: {e}")
            await self._send_error(websocket_conn, 'Failed to get statistics')
    
    async def _send_error(self, websocket_conn, message: str) -> None:
        """
        Отправка сообщения об ошибке клиенту
        
        Args:
            websocket_conn: WebSocket соединение
            message: Текст ошибки
        """
        try:
            error_response = {
                'type': 'error',
                'message': message
            }
            await websocket_conn.send(json.dumps(error_response))
        except Exception as e:
            logger.error(f"Failed to send error message: {e}")
    
    def register_handler(self, message_type: str, handler_func) -> None:
        """
        Регистрация нового обработчика сообщений
        
        Args:
            message_type: Тип сообщения
            handler_func: Функция-обработчик
        """
        self.message_handlers[message_type] = handler_func
        logger.info(f"Registered handler for message type: {message_type}")
    
    def get_supported_message_types(self) -> list:
        """
        Получить список поддерживаемых типов сообщений
        
        Returns:
            Список типов сообщений
        """
        return list(self.message_handlers.keys())


# Для расширяемости можно добавлять новые обработчики
def register_custom_message_handlers(processor: MessageProcessor) -> None:
    """
    Функция для регистрации кастомных обработчиков сообщений
    
    Args:
        processor: Экземпляр MessageProcessor
    """
    # Пример добавления кастомного обработчика:
    # processor.register_handler('custom_type', custom_handler_function)
    pass
