import asyncio

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Float, Index
from sqlalchemy.future import select
from sqlalchemy.dialects.sqlite import insert
from typing import List, Dict

import config

class Base(DeclarativeBase):
    pass

class PixelModel(Base):
    __tablename__ = 'pixels'

    x: Mapped[int] = mapped_column(Integer, primary_key=True)
    y: Mapped[int] = mapped_column(Integer, primary_key=True)
    color: Mapped[str] = mapped_column(String, nullable=False)
    last_update: Mapped[float] = mapped_column(Float, nullable=False)

    # Индексы для оптимизации запросов
    __table_args__ = (
        Index('idx_pixels_xy', 'x', 'y'),  # Композитный индекс для координат
        Index('idx_pixels_last_update', 'last_update'),  # Индекс для временных запросов
        Index('idx_pixels_color', 'color'),  # Индекс для фильтрации по цвету
    )

class DatabaseManager:
    def __init__(self, db_path='sqlite+aiosqlite:///canvas.db'):
        # SQLite не поддерживает pool настройки, применяем их только для других БД
        engine_kwargs = {
            'echo': False  # Отключаем логирование для производительности
        }
        
        # Добавляем настройки пула только для не-SQLite БД
        if not db_path.startswith('sqlite'):
            engine_kwargs.update({
                'pool_size': 20,
                'max_overflow': 30,
                'pool_timeout': 30,
                'pool_recycle': 3600
            })
        
        self.engine = create_async_engine(db_path, **engine_kwargs)
        self.async_session = async_sessionmaker(
            self.engine, 
            expire_on_commit=False, 
            class_=AsyncSession
        )
        
        # Батч для накопления операций
        self.pending_pixels = []
        self.batch_size = 50
        self.last_batch_time = 0

    async def init_db(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def save_pixel(self, x: int, y: int, color: str, last_update: float):
        """Сохранить один пиксель (добавляется в батч)"""
        import time
        
        pixel_data = {
            'x': x, 
            'y': y, 
            'color': color, 
            'last_update': last_update
        }
        
        self.pending_pixels.append(pixel_data)
        current_time = time.time()
        
        # Сохраняем батч если достигли лимита или прошло много времени
        if (len(self.pending_pixels) >= self.batch_size or 
            current_time - self.last_batch_time > 2.0):
            await self._flush_batch()

    async def _flush_batch(self):
        """Сохранить накопленный батч пикселей"""
        if not self.pending_pixels:
            return
            
        async with self.async_session() as session:
            try:
                # Используем UPSERT (INSERT OR REPLACE для SQLite)
                stmt = insert(PixelModel).values(self.pending_pixels)
                stmt = stmt.on_conflict_do_update(
                    index_elements=['x', 'y'],
                    set_={
                        'color': stmt.excluded.color,
                        'last_update': stmt.excluded.last_update
                    }
                )
                
                await session.execute(stmt)
                await session.commit()
                
                print(f"Successfully saved batch of {len(self.pending_pixels)} pixels")
                self.pending_pixels.clear()
                
            except Exception as e:
                await session.rollback()
                print(f"Error saving pixel batch: {e}")
                # При ошибке очищаем батч чтобы не накапливать ошибочные данные
                self.pending_pixels.clear()
            finally:
                import time
                self.last_batch_time = time.time()

    async def load_canvas(self):
        """Загружает все пиксели из БД оптимизированным способом"""
        async with self.async_session() as session:
            try:
                # Сначала принудительно сохраняем все ожидающие пиксели
                await self._flush_batch()
                
                # Загружаем только не-белые пиксели для экономии памяти
                stmt = select(PixelModel).where(PixelModel.color != "#FFFFFF")
                result = await session.execute(stmt)
                
                pixels = []
                for pixel in result.scalars():
                    pixels.append({
                        'x': pixel.x, 
                        'y': pixel.y, 
                        'color': pixel.color, 
                        'last_update': pixel.last_update
                    })
                return pixels
            except Exception as e:
                print(f"Error loading canvas: {e}")
                return []
    
    async def force_save_all(self):
        """Принудительно сохранить все ожидающие пиксели"""
        await self._flush_batch()
        
    async def get_statistics(self) -> Dict[str, int]:
        """Получить статистику базы данных"""
        async with self.async_session() as session:
            try:
                # Общее количество пикселей
                total_result = await session.execute(
                    select(PixelModel.__table__.c.x).func.count()
                )
                total_pixels = total_result.scalar()
                
                # Количество не-белых пикселей  
                active_result = await session.execute(
                    select(PixelModel.__table__.c.x).func.count().where(PixelModel.color != "#FFFFFF")
                )
                active_pixels = active_result.scalar()
                
                return {
                    'total_pixels': total_pixels or 0,
                    'active_pixels': active_pixels or 0,
                    'pending_batch_size': len(self.pending_pixels)
                }
            except Exception as e:
                print(f"Error getting statistics: {e}")
                return {'total_pixels': 0, 'active_pixels': 0, 'pending_batch_size': 0}

    async def bulk_save_pixels(self, pixels: List[Dict]):
        """Массовое сохранение пикселей с оптимизацией"""
        if not pixels:
            return
            
        async with self.async_session() as session:
            try:
                # Используем UPSERT для массовых операций
                stmt = insert(PixelModel).values(pixels)
                stmt = stmt.on_conflict_do_update(
                    index_elements=['x', 'y'],
                    set_={
                        'color': stmt.excluded.color,
                        'last_update': stmt.excluded.last_update
                    }
                )
                
                await session.execute(stmt)
                await session.commit()
                print(f"Bulk saved {len(pixels)} pixels")
                
            except Exception as e:
                await session.rollback()
                print(f"Error in bulk save: {e}")

    async def periodic_save(self, canvas, interval=60):
        """Периодическое сохранение с оптимизированной структурой данных"""
        while True:
            await asyncio.sleep(interval)
            
            try:
                # Принудительно сохраняем накопленные батчи
                await self._flush_batch()
                
                print(f"Periodic save completed. Current stats: {await self.get_statistics()}")
                
            except Exception as e:
                print(f"Error in periodic save: {e}")

    async def cleanup_old_data(self, days_old: int = 30):
        """Очистка старых данных для управления размером БД"""
        import time
        cutoff_time = time.time() - (days_old * 24 * 60 * 60)
        
        async with self.async_session() as session:
            try:
                # Удаляем только белые пиксели старше cutoff_time
                stmt = PixelModel.__table__.delete().where(
                    (PixelModel.color == "#FFFFFF") & 
                    (PixelModel.last_update < cutoff_time)
                )
                
                result = await session.execute(stmt)
                await session.commit()
                
                print(f"Cleaned up {result.rowcount} old white pixels")
                
            except Exception as e:
                await session.rollback()
                print(f"Error cleaning up old data: {e}")