from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.order import Order, OrderItem
from app.models.table import TableSession
from app.socket_instance import sio  # <-- Import từ file mới

# Đã thêm /api để khớp với Frontend
router = APIRouter(prefix="/api/kitchen", tags=["Kitchen"])

# 1. API: Đánh dấu món đã nấu xong
@router.put("/items/{item_id}/done")
def mark_item_done(item_id: int, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")
    
    item.item_status = "ready"
    db.commit()

    # Kiểm tra xem tất cả các món trong đơn đã xong chưa
    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        all_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        if all(i.item_status in ["ready", "cancelled"] for i in all_items):
            order.status = "ready"
            db.commit()

    return {"message": "Đã đánh dấu món hoàn thành"}

# 2. API: Bếp báo hết món (Gửi Socket.IO cho nhân viên)
@router.put("/items/{item_id}/out-of-stock")
async def report_out_of_stock(item_id: int, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")
    
    item.item_status = "cancelled"
    item.cancel_reason = "Bếp báo hết món"
    db.commit()

    # Lấy thông tin Bàn thông qua Session (Vì Order không có table_id trực tiếp)
    order = db.query(Order).filter(Order.id == item.order_id).first()
    table_name = "Bàn không xác định"
    
    if order and order.session_id:
        session = db.query(TableSession).filter(TableSession.id == order.session_id).first()
        if session and session.table:
            table_name = session.table.table_number

    # Bắn thông báo Real-time
    await sio.emit('item_out_of_stock', {
        "item_id": item.id,
        "table_name": table_name,
        "item_name": item.product_name,
        "message": f"Bếp vừa báo hết món {item.product_name}. Vui lòng ra bàn đổi/hủy món cho khách."
    })
    
    return {"status": "success", "message": "Đã báo hết món và gửi thông báo"}