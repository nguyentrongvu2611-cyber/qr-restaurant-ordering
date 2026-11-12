from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_admin, hash_password
from app.models.user import User
from app.schemas.admin_schema import UserRegister

router = APIRouter(
    prefix="/api/admin/users",
    tags=["Admin User Management"],
    dependencies=[Depends(require_admin)]  # Chặn cứng: Toàn bộ API trong file này chỉ Admin gọi được
)

@router.get("")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "phone": u.phone,
            "role": u.role,
            "is_active": u.is_active
        }
        for u in users
    ]

@router.post("", status_code=status.HTTP_201_CREATED)
def create_staff_account(data: UserRegister, db: Session = Depends(get_db)):
    if data.role not in ["admin", "staff", "kitchen"]:
        raise HTTPException(status_code=400, detail="Vai trò chỉ được chọn: admin, staff hoặc kitchen")

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại!")

    new_user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=data.role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": f"Đã tạo tài khoản {new_user.role} thành công!", "id": new_user.id}

@router.patch("/{user_id}/toggle-active")
def toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Không thể khóa tài khoản Admin gốc!")
    user.is_active = not user.is_active
    db.commit()
    return {"message": "Đã cập nhật trạng thái tài khoản", "is_active": user.is_active}
