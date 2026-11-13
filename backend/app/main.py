import os
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine.url import make_url
import pymysql
<<<<<<< Updated upstream
import socketio
from contextlib import asynccontextmanager
from app.core.database import engine
from app.models import Base
=======
from app.socket_instance import sio
from app.core.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models import Base
from app.models.user import User
from app.routers import auth, admin, menu, tables, payment_qr, orders, products, payments
from sqlalchemy import text, inspect
from app.routers import kitchen
import socketio
>>>>>>> Stashed changes

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< Updated upstream
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
=======
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

>>>>>>> Stashed changes
socket_app = socketio.ASGIApp(sio, app)