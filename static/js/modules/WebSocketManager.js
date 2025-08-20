/**
 * Продвинутый WebSocket менеджер
 * 
 * Поддерживает автопереподключение, heartbeat, offline mode
 */

import { appState } from './StateManager.js';

export class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.ws = null;
        
        // Настройки подключения
        this.config = {
            maxReconnectAttempts: 10,
            reconnectInterval: 1000, // Начальная задержка
            maxReconnectInterval: 30000, // Максимальная задержка
            heartbeatInterval: 30000, // Ping каждые 30 сек
            connectionTimeout: 10000 // Таймаут подключения
        };
        
        // Состояние подключения
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.heartbeatTimer = null;
        this.connectionTimer = null;
        
        // Очередь сообщений для отправки при переподключении
        this.messageQueue = [];
        
        // Callbacks для различных событий
        this.eventHandlers = new Map();
        
        this.setupDefaultHandlers();
    }
    
    /**
     * Подключение к WebSocket серверу
     */
    async connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        
        this.isConnecting = true;
        appState.set('connection.isConnected', false);
        
        try {
            console.log('🔌 Connecting to WebSocket...', this.url);
            
            this.ws = new WebSocket(this.url);
            
            // Таймаут подключения
            this.connectionTimer = setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    console.warn('⏰ Connection timeout');
                    this.ws.close();
                }
            }, this.config.connectionTimeout);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            
        } catch (error) {
            console.error('❌ WebSocket connection error:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }
    
    /**
     * Отключение от WebSocket
     */
    disconnect() {
        console.log('🔌 Disconnecting WebSocket...');
        
        this.clearTimers();
        
        if (this.ws) {
            this.ws.onclose = null; // Предотвращаем автопереподключение
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
        
        appState.batchUpdate({
            'connection.isConnected': false,
            'connection.reconnectAttempts': 0
        });
        
        this.reconnectAttempts = 0;
        this.isConnecting = false;
    }
    
    /**
     * Отправка сообщения
     * @param {object} message - Сообщение для отправки
     * @param {boolean} queueIfDisconnected - Добавить в очередь если не подключен
     */
    send(message, queueIfDisconnected = true) {
        const messageStr = JSON.stringify(message);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(messageStr);
                console.log('📤 Message sent:', message);
                return true;
            } catch (error) {
                console.error('❌ Send error:', error);
                
                if (queueIfDisconnected) {
                    this.messageQueue.push(message);
                }
                
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket not connected');
            
            if (queueIfDisconnected) {
                this.messageQueue.push(message);
                console.log('📝 Message queued for later send');
            }
            
            return false;
        }
    }
    
    /**
     * Обработчик успешного подключения
     */
    handleOpen(event) {
        console.log('✅ WebSocket connected');
        
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        this.clearTimers();
        
        // Обновляем состояние
        appState.batchUpdate({
            'connection.isConnected': true,
            'connection.reconnectAttempts': 0,
            'connection.lastPing': Date.now()
        });
        
        // Отправляем накопленные сообщения
        this.flushMessageQueue();
        
        // Запускаем heartbeat
        this.startHeartbeat();
        
        // Вызываем пользовательские обработчики
        this.emit('connected', event);
    }
    
    /**
     * Обработчик входящих сообщений
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📥 Message received:', message);
            
            // Обработка системных сообщений
            switch (message.type) {
                case 'init':
                    this.handleInitMessage(message);
                    break;
                    
                case 'pixel_update':
                    this.handlePixelUpdate(message);
                    break;
                    
                case 'user_count':
                    appState.set('connection.onlineUsers', message.count);
                    break;
                    
                case 'pong':
                    this.handlePong(message);
                    break;
                    
                case 'error':
                    this.handleServerError(message);
                    break;
            }
            
            // Вызываем пользовательские обработчики
            this.emit('message', message);
            this.emit(`message:${message.type}`, message);
            
        } catch (error) {
            console.error('❌ Error parsing message:', error, event.data);
        }
    }
    
    /**
     * Обработчик закрытия соединения
     */
    handleClose(event) {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        
        this.isConnecting = false;
        this.clearTimers();
        
        appState.set('connection.isConnected', false);
        
        // Автопереподключение если не было ручного отключения
        if (event.code !== 1000) {
            this.scheduleReconnect();
        }
        
        this.emit('disconnected', event);
    }
    
    /**
     * Обработчик ошибок
     */
    handleError(event) {
        console.error('❌ WebSocket error:', event);
        this.emit('error', event);
    }
    
    /**
     * Планирование переподключения с экспоненциальной задержкой
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('💥 Max reconnect attempts reached');
            appState.set('ui.notifications', [
                ...appState.get('ui.notifications'),
                {
                    id: Date.now(),
                    type: 'error',
                    message: 'Не удалось подключиться к серверу. Попробуйте обновить страницу.',
                    persistent: true
                }
            ]);
            return;
        }
        
        this.reconnectAttempts++;
        appState.set('connection.reconnectAttempts', this.reconnectAttempts);
        
        // Экспоненциальная задержка с jitter
        const baseDelay = Math.min(
            this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
            this.config.maxReconnectInterval
        );
        const jitter = baseDelay * 0.1 * Math.random();
        const delay = baseDelay + jitter;
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (!appState.get('connection.isConnected')) {
                this.connect();
            }
        }, delay);
    }
    
    /**
     * Запуск heartbeat пинга
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'ping',
                    timestamp: Date.now()
                }, false);
            }
        }, this.config.heartbeatInterval);
    }
    
    /**
     * Очистка таймеров
     */
    clearTimers() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
    }
    
    /**
     * Отправка накопленных сообщений
     */
    flushMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        console.log(`📤 Sending ${this.messageQueue.length} queued messages`);
        
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        
        messages.forEach(message => {
            this.send(message, false);
        });
    }
    
    /**
     * Обработка инициализационного сообщения
     */
    handleInitMessage(message) {
        console.log('🚀 Initializing with', message.pixels.length, 'pixels');
        
        // Очищаем существующие пиксели
        const newPixels = new Map();
        
        // Загружаем пиксели
        message.pixels.forEach(pixel => {
            const key = `${pixel.x},${pixel.y}`;
            newPixels.set(key, pixel.color);
        });
        
        // Обновляем состояние
        appState.batchUpdate({
            'canvas.pixels': newPixels,
            'connection.onlineUsers': message.online_users
        });
    }
    
    /**
     * Обработка обновления пикселей
     */
    handlePixelUpdate(message) {
        const pixels = appState.get('canvas.pixels');
        const key = `${message.x},${message.y}`;
        
        // Создаем новую Map для immutability
        const newPixels = new Map(pixels);
        newPixels.set(key, message.color);
        
        appState.set('canvas.pixels', newPixels);
    }
    
    /**
     * Обработка pong сообщений
     */
    handlePong(message) {
        const latency = Date.now() - message.timestamp;
        console.log(`🏓 Pong received, latency: ${latency}ms`);
        
        appState.set('connection.lastPing', Date.now());
    }
    
    /**
     * Обработка ошибок от сервера
     */
    handleServerError(message) {
        console.error('🚨 Server error:', message.message);
        
        // Добавляем уведомление
        appState.set('ui.notifications', [
            ...appState.get('ui.notifications'),
            {
                id: Date.now(),
                type: 'error',
                message: message.message,
                duration: 5000
            }
        ]);
    }
    
    /**
     * Настройка стандартных обработчиков
     */
    setupDefaultHandlers() {
        // Обработчик отправки пиксельных обновлений
        this.on('sendPixelUpdate', (data) => {
            this.send({
                type: 'pixel_update',
                x: data.x,
                y: data.y,
                color: data.color
            });
        });
    }
    
    /**
     * Подписка на события
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
        
        // Возвращаем функцию отписки
        return () => {
            const handlers = this.eventHandlers.get(event);
            if (handlers) {
                handlers.delete(handler);
            }
        };
    }
    
    /**
     * Однократная подписка на событие
     */
    once(event, handler) {
        const unsubscribe = this.on(event, (...args) => {
            handler(...args);
            unsubscribe();
        });
        return unsubscribe;
    }
    
    /**
     * Вызов обработчиков события
     */
    emit(event, ...args) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Получение статуса подключения
     */
    getConnectionStatus() {
        return {
            connected: this.ws && this.ws.readyState === WebSocket.OPEN,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length
        };
    }
}

// Создаем глобальный экземпляр WebSocket менеджера
export const createWebSocketManager = (url) => {
    return new WebSocketManager(url);
};
