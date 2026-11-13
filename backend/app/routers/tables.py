import os
import uuid
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.core.database import get_db
from app.models.table import DiningTable, TableSession
from app.models.order import Order
from typing import List

router = APIRouter(prefix="/api/tables", tags=["Tables & QR Management"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QR_DIR = os.path.join(BASE_DIR, "static", "qrcodes")
os.makedirs(QR_DIR, exist_ok=True)

FRONTEND_ORDER_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def generate_qr_image(table_number: str, token: str) -> str:
    order_link = f"{FRONTEND_ORDER_URL}/order?token={token}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(order_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="white")

    safe_name = "".join(c if c.isalnum() else "_" for c in table_number)
    filename = f"qr_{safe_name}_{token[:8]}.png"
    filepath = os.path.join(QR_DIR, filename)
    img.save(filepath)
    return f"/static/qrcodes/{filename}"


class MergeTablesRequest(BaseModel):
    main_table_id: int
    target_table_id: int


class TableCreate(BaseModel):
    table_number: str
    capacity: int = 4
    status: str = "available"


class TableBulkCreate(BaseModel):
    prefix: str = "Bàn "
    start_num: int = 1
    end_num: int = 10
    capacity: int = 4


class TableUpdate(BaseModel):
    table_number: str
    capacity: int = 4
    status: str = "available"


@router.get("")
def get_all_tables(db: Session = Depends(get_db)):
    tables = db.query(DiningTable).order_by(DiningTable.id.asc()).all()
    result = []
    for t in tables:
        try:
            if not t.qr_image_url or not os.path.exists(os.path.join(BASE_DIR, t.qr_image_url.lstrip("/"))):
                t.qr_image_url = generate_qr_image(t.table_number, t.qr_code_token)
                db.commit()
        except Exception as e:
            print(f"Lỗi tạo QR cho {t.table_number}: {e}")

        active_session = (
            db.query(TableSession)
            .filter(TableSession.table_id == t.id, TableSession.status == "active")
            .first()
        )
        merged_into_table = None
        if active_session and getattr(active_session, "merged_into_session_id", None):
            parent_session = (
                db.query(TableSession)
                .filter(TableSession.id == active_session.merged_into_session_id)
                .first()
            )
            if parent_session and parent_session.table:
                merged_into_table = parent_session.table.table_number

        result.append({
            "id": t.id,
            "table_number": t.table_number,
            "capacity": t.capacity or 4,
            "qr_code_token": t.qr_code_token,
            "qr_image_url": t.qr_image_url or "",
            "order_url": f"{FRONTEND_ORDER_URL}/order?token={t.qr_code_token}",
            "status": (t.status or "available").lower(),
            "merged_into_table": merged_into_table,
            "created_at": t.created_at.strftime("%d/%m/%Y") if t.created_at else "-",
        })
    return result


@router.post("/merge")
def merge_tables(req: MergeTablesRequest, db: Session = Depends(get_db)):
    if req.main_table_id == req.target_table_id:
        raise HTTPException(status_code=400, detail="Không thể ghép một bàn với chính nó")

    main_table = db.query(DiningTable).filter(DiningTable.id == req.main_table_id).first()
    target_table = db.query(DiningTable).filter(DiningTable.id == req.target_table_id).first()
    if not main_table or not target_table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    main_session = (
        db.query(TableSession)
        .filter(TableSession.table_id == main_table.id, TableSession.status == "active")
        .first()
    )
    if not main_session:
        main_session = TableSession(
            table_id=main_table.id,
            session_token=uuid.uuid4().hex,
            status="active",
        )
        db.add(main_session)
        db.flush()
    main_table.status = "occupied"

    target_session = (
        db.query(TableSession)
        .filter(TableSession.table_id == target_table.id, TableSession.status == "active")
        .first()
    )
    if not target_session:
        target_session = TableSession(
            table_id=target_table.id,
            session_token=uuid.uuid4().hex,
            status="active",
            merged_into_session_id=main_session.id,
        )
        db.add(target_session)
        db.flush()
    else:
        db.query(Order).filter(Order.session_id == target_session.id).update(
            {"session_id": main_session.id}
        )
        target_session.merged_into_session_id = main_session.id

    target_table.status = "occupied"
    db.commit()

    return {
        "message": f"Đã ghép {target_table.table_number} vào bàn chính {main_table.table_number}",
        "main_session_id": main_session.id,
    }


@router.post("/{table_id}/unmerge")
def unmerge_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    session = (
        db.query(TableSession)
        .filter(
            TableSession.table_id == table.id,
            TableSession.status == "active",
            TableSession.merged_into_session_id.isnot(None),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=400, detail="Bàn này hiện không phải bàn phụ đang ghép")

    session.status = "closed"
    session.ended_at = func.now()
    session.merged_into_session_id = None
    table.status = "available"
    db.commit()

    return {"message": f"Đã tách {table.table_number} về trạng thái bàn trống"}


@router.post("")
def create_table(req: TableCreate, db: Session = Depends(get_db)):
    name = req.table_number.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên / số bàn không được để trống")

    exists = db.query(DiningTable).filter(DiningTable.table_number == name).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"'{name}' đã tồn tại trong hệ thống")

    token = uuid.uuid4().hex
    qr_url = generate_qr_image(name, token)

    new_table = DiningTable(
        table_number=name,
        capacity=req.capacity,
        qr_code_token=token,
        qr_image_url=qr_url,
        status=req.status.lower(),
    )
    db.add(new_table)
    db.commit()
    db.refresh(new_table)
    return new_table

@router.get("/qr/{token}")
def get_table_by_qr(token: str, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.qr_code_token == token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    return {
        "id": table.id,
        "name": table.table_number,
        "status": table.status
    }

@router.get("/qr/{token}")
def get_table_by_qr(token: str, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.qr_code_token == token).first()
    if not table:
        raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc bàn không tồn tại")
    return {
        "id": table.id,
        "name": table.table_number,
        "status": table.status
    }

@router.post("/bulk")
def create_bulk_tables(req: TableBulkCreate, db: Session = Depends(get_db)):
    if req.end_num < req.start_num or (req.end_num - req.start_num) > 50:
        raise HTTPException(status_code=400, detail="Khoảng số bàn không hợp lệ (tối đa 50 bàn/lần)")

    created_count = 0
    for num in range(req.start_num, req.end_num + 1):
        name = f"{req.prefix}{num:02d}" if num < 10 else f"{req.prefix}{num}"
        exists = db.query(DiningTable).filter(DiningTable.table_number == name).first()
        if exists:
            continue
        token = uuid.uuid4().hex
        qr_url = generate_qr_image(name, token)
        db.add(DiningTable(
            table_number=name,
            capacity=req.capacity,
            qr_code_token=token,
            qr_image_url=qr_url,
            status="available",
        ))
        created_count += 1

    db.commit()
    return {"message": f"Đã tạo mới {created_count} bàn kèm mã QR!"}


@router.put("/{table_id}")
def update_table(table_id: int, req: TableUpdate, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    name = req.table_number.strip()
    dup = db.query(DiningTable).filter(DiningTable.table_number == name, DiningTable.id != table_id).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"Tên '{name}' đã được sử dụng cho bàn khác")

    table.table_number = name
    table.capacity = req.capacity
    table.status = req.status.lower()
    db.commit()
    return {"message": "Cập nhật thông tin bàn thành công"}


@router.post("/{table_id}/regenerate-qr")
def regenerate_table_qr(table_id: int, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    if table.qr_image_url:
        old_path = os.path.join(BASE_DIR, table.qr_image_url.lstrip("/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    new_token = uuid.uuid4().hex
    table.qr_code_token = new_token
    table.qr_image_url = generate_qr_image(table.table_number, new_token)
    db.commit()
    return {"message": "Đã cấp lại mã QR mới", "qr_image_url": table.qr_image_url}


@router.delete("/{table_id}")
def delete_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    has_sessions = db.query(TableSession).filter(TableSession.table_id == table_id).count()
    if has_sessions > 0:
        raise HTTPException(status_code=400, detail="Không thể xóa bàn đã có lịch sử phiên phục vụ")

    if table.qr_image_url:
        old_path = os.path.join(BASE_DIR, table.qr_image_url.lstrip("/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    db.delete(table)
    db.commit()
    return {"message": "Đã xóa bàn"}

class DeleteQrRequest(BaseModel):
    table_ids: List[int]

# API Xóa QR của các bàn được chọn
@router.post("/qr/delete-bulk")
def delete_qr_bulk(req: DeleteQrRequest, db: Session = Depends(get_db)):
    tables = db.query(DiningTable).filter(DiningTable.id.in_(req.table_ids)).all()
    count = 0
    for table in tables:
        # Xóa file ảnh vật lý
        if table.qr_image_url:
            old_path = os.path.join(BASE_DIR, table.qr_image_url.lstrip("/"))
            if os.path.exists(old_path):
                try: os.remove(old_path)
                except OSError: pass
        
        # Xóa thông tin token và url trong Database
        table.qr_code_token = None
        table.qr_image_url = None
        count += 1
    db.commit()
    return {"message": f"Đã xóa mã QR của {count} bàn thành công"}

# API Xóa TOÀN BỘ QR
@router.post("/qr/delete-all")
def delete_qr_all(db: Session = Depends(get_db)):
    tables = db.query(DiningTable).all()
    count = 0
    for table in tables:
        if table.qr_image_url:
            old_path = os.path.join(BASE_DIR, table.qr_image_url.lstrip("/"))
            if os.path.exists(old_path):
                try: os.remove(old_path)
                except OSError: pass
        
        table.qr_code_token = None
        table.qr_image_url = None
        count += 1
    db.commit()
    return {"message": f"Đã xóa toàn bộ mã QR của {count} bàn"}

@router.put("/{table_id}/request-payment")
def request_payment(table_id: int, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    table.status = "payment_pending"
    db.commit()
    return {"message": "Đã gửi yêu cầu thanh toán"}