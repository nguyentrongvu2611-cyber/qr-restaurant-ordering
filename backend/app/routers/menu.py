import os
import uuid
import shutil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.category import Category
from app.models.menu_item import Product

router = APIRouter(prefix="/api/menu", tags=["Menu Management"])

class CategoryPayload(BaseModel):
    name: str
    description: Optional[str] = ""
    target_station: str = "KITCHEN"
    display_order: int = 0
    is_active: bool = True

class ProductPayload(BaseModel):
    name: str
    price: float
    category_id: int
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    is_available: bool = True

# --- API DANH MỤC ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload-image")
async def upload_product_image(file: UploadFile = File(...)):
    allowed_ext = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng ảnh (.jpg, .png, .webp)")

    # Đặt tên file theo tên gốc sạch + mã ngẫu nhiên ngắn để dễ quản lý trong thư mục backend
    clean_name = "".join(c if c.isalnum() else "_" for c in os.path.splitext(file.filename)[0])[:30]
    unique_name = f"{clean_name}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Trả về đường dẫn tương đối để lưu vào MySQL
    return {"image_url": f"/static/uploads/{unique_name}"}

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.display_order.asc(), Category.id.asc()).all()
    result = []
    for c in categories:
        count = db.query(Product).filter(Product.category_id == c.id).count()
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description or "",
            "target_station": c.station or "KITCHEN",
            "display_order": c.display_order or 0,
            "is_active": bool(c.is_active),
            "product_count": count
        })
    return result

@router.post("/categories")
def create_category(req: CategoryPayload, db: Session = Depends(get_db)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Tên danh mục không được để trống")
    new_cat = Category(
        name=req.name.strip(),
        description=req.description,
        station=req.target_station,
        display_order=req.display_order,
        is_active=req.is_active
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.put("/categories/{cat_id}")
def update_category(cat_id: int, req: CategoryPayload, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    cat.name = req.name.strip()
    cat.description = req.description
    cat.station = req.target_station
    cat.display_order = req.display_order
    cat.is_active = req.is_active
    db.commit()
    return {"message": "Cập nhật danh mục thành công"}

@router.delete("/categories/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    has_products = db.query(Product).filter(Product.category_id == cat_id).count()
    if has_products > 0:
        raise HTTPException(status_code=400, detail="Không thể xóa danh mục đang có món ăn bên trong")
    db.delete(cat)
    db.commit()
    return {"message": "Đã xóa danh mục"}

# --- API MÓN ĂN & ĐỒ UỐNG ---
@router.get("/products")
def get_products(category_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Product)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    products = query.order_by(Product.id.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "price": float(p.price or 0),
            "category_id": p.category_id,
            "category_name": p.category.name if p.category else "",
            "station": p.category.station if p.category else "KITCHEN",
            "description": p.description or "",
            "image_url": p.image_url or "",
            "is_available": bool(p.is_available),
        }
        for p in products
    ]

@router.post("/products")
def create_product(req: ProductPayload, db: Session = Depends(get_db)):
    new_prod = Product(
        name=req.name.strip(),
        price=req.price,
        category_id=req.category_id,
        description=req.description,
        image_url=req.image_url,
        is_available=req.is_available
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)
    return new_prod

@router.put("/products/{prod_id}")
def update_product(prod_id: int, req: ProductPayload, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Không tìm thấy món")
    prod.name = req.name.strip()
    prod.price = req.price
    prod.category_id = req.category_id
    prod.description = req.description
    prod.image_url = req.image_url
    prod.is_available = req.is_available
    db.commit()
    return {"message": "Cập nhật món thành công"}

@router.patch("/products/{prod_id}/toggle")
def toggle_product_availability(prod_id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Không tìm thấy món")
    prod.is_available = not prod.is_available
    db.commit()
    return {"id": prod.id, "is_available": bool(prod.is_available)}

@router.delete("/products/{prod_id}")
def delete_product(prod_id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Không tìm thấy món")
    db.delete(prod)
    db.commit()
    return {"message": "Đã xóa món"}