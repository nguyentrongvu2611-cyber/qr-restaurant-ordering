from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models.menu_item import Product 
from fastapi import Body
# Nhớ import thêm Category nếu cần

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.get("")
def get_all_products(db: Session = Depends(get_db)):
    # Dùng joinedload để lấy kèm dữ liệu bảng Category
    products = db.query(Product).options(joinedload(Product.category)).all()
    
    result = []
    for p in products:
        result.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.price) if p.price else 0,
            "is_available": p.is_available,
            "image_url": p.image_url,
            # ĐÂY LÀ ĐIỂM MẤU CHỐT: Lấy tên danh mục
            "category_name": p.category.name if p.category else "Chưa phân loại"
        })
    return result