from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.order import Order, Payment # <-- Import Payment từ order.py
from app.models.table import DiningTable, TableSession

router = APIRouter(prefix="/api/payments", tags=["Payments"])

class CheckoutPayload(BaseModel):
    table_id: int
    amount: float
    method: str # CASH hoặc TRANSFER

@router.post("/checkout")
def process_checkout(req: CheckoutPayload, db: Session = Depends(get_db)):
    # 1. Tìm session đang mở của bàn
    session = db.query(TableSession).filter(
        TableSession.table_id == req.table_id, 
        TableSession.status == "active"
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="Bàn này không có khách!")

    # 2. Đánh dấu tất cả order của session này thành 'completed'
    orders = db.query(Order).filter(Order.session_id == session.id).all()
    for o in orders:
        o.status = "completed"
    
    # 3. Tạo bản ghi Payment (Cập nhật theo đúng các cột của model Payment cũ)
    new_payment = Payment(
        session_id=session.id,  # Model của bạn dùng session_id, không phải order_id
        amount=req.amount,
        payment_method=req.method.lower(), # Model dùng payment_method
        status="paid"
    )
    db.add(new_payment)

    # 4. Đóng session, Reset bàn về trạng thái available
    session.status = "closed"
    table = db.query(DiningTable).filter(DiningTable.id == req.table_id).first()
    if table:
        table.status = "available"

    db.commit()
    return {"status": "success", "message": "Thanh toán thành công"}