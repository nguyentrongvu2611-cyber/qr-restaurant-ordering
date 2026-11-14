# socket_manager.py
import socketio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

# Khởi tạo Async Server cho FastAPI
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    print(f"[Socket.IO] Client connected: {sid}")

@sio.event
async def join_pos_rooms(sid, data):
    """
    Client gửi:
    - Thu ngân: { "role": "cashier" } -> vào room 'role_cashier'
    - Nhân viên: { "role": "staff" } -> vào room 'role_staff'
    - Bếp nóng: { "role": "kitchen", "station": "kitchen" } -> vào room 'station_kitchen'
    - Quầy Bar: { "role": "kitchen", "station": "bar" } -> vào room 'station_bar'
    - Khách hàng: { "role": "customer", "table_id": 1 } -> vào room 'role_customer' & 'table_1'
    """
    role = data.get("role")
    station = data.get("station")
    table_id = data.get("table_id")

    if role == "cashier":
        await sio.enter_room(sid, "role_cashier")
    elif role == "staff":
        await sio.enter_room(sid, "role_staff")
    elif role == "kitchen":
        if station == "bar":
            await sio.enter_room(sid, "station_bar")
        elif station == "kitchen":
            await sio.enter_room(sid, "station_kitchen")
        else:
            # Nếu chọn "Tất cả quầy" thì join cả 2
            await sio.enter_room(sid, "station_kitchen")
            await sio.enter_room(sid, "station_bar")
    elif role == "customer":
        await sio.enter_room(sid, "role_customer")
        if table_id:
            await sio.enter_room(sid, f"table_{table_id}")

    return {"status": "joined", "data": data}