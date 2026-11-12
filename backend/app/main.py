import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine.url import make_url
import pymysql
import socketio

from app.core.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models import Base
from app.models.user import User
from app.routers import auth

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

def seed_default_admin():
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.role == "ADMIN").first()
        if not admin_exists:
            default_admin = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                full_name="Quản Trị Viên Hệ Thống",
                role="ADMIN",
                is_active=True
            )
            db.add(default_admin)
            db.commit()
            print("🔑 Đã khởi tạo tài khoản Admin mặc định: admin / admin123")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_database_if_not_exists()
    Base.metadata.create_all(bind=engine)
    seed_default_admin()
    print("✅ Đã đồng bộ toàn bộ bảng vào MySQL thành công!")
    yield

app = FastAPI(title="Restaurant POS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký router xác thực & quản lý tài khoản
app.include_router(auth.router)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)