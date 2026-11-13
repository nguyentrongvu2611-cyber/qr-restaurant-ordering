from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import Session
from app.core.database import Base, get_db, engine

router = APIRouter(prefix="/api/payment-qr", tags=["Payment QR Config"])


class PaymentQRConfig(Base):
    __tablename__ = "payment_qr_configs"

    id = Column(Integer, primary_key=True, index=True)
    # Tài khoản & QR Chính (Admin quản lý)
    primary_bank_id = Column(String(50), default="MB")
    primary_account_no = Column(String(50), default="")
    primary_account_name = Column(String(120), default="")
    primary_custom_qr_url = Column(String(255), nullable=True)

    # Tài khoản & QR Phụ dự phòng (Admin + Thu ngân có quyền sửa)
    backup_bank_id = Column(String(50), default="VCB")
    backup_account_no = Column(String(50), default="")
    backup_account_name = Column(String(120), default="")
    backup_custom_qr_url = Column(String(255), nullable=True)

    # Kênh đang kích hoạt thanh toán: 'PRIMARY' | 'BACKUP'
    active_mode = Column(String(20), default="PRIMARY")
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


Base.metadata.create_all(bind=engine)


def get_or_init_config(db: Session) -> PaymentQRConfig:
    cfg = db.query(PaymentQRConfig).first()
    if not cfg:
        cfg = PaymentQRConfig(active_mode="PRIMARY")
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def build_vietqr_url(bank_id: str, acc_no: str, acc_name: str, amount: int = 0, add_info: str = "") -> str:
    if not bank_id or not acc_no:
        return ""
    base = f"https://img.vietqr.io/image/{bank_id.strip()}-{acc_no.strip()}-compact2.png"
    params = []
    if amount > 0:
        params.append(f"amount={int(amount)}")
    if add_info:
        params.append(f"addInfo={quote(add_info)}")
    if acc_name:
        params.append(f"accountName={quote(acc_name.strip())}")
    return f"{base}?{'&'.join(params)}" if params else base


class AdminFullQRUpdate(BaseModel):
    primary_bank_id: str
    primary_account_no: str
    primary_account_name: str
    primary_custom_qr_url: Optional[str] = None
    backup_bank_id: str
    backup_account_no: str
    backup_account_name: str
    backup_custom_qr_url: Optional[str] = None
    active_mode: str = "PRIMARY"


class CashierBackupQRUpdate(BaseModel):
    backup_bank_id: str
    backup_account_no: str
    backup_account_name: str
    backup_custom_qr_url: Optional[str] = None
    active_mode: str = "BACKUP"
    updated_by: Optional[str] = "Thu ngân"


class SwitchModeRequest(BaseModel):
    active_mode: str  # 'PRIMARY' hoặc 'BACKUP'
    updated_by: Optional[str] = "Thu ngân"


@router.get("")
def get_payment_qr_config(db: Session = Depends(get_db)):
    cfg = get_or_init_config(db)
    return {
        "primary_bank_id": cfg.primary_bank_id or "MB",
        "primary_account_no": cfg.primary_account_no or "",
        "primary_account_name": cfg.primary_account_name or "",
        "primary_custom_qr_url": cfg.primary_custom_qr_url or "",
        "primary_preview_url": cfg.primary_custom_qr_url or build_vietqr_url(
            cfg.primary_bank_id, cfg.primary_account_no, cfg.primary_account_name
        ),
        "backup_bank_id": cfg.backup_bank_id or "VCB",
        "backup_account_no": cfg.backup_account_no or "",
        "backup_account_name": cfg.backup_account_name or "",
        "backup_custom_qr_url": cfg.backup_custom_qr_url or "",
        "backup_preview_url": cfg.backup_custom_qr_url or build_vietqr_url(
            cfg.backup_bank_id, cfg.backup_account_no, cfg.backup_account_name
        ),
        "active_mode": cfg.active_mode or "PRIMARY",
        "updated_by": cfg.updated_by or "Admin",
    }


@router.get("/checkout-qr")
def get_checkout_qr_for_bill(amount: int = 0, order_code: str = "", db: Session = Depends(get_db)):
    """API xuất đúng mã QR đang kích hoạt (Chính hoặc Phụ) kèm số tiền & nội dung chuyển khoản."""
    cfg = get_or_init_config(db)
    is_backup = cfg.active_mode == "BACKUP"

    if is_backup:
        qr_url = cfg.backup_custom_qr_url or build_vietqr_url(
            cfg.backup_bank_id, cfg.backup_account_no, cfg.backup_account_name, amount, f"TT {order_code}"
        )
        return {
            "mode": "BACKUP",
            "label": "Mã QR Dự Phòng (Phụ)",
            "bank_id": cfg.backup_bank_id,
            "account_no": cfg.backup_account_no,
            "account_name": cfg.backup_account_name,
            "qr_url": qr_url,
        }

    qr_url = cfg.primary_custom_qr_url or build_vietqr_url(
        cfg.primary_bank_id, cfg.primary_account_no, cfg.primary_account_name, amount, f"TT {order_code}"
    )
    return {
        "mode": "PRIMARY",
        "label": "Mã QR Chính",
        "bank_id": cfg.primary_bank_id,
        "account_no": cfg.primary_account_no,
        "account_name": cfg.primary_account_name,
        "qr_url": qr_url,
    }


@router.put("/admin")
def update_full_qr_by_admin(req: AdminFullQRUpdate, db: Session = Depends(get_db)):
    cfg = get_or_init_config(db)
    cfg.primary_bank_id = req.primary_bank_id.upper().strip()
    cfg.primary_account_no = req.primary_account_no.strip()
    cfg.primary_account_name = req.primary_account_name.upper().strip()
    cfg.primary_custom_qr_url = req.primary_custom_qr_url or None

    cfg.backup_bank_id = req.backup_bank_id.upper().strip()
    cfg.backup_account_no = req.backup_account_no.strip()
    cfg.backup_account_name = req.backup_account_name.upper().strip()
    cfg.backup_custom_qr_url = req.backup_custom_qr_url or None

    cfg.active_mode = req.active_mode if req.active_mode in ("PRIMARY", "BACKUP") else "PRIMARY"
    cfg.updated_by = "Admin"
    db.commit()
    return {"message": "Đã lưu cấu hình QR Thanh Toán (Chính & Phụ)"}


@router.put("/cashier-backup")
def update_backup_qr_by_cashier(req: CashierBackupQRUpdate, db: Session = Depends(get_db)):
    """Thu ngân chỉnh sửa QR Phụ và chuyển kênh thanh toán."""
    cfg = get_or_init_config(db)
    cfg.backup_bank_id = req.backup_bank_id.upper().strip()
    cfg.backup_account_no = req.backup_account_no.strip()
    cfg.backup_account_name = req.backup_account_name.upper().strip()
    cfg.backup_custom_qr_url = req.backup_custom_qr_url or None
    cfg.active_mode = req.active_mode if req.active_mode in ("PRIMARY", "BACKUP") else "BACKUP"
    cfg.updated_by = req.updated_by
    db.commit()
    return {"message": "Đã cập nhật QR Dự Phòng & chuyển kênh thanh toán"}


@router.patch("/switch-mode")
def switch_active_qr_mode(req: SwitchModeRequest, db: Session = Depends(get_db)):
    """Chuyển đổi nhanh 1 chạm giữa QR Chính <-> QR Phụ."""
    if req.active_mode not in ("PRIMARY", "BACKUP"):
        raise HTTPException(status_code=400, detail="Chế độ phải là PRIMARY hoặc BACKUP")
    cfg = get_or_init_config(db)
    cfg.active_mode = req.active_mode
    cfg.updated_by = req.updated_by
    db.commit()
    return {"message": f"Đã chuyển sang {req.active_mode}", "active_mode": cfg.active_mode}