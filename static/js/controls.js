const pixelCanvas = new PixelCanvas();
let cooldown = 0;
let isCooldown = false;

// Color selection
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', (e) => {
        document.querySelectorAll('.color-option').forEach(opt => 
            opt.classList.remove('selected'));
        option.classList.add('selected');
        pixelCanvas.selectedColor = option.dataset.color;
    });
});

// Confirm pixel placement
document.getElementById('confirm-pixel').addEventListener('click', () => {
    if (!isCooldown && pixelCanvas.selectedPixel) {
        const pixel = pixelCanvas.selectedPixel;
        console.log('Placing pixel:', pixel.x, pixel.y, pixelCanvas.selectedColor);
        sendPixelUpdate(pixel.x, pixel.y, pixelCanvas.selectedColor);
        pixelCanvas.setPixel(pixel.x, pixel.y, pixelCanvas.selectedColor);
        pixelCanvas.clearSelection();
        startCooldown();
    } else {
        console.log('Cannot place pixel: cooldown active or no pixel selected');
    }
});

function startCooldown() {
    isCooldown = true;
    cooldown = CONFIG.COOLDOWN_TIME;
    const confirmButton = document.getElementById('confirm-pixel');
    
    confirmButton.style.backgroundColor = '#2c3e50';
    confirmButton.disabled = true;

    updateCooldownDisplay();

    const interval = setInterval(() => {
        cooldown--;
        updateCooldownDisplay();
        
        if (cooldown <= 0) {
            clearInterval(interval);
            isCooldown = false;
            confirmButton.style.backgroundColor = '#2ecc71'; 
            confirmButton.disabled = false;
        }
    }, 1000);
}

function updateCooldownDisplay() {
    document.getElementById('cooldown').innerText = 
        `Следующий пиксель через: ${Math.max(0, cooldown)} секунд.`;
}