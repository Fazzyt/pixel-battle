class PixelCanvas {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.selectedColor = '#000000';
        this.selectedPixel = null;
        this.pixels = new Map();
        this.highlightColor = 'rgba(255, 255, 0, 0.5)';
        
        this.coordsElement = document.getElementById('coordinates');
        
        this.initCanvas();
        this.setupEventListeners();
        this.render();
    }

    initCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerCanvas();
    }

    centerCanvas() {
        this.offsetX = (this.canvas.width - CONFIG.CANVAS_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - CONFIG.CANVAS_HEIGHT * this.scale) / 2;
    }

    setupEventListeners() {
        // Мышь
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Сенсорный экран
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Изменение размера окна
        window.addEventListener('resize', () => {
            this.initCanvas();
            this.render();
        });
    }

    handleMouseDown(event) {
        if (event.button === 2) { // Правая кнопка мыши для перетаскивания
            this.isDragging = true;
            this.lastX = event.clientX;
            this.lastY = event.clientY;
            return;
        }

        const pos = this.screenToCanvas(event.clientX, event.clientY);
        if (this.isValidPosition(pos.x, pos.y)) {
            this.selectPixel(pos.x, pos.y);
        }
    }

    handleMouseMove(event) {
        const pos = this.screenToCanvas(event.clientX, event.clientY);
        this.updateCoordinatesDisplay(pos.x, pos.y);

        if (this.isDragging) {
            const deltaX = event.clientX - this.lastX;
            const deltaY = event.clientY - this.lastY;
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            this.lastX = event.clientX;
            this.lastY = event.clientY;
            this.render();
        }
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleMouseLeave() {
        this.coordsElement.textContent = 'Координаты:';
    }

    handleWheel(event) {
        event.preventDefault();
        const delta = -Math.sign(event.deltaY);
        const zoom = 1.1;
        const newScale = delta > 0 ? this.scale * zoom : this.scale / zoom;

        if (newScale >= CONFIG.MIN_SCALE && newScale <= CONFIG.MAX_SCALE) {
            // Масштабирование относительно позиции курсора
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            const oldWorldX = (mouseX - this.offsetX) / this.scale;
            const oldWorldY = (mouseY - this.offsetY) / this.scale;

            this.scale = newScale;

            const newWorldX = (mouseX - this.offsetX) / this.scale;
            const newWorldY = (mouseY - this.offsetY) / this.scale;

            this.offsetX += (newWorldX - oldWorldX) * this.scale;
            this.offsetY += (newWorldY - oldWorldY) * this.scale;

            this.render();
        }
    }

    handleTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            // Одно касание - выбор пикселя
            const touch = event.touches[0];
            const pos = this.screenToCanvas(touch.clientX, touch.clientY);
            if (this.isValidPosition(pos.x, pos.y)) {
                this.selectPixel(pos.x, pos.y);
            }
            this.lastX = touch.clientX;
            this.lastY = touch.clientY;
        } else if (event.touches.length === 2) {
            // Два касания - начало масштабирования
            this.lastTouchDistance = this.getTouchDistance(event.touches);
        }
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            // Перетаскивание одним пальцем
            const touch = event.touches[0];
            const pos = this.screenToCanvas(touch.clientX, touch.clientY);
            this.updateCoordinatesDisplay(pos.x, pos.y);
    
            if (this.lastX && this.lastY) {
                const deltaX = touch.clientX - this.lastX;
                const deltaY = touch.clientY - this.lastY;
                this.offsetX += deltaX;
                this.offsetY += deltaY;
                this.render();
            }
            this.lastX = touch.clientX;
            this.lastY = touch.clientY;
        } else if (event.touches.length === 2) {
            // Масштабирование двумя пальцами
            const currentDistance = this.getTouchDistance(event.touches);
            const delta = currentDistance / this.lastTouchDistance;
            
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
    
            const newScale = this.scale * delta;
            if (newScale >= CONFIG.MIN_SCALE && newScale <= CONFIG.MAX_SCALE) {
                const oldWorldX = (centerX - this.offsetX) / this.scale;
                const oldWorldY = (centerY - this.offsetY) / this.scale;
    
                this.scale = newScale;
    
                const newWorldX = (centerX - this.offsetX) / this.scale;
                const newWorldY = (centerY - this.offsetY) / this.scale;
    
                this.offsetX += (newWorldX - oldWorldX) * this.scale;
                this.offsetY += (newWorldY - oldWorldY) * this.scale;
    
                this.lastTouchDistance = currentDistance;
                this.render();
            }
        }
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        if (event.touches.length === 0) {
            this.lastX = null;
            this.lastY = null;
            this.lastTouchDistance = null;
        }
    }

    getTouchDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }

    screenToCanvas(screenX, screenY) {
        return {
            x: Math.floor((screenX - this.offsetX) / (CONFIG.PIXEL_SIZE * this.scale)),
            y: Math.floor((screenY - this.offsetY) / (CONFIG.PIXEL_SIZE * this.scale))
        };
    }

    isValidPosition(x, y) {
        return x >= 0 && x < CONFIG.CANVAS_WIDTH / CONFIG.PIXEL_SIZE &&
               y >= 0 && y < CONFIG.CANVAS_HEIGHT / CONFIG.PIXEL_SIZE;
    }

    updateCoordinatesDisplay(x, y) {
        if (this.isValidPosition(x, y)) {
            this.coordsElement.textContent = `Координаты: ${x}, ${y}`;
        } else {
            this.coordsElement.textContent = 'Координаты:';
        }
    }

    selectPixel(x, y) {
        this .selectedPixel = { x, y };
        this.render();
    }

    clearSelection() {
        this.selectedPixel = null;
        this.render();
    }

    setPixel(x, y, color) {
        const key = `${x},${y}`;
        this.pixels.set(key, color);
        this.render();
    }

    drawPixel(x, y, color) {
        const size = CONFIG.PIXEL_SIZE * this.scale;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            this.offsetX + x * size,
            this.offsetY + y * size,
            size,
            size
        );
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(
            this.offsetX,
            this.offsetY,
            CONFIG.CANVAS_WIDTH * this.scale,
            CONFIG.CANVAS_HEIGHT * this.scale
        );

        // Draw grid
        // this.drawGrid();

        // Draw existing pixels
        for (const [coord, color] of this.pixels) {
            const [x, y] = coord.split(',').map(Number);
            this.drawPixel(x, y, color);
        }

        // Draw highlight for selected pixel
        if (this.selectedPixel) {
            this.ctx.fillStyle = this.highlightColor;
            this.ctx.fillRect(
                this.offsetX + this.selectedPixel.x * CONFIG.PIXEL_SIZE * this.scale,
                this.offsetY + this.selectedPixel.y * CONFIG.PIXEL_SIZE * this.scale,
                CONFIG.PIXEL_SIZE * this.scale,
                CONFIG.PIXEL_SIZE * this.scale
            );
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.01)';
        this.ctx.lineWidth = 0.01;

        // Vertical lines
        for (let x = 0; x <= CONFIG.CANVAS_WIDTH * this.scale; x += CONFIG.PIXEL_SIZE * this.scale) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.offsetX + x, this.offsetY);
            this.ctx.lineTo(this.offsetX + x, this.offsetY + CONFIG.CANVAS_HEIGHT * this.scale);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= CONFIG.CANVAS_HEIGHT * this.scale; y += CONFIG.PIXEL_SIZE * this.scale) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.offsetX, this.offsetY + y);
            this.ctx.lineTo(this.offsetX + CONFIG.CANVAS_WIDTH * this.scale, this.offsetY + y);
            this.ctx.stroke();
        }
    }
}