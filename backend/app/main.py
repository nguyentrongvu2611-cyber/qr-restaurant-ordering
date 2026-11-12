import os
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

app = FastAPI(title="Restaurant POS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)