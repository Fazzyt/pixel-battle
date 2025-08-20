#!/usr/bin/env python3
"""
Мастер-скрипт для запуска всех тестов производительности pixel-battle

Запускает:
- Основные тесты производительности
- Нагрузочные тесты WebSocket  
- Генерирует подробный отчет
"""

import asyncio
import time
import json
import sys
from datetime import datetime
from typing import Dict, List

# Импорты тестовых модулей
from test_performance import PerformanceTester
from test_websocket_load import WebSocketLoadTester

# Импорты проекта
import config


class TestRunner:
    def __init__(self):
        self.start_time = None
        self.all_results = []
        
    async def run_all_tests(self):
        """Запуск всех доступных тестов производительности"""
        print("🚀 ЗАПУСК ВСЕХ ТЕСТОВ ПРОИЗВОДИТЕЛЬНОСТИ pixel-battle")
        print("=" * 60)
        print(f"🕐 Начало тестирования: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        self.start_time = time.time()
        
        # Инициализируем конфигурацию
        await self._initialize_test_environment()
        
        # 1. Основные тесты производительности
        print("\n🔧 Запуск основных тестов производительности...")
        performance_tester = PerformanceTester()
        performance_results = await performance_tester.run_all_tests()
        self.all_results.extend([("Performance", r) for r in performance_results])
        
        # 2. Нагрузочные тесты WebSocket
        print("\n🔌 Запуск нагрузочных тестов WebSocket...")
        websocket_tester = WebSocketLoadTester()
        websocket_results = await websocket_tester.run_load_tests()
        self.all_results.extend([("WebSocket Load", r) for r in websocket_results])
        
        # 3. Генерация отчета
        self._generate_comprehensive_report()
        
        # 4. Сохранение результатов в файл
        await self._save_results_to_file()
        
        total_time = time.time() - self.start_time
        print(f"\n🎉 Все тесты завершены за {total_time:.2f} секунд!")
        
        return self.all_results
    
    async def _initialize_test_environment(self):
        """Инициализация тестового окружения"""
        print("🔧 Инициализация тестового окружения...")
        
        # Создаем оптимизированный холст для тестов
        if not hasattr(config, 'canvas') or config.canvas is None:
            config.canvas = config.OptimizedCanvas(config.CANVAS_WIDTH, config.CANVAS_HEIGHT)
        
        # Заполняем немного данными для реалистичности тестов
        print("📊 Заполнение тестовыми данными...")
        for i in range(1000):
            x = i % config.CANVAS_WIDTH
            y = (i // config.CANVAS_WIDTH) % config.CANVAS_HEIGHT
            color = config.colors[i % len(config.colors)] if config.colors else "#FF0000"
            config.canvas.set_pixel(x, y, color)
        
        print(f"✅ Тестовое окружение готово. Активных пикселей: {config.canvas.get_pixels_count()}")
    
    def _generate_comprehensive_report(self):
        """Генерация комплексного отчета по всем тестам"""
        print("\n" + "="*80)
        print("📊 КОМПЛЕКСНЫЙ ОТЧЕТ ПО ПРОИЗВОДИТЕЛЬНОСТИ")
        print("="*80)
        
        # Статистика по категориям
        categories_stats = {}
        
        for test_type, result in self.all_results:
            if test_type not in categories_stats:
                categories_stats[test_type] = {
                    'total_tests': 0,
                    'total_duration': 0,
                    'operations_per_second': [],
                    'memory_usage': []
                }
            
            stats = categories_stats[test_type]
            stats['total_tests'] += 1
            
            if hasattr(result, 'duration'):
                stats['total_duration'] += result.duration
            
            if hasattr(result, 'operations_per_second') and result.operations_per_second > 0:
                stats['operations_per_second'].append(result.operations_per_second)
                
            if hasattr(result, 'memory_used') and result.memory_used > 0:
                stats['memory_usage'].append(result.memory_used)
        
        # Вывод статистики по категориям
        for category, stats in categories_stats.items():
            print(f"\n🔍 Категория: {category}")
            print("-" * 40)
            print(f"  📋 Всего тестов: {stats['total_tests']}")
            print(f"  ⏱️  Общее время: {stats['total_duration']:.3f}s")
            
            if stats['operations_per_second']:
                avg_ops = sum(stats['operations_per_second']) / len(stats['operations_per_second'])
                max_ops = max(stats['operations_per_second'])
                print(f"  🚀 Производительность: средняя {avg_ops:.1f} ops/s, макс {max_ops:.1f} ops/s")
            
            if stats['memory_usage']:
                total_memory = sum(stats['memory_usage'])
                avg_memory = total_memory / len(stats['memory_usage'])
                print(f"  🧠 Память: общая {total_memory/1024:.1f}KB, средняя {avg_memory/1024:.1f}KB")
        
        # Ключевые достижения
        self._print_key_achievements()
        
        # Рекомендации
        self._print_recommendations()
    
    def _print_key_achievements(self):
        """Вывод ключевых достижений оптимизации"""
        print("\n🏆 КЛЮЧЕВЫЕ ДОСТИЖЕНИЯ ОПТИМИЗАЦИИ:")
        print("-" * 40)
        
        # Поиск сравнительных результатов
        optimized_results = []
        legacy_results = []
        
        for test_type, result in self.all_results:
            if hasattr(result, 'name'):
                if 'Optimized' in result.name or 'OptimizedCanvas' in result.name:
                    optimized_results.append(result)
                elif 'Legacy' in result.name:
                    legacy_results.append(result)
        
        # Сравнение производительности
        if optimized_results and legacy_results:
            print("  ⚡ Улучшения производительности:")
            
            for opt_result in optimized_results:
                for leg_result in legacy_results:
                    if self._are_comparable_tests(opt_result.name, leg_result.name):
                        if hasattr(opt_result, 'duration') and hasattr(leg_result, 'duration'):
                            if opt_result.duration > 0:
                                speedup = leg_result.duration / opt_result.duration
                                print(f"    • {self._extract_test_name(opt_result.name)}: {speedup:.1f}x быстрее")
                        
                        if hasattr(opt_result, 'memory_used') and hasattr(leg_result, 'memory_used'):
                            if opt_result.memory_used > 0:
                                memory_improvement = leg_result.memory_used / opt_result.memory_used
                                print(f"    • {self._extract_test_name(opt_result.name)}: {memory_improvement:.1f}x меньше памяти")
        
        # Другие достижения
        print("  🎯 Дополнительные достижения:")
        
        # Поиск лучших результатов
        best_throughput = 0
        best_throughput_test = None
        
        for test_type, result in self.all_results:
            if hasattr(result, 'operations_per_second') and result.operations_per_second > best_throughput:
                best_throughput = result.operations_per_second
                best_throughput_test = result.name if hasattr(result, 'name') else f"{test_type} test"
        
        if best_throughput_test:
            print(f"    • Максимальная пропускная способность: {best_throughput:.1f} ops/s ({best_throughput_test})")
        
        # Статистика по активным пикселям
        if hasattr(config.canvas, 'get_pixels_count'):
            active_pixels = config.canvas.get_pixels_count()
            total_possible = config.CANVAS_WIDTH * config.CANVAS_HEIGHT
            efficiency = (active_pixels / total_possible) * 100
            print(f"    • Эффективность памяти: {100 - efficiency:.1f}% экономии (хранится только {active_pixels} из {total_possible} пикселей)")
    
    def _print_recommendations(self):
        """Вывод рекомендаций по дальнейшей оптимизации"""
        print("\n💡 РЕКОМЕНДАЦИИ ПО ДАЛЬНЕЙШЕЙ ОПТИМИЗАЦИИ:")
        print("-" * 40)
        
        # Анализ результатов для рекомендаций
        slow_tests = []
        memory_hungry_tests = []
        
        for test_type, result in self.all_results:
            if hasattr(result, 'duration') and result.duration > 1.0:  # Медленные тесты > 1 секунды
                slow_tests.append((test_type, result))
            
            if hasattr(result, 'memory_used') and result.memory_used > 10 * 1024 * 1024:  # > 10MB
                memory_hungry_tests.append((test_type, result))
        
        if slow_tests:
            print("  🐌 Медленные операции для оптимизации:")
            for test_type, result in slow_tests[:3]:  # Топ-3 медленных
                name = result.name if hasattr(result, 'name') else f"{test_type} test"
                print(f"    • {name}: {result.duration:.3f}s")
        
        if memory_hungry_tests:
            print("  🧠 Операции с высоким потреблением памяти:")
            for test_type, result in memory_hungry_tests[:3]:  # Топ-3 памятиемких
                name = result.name if hasattr(result, 'name') else f"{test_type} test"
                print(f"    • {name}: {result.memory_used/1024/1024:.1f}MB")
        
        # Общие рекомендации
        print("  🎯 Общие рекомендации:")
        print("    • Рассмотрите использование Redis для кэширования при масштабировании")
        print("    • Добавьте компрессию для WebSocket сообщений при больших объемах")
        print("    • Настройте мониторинг производительности в продакшене")
        print("    • Рассмотрите горизонтальное масштабирование при >1000 одновременных пользователей")
    
    def _are_comparable_tests(self, name1: str, name2: str) -> bool:
        """Проверяет, можно ли сравнивать два теста"""
        # Убираем префиксы для сравнения
        base1 = name1.replace("OptimizedCanvas - ", "").replace("Optimized ", "").replace("Legacy ", "").replace("LegacyCanvas - ", "")
        base2 = name2.replace("OptimizedCanvas - ", "").replace("Optimized ", "").replace("Legacy ", "").replace("LegacyCanvas - ", "")
        
        # Проверяем схожесть названий
        return base1.lower() in base2.lower() or base2.lower() in base1.lower()
    
    def _extract_test_name(self, full_name: str) -> str:
        """Извлекает краткое название теста"""
        return full_name.replace("OptimizedCanvas - ", "").replace("Optimized ", "").split(" (")[0]
    
    async def _save_results_to_file(self):
        """Сохранение результатов в JSON файл"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"performance_report_{timestamp}.json"
        
        # Подготовка данных для сохранения
        report_data = {
            "timestamp": datetime.now().isoformat(),
            "total_duration": time.time() - self.start_time,
            "system_info": {
                "canvas_size": f"{config.CANVAS_WIDTH}x{config.CANVAS_HEIGHT}",
                "cooldown_time": config.COOLDOWN_TIME,
                "active_pixels": config.canvas.get_pixels_count() if hasattr(config.canvas, 'get_pixels_count') else 0
            },
            "tests": []
        }
        
        for test_type, result in self.all_results:
            test_data = {
                "category": test_type,
                "name": getattr(result, 'name', 'Unknown'),
                "duration": getattr(result, 'duration', 0),
                "memory_used": getattr(result, 'memory_used', 0),
                "operations_per_second": getattr(result, 'operations_per_second', 0)
            }
            
            # Добавляем дополнительную информацию если есть
            if hasattr(result, 'additional_info'):
                test_data["additional_info"] = result.additional_info
            
            # Для WebSocket тестов добавляем специфичные поля
            if hasattr(result, 'total_clients'):
                test_data.update({
                    "total_clients": result.total_clients,
                    "successful_connections": result.successful_connections,
                    "total_messages_sent": result.total_messages_sent,
                    "total_messages_received": result.total_messages_received,
                    "average_response_time": result.average_response_time
                })
            
            report_data["tests"].append(test_data)
        
        # Сохранение в файл
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Подробный отчет сохранен в файл: {filename}")
            
        except Exception as e:
            print(f"\n❌ Ошибка сохранения отчета: {e}")


async def main():
    """Главная функция запуска всех тестов"""
    try:
        runner = TestRunner()
        results = await runner.run_all_tests()
        
        print(f"\n✅ Тестирование успешно завершено!")
        print(f"📊 Всего выполнено {len(results)} тестов")
        
        return 0
        
    except KeyboardInterrupt:
        print("\n🛑 Тестирование прервано пользователем")
        return 1
    except Exception as e:
        print(f"\n❌ Ошибка при выполнении тестов: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))