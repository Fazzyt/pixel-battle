#!/usr/bin/env python3
"""
Автотесты производительности для pixel-battle

Тестирует все оптимизации:
- OptimizedCanvas vs старый подход
- Батчевые операции БД
- WebSocket нагрузочные тесты
- Потребление памяти
"""

import asyncio
import time
import psutil
import json
import random
import statistics
from typing import List, Dict, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading
import websockets
import urllib.parse

# Импорты проекта
import config
from database import DatabaseManager, PixelModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

@dataclass
class BenchmarkResult:
    name: str
    duration: float
    memory_used: int  # bytes
    operations_per_second: float
    additional_info: Dict = None

class LegacyCanvas:
    """Старая реализация для сравнения производительности"""
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.default_color = "#FFFFFF"
        # Старый подход - двумерный массив
        self.canvas = [[{"color": self.default_color, "last_update": 0} 
                       for _ in range(width)] for _ in range(height)]
    
    def set_pixel(self, x: int, y: int, color: str, last_update: float = None):
        if 0 <= x < self.width and 0 <= y < self.height:
            self.canvas[y][x] = {
                "color": color, 
                "last_update": last_update or time.time()
            }
            
    def get_active_pixels_old_way(self):
        """Старый способ получения активных пикселей - полный перебор"""
        active_pixels = []
        for y in range(self.height):
            for x in range(self.width):
                if self.canvas[y][x]['color'] != self.default_color:
                    active_pixels.append({
                        'x': x,
                        'y': y,
                        'color': self.canvas[y][x]['color']
                    })
        return active_pixels

class PerformanceTester:
    def __init__(self):
        self.results: List[BenchmarkResult] = []
        self.process = psutil.Process()
        
    def measure_memory(self) -> int:
        """Измеряет текущее потребление памяти в байтах"""
        return self.process.memory_info().rss
        
    async def run_all_tests(self) -> List[BenchmarkResult]:
        """Запуск всех тестов производительности"""
        print("🚀 Начинаем тестирование производительности...")
        
        # Тесты структуры данных холста
        await self.test_canvas_performance()
        
        # Тесты базы данных
        await self.test_database_performance()
        
        # Тесты WebSocket
        await self.test_websocket_performance()
        
        # Тесты памяти
        await self.test_memory_usage()
        
        # Сравнительные тесты
        await self.test_comparative_benchmarks()
        
        return self.results
    
    async def test_canvas_performance(self):
        """Тестирование производительности структуры данных холста"""
        print("\n📊 Тестирование OptimizedCanvas vs Legacy...")
        
        # Тест 1: Инициализация и установка пикселей
        await self._test_canvas_pixel_operations()
        
        # Тест 2: Получение активных пикселей
        await self._test_active_pixels_retrieval()
        
        # Тест 3: Массовые операции
        await self._test_bulk_operations()

    async def _test_canvas_pixel_operations(self):
        """Тест операций с пикселями"""
        num_operations = 10000
        
        # Тест нового OptimizedCanvas
        memory_before = self.measure_memory()
        start_time = time.time()
        
        optimized_canvas = config.OptimizedCanvas(2000, 600)
        for i in range(num_operations):
            x = random.randint(0, 1999)
            y = random.randint(0, 599)
            color = random.choice(config.colors) if config.colors else "#FF0000"
            optimized_canvas.set_pixel(x, y, color)
        
        end_time = time.time()
        memory_after = self.measure_memory()
        
        optimized_duration = end_time - start_time
        optimized_memory = memory_after - memory_before
        
        self.results.append(BenchmarkResult(
            name="OptimizedCanvas - Pixel Operations",
            duration=optimized_duration,
            memory_used=optimized_memory,
            operations_per_second=num_operations / optimized_duration,
            additional_info={"num_operations": num_operations}
        ))
        
        # Тест старого LegacyCanvas
        memory_before = self.measure_memory()
        start_time = time.time()
        
        legacy_canvas = LegacyCanvas(2000, 600)
        for i in range(num_operations):
            x = random.randint(0, 1999)
            y = random.randint(0, 599)
            color = random.choice(config.colors) if config.colors else "#FF0000"
            legacy_canvas.set_pixel(x, y, color)
        
        end_time = time.time()
        memory_after = self.measure_memory()
        
        legacy_duration = end_time - start_time
        legacy_memory = memory_after - memory_before
        
        self.results.append(BenchmarkResult(
            name="LegacyCanvas - Pixel Operations",
            duration=legacy_duration,
            memory_used=legacy_memory,
            operations_per_second=num_operations / legacy_duration,
            additional_info={"num_operations": num_operations}
        ))
        
        print(f"✅ Pixel Operations: Optimized {optimized_duration:.3f}s vs Legacy {legacy_duration:.3f}s")
        print(f"   Memory: Optimized {optimized_memory/1024:.1f}KB vs Legacy {legacy_memory/1024:.1f}KB")

    async def _test_active_pixels_retrieval(self):
        """Тест получения списка активных пикселей"""
        # Подготовка данных
        num_pixels = 5000
        
        optimized_canvas = config.OptimizedCanvas(2000, 600)
        legacy_canvas = LegacyCanvas(2000, 600)
        
        # Заполняем оба холста одинаковыми данными
        pixels_data = []
        for _ in range(num_pixels):
            x = random.randint(0, 1999)
            y = random.randint(0, 599)
            color = random.choice(config.colors) if config.colors else "#FF0000"
            pixels_data.append((x, y, color))
            
        for x, y, color in pixels_data:
            optimized_canvas.set_pixel(x, y, color)
            legacy_canvas.set_pixel(x, y, color)
        
        # Тест OptimizedCanvas
        num_retrievals = 100
        start_time = time.time()
        
        for _ in range(num_retrievals):
            active_pixels = optimized_canvas.get_active_pixels()
            
        optimized_duration = time.time() - start_time
        
        # Тест LegacyCanvas
        start_time = time.time()
        
        for _ in range(num_retrievals):
            active_pixels = legacy_canvas.get_active_pixels_old_way()
            
        legacy_duration = time.time() - start_time
        
        self.results.append(BenchmarkResult(
            name="OptimizedCanvas - Active Pixels Retrieval",
            duration=optimized_duration,
            memory_used=0,
            operations_per_second=num_retrievals / optimized_duration,
            additional_info={"retrievals": num_retrievals, "active_pixels": len(active_pixels)}
        ))
        
        self.results.append(BenchmarkResult(
            name="LegacyCanvas - Active Pixels Retrieval",
            duration=legacy_duration,
            memory_used=0,
            operations_per_second=num_retrievals / legacy_duration,
            additional_info={"retrievals": num_retrievals, "active_pixels": len(active_pixels)}
        ))
        
        speedup = legacy_duration / optimized_duration if optimized_duration > 0 else float('inf')
        print(f"✅ Active Pixels Retrieval: {speedup:.1f}x speedup")

    async def _test_bulk_operations(self):
        """Тест массовых операций"""
        print("⚡ Testing bulk operations...")
        
        # Подготовка массовых данных
        bulk_data = []
        for _ in range(50000):
            bulk_data.append({
                'x': random.randint(0, 1999),
                'y': random.randint(0, 599),
                'color': random.choice(config.colors) if config.colors else "#FF0000",
                'last_update': time.time()
            })
        
        # Тест массовой загрузки
        memory_before = self.measure_memory()
        start_time = time.time()
        
        optimized_canvas = config.OptimizedCanvas(2000, 600)
        optimized_canvas.bulk_load_pixels(bulk_data)
        
        duration = time.time() - start_time
        memory_after = self.measure_memory()
        
        self.results.append(BenchmarkResult(
            name="OptimizedCanvas - Bulk Load",
            duration=duration,
            memory_used=memory_after - memory_before,
            operations_per_second=len(bulk_data) / duration,
            additional_info={"pixels_loaded": len(bulk_data)}
        ))
        
        print(f"✅ Bulk Load: {len(bulk_data)} pixels in {duration:.3f}s")

    async def test_database_performance(self):
        """Тестирование производительности базы данных"""
        print("\n🗄️  Тестирование производительности БД...")
        
        db_manager = DatabaseManager(db_path='sqlite+aiosqlite:///test_performance.db')
        await db_manager.init_db()
        
        # Тест 1: Отдельные сохранения vs батчи
        await self._test_single_vs_batch_saves(db_manager)
        
        # Тест 2: Загрузка большого количества данных
        await self._test_bulk_load_performance(db_manager)
        
        # Очистка тестовой БД
        import os
        if os.path.exists('test_performance.db'):
            os.remove('test_performance.db')

    async def _test_single_vs_batch_saves(self, db_manager):
        """Сравнение отдельных сохранений и батчей"""
        num_pixels = 1000
        pixels_data = []
        
        for _ in range(num_pixels):
            pixels_data.append({
                'x': random.randint(0, 1999),
                'y': random.randint(0, 599),
                'color': random.choice(config.colors) if config.colors else "#FF0000",
                'last_update': time.time()
            })
        
        # Тест батчевого сохранения
        start_time = time.time()
        await db_manager.bulk_save_pixels(pixels_data)
        batch_duration = time.time() - start_time
        
        self.results.append(BenchmarkResult(
            name="Database - Batch Save",
            duration=batch_duration,
            memory_used=0,
            operations_per_second=num_pixels / batch_duration,
            additional_info={"pixels_saved": num_pixels}
        ))
        
        print(f"✅ Batch Save: {num_pixels} pixels in {batch_duration:.3f}s")

    async def _test_bulk_load_performance(self, db_manager):
        """Тест производительности загрузки"""
        start_time = time.time()
        loaded_pixels = await db_manager.load_canvas()
        load_duration = time.time() - start_time
        
        self.results.append(BenchmarkResult(
            name="Database - Load Canvas",
            duration=load_duration,
            memory_used=0,
            operations_per_second=len(loaded_pixels) / load_duration if load_duration > 0 else 0,
            additional_info={"pixels_loaded": len(loaded_pixels)}
        ))
        
        print(f"✅ Canvas Load: {len(loaded_pixels)} pixels in {load_duration:.3f}s")

    async def test_websocket_performance(self):
        """Тест производительности WebSocket соединений"""
        print("\n🔌 Тестирование WebSocket производительности...")
        
        # Симуляция множественных подключений
        await self._test_connection_simulation()

    async def _test_connection_simulation(self):
        """Симуляция подключений клиентов"""
        # Создаем данные для симуляции
        canvas = config.OptimizedCanvas(2000, 600)
        
        # Заполняем холст данными
        for _ in range(10000):
            x = random.randint(0, 1999)
            y = random.randint(0, 599)
            color = random.choice(config.colors) if config.colors else "#FF0000"
            canvas.set_pixel(x, y, color)
        
        # Симулируем инициализацию новых клиентов
        num_clients = 100
        start_time = time.time()
        
        for _ in range(num_clients):
            # Это то, что происходит при каждом новом подключении
            active_pixels = canvas.get_active_pixels()
            
        duration = time.time() - start_time
        
        self.results.append(BenchmarkResult(
            name="WebSocket - Client Initialization Simulation",
            duration=duration,
            memory_used=0,
            operations_per_second=num_clients / duration,
            additional_info={"clients_simulated": num_clients, "active_pixels": len(active_pixels)}
        ))
        
        print(f"✅ Client Init Simulation: {num_clients} clients in {duration:.3f}s")

    async def test_memory_usage(self):
        """Тестирование потребления памяти"""
        print("\n🧠 Тестирование потребления памяти...")
        
        await self._test_memory_scaling()

    async def _test_memory_scaling(self):
        """Тест масштабирования памяти"""
        pixel_counts = [1000, 5000, 10000, 50000]
        
        for pixel_count in pixel_counts:
            memory_before = self.measure_memory()
            
            # OptimizedCanvas
            optimized_canvas = config.OptimizedCanvas(2000, 600)
            for _ in range(pixel_count):
                x = random.randint(0, 1999)
                y = random.randint(0, 599)
                color = random.choice(config.colors) if config.colors else "#FF0000"
                optimized_canvas.set_pixel(x, y, color)
            
            memory_after_optimized = self.measure_memory()
            optimized_memory = memory_after_optimized - memory_before
            
            # LegacyCanvas для сравнения (только для небольших количеств)
            if pixel_count <= 10000:
                memory_before = self.measure_memory()
                legacy_canvas = LegacyCanvas(2000, 600)
                for _ in range(pixel_count):
                    x = random.randint(0, 1999)
                    y = random.randint(0, 599)
                    color = random.choice(config.colors) if config.colors else "#FF0000"
                    legacy_canvas.set_pixel(x, y, color)
                
                memory_after_legacy = self.measure_memory()
                legacy_memory = memory_after_legacy - memory_before
                
                self.results.append(BenchmarkResult(
                    name=f"Memory Usage - Legacy ({pixel_count} pixels)",
                    duration=0,
                    memory_used=legacy_memory,
                    operations_per_second=0,
                    additional_info={"pixel_count": pixel_count}
                ))
            
            self.results.append(BenchmarkResult(
                name=f"Memory Usage - Optimized ({pixel_count} pixels)",
                duration=0,
                memory_used=optimized_memory,
                operations_per_second=0,
                additional_info={"pixel_count": pixel_count}
            ))
            
            print(f"✅ Memory {pixel_count} pixels: Optimized {optimized_memory/1024:.1f}KB")

    async def test_comparative_benchmarks(self):
        """Сравнительные бенчмарки общих операций"""
        print("\n⚖️  Сравнительные бенчмарки...")
        
        # Полный цикл: создание холста -> заполнение -> получение активных пикселей
        await self._test_full_cycle_benchmark()

    async def _test_full_cycle_benchmark(self):
        """Тест полного цикла работы"""
        num_pixels = 20000
        num_retrievals = 50
        
        # OptimizedCanvas полный цикл
        start_time = time.time()
        memory_before = self.measure_memory()
        
        optimized_canvas = config.OptimizedCanvas(2000, 600)
        
        # Заполнение
        for _ in range(num_pixels):
            x = random.randint(0, 1999)
            y = random.randint(0, 599)
            color = random.choice(config.colors) if config.colors else "#FF0000"
            optimized_canvas.set_pixel(x, y, color)
        
        # Многократное получение активных пикселей
        for _ in range(num_retrievals):
            active_pixels = optimized_canvas.get_active_pixels()
        
        optimized_duration = time.time() - start_time
        memory_after = self.measure_memory()
        optimized_memory = memory_after - memory_before
        
        # LegacyCanvas полный цикл (меньше операций для избежания таймаута)
        reduced_pixels = min(5000, num_pixels)
        reduced_retrievals = min(10, num_retrievals)
        
        start_time = time.time()
        memory_before = self.measure_memory()
        
        legacy_canvas = LegacyCanvas(2000, 600)
        
        # Заполнение
        for _ in range(reduced_pixels):
            x = random.randint(0, 1999)
            y = random.randint(0, 599)
            color = random.choice(config.colors) if config.colors else "#FF0000"
            legacy_canvas.set_pixel(x, y, color)
        
        # Многократное получение активных пикселей
        for _ in range(reduced_retrievals):
            active_pixels = legacy_canvas.get_active_pixels_old_way()
        
        legacy_duration = time.time() - start_time
        memory_after = self.measure_memory()
        legacy_memory = memory_after - memory_before
        
        # Нормализуем результаты для честного сравнения
        legacy_duration_normalized = legacy_duration * (num_pixels / reduced_pixels) * (num_retrievals / reduced_retrievals)
        
        self.results.append(BenchmarkResult(
            name="Full Cycle - Optimized",
            duration=optimized_duration,
            memory_used=optimized_memory,
            operations_per_second=(num_pixels + num_retrievals) / optimized_duration,
            additional_info={
                "pixels_set": num_pixels,
                "retrievals": num_retrievals,
                "active_pixels": len(active_pixels)
            }
        ))
        
        self.results.append(BenchmarkResult(
            name="Full Cycle - Legacy (normalized)",
            duration=legacy_duration_normalized,
            memory_used=legacy_memory,
            operations_per_second=(num_pixels + num_retrievals) / legacy_duration_normalized,
            additional_info={
                "pixels_set": reduced_pixels,
                "retrievals": reduced_retrievals,
                "normalized": True
            }
        ))
        
        speedup = legacy_duration_normalized / optimized_duration if optimized_duration > 0 else float('inf')
        memory_efficiency = legacy_memory / optimized_memory if optimized_memory > 0 else float('inf')
        
        print(f"✅ Full Cycle: {speedup:.1f}x faster, {memory_efficiency:.1f}x memory efficient")

    def print_results(self):
        """Вывод результатов тестирования"""
        print("\n" + "="*80)
        print("🎯 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ПРОИЗВОДИТЕЛЬНОСТИ")
        print("="*80)
        
        # Группировка результатов
        categories = {}
        for result in self.results:
            category = result.name.split(" - ")[0]
            if category not in categories:
                categories[category] = []
            categories[category].append(result)
        
        for category, results in categories.items():
            print(f"\n📊 {category}:")
            print("-" * 40)
            
            for result in results:
                print(f"  • {result.name}")
                print(f"    ⏱️  Время: {result.duration:.4f}s")
                if result.memory_used > 0:
                    print(f"    🧠 Память: {result.memory_used/1024:.1f}KB")
                if result.operations_per_second > 0:
                    print(f"    🚀 Операций/сек: {result.operations_per_second:.1f}")
                if result.additional_info:
                    info_str = ", ".join([f"{k}: {v}" for k, v in result.additional_info.items()])
                    print(f"    ℹ️  Доп. информация: {info_str}")
                print()
        
        # Сравнительная сводка
        print("\n🏆 СВОДКА УЛУЧШЕНИЙ:")
        print("-" * 40)
        
        # Поиск пар для сравнения
        optimized_results = [r for r in self.results if "Optimized" in r.name or "OptimizedCanvas" in r.name]
        legacy_results = [r for r in self.results if "Legacy" in r.name]
        
        for opt_result in optimized_results:
            # Ищем соответствующий legacy результат
            base_name = opt_result.name.replace("OptimizedCanvas", "").replace("Optimized", "").replace(" - ", "")
            legacy_result = None
            
            for leg_result in legacy_results:
                if base_name in leg_result.name or any(word in leg_result.name for word in base_name.split()):
                    legacy_result = leg_result
                    break
            
            if legacy_result:
                if opt_result.duration > 0 and legacy_result.duration > 0:
                    speedup = legacy_result.duration / opt_result.duration
                    print(f"  ⚡ {base_name.strip()}: {speedup:.1f}x быстрее")
                
                if opt_result.memory_used > 0 and legacy_result.memory_used > 0:
                    memory_improvement = legacy_result.memory_used / opt_result.memory_used
                    print(f"  🧠 {base_name.strip()}: {memory_improvement:.1f}x меньше памяти")

async def main():
    """Запуск всех тестов производительности"""
    tester = PerformanceTester()
    
    print("🔥 АВТОТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ pixel-battle")
    print("=" * 50)
    
    start_time = time.time()
    results = await tester.run_all_tests()
    total_time = time.time() - start_time
    
    tester.print_results()
    
    print(f"\n⏱️  Общее время тестирования: {total_time:.2f} секунд")
    print(f"📋 Всего выполнено тестов: {len(results)}")
    print("\n✅ Все тесты производительности завершены!")

if __name__ == "__main__":
    asyncio.run(main())
