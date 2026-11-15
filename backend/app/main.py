import os
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine.url import make_url
import pymysql
import socketio
from contextlib import asynccontextmanager
from app.core.database import engine
from app.models import Base

from app.socket_instance import sio
from app.core.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models import Base
from app.models.user import User
from app.routers import auth, admin, menu, tables, payment_qr, orders, products, payments, kitchen
from sqlalchemy import text, inspect
from app.routers import kitchen
import socketio

load_dotenv()

def create_database_if_not_exists():
    db_url = make_url(os.getenv("DATABASE_URL"))
    connection = pymysql.connect(
        host=db_url.host or "localhost",
        user=db_url.username or "root",
        password=db_url.password or "",
        port=db_url.port or 3306
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_url.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        connection.commit()
    finally:
        connection.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_database_if_not_exists()
    Base.metadata.create_all(bind=engine)
    print("✅ Đã đồng bộ toàn bộ bảng vào MySQL thành công!")
    yield
    
with engine.begin() as conn:
    inspector = inspect(engine)
    
    item_cols = [c["name"] for c in inspector.get_columns("order_items")]
    if "is_priority" not in item_cols:
        conn.execute(text("ALTER TABLE order_items ADD COLUMN is_priority BOOLEAN DEFAULT FALSE"))
    if "cancel_reason" not in item_cols:
        conn.execute(text("ALTER TABLE order_items ADD COLUMN cancel_reason VARCHAR(255) NULL"))
    if "updated_by" not in item_cols:
        conn.execute(text("ALTER TABLE order_items ADD COLUMN updated_by BIGINT NULL"))
    if "completed_at" not in item_cols:
        conn.execute(text("ALTER TABLE order_items ADD COLUMN completed_at DATETIME NULL"))
    print("✅ Đã kiểm tra và cập nhật các cột cho bảng order_items!")
app = FastAPI(title="Restaurant POS API", lifespan=lifespan)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse

_RATE_LIMIT_STORE = defaultdict(list)

@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path_str = request.url.path
    method = request.method.upper()

    # Áp dụng Rate Limit cho các request ghi từ IP bên ngoài (miễn trừ localhost để chạy test nội bộ)
    if client_ip not in ("127.0.0.1", "::1", "localhost") and method in ("POST", "PUT", "DELETE"):
        sensitive_prefixes = ("/api/orders", "/api/auth/login", "/api/kitchen/live-alerts-v2")
        if any(path_str.startswith(p) for p in sensitive_prefixes):
            now = time.time()
            window_sec = 10.0
            max_reqs = 25
            history = [t for t in _RATE_LIMIT_STORE[client_ip] if now - t < window_sec]
            if len(history) >= max_reqs:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Thao tác quá nhanh (Rate Limit). Vui lòng thử lại sau vài giây!"}
                )
            history.append(now)
            _RATE_LIMIT_STORE[client_ip] = history

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.100.26", "http://192.168.100.26"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Đăng ký router xác thực & quản lý tài khoản
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(menu.router)
app.include_router(tables.router)
app.include_router(payment_qr.router)
app.include_router(orders.router)
app.include_router(products.router)
app.include_router(kitchen.router)
app.include_router(payments.router)

socket_app = socketio.ASGIApp(sio, app)