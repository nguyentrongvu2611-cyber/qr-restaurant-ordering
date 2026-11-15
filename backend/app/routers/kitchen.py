import json
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Body, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from passlib.context import CryptContext

from app.core.database import get_db
from app.models.order import Order, OrderItem
from app.models.table import TableSession
from app.models.user import User

# Import an toàn Product / MenuItem
try:
    from app.models.menu_item import Product
except ImportError:
    from app.models.menu_item import MenuItem as Product

# Import an toàn Socket.IO
try:
    from app.socket_instance import sio
except ImportError:
    sio = None

router = APIRouter(prefix="/api/kitchen", tags=["Kitchen"])
pwd_context_staff = CryptContext(schemes=["bcrypt"], deprecated="auto")

# =====================================================================
# CẤU HÌNH FILE LƯU TRỮ TRẠNG THÁI (MÓN ẨN & CẢNH BÁO GỌI NHÂN VIÊN)
# =====================================================================
BASE_DIR = os.path.dirname(__file__)
HIDDEN_PRODUCTS_FILE = os.path.join(BASE_DIR, "hidden_menu_products.json")
SERVICE_CALLS_FILE = os.path.join(BASE_DIR, "live_alerts_v2.json")

CURRENT_SHIFT_STATE = {
    "is_open": True,
    "shift_code": f"CA-{datetime.now().strftime('%d%m-%H%M')}",
    "opened_at": datetime.now().strftime("%H:%M:%S %d/%m/%Y"),
    "opened_by": "Thu ngân",
    "starting_cash": 500000.0,
    "note": ""
}


def load_hidden_product_ids() -> list[int]:
    for path in [HIDDEN_PRODUCTS_FILE, "hidden_menu_products.json"]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return [int(x) for x in json.load(f)]
            except Exception:
                pass
    return []


def save_hidden_product_ids(ids_list: list[int]):
    clean_ids = sorted(list(set(int(x) for x in ids_list)))
    for path in [HIDDEN_PRODUCTS_FILE, "hidden_menu_products.json"]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(clean_ids, f)
        except Exception:
            pass


def load_service_calls() -> list[dict]:
    for path in [SERVICE_CALLS_FILE, "active_service_calls.json", "pos_live_alerts.json"]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return data
            except Exception:
                pass
    return []


def save_service_calls(calls_list: list[dict]):
    for path in [SERVICE_CALLS_FILE, "active_service_calls.json", "pos_live_alerts.json"]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(calls_list, f, ensure_ascii=False)
        except Exception:
            pass


# =====================================================================
# PHẦN 1: ĐIỀU PHỐI MÓN ĂN TẠI BẾP, QUẦY BAR & TRẠM TIẾP THỰC (PASS)
# =====================================================================

@router.put("/orders/{order_id}/confirm")
async def confirm_order_full(order_id: int, db: Session = Depends(get_db)):
    """Duyệt đơn hàng (chuyển cả Order và OrderItem sang 'confirmed')"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    order.status = "confirmed"
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    for it in items:
        cur_st = str(getattr(it, "item_status", getattr(it, "status", "pending"))).lower()
        if cur_st in ["pending", "waiting", ""]:
            if hasattr(it, "item_status"):
                it.item_status = "confirmed"
            if hasattr(it, "status"):
                it.status = "confirmed"

    db.commit()
    return {"status": "success", "order_id": order.id, "new_status": "confirmed"}


@router.put("/orders/{order_id}/preparing")
async def start_preparing_order_full(order_id: int, db: Session = Depends(get_db)):
    """Bếp bấm 'Bắt đầu làm' (chuyển cả đơn và món sang 'preparing')"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    order.status = "preparing"
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    for it in items:
        cur_st = str(getattr(it, "item_status", getattr(it, "status", "confirmed"))).lower()
        if cur_st in ["pending", "confirmed", "waiting"]:
            if hasattr(it, "item_status"):
                it.item_status = "preparing"
            if hasattr(it, "status"):
                it.status = "preparing"

    db.commit()
    return {"status": "success", "order_id": order.id, "new_status": "preparing"}


@router.put("/items/{item_id}/done")
async def mark_item_done(item_id: int, db: Session = Depends(get_db)):
    """Đánh dấu 1 món đã nấu xong (chuyển sang Trạm Tiếp Thực - 'ready')"""
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")

    if hasattr(item, "item_status"):
        item.item_status = "ready"
    if hasattr(item, "status"):
        item.status = "ready"
    db.commit()

    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        all_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        if all(
            getattr(i, "item_status", getattr(i, "status", "")) in ["ready", "served", "cancelled", "out_of_stock"]
            for i in all_items
        ):
            order.status = "ready"
            db.commit()

    if sio:
        try:
            await sio.emit("item:ready", {
                "item_id": item.id,
                "order_id": item.order_id,
                "product_name": getattr(item, "product_name", "Món ăn"),
                "quantity": getattr(item, "quantity", 1)
            })
        except Exception:
            pass

    return {"message": "Đã đánh dấu món hoàn thành"}


@router.put("/items/{item_id}/served")
async def mark_item_served(item_id: int, db: Session = Depends(get_db)):
    """Trạm Tiếp Thực / Nhân viên xác nhận món đã bưng lên bàn ('served')"""
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")

    if hasattr(item, "item_status"):
        item.item_status = "served"
    if hasattr(item, "status"):
        item.status = "served"
    db.commit()

    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        all_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        if all(
            getattr(i, "item_status", getattr(i, "status", "")) in ["served", "cancelled", "out_of_stock"]
            for i in all_items
        ):
            order.status = "served"
            db.commit()

    if sio:
        try:
            await sio.emit("item:served", {"item_id": item.id, "order_id": item.order_id})
        except Exception:
            pass

    return {"message": "Đã giao món lên bàn thành công"}


@router.put("/batch-ready")
async def mark_batch_items_ready(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Chốt mẻ món (gom nhiều đơn cùng món đẩy ra PASS cùng lúc)"""
    item_ids = payload.get("item_ids", [])
    if not item_ids:
        raise HTTPException(status_code=400, detail="Danh sách món trống")

    items = db.query(OrderItem).filter(OrderItem.id.in_(item_ids)).all()
    affected_order_ids = set()

    for item in items:
        if hasattr(item, "item_status"):
            item.item_status = "ready"
        if hasattr(item, "status"):
            item.status = "ready"
        affected_order_ids.add(item.order_id)

    db.commit()

    for oid in affected_order_ids:
        order = db.query(Order).filter(Order.id == oid).first()
        if order:
            all_items = db.query(OrderItem).filter(OrderItem.order_id == oid).all()
            if all(
                getattr(i, "item_status", getattr(i, "status", "")) in ["ready", "served", "cancelled", "out_of_stock"]
                for i in all_items
            ):
                order.status = "ready"
    db.commit()

    return {"status": "success", "updated_count": len(items)}


@router.put("/batch-served")
async def mark_batch_items_served(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Giao ngay 1 chạm (dùng cho luồng nước đóng chai Fast-Track & Tiếp thực)"""
    item_ids = payload.get("item_ids", [])
    if not item_ids:
        raise HTTPException(status_code=400, detail="Danh sách món trống")

    items = db.query(OrderItem).filter(OrderItem.id.in_(item_ids)).all()
    affected_order_ids = set()

    for item in items:
        if hasattr(item, "item_status"):
            item.item_status = "served"
        if hasattr(item, "status"):
            item.status = "served"
        affected_order_ids.add(item.order_id)

    db.commit()

    for oid in affected_order_ids:
        order = db.query(Order).filter(Order.id == oid).first()
        if order:
            all_items = db.query(OrderItem).filter(OrderItem.order_id == oid).all()
            if all(
                getattr(i, "item_status", getattr(i, "status", "")) in ["served", "cancelled", "out_of_stock"]
                for i in all_items
            ):
                order.status = "served"
    db.commit()

    return {"status": "success", "served_count": len(items)}


@router.put("/batch-undo")
@router.put("/batch-unserve")
async def undo_served_items_in_db(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Hoàn tác lượt giao món (khôi phục trạng thái về 'confirmed' trong Database)"""
    item_ids = payload.get("item_ids", [])
    if not item_ids:
        return {"status": "empty", "restored_count": 0}

    items = db.query(OrderItem).filter(OrderItem.id.in_(item_ids)).all()
    affected_order_ids = set()

    for item in items:
        if hasattr(item, "item_status"):
            item.item_status = "confirmed"
        if hasattr(item, "status"):
            item.status = "confirmed"
        affected_order_ids.add(item.order_id)

    for oid in affected_order_ids:
        order = db.query(Order).filter(Order.id == oid).first()
        if order and str(order.status).lower() in ["served", "ready", "completed"]:
            order.status = "confirmed"

    db.commit()
    return {"status": "success", "restored_count": len(items)}


# =====================================================================
# PHẦN 2: QUẢN LÝ BÁO HẾT MÓN, KHÔI PHỤC MÓN & ẨN/HIỆN THỰC ĐƠN (SOFT DELETE)
# =====================================================================

@router.put("/out-of-stock")
async def kitchen_report_out_of_stock(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Bếp hoặc Thu ngân báo hết món trọn gói (Khóa trên Menu + Đánh dấu dòng món 'out_of_stock')"""
    product_id = payload.get("product_id")
    product_name = payload.get("product_name")
    order_item_id = payload.get("order_item_id")
    order_id = payload.get("order_id")

    order_item = None
    if order_item_id:
        order_item = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()

    real_product_id = None
    if order_item:
        real_product_id = getattr(order_item, "product_id", None) or getattr(order_item, "menu_item_id", None)
        if not product_name:
            product_name = getattr(order_item, "product_name", None)

    product = None
    if real_product_id:
        product = db.query(Product).filter(Product.id == real_product_id).first()
    if not product and product_name:
        product = db.query(Product).filter(Product.name == product_name).first()
    if not product and product_id and not order_item:
        product = db.query(Product).filter(Product.id == product_id).first()

    if product:
        product.is_available = False

    if product_name:
        for tbl in ["menu_items", "products"]:
            try:
                db.execute(text(f"UPDATE {tbl} SET is_available = 0 WHERE name = :name"), {"name": product_name})
            except Exception:
                pass

    table_name = "Bàn khách"
    if order_item:
        if hasattr(order_item, "item_status"):
            order_item.item_status = "out_of_stock"
        if hasattr(order_item, "status"):
            order_item.status = "out_of_stock"

        parent_order = db.query(Order).filter(Order.id == order_item.order_id).first()
        if parent_order and getattr(parent_order, "session_id", None):
            session = db.query(TableSession).filter(TableSession.id == parent_order.session_id).first()
            if session and getattr(session, "table", None):
                table_name = session.table.table_number

    db.commit()

    return {
        "status": "success",
        "product_id": product.id if product else real_product_id,
        "product_name": product.name if product else product_name,
        "order_item_id": order_item_id,
        "order_id": order_id,
        "table_name": table_name
    }


@router.put("/items/{item_id}/out-of-stock")
async def report_out_of_stock_legacy(item_id: int, db: Session = Depends(get_db)):
    return await kitchen_report_out_of_stock({"order_item_id": item_id}, db)


@router.put("/restore-stock")
def restore_product_stock_availability(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Mở bán lại món đang tạm hết (is_available = True)"""
    product_id = payload.get("product_id")
    product_name = payload.get("product_name")

    product = None
    if product_id:
        product = db.query(Product).filter(Product.id == product_id).first()
    if not product and product_name:
        product = db.query(Product).filter(Product.name == product_name).first()

    if product:
        product.is_available = True

    if product_name:
        for tbl in ["menu_items", "products"]:
            try:
                db.execute(text(f"UPDATE {tbl} SET is_available = 1 WHERE name = :name"), {"name": product_name})
            except Exception:
                pass

    db.commit()
    return {"status": "success", "product_id": product_id, "product_name": product_name}


@router.get("/hidden-products")
def get_hidden_products():
    """Lấy danh sách ID các món đang nằm trong thùng rác (đã ẩn khỏi Menu)"""
    return {"hidden_ids": load_hidden_product_ids()}


@router.put("/hide-product/{product_id}")
@router.delete("/menu-product/{product_id}")
def soft_hide_product_from_menu(product_id: int):
    """Đưa món vào danh sách ẩn trên Server (Không xóa khỏi MySQL để tránh lỗi khóa ngoại và có thể khôi phục)"""
    hidden_ids = load_hidden_product_ids()
    if int(product_id) not in hidden_ids:
        hidden_ids.append(int(product_id))
        save_hidden_product_ids(hidden_ids)

    return {"status": "success", "hidden_product_id": product_id, "hidden_ids": hidden_ids}


@router.put("/unhide-product/{product_id}")
def restore_hidden_product_to_menu(product_id: int):
    """Khôi phục 1 món đã xóa quay trở lại Thực đơn"""
    hidden_ids = [pid for pid in load_hidden_product_ids() if int(pid) != int(product_id)]
    save_hidden_product_ids(hidden_ids)
    return {"status": "success", "restored_product_id": product_id, "hidden_ids": hidden_ids}


@router.put("/unhide-all-products")
def restore_all_hidden_products():
    """Khôi phục tất cả các món trong thùng rác về lại Thực đơn"""
    save_hidden_product_ids([])
    return {"status": "success", "hidden_ids": []}


# =====================================================================
# PHẦN 3: NGHIỆP VỤ NHÂN VIÊN & THU NGÂN (THÊM MÓN, ĐỔI MÓN, SỬA SL, HỦY MÓN, ĐÓNG BÀN)
# =====================================================================

@router.post("/cashier-create-order")
def cashier_create_merged_order(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Thu ngân (hoặc Nhân viên) gửi giỏ món nháp thành 1 phiếu duy nhất xuống Bếp/Bar"""
    table_id = payload.get("table_id")
    items_data = payload.get("items", [])

    if not table_id or not items_data:
        raise HTTPException(status_code=400, detail="Thiếu thông tin bàn hoặc danh sách món trống")

    try:
        try:
            db.execute(text("UPDATE tables SET status = 'occupied' WHERE id = :tid"), {"tid": table_id})
        except Exception:
            pass

        active_session = (
            db.query(TableSession)
            .filter(TableSession.table_id == table_id, TableSession.status != "closed")
            .first()
        )
        if not active_session:
            active_session = TableSession(table_id=table_id, status="active")
            if hasattr(active_session, "session_code"):
                active_session.session_code = f"SES-{uuid.uuid4().hex[:4].upper()}"
            if hasattr(active_session, "created_at"):
                active_session.created_at = datetime.now()
            db.add(active_session)
            db.flush()

        batch_total = sum(
            float(it.get("price", 0) or it.get("unit_price", 0)) * int(it.get("quantity", 1))
            for it in items_data
        )

        new_order = Order(table_id=table_id, status="confirmed")
        if hasattr(new_order, "session_id") and active_session:
            new_order.session_id = active_session.id
        if hasattr(new_order, "order_code"):
            new_order.order_code = f"ORD-{uuid.uuid4().hex[:6].upper()}"
        if hasattr(new_order, "total_amount"):
            new_order.total_amount = batch_total
        if hasattr(new_order, "created_at"):
            new_order.created_at = datetime.now()

        db.add(new_order)
        db.flush()

        for it in items_data:
            prod_id = it.get("product_id")
            qty = int(it.get("quantity", 1))
            price = float(it.get("price", 0) or it.get("unit_price", 0))
            note = it.get("note", "")

            order_item = OrderItem(order_id=new_order.id, product_id=prod_id, quantity=qty)
            if hasattr(order_item, "unit_price"):
                order_item.unit_price = price
            if hasattr(order_item, "price"):
                order_item.price = price
            if hasattr(order_item, "note"):
                order_item.note = note
            if hasattr(order_item, "item_status"):
                order_item.item_status = "confirmed"
            if hasattr(order_item, "status"):
                order_item.status = "confirmed"

            db.add(order_item)

        db.commit()
        db.refresh(new_order)

        return {
            "status": "success",
            "id": new_order.id,
            "order_id": new_order.id,
            "order_code": getattr(new_order, "order_code", f"ORD-{new_order.id}"),
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi tạo phiếu gửi bếp: {str(e)}")


@router.post("/orders/{order_id}/add-item")
def staff_add_item_to_existing_order(order_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Nhân viên thêm món mới vào đơn hiện tại của khách"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    prod_id = payload.get("product_id")
    qty = int(payload.get("quantity", 1) or 1)
    note = payload.get("note", "")

    product = db.query(Product).filter(Product.id == prod_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")

    price = float(getattr(product, "price", 0) or 0)

    existing_item = (
        db.query(OrderItem)
        .filter(OrderItem.order_id == order_id, OrderItem.product_id == prod_id)
        .first()
    )
    if existing_item and str(getattr(existing_item, "item_status", "pending")).lower() in ["pending", "confirmed"]:
        existing_item.quantity = int(existing_item.quantity or 1) + qty
    else:
        order_st = str(getattr(order, "status", "pending")).lower()
        item_st = "confirmed" if order_st in ["confirmed", "cooking", "preparing"] else "pending"

        new_item = OrderItem(order_id=order_id, product_id=prod_id, quantity=qty)
        if hasattr(new_item, "unit_price"):
            new_item.unit_price = price
        if hasattr(new_item, "price"):
            new_item.price = price
        if hasattr(new_item, "note"):
            new_item.note = note
        if hasattr(new_item, "item_status"):
            new_item.item_status = item_st
        if hasattr(new_item, "status"):
            new_item.status = item_st
        db.add(new_item)

    db.flush()

    all_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    new_total = 0.0
    for it in all_items:
        st = str(getattr(it, "item_status", getattr(it, "status", ""))).lower()
        if st not in ["cancelled", "out_of_stock"]:
            u_price = float(getattr(it, "unit_price", getattr(it, "price", 0)) or 0)
            new_total += u_price * int(it.quantity or 1)

    if hasattr(order, "total_amount"):
        order.total_amount = new_total

    db.commit()
    return {"status": "success", "order_id": order_id, "new_total": new_total}


@router.put("/items/{item_id}/swap")
def staff_swap_out_of_stock_item(item_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Nhân viên đổi sang món mới cho khách"""
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món cần đổi")

    new_product_id = payload.get("new_product_id")
    new_product = db.query(Product).filter(Product.id == new_product_id).first()
    if not new_product:
        raise HTTPException(status_code=404, detail="Không tìm thấy món mới")

    old_price = float(getattr(item, "unit_price", 0) or getattr(item, "price", 0))
    qty = int(getattr(item, "quantity", 1) or 1)
    new_price = float(new_product.price or 0)

    if hasattr(item, "product_id"):
        item.product_id = new_product.id
    if hasattr(item, "menu_item_id"):
        item.menu_item_id = new_product.id
    if hasattr(item, "product_name"):
        item.product_name = new_product.name
    if hasattr(item, "unit_price"):
        item.unit_price = new_price
    if hasattr(item, "price"):
        item.price = new_price
    if hasattr(item, "item_status"):
        item.item_status = "confirmed"
    if hasattr(item, "status"):
        item.status = "confirmed"

    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order and hasattr(order, "total_amount"):
        order.total_amount = max(0, float(order.total_amount or 0) - (old_price * qty) + (new_price * qty))
        if order.status in ["cancelled", "ready"]:
            order.status = "confirmed"

    db.commit()
    return {"status": "success", "new_product_name": new_product.name, "new_price": new_price}


@router.put("/items/{item_id}/cancel")
async def cashier_cancel_order_item(item_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    """Xóa / Hủy 1 dòng món khỏi đơn hàng và trừ lại tổng tiền"""
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món cần xóa")

    reason = payload.get("reason", "Thu ngân xóa món")
    unit_price = float(getattr(item, "unit_price", 0) or getattr(item, "price", 0))
    qty = int(getattr(item, "quantity", 1) or 1)
    deducted = unit_price * qty

    if hasattr(item, "item_status"):
        item.item_status = "cancelled"
    if hasattr(item, "status"):
        item.status = "cancelled"
    if hasattr(item, "cancel_reason"):
        item.cancel_reason = reason

    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        if hasattr(order, "total_amount"):
            order.total_amount = max(0, float(order.total_amount or 0) - deducted)

        all_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        if all(
            getattr(i, "item_status", getattr(i, "status", "")) in ["cancelled", "out_of_stock"]
            for i in all_items
        ):
            order.status = "cancelled"

    db.commit()
    return {"status": "success", "item_id": item_id, "deducted_amount": deducted, "reason": reason}


@router.put("/items/{item_id}/quantity")
async def cashier_update_item_quantity(item_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Tăng / giảm số lượng món (+/-) trên đơn hàng"""
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món")

    new_qty = int(payload.get("quantity", 1))
    if new_qty <= 0:
        return await cashier_cancel_order_item(item_id, {"reason": "Giảm số lượng về 0"}, db)

    old_qty = int(getattr(item, "quantity", 1) or 1)
    unit_price = float(getattr(item, "unit_price", 0) or getattr(item, "price", 0))
    diff_amount = (new_qty - old_qty) * unit_price

    item.quantity = new_qty

    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order and hasattr(order, "total_amount"):
        order.total_amount = max(0, float(order.total_amount or 0) + diff_amount)

    db.commit()
    return {"status": "success", "item_id": item_id, "quantity": new_qty}


@router.put("/tables/{table_id}/notify-kitchen")
async def cashier_notify_table_to_kitchen(table_id: int, db: Session = Depends(get_db)):
    """Thu ngân bấm Thông báo (F10) duyệt tất cả đơn đang chờ của bàn xuống Bếp"""
    sessions = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status != "closed"
    ).all()
    session_ids = [s.id for s in sessions]

    orders = []
    if session_ids:
        orders = db.query(Order).filter(Order.session_id.in_(session_ids)).all()
    if not orders and hasattr(Order, "table_id"):
        orders = db.query(Order).filter(Order.table_id == table_id).all()

    count = 0
    for o in orders:
        if str(o.status).lower() == "pending":
            o.status = "confirmed"
            count += 1
        items = db.query(OrderItem).filter(OrderItem.order_id == o.id).all()
        for it in items:
            cur_st = str(getattr(it, "item_status", getattr(it, "status", "pending"))).lower()
            if cur_st in ["pending", "waiting", ""]:
                if hasattr(it, "item_status"):
                    it.item_status = "confirmed"
                if hasattr(it, "status"):
                    it.status = "confirmed"

    db.commit()
    return {"status": "success", "confirmed_orders": count}


@router.post("/tables/{table_id}/cancel-table")
def cashier_cancel_table_session(table_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Thu ngân xóa / đóng bàn khi khách đổi ý"""
    reason = payload.get("reason", "Khách đổi ý")

    for tbl_name in ["dining_tables", "tables"]:
        try:
            db.execute(text(f"UPDATE {tbl_name} SET status = 'available' WHERE id = :tid"), {"tid": table_id})
        except Exception:
            pass

    active_sessions = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status != "closed"
    ).all()

    for sess in active_sessions:
        sess.status = "closed"
        orders = db.query(Order).filter(Order.session_id == sess.id).all()
        for o in orders:
            if o.status not in ["completed", "paid"]:
                o.status = "cancelled"

    try:
        db.execute(
            text("UPDATE orders SET status = 'cancelled' WHERE table_id = :tid AND status NOT IN ('completed', 'paid')"),
            {"tid": table_id}
        )
    except Exception:
        pass

    # Xóa luôn các cảnh báo hỗ trợ của bàn này (nếu có)
    calls = [c for c in load_service_calls() if int(c.get("table_id", 0)) != int(table_id)]
    save_service_calls(calls)

    db.commit()
    return {"status": "success", "table_id": table_id, "reason": reason}


# =====================================================================
# PHẦN 4: HỆ THỐNG CẢNH BÁO GỌI NHÂN VIÊN / THANH TOÁN (ĐỒNG BỘ MỌI ROUTE)
# =====================================================================

def _process_create_service_call(table_id_raw, payload: dict, db: Session):
    try:
        table_id = int(str(table_id_raw).replace("Bàn", "").strip())
    except Exception:
        table_id = 1

    call_type = payload.get("type", "CALL_STAFF")
    payment_method = payload.get("payment_method", "NONE")
    note = payload.get("note", "Gọi nhân viên hỗ trợ")
    table_name = payload.get("table_name") or f"Bàn {str(table_id).zfill(2)}"

    new_table_status = "payment_pending" if call_type == "CALL_PAYMENT" else "calling_staff"
    for tbl_name in ["tables", "dining_tables"]:
        try:
            db.execute(
                text(f"UPDATE {tbl_name} SET status = :st WHERE id = :tid"),
                {"st": new_table_status, "tid": table_id}
            )
            db.commit()
        except Exception:
            db.rollback()

    new_alert = {
        "call_id": f"ALERT-{int(datetime.now().timestamp() * 1000)}",
        "table_id": table_id,
        "table_name": table_name,
        "type": call_type,
        "payment_method": payment_method,
        "note": note,
        "time": datetime.now().strftime("%H:%M:%S"),
        "timestamp": int(datetime.now().timestamp() * 1000)
    }

    current_alerts = load_service_calls()
    current_alerts = [
        a for a in current_alerts
        if not (int(a.get("table_id", 0)) == table_id and a.get("type") == call_type)
    ]
    current_alerts.insert(0, new_alert)
    save_service_calls(current_alerts)

    return {"status": "success", "call": new_alert, "alert": new_alert, "calls": current_alerts}


@router.post("/tables/{table_id}/call")
def customer_call_by_table_path(table_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    return _process_create_service_call(table_id, payload, db)


@router.post("/customer-alert")
@router.post("/live-alerts-v2")
def customer_call_by_body(payload: dict = Body(...), db: Session = Depends(get_db)):
    return _process_create_service_call(payload.get("table_id", 1), payload, db)


@router.get("/service-calls")
@router.get("/customer-alerts")
@router.get("/live-alerts-v2")
def get_all_active_service_calls():
    """Trả danh sách cảnh báo cho cả Nhân viên (/staff) và Thu ngân (/cashier)"""
    calls = load_service_calls()
    return {"calls": calls, "alerts": calls}


@router.put("/service-calls/{table_id}/resolve")
@router.put("/customer-alerts/{table_id}/resolve")
@router.put("/live-alerts-v2/{table_id}/resolve")
def resolve_table_service_call(table_id: int, db: Session = Depends(get_db)):
    """Khi Nhân viên hoặc Thu ngân bấm Đã hỗ trợ / Đã xử lý"""
    calls = [c for c in load_service_calls() if int(c.get("table_id", 0)) != int(table_id)]
    save_service_calls(calls)

    for tbl_name in ["tables", "dining_tables"]:
        try:
            db.execute(
                text(f"UPDATE {tbl_name} SET status = 'occupied' WHERE id = :tid AND status IN ('calling_staff', 'payment_pending')"),
                {"tid": table_id}
            )
            db.commit()
        except Exception:
            db.rollback()

    return {"status": "success", "table_id": table_id, "calls": calls}


# =====================================================================
# PHẦN 5: QUẢN LÝ NHÂN SỰ, CA LÀM VIỆC & ĐỒNG BỘ THỜI GIAN THỰC
# =====================================================================

@router.get("/staff-users")
def get_real_staff_users(db: Session = Depends(get_db)):
    """Lấy danh sách nhân viên thật từ bảng Users (loại bỏ Admin)"""
    users = db.query(User).all()
    all_orders = db.query(Order).all()

    staff_list = []
    now_dt = datetime.now()

    for u in users:
        if getattr(u, "is_active", True) is False:
            continue

        role_str = str(getattr(u, "role", "")).lower().strip()
        username_str = str(getattr(u, "username", "")).lower().strip()

        if role_str in ["admin", "administrator", "manager", "quantri"] or username_str == "admin":
            continue

        if role_str not in ["cashier", "staff", "waiter", "kitchen", "nhanvien", "server"]:
            continue

        raw_created = getattr(u, "created_at", None) or getattr(u, "start_date", None) or getattr(u, "joined_at", None)
        start_date_obj = None
        if raw_created:
            try:
                start_date_obj = raw_created if hasattr(raw_created, "year") else datetime.fromisoformat(str(raw_created).replace(" ", "T"))
            except Exception:
                start_date_obj = None

        if not start_date_obj and all_orders:
            for o in all_orders:
                o_dt = getattr(o, "created_at", None)
                if o_dt and hasattr(o_dt, "year"):
                    if not start_date_obj or o_dt < start_date_obj:
                        start_date_obj = o_dt

        if not start_date_obj:
            start_date_obj = now_dt

        start_date_str = start_date_obj.strftime("%d/%m/%Y")
        working_days = max(1, (now_dt.date() - start_date_obj.date()).days + 1)

        position_map = {
            "cashier": "Thu ngân (Cashier)",
            "staff": "Nhân viên phục vụ",
            "waiter": "Nhân viên phục vụ",
            "nhanvien": "Nhân viên phục vụ",
            "server": "Nhân viên phục vụ",
            "kitchen": "Đầu bếp / Pha chế"
        }

        staff_list.append({
            "id": u.id,
            "staff_code": f"NV{str(u.id).zfill(3)}",
            "username": getattr(u, "username", f"user{u.id}"),
            "full_name": getattr(u, "full_name", None) or getattr(u, "name", None) or getattr(u, "username", f"Nhân viên #{u.id}"),
            "role": role_str,
            "position": position_map.get(role_str, "Nhân viên phục vụ"),
            "department": "Nhà hàng Trung Tâm",
            "start_date": start_date_str,
            "working_days": working_days
        })

    return staff_list


@router.put("/staff/change-password")
def staff_change_own_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Nhân viên đổi mật khẩu cá nhân"""
    staff_name = payload.get("staff_name", "").strip()
    old_password = payload.get("old_password", "")
    new_password = payload.get("new_password", "")

    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới")

    user = db.query(User).filter((User.full_name == staff_name) | (User.username == staff_name)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản nhân viên")

    current_hash = getattr(user, "hashed_password", None) or getattr(user, "password_hash", None) or getattr(user, "password", "")
    is_valid_old = False
    try:
        if current_hash.startswith("$2"):
            is_valid_old = pwd_context_staff.verify(old_password, current_hash)
        else:
            is_valid_old = (old_password == current_hash)
    except Exception:
        is_valid_old = (old_password == current_hash)

    if not is_valid_old:
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác!")

    new_hash = pwd_context_staff.hash(new_password)
    if hasattr(user, "hashed_password"):
        user.hashed_password = new_hash
    elif hasattr(user, "password_hash"):
        user.password_hash = new_hash
    elif hasattr(user, "password"):
        user.password = new_hash

    db.commit()
    return {"status": "success", "message": "Đổi mật khẩu thành công!"}


@router.get("/order-timestamps")
def get_real_order_timestamps(db: Session = Depends(get_db)):
    """Lấy thời gian thật (created_at) của đơn hàng và phiên bàn từ Database"""
    orders = db.query(Order).all()
    order_times = {}
    for o in orders:
        dt = getattr(o, "created_at", None) or getattr(o, "order_time", None) or getattr(o, "updated_at", None)
        if dt:
            order_times[str(o.id)] = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)

    sessions = db.query(TableSession).filter(TableSession.status != "closed").all()
    session_times = {}
    for s in sessions:
        sdt = getattr(s, "created_at", None) or getattr(s, "start_time", None) or getattr(s, "opened_at", None)
        if sdt and getattr(s, "table_id", None):
            session_times[str(s.table_id)] = {
                "session_id": s.id,
                "session_code": getattr(s, "session_code", f"SES-{str(s.id).zfill(4)}"),
                "started_at": sdt.isoformat() if hasattr(sdt, "isoformat") else str(sdt)
            }

    return {
        "order_times": order_times,
        "session_times": session_times,
        "server_now": datetime.now().isoformat()
    }


@router.get("/shift/current")
def get_current_shift_summary(db: Session = Depends(get_db)):
    """Lấy thông tin ca trực hiện tại kèm doanh thu thực tế từ bảng Orders"""
    all_orders = db.query(Order).all()

    completed_orders = [
        o for o in all_orders
        if str(getattr(o, "status", "")).lower() in ["completed", "paid", "served"]
    ]
    active_orders = [
        o for o in all_orders
        if str(getattr(o, "status", "")).lower() in ["pending", "confirmed", "preparing", "cooking", "ready"]
    ]

    db_completed_revenue = sum(float(getattr(o, "total_amount", 0) or 0) for o in completed_orders)
    db_active_revenue = sum(float(getattr(o, "total_amount", 0) or 0) for o in active_orders)

    return {
        **CURRENT_SHIFT_STATE,
        "db_completed_bills": len(completed_orders),
        "db_completed_revenue": db_completed_revenue,
        "db_active_orders_count": len(active_orders),
        "db_active_revenue": db_active_revenue
    }


@router.post("/shift/open")
def open_cashier_shift(payload: dict = Body(...)):
    CURRENT_SHIFT_STATE["is_open"] = True
    CURRENT_SHIFT_STATE["shift_code"] = f"CA-{datetime.now().strftime('%d%m-%H%M')}"
    CURRENT_SHIFT_STATE["opened_at"] = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    CURRENT_SHIFT_STATE["opened_by"] = payload.get("staff_name", "Thu ngân")
    CURRENT_SHIFT_STATE["starting_cash"] = float(payload.get("starting_cash", 500000) or 0)
    CURRENT_SHIFT_STATE["note"] = payload.get("note", "")

    return {"status": "success", "shift": CURRENT_SHIFT_STATE}


@router.post("/shift/close")
def close_cashier_shift(payload: dict = Body(...)):
    actual_cash = float(payload.get("actual_cash", 0) or 0)
    expected_cash = float(payload.get("expected_cash", 0) or 0)

    closed_summary = {
        "shift_code": CURRENT_SHIFT_STATE.get("shift_code"),
        "opened_at": CURRENT_SHIFT_STATE.get("opened_at"),
        "closed_at": datetime.now().strftime("%H:%M:%S %d/%m/%Y"),
        "closed_by": payload.get("staff_name", "Thu ngân"),
        "starting_cash": CURRENT_SHIFT_STATE.get("starting_cash", 0),
        "cash_revenue": float(payload.get("cash_revenue", 0) or 0),
        "transfer_revenue": float(payload.get("transfer_revenue", 0) or 0),
        "total_bills": int(payload.get("total_bills", 0) or 0),
        "expected_cash": expected_cash,
        "actual_cash": actual_cash,
        "discrepancy": actual_cash - expected_cash,
        "note": payload.get("note", "")
    }

    CURRENT_SHIFT_STATE["is_open"] = False
    return {"status": "success", "closed_summary": closed_summary}

@router.post("/tables/{table_id}/checkout-simulated")
def simulate_cashier_checkout_table(table_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    """
    Thu ngân xác nhận thanh toán cho bàn:
    1. Chuyển tất cả các Order đang hoạt động của bàn sang 'completed'
    2. Đóng phiên bàn (TableSession -> 'closed')
    3. Giải phóng bàn về trạng thái 'available' và xóa cảnh báo gọi thanh toán
    """
    payment_method = payload.get("payment_method", "CASH")

    # 1. Tìm các phiên đang mở của bàn
    sessions = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status != "closed"
    ).all()
    session_ids = [s.id for s in sessions]

    orders = []
    if session_ids:
        orders = db.query(Order).filter(Order.session_id.in_(session_ids)).all()
    if not orders and hasattr(Order, "table_id"):
        orders = db.query(Order).filter(Order.table_id == table_id).all()

    paid_amount = 0.0
    paid_orders_count = 0

    for o in orders:
        st = str(getattr(o, "status", "")).lower()
        if st not in ["cancelled", "completed", "paid"]:
            o.status = "completed"
            paid_orders_count += 1
            paid_amount += float(getattr(o, "total_amount", 0) or 0)

            items = db.query(OrderItem).filter(OrderItem.order_id == o.id).all()
            for it in items:
                it_st = str(getattr(it, "item_status", getattr(it, "status", ""))).lower()
                if it_st not in ["cancelled", "out_of_stock"]:
                    if hasattr(it, "item_status"):
                        it.item_status = "served"
                    if hasattr(it, "status"):
                        it.status = "served"

    # 2. Đóng phiên bàn
    for s in sessions:
        s.status = "closed"

    # 3. Trả bàn về trạng thái trống ('available')
    for tbl_name in ["tables", "dining_tables"]:
        try:
            db.execute(
                text(f"UPDATE {tbl_name} SET status = 'available' WHERE id = :tid"),
                {"tid": table_id}
            )
        except Exception:
            pass

    # 4. Xóa cảnh báo gọi thanh toán của bàn này
    calls = [c for c in load_service_calls() if int(c.get("table_id", 0)) != int(table_id)]
    save_service_calls(calls)

    db.commit()
    return {
        "status": "success",
        "table_id": table_id,
        "payment_method": payment_method,
        "paid_orders_count": paid_orders_count,
        "paid_amount": paid_amount
    }