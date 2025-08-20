/**
 * Продвинутый контроллер ввода
 * 
 * Поддерживает мышь, тач, клавиатуру с жестами и горячими клавишами
 */

import { appState } from './StateManager.js';

export class InputController {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config;
        
        // Состояние ввода
        this.inputState = {
            mouse: { x: 0, y: 0, buttons: 0 },
            touch: { touches: [], lastDistance: 0 },
            keyboard: { keys: new Set() },
            gestures: { 
                isDragging: false, 
                isZooming: false,
                dragStart: null,
                zoomStart: null
            }
        };
        
        // Настройки управления
        this.settings = {
            dragButton: 2, // Правая кнопка мыши
            zoomSensitivity: 0.1,
            dragSensitivity: 1,
            touchZoomSensitivity: 0.005,
            keyboardZoomStep: 0.1,
            keyboardMoveStep: 50,
            doubleClickTime: 300,
            longPressTime: 500
        };
        
        // Таймеры
        this.timers = {
            doubleClick: null,
            longPress: null
        };
        
        // Throttled функции
        this.throttledMouseMove = this.throttle(this.handleMouseMove.bind(this), 16);
        this.throttledTouchMove = this.throttle(this.handleTouchMove.bind(this), 16);
        
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }
    
    /**
     * Настройка слушателей событий
     */
    setupEventListeners() {
        // События мыши
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.throttledMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        
        // События тач
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.throttledTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
        
        // События клавиатуры
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // События окна
        window.addEventListener('blur', this.handleWindowBlur.bind(this));
        window.addEventListener('resize', this.handleWindowResize.bind(this));
    }
    
    /**
     * Обработка нажатия мыши
     */
    handleMouseDown(event) {
        event.preventDefault();
        
        this.inputState.mouse.buttons = event.buttons;
        this.updateMousePosition(event);
        
        const canvasPos = this.screenToCanvas(event.clientX, event.clientY);
        
        if (event.button === 0) { // Левая кнопка
            if (canvasPos) {
                this.handlePixelSelection(canvasPos);
                this.handleDoubleClick(event);
            }
        } else if (event.button === this.settings.dragButton) { // Правая кнопка
            this.startDragging(event);
        }
    }
    
    /**
     * Обработка движения мыши
     */
    handleMouseMove(event) {
        this.updateMousePosition(event);
        
        const canvasPos = this.screenToCanvas(event.clientX, event.clientY);
        
        // Обновляем координаты в состоянии только если они валидны
        if (canvasPos) {
            appState.set('ui.cursorPosition', canvasPos);
        } else {
            appState.set('ui.cursorPosition', null);
        }
        
        // Обработка перетаскивания
        if (this.inputState.gestures.isDragging) {
            this.updateDragPosition(event);
        }
    }
    
    /**
     * Обработка отпускания мыши
     */
    handleMouseUp(event) {
        this.inputState.mouse.buttons = event.buttons;
        
        if (event.button === this.settings.dragButton) {
            this.stopDragging();
        }
    }
    
    /**
     * Обработка колесика мыши
     */
    handleWheel(event) {
        event.preventDefault();
        
        const delta = -Math.sign(event.deltaY);
        const zoomFactor = 1 + this.settings.zoomSensitivity * delta;
        
        const mousePos = { x: event.clientX, y: event.clientY };
        
        console.log('🖱️ Mouse wheel:', {
            deltaY: event.deltaY,
            delta,
            zoomFactor,
            mousePos,
            currentScale: appState.get('canvas.scale')
        });
        
        this.zoomAtPoint(mousePos, zoomFactor);
    }
    
    /**
     * Обработка начала тач
     */
    handleTouchStart(event) {
        event.preventDefault();
        
        this.inputState.touch.touches = Array.from(event.touches);
        
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const canvasPos = this.screenToCanvas(touch.clientX, touch.clientY);
            if (canvasPos) {
                this.handlePixelSelection(canvasPos);
                this.startLongPress(touch);
            }
        } else if (event.touches.length === 2) {
            this.startTouchZoom(event.touches);
        }
    }
    
    /**
     * Обработка движения тач
     */
    handleTouchMove(event) {
        event.preventDefault();
        
        this.inputState.touch.touches = Array.from(event.touches);
        
        if (event.touches.length === 1 && !this.inputState.gestures.isZooming) {
            const touch = event.touches[0];
            const canvasPos = this.screenToCanvas(touch.clientX, touch.clientY);
            if (canvasPos) {
                this.handleTouchDrag(touch);
            }
        } else if (event.touches.length === 2) {
            this.handleTouchZoom(event.touches);
        }
        
        // Отменяем long press при движении
        this.cancelLongPress();
    }
    
    /**
     * Обработка окончания тач
     */
    handleTouchEnd(event) {
        event.preventDefault();
        
        this.inputState.touch.touches = Array.from(event.touches);
        
        if (event.touches.length === 0) {
            this.stopAllGestures();
        } else if (event.touches.length === 1) {
            this.inputState.gestures.isZooming = false;
        }
        
        this.cancelLongPress();
    }
    
    /**
     * Обработка нажатия клавиш
     */
    handleKeyDown(event) {
        this.inputState.keyboard.keys.add(event.code);
        
        // Предотвращаем действия браузера для некоторых клавиш
        const preventKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (preventKeys.includes(event.code)) {
            event.preventDefault();
        }
        
        this.handleKeyboardShortcuts(event);
    }
    
    /**
     * Обработка отпускания клавиш
     */
    handleKeyUp(event) {
        this.inputState.keyboard.keys.delete(event.code);
    }
    
    /**
     * Выбор пикселя
     */
    handlePixelSelection(canvasPos) {
        if (this.isValidCanvasPosition(canvasPos)) {
            appState.set('canvas.selectedPixel', {
                x: canvasPos.x,
                y: canvasPos.y
            });
        }
    }
    
    /**
     * Обработка двойного клика
     */
    handleDoubleClick(event) {
        if (this.timers.doubleClick) {
            // Двойной клик - центрируем холст
            this.centerCanvas();
            clearTimeout(this.timers.doubleClick);
            this.timers.doubleClick = null;
        } else {
            this.timers.doubleClick = setTimeout(() => {
                this.timers.doubleClick = null;
            }, this.settings.doubleClickTime);
        }
    }
    
    /**
     * Начало перетаскивания
     */
    startDragging(event) {
        this.inputState.gestures.isDragging = true;
        
        const currentOffset = {
            offsetX: appState.get('canvas.offsetX'),
            offsetY: appState.get('canvas.offsetY')
        };
        
        this.inputState.gestures.dragStart = {
            x: event.clientX,
            y: event.clientY,
            offsetX: currentOffset.offsetX,
            offsetY: currentOffset.offsetY
        };
        
        console.log('🖱️ Starting drag:', { 
            mousePos: { x: event.clientX, y: event.clientY },
            currentOffset: currentOffset,
            dragStart: this.inputState.gestures.dragStart
        });
        
        this.canvas.style.cursor = 'grabbing';
    }
    
    /**
     * Обновление позиции при перетаскивании
     */
    updateDragPosition(event) {
        if (!this.inputState.gestures.isDragging) return;
        
        console.log('🖱️ updateDragPosition called:', { 
            isDragging: this.inputState.gestures.isDragging,
            dragStart: this.inputState.gestures.dragStart,
            mousePos: { x: event.clientX, y: event.clientY }
        });
        
        const dragStart = this.inputState.gestures.dragStart;
        const deltaX = (event.clientX - dragStart.x) * this.settings.dragSensitivity;
        const deltaY = (event.clientY - dragStart.y) * this.settings.dragSensitivity;
        
        const newOffsets = {
            offsetX: dragStart.offsetX + deltaX,
            offsetY: dragStart.offsetY + deltaY
        };
        
        // Ограничиваем перемещение в пределах реального размера канваса
        const currentState = appState.get('canvas');
        const scale = currentState.scale;
        
        // Размеры логического канваса в пикселях (с учетом PIXEL_SIZE)
        const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE;
        const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE;
        
        // Получаем высоту верхней панели и ширину сайдбара
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
        
        // Получаем размеры окна браузера
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // На мобильных устройствах сайдбар скрыт, поэтому доступная область = вся ширина окна
        let availableWidth = windowWidth;
        let availableHeight = windowHeight - headerHeight;
        
        // На десктопе учитываем сайдбар
        if (window.innerWidth > 768) {
            availableWidth = windowWidth - sidebarWidth;
        }
        
        // Получаем размеры контейнера канваса
        const canvasContainer = document.querySelector('.canvas-container');
        const containerRect = canvasContainer ? canvasContainer.getBoundingClientRect() : { width: 0, height: 0 };
        
        // Используем размеры контейнера если они доступны, иначе доступную область
        const finalWidth = containerRect.width > 0 ? containerRect.width : availableWidth;
        const finalHeight = containerRect.height > 0 ? containerRect.height : availableHeight;
        
        // Ограничиваем перемещение по X в пределах реального размера канваса
        if (logicalCanvasWidth * scale > finalWidth) {
            // Если канвас больше доступной области, ограничиваем перемещение
            newOffsets.offsetX = Math.min(0, Math.max(newOffsets.offsetX, finalWidth - logicalCanvasWidth * scale));
        } else {
            // Если канвас меньше доступной области, позволяем свободно перемещаться
            // но не уходим слишком далеко от краев
            const maxOffset = Math.max(0, finalWidth - logicalCanvasWidth * scale);
            newOffsets.offsetX = Math.max(-maxOffset, Math.min(newOffsets.offsetX, maxOffset));
        }
        
        // Ограничиваем перемещение по Y в пределах реального размера канваса
        if (logicalCanvasHeight * scale > finalHeight) {
            // Если канвас больше доступной области, ограничиваем перемещение
            newOffsets.offsetY = Math.min(headerHeight, Math.max(newOffsets.offsetY, finalHeight - logicalCanvasHeight * scale));
        } else {
            // Если канвас меньше доступной области, позволяем свободно перемещаться
            // но не уходим слишком далеко от краев
            const maxOffset = Math.max(0, finalHeight - logicalCanvasHeight * scale);
            newOffsets.offsetY = Math.max(headerHeight - maxOffset, Math.min(newOffsets.offsetY, headerHeight + maxOffset));
        }
        
        console.log('🖱️ Updating drag position:', { 
            currentMouse: { x: event.clientX, y: event.clientY },
            rawDelta: { x: event.clientX - dragStart.x, y: event.clientY - dragStart.y },
            scaledDelta: { x: deltaX, y: deltaY },
            dragSensitivity: this.settings.dragSensitivity,
            newOffsets: newOffsets,
            finalArea: { width: finalWidth, height: finalHeight }
        });
        
        appState.batchUpdate({
            'canvas.offsetX': newOffsets.offsetX,
            'canvas.offsetY': newOffsets.offsetY
        });
    }
    
    /**
     * Остановка перетаскивания
     */
    stopDragging() {
        this.inputState.gestures.isDragging = false;
        this.inputState.gestures.dragStart = null;
        this.canvas.style.cursor = 'default';
    }
    
    /**
     * Начало touch zoom
     */
    startTouchZoom(touches) {
        // Проверяем валидность координат для зума
        const centerX = (touches[0].clientX + touches[1].clientX) / 2;
        const centerY = (touches[0].clientY + touches[1].clientY) / 2;
        
        const centerCanvasPos = this.screenToCanvas(centerX, centerY);
        if (centerCanvasPos) {
            this.inputState.gestures.isZooming = true;
            this.inputState.touch.lastDistance = this.getTouchDistance(touches);
        }
    }
    
    /**
     * Обработка touch zoom
     */
    handleTouchZoom(touches) {
        if (!this.inputState.gestures.isZooming) return;
        
        const currentDistance = this.getTouchDistance(touches);
        const deltaDistance = currentDistance - this.inputState.touch.lastDistance;
        
        const zoomFactor = 1 + deltaDistance * this.settings.touchZoomSensitivity;
        
        // Зумим относительно центра между пальцами
        const centerX = (touches[0].clientX + touches[1].clientX) / 2;
        const centerY = (touches[0].clientY + touches[1].clientY) / 2;
        
        // Проверяем валидность центральной точки
        const centerCanvasPos = this.screenToCanvas(centerX, centerY);
        if (centerCanvasPos) {
            this.zoomAtPoint({ x: centerX, y: centerY }, zoomFactor);
        }
        
        this.inputState.touch.lastDistance = currentDistance;
    }
    
    /**
     * Обработка touch перетаскивания
     */
    handleTouchDrag(touch) {
        const currentState = appState.get('canvas');
        
        if (this.inputState.gestures.dragStart) {
            const deltaX = touch.clientX - this.inputState.gestures.dragStart.x;
            const deltaY = touch.clientY - this.inputState.gestures.dragStart.y;
            
            const newOffsets = {
                offsetX: this.inputState.gestures.dragStart.offsetX + deltaX,
                offsetY: this.inputState.gestures.dragStart.offsetY + deltaY
            };
            
            // Ограничиваем перемещение в пределах реального размера канваса
            const scale = currentState.scale;
            
            // Размеры логического канваса в пикселях (с учетом PIXEL_SIZE)
            const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE;
            const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE;
            
            // Получаем высоту верхней панели и ширину сайдбара
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
            const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
            
            // Получаем размеры окна браузера
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // На мобильных устройствах сайдбар скрыт, поэтому доступная область = вся ширина окна
            let availableWidth = windowWidth;
            let availableHeight = windowHeight - headerHeight;
            
            // На десктопе учитываем сайдбар
            if (window.innerWidth > 768) {
                availableWidth = windowWidth - sidebarWidth;
            }
            
            // Получаем размеры контейнера канваса
            const canvasContainer = document.querySelector('.canvas-container');
            const containerRect = canvasContainer ? canvasContainer.getBoundingClientRect() : { width: 0, height: 0 };
            
            // Используем размеры контейнера если они доступны, иначе доступную область
            const finalWidth = containerRect.width > 0 ? containerRect.width : availableWidth;
            const finalHeight = containerRect.height > 0 ? containerRect.height : availableHeight;
            
            // Ограничиваем перемещение по X в пределах реального размера канваса
            if (logicalCanvasWidth * scale > finalWidth) {
                // Если канвас больше доступной области, ограничиваем перемещение
                newOffsets.offsetX = Math.min(0, Math.max(newOffsets.offsetX, finalWidth - logicalCanvasWidth * scale));
            } else {
                // Если канвас меньше доступной области, позволяем свободно перемещаться
                // но не уходим слишком далеко от краев
                const maxOffset = Math.max(0, finalWidth - logicalCanvasWidth * scale);
                newOffsets.offsetX = Math.max(-maxOffset, Math.min(newOffsets.offsetX, maxOffset));
            }
            
            // Ограничиваем перемещение по Y в пределах реального размера канваса
            if (logicalCanvasHeight * scale > finalHeight) {
                // Если канвас больше доступной области, ограничиваем перемещение
                newOffsets.offsetY = Math.min(headerHeight, Math.max(newOffsets.offsetY, finalHeight - logicalCanvasHeight * scale));
            } else {
                // Если канвас меньше доступной области, позволяем свободно перемещаться
                // но не уходим слишком далеко от краев
                const maxOffset = Math.max(0, finalHeight - logicalCanvasHeight * scale);
                newOffsets.offsetY = Math.max(headerHeight - maxOffset, Math.min(newOffsets.offsetY, headerHeight + maxOffset));
            }
            
            appState.batchUpdate({
                'canvas.offsetX': newOffsets.offsetX,
                'canvas.offsetY': newOffsets.offsetY
            });
        } else {
            // Начинаем перетаскивание
            this.inputState.gestures.isDragging = true;
            this.inputState.gestures.dragStart = {
                x: touch.clientX,
                y: touch.clientY,
                offsetX: currentState.offsetX,
                offsetY: currentState.offsetY
            };
        }
    }
    
    /**
     * Начало long press
     */
    startLongPress(touch) {
        this.timers.longPress = setTimeout(() => {
            // Long press - показываем контекстное меню или дополнительные опции
            const canvasPos = this.screenToCanvas(touch.clientX, touch.clientY);
            if (canvasPos) {
                appState.set('ui.contextMenu', {
                    x: touch.clientX,
                    y: touch.clientY,
                    canvasPos: canvasPos,
                    visible: true
                });
            }
        }, this.settings.longPressTime);
    }
    
    /**
     * Отмена long press
     */
    cancelLongPress() {
        if (this.timers.longPress) {
            clearTimeout(this.timers.longPress);
            this.timers.longPress = null;
        }
    }
    
    /**
     * Зум в определенной точке
     */
    zoomAtPoint(screenPoint, zoomFactor) {
        const currentState = appState.get('canvas');
        const { scale, offsetX, offsetY } = currentState;
        
        const newScale = Math.max(0.1, Math.min(20, scale * zoomFactor));
        
        if (newScale !== scale) {
            // Вычисляем новые offsets для зума в точке
            const mouseCanvasX = (screenPoint.x - offsetX) / scale;
            const mouseCanvasY = (screenPoint.y - offsetY) / scale;
            
            let newOffsetX = screenPoint.x - mouseCanvasX * newScale;
            let newOffsetY = screenPoint.y - mouseCanvasY * newScale;
            
            // Ограничиваем новые offsets в пределах реального размера канваса
            const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE;
            const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE;
            
            // Получаем высоту верхней панели и ширину сайдбара
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
            const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
            
            // Получаем размеры окна браузера
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // На мобильных устройствах сайдбар скрыт, поэтому доступная область = вся ширина окна
            let availableWidth = windowWidth;
            let availableHeight = windowHeight - headerHeight;
            
            // На десктопе учитываем сайдбар
            if (window.innerWidth > 768) {
                availableWidth = windowWidth - sidebarWidth;
            }
            
            // Получаем размеры контейнера канваса
            const canvasContainer = document.querySelector('.canvas-container');
            const containerRect = canvasContainer ? canvasContainer.getBoundingClientRect() : { width: 0, height: 0 };
            
            // Используем размеры контейнера если они доступны, иначе доступную область
            const finalWidth = containerRect.width > 0 ? containerRect.width : availableWidth;
            const finalHeight = containerRect.height > 0 ? containerRect.height : availableHeight;
            
            // Ограничиваем перемещение по X в пределах реального размера канваса
            if (logicalCanvasWidth * newScale > finalWidth) {
                // Если канвас больше доступной области, ограничиваем перемещение
                newOffsetX = Math.min(0, Math.max(newOffsetX, finalWidth - logicalCanvasWidth * newScale));
            } else {
                // Если канвас меньше доступной области, позволяем свободно перемещаться
                // но не уходим слишком далеко от краев
                const maxOffset = Math.max(0, finalWidth - logicalCanvasWidth * newScale);
                newOffsetX = Math.max(-maxOffset, Math.min(newOffsetX, maxOffset));
            }
            
            // Ограничиваем перемещение по Y в пределах реального размера канваса
            if (logicalCanvasHeight * newScale > finalHeight) {
                // Если канвас больше доступной области, ограничиваем перемещение
                newOffsetY = Math.min(headerHeight, Math.max(newOffsetY, finalHeight - logicalCanvasHeight * newScale));
            } else {
                // Если канвас меньше доступной области, позволяем свободно перемещаться
                // но не уходим слишком далеко от краев
                const maxOffset = Math.max(0, finalHeight - logicalCanvasHeight * newScale);
                newOffsetY = Math.max(headerHeight - maxOffset, Math.min(newOffsetY, headerHeight + maxOffset));
            }
            
            console.log('🔍 Zoom at point:', {
                screenPoint,
                oldScale: scale,
                newScale,
                oldOffsets: { x: offsetX, y: offsetY },
                newOffsets: { x: newOffsetX, y: newOffsetY },
                mouseCanvasPos: { x: mouseCanvasX, y: mouseCanvasY }
            });
            
            appState.batchUpdate({
                'canvas.scale': newScale,
                'canvas.offsetX': newOffsetX,
                'canvas.offsetY': newOffsetY
            });
        }
    }
    
    /**
     * Переключение видимости сайдбара
     */
    toggleSidebar() {
        const sidePanel = document.querySelector('.side-panel');
        const canvasContainer = document.querySelector('.canvas-container');
        const topBar = document.querySelector('.top-bar');
        
        if (sidePanel) {
            const isHidden = sidePanel.classList.contains('hidden');
            
            if (isHidden) {
                // Показываем сайдбар
                sidePanel.classList.remove('hidden');
                if (canvasContainer) canvasContainer.style.marginRight = 'var(--sidebar-width)';
                if (topBar) topBar.style.right = 'var(--sidebar-width)';
                console.log('📋 InputController: Sidebar shown');
            } else {
                // Скрываем сайдбар
                sidePanel.classList.add('hidden');
                if (canvasContainer) canvasContainer.style.marginRight = '0';
                if (topBar) topBar.style.right = '0';
                console.log('📋 InputController: Sidebar hidden');
            }
            
            // Перецентрируем канвас после изменения размеров
            setTimeout(() => {
                // Принудительно устанавливаем новые размеры контейнера
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
                const sidebarWidth = isHidden ? 300 : 0;
                
                const availableWidth = window.innerWidth > 768 ? windowWidth - sidebarWidth : windowWidth;
                const availableHeight = windowHeight - headerHeight;
                
                // Принудительно устанавливаем новые размеры
                canvasContainer.style.width = availableWidth + 'px';
                canvasContainer.style.height = availableHeight + 'px';
                
                this.centerCanvas();
                console.log('🎯 InputController: Canvas recentered after sidebar toggle');
            }, 300);
        }
    }
    
    /**
     * Центрирование холста
     */
    centerCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const scale = appState.get('canvas.scale');
        
        // Размеры логического канваса в пикселях (с учетом PIXEL_SIZE)
        const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE;
        const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE;
        
        // Получаем высоту верхней панели и ширину сайдбара
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
        
        // Получаем размеры окна браузера
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // На мобильных устройствах сайдбар скрыт, поэтому доступная область = вся ширина окна
        let availableWidth = windowWidth;
        let availableHeight = windowHeight - headerHeight;
        
        // На десктопе учитываем сайдбар
        if (window.innerWidth > 768) {
            availableWidth = windowWidth - sidebarWidth;
        }
        
        // Получаем размеры контейнера канваса
        const canvasContainer = document.querySelector('.canvas-container');
        const containerRect = canvasContainer ? canvasContainer.getBoundingClientRect() : { width: 0, height: 0 };
        
        // Используем размеры контейнера если они доступны, иначе доступную область
        const finalWidth = containerRect.width > 0 ? containerRect.width : availableWidth;
        const finalHeight = containerRect.height > 0 ? containerRect.height : availableHeight;
        
        // Центрируем с учетом масштаба
        let newOffsetX = (finalWidth - logicalCanvasWidth * scale) / 2;
        let newOffsetY = (finalHeight - logicalCanvasHeight * scale) / 2;
        
        // Убеждаемся, что канвас не уходит за границы экрана
        if (logicalCanvasWidth * scale > finalWidth) {
            newOffsetX = 0;
        } else {
            // Позволяем центрировать, но не уходим слишком далеко от краев
            const maxOffset = Math.max(0, finalWidth - logicalCanvasWidth * scale);
            newOffsetX = Math.max(-maxOffset, Math.min(newOffsetX, maxOffset));
        }
        
        if (logicalCanvasHeight * scale > finalHeight) {
            newOffsetY = headerHeight;
        } else {
            // Позволяем центрировать, но не уходим слишком далеко от краев
            const maxOffset = Math.max(0, finalHeight - logicalCanvasHeight * scale);
            newOffsetY = Math.max(headerHeight - maxOffset, Math.min(newOffsetY, headerHeight + maxOffset));
        }
        
        console.log('🎯 InputController centering canvas:', {
            canvasRect: { width: rect.width, height: rect.height },
            windowSize: { width: windowWidth, height: windowHeight },
            availableArea: { width: availableWidth, height: availableHeight },
            finalArea: { width: finalWidth, height: finalHeight },
            logicalCanvas: { width: logicalCanvasWidth, height: logicalCanvasHeight },
            scale: scale,
            headerHeight: headerHeight,
            sidebarWidth: sidebarWidth,
            isMobile: window.innerWidth <= 768,
            center: { x: newOffsetX, y: newOffsetY },
            config: {
                CANVAS_WIDTH: this.config.CANVAS_WIDTH,
                CANVAS_HEIGHT: this.config.CANVAS_HEIGHT,
                PIXEL_SIZE: this.config.PIXEL_SIZE,
                calculatedSize: {
                    width: this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE,
                    height: this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE
                }
            }
        });
        
        appState.batchUpdate({
            'canvas.offsetX': newOffsetX,
            'canvas.offsetY': newOffsetY
        });
    }
    
    /**
     * Настройка клавиатурных сочетаний
     */
    setupKeyboardShortcuts() {
        this.shortcuts = {
            'KeyB': () => this.toggleSidebar(),
            'Space': () => this.centerCanvas(),
            'Equal': () => this.zoomAtCenter(1.2),
            'Minus': () => this.zoomAtCenter(0.8),
            'Digit0': () => this.resetZoom(),
            'ArrowLeft': () => this.moveCanvas(this.settings.keyboardMoveStep, 0),
            'ArrowRight': () => this.moveCanvas(-this.settings.keyboardMoveStep, 0),
            'ArrowUp': () => this.moveCanvas(0, this.settings.keyboardMoveStep),
            'ArrowDown': () => this.moveCanvas(0, -this.settings.keyboardMoveStep)
        };
    }
    
    /**
     * Обработка клавиатурных сочетаний
     */
    handleKeyboardShortcuts(event) {
        const shortcut = this.shortcuts[event.code];
        if (shortcut && !event.ctrlKey && !event.altKey && !event.metaKey) {
            shortcut();
            event.preventDefault();
        }
    }
    
    /**
     * Зум в центре экрана
     */
    zoomAtCenter(factor) {
        const rect = this.canvas.getBoundingClientRect();
        const centerPoint = {
            x: rect.width / 2,
            y: rect.height / 2
        };
        this.zoomAtPoint(centerPoint, factor);
    }
    
    /**
     * Сброс зума
     */
    resetZoom() {
        appState.set('canvas.scale', 1);
        this.centerCanvas();
    }
    
    /**
     * Перемещение холста
     */
    moveCanvas(deltaX, deltaY) {
        const currentState = appState.get('canvas');
        const rect = this.canvas.getBoundingClientRect();
        const scale = currentState.scale;
        
        console.log('🎯 moveCanvas called:', { deltaX, deltaY, currentScale: scale, currentOffsets: { x: currentState.offsetX, y: currentState.offsetY } });
        
        // Размеры логического канваса в пикселях (с учетом PIXEL_SIZE)
        const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE;
        const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE;
        
        // Получаем высоту верхней панели и ширину сайдбара
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
        
        // Получаем размеры окна браузера
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // На мобильных устройствах сайдбар скрыт, поэтому доступная область = вся ширина окна
        let availableWidth = windowWidth;
        let availableHeight = windowHeight - headerHeight;
        
        // На десктопе учитываем сайдбар
        if (window.innerWidth > 768) {
            availableWidth = windowWidth - sidebarWidth;
        }
        
        // Получаем размеры контейнера канваса
        const canvasContainer = document.querySelector('.canvas-container');
        const containerRect = canvasContainer ? canvasContainer.getBoundingClientRect() : { width: 0, height: 0 };
        
        // Используем размеры контейнера если они доступны, иначе доступную область
        const finalWidth = containerRect.width > 0 ? containerRect.width : availableWidth;
        const finalHeight = containerRect.height > 0 ? containerRect.height : availableHeight;
        
        // Вычисляем новые позиции
        let newOffsetX = currentState.offsetX + deltaX;
        let newOffsetY = currentState.offsetY + deltaY;
        
        // Ограничиваем перемещение по X в пределах реального размера канваса
        if (logicalCanvasWidth * scale > finalWidth) {
            // Если канвас больше доступной области, ограничиваем перемещение
            newOffsetX = Math.min(0, Math.max(newOffsetX, finalWidth - logicalCanvasWidth * scale));
        } else {
            // Если канвас меньше доступной области, позволяем свободно перемещаться
            // но не уходим слишком далеко от краев
            const maxOffset = Math.max(0, finalWidth - logicalCanvasWidth * scale);
            newOffsetX = Math.max(-maxOffset, Math.min(newOffsetX, maxOffset));
        }
        
        // Ограничиваем перемещение по Y в пределах реального размера канваса
        if (logicalCanvasHeight * scale > finalHeight) {
            // Если канвас больше доступной области, ограничиваем перемещение
            newOffsetY = Math.min(headerHeight, Math.max(newOffsetY, finalHeight - logicalCanvasHeight * scale));
        } else {
            // Если канвас меньше доступной области, позволяем свободно перемещаться
            // но не уходим слишком далеко от краев
            const maxOffset = Math.max(0, finalHeight - logicalCanvasHeight * scale);
            newOffsetY = Math.max(headerHeight - maxOffset, Math.min(newOffsetY, headerHeight + maxOffset));
        }
        
        console.log('🎯 Moving canvas:', {
            delta: { x: deltaX, y: deltaY },
            currentOffset: { x: currentState.offsetX, y: currentState.offsetY },
            newOffset: { x: newOffsetX, y: newOffsetY },
            logicalCanvas: { width: logicalCanvasWidth, height: logicalCanvasHeight },
            scale: scale,
            availableArea: { width: availableWidth, height: availableHeight },
            finalArea: { width: finalWidth, height: finalHeight },
            config: {
                CANVAS_WIDTH: this.config.CANVAS_WIDTH,
                CANVAS_HEIGHT: this.config.CANVAS_HEIGHT,
                PIXEL_SIZE: this.config.PIXEL_SIZE,
                calculatedSize: {
                    width: this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE,
                    height: this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE
                }
            }
        });
        
        appState.batchUpdate({
            'canvas.offsetX': newOffsetX,
            'canvas.offsetY': newOffsetY
        });
    }
    
    /**
     * Вспомогательные методы
     */
    
    updateMousePosition(event) {
        this.inputState.mouse.x = event.clientX;
        this.inputState.mouse.y = event.clientY;
    }
    
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const currentState = appState.get('canvas');
        
        // Преобразуем экранные координаты в координаты канваса
        const x = Math.floor((screenX - rect.left - currentState.offsetX) / 
                           (this.config.PIXEL_SIZE * currentState.scale));
        const y = Math.floor((screenY - rect.top - currentState.offsetY) / 
                           (this.config.PIXEL_SIZE * currentState.scale));
        
        // Проверяем валидность координат
        if (this.isValidCanvasPosition({ x, y })) {
            return { x, y };
        } else {
            // Возвращаем null если координаты вне канваса
            return null;
        }
    }
    
    isValidCanvasPosition(pos) {
        return pos.x >= 0 && pos.x < this.config.CANVAS_WIDTH &&
               pos.y >= 0 && pos.y < this.config.CANVAS_HEIGHT;
    }
    
    getTouchDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }
    
    stopAllGestures() {
        this.inputState.gestures = {
            isDragging: false,
            isZooming: false,
            dragStart: null,
            zoomStart: null
        };
        this.canvas.style.cursor = 'default';
    }
    
    handleMouseLeave() {
        this.stopAllGestures();
        appState.set('ui.cursorPosition', null);
    }
    
    handleWindowBlur() {
        this.inputState.keyboard.keys.clear();
        this.stopAllGestures();
    }
    
    handleWindowResize() {
        // Пересчитываем центрирование при изменении размеров окна
        if (appState.get('canvas.scale') === 1) {
            // Принудительно устанавливаем новые размеры контейнера
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
            const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
            
            const availableWidth = window.innerWidth > 768 ? windowWidth - sidebarWidth : windowWidth;
            const availableHeight = windowHeight - headerHeight;
            
            // Принудительно устанавливаем новые размеры
            const canvasContainer = document.querySelector('.canvas-container');
            if (canvasContainer) {
                canvasContainer.style.width = availableWidth + 'px';
                canvasContainer.style.height = availableHeight + 'px';
            }
            
            this.centerCanvas();
        }
    }
    
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
     * Получение текущего состояния ввода
     */
    getInputState() {
        return {
            ...this.inputState,
            activeKeys: Array.from(this.inputState.keyboard.keys)
        };
    }
    
    /**
     * Очистка ресурсов
     */
    dispose() {
        // Очищаем таймеры
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        
        // Сбрасываем состояние
        this.stopAllGestures();
    }
}
