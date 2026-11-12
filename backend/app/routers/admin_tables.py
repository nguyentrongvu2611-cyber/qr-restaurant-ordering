import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_admin
from app.models.table import DiningTable
from app.schemas.admin_schema import TableCreate, TableUpdate

router = APIRouter(
    prefix="/api/admin/tables",
    tags=["Admin Tables & QR"],
    dependencies=[Depends(require_admin)]
)

@router.get("")
def get_tables(db: Session = Depends(get_db)):
    return db.query(DiningTable).order_by(DiningTable.id.asc()).all()

@router.post("")
def create_table(data: TableCreate, db: Session = Depends(get_db)):
    if db.query(DiningTable).filter(DiningTable.table_number == data.table_number).first():
        raise HTTPException(status_code=400, detail="Số bàn này đã tồn tại!")
    
    token = f"TBL-{uuid.uuid4().hex[:10].upper()}"
    # Sinh link QR gọi món trỏ về Frontend (cổng 5173)
    qr_order_url = f"http://localhost:5173/order?token={token}"
    qr_img_api = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={qr_order_url}"

    new_table = DiningTable(
        table_number=data.table_number,
        capacity=data.capacity,
        qr_code_token=token,
        qr_image_url=qr_img_api,
        status="available"
    )
    db.add(new_table)
    db.commit()
    db.refresh(new_table)
    return new_table

@router.put("/{table_id}")
def update_table(table_id: int, data: TableUpdate, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(table, key, value)
    db.commit()
    db.refresh(table)
    return table

@router.post("/{table_id}/regenerate-qr")
def regenerate_qr(table_id: int, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    token = f"TBL-{uuid.uuid4().hex[:10].upper()}"
    qr_order_url = f"http://localhost:5173/order?token={token}"
    table.qr_code_token = token
    table.qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={qr_order_url}"
    db.commit()
    db.refresh(table)
    return table

@router.delete("/{table_id}")
def delete_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(DiningTable).filter(DiningTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    if table.sessions:
        raise HTTPException(status_code=400, detail="Không thể xóa bàn đã có lịch sử phiên ngồi!")
    db.delete(table)
    db.commit()
    return {"message": "Đã xóa bàn"}
