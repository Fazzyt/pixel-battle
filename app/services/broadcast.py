"""
Сервис для рассылки сообщений всем подключенным клиентам

Обеспечивает надежную доставку сообщений с обработкой ошибок
"""

import logging
from typing import Set
import config

logger = logging.getLogger(__name__)


class BroadcastService:
    """Сервис для управления рассылкой сообщений"""
    
    def __init__(self):
        self.active_connections: Set = config.ACTIVE_CONNECTIONS
        
    async def broadcast_to_all(self, message: str) -> int:
        """
        Рассылает сообщение всем активным соединениям
        
        Args:
            message: JSON строка для отправки
            
        Returns:
            Количество успешных отправок
        """
        successful_sends = 0
        failed_connections = set()
        
        # Создаем копию для безопасности при итерации
        connections_copy = self.active_connections.copy()
        
        for connection in connections_copy:
            try:
                await connection.send(message)
                successful_sends += 1
            except Exception as e:
                logger.error(f"Broadcast error to connection: {e}")
                # Помечаем проблемное соединение для удаления
                failed_connections.add(connection)
        
        # Удаляем неисправные соединения
        for failed_conn in failed_connections:
            self.active_connections.discard(failed_conn)
            
        if failed_connections:
            logger.warning(f"Removed {len(failed_connections)} failed connections")
            
        logger.debug(f"Broadcast sent to {successful_sends} clients")
        return successful_sends
    
    async def broadcast_pixel_update(self, x: int, y: int, color: str) -> int:
        """
        Рассылает обновление пикселя всем клиентам
        
        Args:
            x: X координата пикселя
            y: Y координата пикселя  
            color: Цвет пикселя
            
        Returns:
            Количество успешных отправок
        """
        import json
        
        update_message = json.dumps({
            'type': 'pixel_update',
            'x': x,
            'y': y,
            'color': color
        })
        
        return await self.broadcast_to_all(update_message)
    
    async def broadcast_user_count(self, count: int) -> int:
        """
        Рассылает обновление количества пользователей
        
        Args:
            count: Текущее количество пользователей онлайн
            
        Returns:
            Количество успешных отправок
        """
        import json
        
        count_message = json.dumps({
            'type': 'user_count',
            'count': count
        })
        
        return await self.broadcast_to_all(count_message)
    
    def get_connection_count(self) -> int:
        """Возвращает количество активных соединений"""
        return len(self.active_connections)
    
    def add_connection(self, connection) -> None:
        """Добавляет новое соединение"""
        self.active_connections.add(connection)
        logger.debug(f"Added connection. Total: {len(self.active_connections)}")
    
    def remove_connection(self, connection) -> bool:
        """
        Удаляет соединение
        
        Returns:
            True если соединение было удалено, False если его не было
        """
        try:
            self.active_connections.remove(connection)
            logger.debug(f"Removed connection. Total: {len(self.active_connections)}")
            return True
        except KeyError:
            logger.warning("Attempted to remove connection that wasn't in active set")
            return False


# Глобальный экземпляр сервиса
broadcast_service = BroadcastService()
