/**
 * Монитор производительности клиента
 * 
 * Отслеживает FPS, память, время рендеринга и другие метрики
 */

import { appState } from '../modules/StateManager.js';

export class PerformanceMonitor {
    constructor() {
        this.isRunning = false;
        this.metrics = {
            fps: 0,
            frameTime: 0,
            memoryUsed: 0,
            renderTime: 0,
            pixelsRendered: 0,
            connectionLatency: 0,
            cacheHitRatio: 0
        };
        
        // Счетчики
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.lastMemoryCheck = 0;
        this.frameTimeSamples = [];
        this.maxSamples = 60; // Сохраняем последние 60 кадров
        
        // Интервалы обновления
        this.fpsUpdateInterval = 1000; // 1 секунда
        this.memoryUpdateInterval = 5000; // 5 секунд
        this.metricsUpdateInterval = 1000; // 1 секунда
        
        // Таймеры
        this.timers = {
            metrics: null,
            memory: null
        };
        
        this.setupStateListeners();
    }
    
    /**
     * Запуск мониторинга
     */
    start() {
        if (this.isRunning) return;
        
        console.log('📊 Starting performance monitor');
        this.isRunning = true;
        
        // Запускаем мониторинг FPS
        this.startFrameMonitoring();
        
        // Запускаем мониторинг памяти
        this.startMemoryMonitoring();
        
        // Запускаем общий мониторинг метрик
        this.startMetricsMonitoring();
        
        // Подписываемся на показ/скрытие статистики
        this.setupDisplayToggle();
    }
    
    /**
     * Остановка мониторинга
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log('📊 Stopping performance monitor');
        this.isRunning = false;
        
        // Очищаем таймеры
        Object.values(this.timers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        
        // Скрываем дисплей
        this.hideStatsDisplay();
    }
    
    /**
     * Запуск мониторинга FPS
     */
    startFrameMonitoring() {
        const trackFrame = (timestamp) => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const frameTime = timestamp - this.lastFrameTime;
            
            // Добавляем время кадра в выборку
            this.frameTimeSamples.push(frameTime);
            if (this.frameTimeSamples.length > this.maxSamples) {
                this.frameTimeSamples.shift();
            }
            
            // Обновляем FPS каждую секунду
            if (timestamp - this.lastFrameTime >= this.fpsUpdateInterval) {
                this.updateFPS(timestamp);
                this.lastFrameTime = timestamp;
                this.frameCount = 0;
            }
            
            requestAnimationFrame(trackFrame);
        };
        
        requestAnimationFrame(trackFrame);
    }
    
    /**
     * Обновление FPS метрик
     */
    updateFPS(timestamp) {
        // Вычисляем средний FPS
        this.metrics.fps = Math.round(this.frameCount);
        
        // Вычисляем среднее время кадра
        if (this.frameTimeSamples.length > 0) {
            const avgFrameTime = this.frameTimeSamples.reduce((a, b) => a + b, 0) / this.frameTimeSamples.length;
            this.metrics.frameTime = Math.round(avgFrameTime * 100) / 100;
        }
        
        // Обновляем состояние
        appState.batchUpdate({
            'performance.fps': this.metrics.fps,
            'performance.frameTime': this.metrics.frameTime
        });
    }
    
    /**
     * Запуск мониторинга памяти
     */
    startMemoryMonitoring() {
        this.timers.memory = setInterval(() => {
            this.updateMemoryMetrics();
        }, this.memoryUpdateInterval);
    }
    
    /**
     * Обновление метрик памяти
     */
    updateMemoryMetrics() {
        if (performance.memory) {
            const memory = performance.memory;
            this.metrics.memoryUsed = Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100; // MB
            
            appState.set('performance.memoryUsage', this.metrics.memoryUsed);
        }
    }
    
    /**
     * Запуск общего мониторинга метрик
     */
    startMetricsMonitoring() {
        this.timers.metrics = setInterval(() => {
            this.updateGeneralMetrics();
        }, this.metricsUpdateInterval);
    }
    
    /**
     * Обновление общих метрик
     */
    updateGeneralMetrics() {
        // Получаем данные из состояния приложения
        const renderTime = appState.get('performance.renderTime') || 0;
        const pixelsRendered = appState.get('performance.pixelsRendered') || 0;
        
        this.metrics.renderTime = Math.round(renderTime * 100) / 100;
        this.metrics.pixelsRendered = pixelsRendered;
        
        // Вычисляем дополнительные метрики
        this.calculateDerivedMetrics();
    }
    
    /**
     * Вычисление производных метрик
     */
    calculateDerivedMetrics() {
        // Соотношение кэша (если доступно)
        const canvasState = appState.get('canvas');
        if (canvasState && canvasState.pixels) {
            const totalPixels = canvasState.pixels.size;
            const renderedPixels = this.metrics.pixelsRendered;
            
            if (totalPixels > 0) {
                this.metrics.cacheHitRatio = Math.round((renderedPixels / totalPixels) * 100);
            }
        }
        
        // Эффективность рендеринга (пиксели в миллисекунду)
        if (this.metrics.renderTime > 0) {
            this.metrics.renderEfficiency = Math.round(this.metrics.pixelsRendered / this.metrics.renderTime);
        } else {
            this.metrics.renderEfficiency = 0;
        }
    }
    
    /**
     * Настройка слушателей состояния
     */
    setupStateListeners() {
        // Слушаем изменения в производительности рендеринга
        appState.subscribe('performance', (performance) => {
            if (performance.renderTime !== undefined) {
                this.metrics.renderTime = performance.renderTime;
            }
            if (performance.pixelsRendered !== undefined) {
                this.metrics.pixelsRendered = performance.pixelsRendered;
            }
        });
    }
    
    /**
     * Настройка переключения отображения
     */
    setupDisplayToggle() {
        // Функциональность статистики убрана
    }
    
    /**
     * Запуск обновления дисплея
     */
    startStatsDisplay() {
        // Функциональность статистики убрана
    }
    
    /**
     * Обновление содержимого дисплея
     */
    updateStatsDisplay() {
        // Функциональность статистики убрана
    }
    
    /**
     * Получение цвета для FPS
     */
    getFPSColor(fps) {
        if (fps >= 60) return '#00ff00'; // Зеленый
        if (fps >= 30) return '#ffff00'; // Желтый
        if (fps >= 15) return '#ff8800'; // Оранжевый
        return '#ff0000'; // Красный
    }
    
    /**
     * Измерение латенции соединения
     */
    measureLatency() {
        if (!appState.get('connection.isConnected')) return;
        
        const startTime = performance.now();
        
        // Отправляем ping и ждем pong
        // (это должно быть интегрировано с WebSocket менеджером)
        // Пока что просто устанавливаем фиктивное значение
        this.metrics.connectionLatency = 50; // ms
    }
    
    /**
     * Запись событий производительности
     */
    recordPerformanceEvent(eventName, data = {}) {
        if (!this.isRunning) return;
        
        const event = {
            timestamp: performance.now(),
            name: eventName,
            metrics: { ...this.metrics },
            data
        };
        
        console.log('📈 Performance Event:', event);
        
        // В реальном приложении здесь можно отправлять данные на сервер аналитики
    }
    
    /**
     * Получение всех текущих метрик
     */
    getAllMetrics() {
        return {
            ...this.metrics,
            timestamp: performance.now()
        };
    }
    
    /**
     * Получение отчета о производительности
     */
    getPerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.getAllMetrics(),
            system: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                cores: navigator.hardwareConcurrency || 'unknown',
                memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'unknown'
            },
            canvas: {
                size: `${appState.get('canvas.scale') || 1}x`,
                pixelsActive: appState.get('canvas.pixels')?.size || 0,
                offsetX: appState.get('canvas.offsetX') || 0,
                offsetY: appState.get('canvas.offsetY') || 0
            },
            connection: {
                connected: appState.get('connection.isConnected'),
                onlineUsers: appState.get('connection.onlineUsers'),
                reconnectAttempts: appState.get('connection.reconnectAttempts')
            }
        };
        
        return report;
    }
    
    /**
     * Экспорт данных производительности
     */
    exportData() {
        const data = this.getPerformanceReport();
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * Сброс метрик
     */
    reset() {
        this.frameCount = 0;
        this.frameTimeSamples = [];
        this.metrics = {
            fps: 0,
            frameTime: 0,
            memoryUsed: 0,
            renderTime: 0,
            pixelsRendered: 0,
            connectionLatency: 0,
            cacheHitRatio: 0
        };
        
        console.log('📊 Performance metrics reset');
    }
    
    /**
     * Создание алерта при низкой производительности
     */
    checkPerformanceThresholds() {
        const { fps, memoryUsed, renderTime } = this.metrics;
        
        // Предупреждения о производительности
        if (fps < 15 && fps > 0) {
            this.triggerPerformanceWarning('low-fps', `Low FPS detected: ${fps}`);
        }
        
        if (memoryUsed > 500) { // 500MB
            this.triggerPerformanceWarning('high-memory', `High memory usage: ${memoryUsed}MB`);
        }
        
        if (renderTime > 50) { // 50ms
            this.triggerPerformanceWarning('slow-render', `Slow rendering: ${renderTime}ms`);
        }
    }
    
    /**
     * Триггер предупреждения о производительности
     */
    triggerPerformanceWarning(type, message) {
        console.warn(`⚠️ Performance Warning (${type}):`, message);
        
        // Можно добавить уведомление пользователю
        // NotificationSystem.warning(message, { duration: 3000 });
    }
}

// Создаем глобальный экземпляр
export const performanceMonitor = new PerformanceMonitor();
