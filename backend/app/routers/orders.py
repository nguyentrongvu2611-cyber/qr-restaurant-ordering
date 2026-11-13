from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.models.order import Order, OrderItem
from app.models.service_request import ServiceRequest
from app.models.menu_item import Product
from app.models.table import DiningTable, TableSession 

router = APIRouter(tags=["Orders & Service Requests"])

# ==========================================
# SCHEMAS
# ==========================================
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    note: Optional[str] = None

class OrderCreate(BaseModel):
    table_id: int
    customer_note: Optional[str] = None
    items: List[OrderItemCreate]

# ==========================================
# 1. API TẠO ĐƠN HÀNG MỚI (Dành cho Khách hàng)
# ==========================================
@router.post("/api/orders")
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    # 1. Kiểm tra bàn có tồn tại không
    table = db.query(DiningTable).filter(DiningTable.id == order_in.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Bàn không tồn tại")

    # 2. Tìm phiên (session) đang active của bàn này
    session = db.query(TableSession).filter(
        TableSession.table_id == table.id, 
        TableSession.status == "active"
    ).first()

    if not session:
        session = TableSession(
            table_id=table.id,
            session_token=uuid.uuid4().hex,
            status="active"
        )
        db.add(session)
        db.flush()
        table.status = "occupied"

    # 3. Tạo Đơn hàng mới
    new_order = Order(
        order_code=f"ORD-{uuid.uuid4().hex[:6].upper()}", 
        session_id=session.id,
        status="pending",
        total_amount=0,
        note=order_in.customer_note 
    )
    db.add(new_order)
    db.flush() 

    total_amount = 0

    # 4. Duyệt qua từng món khách gọi
    for item in order_in.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Món ăn ID {item.product_id} không tồn tại")
            
        if not product.is_available:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Món {product.name} đã tạm hết hàng")

        item_total = product.price * item.quantity
        total_amount += item_total

        new_item = OrderItem(
            order_id=new_order.id,
            product_id=product.id,
            product_name=product.name,
            unit_price=product.price,
            quantity=item.quantity,
            item_note=item.note,
            item_status="pending"
        )
        db.add(new_item)

    # 5. Cập nhật tổng tiền và lưu
    new_order.total_amount = total_amount
    db.commit()
    db.refresh(new_order)

    return {
        "message": "Đặt món thành công",
        "order_id": new_order.id,
        "total_amount": float(total_amount)
    }

@router.put("/api/orders/{order_id}/confirm")
def confirm_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    
    # Chuyển trạng thái đơn
    order.status = "confirmed"
    
    # (Tùy chọn) Đổi trạng thái bàn thành occupied nếu chưa
    if order.session and order.session.table:
        order.session.table.status = "occupied"
        
    db.commit()
    return {"message": "Đã xác nhận đơn hàng thành công"}

# ==========================================
# 2. API DÀNH CHO BẾP / THU NGÂN LẤY DANH SÁCH ĐƠN
# ==========================================
@router.get("/api/orders")
def get_all_orders(db: Session = Depends(get_db)):
    try:
        # Dùng joinedload để lấy kèm thông tin Bàn và Danh sách Món
        orders = db.query(Order).options(
            joinedload(Order.session).joinedload(TableSession.table),
            joinedload(Order.items)
        ).order_by(Order.id.desc()).all()

        result = []
        for o in orders:
            # Lấy đúng tên bàn thông qua session
            table_name = o.session.table.table_number if o.session and o.session.table else "Không xác định"
            
            result.append({
                "id": o.id,
                "order_code": o.order_code,
                "table_id": o.session.table_id if o.session else None,
                "table_name": table_name,
                "status": o.status,
                "total_amount": float(o.total_amount) if o.total_amount else 0,
                # Trả về chi tiết các món cho Bếp
                "items": [
                {
                    "id": item.id,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "note": item.item_note,
                    "item_status": item.item_status,
                    "unit_price": float(item.unit_price or 0) # <-- THÊM DÒNG NÀY ĐỂ FIX LỖI 0Đ
                } for item in o.items
            ]
            })
        return result
    except Exception as e:
        print(f"Lỗi lấy danh sách orders: {e}")
        return []

# ==========================================
# 3. API LẤY LỊCH SỬ ĐẶT MÓN CỦA KHÁCH
# ==========================================
@router.get("/api/orders/table/{table_id}/active")
def get_active_order_by_table(table_id: int, db: Session = Depends(get_db)):
    # Tìm session đang mở của bàn
    session = db.query(TableSession).filter(
        TableSession.table_id == table_id, 
        TableSession.status == "active"
    ).first()

    if not session:
        return {"items": [], "total_amount": 0, "session_id": None}

    # Lấy tất cả đơn hàng trong session này kèm theo món
    orders = db.query(Order).options(joinedload(Order.items)).filter(Order.session_id == session.id).all()
    
    all_items = []
    total = 0
    for o in orders:
        for item in o.items:
            all_items.append({
                "id": item.id,
                "name": item.product_name,
                "qty": item.quantity,
                "price": float(item.unit_price),
                "status": item.item_status,
                "note": item.item_note
            })
            total += float(item.unit_price) * item.quantity
    
    return {"items": all_items, "total_amount": total, "session_id": session.id}

# ==========================================
# 4. API LẤY YÊU CẦU DỊCH VỤ
# ==========================================
@router.get("/api/service-requests")
def get_service_requests(db: Session = Depends(get_db)):
    try:
        requests = db.query(ServiceRequest).filter(ServiceRequest.status == "pending").all()
        return [
            {
                "id": r.id,
                "table_id": r.table_id,
                "table_name": f"Bàn #{r.table_id}",
                "request_type": getattr(r, "request_type", getattr(r, "type", "staff")), 
                "status": r.status,
            }
            for r in requests
        ]
    except Exception as e:
        print(f"Lỗi lấy danh sách service requests: {e}")
        return []