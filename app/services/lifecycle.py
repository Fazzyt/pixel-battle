"""
Сервис жизненного цикла приложения

Управляет запуском, остановкой и корректным завершением работы приложения
"""

import asyncio
import signal
import sys
import logging
from typing import Optional
from database import DatabaseManager
from .tasks import get_task_service
import config

logger = logging.getLogger(__name__)


class LifecycleService:
    """Сервис для управления жизненным циклом приложения"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.canvas = config.canvas
        self.is_initialized = False
        self.shutdown_in_progress = False
        
    async def startup(self) -> None:
        """Инициализация приложения при запуске"""
        if self.is_initialized:
            logger.warning("Application already initialized")
            return
            
        logger.info("Starting application initialization...")
        
        try:
            # Инициализация базы данных
            await self._init_database()
            
            # Загрузка данных холста
            await self._load_canvas_data()
            
            # Запуск периодических задач
            await self._start_background_tasks()
            
            # Настройка обработчиков сигналов
            self._setup_signal_handlers()
            
            self.is_initialized = True
            logger.info("Application initialization completed successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize application: {e}")
            raise
    
    async def _init_database(self) -> None:
        """Инициализация базы данных"""
        try:
            await self.db_manager.init_db()
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
    
    async def _load_canvas_data(self) -> None:
        """Загрузка данных холста из базы данных"""
        try:
            saved_pixels = await self.db_manager.load_canvas()
            logger.info(f"Loading {len(saved_pixels)} pixels from database...")
            
            # Используем массовую загрузку для лучшей производительности
            self.canvas.bulk_load_pixels(saved_pixels)
            
            memory_usage = self.canvas.get_memory_usage()
            logger.info(f"Canvas loaded successfully. Memory usage: {memory_usage}")
            
        except Exception as e:
            logger.error(f"Failed to load canvas data: {e}")
            raise
    
    async def _start_background_tasks(self) -> None:
        """Запуск фоновых задач"""
        try:
            task_service = get_task_service()
            if task_service:
                await task_service.start_periodic_tasks()
                logger.info("Background tasks started")
            else:
                logger.warning("Task service not available")
        except Exception as e:
            logger.error(f"Failed to start background tasks: {e}")
            raise
    
    def _setup_signal_handlers(self) -> None:
        """Настройка обработчиков сигналов для graceful shutdown"""
        try:
            def signal_handler(sig, frame):
                logger.info(f"Received shutdown signal {sig}, initiating graceful shutdown...")
                asyncio.create_task(self.graceful_shutdown())
            
            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)
            
            logger.info("Signal handlers configured")
            
        except Exception as e:
            logger.error(f"Failed to setup signal handlers: {e}")
            # Не критично, продолжаем работу
    
    async def graceful_shutdown(self) -> None:
        """Корректное завершение работы приложения"""
        if self.shutdown_in_progress:
            logger.warning("Shutdown already in progress")
            return
            
        self.shutdown_in_progress = True
        logger.info("Starting graceful shutdown...")
        
        try:
            # Останавливаем периодические задачи
            await self._stop_background_tasks()
            
            # Принудительно сохраняем все данные
            await self._save_all_data()
            
            # Логируем финальную статистику
            await self._log_final_statistics()
            
            logger.info("Graceful shutdown completed successfully")
            
        except Exception as e:
            logger.error(f"Error during graceful shutdown: {e}")
        finally:
            # Завершаем процесс
            sys.exit(0)
    
    async def _stop_background_tasks(self) -> None:
        """Остановка фоновых задач"""
        try:
            task_service = get_task_service()
            if task_service:
                await task_service.stop_periodic_tasks()
                logger.info("Background tasks stopped")
        except Exception as e:
            logger.error(f"Error stopping background tasks: {e}")
    
    async def _save_all_data(self) -> None:
        """Принудительное сохранение всех данных"""
        try:
            await self.db_manager.force_save_all()
            logger.info("All pending data saved to database")
        except Exception as e:
            logger.error(f"Error saving data during shutdown: {e}")
    
    async def _log_final_statistics(self) -> None:
        """Логирование финальной статистики"""
        try:
            memory_stats = self.canvas.get_memory_usage()
            db_stats = await self.db_manager.get_statistics()
            
            logger.info(
                f"Final Statistics - "
                f"Memory: {memory_stats} | "
                f"Database: {db_stats} | "
                f"Online Users: {config.ONLINE_USER} | "
                f"Active Connections: {len(config.ACTIVE_CONNECTIONS)}"
            )
        except Exception as e:
            logger.error(f"Error logging final statistics: {e}")
    
    async def health_check(self) -> dict:
        """
        Проверка состояния приложения
        
        Returns:
            Словарь с информацией о состоянии
        """
        try:
            # Проверяем основные компоненты
            db_healthy = await self._check_database_health()
            canvas_healthy = self._check_canvas_health()
            tasks_healthy = self._check_tasks_health()
            
            overall_health = db_healthy and canvas_healthy and tasks_healthy
            
            return {
                'healthy': overall_health,
                'initialized': self.is_initialized,
                'shutdown_in_progress': self.shutdown_in_progress,
                'components': {
                    'database': db_healthy,
                    'canvas': canvas_healthy,
                    'background_tasks': tasks_healthy
                },
                'stats': {
                    'online_users': config.ONLINE_USER,
                    'active_connections': len(config.ACTIVE_CONNECTIONS),
                    'active_pixels': self.canvas.get_pixels_count()
                }
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                'healthy': False,
                'error': str(e)
            }
    
    async def _check_database_health(self) -> bool:
        """Проверка состояния базы данных"""
        try:
            # Простая проверка - получаем статистику
            await self.db_manager.get_statistics()
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    def _check_canvas_health(self) -> bool:
        """Проверка состояния холста"""
        try:
            # Проверяем основные операции
            self.canvas.get_memory_usage()
            self.canvas.get_pixels_count()
            return True
        except Exception as e:
            logger.error(f"Canvas health check failed: {e}")
            return False
    
    def _check_tasks_health(self) -> bool:
        """Проверка состояния фоновых задач"""
        try:
            task_service = get_task_service()
            return task_service is not None and task_service.running
        except Exception as e:
            logger.error(f"Tasks health check failed: {e}")
            return False


# Глобальный экземпляр (будет создан в factory)
lifecycle_service = None


def create_lifecycle_service(db_manager: DatabaseManager) -> LifecycleService:
    """Создать экземпляр LifecycleService"""
    global lifecycle_service
    lifecycle_service = LifecycleService(db_manager)
    return lifecycle_service


def get_lifecycle_service() -> Optional[LifecycleService]:
    """Получить текущий экземпляр LifecycleService"""
    return lifecycle_service
