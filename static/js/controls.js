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
    document.getElementById('confirm-pixel').style.display = 'none';
    updateCooldownDisplay();

    const interval = setInterval(() => {
        cooldown--;
        updateCooldownDisplay();
        
        if (cooldown <= 0) {
            clearInterval(interval);
            isCooldown = false;
            if (pixelCanvas.selectedPixel) {
                document.getElementById('confirm-pixel').style.display = 'block';
            }
        }
    }, 1000);
}

function updateCooldownDisplay() {
    document.getElementById('cooldown').innerText = 
        `Cooldown: ${Math.max(0, cooldown)}s`;
}