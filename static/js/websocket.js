const ws = new WebSocket(`ws://${window.location.host}/ws`);

ws.onopen = () => {
    console.log('Connected to server');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'init':
            console.log('Receiving initial pixels batch');
            message.pixels.forEach(pixel => {
                pixelCanvas.setPixel(pixel.x, pixel.y, pixel.color);
            });
            updateOnlineCounter(message.online_users);
            break;

        case 'pixel_update':
            console.log('Received pixel update:', message);
            if (Array.isArray(message.updates)) {
                message.updates.forEach(update => {
                    pixelCanvas.setPixel(update.x, update.y, update.color);
                });
            } else {
                pixelCanvas.setPixel(message.x, message.y, message.color);
            }
            break;

        case 'user_count':
            updateOnlineCounter(message.count);
            break;

        case 'error':
            console.error('Server error:', message.message);
            alert(message.message);
            break;
    }
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from server');

    setTimeout(() => {
        window.location.reload();
    }, 5000);
};

function sendPixelUpdate(x, y, color) {
    if (ws.readyState === WebSocket.OPEN) {
        const update = {
            type: 'pixel_update',
            x: x,
            y: y,
            color: color
        };
        console.log('Sending pixel update:', update);
        ws.send(JSON.stringify(update));
    } else {
        console.error('WebSocket is not connected');
    }
}

function updateOnlineCounter(count) {
    document.getElementById('online-counter').innerText = `Online: ${count}`;
}