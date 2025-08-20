#!/usr/bin/env python3
"""
Точка входа для pixel-battle приложения

Использует модульную архитектуру с фабрикой приложения
"""

import logging
import sys
import os
from typing import Optional

# Добавляем текущую директорию в Python path для корректных импортов
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.factory import create_app, configure_logging, get_app_info
import config


def setup_environment() -> None:
    """Настройка окружения приложения"""
    # Настройка логирования
    log_level = getattr(config, 'LOG_LEVEL', 'INFO')
    configure_logging(log_level)
    
    logger = logging.getLogger(__name__)
    logger.info("Environment setup completed")
    
    # Выводим информацию о приложении
    app_info = get_app_info()
    logger.info(f"Starting {app_info['name']} v{app_info['version']} with {app_info['architecture']} architecture")


def create_production_app() -> 'Quart':
    """
    Создание приложения для продакшена
    
    Returns:
        Настроенное Quart приложение
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Настройка окружения
        setup_environment()
        
        # Создание приложения
        app = create_app()
        
        logger.info("Production application created successfully")
        return app
        
    except Exception as e:
        logger.error(f"Failed to create production application: {e}")
        raise


def run_development_server() -> None:
    """Запуск сервера разработки"""
    logger = logging.getLogger(__name__)
    
    try:
        # Создаем приложение
        app = create_production_app()
        
        # Параметры запуска из конфигурации
        host = getattr(config, 'HOST', '0.0.0.0')
        port = getattr(config, 'PORT', 5000)
        debug = getattr(config, 'DEBUG', False)
        
        logger.info(f"Starting development server on {host}:{port} (debug={debug})")
        
        # Запускаем сервер
        app.run(
            host=host,
            port=port,
            debug=debug,
            use_reloader=False  # Отключаем reloader для стабильности
        )
        
    except KeyboardInterrupt:
        logger.info("Development server stopped by user")
    except Exception as e:
        logger.error(f"Error running development server: {e}")
        raise


def run_production_server() -> None:
    """Запуск продакшен сервера (через hypercorn)"""
    logger = logging.getLogger(__name__)
    
    try:
        import hypercorn
        from hypercorn.config import Config
        from hypercorn.asyncio import serve
        import asyncio
        
        # Создаем приложение
        app = create_production_app()
        
        # Конфигурация hypercorn
        hypercorn_config = Config()
        hypercorn_config.bind = [f"{config.HOST}:{config.PORT}"]
        hypercorn_config.workers = getattr(config, 'WORKERS', 1)
        hypercorn_config.access_log_target = 'logs/access.log'
        hypercorn_config.error_log_target = 'logs/error.log'
        
        logger.info(f"Starting production server with {hypercorn_config.workers} workers on {hypercorn_config.bind}")
        
        # Запускаем продакшен сервер
        asyncio.run(serve(app, hypercorn_config))
        
    except ImportError:
        logger.warning("Hypercorn not installed, falling back to development server")
        run_development_server()
    except Exception as e:
        logger.error(f"Error running production server: {e}")
        raise


def main() -> int:
    """
    Главная функция приложения
    
    Returns:
        Код возврата (0 - успех, 1 - ошибка)
    """
    try:
        # Определяем режим запуска
        if len(sys.argv) > 1 and sys.argv[1] == 'production':
            run_production_server()
        else:
            run_development_server()
        
        return 0
        
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        return 1


# Создание приложения для WSGI/ASGI серверов
app = None

def get_app() -> 'Quart':
    """
    Получить экземпляр приложения для внешних ASGI серверов
    
    Returns:
        Quart приложение
    """
    global app
    if app is None:
        app = create_production_app()
    return app


if __name__ == '__main__':
    sys.exit(main())


# Для совместимости с uvicorn, gunicorn и другими ASGI серверами
application = get_app()
