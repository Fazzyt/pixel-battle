import json
import logging
from dataclasses import MISSING, dataclass, fields

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

# Создаем холст
canvas = [[{"color": "#FFFFFF", "last_update": 0} for _ in range(CANVAS_WIDTH)] for _ in range(CANVAS_HEIGHT)]
ACTIVE_CONNECTIONS = set()
USER_LAST_PIXEL = {}
ONLINE_USER = 0

BATCH_SIZE = 100
CANVAS_UPDATE = []