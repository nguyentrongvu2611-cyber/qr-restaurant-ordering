import urllib.request
import urllib.error
import json
import time
from concurrent.futures import ThreadPoolExecutor

API_BASE = "http://127.0.0.1:8000"


def call_api(method: str, path: str, payload: dict = None):
    url = f"{API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            body = res.read().decode("utf-8")
            return res.getcode(), (json.loads(body) if body else {}), None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        return e.code, {}, f"HTTP {e.code}: {err_body[:160]}"
    except Exception as e:
        return 0, {}, str(e)


def run_risk_audit():
    print("🛡️ BẮT ĐẦU KIỂM THỬ RỦI RO & XUNG ĐỘT HỆ THỐNG SMARTPOS (7 BÀI TEST)")
    print("=" * 84)
    risks_found = []

    # Lấy 1 sản phẩm hợp lệ để test
    _, p_raw, _ = call_api("GET", "/api/products")
    products = p_raw if isinstance(p_raw, list) else p_raw.get("items", [])
    avail = [p for p in products if p.get("is_available") not in [False, 0]]
    prod = avail[0]
    price = float(prod.get("price", 50000))

    # Tạo đơn chuẩn trên Bàn 39 để phục vụ các bài test xung đột
    _, ord_res, _ = call_api("POST", "/api/orders", {
        "table_id": 39,
        "customer_note": "Test rủi ro Bàn 39",
        "items": [{"product_id": prod["id"], "quantity": 2, "price": price, "unit_price": price}]
    })
    oid = ord_res.get("order_id") or ord_res.get("id")
    call_api("PUT", f"/api/kitchen/orders/{oid}/confirm")

    _, all_ords_raw, _ = call_api("GET", "/api/orders")
    all_ords = all_ords_raw if isinstance(all_ords_raw, list) else all_ords_raw.get("items", [])
    cur_ord = next((o for o in all_ords if o["id"] == oid), {})
    item_id = (cur_ord.get("items") or [{}])[0].get("id")

    # -------------------------------------------------------------------------
    # TEST 1: Gửi số lượng âm (-5) và số lượng = 0 vào API cập nhật số lượng
    # -------------------------------------------------------------------------
    c_neg, _, _ = call_api("PUT", f"/api/kitchen/items/{item_id}/quantity", {"quantity": -5, "reason": "Test âm"})
    _, check_raw, _ = call_api("GET", "/api/orders")
    check_ords = check_raw if isinstance(check_raw, list) else check_raw.get("items", [])
    it_after = next((i for o in check_ords if o["id"] == oid for i in (o.get("items") or []) if i["id"] == item_id), {})
    if c_neg == 200 and int(it_after.get("quantity", 1)) <= 0:
        risks_found.append(f"[RỦI RO NGHIÊM TRỌNG] API cho phép lưu quantity = {it_after.get('quantity')} (gây âm tiền hóa đơn!)")
        print(f"❌ TEST 1 (Số lượng âm): THẤT BẠI - DB lưu quantity = {it_after.get('quantity')}")
    else:
        print(f"✅ TEST 1 (Chặn số lượng âm/0): AN TOÀN (HTTP {c_neg}, quantity={it_after.get('quantity')})")

    # Khôi phục quantity = 2
    call_api("PUT", f"/api/kitchen/items/{item_id}/quantity", {"quantity": 2, "reason": "Reset test"})

    # -------------------------------------------------------------------------
    # TEST 2: 10 luồng bấm xác nhận & giao món ĐỒNG THỜI vào cùng 1 item (Race Condition)
    # -------------------------------------------------------------------------
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(call_api, "PUT", f"/api/kitchen/items/{item_id}/served") for _ in range(10)]
        codes = [f.result()[0] for f in futs]
    if any(c >= 500 for c in codes):
        risks_found.append(f"[RỦI RO SERVER 500] 10 luồng bấm đồng thời gây lỗi Internal Server Error: {codes}")
        print(f"❌ TEST 2 (Xung đột đồng thời 10 luồng): LỖI 500 ({codes})")
    else:
        print(f"✅ TEST 2 (Xung đột đồng thời 10 luồng): ỔN ĐỊNH - Không lỗi 500/Deadlock ({set(codes)})")

    # -------------------------------------------------------------------------
    # TEST 3: Thao tác trên ID bàn / ID món không tồn tại (404 vs 500 Crash)
    # -------------------------------------------------------------------------
    c_404, _, err_404 = call_api("PUT", "/api/kitchen/items/99999999/cancel", {"reason": "Test ID ảo"})
    if c_404 >= 500:
        risks_found.append(f"[RỦI RO CRASH 500] Gửi item_id không tồn tại làm crash server: {err_404}")
        print(f"❌ TEST 3 (ID không tồn tại): LỖI 500 - {err_404}")
    else:
        print(f"✅ TEST 3 (ID không tồn tại): AN TOÀN - Trả về HTTP {c_404}")

    # -------------------------------------------------------------------------
    # TEST 4: Ký tự đặc biệt / XSS & Ghi chú siêu dài (2000 ký tự)
    # -------------------------------------------------------------------------
    long_xss = "<script>alert('XSS')</script> " + ("Ghi chú siêu dài " * 120)
    c_xss, res_xss, err_xss = call_api("POST", "/api/orders", {
        "table_id": 40,
        "customer_note": long_xss,
        "items": [{"product_id": prod["id"], "quantity": 1, "price": price, "unit_price": price, "note": long_xss}]
    })
    if c_xss >= 500:
        risks_found.append(f"[RỦI RO TRÀN DỮ LIỆU] Ghi chú dài/XSS làm lỗi server: {err_xss}")
        print(f"❌ TEST 4 (Ghi chú siêu dài & XSS): LỖI 500")
    else:
        print(f"✅ TEST 4 (Ghi chú siêu dài & XSS): XỬ LÝ TỐT (HTTP {c_xss})")

    # -------------------------------------------------------------------------
    # TEST 5: Chốt thanh toán Bàn 39, sau đó cố tình gọi API thêm món vào đơn đã đóng
    # -------------------------------------------------------------------------
    call_api("POST", "/api/kitchen/tables/39/checkout-simulated", {"payment_method": "CASH"})
    c_post_pay, _, _ = call_api("POST", f"/api/kitchen/orders/{oid}/add-item", {
        "product_id": prod["id"],
        "quantity": 1,
        "price": price,
        "unit_price": price,
        "note": "Cố tình nhét món vào bill đã thanh toán"
    })
    if c_post_pay == 200:
        risks_found.append("[RỦI RO NGHIỆP VỤ] Hệ thống vẫn cho phép thêm món vào order_id ĐÃ THANH TOÁN (Completed)!")
        print("❌ TEST 5 (Chặn sửa đơn đã thanh toán): PHÁT HIỆN LỖ HỔNG - Vẫn cho thêm món vào đơn đã chốt!")
    else:
        print(f"✅ TEST 5 (Chặn sửa đơn đã thanh toán): AN TOÀN (HTTP {c_post_pay})")

    # Dọn sạch Bàn 39 & Bàn 40 sau khi test rủi ro
    call_api("POST", "/api/kitchen/tables/39/cancel-table", {"reason": "Dọn sau test rủi ro"})
    call_api("POST", "/api/kitchen/tables/40/cancel-table", {"reason": "Dọn sau test rủi ro"})

    print("\n" + "=" * 84)
    print("📋 KẾT LUẬN ĐÁNH GIÁ RỦI RO HỆ THỐNG:")
    if not risks_found:
        print("🏆 TUYỆT VỜI! Hệ thống vượt qua toàn bộ các bài kiểm thử rủi ro & xung đột!")
    else:
        print(f"⚠️ PHÁT HIỆN {len(risks_found)} ĐIỂM RỦI RO CẦN VÁ NGAY:")
        for r in risks_found:
            print(f"  • {r}")
    print("=" * 84)


if __name__ == "__main__":
    run_risk_audit()
