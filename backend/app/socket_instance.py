import socketio

# Khởi tạo Socket.IO tại đây để tránh lỗi import vòng tròn
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')