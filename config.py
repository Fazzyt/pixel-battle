import json
import logging
import time
from dataclasses import MISSING, dataclass, fields
from typing import Dict, Set, List, Optional, Tuple

_DEFAULT_CONFIG_PATH = "config.json"  # Default config file
logger = logging.getLogger(__name__)

@dataclass
class Config:
    # Основные настройки сервера
    host: str = "0.0.0.0"
    port: int = 80
    debug: bool = False

    # Настройки холста
    canvas_width: int = 2000
    canvas_height: int = 600
    cooldown_time: int = 60 # Время перезарядки в секундах
    pixel_size: int = 1 # Размер каждого пикселя на холсте

    colors: list = None

    def __init__(self, config_file_path=_DEFAULT_CONFIG_PATH) -> None:
        try:
            with open(config_file_path, "r") as config_file:
                config_content = json.load(config_file)
        except FileNotFoundError:
            logger.warning(f"{config_file_path} does not exist! Using default settings.")
            config_content = {}
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in {config_file_path}. Using default settings.")
            config_content = {}

        for field in fields(self):
            val = config_content.get(field.name, getattr(self, field.name, field.default))
            setattr(self, field.name, val)

config = Config()

# Для обратной совместимости с существующим кодом
HOST = config.host
PORT = config.port
DEBUG = config.debug
CANVAS_WIDTH = config.canvas_width
CANVAS_HEIGHT = config.canvas_height
COOLDOWN_TIME = config.cooldown_time
PIXEL_SIZE = config.pixel_size
colors = config.colors

class OptimizedCanvas:
    """Оптимизированное хранение холста с кэшированием активных пикселей"""
    
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.default_color = "#FFFFFF"
        
        # Словарь только для измененных пикселей: (x, y) -> {"color": str, "last_update": float}
        self.pixels: Dict[Tuple[int, int], Dict] = {}
        
        # Кэш активных (не белых) пикселей для быстрой отправки новым клиентам
        self._active_pixels_cache: Optional[List[Dict]] = None
        self._cache_dirty = False
        
        # Статистика для оптимизации
        self.total_pixels_set = 0
        self.cache_hits = 0
        self.cache_misses = 0
        
    def set_pixel(self, x: int, y: int, color: str, last_update: float = None) -> bool:
        """Установить пиксель. Возвращает True если пиксель изменился"""
        if not (0 <= x < self.width and 0 <= y < self.height):
            return False
            
        coord = (x, y)
        if last_update is None:
            last_update = time.time()
            
        old_color = self.get_pixel_color(x, y)
        
        if color == self.default_color:
            # Если устанавливаем белый цвет, удаляем из словаря
            if coord in self.pixels:
                del self.pixels[coord]
                self._cache_dirty = True
                return True
        else:
            # Сохраняем только не белые пиксели
            pixel_data = {"color": color, "last_update": last_update}
            self.pixels[coord] = pixel_data
            self._cache_dirty = True
            self.total_pixels_set += 1
            
        return old_color != color
        
    def get_pixel(self, x: int, y: int) -> Dict:
        """Получить данные пикселя"""
        if not (0 <= x < self.width and 0 <= y < self.height):
            return {"color": self.default_color, "last_update": 0}
            
        coord = (x, y)
        return self.pixels.get(coord, {"color": self.default_color, "last_update": 0})
        
    def get_pixel_color(self, x: int, y: int) -> str:
        """Получить только цвет пикселя"""
        return self.get_pixel(x, y)["color"]
        
    def get_active_pixels(self, force_rebuild: bool = False) -> List[Dict]:
        """Получить список всех активных (не белых) пикселей с кэшированием"""
        if self._active_pixels_cache is None or self._cache_dirty or force_rebuild:
            self._rebuild_cache()
            self.cache_misses += 1
        else:
            self.cache_hits += 1
            
        return self._active_pixels_cache.copy()
        
    def _rebuild_cache(self):
        """Перестроить кэш активных пикселей"""
        self._active_pixels_cache = [
            {
                'x': coord[0],
                'y': coord[1],
                'color': data['color']
            }
            for coord, data in self.pixels.items()
        ]
        self._cache_dirty = False
        
    def get_pixels_count(self) -> int:
        """Получить количество активных пикселей"""
        return len(self.pixels)
        
    def get_memory_usage(self) -> Dict[str, int]:
        """Получить статистику использования памяти"""
        return {
            "active_pixels": len(self.pixels),
            "total_possible": self.width * self.height,
            "memory_efficiency": len(self.pixels) / (self.width * self.height) * 100,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses
        }
        
    def bulk_load_pixels(self, pixels_data: List[Dict]):
        """Массовая загрузка пикселей из базы данных"""
        for pixel in pixels_data:
            coord = (pixel['x'], pixel['y'])
            if pixel['color'] != self.default_color:
                self.pixels[coord] = {
                    'color': pixel['color'],
                    'last_update': pixel.get('last_update', 0)
                }
        self._cache_dirty = True

# Создаем оптимизированный холст
canvas = OptimizedCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)

# Остальные глобальные переменные
ACTIVE_CONNECTIONS = set()
USER_LAST_PIXEL = {}
ONLINE_USER = 0

# Настройки батчевых операций
BATCH_SIZE = 100
BATCH_TIMEOUT = 1.0  # секунды
CANVAS_UPDATE_QUEUE = []
LAST_BATCH_TIME = time.time()