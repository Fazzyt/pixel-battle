"""
Основные веб-маршруты приложения

Содержит главную страницу и базовые endpoints
"""

import logging
from quart import Blueprint, render_template
import config

logger = logging.getLogger(__name__)

# Создаем Blueprint для основных маршрутов
main_bp = Blueprint('main', __name__)


@main_bp.route('/')
async def index():
    """
    Главная страница приложения
    
    Отрисовывает HTML шаблон с передачей конфигурации холста
    """
    try:
        import time
        return await render_template(
            'index_modern.html', 
            colors=config.colors,
            canvas_width=config.CANVAS_WIDTH,
            canvas_height=config.CANVAS_HEIGHT,
            pixel_size=config.PIXEL_SIZE,
            cooldown_time=config.COOLDOWN_TIME,
            build_timestamp=int(time.time()),
            debug=config.DEBUG
        )
    except Exception as e:
        import traceback
        logger.error(f"Error rendering index page: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return f"Template Error: {str(e)}", 500


@main_bp.route('/test')
async def test_page():
    """
    Тестовая страница для диагностики
    """
    try:
        import time
        return await render_template(
            'test.html', 
            colors=config.colors,
            canvas_width=config.CANVAS_WIDTH,
            canvas_height=config.CANVAS_HEIGHT,
            pixel_size=config.PIXEL_SIZE,
            cooldown_time=config.COOLDOWN_TIME,
            build_timestamp=int(time.time()),
            debug=config.DEBUG
        )
    except Exception as e:
        import traceback
        logger.error(f"Error rendering test page: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return f"Test Template Error: {str(e)}", 500


@main_bp.route('/health')
async def health():
    """
    Endpoint для проверки работоспособности приложения
    
    Returns:
        JSON с информацией о состоянии приложения
    """
    from app.services.lifecycle import get_lifecycle_service
    
    try:
        lifecycle_service = get_lifecycle_service()
        if lifecycle_service:
            health_info = await lifecycle_service.health_check()
            status_code = 200 if health_info.get('healthy', False) else 503
            return health_info, status_code
        else:
            return {
                'healthy': False,
                'error': 'Lifecycle service not available'
            }, 503
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'healthy': False,
            'error': str(e)
        }, 503


@main_bp.route('/info')
async def info():
    """
    Endpoint с информацией о приложении
    
    Returns:
        JSON с базовой информацией о конфигурации
    """
    try:
        return {
            'name': 'pixel-battle',
            'version': '2.0.0',
            'canvas': {
                'width': config.CANVAS_WIDTH,
                'height': config.CANVAS_HEIGHT,
                'pixel_size': config.PIXEL_SIZE,
                'total_pixels': config.CANVAS_WIDTH * config.CANVAS_HEIGHT
            },
            'settings': {
                'cooldown_time': config.COOLDOWN_TIME,
                'colors_count': len(config.colors) if config.colors else 0
            }
        }
    except Exception as e:
        logger.error(f"Error getting app info: {e}")
        return {'error': 'Failed to get app info'}, 500
