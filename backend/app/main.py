from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, SessionLocal
from app.core.security import hash_password
from app.models import Base, User
from app.routers import auth, admin_menu, admin_users, admin_tables

Base.metadata.create_all(bind=engine)

def init_default_admin():
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                password_hash=hash_password("admin123"),
                full_name="Quản trị viên Hệ thống",
                role="admin",
                is_active=True
            ))
            db.commit()
    finally:
        db.close()

init_default_admin()

app = FastAPI(title="API Quản Lý Quán Ăn QR")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_menu.router)
app.include_router(admin_users.router)
app.include_router(admin_tables.router)

@app.get("/")
def read_root():
    return {"status": "OK", "message": "Hệ thống API Quán ăn QR đang hoạt động!"}
