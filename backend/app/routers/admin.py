from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.user import User
from app.models.table import DiningTable, TableSession
from app.models.category import Category
from app.models.menu_item import Product
from app.models.order import Order, OrderItem, OrderStatusHistory, Payment
router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])
from app.core.security import get_password_hash
from fastapi import HTTPException
from pydantic import BaseModel

@router.get("/dashboard-stats")
def get_dashboard_stats(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    today = datetime.now().date()

    try:
        dt_start = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else today
        dt_end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else dt_start
        if dt_end < dt_start:
            dt_start, dt_end = dt_end, dt_start
    except ValueError:
        dt_start = dt_end = today

    # 1. Doanh thu trong khoảng ngày đã chọn (CHỈ TÍNH ĐƠN ĐÃ THANH TOÁN - COMPLETED)
    period_revenue = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0))
        .filter(
            func.date(Order.created_at) >= dt_start,
            func.date(Order.created_at) <= dt_end,
            func.lower(Order.status) == "completed" # <-- SỬA Ở ĐÂY
        )
        .scalar()
    )

    # 2. Tổng đơn hàng trong khoảng ngày đã chọn
    period_orders = (
        db.query(func.count(Order.id))
        .filter(
            func.date(Order.created_at) >= dt_start,
            func.date(Order.created_at) <= dt_end
        )
        .scalar()
    )

    # 3. Số bàn đang phục vụ hiện tại (status != 'available')
    total_tables = db.query(func.count(DiningTable.id)).scalar() or 0
    occupied_tables = (
        db.query(func.count(DiningTable.id))
        .filter(func.lower(DiningTable.status) != "available")
        .scalar() or 0
    )

    # 4. Nhân sự đang hoạt động
    active_staff = (
        db.query(func.count(User.id))
        .filter(User.is_active == True)
        .scalar() or 0
    )

    # 5. Biểu đồ doanh thu từng ngày (CHỈ TÍNH ĐƠN COMPLETED)
    chart_start = dt_start if dt_start != dt_end else (dt_end - timedelta(days=6))
    chart_end = dt_end

    daily_revenue = []
    day_names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    curr = chart_start
    while curr <= chart_end:
        rev = (
            db.query(func.coalesce(func.sum(Order.total_amount), 0))
            .filter(
                func.date(Order.created_at) == curr, 
                func.lower(Order.status) == "completed" # <-- SỬA Ở ĐÂY
            )
            .scalar()
        )
        cnt = (
            db.query(func.count(Order.id))
            .filter(func.date(Order.created_at) == curr)
            .scalar()
        )
        daily_revenue.append({
            "day": f"{day_names[curr.weekday()]} {curr.strftime('%d/%m')}",
            "doanhThu": float(rev),
            "soDon": int(cnt)
        })
        curr += timedelta(days=1)

    # 6. Tỷ trọng doanh thu theo Danh mục (CHỈ TÍNH ĐƠN COMPLETED)
    cat_stats = (
        db.query(
            Category.name,
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label("total")
        )
        .join(Product, Product.category_id == Category.id)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            func.date(Order.created_at) >= dt_start,
            func.date(Order.created_at) <= dt_end,
            func.lower(Order.status) == "completed" # <-- SỬA Ở ĐÂY
        )
        .group_by(Category.id, Category.name)
        .all()
    )
    palette = ["#0d6efd", "#ffc107", "#198754", "#6610f2", "#fd7e14", "#20c997"]
    category_ratio = [
        {
            "name": row.name,
            "value": float(row.total),
            "color": palette[idx % len(palette)]
        }
        for idx, row in enumerate(cat_stats)
    ]

    # 7. Danh sách đơn hàng
    filtered_orders_raw = (
        db.query(Order, DiningTable.table_number)
        .outerjoin(TableSession, Order.session_id == TableSession.id)
        .outerjoin(DiningTable, TableSession.table_id == DiningTable.id)
        .filter(
            func.date(Order.created_at) >= dt_start,
            func.date(Order.created_at) <= dt_end
        )
        .order_by(Order.created_at.desc())
        .all()
    )
    
    # Hàm dịch trạng thái sang tiếng Việt
    def translate_status(status):
        status_map = {
            "pending": "Chờ duyệt",
            "confirmed": "Đã duyệt",
            "cooking": "Đang nấu",
            "ready": "Chờ bưng",
            "served": "Đã phục vụ",
            "completed": "Đã thanh toán",
            "cancelled": "Đã hủy"
        }
        return status_map.get(status.lower(), status)

    recent_orders = [
        {
            "id": o.id,
            "order_code": o.order_code,
            "table_id": table_num or "-",
            "total_amount": float(o.total_amount or 0),
            "status": translate_status(o.status), # <-- Dịch trạng thái
            "created_at": o.created_at.strftime("%H:%M %d/%m/%Y") if o.created_at else "-"
        }
        for o, table_num in filtered_orders_raw
    ]

    return {
        "range": {
            "start_date": dt_start.strftime("%Y-%m-%d"),
            "end_date": dt_end.strftime("%Y-%m-%d"),
        },
        "kpis": {
            "today_revenue": float(period_revenue),
            "today_orders": int(period_orders),
            "occupied_tables": int(occupied_tables),
            "total_tables": int(total_tables),
            "active_staff": int(active_staff),
        },
        "daily_revenue": daily_revenue,
        "category_ratio": category_ratio,
        "recent_orders": recent_orders,
    }

@router.get("/orders")
def get_order_history(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    today = datetime.now().date()
    try:
        dt_start = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else today
        dt_end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else dt_start
        if dt_end < dt_start:
            dt_start, dt_end = dt_end, dt_start
    except ValueError:
        dt_start = dt_end = today

    query = (
        db.query(Order, DiningTable.table_number)
        .outerjoin(TableSession, Order.session_id == TableSession.id)
        .outerjoin(DiningTable, TableSession.table_id == DiningTable.id)
        .filter(
            func.date(Order.created_at) >= dt_start,
            func.date(Order.created_at) <= dt_end
        )
    )

    if status and status.upper() != "ALL":
        query = query.filter(func.lower(Order.status) == status.lower())

    if search and search.strip():
        kw = f"%{search.strip()}%"
        query = query.filter(
            (Order.order_code.ilike(kw)) | (DiningTable.table_number.ilike(kw))
        )

    rows = query.order_by(Order.created_at.desc()).all()

    orders_list = []
    valid_revenue = 0.0
    cancelled_count = 0

    for o, table_num in rows:
        amt = float(o.total_amount or 0)
        st = (o.status or "pending").lower()
        if st == "cancelled":
            cancelled_count += 1
        else:
            valid_revenue += amt

        item_count = sum(item.quantity for item in o.items)
        orders_list.append({
            "id": o.id,
            "order_code": o.order_code,
            "table_number": table_num or "Mang về",
            "item_count": item_count,
            "total_amount": amt,
            "status": st,
            "note": o.note or "",
            "created_at": o.created_at.strftime("%H:%M %d/%m/%Y") if o.created_at else "-",
        })

    valid_orders = len(orders_list) - cancelled_count
    avg_order_value = (valid_revenue / valid_orders) if valid_orders > 0 else 0.0

    return {
        "summary": {
            "total_orders": len(orders_list),
            "valid_revenue": valid_revenue,
            "avg_order_value": avg_order_value,
            "cancelled_count": cancelled_count,
        },
        "orders": orders_list,
    }


@router.get("/orders/{order_id}")
def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(Order, DiningTable.table_number)
        .outerjoin(TableSession, Order.session_id == TableSession.id)
        .outerjoin(DiningTable, TableSession.table_id == DiningTable.id)
        .filter(Order.id == order_id)
        .first()
    )
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    order, table_num = row

    # Lấy thông tin thanh toán của phiên (nếu có)
    payment = (
        db.query(Payment)
        .filter(Payment.session_id == order.session_id)
        .order_by(Payment.id.desc())
        .first()
    )

    return {
        "id": order.id,
        "order_code": order.order_code,
        "table_number": table_num or "Mang về",
        "status": (order.status or "pending").lower(),
        "note": order.note or "",
        "total_amount": float(order.total_amount or 0),
        "created_at": order.created_at.strftime("%H:%M:%S %d/%m/%Y") if order.created_at else "-",
        "items": [
            {
                "id": it.id,
                "product_name": it.product_name,
                "quantity": it.quantity,
                "unit_price": float(it.unit_price or 0),
                "subtotal": float(it.unit_price or 0) * it.quantity,
                "item_note": it.item_note or "",
                "item_status": (it.item_status or "pending").lower(),
                "cancel_reason": it.cancel_reason or "",
            }
            for it in order.items
        ],
        "history": [
            {
                "id": h.id,
                "old_status": h.old_status or "-",
                "new_status": h.new_status,
                "changed_at": h.changed_at.strftime("%H:%M:%S %d/%m/%Y") if h.changed_at else "-",
            }
            for h in order.status_history
        ],
        "payment": {
            "method": payment.payment_method if payment else "Chưa ghi nhận",
            "status": payment.status if payment else "unpaid",
            "paid_at": payment.paid_at.strftime("%H:%M %d/%m/%Y") if (payment and payment.paid_at) else "-",
        },
    }

class StaffCreate(BaseModel):
    full_name: str
    username: str
    password: str
    phone: Optional[str] = None
    role: str = "staff"

class StaffUpdate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    role: str

class PasswordResetRequest(BaseModel):
    new_password: str

@router.get("/users")
def get_all_staff_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "username": u.username,
            "phone": u.phone,
            "role": (u.role or "staff").lower(),
            "is_active": bool(u.is_active),
        }
        for u in users
    ]


@router.post("/users")
def create_staff_user(req: StaffCreate, db: Session = Depends(get_db)):
    uname = req.username.strip()
    if not uname:
        raise HTTPException(status_code=400, detail="Tên đăng nhập không được để trống")

    exists = db.query(User).filter(User.username == uname).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"Tên đăng nhập '{uname}' đã tồn tại")

    new_user = User(
        full_name=req.full_name.strip(),
        username=uname,
        password_hash=get_password_hash(req.password.strip()),
        phone=req.phone.strip() if req.phone else None,
        role=req.role.lower(),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Tạo tài khoản nhân sự thành công", "id": new_user.id}


@router.patch("/users/{user_id}/toggle-active")
def toggle_staff_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    user.is_active = not bool(user.is_active)
    db.commit()
    return {"message": "Đã cập nhật trạng thái tài khoản", "is_active": user.is_active}

@router.put("/users/{user_id}")
def update_staff_user(user_id: int, req: StaffUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    user.full_name = req.full_name.strip()
    user.phone = req.phone.strip() if req.phone else None
    user.role = req.role.lower()
    db.commit()
    return {"message": "Cập nhật thông tin nhân sự thành công"}

@router.patch("/users/{user_id}/reset-password")
def reset_staff_password(user_id: int, req: PasswordResetRequest, db: Session = Depends(get_db)):
    if len(req.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 4 ký tự")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    # Lưu ý: Nếu model User của bạn dùng trường hashed_password thì thay password_hash bằng hashed_password
    user.password_hash = get_password_hash(req.new_password.strip())
    db.commit()
    return {"message": f"Đã đặt lại mật khẩu mới cho {user.username}"}