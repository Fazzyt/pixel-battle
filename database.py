import asyncio

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Float
from sqlalchemy.future import select

import config

class Base(DeclarativeBase):
    pass

class PixelModel(Base):
    __tablename__ = 'pixels'

    x: Mapped[int] = mapped_column(Integer, primary_key=True)
    y: Mapped[int] = mapped_column(Integer, primary_key=True)
    color: Mapped[str] = mapped_column(String)
    last_update: Mapped[float] = mapped_column(Float)

class DatabaseManager:
    def __init__(self, db_path='sqlite+aiosqlite:///canvas.db'):
        self.engine = create_async_engine(db_path, echo=True)
        self.async_session = async_sessionmaker(
            self.engine, 
            expire_on_commit=False, 
            class_=AsyncSession
        )

    async def init_db(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def save_pixel(self, x: int, y: int, color: str, last_update: float):
        async with self.async_session() as session:
            try:
                pixel = PixelModel(x=x, y=y, color=color, last_update=last_update)
                await session.merge(pixel)
                await session.commit()
            except Exception as e:
                await session.rollback()
                print(f"Error saving pixel: {e}")

    async def load_canvas(self):
        async with self.async_session() as session:
            try:
                result = await session.execute(select(PixelModel))
                pixels = result.scalars().all()
                return [
                    {
                        'x': pixel.x, 
                        'y': pixel.y, 
                        'color': pixel.color, 
                        'last_update': pixel.last_update
                    } for pixel in pixels
                ]
            except Exception as e:
                print(f"Error loading canvas: {e}")
                return []

    async def bulk_save_pixels(self, pixels):
        async with self.async_session() as session:
            try:
                pixel_objects = [
                    PixelModel(x=pixel['x'], y=pixel['y'], color=pixel['color'], last_update=pixel['last_update'])
                    for pixel in pixels
                ]
                session.add_all(pixel_objects)
                await session.commit()
            except Exception as e:
                await session.rollback()
                print(f"Error in bulk save: {e}")

    async def periodic_save(self, canvas, interval=300):
        while True:
            await asyncio.sleep(interval)
            pixels_to_save = []
            for y in range(config.CANVAS_HEIGHT):
                for x in range(config.CANVAS_WIDTH):
                    pixel = canvas[y][x]
                    if pixel['color'] != "#FFFFFF":
                        pixels_to_save.append({
                            'x': x, 
                            'y': y, 
                            'color': pixel['color'], 
                            'last_update': pixel['last_update']
                        })
            
            if pixels_to_save:
                await self.bulk_save_pixels(pixels_to_save)