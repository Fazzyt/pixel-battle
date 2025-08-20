"""
API маршруты приложения

Содержит REST API endpoints для получения данных и статистики
"""

import time
import logging
from quart import Blueprint, request, jsonify
from app.services.pixel import get_pixel_service
from app.services.tasks import get_task_service
from app.services.broadcast import broadcast_service
import config

logger = logging.getLogger(__name__)

# Создаем Blueprint для API маршрутов
api_bp = Blueprint('api', __name__, url_prefix='/api')


@api_bp.route('/stats')
async def get_stats():
    """
    API для получения статистики производительности
    
    Returns:
        JSON с подробной статистикой системы
    """
    try:
        from database import DatabaseManager
        # Предполагаем что db_manager доступен глобально или через dependency injection
        # В реальной реализации это будет через application context
        db_manager = getattr(config, 'db_manager', None)
        
        if not db_manager:
            return {'status': 'error', 'message': 'Database manager not available'}, 503
        
        # Получаем статистику различных компонентов
        memory_stats = config.canvas.get_memory_usage()
        db_stats = await db_manager.get_statistics()
        
        return {
            'status': 'ok',
            'timestamp': time.time(),
            'memory': memory_stats,
            'database': db_stats,
            'connections': {
                'active': broadcast_service.get_connection_count(),
                'online_users': config.ONLINE_USER
            },
            'canvas': {
                'size': f"{config.CANVAS_WIDTH}x{config.CANVAS_HEIGHT}",
                'active_pixels': config.canvas.get_pixels_count(),
                'total_possible_pixels': config.CANVAS_WIDTH * config.CANVAS_HEIGHT
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.route('/canvas')
async def get_canvas():
    """
    API для получения текущего состояния холста
    
    Returns:
        JSON со всеми активными пикселями
    """
    try:
        pixel_service = get_pixel_service()
        if not pixel_service:
            return {'error': 'Pixel service not available'}, 503
            
        active_pixels = pixel_service.get_active_pixels()
        
        return {
            'status': 'ok',
            'timestamp': time.time(),
            'pixels': active_pixels,
            'total_pixels': len(active_pixels),
            'canvas_info': pixel_service.get_canvas_stats()
        }
    except Exception as e:
        logger.error(f"Error getting canvas: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.route('/pixel/<int:x>/<int:y>')
async def get_pixel(x: int, y: int):
    """
    API для получения информации о конкретном пикселе
    
    Args:
        x: X координата пикселя
        y: Y координата пикселя
        
    Returns:
        JSON с информацией о пикселе
    """
    try:
        pixel_service = get_pixel_service()
        if not pixel_service:
            return {'error': 'Pixel service not available'}, 503
            
        pixel_info = pixel_service.get_pixel_info(x, y)
        
        if 'error' in pixel_info:
            return pixel_info, 400
            
        return {
            'status': 'ok',
            'pixel': pixel_info
        }
    except Exception as e:
        logger.error(f"Error getting pixel {x},{y}: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.route('/colors')
async def get_colors():
    """
    API для получения списка доступных цветов
    
    Returns:
        JSON со списком допустимых цветов
    """
    try:
        return {
            'status': 'ok',
            'colors': config.colors if config.colors else [],
            'total_colors': len(config.colors) if config.colors else 0
        }
    except Exception as e:
        logger.error(f"Error getting colors: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.route('/admin/stats/detailed')
async def get_detailed_stats():
    """
    API для получения детализированной статистики (для админов)
    
    Returns:
        JSON с расширенной статистикой
    """
    try:
        task_service = get_task_service()
        if not task_service:
            return {'error': 'Task service not available'}, 503
            
        detailed_stats = await task_service.force_statistics_log()
        
        return {
            'status': 'ok',
            'detailed_stats': detailed_stats
        }
    except Exception as e:
        logger.error(f"Error getting detailed stats: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.route('/admin/cleanup', methods=['POST'])
async def force_cleanup():
    """
    API для принудительной очистки старых данных (POST запрос для админов)
    
    JSON Body:
        {
            "days_old": int (опционально, по умолчанию 7)
        }
        
    Returns:
        JSON с результатом операции очистки
    """
    try:
        task_service = get_task_service()
        if not task_service:
            return {'error': 'Task service not available'}, 503
        
        # Получаем параметры из JSON body
        data = await request.get_json() or {}
        days_old = data.get('days_old', 7)
        
        if not isinstance(days_old, int) or days_old < 1:
            return {'error': 'days_old must be a positive integer'}, 400
        
        cleanup_result = await task_service.force_cleanup(days_old=days_old)
        
        status_code = 200 if cleanup_result.get('success', False) else 500
        return cleanup_result, status_code
        
    except Exception as e:
        logger.error(f"Error in force cleanup: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.route('/admin/batch-save', methods=['POST'])
async def force_batch_save():
    """
    API для принудительного сохранения батчей в БД
    
    Returns:
        JSON с результатом операции
    """
    try:
        db_manager = getattr(config, 'db_manager', None)
        if not db_manager:
            return {'error': 'Database manager not available'}, 503
        
        await db_manager.force_save_all()
        
        return {
            'status': 'ok',
            'message': 'Batch save completed successfully',
            'timestamp': time.time()
        }
    except Exception as e:
        logger.error(f"Error in force batch save: {e}")
        return {'status': 'error', 'message': str(e)}, 500


@api_bp.errorhandler(404)
async def api_not_found(error):
    """Обработчик 404 ошибок для API endpoints"""
    return {
        'status': 'error',
        'message': 'API endpoint not found',
        'error': 'Not Found'
    }, 404


@api_bp.errorhandler(405)
async def api_method_not_allowed(error):
    """Обработчик 405 ошибок для API endpoints"""
    return {
        'status': 'error',
        'message': 'Method not allowed for this endpoint',
        'error': 'Method Not Allowed'
    }, 405


@api_bp.errorhandler(500)
async def api_internal_error(error):
    """Обработчик 500 ошибок для API endpoints"""
    logger.error(f"Internal API error: {error}")
    return {
        'status': 'error',
        'message': 'Internal server error occurred',
        'error': 'Internal Server Error'
    }, 500
