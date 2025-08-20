/**
 * Высокопроизводительный движок рендеринга
 * 
 * Использует requestAnimationFrame, viewport culling и smart redraw
 */

import { appState } from './StateManager.js';

export class RenderEngine {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = config;
        
        console.log('🎨 RenderEngine constructor:', {
            canvas: this.canvas,
            context: !!this.ctx,
            canvasSize: { width: this.canvas.width, height: this.canvas.height },
            config: this.config
        });
        
        // Состояние рендеринга
        this.isRendering = false;
        this.needsRedraw = true;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fpsCounter = 0;
        
        // Viewport для оптимизации отрисовки
        this.viewport = {
            x: 0, y: 0, width: 0, height: 0
        };
        
        // Буферы для оптимизации
        this.pixelBuffer = new Map();
        this.dirtyRegions = new Set();
        
        // Метрики производительности
        this.performanceMetrics = {
            fps: 0,
            renderTime: 0,
            pixelsRendered: 0,
            cullRatio: 0
        };
        
        // Throttled функции
        this.throttledRender = this.throttle(this.render.bind(this), 16); // 60 FPS
        
        this.setupEventListeners();
        this.startRenderLoop();
    }
    
    /**
     * Запуск основного цикла рендеринга
     */
    startRenderLoop() {
        console.log('🎬 Starting render loop');
        
        const renderFrame = (timestamp) => {
            this.updatePerformanceMetrics(timestamp);
            
            if (this.needsRedraw && !this.isRendering) {
                this.render();
            }
            
            requestAnimationFrame(renderFrame);
        };
        
        requestAnimationFrame(renderFrame);
        console.log('🎬 Render loop started with requestAnimationFrame');
    }
    
    /**
     * Основная функция рендеринга с оптимизациями
     */
    render() {
        const startTime = performance.now();
        this.isRendering = true;
        
        const state = appState.get('canvas');
        console.log('🎨 Rendering frame:', {
            needsRedraw: this.needsRedraw,
            canvasState: state,
            pixelsCount: state?.pixels?.size || 0
        });
        const { scale, offsetX, offsetY, pixels, selectedPixel } = state;
        
        // Обновляем размеры холста если нужно
        this.updateCanvasSize();
        
        // Вычисляем viewport для culling
        this.updateViewport(scale, offsetX, offsetY);
        
        // Рисуем фон (включает очистку canvas)
        this.renderBackground(scale, offsetX, offsetY);
        
        // Рисуем пиксели с viewport culling
        const renderedPixels = this.renderPixels(pixels, scale, offsetX, offsetY);
        
        // Рисуем выделенный пиксель
        if (selectedPixel) {
            this.renderSelectedPixel(selectedPixel, scale, offsetX, offsetY);
        }
        
        // Обновляем метрики
        const renderTime = performance.now() - startTime;
        this.updateRenderMetrics(renderTime, renderedPixels);
        
        this.needsRedraw = false;
        this.isRendering = false;
    }
    
    /**
     * Рендеринг фона
     */
    renderBackground(scale, offsetX, offsetY) {
        // Очищаем весь canvas перед рисованием фона
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем серый фон для ВСЕГО экрана
        this.ctx.fillStyle = '#808080';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Теперь рисуем основной фон канваса поверх
        const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE * scale;
        const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE * scale;
        
        // Рисуем основной фон канваса белым цветом
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(
            offsetX,
            offsetY,
            logicalCanvasWidth,
            logicalCanvasHeight
        );
        
        // Заполняем все пустые области серым цветом
        // Справа от канваса
        if (offsetX + logicalCanvasWidth < this.canvas.width) {
            this.ctx.fillStyle = '#808080';
            this.ctx.fillRect(
                offsetX + logicalCanvasWidth,
                0,
                this.canvas.width - (offsetX + logicalCanvasWidth),
                this.canvas.height
            );
        }
        
        // Слева от канваса
        if (offsetX > 0) {
            this.ctx.fillStyle = '#808080';
            this.ctx.fillRect(
                0,
                0,
                offsetX,
                this.canvas.height
            );
        }
        
        // Сверху от канваса
        if (offsetY > 0) {
            this.ctx.fillStyle = '#808080';
            this.ctx.fillRect(
                0,
                0,
                this.canvas.width,
                offsetY
            );
        }
        
        // Снизу от канваса
        if (offsetY + logicalCanvasHeight < this.canvas.height) {
            this.ctx.fillStyle = '#808080';
            this.ctx.fillRect(
                0,
                offsetY + logicalCanvasHeight,
                this.canvas.width,
                this.canvas.height - (offsetY + logicalCanvasHeight)
            );
        }
    }
    
    /**
     * Рендеринг пикселей с viewport culling
     */
    renderPixels(pixels, scale, offsetX, offsetY) {
        const pixelSize = this.config.PIXEL_SIZE * scale;
        let renderedCount = 0;
        let culledCount = 0;
        
        for (const [coord, color] of pixels) {
            const [x, y] = coord.split(',').map(Number);
            
            // Viewport culling - не рисуем пиксели вне экрана
            const pixelScreenX = offsetX + x * pixelSize;
            const pixelScreenY = offsetY + y * pixelSize;
            
            if (this.isPixelInViewport(pixelScreenX, pixelScreenY, pixelSize)) {
                this.ctx.fillStyle = color;
                this.ctx.fillRect(pixelScreenX, pixelScreenY, pixelSize, pixelSize);
                renderedCount++;
            } else {
                culledCount++;
            }
        }
        
        // Обновляем коэффициент culling
        const totalPixels = renderedCount + culledCount;
        this.performanceMetrics.cullRatio = totalPixels > 0 ? culledCount / totalPixels : 0;
        
        return renderedCount;
    }
    
    /**
     * Рендеринг выделенного пикселя
     */
    renderSelectedPixel(selectedPixel, scale, offsetX, offsetY) {
        const pixelSize = this.config.PIXEL_SIZE * scale;
        const x = offsetX + selectedPixel.x * pixelSize;
        const y = offsetY + selectedPixel.y * pixelSize;
        
        // Анимированная подсветка
        const time = Date.now() * 0.005;
        const alpha = 0.3 + 0.2 * Math.sin(time);
        
        this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        this.ctx.fillRect(x, y, pixelSize, pixelSize);
        
        // Рамка
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = Math.max(1, scale * 0.5);
        this.ctx.strokeRect(x, y, pixelSize, pixelSize);
    }
    
    /**
     * Проверка, находится ли пиксель в viewport
     */
    isPixelInViewport(x, y, size) {
        return !(x + size < 0 || y + size < 0 || 
                x > this.canvas.width || y > this.canvas.height);
    }
    
    /**
     * Обновление viewport
     */
    updateViewport(scale, offsetX, offsetY) {
        this.viewport = {
            x: -offsetX / scale,
            y: -offsetY / scale,
            width: this.canvas.width / scale,
            height: this.canvas.height / scale
        };
    }
    
    /**
     * Обновление размеров холста
     */
    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        if (this.canvas.width !== rect.width * dpr || 
            this.canvas.height !== rect.height * dpr) {
            
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            
            this.ctx.scale(dpr, dpr);
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            
            this.needsRedraw = true;
        }
    }
    
    /**
     * Обновление метрик производительности
     */
    updatePerformanceMetrics(timestamp) {
        this.frameCount++;
        
        if (timestamp - this.lastFrameTime >= 1000) {
            this.performanceMetrics.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = timestamp;
            
            // Обновляем состояние
            appState.set('performance.fps', this.performanceMetrics.fps);
        }
    }
    
    /**
     * Обновление метрик рендеринга
     */
    updateRenderMetrics(renderTime, pixelsRendered) {
        this.performanceMetrics.renderTime = renderTime;
        this.performanceMetrics.pixelsRendered = pixelsRendered;
        
        // Обновляем состояние
        appState.batchUpdate({
            'performance.renderTime': renderTime,
            'performance.pixelsRendered': pixelsRendered,
            'performance.cullRatio': this.performanceMetrics.cullRatio
        });
    }
    
    /**
     * Принудительная перерисовка
     */
    forceRedraw() {
        this.needsRedraw = true;
    }
    
    /**
     * Установка слушателей событий состояния
     */
    setupEventListeners() {
        // Подписываемся на изменения состояния холста
        appState.subscribe('canvas', () => {
            this.needsRedraw = true;
        });
        
        // Обработка изменения размеров окна
        window.addEventListener('resize', () => {
            this.needsRedraw = true;
        });
    }
    
    /**
     * Throttle функция для ограничения частоты вызовов
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Получение текущих метрик производительности
     */
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }
    
    /**
     * Очистка ресурсов
     */
    dispose() {
        // Отписываемся от событий состояния
        // (в реальном приложении здесь были бы unsubscribe функции)
        this.isRendering = false;
    }
}
