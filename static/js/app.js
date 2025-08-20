/**
 * Главное приложение pixel-battle клиента
 * 
 * Модульная архитектура с современными возможностями
 */

import { appState } from './modules/StateManager.js';
import { RenderEngine } from './modules/RenderEngine.js';
import { createWebSocketManager } from './modules/WebSocketManager.js';
import { InputController } from './modules/InputController.js';
import { NotificationSystem } from './components/NotificationSystem.js';
import { performanceMonitor } from './utils/PerformanceMonitor.js';

class PixelBattleApp {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
        
        // Основные компоненты
        this.canvas = null;
        this.renderEngine = null;
        this.webSocketManager = null;
        this.inputController = null;
        this.notificationSystem = null;
        
        // UI элементы
        this.ui = {
            bottomColorPalette: null,
            bottomConfirmButton: null,
            bottomCooldownDisplay: null,
            bottomCooldownProgressBar: null,
            bottomPixelInfo: null,
            bottomPixelPreview: null,
            coordinatesDisplay: null,
            onlineCounter: null,
            floatingPlaceButton: null
        };
        
        // Состояние приложения
        this.appState = {
            isConnected: false,
            isReady: false,
            lastError: null
        };
        
        console.log('🎨 Pixel Battle App created with config:', config);
    }
    
    /**
     * Инициализация приложения
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Pixel Battle App...');
            
            // Инициализируем DOM элементы
            await this.initializeDOM();
            
            // Инициализируем компоненты
            await this.initializeComponents();
            
            // Настраиваем слушатели событий
            await this.setupEventListeners();
            
            // Инициализируем UI
            this.initializeUI();
            
            // Инициализируем состояние канваса
            appState.initializeCanvasState();

            // Подключаемся к серверу
            await this.connectToServer();
            
            // Запускаем мониторинг производительности
            this.startPerformanceMonitoring();
            
            // Отмечаем что приложение готово
            this.appState.isReady = true;
            appState.set('ui.isLoading', false);
            
            // Экспортируем методы для отладки в глобальную область
            if (typeof window !== 'undefined') {
                window.debugCanvas = {
                    getContainerSize: () => this.getContainerSizeInfo(),
                    checkSyncStatus: () => this.checkSyncStatus(),
                    diagnoseAndFix: () => this.diagnoseAndFixSizeIssues(),
                    emergencyReset: () => this.emergencySizeReset(),
                    startMonitoring: (interval) => this.startSizeMonitoring(interval),
                    stopMonitoring: () => this.stopSizeMonitoring(),
                    forceResize: () => this.forceContainerResize(),
                    forceReinit: () => this.forceCanvasReinitialization(),
                    forceGlobalSync: () => this.forceGlobalSync(),
                    centerCanvas: () => this.centerCanvas()
                };
                console.log('🔧 Debug methods exported to window.debugCanvas');
            }
            
            console.log('✅ Pixel Battle App initialized successfully');
            
            // Принудительная инициализация размеров после всех компонентов
            setTimeout(() => {
                // Принудительно синхронизируем все компоненты
                this.forceGlobalSync();
                console.log('🔄 Forced global sync after components');
                
                // Проверяем состояние синхронизации
                console.log('📊 Sync status after global sync:', this.checkSyncStatus());
                
                // Валидируем размеры контейнера
                const containerValidation = this.validateContainerDimensions();
                console.log('🔍 Container validation after global sync:', containerValidation);
                
                // Диагностируем и исправляем проблемы с размерами
                setTimeout(() => {
                    const diagnosisResult = this.diagnoseAndFixSizeIssues();
                    console.log('🔍 Size issues diagnosis result:', diagnosisResult);
                    
                    // Если проблемы не исправлены, используем экстренный сброс
                    if (!diagnosisResult.fixed) {
                        console.log('🚨 Issues not fixed by diagnosis, attempting emergency reset...');
                        setTimeout(() => {
                            const emergencyResult = this.emergencySizeReset();
                            console.log('🚨 Emergency reset result:', emergencyResult);
                            
                            // Финальная валидация после экстренного сброса
                            const finalValidation = this.validateContainerDimensions();
                            console.log('🔍 Final container validation after emergency reset:', finalValidation);
                        }, 1000);
                    } else {
                        // Финальная валидация после успешной диагностики
                        const finalValidation = this.validateContainerDimensions();
                        console.log('🔍 Final container validation after diagnosis fix:', finalValidation);
                    }
                    
                    // Запускаем мониторинг размеров для предотвращения будущих проблем
                    this.startSizeMonitoring(10000); // Проверяем каждые 10 секунд
                }, 500);
            }, 300);

        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            appState.set('ui.isLoading', false);
            
            // Показываем уведомление об ошибке
            try {
                NotificationSystem.error(`Ошибка инициализации: ${error.message}`);
            } catch (notifError) {
                console.error('❌ Failed to show error notification:', notifError);
            }
            
            throw error;
        }
    }
    
    /**
     * Обеспечение видимости и корректного рендеринга контейнера
     */
    ensureContainerVisibility() {
        if (!this.canvasContainer) {
            console.error('❌ Canvas container not available');
            return false;
        }
        
        // Принудительно показываем контейнер
        this.canvasContainer.style.display = 'flex';
        this.canvasContainer.style.visibility = 'visible';
        this.canvasContainer.style.opacity = '1';
        
        // Убеждаемся, что контейнер имеет корректные CSS свойства
        const computedStyle = getComputedStyle(this.canvasContainer);
        const isVisible = computedStyle.display !== 'none' && 
                         computedStyle.visibility !== 'hidden' && 
                         computedStyle.opacity !== '0';
        
        if (!isVisible) {
            console.warn('⚠️ Container not visible, forcing visibility...');
            this.canvasContainer.style.cssText = `
                position: absolute !important;
                top: var(--header-height) !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: hidden !important;
                background: var(--surface-color) !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 1 !important;
            `;
        }
        
        // Принудительно пересчитываем layout
        this.canvasContainer.getBoundingClientRect();
        
        return true;
    }

    /**
     * Инициализация DOM элементов
     */
    async initializeDOM() {
        console.log('🔧 Initializing DOM elements...');
        
        // Получаем canvas и контейнер
        this.canvas = document.getElementById('canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        if (!this.canvasContainer) {
            throw new Error('Canvas container element not found');
        }
        
        console.log('🔍 DOM elements found:', {
            canvas: !!this.canvas,
            canvasContainer: !!this.canvasContainer
        });
        
        // Получаем UI элементы
        this.ui = {
            bottomColorPalette: document.querySelectorAll('.bottom-color-option') || [],
            bottomConfirmButton: document.getElementById('bottom-confirm-pixel'),
            bottomCooldownDisplay: document.getElementById('bottom-cooldown'),
            bottomCooldownProgressBar: document.getElementById('bottom-cooldown-progress-bar'),
            bottomPixelInfo: document.getElementById('bottom-pixel-info'),
            bottomPixelPreview: document.getElementById('bottom-pixel-preview'),
            coordinatesDisplay: document.querySelector('#coordinates .info-text'),
            onlineCounter: document.querySelector('#online-counter .info-text'),
            floatingPlaceButton: document.getElementById('floating-place-button')
        };
        
        // Ждем полной загрузки DOM и CSS
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
        
        // Дополнительная задержка для гарантии полного расчета CSS layout
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Обеспечиваем видимость контейнера
        this.ensureContainerVisibility();
        
        // Проверяем, что контейнер имеет корректные размеры
        let containerRect = this.canvasContainer.getBoundingClientRect();
        let attempts = 0;
        const maxAttempts = 10;
        
        while ((containerRect.width <= 0 || containerRect.height <= 0) && attempts < maxAttempts) {
            console.log(`⚠️ Container size check attempt ${attempts + 1}:`, {
                width: containerRect.width,
                height: containerRect.height
            });
            
            // Ждем еще немного для CSS layout
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Принудительно пересчитываем layout
            this.canvasContainer.getBoundingClientRect();
            
            // Проверяем снова
            containerRect = this.canvasContainer.getBoundingClientRect();
            attempts++;
        }
        
        if (containerRect.width <= 0 || containerRect.height <= 0) {
            console.warn('⚠️ Container still has invalid size after waiting, proceeding anyway...');
        } else {
            console.log('✅ Container size validated:', {
                width: containerRect.width,
                height: containerRect.height
            });
        }
        
        // Принудительно инициализируем размеры канваса
        this.initializeCanvasSize();
        
        // Дополнительная проверка размеров контейнера
        const finalContainerRect = this.canvasContainer.getBoundingClientRect();
        console.log('🔍 DOM initialization container size check:', {
            width: finalContainerRect.width,
            height: finalContainerRect.height,
            styleWidth: this.canvasContainer.style.width,
            styleHeight: this.canvasContainer.style.height
        });
        
        // Если размеры не установились, принудительно устанавливаем их
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const availableWidth = windowWidth;
        const availableHeight = windowHeight - headerHeight;
        
        if (Math.abs(finalContainerRect.width - availableWidth) > 5 || Math.abs(finalContainerRect.height - availableHeight) > 5) {
            console.log('⚠️ DOM initialization size mismatch, forcing resize...');
            this.canvasContainer.style.width = availableWidth + 'px';
            this.canvasContainer.style.height = availableHeight + 'px';
            this.canvasContainer.getBoundingClientRect();
        }
        
        // Полная информация о размерах контейнера
        console.log('📏 Container size info:', this.getContainerSizeInfo());
        
        console.log('✅ DOM initialized');
    }
    /**
     * Инициализация размеров canvas
     */
    initializeCanvasSize() {
        if (!this.canvas || !this.canvasContainer) {
            console.error('❌ Canvas or container not available for size initialization');
            return;
        }
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;

        
        const availableWidth = windowWidth;
        const availableHeight = windowHeight - headerHeight;
        
        // Получаем размеры контейнера
        const containerRect = this.canvasContainer.getBoundingClientRect();
        
        // Сайдбар убран
        
        // Если размеры контейнера не установились, принудительно устанавливаем их еще раз
        if (Math.abs(containerRect.width - availableWidth) > 5 || Math.abs(containerRect.height - availableHeight) > 5) {
            console.log('⚠️ Container size mismatch detected, forcing resize...');
            
            // Убираем inline стили, чтобы работали CSS правила
            this.canvasContainer.style.removeProperty('width');
            this.canvasContainer.style.removeProperty('height');
            
            // Принудительно пересчитываем layout
            this.canvasContainer.getBoundingClientRect();
            
            // Проверяем еще раз
            const newRect = this.canvasContainer.getBoundingClientRect();
            console.log('🔍 Container size after CSS reset:', {
                width: newRect.width,
                height: newRect.height,
                targetWidth: availableWidth,
                targetHeight: availableHeight,
                sidebarRemoved: true
            });
            
            // Если размеры все еще не корректны, используем fallback
            if (newRect.width <= 0 || newRect.height <= 0) {
                console.warn('⚠️ Container dimensions still invalid, using fallback approach...');
                
                // Fallback: принудительно устанавливаем CSS свойства
                this.canvasContainer.style.cssText = `
                    position: absolute !important;
                    top: ${headerHeight}px !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    width: ${availableWidth}px !important;
                    height: ${availableHeight}px !important;
                    overflow: hidden !important;
                    background: var(--surface-color) !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-sizing: border-box !important;
                `;
                
                // Принудительно пересчитываем layout
                this.canvasContainer.getBoundingClientRect();
                
                // Проверяем финальный результат
                const finalRect = this.canvasContainer.getBoundingClientRect();
                console.log('🔍 Container size after fallback CSS:', {
                    width: finalRect.width,
                    height: finalRect.height,
                    targetWidth: availableWidth,
                    targetHeight: availableHeight
                });
            }
        }
        
        const dpr = window.devicePixelRatio || 1;
        
        // Устанавливаем размеры канваса
        this.canvas.width = availableWidth * dpr;
        this.canvas.height = availableHeight * dpr;
        
        const ctx = this.canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        this.canvas.style.width = availableWidth + 'px';
        this.canvas.style.height = availableHeight + 'px';
        
        console.log('🖼️ Canvas initialized:', { 
            width: availableWidth, 
            height: availableHeight,
            dpr,
            headerHeight
        });
        
        // Принудительно перерисовываем
        if (this.renderEngine) {
            this.renderEngine.forceRedraw();
        }
    }
    /**
     * Инициализация компонентов
     */
    async initializeComponents() {
        console.log('🔧 Initializing components...');
        
        // Система уведомлений
        this.notificationSystem = new NotificationSystem();
        
        // Движок рендеринга
        this.renderEngine = new RenderEngine(this.canvas, this.config);
        
        // WebSocket менеджер
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        this.webSocketManager = createWebSocketManager(wsUrl);
        
        // Контроллер ввода
        this.inputController = new InputController(this.canvas, this.config);
        
        // Принудительно центрируем канвас после инициализации всех компонентов
        setTimeout(() => {
            this.inputController.centerCanvas();
            console.log('🎯 Canvas centered after components initialization');
        }, 100);
        
        // Дополнительная синхронизация InputController
        setTimeout(() => {
            if (this.inputController && typeof this.inputController.syncContainerSize === 'function') {
                this.inputController.syncContainerSize();
                console.log('🔄 InputController container synced after components initialization');
            }
        }, 200);
        
        console.log('✅ Components initialized');
    }
    
    /**
     * Настройка слушателей событий
     */
    async setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // События WebSocket
        this.setupWebSocketEvents();
        
        // События UI
        this.setupUIEvents();
        
        // События состояния
        this.setupStateEvents();
        
        // События окна
        this.setupWindowEvents();
        
        console.log('✅ Event listeners set up');
    }
    
    /**
     * Настройка событий WebSocket
     */
    setupWebSocketEvents() {
        // Подключение
        this.webSocketManager.on('connected', () => {
            console.log('🔌 Connected to server');
            this.appState.isConnected = true;
            appState.set('connection.isConnected', true);
            NotificationSystem.success('Подключен к серверу', { duration: 2000 });
        });
        
        // Отключение
        this.webSocketManager.on('disconnected', (event) => {
            console.log('🔌 Disconnected from server');
            this.appState.isConnected = false;
            appState.set('connection.isConnected', false);
            
            if (event.code !== 1000) { // Не ручное отключение
                NotificationSystem.warning('Соединение потеряно. Переподключение...', { 
                    duration: 5000 
                });
            }
        });
        
        // Ошибки
        this.webSocketManager.on('error', (error) => {
            console.error('🔌 WebSocket error:', error);
            NotificationSystem.error('Ошибка соединения с сервером');
        });
        
        // Инициализация
        this.webSocketManager.on('message:init', (message) => {
            console.log('🚀 Received initialization data');
            this.handleInitialization(message);
        });
        
        // Обновления пикселей
        this.webSocketManager.on('message:pixel_update', (message) => {
            this.handlePixelUpdate(message);
        });
        
        // Ошибки сервера
        this.webSocketManager.on('message:error', (message) => {
            console.error('🚨 Server error:', message.message);
            NotificationSystem.error(message.message);
        });
    }
    
    /**
     * Настройка событий UI
     */
    setupUIEvents() {
        console.log('🔧 Setting up UI events...');
        
        // Проверяем наличие элементов
        console.log('🔍 UI elements check:', {
            bottomColorPalette: this.ui.bottomColorPalette.length,
            bottomConfirmButton: !!this.ui.bottomConfirmButton,
            bottomCooldownDisplay: !!this.ui.bottomCooldownDisplay,
            bottomCooldownProgressBar: !!this.ui.bottomCooldownProgressBar,
            bottomPixelInfo: !!this.ui.bottomPixelInfo,
            bottomPixelPreview: !!this.ui.bottomPixelPreview
        });
        
        // Выбор цвета в нижней панели
        if (this.ui.bottomColorPalette.length > 0) {
            this.ui.bottomColorPalette.forEach(colorOption => {
                colorOption.addEventListener('click', () => {
                    // Убираем выделение с других
                    this.ui.bottomColorPalette.forEach(opt => opt.classList.remove('selected'));
                    
                    // Выделяем текущий
                    colorOption.classList.add('selected');
                    
                    // Обновляем состояние
                    const color = colorOption.dataset.color;
                    appState.set('user.selectedColor', color);
                    
                    console.log('🎨 Color selected:', color);
                });
            });
            
            // Выбираем первый цвет по умолчанию
            const firstColor = this.ui.bottomColorPalette[0];
            if (firstColor) {
                firstColor.classList.add('selected');
                const defaultColor = firstColor.dataset.color;
                appState.set('user.selectedColor', defaultColor);
                console.log('🎨 Default color selected:', defaultColor);
            }
            
            console.log('✅ Color palette events set up');
        } else {
            console.warn('⚠️ No color options found');
        }
        
        // Подтверждение пикселя в нижней панели
        if (this.ui.bottomConfirmButton) {
            this.ui.bottomConfirmButton.addEventListener('click', () => {
                console.log('🔥 Bottom confirm button clicked');
                this.handlePixelConfirmation();
            });
            console.log('✅ Bottom confirm button event set up');
        } else {
            console.error('❌ Bottom confirm button not found');
        }
        
        // Плавающая кнопка размещения пикселя
        if (this.ui.floatingPlaceButton) {
            this.ui.floatingPlaceButton.addEventListener('click', () => {
                console.log('🎨 Floating place button clicked');
                this.handlePixelConfirmation();
            });
            console.log('✅ Floating place button event set up');
        } else {
            console.error('❌ Floating place button not found');
        }
        
        // Клавиатурные сочетания (дополнительные)
        document.addEventListener('keydown', (event) => {
            this.handleGlobalKeyboard(event);
        });
        
        console.log('✅ UI events setup complete');
    }
    
    /**
     * Настройка событий состояния
     */
    setupStateEvents() {
        // Слушаем изменения выбранного пикселя
        appState.subscribe('canvas.selectedPixel', (selectedPixel) => {
            if (selectedPixel && this.ui.coordinatesDisplay) {
                this.ui.coordinatesDisplay.textContent = `Координаты: ${selectedPixel.x}, ${selectedPixel.y}`;
            }
        });
        
        // Слушаем изменения cooldown
        appState.subscribe('user.cooldownTime', (cooldownTime) => {
            this.updateCooldownDisplay(cooldownTime);
        });
        
        // Слушаем изменения выбранного пикселя для нижней панели
        appState.subscribe('canvas.selectedPixel', (selectedPixel) => {
            if (this.ui.bottomPixelInfo && this.ui.bottomPixelPreview) {
                const spanElement = this.ui.bottomPixelInfo.querySelector('span');
                if (spanElement) {
                    if (selectedPixel) {
                        spanElement.textContent = `${selectedPixel.x}, ${selectedPixel.y}`;
                        this.ui.bottomPixelPreview.style.backgroundColor = appState.get('user.selectedColor') || '#FFFFFF';
                    } else {
                        spanElement.textContent = 'Не выбран';
                        this.ui.bottomPixelPreview.style.backgroundColor = '#FFFFFF';
                    }
                }
            }
        });
        
        // Слушаем изменения количества пользователей онлайн
        appState.subscribe('connection.onlineUsers', (onlineUsers) => {
            if (this.ui.onlineCounter) {
                this.ui.onlineCounter.textContent = `Online: ${onlineUsers}`;
            }
        });
        
        // Слушаем изменения выбранного цвета для нижней панели
        appState.subscribe('user.selectedColor', (selectedColor) => {
            if (this.ui.bottomPixelPreview) {
                this.ui.bottomPixelPreview.style.backgroundColor = selectedColor || '#FFFFFF';
            }
            this.updateBottomConfirmButtonState();
            this.updateFloatingButtonState();
        });
        
        // Слушаем изменения cooldown для кнопки подтверждения
        appState.subscribe('user.isCooldown', (isCooldown) => {
            this.updateBottomConfirmButtonState();
            this.updateFloatingButtonState();
        });
        
        // Слушаем изменения выбранного пикселя для кнопки подтверждения
        appState.subscribe('canvas.selectedPixel', (selectedPixel) => {
            this.updateBottomConfirmButtonState();
            this.updateFloatingButtonState();
        });
        
        // Слушаем изменения статуса подключения
        appState.subscribe('connection.isConnected', (isConnected) => {
            this.updateConnectionStatus(isConnected);
        });
        
        // Слушаем изменения позиции курсора
        appState.subscribe('ui.cursorPosition', (position) => {
            if (position && this.ui.coordinatesDisplay) {
                this.ui.coordinatesDisplay.textContent = `Координаты: ${position.x}, ${position.y}`;
            } else if (this.ui.coordinatesDisplay) {
                this.ui.coordinatesDisplay.textContent = 'Координаты:';
            }
            
            // Обновляем нижнюю панель координат
            if (this.ui.bottomPixelInfo && this.ui.bottomPixelPreview) {
                const spanElement = this.ui.bottomPixelInfo.querySelector('span');
                if (spanElement) {
                    if (position) {
                        spanElement.textContent = `${position.x}, ${position.y}`;
                        this.ui.bottomPixelPreview.style.backgroundColor = appState.get('user.selectedColor') || '#FFFFFF';
                    } else {
                        spanElement.textContent = 'Не выбран';
                        this.ui.bottomPixelPreview.style.backgroundColor = '#FFFFFF';
                    }
                }
            }
        });
    }
    
    /**
     * Настройка событий окна
     */
    setupWindowEvents() {
        // Изменение размера окна
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // Потеря фокуса
        window.addEventListener('blur', () => {
            console.log('🔍 Window lost focus');
            // Можно приостановить некоторые операции
        });
        
        // Получение фокуса
        window.addEventListener('focus', () => {
            console.log('🔍 Window gained focus');
            // Возобновляем операции
        });
        
        // Выгрузка страницы
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    /**
     * Подключение к серверу
     */
    async connectToServer() {
        console.log('🔌 Connecting to server...');
        await this.webSocketManager.connect();
    }
    
    /**
     * Запуск мониторинга производительности
     */
    startPerformanceMonitoring() {
        console.log('📊 Starting performance monitoring...');
        performanceMonitor.start();
    }
    
    /**
     * Запуск мониторинга размеров в реальном времени
     */
    startSizeMonitoring(interval = 5000) {
        if (this.sizeMonitoringInterval) {
            clearInterval(this.sizeMonitoringInterval);
        }
        
        this.sizeMonitoringInterval = setInterval(() => {
            const containerInfo = this.getContainerSizeInfo();
            const issues = [];
            
            // Проверяем критические проблемы
            if (containerInfo.container.rectWidth <= 0 || containerInfo.container.rectHeight <= 0) {
                issues.push('Critical: Container has invalid dimensions');
            }
            
            // Проверяем несоответствия
            const styleWidth = parseInt(containerInfo.container.styleWidth) || 0;
            const styleHeight = parseInt(containerInfo.container.styleHeight) || 0;
            
            if (Math.abs(styleWidth - containerInfo.container.rectWidth) > 20) {
                issues.push('Warning: Style width mismatch');
            }
            
            if (Math.abs(styleHeight - containerInfo.container.rectHeight) > 20) {
                issues.push('Warning: Style height mismatch');
            }
            
            if (issues.length > 0) {
                console.log('📊 Size monitoring detected issues:', issues);
                console.log('📏 Current container info:', containerInfo);
                
                // Автоматически исправляем критические проблемы
                if (issues.some(issue => issue.startsWith('Critical:'))) {
                    console.log('🔄 Auto-fixing critical size issues...');
                    this.forceContainerResize();
                }
            }
        }, interval);
        
        console.log(`📊 Size monitoring started with ${interval}ms interval`);
    }

    /**
     * Остановка мониторинга размеров
     */
    stopSizeMonitoring() {
        if (this.sizeMonitoringInterval) {
            clearInterval(this.sizeMonitoringInterval);
            this.sizeMonitoringInterval = null;
            console.log('📊 Size monitoring stopped');
        }
    }

    /**
     * Инициализация UI состояния
     */
    initializeUI() {
        // Выбираем первый цвет по умолчанию

        
        // Центрируем холст
        this.centerCanvas();
        
        // Принудительно центрируем еще раз через небольшую задержку для гарантии
        setTimeout(() => {
            this.centerCanvas();
            
            // Добавляем отладочную информацию
            const canvasRect = this.canvas.getBoundingClientRect();
            const containerRect = this.canvasContainer.getBoundingClientRect();
            const currentState = appState.get('canvas');
            
            console.log('🔍 Debug positioning after centering:', {
                canvasRect: { 
                    width: canvasRect.width, 
                    height: canvasRect.height,
                    left: canvasRect.left,
                    top: canvasRect.top
                },
                containerRect: { 
                    width: containerRect.width, 
                    height: containerRect.height,
                    left: containerRect.left,
                    top: containerRect.top
                },
                canvasState: {
                    offsetX: currentState.offsetX,
                    offsetY: currentState.offsetY,
                    scale: currentState.scale
                },
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
        }, 100);
        
        // Дополнительное центрирование через 500мс для гарантии
        setTimeout(() => {
            this.centerCanvas();
            console.log('🎯 Final canvas centering completed');
        }, 500);
        
        // Добавляем обработчик кнопки центрирования
        const centerButton = document.getElementById('center-canvas');
        if (centerButton) {
            centerButton.addEventListener('click', () => {
                console.log('🎯 Center button clicked');
                this.centerCanvas();
            });
        }
        
        // Добавляем обработчик кнопки переключения сайдбара
        const sidebarButton = document.getElementById('toggle-sidebar');
        if (sidebarButton) {
            sidebarButton.addEventListener('click', () => {
                console.log('📋 Sidebar toggle button clicked');
                this.toggleSidebar();
            });
        }
        
        // Добавляем обработчик кнопки центрирования в сайдбаре
        const centerSidebarButton = document.getElementById('center-canvas-sidebar');
        if (centerSidebarButton) {
            centerSidebarButton.addEventListener('click', () => {
                console.log('🎯 Sidebar center button clicked');
                this.centerCanvas();
            });
        }
        
        // Добавляем обработчик мобильной панели
        const mobileToggle = document.getElementById('mobile-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                console.log('📱 Mobile toggle clicked');
                this.toggleMobilePanel();
            });
        }
        
        // Добавляем обработчик для закрытия мобильной панели при клике вне её
        document.addEventListener('click', (event) => {
            const mobilePanel = document.getElementById('mobile-panel');
            const mobileToggle = document.getElementById('mobile-toggle');
            
            if (mobilePanel && mobilePanel.style.display !== 'none' && 
                !mobilePanel.contains(event.target) && 
                !mobileToggle.contains(event.target)) {
                mobilePanel.style.display = 'none';
                console.log('📱 Mobile panel closed by outside click');
            }
        });
        
        // Сайдбар убран, используем нижнюю панель
        
        // Инициализируем отображения
        if (this.ui.cooldownDisplay && this.ui.cooldownProgressBar) {
            this.updateCooldownDisplay(0);
        } else {
            console.warn('⚠️ Cooldown elements not found, skipping cooldown display initialization');
        }
        
        // Инициализируем нижнюю панель
        if (this.ui.bottomCooldownDisplay && this.ui.bottomCooldownProgressBar) {
            this.updateBottomCooldownDisplay(0);
        } else {
            console.warn('⚠️ Bottom cooldown elements not found, skipping bottom cooldown display initialization');
        }
        
        // Показываем нижнюю панель по умолчанию
        const bottomPanel = document.getElementById('bottom-panel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            console.log('✅ Bottom panel shown by default');
        }
        
        // Инициализируем состояние кнопки подтверждения
        this.updateBottomConfirmButtonState();
        this.updateFloatingButtonState();
        
        console.log('✅ UI initialized');
    }
    
    /**
     * Обработка инициализации от сервера
     */
    handleInitialization(message) {
        console.log('🚀 Handling initialization with', message.pixels.length, 'pixels');
        
        // Создаем новую Map пикселей
        const pixels = new Map();
        message.pixels.forEach(pixel => {
            const key = `${pixel.x},${pixel.y}`;
            pixels.set(key, pixel.color);
        });
        
        // Обновляем состояние
        appState.batchUpdate({
            'canvas.pixels': pixels,
            'connection.onlineUsers': message.online_users
        });
        
        NotificationSystem.info(`Загружено ${message.pixels.length} пикселей`);
    }
    
    /**
     * Обработка обновлений пикселей
     */
    handlePixelUpdate(message) {
        const pixels = appState.get('canvas.pixels');
        const key = `${message.x},${message.y}`;
        
        const newPixels = new Map(pixels);
        newPixels.set(key, message.color);
        
        appState.set('canvas.pixels', newPixels);
    }
    
    /**
     * Обработка подтверждения пикселя
     */
    handlePixelConfirmation() {
        console.log('🔥 handlePixelConfirmation called');
        
        const selectedPixel = appState.get('canvas.selectedPixel');
        const selectedColor = appState.get('user.selectedColor');
        const isCooldown = appState.get('user.isCooldown');
        
        console.log('📊 Pixel confirmation state:', {
            selectedPixel,
            selectedColor,
            isCooldown,
            isConnected: this.appState.isConnected
        });
        
        if (!selectedPixel) {
            console.warn('⚠️ No pixel selected');
            NotificationSystem.warning('Выберите пиксель для размещения');
            return;
        }
        
        if (!selectedColor) {
            console.warn('⚠️ No color selected');
            NotificationSystem.warning('Выберите цвет');
            return;
        }
        
        if (isCooldown) {
            const remainingTime = appState.get('user.cooldownTime');
            console.warn('⚠️ Cooldown active:', remainingTime);
            NotificationSystem.warning(`Подождите еще ${remainingTime} секунд`);
            return;
        }
        
        if (!this.appState.isConnected) {
            console.warn('⚠️ Not connected to server');
            NotificationSystem.error('Нет соединения с сервером');
            return;
        }
        
        console.log('✅ Confirming pixel placement:', selectedPixel, selectedColor);
        
        // Отправляем обновление на сервер
        this.webSocketManager.emit('sendPixelUpdate', {
            x: selectedPixel.x,
            y: selectedPixel.y,
            color: selectedColor
        });
        
        // Локально обновляем пиксель (оптимистичное обновление)
        this.handlePixelUpdate({
            x: selectedPixel.x,
            y: selectedPixel.y,
            color: selectedColor
        });
        
        // Запускаем cooldown
        this.startCooldown();
        
        // Очищаем выбор
        appState.set('canvas.selectedPixel', null);
        
        NotificationSystem.success('Пиксель размещен!', { duration: 2000 });
    }
    
    /**
     * Запуск cooldown
     */
    startCooldown() {
        const cooldownTime = this.config.COOLDOWN_TIME;
        
        appState.batchUpdate({
            'user.isCooldown': true,
            'user.cooldownTime': cooldownTime
        });
        
        // Отключаем кнопку в нижней панели
        if (this.ui.bottomConfirmButton) {
            this.ui.bottomConfirmButton.disabled = true;
        }
        
        // Принудительно обновляем состояние кнопки
        this.updateBottomConfirmButtonState();
        this.updateFloatingButtonState();
        
        // Запускаем таймер
        const interval = setInterval(() => {
            const currentTime = appState.get('user.cooldownTime') - 1;
            appState.set('user.cooldownTime', currentTime);
            
            if (currentTime <= 0) {
                clearInterval(interval);
                this.endCooldown();
            }
        }, 1000);
        
        console.log('⏰ Cooldown started for', cooldownTime, 'seconds');
    }
    
    /**
     * Завершение cooldown
     */
    endCooldown() {
        appState.batchUpdate({
            'user.isCooldown': false,
            'user.cooldownTime': 0
        });
        
        // Включаем кнопку в нижней панели
        if (this.ui.bottomConfirmButton) {
            this.ui.bottomConfirmButton.disabled = false;
        }
        
        // Принудительно обновляем состояние кнопки
        this.updateBottomConfirmButtonState();
        this.updateFloatingButtonState();
        
        console.log('✅ Cooldown ended');
        NotificationSystem.info('Можно размещать следующий пиксель', { duration: 2000 });
    }
    
    /**
     * Обновление отображения cooldown
     */
    updateCooldownDisplay(cooldownTime) {
        // Обновляем нижнюю панель cooldown
        this.updateBottomCooldownDisplay(cooldownTime);
    }
    
    /**
     * Обновление отображения cooldown в нижней панели
     */
    updateBottomCooldownDisplay(cooldownTime) {
        console.log('🕐 Updating bottom cooldown display:', cooldownTime);
        
        if (this.ui.bottomCooldownDisplay) {
            const spanElement = this.ui.bottomCooldownDisplay.querySelector('span');
            
            if (spanElement) {
                if (cooldownTime > 0) {
                    spanElement.textContent = `${cooldownTime}с`;
                    
                    // Обновляем прогресс-бар если он существует
                    if (this.ui.bottomCooldownProgressBar) {
                        const progress = 100 - (cooldownTime / this.config.COOLDOWN_TIME) * 100;
                        this.ui.bottomCooldownProgressBar.style.width = `${progress}%`;
                        console.log('📊 Progress bar updated:', `${progress}%`);
                    }
                } else {
                    spanElement.textContent = '0с';
                    
                    // Сбрасываем прогресс-бар если он существует
                    if (this.ui.bottomCooldownProgressBar) {
                        this.ui.bottomCooldownProgressBar.style.width = '0%';
                    }
                }
            } else {
                console.warn('⚠️ Span element not found in bottom cooldown display');
            }
        } else {
            console.warn('⚠️ Bottom cooldown display element not found');
        }
    }
    
    /**
     * Обновление состояния кнопки подтверждения в нижней панели
     */
    updateBottomConfirmButtonState() {
        if (!this.ui.bottomConfirmButton) return;
        
        const selectedPixel = appState.get('canvas.selectedPixel');
        const selectedColor = appState.get('user.selectedColor');
        const isCooldown = appState.get('user.isCooldown');
        const cooldownTime = appState.get('user.cooldownTime');
        const isConnected = this.appState.isConnected;
        
        // Дополнительная проверка: если cooldownTime = 0, то isCooldown должен быть false
        const actualCooldown = isCooldown && cooldownTime > 0;
        
        const canConfirm = selectedPixel && selectedColor && !actualCooldown && isConnected;
        
        this.ui.bottomConfirmButton.disabled = !canConfirm;
        
        console.log('🔄 Bottom confirm button state updated:', {
            selectedPixel: !!selectedPixel,
            selectedColor: !!selectedColor,
            isCooldown,
            cooldownTime,
            actualCooldown,
            isConnected,
            canConfirm
        });
    }
    
    /**
     * Обновление состояния плавающей кнопки размещения
     */
    updateFloatingButtonState() {
        if (!this.ui.floatingPlaceButton) return;
        
        const selectedPixel = appState.get('canvas.selectedPixel');
        const selectedColor = appState.get('user.selectedColor');
        const isCooldown = appState.get('user.isCooldown');
        const cooldownTime = appState.get('user.cooldownTime');
        const isConnected = this.appState.isConnected;
        
        // Дополнительная проверка: если cooldownTime = 0, то isCooldown должен быть false
        const actualCooldown = isCooldown && cooldownTime > 0;
        
        const canConfirm = selectedPixel && selectedColor && !actualCooldown && isConnected;
        
        // Показываем кнопку только когда можно размещать пиксель
        if (canConfirm) {
            this.ui.floatingPlaceButton.classList.add('visible');
            this.ui.floatingPlaceButton.disabled = false;
        } else {
            this.ui.floatingPlaceButton.classList.remove('visible');
            this.ui.floatingPlaceButton.disabled = true;
        }
        
        console.log('🔄 Floating button state updated:', {
            selectedPixel: !!selectedPixel,
            selectedColor: !!selectedColor,
            isCooldown,
            cooldownTime,
            actualCooldown,
            isConnected,
            canConfirm,
            visible: canConfirm
        });
    }
    
    /**
     * Обновление статуса подключения в UI
     */
    updateConnectionStatus(isConnected) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('#connection-status .info-text');
        
        if (statusIndicator && statusText) {
            if (isConnected) {
                statusIndicator.textContent = '🟢';
                statusIndicator.dataset.status = 'connected';
                statusText.textContent = 'Подключено';
            } else {
                statusIndicator.textContent = '🔴';
                statusIndicator.dataset.status = 'disconnected';
                statusText.textContent = 'Отключено';
            }
        }
        
        // Обновляем состояние кнопки подтверждения
        this.updateBottomConfirmButtonState();
        this.updateFloatingButtonState();
    }
    
    /**
     * Принудительный перерендер контейнера
     */
    forceContainerRerender() {
        if (!this.canvasContainer) {
            console.error('❌ Canvas container not available');
            return false;
        }
        
        console.log('🔄 Forcing container re-render...');
        
        // Временно скрываем контейнер
        this.canvasContainer.style.display = 'none';
        
        // Принудительно пересчитываем layout
        this.canvasContainer.getBoundingClientRect();
        
        // Показываем контейнер снова
        this.canvasContainer.style.display = 'flex';
        
        // Принудительно пересчитываем layout
        this.canvasContainer.getBoundingClientRect();
        
        // Проверяем результат
        const containerRect = this.canvasContainer.getBoundingClientRect();
        console.log('🔍 Container size after re-render:', {
            width: containerRect.width,
            height: containerRect.height
        });
        
        return containerRect.width > 0 && containerRect.height > 0;
    }

    /**
     * Экстренный сброс размеров
     */
    emergencySizeReset() {
        console.log('🚨 Emergency size reset started');
        
        try {
                    // Принудительно перерендериваем контейнер
        const rerenderSuccess = this.forceContainerRerender();
        
        if (!rerenderSuccess) {
            console.warn('⚠️ Container re-render failed, trying alternative approach...');
            
            // Альтернативный подход: полностью пересоздаем стили
            this.canvasContainer.style.cssText = `
                position: absolute !important;
                top: 60px !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: ${window.innerHeight - 60}px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: hidden !important;
                background: #FFFFFF !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 1 !important;
                box-sizing: border-box !important;
            `;
                
                // Принудительно пересчитываем layout
                this.canvasContainer.getBoundingClientRect();
            }
            
            // Принудительно устанавливаем размеры контейнера
            this.forceContainerResize();
            
            // Центрируем канвас
            this.centerCanvas();
            
            // Принудительно перерисовываем
            if (this.renderEngine) {
                this.renderEngine.forceRedraw();
            }
            
            // Проверяем финальное состояние
            const finalContainerRect = this.canvasContainer.getBoundingClientRect();
            const success = finalContainerRect.width > 0 && finalContainerRect.height > 0;
            
            console.log('🚨 Emergency reset result:', {
                success,
                finalSize: {
                    width: finalContainerRect.width,
                    height: finalContainerRect.height
                }
            });
            
            return { success, finalSize: finalContainerRect };
            
        } catch (error) {
            console.error('❌ Emergency reset failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Диагностика и исправление проблем с размерами
     */
    diagnoseAndFixSizeIssues() {
        console.log('🔍 Diagnosing size issues...');
        
        const containerInfo = this.getContainerSizeInfo();
        const issues = [];
        
        // Проверяем размеры контейнера
        if (containerInfo.container.rectWidth <= 0 || containerInfo.container.rectHeight <= 0) {
            issues.push('Container has invalid dimensions');
        }
        
        // Проверяем соответствие стилей и реальных размеров
        const styleWidth = parseInt(containerInfo.container.styleWidth) || 0;
        const styleHeight = parseInt(containerInfo.container.styleHeight) || 0;
        
        if (Math.abs(styleWidth - containerInfo.container.rectWidth) > 10) {
            issues.push('Style width mismatch with actual width');
        }
        
        if (Math.abs(styleHeight - containerInfo.container.rectHeight) > 10) {
            issues.push('Style height mismatch with actual height');
        }
        
        // Проверяем соответствие с доступной областью
        if (Math.abs(containerInfo.container.rectWidth - containerInfo.available.width) > 10) {
            issues.push('Container width mismatch with available width');
        }
        
        if (Math.abs(containerInfo.container.rectHeight - containerInfo.available.height) > 10) {
            issues.push('Container height mismatch with available height');
        }
        
        if (issues.length > 0) {
            console.log('⚠️ Size issues detected:', issues);
            console.log('🔄 Attempting to fix issues...');
            
            // Принудительно исправляем размеры
            this.forceGlobalSync();
            
            // Проверяем еще раз
            const newContainerInfo = this.getContainerSizeInfo();
            const newIssues = [];
            
            if (newContainerInfo.container.rectWidth <= 0 || newContainerInfo.container.rectHeight <= 0) {
                newIssues.push('Container still has invalid dimensions');
            }
            
            if (newIssues.length > 0) {
                console.log('❌ Failed to fix all issues:', newIssues);
                return { fixed: false, issues: newIssues, originalIssues: issues };
            } else {
                console.log('✅ All size issues fixed');
                return { fixed: true, issues: [], originalIssues: issues };
            }
        } else {
            console.log('✅ No size issues detected');
            return { fixed: true, issues: [], originalIssues: [] };
        }
    }

    /**
     * Проверка состояния синхронизации всех компонентов
     */
    checkSyncStatus() {
        const containerInfo = this.getContainerSizeInfo();
        const inputControllerStatus = this.inputController ? {
            hasSyncMethod: typeof this.inputController.syncContainerSize === 'function',
            hasCenterMethod: typeof this.inputController.centerCanvas === 'function'
        } : { error: 'InputController not available' };
        
        const renderEngineStatus = this.renderEngine ? {
            available: true,
            hasForceRedraw: typeof this.renderEngine.forceRedraw === 'function'
        } : { error: 'RenderEngine not available' };
        
        return {
            container: containerInfo,
            inputController: inputControllerStatus,
            renderEngine: renderEngineStatus,
            appState: {
                canvasScale: appState.get('canvas.scale'),
                canvasOffsetX: appState.get('canvas.offsetX'),
                canvasOffsetY: appState.get('canvas.offsetY')
            }
        };
    }

    /**
     * Принудительная глобальная синхронизация всех компонентов
     */
    forceGlobalSync() {
        console.log('🔄 Force global sync started');
        
        // Принудительно устанавливаем размеры контейнера
        this.forceContainerResize();
        
        // Синхронизируем InputController если он доступен
        if (this.inputController && typeof this.inputController.syncContainerSize === 'function') {
            this.inputController.syncContainerSize();
        }
        
        // Центрируем канвас
        this.centerCanvas();
        
        // Принудительно перерисовываем
        if (this.renderEngine) {
            this.renderEngine.forceRedraw();
        }
        
        // Проверяем финальное состояние синхронизации
        console.log('📊 Final sync status:', this.checkSyncStatus());
        
        console.log('✅ Force global sync completed');
    }

    /**
     * Принудительная переинициализация размеров канваса
     */
    forceCanvasReinitialization() {
        console.log('🔄 Force canvas reinitialization started');
        
        // Принудительно устанавливаем размеры контейнера
        this.forceContainerResize();
        
        // Центрируем канвас
        this.centerCanvas();
        
        // Принудительно перерисовываем
        if (this.renderEngine) {
            this.renderEngine.forceRedraw();
        }
        
        // Логируем финальное состояние размеров
        console.log('📏 Final container size info:', this.getContainerSizeInfo());
        
        console.log('✅ Force canvas reinitialization completed');
    }

    /**
     * Получение информации о размерах контейнера
     */
    getContainerSizeInfo() {
        if (!this.canvasContainer) {
            return { error: 'Container not available' };
        }
        
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;

        
        const availableWidth = windowWidth;
        const availableHeight = windowHeight - headerHeight;
        
        return {
            container: {
                styleWidth: this.canvasContainer.style.width,
                styleHeight: this.canvasContainer.style.height,
                rectWidth: containerRect.width,
                rectHeight: containerRect.height
            },
            window: {
                width: windowWidth,
                height: windowHeight
            },
            available: {
                width: availableWidth,
                height: availableHeight
            },
            headerHeight,
            sidebarRemoved: true,
            isMobile: window.innerWidth <= 768
        };
    }

    /**
     * Валидация размеров контейнера
     */
    validateContainerDimensions() {
        if (!this.canvasContainer) {
            return { valid: false, error: 'Container not available' };
        }
        
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;

        
        const expectedWidth = windowWidth;
        const expectedHeight = windowHeight - headerHeight;
        
        const widthValid = Math.abs(containerRect.width - expectedWidth) <= 5;
        const heightValid = Math.abs(containerRect.height - expectedHeight) <= 5;
        
        return {
            valid: widthValid && heightValid,
            container: {
                width: containerRect.width,
                height: containerRect.height
            },
            expected: {
                width: expectedWidth,
                height: expectedHeight
            },
            differences: {
                width: Math.abs(containerRect.width - expectedWidth),
                height: Math.abs(containerRect.height - expectedHeight)
            },
            window: { width: windowWidth, height: windowHeight },
            headerHeight,
            sidebarRemoved: true
        };
    }

    /**
     * Принудительная установка размеров контейнера
     */
    forceContainerResize() {
        if (!this.canvasContainer) {
            console.error('❌ Canvas container not available');
            return;
        }
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;

        
        const availableWidth = windowWidth;
        const availableHeight = windowHeight - headerHeight;
        
        // Принудительно устанавливаем новые размеры через CSS свойства
        this.canvasContainer.style.width = availableWidth + 'px';
        this.canvasContainer.style.height = availableHeight + 'px';
        
        // Принудительно пересчитываем layout
        this.canvasContainer.getBoundingClientRect();
        
        // Проверяем, что размеры действительно установлены
        const containerRect = this.canvasContainer.getBoundingClientRect();
        if (Math.abs(containerRect.width - availableWidth) > 5 || Math.abs(containerRect.height - availableHeight) > 5) {
            console.log('⚠️ Force resize failed, trying again...');
            
            // Попробуем альтернативный подход - принудительно обновить CSS
            this.canvasContainer.style.cssText = `
                position: absolute !important;
                top: ${headerHeight}px !important;
                left: 0 !important;
                                    right: 0 !important;
                bottom: 0 !important;
                width: ${availableWidth}px !important;
                height: ${availableHeight}px !important;
            `;
            
            // Принудительно пересчитываем layout
            this.canvasContainer.getBoundingClientRect();
            
            // Проверяем еще раз
            const newRect = this.canvasContainer.getBoundingClientRect();
            if (Math.abs(newRect.width - availableWidth) > 5 || Math.abs(newRect.height - availableHeight) > 5) {
                console.error('❌ Force resize failed even with CSS override');
            } else {
                console.log('✅ Force resize succeeded with CSS override');
            }
        }
        
        console.log('🔄 Container forcefully resized:', { 
            width: availableWidth, 
            height: availableHeight,
            actualWidth: containerRect.width,
            actualHeight: containerRect.height
        });
        
        // Логируем информацию о размерах после изменения
        console.log('📏 Container size after resize:', this.getContainerSizeInfo());
        
        // Переинициализируем размеры канваса
        this.initializeCanvasSize();
    }

    /**
     * Центрирование холста
     */
    centerCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const scale = appState.get('canvas.scale') || 1;
        
        // Размеры логического канваса в пикселях (с учетом PIXEL_SIZE)
        const logicalCanvasWidth = this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE;
        const logicalCanvasHeight = this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE;
        
        // Получаем высоту верхней панели
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        
        // Получаем размеры контейнера канваса
        const containerRect = this.canvasContainer.getBoundingClientRect();
        
        // Проверяем, что размеры контейнера корректны
        if (containerRect.width <= 0 || containerRect.height <= 0) {
            console.log('⚠️ Invalid container size detected in centerCanvas, forcing resize...');
            this.forceContainerResize();
            
            // Получаем размеры снова после принудительного изменения
            const newRect = this.canvasContainer.getBoundingClientRect();
            if (newRect.width > 0 && newRect.height > 0) {
                console.log('✅ Container size fixed, continuing centering...');
            } else {
                console.error('❌ Failed to fix container size');
                
                // Попробуем использовать валидацию для диагностики
                const validation = this.validateContainerDimensions();
                console.error('🔍 Container validation details:', validation);
                
                return;
            }
        }
        
        // Получаем размеры окна браузера
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Доступная область = вся ширина окна (сайдбар убран)
        let availableWidth = windowWidth;
        let availableHeight = windowHeight - headerHeight;
        
        // Используем размеры контейнера если они доступны, иначе доступную область
        const finalWidth = containerRect.width > 0 ? containerRect.width : availableWidth;
        const finalHeight = containerRect.height > 0 ? containerRect.height : availableHeight;
        
        // Центрируем с учетом масштаба и размеров контейнера
        let centerX = (finalWidth - logicalCanvasWidth * scale) / 2;
        let centerY = (finalHeight - logicalCanvasHeight * scale) / 2;
        
        // Убеждаемся, что канвас не уходит за границы экрана
        if (logicalCanvasWidth * scale > finalWidth) {
            centerX = 0;
        } else {
            centerX = Math.max(0, Math.min(centerX, finalWidth - logicalCanvasWidth * scale));
        }
        
        if (logicalCanvasHeight * scale > finalHeight) {
            centerY = headerHeight;
        } else {
            centerY = Math.max(headerHeight, Math.min(centerY, finalHeight - logicalCanvasHeight * scale));
        }
        
        // Принудительно показываем канвас в видимой области
        if (centerX < 0) centerX = 0;
        if (centerY < headerHeight) centerY = headerHeight;
        
        console.log('🎯 Centering canvas:', {
            canvasRect: { width: rect.width, height: rect.height },
            containerRect: { width: containerRect.width, height: containerRect.height },
            windowSize: { width: windowWidth, height: windowHeight },
            availableArea: { width: availableWidth, height: availableHeight },
            finalArea: { width: finalWidth, height: finalHeight },
            logicalCanvas: { width: logicalCanvasWidth, height: logicalCanvasHeight },
            scale: scale,
            headerHeight: headerHeight,
            isMobile: window.innerWidth <= 768,
            center: { x: centerX, y: centerY },
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
            'canvas.offsetX': centerX,
            'canvas.offsetY': centerY
        });
        
        console.log('📐 Canvas centered at:', { x: centerX, y: centerY });
    }
    
    /**
     * Переключение видимости нижней панели
     */
    toggleBottomPanel() {
        const bottomPanel = document.getElementById('bottom-panel');
        
        if (bottomPanel) {
            const isHidden = bottomPanel.classList.contains('hidden');
            
            if (isHidden) {
                // Показываем нижнюю панель
                bottomPanel.classList.remove('hidden');
                console.log('⚙️ Bottom panel shown');
            } else {
                // Скрываем нижнюю панель
                bottomPanel.classList.add('hidden');
                console.log('⚙️ Bottom panel hidden');
            }
        }
    }

    /**
     * Переключение видимости мобильной панели
     */
    toggleMobilePanel() {
        const bottomPanel = document.getElementById('bottom-panel');
        
        if (bottomPanel) {
            const isHidden = bottomPanel.classList.contains('hidden');
            
            if (isHidden) {
                // Показываем нижнюю панель
                bottomPanel.classList.remove('hidden');
                console.log('📱 Mobile: Bottom panel shown');
            } else {
                // Скрываем нижнюю панель
                bottomPanel.classList.add('hidden');
                console.log('📱 Mobile: Bottom panel hidden');
            }
        }
    }
    
    /**
     * Обработка изменения размера окна
     */
    handleWindowResize() {
        console.log('📐 Window resized');
        
        // Ждем немного, чтобы браузер завершил изменение размеров
        setTimeout(() => {
            // Получаем текущие размеры контейнера
            const currentWidth = parseInt(this.canvasContainer.style.width) || 0;
            const currentHeight = parseInt(this.canvasContainer.style.height) || 0;
            
            // Вычисляем новые доступные размеры
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
    
            
            const availableWidth = windowWidth;
            const availableHeight = windowHeight - headerHeight;
            
            // Обновляем размеры контейнера только если они изменились
            if (Math.abs(currentWidth - availableWidth) > 5 || Math.abs(currentHeight - availableHeight) > 5) {
                // Используем новый метод для принудительной установки размеров
                this.forceContainerResize();
                console.log('🔄 Container size updated after window resize');
            } else {
                console.log('📏 Container size unchanged, skipping resize');
            }
        }, 50);
        
        // Принудительно центрируем канвас после изменения размеров
        setTimeout(() => {
            this.centerCanvas();
            console.log('🎯 Canvas recentered after window resize');
        }, 100);
        
        // Дополнительное центрирование через 300мс для гарантии
        setTimeout(() => {
            this.centerCanvas();
            console.log('🎯 Final centering after window resize');
        }, 300);
    }
    
    /**
     * Обработка глобальных клавиш
     */
    handleGlobalKeyboard(event) {
        // Дополнительные горячие клавиши
        if (event.code === 'Enter' && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            this.handlePixelConfirmation();
        }
        
        // Экспорт данных производительности (для отладки)
        if (event.code === 'KeyE' && event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            performanceMonitor.exportData();
            NotificationSystem.info('Данные производительности экспортированы');
        }
    }
    
    /**
     * Получение статистики приложения
     */
    getAppStats() {
        return {
            isInitialized: this.isInitialized,
            isReady: this.appState.isReady,
            isConnected: this.appState.isConnected,
            performance: performanceMonitor.getAllMetrics(),
            canvas: {
                pixelsCount: appState.get('canvas.pixels')?.size || 0,
                scale: appState.get('canvas.scale'),
                selectedPixel: appState.get('canvas.selectedPixel')
            },
            user: {
                selectedColor: appState.get('user.selectedColor'),
                isCooldown: appState.get('user.isCooldown'),
                cooldownTime: appState.get('user.cooldownTime')
            },
            connection: {
                onlineUsers: appState.get('connection.onlineUsers'),
                reconnectAttempts: appState.get('connection.reconnectAttempts')
            }
        };
    }
    
    /**
     * Очистка ресурсов
     */
    cleanup() {
        console.log('🧹 Cleaning up app resources...');
        
        // Отключаемся от WebSocket
        if (this.webSocketManager) {
            this.webSocketManager.disconnect();
        }
        
        // Останавливаем мониторинг производительности
        performanceMonitor.stop();
        
        // Останавливаем мониторинг размеров
        this.stopSizeMonitoring();
        
        // Очищаем компоненты
        if (this.inputController) {
            this.inputController.dispose();
        }
        
        if (this.renderEngine) {
            this.renderEngine.dispose();
        }
        
        console.log('✅ Cleanup completed');
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Ждем полной загрузки всех ресурсов
        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }
        
        // Дополнительная задержка
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Получаем конфигурацию
        if (typeof CONFIG === 'undefined') {
            throw new Error('CONFIG not found');
        }
        
        console.log('🚀 Starting Pixel Battle App...');
        
        // Создаем экземпляр приложения
        window.pixelBattleApp = new PixelBattleApp(CONFIG);

        // Инициализируем приложение
        await window.pixelBattleApp.initialize();
        
        console.log('🎉 Pixel Battle App ready!');
        
        // Добавляем в глобальную область для отладки
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.appState = appState;
            window.performanceMonitor = performanceMonitor;
            console.log('🔧 Debug objects added to window: appState, performanceMonitor');
        }
        
    } catch (error) {
        console.error('💥 Failed to start Pixel Battle App:', error);
        
        // Показываем ошибку пользователю
        try {
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-family: system-ui;
            z-index: 10000;
            text-align: center;
            max-width: 400px;
        `;
        errorMessage.innerHTML = `
            <h3>Ошибка загрузки приложения</h3>
            <p>${error.message}</p>
            <button onclick="window.location.reload()" 
                    style="margin-top: 10px; padding: 8px 16px; background: white; color: #ff4444; border: none; border-radius: 4px; cursor: pointer;">
                Перезагрузить
            </button>
        `;
        document.body.appendChild(errorMessage);
        } catch (uiError) {
            console.error('❌ Failed to show error UI:', uiError);
        }
    }
});

export { PixelBattleApp };
