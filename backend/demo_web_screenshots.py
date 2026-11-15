import urllib.request
import urllib.error
import json
import random

API_BASE = "http://127.0.0.1:8000"

def call_api(method, path, payload=None):
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(payload).encode("utf-8") if payload else None,
        headers={"Content-Type": "application/json"},
        method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            body = res.read().decode("utf-8")
            return res.getcode(), json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"⚠️ Lỗi tại {method} {path}: HTTP {e.code} - {err_msg}")
        return e.code, {}

# Mở lại toàn bộ món ẩn/hết nếu có từ lượt test trước
call_api("PUT", "/api/kitchen/unhide-all-products")

_, p_raw = call_api("GET", "/api/products")
products = p_raw if isinstance(p_raw, list) else p_raw.get("items", [])
avail = [p for p in products if p.get("is_available") is True or p.get("is_available") == 1]
if not avail:
    avail = products

# 1. Bàn 01: Tạo 3 lượt gọi món + 1 món đã lên + 1 món báo hết
o1_ids = []
for round_idx in range(1, 4):
    chosen = random.sample(avail, k=min(len(avail), 2))
    c, res = call_api("POST", "/api/orders", {
        "table_id": 1,
        "customer_note": f"Bàn 01 - Lượt {round_idx}",
        "items": [{"product_id": p["id"], "quantity": 2 if round_idx == 1 else 1, "price": p["price"], "unit_price": p["price"]} for p in chosen]
    })
    oid = res.get("order_id") or res.get("id")
    if oid:
        call_api("PUT", f"/api/kitchen/orders/{oid}/confirm")
        o1_ids.append(oid)

_, all_ords = call_api("GET", "/api/orders")
ords_list = all_ords if isinstance(all_ords, list) else all_ords.get("items", [])
b1_items = [it for o in ords_list if o["id"] in o1_ids for it in (o.get("items") or [])]
if len(b1_items) >= 3:
    call_api("PUT", "/api/kitchen/batch-served", {"item_ids": [b1_items[0]["id"], b1_items[1]["id"]]})
    call_api("PUT", f"/api/kitchen/items/{b1_items[-1]['id']}/out-of-stock", {"reason": "Hết nguyên liệu trong ca"})

# 2. Bàn 02 -> Bàn 15: Đã xác nhận & đang chế biến tại Bếp/Bar
for tid in range(2, 16):
    chosen = random.sample(avail, k=min(len(avail), 2))
    c, res = call_api("POST", "/api/orders", {
        "table_id": tid,
        "customer_note": f"Khách Bàn {tid:02d}",
        "items": [{"product_id": p["id"], "quantity": random.randint(1, 2), "price": p["price"], "unit_price": p["price"]} for p in chosen]
    })
    oid = res.get("order_id") or res.get("id")
    if oid:
        call_api("PUT", f"/api/kitchen/orders/{oid}/confirm")

# 3. Bàn 16 -> Bàn 20: Đơn mới khách vừa quét QR (Chờ nhân viên duyệt)
for tid in range(16, 21):
    chosen = random.sample(avail, k=min(len(avail), 2))
    call_api("POST", "/api/orders", {
        "table_id": tid,
        "customer_note": f"Đơn QR mới Bàn {tid:02d}",
        "items": [{"product_id": p["id"], "quantity": 1, "price": p["price"], "unit_price": p["price"]} for p in chosen]
    })

# 4. Bàn 05 & Bàn 06 gửi yêu cầu thanh toán
call_api("POST", "/api/kitchen/live-alerts-v2", {"table_id": 5, "table_name": "Bàn 05", "type": "CALL_PAYMENT", "payment_method": "TRANSFER", "note": "Thanh toán Chuyển khoản QR"})
call_api("POST", "/api/kitchen/live-alerts-v2", {"table_id": 6, "table_name": "Bàn 06", "type": "CALL_PAYMENT", "payment_method": "CASH", "note": "Thanh toán Tiền mặt"})

print("✅ Đã dựng xong dữ liệu minh chứng trên Web! Mở trình duyệt (Ctrl + Shift + R) để chụp hình ngay.")
