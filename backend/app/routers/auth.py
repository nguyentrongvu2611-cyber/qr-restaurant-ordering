import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, SECRET_KEY
from app.models.user import User
from app.schemas.admin_schema import UserLogin

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login")
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or user.password_hash != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Sai tên đăng nhập hoặc mật khẩu!")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa!")

    expire = datetime.now(timezone.utc) + timedelta(hours=12)
    token = jwt.encode(
        {"sub": str(user.id), "username": user.username, "role": user.role, "exp": expire},
        SECRET_KEY,
        algorithm="HS256"
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        }
    }
