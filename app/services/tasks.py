"""
Сервис периодических задач

Управляет фоновыми задачами приложения:
- Принудительное сохранение батчей БД
- Логирование статистики
- Очистка старых данных
"""

import asyncio
import time
import logging
from typing import Optional
from database import DatabaseManager
import config

logger = logging.getLogger(__name__)


class TaskService:
    """Сервис для управления периодическими задачами"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.canvas = config.canvas
        self.running = False
        self.task_handle: Optional[asyncio.Task] = None
        
        # Настройки задач
        self.batch_save_interval = 30  # секунды
        self.stats_log_interval = 300  # 5 минут
        self.cleanup_interval = 3600   # 1 час
        self.cleanup_days_old = 7      # дни
        
    async def start_periodic_tasks(self) -> None:
        """Запуск периодических задач"""
        if self.running:
            logger.warning("Periodic tasks already running")
            return
            
        self.running = True
        self.task_handle = asyncio.create_task(self._periodic_task_loop())
        logger.info("Periodic tasks started")
    
    async def stop_periodic_tasks(self) -> None:
        """Остановка периодических задач"""
        self.running = False
        
        if self.task_handle:
            self.task_handle.cancel()
            try:
                await self.task_handle
            except asyncio.CancelledError:
                pass
            self.task_handle = None
            
        logger.info("Periodic tasks stopped")
    
    async def _periodic_task_loop(self) -> None:
        """Основной цикл периодических задач"""
        last_stats_log = 0
        last_cleanup = 0
        
        while self.running:
            try:
                current_time = time.time()
                
                # Принудительное сохранение батчей (каждые 30 секунд)
                await self._force_save_batches()
                
                # Логирование статистики (каждые 5 минут)
                if current_time - last_stats_log >= self.stats_log_interval:
                    await self._log_statistics()
                    last_stats_log = current_time
                
                # Очистка старых данных (каждый час)
                if current_time - last_cleanup >= self.cleanup_interval:
                    await self._cleanup_old_data()
                    last_cleanup = current_time
                
                # Пауза между циклами
                await asyncio.sleep(self.batch_save_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic task loop: {e}")
                # Продолжаем работу после ошибки
                await asyncio.sleep(5)  # Небольшая пауза после ошибки
    
    async def _force_save_batches(self) -> None:
        """Принудительное сохранение накопленных батчей"""
        try:
            await self.db_manager.force_save_all()
            logger.debug("Forced batch save completed")
        except Exception as e:
            logger.error(f"Error in force save batches: {e}")
    
    async def _log_statistics(self) -> None:
        """Логирование статистики производительности"""
        try:
            memory_stats = self.canvas.get_memory_usage()
            db_stats = await self.db_manager.get_statistics()
            
            logger.info(
                f"Performance Stats - "
                f"Memory: active_pixels={memory_stats.get('active_pixels', 0)}, "
                f"cache_hits={memory_stats.get('cache_hits', 0)}, "
                f"cache_misses={memory_stats.get('cache_misses', 0)}, "
                f"efficiency={memory_stats.get('memory_efficiency', 0):.1f}% | "
                f"DB: total_pixels={db_stats.get('total_pixels', 0)}, "
                f"active_pixels={db_stats.get('active_pixels', 0)}, "
                f"pending_batch={db_stats.get('pending_batch_size', 0)}"
            )
        except Exception as e:
            logger.error(f"Error logging statistics: {e}")
    
    async def _cleanup_old_data(self) -> None:
        """Очистка старых данных из базы данных"""
        try:
            await self.db_manager.cleanup_old_data(days_old=self.cleanup_days_old)
            logger.info("Old data cleanup completed")
        except Exception as e:
            logger.error(f"Error in cleanup old data: {e}")
    
    async def force_statistics_log(self) -> dict:
        """
        Принудительное получение текущей статистики
        
        Returns:
            Словарь с текущей статистикой
        """
        try:
            memory_stats = self.canvas.get_memory_usage()
            db_stats = await self.db_manager.get_statistics()
            
            return {
                'timestamp': time.time(),
                'memory': memory_stats,
                'database': db_stats,
                'connections': {
                    'active': len(config.ACTIVE_CONNECTIONS),
                    'online_users': config.ONLINE_USER
                }
            }
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return {'error': str(e)}
    
    async def force_cleanup(self, days_old: int = None) -> dict:
        """
        Принудительная очистка старых данных
        
        Args:
            days_old: Количество дней для очистки (по умолчанию из настроек)
            
        Returns:
            Результат операции очистки
        """
        if days_old is None:
            days_old = self.cleanup_days_old
            
        try:
            result = await self.db_manager.cleanup_old_data(days_old=days_old)
            return {
                'success': True,
                'days_old': days_old,
                'message': f'Cleanup completed for data older than {days_old} days'
            }
        except Exception as e:
            logger.error(f"Error in force cleanup: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def configure_intervals(
        self, 
        batch_save_interval: int = None,
        stats_log_interval: int = None,
        cleanup_interval: int = None,
        cleanup_days_old: int = None
    ) -> None:
        """
        Настройка интервалов выполнения задач
        
        Args:
            batch_save_interval: Интервал сохранения батчей в секундах
            stats_log_interval: Интервал логирования статистики в секундах
            cleanup_interval: Интервал очистки данных в секундах
            cleanup_days_old: Возраст данных для очистки в днях
        """
        if batch_save_interval is not None:
            self.batch_save_interval = batch_save_interval
        if stats_log_interval is not None:
            self.stats_log_interval = stats_log_interval
        if cleanup_interval is not None:
            self.cleanup_interval = cleanup_interval
        if cleanup_days_old is not None:
            self.cleanup_days_old = cleanup_days_old
            
        logger.info(f"Task intervals configured: batch_save={self.batch_save_interval}s, "
                   f"stats_log={self.stats_log_interval}s, cleanup={self.cleanup_interval}s, "
                   f"cleanup_days={self.cleanup_days_old}")


# Глобальный экземпляр (будет создан в factory)
task_service = None


def create_task_service(db_manager: DatabaseManager) -> TaskService:
    """Создать экземпляр TaskService"""
    global task_service
    task_service = TaskService(db_manager)
    return task_service


def get_task_service() -> Optional[TaskService]:
    """Получить текущий экземпляр TaskService"""
    return task_service
