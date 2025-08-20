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
            colorPalette: null,
            confirmButton: null,
            cooldownDisplay: null,
            cooldownProgressBar: null,
            coordinatesDisplay: null,
            onlineCounter: null
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
            
            // Инициализируем состояние канваса
            appState.initializeCanvasState();
            
            // Инициализируем DOM элементы
            await this.initializeDOM();
            
            // Инициализируем компоненты
            await this.initializeComponents();
            
            // Настраиваем слушатели событий
            await this.setupEventListeners();
            
            // Инициализируем UI
            this.initializeUI();
            
            // Подключаемся к серверу
            await this.connectToServer();
            
            // Запускаем мониторинг производительности
            this.startPerformanceMonitoring();
            
            // Отмечаем что приложение готово
            this.appState.isReady = true;
            appState.set('ui.isLoading', false);
            
            console.log('✅ Pixel Battle App initialized successfully');
        
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
            colorPalette: document.querySelectorAll('.color-option') || [],
            confirmButton: document.getElementById('confirm-pixel'),
            cooldownDisplay: document.getElementById('cooldown'),
            cooldownProgressBar: document.getElementById('cooldown-progress-bar'),
            coordinatesDisplay: document.querySelector('#coordinates .info-text'),
            onlineCounter: document.querySelector('#online-counter .info-text')
        };
        
        // Проверяем обязательные элементы
        const requiredElements = ['confirmButton', 'cooldownDisplay'];
        for (const elementName of requiredElements) {
            if (!this.ui[elementName]) {
                console.warn(`⚠️ Required UI element not found: ${elementName}`);
            }
        }
        
        // Ждем немного, чтобы DOM полностью загрузился
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Принудительно устанавливаем размеры контейнера
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
        
        const availableWidth = window.innerWidth > 768 ? windowWidth - sidebarWidth : windowWidth;
        const availableHeight = windowHeight - headerHeight;
        
        // Принудительно устанавливаем стили
        this.canvasContainer.style.width = availableWidth + 'px';
        this.canvasContainer.style.height = availableHeight + 'px';
        
        console.log('🔧 Forced container dimensions:', { width: availableWidth, height: availableHeight });
        
        // Инициализируем размеры canvas
        this.initializeCanvasSize();
        
        // Дополнительная инициализация размеров через небольшую задержку
        setTimeout(() => {
            this.initializeCanvasSize();
            console.log('🔄 Canvas size reinitialized after delay');
            
            // Принудительно центрируем канвас после инициализации
            if (this.inputController) {
                this.inputController.centerCanvas();
                console.log('🎯 Canvas centered after initialization');
            }
        }, 200);
    }
    
    /**
     * Инициализация размеров canvas
     */
    initializeCanvasSize() {
        if (!this.canvas || !this.canvasContainer) {
            console.error('❌ Canvas or container not available for size initialization');
            return;
        }
        
        // Получаем размеры окна для fallback
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Получаем высоту верхней панели и ширину сайдбара
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
        
        // Вычисляем доступную область для канваса
        let availableWidth = windowWidth;
        let availableHeight = windowHeight - headerHeight;
        
        // На десктопе учитываем сайдбар
        if (window.innerWidth > 768) {
            availableWidth = windowWidth - sidebarWidth;
        }
        
        // Принудительно устанавливаем размеры контейнера
        this.canvasContainer.style.width = availableWidth + 'px';
        this.canvasContainer.style.height = availableHeight + 'px';
        
        // Получаем размеры контейнера после установки стилей
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Используем доступную область как размеры канваса
        const canvasWidth = availableWidth;
        const canvasHeight = availableHeight;
        
        console.log('📐 Canvas size debug:', {
            windowSize: { width: windowWidth, height: windowHeight },
            availableArea: { width: availableWidth, height: availableHeight },
            headerHeight: headerHeight,
            sidebarWidth: sidebarWidth,
            dpr: dpr,
            config: {
                CANVAS_WIDTH: this.config.CANVAS_WIDTH,
                CANVAS_HEIGHT: this.config.CANVAS_HEIGHT,
                PIXEL_SIZE: this.config.PIXEL_SIZE,
                calculatedSize: {
                    width: this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE,
                    height: this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE
                }
            },
            finalSize: { width: canvasWidth, height: canvasHeight }
        });
        
        // Устанавливаем размеры канваса
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;
        
        const ctx = this.canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
        
        console.log('🖼️ Canvas initialized:', { 
            width: canvasWidth, 
            height: canvasHeight, 
            dpr,
            canvasElement: this.canvas,
            containerElement: this.canvasContainer,
            canvasVisible: this.canvas.offsetHeight > 0 && this.canvas.offsetWidth > 0,
            containerVisible: this.canvasContainer.offsetHeight > 0 && this.canvasContainer.offsetWidth > 0,
            logicalCanvasSize: {
                width: this.config.CANVAS_WIDTH * this.config.PIXEL_SIZE,
                height: this.config.CANVAS_HEIGHT * this.config.PIXEL_SIZE
            }
        });
        
        // Принудительно перерисовываем после изменения размеров
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
        // Выбор цвета
        this.ui.colorPalette.forEach(colorOption => {
            colorOption.addEventListener('click', () => {
                // Убираем выделение с других
                this.ui.colorPalette.forEach(opt => opt.classList.remove('selected'));
                
                // Выделяем текущий
                colorOption.classList.add('selected');
                
                // Обновляем состояние
                const color = colorOption.dataset.color;
                appState.set('user.selectedColor', color);
                
                console.log('🎨 Color selected:', color);
            });
        });
        
        // Подтверждение пикселя
        this.ui.confirmButton.addEventListener('click', () => {
            this.handlePixelConfirmation();
        });
        
        // Клавиатурные сочетания (дополнительные)
        document.addEventListener('keydown', (event) => {
            this.handleGlobalKeyboard(event);
        });
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
        
        // Слушаем изменения количества пользователей онлайн
        appState.subscribe('connection.onlineUsers', (onlineUsers) => {
            if (this.ui.onlineCounter) {
                this.ui.onlineCounter.textContent = `Online: ${onlineUsers}`;
            }
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
     * Инициализация UI состояния
     */
    initializeUI() {
        // Выбираем первый цвет по умолчанию
        if (this.ui.colorPalette && this.ui.colorPalette.length > 0) {
            const firstColor = this.ui.colorPalette[0];
            if (firstColor && firstColor.dataset && firstColor.dataset.color) {
            firstColor.classList.add('selected');
            appState.set('user.selectedColor', firstColor.dataset.color);
                console.log('🎨 First color selected:', firstColor.dataset.color);
            }
        } else {
            console.warn('⚠️ Color palette not found or empty');
        }
        
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
        
        // Добавляем обработчик мобильного сайдбара
        const mobileToggle = document.getElementById('mobile-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                console.log('📱 Mobile toggle clicked');
                this.toggleMobileSidebar();
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
        
        // Проверяем и принудительно показываем боковую панель
        const sidePanel = document.querySelector('.side-panel');
        if (sidePanel) {
            // Принудительно показываем панель
            sidePanel.style.display = 'flex';
            sidePanel.style.visibility = 'visible';
            sidePanel.style.opacity = '1';
            sidePanel.style.width = '300px';
            
            console.log('🔍 Side panel found and forced visible:', {
                element: sidePanel,
                computedStyle: window.getComputedStyle(sidePanel),
                display: window.getComputedStyle(sidePanel).display,
                visibility: window.getComputedStyle(sidePanel).visibility,
                width: window.getComputedStyle(sidePanel).width,
                offsetWidth: sidePanel.offsetWidth,
                offsetHeight: sidePanel.offsetHeight
            });
            
            // Проверяем все дочерние элементы
            const colorPalette = sidePanel.querySelector('.color-palette');
            const colorOptions = sidePanel.querySelectorAll('.color-option');
            console.log('🎨 Color palette elements:', {
                palette: !!colorPalette,
                optionsCount: colorOptions.length,
                options: Array.from(colorOptions).map(opt => ({
                    color: opt.dataset.color,
                    visible: opt.offsetWidth > 0 && opt.offsetHeight > 0
                }))
            });
        } else {
            console.error('❌ Side panel not found!');
            
            // Пытаемся найти все элементы с классом side-panel
            const allSidePanels = document.querySelectorAll('[class*="side"]');
            console.log('🔍 All side-related elements:', Array.from(allSidePanels).map(el => ({
                className: el.className,
                tagName: el.tagName,
                visible: el.offsetWidth > 0 && el.offsetHeight > 0
            })));
        }
        
        // Инициализируем отображения
        if (this.ui.cooldownDisplay && this.ui.cooldownProgressBar) {
        this.updateCooldownDisplay(0);
        } else {
            console.warn('⚠️ Cooldown elements not found, skipping cooldown display initialization');
        }
        
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
        const selectedPixel = appState.get('canvas.selectedPixel');
        const selectedColor = appState.get('user.selectedColor');
        const isCooldown = appState.get('user.isCooldown');
        
        if (!selectedPixel) {
            NotificationSystem.warning('Выберите пиксель для размещения');
            return;
        }
        
        if (isCooldown) {
            const remainingTime = appState.get('user.cooldownTime');
            NotificationSystem.warning(`Подождите еще ${remainingTime} секунд`);
            return;
        }
        
        if (!this.appState.isConnected) {
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
        
        // Отключаем кнопку
        this.ui.confirmButton.disabled = true;
        this.ui.confirmButton.style.backgroundColor = '#2c3e50';
        
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
        
        // Включаем кнопку
        this.ui.confirmButton.disabled = false;
        this.ui.confirmButton.style.backgroundColor = '#2ecc71';
        
        console.log('✅ Cooldown ended');
        NotificationSystem.info('Можно размещать следующий пиксель', { duration: 2000 });
    }
    
    /**
     * Обновление отображения cooldown
     */
    updateCooldownDisplay(cooldownTime) {
        if (this.ui.cooldownDisplay) {
            if (cooldownTime > 0) {
                this.ui.cooldownDisplay.textContent = `Следующий пиксель через: ${cooldownTime} секунд.`;
                
                // Обновляем прогресс-бар если он существует
                if (this.ui.cooldownProgressBar) {
                    this.ui.cooldownProgressBar.style.width = '100%';
                    
                    // Анимация прогресс-бара
                    const progress = 100 - (cooldownTime / this.config.COOLDOWN_TIME) * 100;
                    this.ui.cooldownProgressBar.style.width = `${progress}%`;
                }
            } else {
                this.ui.cooldownDisplay.textContent = 'Готов к размещению пикселя!';
                
                // Сбрасываем прогресс-бар если он существует
                if (this.ui.cooldownProgressBar) {
                    this.ui.cooldownProgressBar.style.width = '0%';
                }
            }
        }
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
        
        // Получаем высоту верхней панели и ширину сайдбара
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
        
        // Получаем размеры контейнера канваса
        const containerRect = this.canvasContainer.getBoundingClientRect();
        
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
            sidebarWidth: sidebarWidth,
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
                if (canvasContainer) canvasContainer.style.marginRight = '300px';
                if (topBar) topBar.style.right = '300px';
                console.log('📋 Sidebar shown');
            } else {
                // Скрываем сайдбар
                sidePanel.classList.add('hidden');
                if (canvasContainer) canvasContainer.style.marginRight = '0';
                if (topBar) topBar.style.right = '0';
                console.log('📋 Sidebar hidden');
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
                this.canvasContainer.style.width = availableWidth + 'px';
                this.canvasContainer.style.height = availableHeight + 'px';
                
                this.initializeCanvasSize();
                this.centerCanvas();
                console.log('🎯 Canvas recentered after sidebar toggle');
            }, 100);
            
            // Дополнительное центрирование через 300мс для гарантии
            setTimeout(() => {
                this.centerCanvas();
                console.log('🎯 Final centering after sidebar toggle');
            }, 300);
        }
    }

    /**
     * Переключение видимости мобильного сайдбара
     */
    toggleMobileSidebar() {
        const mobilePanel = document.getElementById('mobile-panel');
        const sidePanel = document.querySelector('.side-panel');
        
        if (mobilePanel) {
            const isVisible = mobilePanel.style.display !== 'none';
            
            if (isVisible) {
                // Скрываем мобильную панель
                mobilePanel.style.display = 'none';
                console.log('📱 Mobile panel hidden');
            } else {
                // Показываем мобильную панель
                mobilePanel.style.display = 'block';
                console.log('📱 Mobile panel shown');
            }
        }
        
        // На мобильных устройствах также переключаем основной сайдбар
        if (window.innerWidth <= 768 && sidePanel) {
            const isHidden = sidePanel.classList.contains('hidden');
            
            if (isHidden) {
                // Показываем сайдбар
                sidePanel.classList.remove('hidden');
                sidePanel.style.display = 'flex';
                sidePanel.style.visibility = 'visible';
                sidePanel.style.opacity = '1';
                sidePanel.style.width = '300px';
                sidePanel.style.transform = 'translateX(0)';
                
                if (this.canvasContainer) this.canvasContainer.style.marginRight = '300px';
                if (this.topBar) this.topBar.style.right = '300px';
                console.log('📋 Mobile: Sidebar shown');
            } else {
                // Скрываем сайдбар
                sidePanel.classList.add('hidden');
                sidePanel.style.display = 'none';
                sidePanel.style.transform = 'translateX(100%)';
                
                if (this.canvasContainer) this.canvasContainer.style.marginRight = '0';
                if (this.topBar) this.topBar.style.right = '0';
                console.log('📋 Mobile: Sidebar hidden');
            }
            
            // Перецентрируем канвас после изменения размеров
            setTimeout(() => {
                // Принудительно устанавливаем новые размеры контейнера
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
                const sidebarWidth = isHidden ? 300 : 0;
                
                const availableWidth = windowWidth - sidebarWidth;
                const availableHeight = windowHeight - headerHeight;
                
                // Принудительно устанавливаем новые размеры
                this.canvasContainer.style.width = availableWidth + 'px';
                this.canvasContainer.style.height = availableHeight + 'px';
                
                this.initializeCanvasSize();
                this.centerCanvas();
                console.log('🎯 Canvas recentered after mobile sidebar toggle');
            }, 100);
            
            // Дополнительное центрирование через 300мс для гарантии
            setTimeout(() => {
                this.centerCanvas();
                console.log('🎯 Final centering after mobile sidebar toggle');
            }, 300);
        }
    }
    
    /**
     * Обработка изменения размера окна
     */
    handleWindowResize() {
        console.log('📐 Window resized');
        
        // Ждем немного, чтобы браузер завершил изменение размеров
        setTimeout(() => {
            // Принудительно устанавливаем новые размеры контейнера
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
            const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 300;
            
            const availableWidth = window.innerWidth > 768 ? windowWidth - sidebarWidth : windowWidth;
            const availableHeight = windowHeight - headerHeight;
            
            // Принудительно устанавливаем новые размеры
            this.canvasContainer.style.width = availableWidth + 'px';
            this.canvasContainer.style.height = availableHeight + 'px';
            
            this.initializeCanvasSize();
            console.log('🔄 Canvas size updated after window resize');
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
        // Получаем конфигурацию из глобальной переменной CONFIG
        if (typeof CONFIG === 'undefined') {
            throw new Error('CONFIG not found. Make sure config is loaded.');
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
