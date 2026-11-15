from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin
)
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication & Users"])

# --- Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str  # ADMIN, CASHIER, STAFF, KITCHEN, BAR

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    phone: Optional[str]
    role: str
    is_active: bool

    class Config:
        from_attributes = True

# --- API Đăng nhập (Dùng chung cho mọi Role) ---
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai tên đăng nhập hoặc mật khẩu"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa. Vui lòng liên hệ Admin."
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        }
    }

# --- API Admin lấy danh sách toàn bộ nhân viên ---
@router.get("/users", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).order_by(User.id.desc()).all()

# --- API Admin tạo tài khoản mới & phân Role ---
@router.post("/users", response_model=UserResponse)
def create_user(req: CreateUserRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    allowed_roles = ["ADMIN", "CASHIER", "STAFF", "KITCHEN", "BAR"]
    if req.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Role không hợp lệ")

    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")

    new_user = User(
        username=req.username,
        password_hash=get_password_hash(req.password),
        full_name=req.full_name,
        phone=req.phone,
        role=req.role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# --- API Admin khóa / mở khóa tài khoản ---
@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản của chính mình")

    user.is_active = not user.is_active
    db.commit()
    return {"message": "Cập nhật trạng thái thành công", "is_active": user.is_active}