#!/usr/bin/env python3
"""
Быстрый бенчмарк для проверки ключевых метрик производительности

Используется для:
- Быстрой проверки после изменений кода
- CI/CD pipeline проверок
- Регрессионного тестирования
"""

import asyncio
import time
import random
import psutil
from typing import Dict

import config
from database import DatabaseManager


class QuickBenchmark:
    def __init__(self):
        self.process = psutil.Process()
        
    async def run_quick_tests(self) -> Dict:
        """Запуск быстрых ключевых тестов"""
        print("⚡ БЫСТРЫЙ БЕНЧМАРК pixel-battle")
        print("=" * 40)
        
        results = {}
        
        # 1. Тест инициализации холста
        print("🔧 Тест инициализации холста...")
        results['canvas_init'] = await self._test_canvas_initialization()
        
        # 2. Тест операций с пикселями
        print("🎨 Тест операций с пикселями...")
        results['pixel_ops'] = await self._test_pixel_operations()
        
        # 3. Тест получения активных пикселей
        print("📊 Тест получения активных пикселей...")
        results['active_pixels'] = await self._test_active_pixels_retrieval()
        
        # 4. Тест базы данных
        print("🗄️  Тест базы данных...")
        results['database'] = await self._test_database_operations()
        
        # 5. Тест потребления памяти
        print("🧠 Тест потребления памяти...")
        results['memory'] = self._test_memory_usage()
        
        return results
    
    async def _test_canvas_initialization(self) -> Dict:
        """Тест инициализации оптимизированного холста"""
        start_time = time.time()
        memory_before = self.process.memory_info().rss
        
        canvas = config.OptimizedCanvas(config.CANVAS_WIDTH, config.CANVAS_HEIGHT)
        
        duration = time.time() - start_time
        memory_after = self.process.memory_info().rss
        memory_used = memory_after - memory_before
        
        return {
            'duration': duration,
            'memory_used': memory_used,
            'status': 'pass' if duration < 0.01 else 'slow'  # Должно быть очень быстро
        }
    
    async def _test_pixel_operations(self) -> Dict:
        """Тест операций установки пикселей"""
        canvas = config.OptimizedCanvas(config.CANVAS_WIDTH, config.CANVAS_HEIGHT)
        num_operations = 1000
        
        start_time = time.time()
        memory_before = self.process.memory_info().rss
        
        # Выполняем операции
        colors = config.colors if config.colors else ["#FF0000", "#00FF00", "#0000FF"]
        for _ in range(num_operations):
            x = random.randint(0, config.CANVAS_WIDTH - 1)
            y = random.randint(0, config.CANVAS_HEIGHT - 1)
            color = random.choice(colors)
            canvas.set_pixel(x, y, color)
        
        duration = time.time() - start_time
        memory_after = self.process.memory_info().rss
        memory_used = memory_after - memory_before
        ops_per_second = num_operations / duration if duration > 0 else 0
        
        return {
            'duration': duration,
            'memory_used': memory_used,
            'operations_per_second': ops_per_second,
            'operations_count': num_operations,
            'status': 'pass' if ops_per_second > 10000 else 'slow'  # Ожидаем >10k ops/sec
        }
    
    async def _test_active_pixels_retrieval(self) -> Dict:
        """Тест получения списка активных пикселей"""
        canvas = config.OptimizedCanvas(config.CANVAS_WIDTH, config.CANVAS_HEIGHT)
        
        # Заполняем холст данными
        colors = config.colors if config.colors else ["#FF0000", "#00FF00", "#0000FF"]
        for _ in range(5000):  # 5k активных пикселей
            x = random.randint(0, config.CANVAS_WIDTH - 1)
            y = random.randint(0, config.CANVAS_HEIGHT - 1)
            color = random.choice(colors)
            canvas.set_pixel(x, y, color)
        
        # Тестируем получение активных пикселей
        num_retrievals = 100
        start_time = time.time()
        
        for _ in range(num_retrievals):
            active_pixels = canvas.get_active_pixels()
        
        duration = time.time() - start_time
        retrievals_per_second = num_retrievals / duration if duration > 0 else 0
        
        return {
            'duration': duration,
            'retrievals_per_second': retrievals_per_second,
            'active_pixels_count': len(active_pixels),
            'retrievals_count': num_retrievals,
            'status': 'pass' if retrievals_per_second > 1000 else 'slow'  # Ожидаем >1k retrievals/sec
        }
    
    async def _test_database_operations(self) -> Dict:
        """Тест операций с базой данных"""
        db_manager = DatabaseManager(db_path='sqlite+aiosqlite:///quick_test.db')
        
        try:
            await db_manager.init_db()
            
            # Тест сохранения батча
            pixels_data = []
            colors = config.colors if config.colors else ["#FF0000", "#00FF00", "#0000FF"]
            
            for i in range(500):  # 500 пикселей
                pixels_data.append({
                    'x': i % config.CANVAS_WIDTH,
                    'y': (i // config.CANVAS_WIDTH) % config.CANVAS_HEIGHT,
                    'color': colors[i % len(colors)],
                    'last_update': time.time()
                })
            
            start_time = time.time()
            await db_manager.bulk_save_pixels(pixels_data)
            save_duration = time.time() - start_time
            
            # Тест загрузки
            start_time = time.time()
            loaded_pixels = await db_manager.load_canvas()
            load_duration = time.time() - start_time
            
            # Очистка
            import os
            if os.path.exists('quick_test.db'):
                os.remove('quick_test.db')
            
            save_ops_per_second = len(pixels_data) / save_duration if save_duration > 0 else 0
            load_ops_per_second = len(loaded_pixels) / load_duration if load_duration > 0 else 0
            
            return {
                'save_duration': save_duration,
                'load_duration': load_duration,
                'save_ops_per_second': save_ops_per_second,
                'load_ops_per_second': load_ops_per_second,
                'pixels_saved': len(pixels_data),
                'pixels_loaded': len(loaded_pixels),
                'status': 'pass' if save_ops_per_second > 100 and load_ops_per_second > 1000 else 'slow'
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _test_memory_usage(self) -> Dict:
        """Тест потребления памяти"""
        memory_before = self.process.memory_info().rss
        
        # Создаем холст с данными
        canvas = config.OptimizedCanvas(config.CANVAS_WIDTH, config.CANVAS_HEIGHT)
        colors = config.colors if config.colors else ["#FF0000", "#00FF00", "#0000FF"]
        
        # Заполняем 10k пикселей
        pixel_count = 10000
        for i in range(pixel_count):
            x = i % config.CANVAS_WIDTH
            y = (i // config.CANVAS_WIDTH) % config.CANVAS_HEIGHT
            color = colors[i % len(colors)]
            canvas.set_pixel(x, y, color)
        
        memory_after = self.process.memory_info().rss
        memory_used = memory_after - memory_before
        memory_per_pixel = memory_used / pixel_count if pixel_count > 0 else 0
        
        # Проверяем статистику холста
        memory_stats = canvas.get_memory_usage()
        
        return {
            'memory_used': memory_used,
            'memory_per_pixel': memory_per_pixel,
            'pixels_stored': canvas.get_pixels_count(),
            'memory_efficiency': memory_stats.get('memory_efficiency', 0),
            'cache_hits': memory_stats.get('cache_hits', 0),
            'cache_misses': memory_stats.get('cache_misses', 0),
            'status': 'pass' if memory_per_pixel < 1000 else 'high_memory'  # < 1KB per pixel
        }
    
    def print_results(self, results: Dict):
        """Вывод результатов быстрого бенчмарка"""
        print("\n" + "="*50)
        print("📊 РЕЗУЛЬТАТЫ БЫСТРОГО БЕНЧМАРКА")
        print("="*50)
        
        # Общий статус
        all_passed = all(
            result.get('status', 'unknown') in ['pass', 'ok'] 
            for result in results.values() 
            if isinstance(result, dict)
        )
        
        status_icon = "✅" if all_passed else "⚠️"
        print(f"\n{status_icon} Общий статус: {'ПРОШЕЛ' if all_passed else 'ЕСТЬ ЗАМЕДЛЕНИЯ'}")
        
        # Детальные результаты
        print(f"\n🔧 Инициализация холста:")
        canvas_init = results.get('canvas_init', {})
        status = "✅" if canvas_init.get('status') == 'pass' else "⚠️"
        print(f"  {status} Время: {canvas_init.get('duration', 0)*1000:.2f}ms")
        print(f"     Память: {canvas_init.get('memory_used', 0)/1024:.1f}KB")
        
        print(f"\n🎨 Операции с пикселями:")
        pixel_ops = results.get('pixel_ops', {})
        status = "✅" if pixel_ops.get('status') == 'pass' else "⚠️"
        print(f"  {status} Скорость: {pixel_ops.get('operations_per_second', 0):.0f} ops/sec")
        print(f"     Время: {pixel_ops.get('duration', 0)*1000:.1f}ms для {pixel_ops.get('operations_count', 0)} операций")
        
        print(f"\n📊 Получение активных пикселей:")
        active_pixels = results.get('active_pixels', {})
        status = "✅" if active_pixels.get('status') == 'pass' else "⚠️"
        print(f"  {status} Скорость: {active_pixels.get('retrievals_per_second', 0):.0f} retrievals/sec")
        print(f"     Активных пикселей: {active_pixels.get('active_pixels_count', 0)}")
        
        print(f"\n🗄️  База данных:")
        database = results.get('database', {})
        if database.get('status') == 'error':
            print(f"  ❌ Ошибка: {database.get('error', 'Unknown error')}")
        else:
            status = "✅" if database.get('status') == 'pass' else "⚠️"
            print(f"  {status} Сохранение: {database.get('save_ops_per_second', 0):.0f} ops/sec")
            print(f"     Загрузка: {database.get('load_ops_per_second', 0):.0f} ops/sec")
        
        print(f"\n🧠 Потребление памяти:")
        memory = results.get('memory', {})
        status = "✅" if memory.get('status') == 'pass' else "⚠️"
        print(f"  {status} На пиксель: {memory.get('memory_per_pixel', 0):.0f} байт")
        print(f"     Эффективность: {memory.get('memory_efficiency', 0):.1f}%")
        print(f"     Cache hits/misses: {memory.get('cache_hits', 0)}/{memory.get('cache_misses', 0)}")
        
        # Рекомендации
        print(f"\n💡 БЫСТРЫЕ РЕКОМЕНДАЦИИ:")
        if not all_passed:
            print("  ⚠️  Обнаружены замедления - рекомендуется полное тестирование")
            
            if canvas_init.get('status') != 'pass':
                print("     • Инициализация холста медленная")
            if pixel_ops.get('status') != 'pass':
                print("     • Операции с пикселями медленные")
            if active_pixels.get('status') != 'pass':
                print("     • Получение активных пикселей медленное")
            if database.get('status') not in ['pass', 'ok']:
                print("     • Проблемы с базой данных")
            if memory.get('status') != 'pass':
                print("     • Высокое потребление памяти")
        else:
            print("  ✅ Все ключевые метрики в норме!")
            print("  🚀 Производительность оптимальна для продакшена")


async def main():
    """Запуск быстрого бенчмарка"""
    benchmark = QuickBenchmark()
    
    start_time = time.time()
    results = await benchmark.run_quick_tests()
    total_time = time.time() - start_time
    
    benchmark.print_results(results)
    
    print(f"\n⏱️  Время выполнения: {total_time:.2f} секунд")
    print("✅ Быстрый бенчмарк завершен!")


if __name__ == "__main__":
    asyncio.run(main())
