import time

# Server settings

HOST = "0.0.0.0"
PORT = 80
DEBUG = True

# Canvas settings
CANVAS_WIDTH = 2000
CANVAS_HEIGHT = 600
COOLDOWN_TIME = 60  # Cooldown time in seconds
PIXEL_SIZE = 2  # Size of each pixel in the canvas

canvas = [[{"color": "#FFFFFF", "last_update": 0} for _ in range(CANVAS_WIDTH)] for _ in range(CANVAS_HEIGHT)]
ACTIVE_CONNECTIONS = set()
USER_LAST_PIXEL = {}
ONLINE_USER = 0

BATCH_SIZE = 100
CANVAS_UPDATE = []
LAST_BROADCAST_TIME = time.time()

colors = [
    "#000000", "#808080", "#A9A9A9", "#A52A2A",
    "#C0C0C0", "#800080", "#008000", "#0000FF",
    "#FF0000", "#6495ED", "#FFA500", "#FFFF00",
    "#00FFFF", "#FFB6C1", "#FFC0CB", "#90EE90",
    "#D8BFD8", "#ADD8E6", "#FF69B4", "#FFFFFF",
]