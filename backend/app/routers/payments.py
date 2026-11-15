import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.order import Order, Payment
from app.models.table import DiningTable, TableSession
from app.models.service_request import ServiceRequest

router = APIRouter(prefix="/api/payments", tags=["Payments"])

class CheckoutPayload(BaseModel):
    table_id: int
    amount: float
    method: str  # CASH hoặc TRANSFER

def _clear_live_alert_for_table(table_id: int):
    for p in [
        "/var/www/smartpos/backend/app/routers/live_alerts_v2.json",
        "/var/www/smartpos/backend/app/routers/pos_live_alerts.json",
        "/var/www/smartpos/backend/active_service_calls.json",
    ]:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    items = json.load(f)
                if isinstance(items, list):
                    filtered = [x for x in items if int(x.get("table_id", -1)) != int(table_id)]
                    with open(p, "w", encoding="utf-8") as f:
                        json.dump(filtered, f, ensure_ascii=False)
            except Exception:
                pass

@router.post("/checkout")
def process_checkout(req: CheckoutPayload, db: Session = Depends(get_db)):
    table = (
        db.query(DiningTable)
        .filter(DiningTable.id == req.table_id)
        .with_for_update()
        .first()
    )
    if not table:
        raise HTTPException(status_code=404, detail="Bàn không tồn tại!")

    session = (
        db.query(TableSession)
        .filter(
            TableSession.table_id == req.table_id,
            TableSession.status == "active"
        )
        .with_for_update()
        .first()
    )
    if not session:
        raise HTTPException(status_code=400, detail="Bàn này không có khách hoặc đã được thanh toán!")

    existing_payment = db.query(Payment).filter(
        Payment.session_id == session.id,
        Payment.status == "paid"
    ).first()
    if existing_payment:
        raise HTTPException(status_code=409, detail="Hóa đơn của phiên bàn này đã được thanh toán trước đó!")

    orders = db.query(Order).filter(Order.session_id == session.id).all()
    for o in orders:
        o.status = "completed"

    db.query(ServiceRequest).filter(
        ServiceRequest.session_id == session.id,
        ServiceRequest.status == "pending"
    ).update({"status": "resolved"}, synchronize_session=False)

    new_payment = Payment(
        session_id=session.id,
        amount=req.amount,
        payment_method=req.method.lower(),
        status="paid"
    )
    db.add(new_payment)

    session.status = "closed"
    table.status = "available"

    db.commit()
    _clear_live_alert_for_table(req.table_id)
    return {"status": "success", "message": "Thanh toán thành công"}
