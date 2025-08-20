"""
Сервис для работы с пикселями

Содержит бизнес-логику обработки пикселей, валидации и cooldown
"""

import time
import logging
from typing import Optional, Dict, Any
import config
from database import DatabaseManager

logger = logging.getLogger(__name__)


class PixelService:
    """Сервис для управления операциями с пикселями"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.canvas = config.canvas
        self.user_last_pixel = config.USER_LAST_PIXEL
        self.cooldown_time = config.COOLDOWN_TIME
        self.colors = config.colors
        
    def validate_coordinates(self, x: int, y: int) -> bool:
        """
        Валидация координат пикселя
        
        Args:
            x: X координата
            y: Y координата
            
        Returns:
            True если координаты валидны
        """
        return (0 <= x < config.CANVAS_WIDTH and 
                0 <= y < config.CANVAS_HEIGHT)
    
    def validate_color(self, color: str) -> bool:
        """
        Валидация цвета пикселя
        
        Args:
            color: Цвет в формате hex
            
        Returns:
            True если цвет валиден
        """
        return color in self.colors if self.colors else True
    
    def check_cooldown(self, client_id: str, current_time: Optional[float] = None) -> bool:
        """
        Проверка cooldown для клиента
        
        Args:
            client_id: Идентификатор клиента
            current_time: Текущее время (опционально)
            
        Returns:
            True если cooldown прошел, False если нужно ждать
        """
        if current_time is None:
            current_time = time.time()
            
        last_pixel_time = self.user_last_pixel.get(client_id, 0)
        return current_time - last_pixel_time >= self.cooldown_time
    
    def get_remaining_cooldown(self, client_id: str, current_time: Optional[float] = None) -> float:
        """
        Получить оставшееся время cooldown
        
        Args:
            client_id: Идентификатор клиента
            current_time: Текущее время (опционально)
            
        Returns:
            Оставшееся время в секундах (0 если cooldown прошел)
        """
        if current_time is None:
            current_time = time.time()
            
        last_pixel_time = self.user_last_pixel.get(client_id, 0)
        remaining = self.cooldown_time - (current_time - last_pixel_time)
        return max(0, remaining)
    
    async def process_pixel_update(
        self, 
        client_id: str, 
        x: int, 
        y: int, 
        color: str,
        current_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Обрабатывает обновление пикселя со всеми проверками
        
        Args:
            client_id: Идентификатор клиента
            x: X координата
            y: Y координата
            color: Цвет пикселя
            current_time: Текущее время (опционально)
            
        Returns:
            Словарь с результатом операции:
            {
                'success': bool,
                'error': str (если success=False),
                'pixel_changed': bool (если success=True),
                'message': str
            }
        """
        if current_time is None:
            current_time = time.time()
        
        # Проверка cooldown
        if not self.check_cooldown(client_id, current_time):
            remaining = self.get_remaining_cooldown(client_id, current_time)
            return {
                'success': False,
                'error': 'cooldown',
                'message': f'Wait {remaining:.1f} seconds between pixels'
            }
        
        # Валидация координат
        if not self.validate_coordinates(x, y):
            return {
                'success': False,
                'error': 'invalid_coordinates',
                'message': 'Invalid pixel coordinates'
            }
        
        # Валидация цвета
        if not self.validate_color(color):
            return {
                'success': False,
                'error': 'invalid_color',
                'message': 'Invalid pixel color'
            }
        
        # Обновление пикселя
        pixel_changed = self.canvas.set_pixel(x, y, color, current_time)
        
        if not pixel_changed:
            return {
                'success': True,
                'pixel_changed': False,
                'message': 'Pixel already has this color'
            }
        
        # Обновление времени последнего пикселя для клиента
        self.user_last_pixel[client_id] = current_time
        
        # Асинхронное сохранение в базу данных
        try:
            await self.db_manager.save_pixel(x, y, color, current_time)
        except Exception as e:
            logger.error(f"Failed to save pixel to database: {e}")
            # Не возвращаем ошибку, так как пиксель уже обновлен в памяти
        
        return {
            'success': True,
            'pixel_changed': True,
            'message': 'Pixel updated successfully'
        }
    
    def get_active_pixels(self) -> list:
        """Получить список всех активных пикселей"""
        return self.canvas.get_active_pixels()
    
    def get_pixel_info(self, x: int, y: int) -> Dict[str, Any]:
        """
        Получить информацию о пикселе
        
        Args:
            x: X координата
            y: Y координата
            
        Returns:
            Информация о пикселе
        """
        if not self.validate_coordinates(x, y):
            return {'error': 'Invalid coordinates'}
            
        pixel_data = self.canvas.get_pixel(x, y)
        return {
            'x': x,
            'y': y,
            'color': pixel_data['color'],
            'last_update': pixel_data['last_update']
        }
    
    def get_canvas_stats(self) -> Dict[str, Any]:
        """Получить статистику холста"""
        return {
            'canvas_size': f"{config.CANVAS_WIDTH}x{config.CANVAS_HEIGHT}",
            'active_pixels': self.canvas.get_pixels_count(),
            'memory_usage': self.canvas.get_memory_usage(),
            'total_colors': len(self.colors) if self.colors else 0
        }
    
    def initialize_client(self, client_id: str) -> None:
        """Инициализация нового клиента"""
        self.user_last_pixel[client_id] = 0
        logger.debug(f"Initialized client {client_id}")
        
    def cleanup_client(self, client_id: str) -> None:
        """Очистка данных клиента при отключении"""
        self.user_last_pixel.pop(client_id, None)
        logger.debug(f"Cleaned up client {client_id}")


# Создание экземпляра будет в factory функции
pixel_service = None


def create_pixel_service(db_manager: DatabaseManager) -> PixelService:
    """Создать экземпляр PixelService"""
    global pixel_service
    pixel_service = PixelService(db_manager)
    return pixel_service


def get_pixel_service() -> Optional[PixelService]:
    """Получить текущий экземпляр PixelService"""
    return pixel_service
