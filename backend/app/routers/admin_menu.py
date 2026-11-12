from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.category import Category
from app.models.menu_item import Product
from app.schemas.admin_schema import CategoryCreate, CategoryUpdate, ProductCreate, ProductUpdate

router = APIRouter(prefix="/api/admin", tags=["Admin Menu & Categories"])

# ================= DANH MỤC (CATEGORIES) =================
@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.display_order.asc()).all()

@router.post("/categories")
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/categories/{category_id}")
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    if cat.products:
        raise HTTPException(status_code=400, detail="Không thể xóa danh mục đang có món ăn!")
    db.delete(cat)
    db.commit()
    return {"message": "Đã xóa danh mục"}

# ================= MÓN ĂN (PRODUCTS) =================
@router.get("/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    result = []
    for p in products:
        result.append({
            "id": p.id,
            "category_id": p.category_id,
            "category_name": p.category.name if p.category else "Chưa phân loại",
            "name": p.name,
            "description": p.description,
            "price": float(p.price),
            "image_url": p.image_url,
            "is_available": p.is_available
        })
    return result

@router.post("/products")
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == data.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Danh mục không tồn tại")
    prod = Product(**data.model_dump())
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

@router.put("/products/{product_id}")
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(prod, key, value)
    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")
    db.delete(prod)
    db.commit()
    return {"message": "Đã xóa món ăn"}
