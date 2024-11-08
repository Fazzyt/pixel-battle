import time

# Server settings

HOST = "0.0.0.0"
PORT = 80
DEBUG = True

# Canvas settings
CANVAS_WIDTH = 2000
CANVAS_HEIGHT = 600
COOLDOWN_TIME = 60  # Cooldown time in seconds

canvas = [[{"color": "#FFFFFF", "last_update": 0} for _ in range(CANVAS_WIDTH)] for _ in range(CANVAS_HEIGHT)]
ACTIVE_CONNECTIONS = set()
USER_LAST_PIXEL = {}
ONLINE_USER = 0

BATCH_SIZE = 100
CANVAS_UPDATE = []
LAST_BROADCAST_TIME = time.time()

