/**
 * Централизованное управление состоянием приложения
 * 
 * Управляет всем состоянием клиента через паттерн Observer
 */

export class StateManager {
    constructor() {
        this.state = {
            // Состояние холста
            canvas: {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                selectedPixel: null,
                pixels: new Map(),
                isDragging: false
            },
            
            // Состояние пользователя
            user: {
                selectedColor: '#000000',
                cooldownTime: 0,
                isCooldown: false,
                clientId: null
            },
            
            // Состояние подключения
            connection: {
                isConnected: false,
                reconnectAttempts: 0,
                lastPing: null,
                onlineUsers: 0
            },
            
            // UI состояние
            ui: {
                cursorPosition: null,
                selectedTool: 'pixel',
                notifications: []
            },
            
            // Статистика производительности
            performance: {
                fps: 0,
                renderTime: 0,
                pixelsRendered: 0,
                memoryUsage: 0
            }
        };
        
        // Подписчики на изменения состояния
        this.subscribers = new Map();
        
        // Middleware для обработки изменений
        this.middleware = [];
    }
    
    /**
     * Подписка на изменения состояния
     * @param {string} path - Путь к свойству состояния
     * @param {function} callback - Коллбек при изменении
     * @returns {function} Функция отписки
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        
        this.subscribers.get(path).add(callback);
        
        // Возвращаем функцию отписки
        return () => {
            const subscribers = this.subscribers.get(path);
            if (subscribers) {
                subscribers.delete(callback);
            }
        };
    }
    
    /**
     * Получение значения из состояния
     * @param {string} path - Путь к свойству (например, 'canvas.scale')
     * @returns {*} Значение
     */
    get(path) {
        return this._getNestedValue(this.state, path);
    }
    
    /**
     * Обновление состояния
     * @param {string} path - Путь к свойству
     * @param {*} value - Новое значение
     */
    set(path, value) {
        const oldValue = this.get(path);
        this._setNestedValue(this.state, path, value);
        
        // Вызываем middleware
        this.middleware.forEach(middleware => {
            middleware(path, value, oldValue);
        });
        
        // Уведомляем подписчиков
        this._notifySubscribers(path, value, oldValue);
    }
    
    /**
     * Обновление нескольких значений атомарно
     * @param {object} updates - Объект с обновлениями
     */
    batchUpdate(updates) {
        const changes = [];
        
        for (const [path, value] of Object.entries(updates)) {
            const oldValue = this.get(path);
            this._setNestedValue(this.state, path, value);
            changes.push({ path, value, oldValue });
        }
        
        // Применяем middleware для всех изменений
        changes.forEach(({ path, value, oldValue }) => {
            this.middleware.forEach(middleware => {
                middleware(path, value, oldValue);
            });
        });
        
        // Уведомляем подписчиков
        changes.forEach(({ path, value, oldValue }) => {
            this._notifySubscribers(path, value, oldValue);
        });
    }
    
    /**
     * Добавление middleware
     * @param {function} middleware - Функция middleware
     */
    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }
    
    /**
     * Получение снимка состояния
     * @returns {object} Копия состояния
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }
    
    /**
     * Восстановление состояния из снимка
     * @param {object} snapshot - Снимок состояния
     */
    restoreSnapshot(snapshot) {
        this.state = JSON.parse(JSON.stringify(snapshot));
        this._notifyAll();
    }
    
    /**
     * Сброс состояния к начальным значениям
     */
    reset() {
        const newState = {
            canvas: {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                selectedPixel: null,
                pixels: new Map(),
                isDragging: false
            },
            user: {
                selectedColor: '#000000',
                cooldownTime: 0,
                isCooldown: false,
                clientId: null
            },
            connection: {
                isConnected: false,
                reconnectAttempts: 0,
                lastPing: null,
                onlineUsers: 0
            },
            ui: {
                cursorPosition: null,
                selectedTool: 'pixel',
                notifications: []
            },
            performance: {
                fps: 0,
                renderTime: 0,
                pixelsRendered: 0,
                memoryUsage: 0
            }
        };
        
        this.state = newState;
        this._notifyAll();
    }
    
    /**
     * Инициализация состояния канваса с правильными начальными позициями
     */
    initializeCanvasState() {
        // Получаем размеры окна
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        
        // Вычисляем доступную область для канваса (теперь на весь экран)
        const availableWidth = windowWidth;
        const availableHeight = windowHeight - headerHeight;
        
        // Устанавливаем начальные позиции для центрирования
        this.set('canvas.scale', 1);
        this.set('canvas.offsetX', 0);
        this.set('canvas.offsetY', headerHeight);
        
        console.log('🎯 StateManager: Canvas state initialized with:', {
            windowSize: { width: windowWidth, height: windowHeight },
            availableArea: { width: availableWidth, height: availableHeight },
            headerHeight,
            initialOffsets: { x: 0, y: headerHeight }
        });
    }
    
    // Приватные методы
    
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!(key in current)) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }
    
    _notifySubscribers(path, value, oldValue) {
        // Уведомляем точных подписчиков
        const subscribers = this.subscribers.get(path);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(value, oldValue, path);
                } catch (error) {
                    console.error('Error in state subscriber:', error);
                }
            });
        }
        
        // Уведомляем подписчиков родительских путей
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentSubscribers = this.subscribers.get(parentPath);
            if (parentSubscribers) {
                const parentValue = this.get(parentPath);
                parentSubscribers.forEach(callback => {
                    try {
                        callback(parentValue, null, parentPath);
                    } catch (error) {
                        console.error('Error in parent state subscriber:', error);
                    }
                });
            }
        }
    }
    
    _notifyAll() {
        this.subscribers.forEach((callbacks, path) => {
            const value = this.get(path);
            callbacks.forEach(callback => {
                try {
                    callback(value, null, path);
                } catch (error) {
                    console.error('Error in state subscriber:', error);
                }
            });
        });
    }
}

// Синглтон паттерн для глобального состояния
export const appState = new StateManager();

// Middleware для логирования изменений состояния (в debug режиме)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    appState.addMiddleware((path, value, oldValue) => {
        console.log(`🔄 State Change: ${path}`, { oldValue, newValue: value });
    });
}
