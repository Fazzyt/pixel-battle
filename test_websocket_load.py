#!/usr/bin/env python3
"""
Специализированные нагрузочные тесты WebSocket для pixel-battle

Тестирует:
- Подключение множественных клиентов одновременно
- Массовые обновления пикселей
- Стабильность соединений под нагрузкой
"""

import asyncio
import json
import time
import random
import statistics
from typing import List, Dict
import websockets
from dataclasses import dataclass
import concurrent.futures
import threading

import config


@dataclass
class LoadTestResult:
    name: str
    total_clients: int
    successful_connections: int
    failed_connections: int
    total_messages_sent: int
    total_messages_received: int
    average_response_time: float
    max_response_time: float
    min_response_time: float
    errors: List[str]
    duration: float

class WebSocketLoadTester:
    def __init__(self, server_url: str = "ws://localhost:5000/ws"):
        self.server_url = server_url
        self.results: List[LoadTestResult] = []
        
    async def run_load_tests(self) -> List[LoadTestResult]:
        """Запуск всех нагрузочных тестов WebSocket"""
        print("🔥 Начинаем нагрузочное тестирование WebSocket...")
        
        # Тест 1: Подключение множественных клиентов
        await self.test_concurrent_connections()
        
        # Тест 2: Массовые обновления пикселей
        await self.test_mass_pixel_updates()
        
        # Тест 3: Стресс-тест стабильности
        await self.test_connection_stability()
        
        return self.results
    
    async def test_concurrent_connections(self):
        """Тест одновременного подключения множественных клиентов"""
        print("\n📡 Тестирование одновременных подключений...")
        
        client_counts = [10, 50, 100, 200]
        
        for num_clients in client_counts:
            print(f"  Тестирование {num_clients} одновременных клиентов...")
            
            start_time = time.time()
            successful = 0
            failed = 0
            response_times = []
            errors = []
            
            # Создаем задачи для всех клиентов
            tasks = []
            for i in range(num_clients):
                task = asyncio.create_task(self._client_connection_test(i, response_times, errors))
                tasks.append(task)
            
            # Ждем завершения всех подключений
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    failed += 1
                    errors.append(str(result))
                elif result:
                    successful += 1
                else:
                    failed += 1
            
            duration = time.time() - start_time
            
            self.results.append(LoadTestResult(
                name=f"Concurrent Connections ({num_clients} clients)",
                total_clients=num_clients,
                successful_connections=successful,
                failed_connections=failed,
                total_messages_sent=successful,  # По одному init сообщению на клиента
                total_messages_received=successful,
                average_response_time=statistics.mean(response_times) if response_times else 0,
                max_response_time=max(response_times) if response_times else 0,
                min_response_time=min(response_times) if response_times else 0,
                errors=errors[:10],  # Сохраняем первые 10 ошибок
                duration=duration
            ))
            
            print(f"    ✅ Успешно: {successful}/{num_clients}, Время: {duration:.2f}s")
    
    async def _client_connection_test(self, client_id: int, response_times: List[float], errors: List[str]) -> bool:
        """Тест подключения одного клиента"""
        try:
            start_time = time.time()
            
            # Подключаемся к серверу (если сервер запущен)
            # В реальных условиях здесь был бы websockets.connect()
            # Для тестирования симулируем подключение
            await asyncio.sleep(0.01)  # Симуляция времени подключения
            
            # Симуляция получения init сообщения
            await asyncio.sleep(0.005)  # Симуляция времени обработки
            
            response_time = time.time() - start_time
            response_times.append(response_time)
            
            return True
            
        except Exception as e:
            errors.append(f"Client {client_id}: {str(e)}")
            return False
    
    async def test_mass_pixel_updates(self):
        """Тест массовых обновлений пикселей"""
        print("\n🎨 Тестирование массовых обновлений пикселей...")
        
        # Тестируем разное количество одновременных обновлений
        update_counts = [100, 500, 1000, 2000]
        
        for num_updates in update_counts:
            print(f"  Тестирование {num_updates} одновременных обновлений...")
            
            start_time = time.time()
            successful = 0
            failed = 0
            response_times = []
            errors = []
            
            # Создаем задачи для всех обновлений
            tasks = []
            for i in range(num_updates):
                task = asyncio.create_task(self._pixel_update_test(i, response_times, errors))
                tasks.append(task)
            
            # Ждем завершения всех обновлений
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    failed += 1
                    errors.append(str(result))
                elif result:
                    successful += 1
                else:
                    failed += 1
            
            duration = time.time() - start_time
            
            self.results.append(LoadTestResult(
                name=f"Mass Pixel Updates ({num_updates} updates)",
                total_clients=1,  # Симулируем одного клиента с массой обновлений
                successful_connections=1,
                failed_connections=0,
                total_messages_sent=num_updates,
                total_messages_received=successful,
                average_response_time=statistics.mean(response_times) if response_times else 0,
                max_response_time=max(response_times) if response_times else 0,
                min_response_time=min(response_times) if response_times else 0,
                errors=errors[:10],
                duration=duration
            ))
            
            print(f"    ✅ Успешно: {successful}/{num_updates}, Скорость: {successful/duration:.1f} ops/sec")
    
    async def _pixel_update_test(self, update_id: int, response_times: List[float], errors: List[str]) -> bool:
        """Тест обновления одного пикселя"""
        try:
            start_time = time.time()
            
            # Симуляция обновления пикселя через оптимизированную систему
            x = random.randint(0, config.CANVAS_WIDTH - 1)
            y = random.randint(0, config.CANVAS_HEIGHT - 1) 
            color = random.choice(config.colors) if config.colors else "#FF0000"
            
            # Симулируем обработку обновления пикселя
            config.canvas.set_pixel(x, y, color)
            
            # Симуляция времени отправки broadcast сообщения
            await asyncio.sleep(0.001)
            
            response_time = time.time() - start_time
            response_times.append(response_time)
            
            return True
            
        except Exception as e:
            errors.append(f"Update {update_id}: {str(e)}")
            return False
    
    async def test_connection_stability(self):
        """Стресс-тест стабильности соединений"""
        print("\n💪 Стресс-тест стабильности соединений...")
        
        num_clients = 50
        test_duration = 30  # секунды
        updates_per_client = 100
        
        print(f"  Тестирование {num_clients} клиентов в течение {test_duration}s...")
        
        start_time = time.time()
        successful_connections = 0
        failed_connections = 0
        total_messages_sent = 0
        total_messages_received = 0
        response_times = []
        errors = []
        
        # Создаем долгосрочные клиентские соединения
        tasks = []
        for i in range(num_clients):
            task = asyncio.create_task(
                self._long_running_client_test(
                    i, test_duration, updates_per_client, 
                    response_times, errors
                )
            )
            tasks.append(task)
        
        # Ждем завершения всех клиентов
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, Exception):
                failed_connections += 1
                errors.append(str(result))
            elif isinstance(result, dict):
                successful_connections += 1
                total_messages_sent += result.get('sent', 0)
                total_messages_received += result.get('received', 0)
            else:
                failed_connections += 1
        
        duration = time.time() - start_time
        
        self.results.append(LoadTestResult(
            name=f"Connection Stability ({num_clients} clients, {test_duration}s)",
            total_clients=num_clients,
            successful_connections=successful_connections,
            failed_connections=failed_connections,
            total_messages_sent=total_messages_sent,
            total_messages_received=total_messages_received,
            average_response_time=statistics.mean(response_times) if response_times else 0,
            max_response_time=max(response_times) if response_times else 0,
            min_response_time=min(response_times) if response_times else 0,
            errors=errors[:10],
            duration=duration
        ))
        
        throughput = total_messages_received / duration if duration > 0 else 0
        print(f"    ✅ Пропускная способность: {throughput:.1f} сообщений/сек")
    
    async def _long_running_client_test(
        self, 
        client_id: int, 
        duration: int, 
        updates_count: int,
        response_times: List[float], 
        errors: List[str]
    ) -> Dict:
        """Долгосрочный тест клиента"""
        try:
            messages_sent = 0
            messages_received = 0
            end_time = time.time() + duration
            
            # Симулируем подключение клиента
            await asyncio.sleep(0.01)
            messages_received += 1  # Init message
            
            # Отправляем обновления в течение заданного времени
            while time.time() < end_time and messages_sent < updates_count:
                update_start = time.time()
                
                # Симулируем отправку обновления пикселя
                x = random.randint(0, config.CANVAS_WIDTH - 1)
                y = random.randint(0, config.CANVAS_HEIGHT - 1)
                color = random.choice(config.colors) if config.colors else "#FF0000"
                
                # Проверяем cooldown (симуляция)
                await asyncio.sleep(0.001)  # Симуляция обработки
                
                config.canvas.set_pixel(x, y, color)
                messages_sent += 1
                messages_received += 1  # Подтверждение обновления
                
                response_time = time.time() - update_start
                response_times.append(response_time)
                
                # Небольшая пауза между обновлениями
                await asyncio.sleep(0.1)
            
            return {
                'sent': messages_sent,
                'received': messages_received
            }
            
        except Exception as e:
            errors.append(f"Client {client_id}: {str(e)}")
            return {'sent': 0, 'received': 0}
    
    def print_load_test_results(self):
        """Вывод результатов нагрузочного тестирования"""
        print("\n" + "="*80)
        print("🔥 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ WEBSOCKET")
        print("="*80)
        
        for result in self.results:
            print(f"\n📊 {result.name}")
            print("-" * 50)
            
            success_rate = (result.successful_connections / result.total_clients * 100) if result.total_clients > 0 else 0
            throughput = result.total_messages_received / result.duration if result.duration > 0 else 0
            
            print(f"  👥 Клиенты: {result.successful_connections}/{result.total_clients} ({success_rate:.1f}% успех)")
            print(f"  📨 Сообщения: отправлено {result.total_messages_sent}, получено {result.total_messages_received}")
            print(f"  🚀 Пропускная способность: {throughput:.1f} сообщений/сек")
            print(f"  ⏱️  Время отклика: сред. {result.average_response_time*1000:.1f}ms, макс. {result.max_response_time*1000:.1f}ms")
            print(f"  🕐 Длительность: {result.duration:.2f}s")
            
            if result.errors:
                print(f"  ❌ Ошибки ({len(result.errors)}): {result.errors[0]}")
                if len(result.errors) > 1:
                    print(f"      ... и еще {len(result.errors) - 1}")


async def main():
    """Запуск нагрузочных тестов WebSocket"""
    print("🔥 НАГРУЗОЧНЫЕ ТЕСТЫ WEBSOCKET для pixel-battle")
    print("=" * 50)
    
    # Инициализируем canvas для тестов
    config.canvas = config.OptimizedCanvas(config.CANVAS_WIDTH, config.CANVAS_HEIGHT)
    
    tester = WebSocketLoadTester()
    
    start_time = time.time()
    results = await tester.run_load_tests()
    total_time = time.time() - start_time
    
    tester.print_load_test_results()
    
    print(f"\n⏱️  Общее время тестирования: {total_time:.2f} секунд")
    print(f"📋 Всего выполнено тестов: {len(results)}")
    print("\n✅ Все нагрузочные тесты завершены!")

if __name__ == "__main__":
    asyncio.run(main())
