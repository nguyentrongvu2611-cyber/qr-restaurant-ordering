from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import require_staff
from app.models.user import User
from app.models.table import DiningTable, TableSession
from app.models.order import Order, OrderItem, OrderStatusHistory, ServiceRequest, Payment
from app.models.shift import CashierShift

router = APIRouter(
    prefix="/api/staff",
    tags=["Staff & Cashier Operations"],
    dependencies=[Depends(require_staff)]
)

# --- SCHEMAS ---
class OpenShiftReq(BaseModel):
    opening_cash: Decimal

class CloseShiftReq(BaseModel):
    actual_cash: Decimal
    note: Optional[str] = None

class RejectOrderReq(BaseModel):
    reason: str

class CancelItemReq(BaseModel):
    reason: str

class TransferTableReq(BaseModel):
    from_session_id: int
    to_table_id: int

class MergeTableReq(BaseModel):
    source_session_id: int
    target_session_id: int

class CheckoutReq(BaseModel):
    payment_method: str  # cash, bank_transfer_qr

# ================= 1. QUẢN LÝ CA LÀM VIỆC (MỞ CA / CHỐT CA) =================
@router.get("/shift/current")
def get_current_shift(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    shift = db.query(CashierShift).filter(
        CashierShift.staff_id == current_user.id,
        CashierShift.status == "open"
    ).first()
    if not shift:
        return {"has_open_shift": False}

    cash_sales = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.confirmed_by == current_user.id,
        Payment.payment_method == "cash",
        Payment.status == "paid",
        Payment.paid_at >= shift.opened_at
    ).scalar()

    return {
        "has_open_shift": True,
        "shift": {
            "id": shift.id,
            "opening_cash": float(shift.opening_cash),
            "cash_sales": float(cash_sales),
            "expected_cash": float(shift.opening_cash) + float(cash_sales),
            "opened_at": shift.opened_at
        }
    }

@router.post("/shift/open")
def open_shift(data: OpenShiftReq, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    existing = db.query(CashierShift).filter(
        CashierShift.staff_id == current_user.id,
        CashierShift.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bạn đang có một ca làm việc chưa chốt!")

    shift = CashierShift(
        staff_id=current_user.id,
        opening_cash=data.opening_cash,
        expected_cash=data.opening_cash,
        status="open"
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return {"message": "Mở ca làm việc thành công!", "shift_id": shift.id}

@router.post("/shift/close")
def close_shift(data: CloseShiftReq, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    shift = db.query(CashierShift).filter(
        CashierShift.staff_id == current_user.id,
        CashierShift.status == "open"
    ).first()
    if not shift:
        raise HTTPException(status_code=400, detail="Không tìm thấy ca đang mở!")

    cash_sales = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.confirmed_by == current_user.id,
        Payment.payment_method == "cash",
        Payment.status == "paid",
        Payment.paid_at >= shift.opened_at
    ).scalar()

    expected = Decimal(shift.opening_cash) + Decimal(cash_sales)
    diff = Decimal(data.actual_cash) - expected

    shift.expected_cash = expected
    shift.actual_cash = data.actual_cash
    shift.difference = diff
    shift.note = data.note
    shift.status = "closed"
    shift.closed_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "message": "Đã chốt ca làm việc!",
        "expected_cash": float(expected),
        "actual_cash": float(data.actual_cash),
        "difference": float(diff)
    }

# ================= 2. DASHBOARD, SƠ ĐỒ BÀN & YÊU CẦU KHẨN CẤP =================
@router.get("/overview")
def get_staff_overview(db: Session = Depends(get_db)):
    tables = db.query(DiningTable).order_by(DiningTable.id.asc()).all()
    table_list = []
    for t in tables:
        active_session = db.query(TableSession).filter(
            TableSession.table_id == t.id,
            TableSession.status == "active"
        ).first()
        session_total = 0
        has_request_payment = False
        if active_session:
            valid_orders = db.query(Order).filter(
                Order.session_id == active_session.id,
                Order.status != "cancelled"
            ).all()
            session_total = sum(float(o.total_amount) for o in valid_orders)
            req_pay = db.query(ServiceRequest).filter(
                ServiceRequest.session_id == active_session.id,
                ServiceRequest.request_type == "request_bill",
                ServiceRequest.status == "pending"
            ).first()
            has_request_payment = bool(req_pay)

        table_list.append({
            "id": t.id,
            "table_number": t.table_number,
            "capacity": t.capacity,
            "status": t.status,
            "active_session_id": active_session.id if active_session else None,
            "session_total": session_total,
            "has_request_payment": has_request_payment
        })

    # Lấy các yêu cầu khẩn cấp chưa xử lý (STF09)
    pending_requests = db.query(ServiceRequest).filter(ServiceRequest.status == "pending").order_by(ServiceRequest.created_at.asc()).all()
    req_list = []
    for r in pending_requests:
        table_num = r.session.table.table_number if (r.session and r.session.table) else "N/A"
        req_list.append({
            "id": r.id,
            "session_id": r.session_id,
            "table_number": table_num,
            "request_type": r.request_type,
            "note": r.note,
            "created_at": r.created_at
        })

    # Lấy các đơn hàng đang hoạt động (Pending -> Ready)
    active_orders = db.query(Order).filter(
        Order.status.in_(["pending", "confirmed", "cooking", "ready"])
    ).order_by(Order.created_at.asc()).all()
    order_list = []
    for o in active_orders:
        table_num = o.session.table.table_number if (o.session and o.session.table) else "N/A"
        order_list.append({
            "id": o.id,
            "order_code": o.order_code,
            "session_id": o.session_id,
            "table_number": table_num,
            "note": o.note,
            "total_amount": float(o.total_amount),
            "status": o.status,
            "created_at": o.created_at,
            "items": [
                {
                    "id": i.id,
                    "product_name": i.product_name,
                    "quantity": i.quantity,
                    "unit_price": float(i.unit_price),
                    "item_note": i.item_note,
                    "item_status": i.item_status
                }
                for i in o.items
            ]
        })

    return {
        "tables": table_list,
        "service_requests": req_list,
        "orders": order_list
    }

# ================= 3. XỬ LÝ ĐƠN HÀNG (DUYỆT / TỪ CHỐI / ĐÃ PHỤC VỤ / HỦY MÓN) =================
@router.post("/orders/{order_id}/confirm")
def confirm_order(order_id: int, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.status != "pending":
        raise HTTPException(status_code=400, detail="Đơn hàng không ở trạng thái chờ duyệt!")

    old = order.status
    order.status = "confirmed"
    order.user_id = current_user.id
    db.add(OrderStatusHistory(
        order_id=order.id,
        changed_by=current_user.id,
        old_status=old,
        new_status="confirmed (Nhân viên duyệt đẩy xuống Bếp)"
    ))
    db.commit()
    return {"message": f"Đã duyệt đơn {order.order_code} đẩy xuống Bếp!"}

@router.post("/orders/{order_id}/reject")
def reject_order(order_id: int, data: RejectOrderReq, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    if not data.reason.strip():
        raise HTTPException(status_code=400, detail="Bắt buộc nhập lý do từ chối đơn!")
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    old = order.status
    order.status = "cancelled"
    order.user_id = current_user.id
    for item in order.items:
        item.item_status = "cancelled"

    db.add(OrderStatusHistory(
        order_id=order.id,
        changed_by=current_user.id,
        old_status=old,
        new_status=f"cancelled - Lý do: {data.reason}"
    ))
    db.commit()
    return {"message": "Đã từ chối đơn và lưu lý do!"}

@router.post("/orders/{order_id}/serve")
def mark_order_served(order_id: int, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    old = order.status
    order.status = "served"
    for item in order.items:
        if item.item_status != "cancelled":
            item.item_status = "done"

    db.add(OrderStatusHistory(
        order_id=order.id,
        changed_by=current_user.id,
        old_status=old,
        new_status="served (Đã bưng ra bàn)"
    ))
    db.commit()
    return {"message": "Đã cập nhật trạng thái Đã phục vụ!"}

@router.post("/order-items/{item_id}/cancel")
def cancel_order_item(item_id: int, data: CancelItemReq, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    if not data.reason.strip():
        raise HTTPException(status_code=400, detail="Bắt buộc phải nhập lý do hủy món!")
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item or item.item_status == "cancelled":
        raise HTTPException(status_code=400, detail="Món không tồn tại hoặc đã hủy trước đó")

    item.item_status = "cancelled"
    order = item.order
    # Tính lại tổng tiền đơn sau khi trừ món hủy
    new_total = sum(Decimal(i.unit_price) * i.quantity for i in order.items if i.item_status != "cancelled")
    order.total_amount = new_total
    if new_total == 0:
        order.status = "cancelled"

    # Ghi Audit Log vào order_status_history
    db.add(OrderStatusHistory(
        order_id=order.id,
        changed_by=current_user.id,
        old_status="item_active",
        new_status=f"Hủy món [{item.product_name} x{item.quantity}] - Lý do: {data.reason}"
    ))
    db.commit()
    return {"message": f"Đã hủy món {item.product_name} và ghi nhận Audit Log!"}

# ================= 4. XỬ LÝ YÊU CẦU KHẨN CẤP, CHUYỂN BÀN & GỘP BÀN =================
@router.post("/service-requests/{req_id}/resolve")
def resolve_service_request(req_id: int, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    req = db.query(ServiceRequest).filter(ServiceRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    req.status = "resolved"
    req.handled_by = current_user.id
    db.commit()
    return {"message": "Đã xử lý yêu cầu của khách!"}

@router.post("/tables/transfer")
def transfer_table(data: TransferTableReq, db: Session = Depends(get_db)):
    session = db.query(TableSession).filter(TableSession.id == data.from_session_id, TableSession.status == "active").first()
    target_table = db.query(DiningTable).filter(DiningTable.id == data.to_table_id).first()
    if not session or not target_table:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên hoặc bàn đích")
    if target_table.status != "available":
        raise HTTPException(status_code=400, detail="Bàn đích đang có khách, hãy dùng chức năng Gộp bàn!")

    old_table = session.table
    old_table.status = "available"
    target_table.status = "occupied"
    session.table_id = target_table.id
    db.commit()
    return {"message": f"Đã chuyển từ {old_table.table_number} sang {target_table.table_number}!"}

@router.post("/tables/merge")
def merge_tables(data: MergeTableReq, db: Session = Depends(get_db)):
    if data.source_session_id == data.target_session_id:
        raise HTTPException(status_code=400, detail="Không thể gộp cùng một bàn!")
    src_session = db.query(TableSession).filter(TableSession.id == data.source_session_id, TableSession.status == "active").first()
    tgt_session = db.query(TableSession).filter(TableSession.id == data.target_session_id, TableSession.status == "active").first()
    if not src_session or not tgt_session:
        raise HTTPException(status_code=404, detail="Một trong hai bàn không có phiên hoạt động")

    # Chuyển toàn bộ đơn hàng và yêu cầu sang bàn đích
    db.query(Order).filter(Order.session_id == src_session.id).update({"session_id": tgt_session.id})
    db.query(ServiceRequest).filter(ServiceRequest.session_id == src_session.id).update({"session_id": tgt_session.id})

    src_table = src_session.table
    src_session.status = "closed"
    src_session.ended_at = datetime.now(timezone.utc)
    src_table.status = "available"
    db.commit()
    return {"message": f"Đã gộp toàn bộ món từ {src_table.table_number} sang {tgt_session.table.table_number}!"}

# ================= 5. HÓA ĐƠN CHI TIẾT, THANH TOÁN & RESET BÀN =================
@router.get("/sessions/{session_id}/bill")
def get_session_bill(session_id: int, db: Session = Depends(get_db)):
    session = db.query(TableSession).filter(TableSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên bàn")
    orders = db.query(Order).filter(Order.session_id == session_id, Order.status != "cancelled").all()
    items = []
    total = Decimal(0)
    for o in orders:
        for i in o.items:
            if i.item_status != "cancelled":
                line_total = Decimal(i.unit_price) * i.quantity
                total += line_total
                items.append({
                    "order_code": o.order_code,
                    "product_name": i.product_name,
                    "quantity": i.quantity,
                    "unit_price": float(i.unit_price),
                    "line_total": float(line_total)
                })
    return {
        "session_id": session.id,
        "table_number": session.table.table_number,
        "started_at": session.started_at,
        "items": items,
        "total_amount": float(total)
    }

@router.post("/sessions/{session_id}/checkout")
def checkout_session(session_id: int, data: CheckoutReq, current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    session = db.query(TableSession).filter(TableSession.id == session_id, TableSession.status == "active").first()
    if not session:
        raise HTTPException(status_code=400, detail="Phiên bàn không tồn tại hoặc đã thanh toán!")

    orders = db.query(Order).filter(Order.session_id == session_id, Order.status != "cancelled").all()
    total_amount = sum(Decimal(o.total_amount) for o in orders)

    # Tạo bản ghi thanh toán
    payment = Payment(
        session_id=session.id,
        confirmed_by=current_user.id,
        amount=total_amount,
        payment_method=data.payment_method,
        status="paid",
        paid_at=datetime.now(timezone.utc)
    )
    db.add(payment)

    # Đóng tất cả yêu cầu chờ của phiên này
    db.query(ServiceRequest).filter(
        ServiceRequest.session_id == session.id,
        ServiceRequest.status == "pending"
    ).update({"status": "resolved", "handled_by": current_user.id})

    # Đóng phiên & Reset bàn về Trống (Available)
    session.status = "closed"
    session.ended_at = datetime.now(timezone.utc)
    table = session.table
    table.status = "available"

    db.commit()
    return {
        "message": f"Thanh toán thành công {float(total_amount):,.0f}đ! {table.table_number} đã sẵn sàng đón khách mới.",
        "total_amount": float(total_amount)
    }

@router.get("/history")
def get_staff_history(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    payments = db.query(Payment).filter(Payment.confirmed_by == current_user.id).order_by(Payment.paid_at.desc()).limit(30).all()
    return [
        {
            "id": p.id,
            "table_number": p.session.table.table_number if (p.session and p.session.table) else "N/A",
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "paid_at": p.paid_at
        }
        for p in payments
    ]
