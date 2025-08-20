/**
 * Система уведомлений
 * 
 * Красивые toast уведомления с анимациями
 */

import { appState } from '../modules/StateManager.js';

export class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.maxNotifications = 5;
        
        this.createContainer();
        this.setupStateListeners();
    }
    
    /**
     * Создание контейнера для уведомлений
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        
        // Стили контейнера
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10000',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '400px'
        });
        
        document.body.appendChild(this.container);
    }
    
    /**
     * Настройка слушателей состояния
     */
    setupStateListeners() {
        appState.subscribe('ui.notifications', (notifications) => {
            this.updateNotifications(notifications);
        });
    }
    
    /**
     * Обновление отображаемых уведомлений
     */
    updateNotifications(notifications) {
        // Удаляем старые уведомления
        const currentIds = new Set(notifications.map(n => n.id));
        const toRemove = [];
        
        this.notifications.forEach((element, id) => {
            if (!currentIds.has(id)) {
                toRemove.push(id);
            }
        });
        
        toRemove.forEach(id => this.removeNotification(id));
        
        // Добавляем новые уведомления
        notifications.forEach(notification => {
            if (!this.notifications.has(notification.id)) {
                this.addNotification(notification);
            }
        });
        
        // Ограничиваем количество уведомлений
        this.limitNotifications();
    }
    
    /**
     * Добавление нового уведомления
     */
    addNotification(notification) {
        const element = this.createNotificationElement(notification);
        this.notifications.set(notification.id, element);
        this.container.appendChild(element);
        
        // Анимация появления
        requestAnimationFrame(() => {
            element.classList.add('notification-show');
        });
        
        // Автоудаление если не постоянное
        if (!notification.persistent && notification.duration !== 0) {
            const duration = notification.duration || 5000;
            setTimeout(() => {
                this.dismissNotification(notification.id);
            }, duration);
        }
    }
    
    /**
     * Создание элемента уведомления
     */
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type || 'info'}`;
        element.setAttribute('data-notification-id', notification.id);
        
        // Базовые стили
        Object.assign(element.style, {
            backgroundColor: this.getTypeColor(notification.type),
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            fontSize: '14px',
            lineHeight: '1.4',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            pointerEvents: 'auto',
            cursor: 'default',
            transform: 'translateX(100%)',
            opacity: '0',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: '0',
            minWidth: '300px',
            maxWidth: '400px',
            wordWrap: 'break-word'
        });
        
        // Иконка
        const icon = this.createIcon(notification.type);
        const iconElement = document.createElement('div');
        iconElement.innerHTML = icon;
        iconElement.style.cssText = `
            display: inline-block;
            margin-right: 12px;
            vertical-align: middle;
            font-size: 18px;
            opacity: 0.9;
        `;
        
        // Контент
        const content = document.createElement('div');
        content.style.cssText = `
            display: inline-block;
            vertical-align: middle;
            flex: 1;
        `;
        
        // Заголовок
        if (notification.title) {
            const title = document.createElement('div');
            title.textContent = notification.title;
            title.style.cssText = `
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 15px;
            `;
            content.appendChild(title);
        }
        
        // Сообщение
        const message = document.createElement('div');
        message.textContent = notification.message;
        message.style.cssText = `
            opacity: 0.95;
            line-height: 1.3;
        `;
        content.appendChild(message);
        
        // Кнопка закрытия
        const closeButton = this.createCloseButton(notification.id);
        
        // Прогресс-бар для временных уведомлений
        let progressBar = null;
        if (!notification.persistent && notification.duration > 0) {
            progressBar = this.createProgressBar(notification.duration);
        }
        
        // Сборка элемента
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            display: flex;
            align-items: flex-start;
            width: 100%;
        `;
        
        wrapper.appendChild(iconElement);
        wrapper.appendChild(content);
        wrapper.appendChild(closeButton);
        
        element.appendChild(wrapper);
        
        if (progressBar) {
            element.appendChild(progressBar);
        }
        
        // Hover эффекты
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'translateX(-5px) scale(1.02)';
            element.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'translateX(0) scale(1)';
            element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        });
        
        return element;
    }
    
    /**
     * Создание иконки по типу уведомления
     */
    createIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '⏳'
        };
        
        return icons[type] || icons.info;
    }
    
    /**
     * Получение цвета по типу уведомления
     */
    getTypeColor(type) {
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6',
            loading: '#8B5CF6'
        };
        
        return colors[type] || colors.info;
    }
    
    /**
     * Создание кнопки закрытия
     */
    createCloseButton(notificationId) {
        const button = document.createElement('button');
        button.innerHTML = '×';
        button.style.cssText = `
            background: none;
            border: none;
            color: inherit;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            padding: 0;
            margin-left: 12px;
            opacity: 0.7;
            transition: opacity 0.2s;
            line-height: 1;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.opacity = '1';
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.opacity = '0.7';
            button.style.backgroundColor = 'transparent';
        });
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismissNotification(notificationId);
        });
        
        return button;
    }
    
    /**
     * Создание прогресс-бара
     */
    createProgressBar(duration) {
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background-color: rgba(255, 255, 255, 0.3);
            width: 100%;
            border-radius: 0 0 8px 8px;
            overflow: hidden;
        `;
        
        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            height: 100%;
            background-color: rgba(255, 255, 255, 0.7);
            width: 100%;
            transform: translateX(-100%);
            animation: progress-bar ${duration}ms linear forwards;
        `;
        
        progressBar.appendChild(progressFill);
        
        // Добавляем CSS анимацию если её нет
        if (!document.querySelector('#notification-progress-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-progress-styles';
            style.textContent = `
                @keyframes progress-bar {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0%); }
                }
                .notification-show {
                    transform: translateX(0) !important;
                    opacity: 1 !important;
                }
                .notification-hide {
                    transform: translateX(100%) !important;
                    opacity: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        return progressBar;
    }
    
    /**
     * Удаление уведомления с анимацией
     */
    dismissNotification(notificationId) {
        const element = this.notifications.get(notificationId);
        if (!element) return;
        
        // Анимация исчезновения
        element.classList.add('notification-hide');
        
        setTimeout(() => {
            this.removeNotification(notificationId);
        }, 300);
        
        // Обновляем состояние
        const currentNotifications = appState.get('ui.notifications') || [];
        const updatedNotifications = currentNotifications.filter(n => n.id !== notificationId);
        appState.set('ui.notifications', updatedNotifications);
    }
    
    /**
     * Физическое удаление уведомления
     */
    removeNotification(notificationId) {
        const element = this.notifications.get(notificationId);
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
        this.notifications.delete(notificationId);
    }
    
    /**
     * Ограничение количества уведомлений
     */
    limitNotifications() {
        if (this.notifications.size <= this.maxNotifications) return;
        
        const notificationElements = Array.from(this.container.children);
        const oldestElements = notificationElements.slice(0, notificationElements.length - this.maxNotifications);
        
        oldestElements.forEach(element => {
            const id = parseInt(element.getAttribute('data-notification-id'));
            this.dismissNotification(id);
        });
    }
    
    /**
     * Удаление всех уведомлений
     */
    clearAll() {
        appState.set('ui.notifications', []);
    }
    
    /**
     * Вспомогательные методы для создания уведомлений
     */
    
    static show(message, type = 'info', options = {}) {
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            title: options.title,
            duration: options.duration !== undefined ? options.duration : 5000,
            persistent: options.persistent || false
        };
        
        const current = appState.get('ui.notifications') || [];
        appState.set('ui.notifications', [...current, notification]);
        
        return notification.id;
    }
    
    static success(message, options = {}) {
        return this.show(message, 'success', options);
    }
    
    static error(message, options = {}) {
        return this.show(message, 'error', { ...options, duration: options.duration || 8000 });
    }
    
    static warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }
    
    static info(message, options = {}) {
        return this.show(message, 'info', options);
    }
    
    static loading(message, options = {}) {
        return this.show(message, 'loading', { ...options, persistent: true });
    }
    
    static dismiss(id) {
        const current = appState.get('ui.notifications') || [];
        const updated = current.filter(n => n.id !== id);
        appState.set('ui.notifications', updated);
    }
}
