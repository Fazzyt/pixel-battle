/**
 * Простая версия приложения для диагностики
 */

console.log('🔧 app_simple.js loaded');

// Проверяем CONFIG
if (typeof CONFIG === 'undefined') {
    console.error('❌ CONFIG not found');
    document.body.innerHTML = '<h1>CONFIG Error</h1><p>CONFIG variable not defined</p>';
} else {
    console.log('✅ CONFIG found:', CONFIG);
}

// Проверяем поддержку ES6 модулей
console.log('🔍 Browser support check:');
console.log('- ES6 modules:', 'noModule' in HTMLScriptElement.prototype);
console.log('- WebSockets:', 'WebSocket' in window);
console.log('- Canvas:', !!document.createElement('canvas').getContext);

// Простая инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded');
    
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        const app = document.getElementById('app');
        
        console.log('🔍 Elements found:');
        console.log('- Loader:', !!loader);
        console.log('- App:', !!app);
        
        if (loader) {
            loader.style.display = 'none';
            console.log('✅ Loader hidden');
        }
        
        if (app) {
            app.style.display = 'block';
            document.body.classList.remove('loading');
            console.log('✅ App shown');
        }
        
        // Простая настройка холста
        const canvas = document.getElementById('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth - 300;
            canvas.height = window.innerHeight - 60;
            
            // Рисуем простой фон
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Рисуем текст
            ctx.fillStyle = '#333';
            ctx.font = '24px Arial';
            ctx.fillText('pixel-battle 2.0 - Diagnostic Mode', 20, 50);
            ctx.fillText('Canvas initialized successfully!', 20, 90);
            
            console.log('✅ Canvas initialized');
        }
        
        // Простая обработка кнопок
        const confirmBtn = document.getElementById('confirm-pixel');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                alert('Button works! 🎉');
                console.log('✅ Button clicked');
            };
            confirmBtn.disabled = false;
        }
        
        console.log('🎉 Simple initialization completed');
        
    }, 1000);
});

// Обработка ошибок
window.addEventListener('error', (e) => {
    console.error('❌ JavaScript Error:', e.error);
    console.error('- Message:', e.message);
    console.error('- File:', e.filename);
    console.error('- Line:', e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Unhandled Promise Rejection:', e.reason);
});
