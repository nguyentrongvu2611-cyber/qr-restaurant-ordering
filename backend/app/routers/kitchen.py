from fastapi import APIRouter, Depends, Body, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.models.order import Order, OrderItem
from app.models.table import TableSession
from datetime import datetime

# Import an toàn Product / MenuItem (phòng trường hợp class tên là MenuItem hoặc Product)
try:
    from app.models.menu_item import Product
except ImportError:
    from app.models.menu_item import MenuItem as Product

# Import an toàn Socket.IO (không làm crash server nếu chưa có app.socket_instance)
try:
    from app.socket_instance import sio
except ImportError:
    sio = None

router = APIRouter(prefix="/api/kitchen", tags=["Kitchen"])


# =====================================================================
# 1. API: ĐÁNH DẤU MÓN ĐÃ NẤU XONG (CHUYỂN SANG TRẠM TIẾP THỰC)
# =====================================================================
@router.put("/items/{item_id}/done")
async def mark_item_done(item_id: int, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")

    if hasattr(item, "item_status"):
        item.item_status = "ready"
    if hasattr(item, "status"):
        item.status = "ready"
    db.commit()

    # Kiểm tra xem tất cả các món trong đơn đã xong chưa
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


# =====================================================================
# 2. API: TRẠM TIẾP THỰC / NHÂN VIÊN BẤM "ĐÃ LÊN BÀN" (SERVED)
# =====================================================================
@router.put("/items/{item_id}/served")
async def mark_item_served(item_id: int, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")

    if hasattr(item, "item_status"):
        item.item_status = "served"
    if hasattr(item, "status"):
        item.status = "served"
    db.commit()

    # Nếu toàn bộ món trong đơn đã served (hoặc đã hủy/hết món), cập nhật trạng thái Order
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


# =====================================================================
# 3. API: BẾP BÁO HẾT MÓN TRỌN GÓI (KHÓA MENU + HỦY MÓN + TRỪ TIỀN)
# =====================================================================
@router.put("/out-of-stock")
async def kitchen_report_out_of_stock(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Khi Bếp bấm 'Báo hết':
    1. Khóa món trên Menu (Product.is_available = False)
    2. Đánh dấu dòng món trong OrderItem thành 'out_of_stock' (KHÔNG xóa đơn để Nhân viên nhìn thấy món hết và ra hỏi khách Đổi món hoặc Báo Thu ngân hủy)
    """
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

    # 1. Khóa món trong bảng Product
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

    # 2. Đánh dấu dòng món là 'out_of_stock' (GIỮ NGUYÊN Order để Nhân viên và Thu ngân xử lý)
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


# =====================================================================
# 4. API: NHÂN VIÊN ĐỔI MÓN MỚI CHO KHÁCH KHI MÓN CŨ HẾT HÀNG
# =====================================================================
@router.put("/items/{item_id}/swap")
def staff_swap_out_of_stock_item(item_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
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

    # Cập nhật sang món mới và đưa về trạng thái confirmed để Bếp làm món mới
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

    # Cập nhật lại tổng tiền đơn hàng
    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order and hasattr(order, "total_amount"):
        order.total_amount = max(0, float(order.total_amount or 0) - (old_price * qty) + (new_price * qty))
        if order.status in ["cancelled", "ready"]:
            order.status = "confirmed"

    db.commit()
    return {"status": "success", "new_product_name": new_product.name, "new_price": new_price}


# =====================================================================
# 5. API: THU NGÂN XÓA / ĐÓNG BÀN KHI KHÁCH ĐỔI Ý (NHẬP LÝ DO)
# =====================================================================
@router.post("/tables/{table_id}/cancel-table")
def cashier_cancel_table_session(table_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    reason = payload.get("reason", "Khách đổi ý")

    # 1. Trả trạng thái bàn về available
    for tbl_name in ["dining_tables", "tables"]:
        try:
            db.execute(
                text(f"UPDATE {tbl_name} SET status = 'available' WHERE id = :tid"),
                {"tid": table_id}
            )
        except Exception:
            pass

    # 2. Đóng phiên bàn (table_sessions) và hủy các đơn đang treo của bàn đó
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

    # Dự phòng nếu Order lưu trực tiếp table_id
    try:
        db.execute(
            text("UPDATE orders SET status = 'cancelled' WHERE table_id = :tid AND status NOT IN ('completed', 'paid')"),
            {"tid": table_id}
        )
    except Exception:
        pass

    db.commit()
    return {"status": "success", "table_id": table_id, "reason": reason}

# =====================================================================
# 7. GIỮ LẠI ROUTE CŨ ĐỂ TƯƠNG THÍCH NGƯỢC
# =====================================================================
@router.put("/items/{item_id}/out-of-stock")
async def report_out_of_stock_legacy(item_id: int, db: Session = Depends(get_db)):
    return await kitchen_report_out_of_stock({"order_item_id": item_id}, db)

@router.post("/tables/{table_id}/call")
async def customer_call_staff_or_payment(table_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    call_type = payload.get("type", "CALL_STAFF") # 'CALL_STAFF' | 'CALL_PAYMENT'
    payment_method = payload.get("payment_method", "CASH")

    # Nếu khách gọi thanh toán -> Đổi trạng thái bàn sang payment_pending để màn hình Thu ngân nhấp nháy đỏ
    if call_type == "CALL_PAYMENT":
        for tbl_name in ["dining_tables", "tables"]:
            try:
                db.execute(
                    text(f"UPDATE {tbl_name} SET status = 'payment_pending' WHERE id = :tid"),
                    {"tid": table_id}
                )
            except Exception:
                pass
        db.commit()

    return {
        "status": "success",
        "table_id": table_id,
        "type": call_type,
        "payment_method": payment_method
    }

# =====================================================================
# 6. API: THU NGÂN XÓA MÓN KHỎI HÓA ĐƠN (TRỪ TIỀN & CẬP NHẬT TRẠNG THÁI ĐƠN)
# =====================================================================
@router.put("/items/{item_id}/cancel")
async def cashier_cancel_order_item(item_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy món cần xóa")

    reason = payload.get("reason", "Thu ngân xóa món")
    unit_price = float(getattr(item, "unit_price", 0) or getattr(item, "price", 0))
    qty = int(getattr(item, "quantity", 1) or 1)
    deducted = unit_price * qty

    # Đổi trạng thái dòng món thành cancelled (hoặc xóa hẳn nếu cần)
    if hasattr(item, "item_status"):
        item.item_status = "cancelled"
    if hasattr(item, "status"):
        item.status = "cancelled"
    if hasattr(item, "cancel_reason"):
        item.cancel_reason = reason

    # Cập nhật lại tổng tiền của đơn hàng (Order)
    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        if hasattr(order, "total_amount"):
            order.total_amount = max(0, float(order.total_amount or 0) - deducted)

        # Kiểm tra nếu tất cả các món trong đơn đều đã bị hủy thì chuyển đơn sang cancelled
        all_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        if all(
            getattr(i, "item_status", getattr(i, "status", "")) in ["cancelled", "out_of_stock"]
            for i in all_items
        ):
            order.status = "cancelled"

    db.commit()
    return {
        "status": "success",
        "item_id": item_id,
        "deducted_amount": deducted,
        "reason": reason
    }


# =====================================================================
# 7. API: THU NGÂN TĂNG / GIẢM SỐ LƯỢNG MÓN (+/-) TRÊN HÓA ĐƠN
# =====================================================================
@router.put("/items/{item_id}/quantity")
async def cashier_update_item_quantity(item_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
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

# =====================================================================
# 8. API: DUYỆT ĐƠN (ĐỔI CẢ ORDER VÀ ORDER_ITEMS SANG 'confirmed')
# =====================================================================
@router.put("/orders/{order_id}/confirm")
async def confirm_order_full(order_id: int, db: Session = Depends(get_db)):
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


# =====================================================================
# 9. API: BẾP BẤM "BẮT ĐẦU LÀM" (ĐỔI CẢ ĐƠN & MÓN SANG 'preparing')
# =====================================================================
@router.put("/orders/{order_id}/preparing")
async def start_preparing_order_full(order_id: int, db: Session = Depends(get_db)):
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


# =====================================================================
# 10. API: THU NGÂN BẤM "THÔNG BÁO (F10)" -> DUYỆT TẤT CẢ ĐƠN CỦA BÀN ĐÓ XUỐNG BẾP
# =====================================================================
@router.put("/tables/{table_id}/notify-kitchen")
async def cashier_notify_table_to_kitchen(table_id: int, db: Session = Depends(get_db)):
    # Tìm các phiên đang mở của bàn này
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

# =====================================================================
# 11. API: CHỐT MẺ MÓN (GOM NHIỀU ĐƠN CÙNG MÓN ĐẨY RA PASS CÙNG LÚC)
# =====================================================================
@router.put("/batch-ready")
async def mark_batch_items_ready(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Nhận danh sách item_ids của cùng 1 món từ nhiều bàn khi Bếp/Bar nấu xong 1 mẻ
    hoặc khi đẩy nguyên 1 phiếu ra PASS Bếp / PASS Bar.
    """
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

    # Cập nhật trạng thái Order nếu tất cả các món trong Order đã ready/served
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


# =====================================================================
# 12. API: GIAO NGAY 1 CHẠM (DÙNG CHO LUỒNG NƯỚC ĐÓNG CHAI FAST-TRACK & TIẾP THỰC)
# =====================================================================
@router.put("/batch-served")
async def mark_batch_items_served(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Tiếp thực xác nhận nhận món tại PASS và giao ra bàn (hoặc lấy nước đóng chai giao ngay)
    """
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

from app.models.user import User

# =====================================================================
# 13. API: LẤY DANH SÁCH NHÂN VIÊN THẬT TỪ BẢNG USERS (LOẠI BỎ ADMIN)
# =====================================================================
@router.get("/staff-users")
def get_real_staff_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    all_orders = db.query(Order).all()

    staff_list = []
    now_dt = datetime.now()

    for u in users:
        is_active = getattr(u, "is_active", True)
        if is_active is False:
            continue

        role_str = str(getattr(u, "role", "")).lower().strip()
        username_str = str(getattr(u, "username", "")).lower().strip()

        # LOẠI BỎ HOÀN TOÀN TÀI KHOẢN ADMIN / QUẢN TRỊ VIÊN
        if role_str in ["admin", "administrator", "manager", "quantri"] or username_str == "admin":
            continue

        # Chỉ lấy các vị trí nhân viên vận hành: Thu ngân, Nhân viên phục vụ, Bếp/Bar
        if role_str not in ["cashier", "staff", "waiter", "kitchen", "nhanvien", "server"]:
            continue

        # Lấy ngày bắt đầu làm việc từ created_at của tài khoản trong DB
        raw_created = (
            getattr(u, "created_at", None)
            or getattr(u, "start_date", None)
            or getattr(u, "joined_at", None)
        )

        start_date_obj = None
        if raw_created:
            try:
                if hasattr(raw_created, "year"):
                    start_date_obj = raw_created
                else:
                    start_date_obj = datetime.fromisoformat(str(raw_created).replace(" ", "T"))
            except Exception:
                start_date_obj = None

        # Nếu DB chưa lưu created_at của user thì lấy ngày của đơn hàng đầu tiên trên hệ thống
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

        # Map tên vị trí công việc tiếng Việt rõ ràng
        position_map = {
            "cashier": "Thu ngân (Cashier)",
            "staff": "Nhân viên phục vụ",
            "waiter": "Nhân viên phục vụ",
            "nhanvien": "Nhân viên phục vụ",
            "server": "Nhân viên phục vụ",
            "kitchen": "Đầu bếp / Pha chế"
        }
        position_label = position_map.get(role_str, "Nhân viên phục vụ")

        staff_list.append({
            "id": u.id,
            "staff_code": f"NV{str(u.id).zfill(3)}",
            "username": getattr(u, "username", f"user{u.id}"),
            "full_name": getattr(u, "full_name", None) or getattr(u, "name", None) or getattr(u, "username", f"Nhân viên #{u.id}"),
            "role": role_str,
            "position": position_label,
            "department": "Nhà hàng Trung Tâm",
            "start_date": start_date_str,
            "working_days": working_days
        })

    return staff_list

# =====================================================================
# 14. API: HOÀN TÁC LƯỢT GIAO MÓN (KHÔI PHỤC TRẠNG THÁI TRONG DATABASE)
# =====================================================================
@router.put("/batch-undo")
async def undo_served_items_in_db(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Khôi phục các món vừa bấm giao nhầm từ 'served'/'ready' quay trở lại 'confirmed'
    để hiển thị lại trên màn hình Tiếp thực & Quầy Bar (F5 không bị mất).
    """
    item_ids = payload.get("item_ids", [])
    if not item_ids:
        raise HTTPException(status_code=400, detail="Danh sách món cần hoàn tác trống")

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

@router.put("/batch-unserve")
async def undo_served_items(payload: dict = Body(...), db: Session = Depends(get_db)):
    item_ids = payload.get("item_ids", [])
    if not item_ids:
        return {"status": "empty"}

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

# 15. API: LẤY THỜI GIAN THẬT (CREATED_AT) CỦA ĐƠN HÀNG & PHIÊN BÀN TỪ DB
# =====================================================================
@router.get("/order-timestamps")
def get_real_order_timestamps(db: Session = Depends(get_db)):
    """
    Trả về thời gian thực tế khách đặt món hoặc thu ngân tạo đơn từ Database
    để hiển thị chính xác giờ vào và số phút chờ thực tế (không dùng mock 1p/2p).
    """
    orders = db.query(Order).all()
    order_times = {}
    for o in orders:
        dt = (
            getattr(o, "created_at", None)
            or getattr(o, "order_time", None)
            or getattr(o, "updated_at", None)
        )
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

# Bộ nhớ lưu trạng thái ca làm việc hiện tại trên Server (kết hợp truy vấn doanh thu thật từ DB)
CURRENT_SHIFT_STATE = {
    "is_open": True,
    "shift_code": f"CA-{datetime.now().strftime('%d%m-%H%M')}",
    "opened_at": datetime.now().strftime("%H:%M:%S %d/%m/%Y"),
    "opened_by": "Thu ngân",
    "starting_cash": 500000.0,
    "note": ""
}

@router.get("/shift/current")
def get_current_shift_summary(db: Session = Depends(get_db)):
    """
    Lấy thông tin ca trực hiện tại kèm số liệu doanh thu thực tế từ bảng Orders trong Database
    """
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
def open_cashier_shift(payload: dict = Body(...), db: Session = Depends(get_db)):
    starting_cash = float(payload.get("starting_cash", 500000) or 0)
    staff_name = payload.get("staff_name", "Thu ngân")
    note = payload.get("note", "")

    CURRENT_SHIFT_STATE["is_open"] = True
    CURRENT_SHIFT_STATE["shift_code"] = f"CA-{datetime.now().strftime('%d%m-%H%M')}"
    CURRENT_SHIFT_STATE["opened_at"] = datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    CURRENT_SHIFT_STATE["opened_by"] = staff_name
    CURRENT_SHIFT_STATE["starting_cash"] = starting_cash
    CURRENT_SHIFT_STATE["note"] = note

    return {"status": "success", "shift": CURRENT_SHIFT_STATE}


@router.post("/shift/close")
def close_cashier_shift(payload: dict = Body(...), db: Session = Depends(get_db)):
    actual_cash = float(payload.get("actual_cash", 0) or 0)
    expected_cash = float(payload.get("expected_cash", 0) or 0)
    cash_revenue = float(payload.get("cash_revenue", 0) or 0)
    transfer_revenue = float(payload.get("transfer_revenue", 0) or 0)
    total_bills = int(payload.get("total_bills", 0) or 0)
    staff_name = payload.get("staff_name", "Thu ngân")
    note = payload.get("note", "")

    discrepancy = actual_cash - expected_cash
    closed_summary = {
        "shift_code": CURRENT_SHIFT_STATE.get("shift_code"),
        "opened_at": CURRENT_SHIFT_STATE.get("opened_at"),
        "closed_at": datetime.now().strftime("%H:%M:%S %d/%m/%Y"),
        "closed_by": staff_name,
        "starting_cash": CURRENT_SHIFT_STATE.get("starting_cash", 0),
        "cash_revenue": cash_revenue,
        "transfer_revenue": transfer_revenue,
        "total_bills": total_bills,
        "expected_cash": expected_cash,
        "actual_cash": actual_cash,
        "discrepancy": discrepancy,
        "note": note
    }

    CURRENT_SHIFT_STATE["is_open"] = False
    return {"status": "success", "closed_summary": closed_summary}