"""
Фабрика приложения pixel-battle

Центральный модуль для создания и настройки приложения со всеми компонентами
"""

import logging
from typing import Optional
from quart import Quart

# Импорты компонентов приложения
from app.routes.main import main_bp
from app.routes.api import api_bp
from app.websocket.handlers import handle_websocket
from app.services.broadcast import broadcast_service
from app.services.pixel import create_pixel_service
from app.services.tasks import create_task_service
from app.services.lifecycle import create_lifecycle_service

from database import DatabaseManager
import config

logger = logging.getLogger(__name__)


class ApplicationFactory:
    """Фабрика для создания и настройки приложения"""
    
    def __init__(self):
        self.app: Optional[Quart] = None
        self.db_manager: Optional[DatabaseManager] = None
        self.is_configured = False
    
    def create_app(self, config_override: dict = None) -> Quart:
        """
        Создание и настройка Quart приложения
        
        Args:
            config_override: Дополнительные настройки конфигурации
            
        Returns:
            Настроенное Quart приложение
        """
        logger.info("Creating pixel-battle application...")
        
        # Создаем Quart приложение с правильным путем к шаблонам
        import os
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        template_folder = os.path.join(project_root, 'templates')
        static_folder = os.path.join(project_root, 'static')
        
        self.app = Quart(__name__, 
                        template_folder=template_folder,
                        static_folder=static_folder)
        
        # Применяем override конфигурации если есть
        if config_override:
            self._apply_config_override(config_override)
        
        # Настраиваем компоненты
        self._setup_database()
        self._setup_services()
        self._setup_routes()
        self._setup_websocket()
        self._setup_lifecycle_events()
        self._setup_error_handlers()
        
        # Делаем db_manager доступным глобально для совместимости
        config.db_manager = self.db_manager
        
        self.is_configured = True
        logger.info("Application created and configured successfully")
        
        return self.app
    
    def _apply_config_override(self, config_override: dict) -> None:
        """
        Применение переопределений конфигурации
        
        Args:
            config_override: Словарь с настройками для переопределения
        """
        for key, value in config_override.items():
            if hasattr(config, key.upper()):
                setattr(config, key.upper(), value)
                logger.info(f"Config override applied: {key.upper()} = {value}")
    
    def _setup_database(self) -> None:
        """Настройка базы данных"""
        logger.info("Setting up database...")
        
        # Создаем менеджер базы данных
        db_path = getattr(config, 'DATABASE_URL', 'sqlite+aiosqlite:///canvas.db')
        self.db_manager = DatabaseManager(db_path=db_path)
        
        logger.info("Database manager created")
    
    def _setup_services(self) -> None:
        """Настройка сервисов"""
        logger.info("Setting up services...")
        
        if not self.db_manager:
            raise RuntimeError("Database manager must be set up before services")
        
        # Создаем сервисы
        pixel_service = create_pixel_service(self.db_manager)
        task_service = create_task_service(self.db_manager)
        lifecycle_service = create_lifecycle_service(self.db_manager)
        
        logger.info("Services created: pixel, task, lifecycle, broadcast")
    
    def _setup_routes(self) -> None:
        """Настройка веб-маршрутов"""
        logger.info("Setting up routes...")
        
        # Регистрируем Blueprint'ы
        self.app.register_blueprint(main_bp)
        self.app.register_blueprint(api_bp)
        
        logger.info("Routes registered: main, api")
    
    def _setup_websocket(self) -> None:
        """Настройка WebSocket endpoints"""
        logger.info("Setting up WebSocket...")
        
        # Регистрируем WebSocket endpoint
        @self.app.websocket('/ws')
        async def websocket_endpoint():
            await handle_websocket()
        
        logger.info("WebSocket endpoint registered at /ws")
    
    def _setup_lifecycle_events(self) -> None:
        """Настройка событий жизненного цикла приложения"""
        logger.info("Setting up lifecycle events...")
        
        @self.app.before_serving
        async def before_serving():
            """Событие перед началом обслуживания запросов"""
            from app.services.lifecycle import get_lifecycle_service
            
            lifecycle_service = get_lifecycle_service()
            if lifecycle_service:
                await lifecycle_service.startup()
                logger.info("Application startup completed")
            else:
                logger.error("Lifecycle service not available during startup")
        
        @self.app.after_serving
        async def after_serving():
            """Событие после окончания обслуживания запросов"""
            from app.services.lifecycle import get_lifecycle_service
            
            lifecycle_service = get_lifecycle_service()
            if lifecycle_service:
                await lifecycle_service.graceful_shutdown()
                logger.info("Application shutdown completed")
        
        logger.info("Lifecycle events configured")
    
    def _setup_error_handlers(self) -> None:
        """Настройка обработчиков ошибок"""
        logger.info("Setting up error handlers...")
        
        @self.app.errorhandler(404)
        async def not_found(error):
            """Обработчик 404 ошибок"""
            return "Page not found", 404
        
        @self.app.errorhandler(500)
        async def internal_error(error):
            """Обработчик 500 ошибок"""
            logger.error(f"Internal server error: {error}")
            return "Internal server error", 500
        
        @self.app.errorhandler(Exception)
        async def unhandled_exception(error):
            """Обработчик необработанных исключений"""
            logger.error(f"Unhandled exception: {error}", exc_info=True)
            return "An unexpected error occurred", 500
        
        logger.info("Error handlers configured")
    
    def get_app(self) -> Optional[Quart]:
        """
        Получить созданное приложение
        
        Returns:
            Quart приложение или None если не создано
        """
        return self.app
    
    def get_db_manager(self) -> Optional[DatabaseManager]:
        """
        Получить менеджер базы данных
        
        Returns:
            DatabaseManager или None если не создан
        """
        return self.db_manager
    
    def is_app_configured(self) -> bool:
        """
        Проверить, настроено ли приложение
        
        Returns:
            True если приложение настроено
        """
        return self.is_configured


# Глобальный экземпляр фабрики
app_factory = ApplicationFactory()


def create_app(config_override: dict = None) -> Quart:
    """
    Функция-обертка для создания приложения
    
    Args:
        config_override: Дополнительные настройки конфигурации
        
    Returns:
        Настроенное Quart приложение
    """
    return app_factory.create_app(config_override)


def get_app_factory() -> ApplicationFactory:
    """
    Получить экземпляр фабрики приложения
    
    Returns:
        ApplicationFactory
    """
    return app_factory


# Конфигурационные утилиты
def configure_logging(log_level: str = 'INFO') -> None:
    """
    Настройка системы логирования
    
    Args:
        log_level: Уровень логирования (DEBUG, INFO, WARNING, ERROR)
    """
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('pixel-battle.log', encoding='utf-8')
        ]
    )
    
    # Устанавливаем уровень для основных логгеров
    for logger_name in ['app', 'app.services', 'app.websocket', 'app.routes']:
        logging.getLogger(logger_name).setLevel(getattr(logging, log_level.upper()))
    
    logger.info(f"Logging configured with level: {log_level}")


def get_app_info() -> dict:
    """
    Получить информацию о приложении
    
    Returns:
        Словарь с информацией о приложении
    """
    return {
        'name': 'pixel-battle',
        'version': '2.0.0',
        'architecture': 'modular',
        'components': [
            'routes.main',
            'routes.api', 
            'websocket.handlers',
            'websocket.messages',
            'services.broadcast',
            'services.pixel',
            'services.tasks',
            'services.lifecycle'
        ],
        'factory_configured': app_factory.is_app_configured()
    }
