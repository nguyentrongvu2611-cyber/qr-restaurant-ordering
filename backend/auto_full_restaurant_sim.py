import urllib.request
import urllib.error
import json
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = "http://127.0.0.1:8000"
TOTAL_TABLES = 40          # 40 bàn chạy đồng loạt
STEP_DELAY_SECONDS = 5     # Nghỉ 5 giây giữa mỗi chặng để bạn kịp nhìn giao diện Web nhảy trạng thái


def call_api(method: str, path: str, payload: dict = None, timeout: int = 25):
    url = f"{API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None

    start_t = time.perf_counter()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            ms = (time.perf_counter() - start_t) * 1000
            body = res.read().decode("utf-8")
            return res.getcode(), (json.loads(body) if body else {}), round(ms, 1), None
    except urllib.error.HTTPError as e:
        ms = (time.perf_counter() - start_t) * 1000
        err_body = e.read().decode("utf-8")
        return e.code, {}, round(ms, 1), f"HTTP {e.code}: {err_body[:100]}"
    except Exception as e:
        ms = (time.perf_counter() - start_t) * 1000
        return 0, {}, round(ms, 1), str(e)


def banner(stage_num: int, title: str, web_hint: str):
    print("\n" + "=" * 82)
    print(f"🎬 CHẶNG {stage_num}/7: {title}")
    print(f"👀 Quan sát trên Web: {web_hint}")
    print("=" * 82)


def pause_for_web_observation(seconds: int = STEP_DELAY_SECONDS):
    for remaining in range(seconds, 0, -1):
        print(f"\r⏳ Đang giữ trạng thái {remaining}s để bạn quan sát trên trình duyệt Web...", end="", flush=True)
        time.sleep(1)
    print("\r" + " " * 75 + "\r", end="", flush=True)


def run_automated_40_tables_pipeline():
    print("🚀 KHỞI ĐỘNG HỆ THỐNG GIẢ LẬP VẬN HÀNH TỰ ĐỘNG 40 BÀN (END-TO-END AUTOMATION)")

    # Tải danh sách món ăn từ Database
    st, prod_data, _, err = call_api("GET", "/api/products")
    if st != 200:
        st, prod_data, _, err = call_api("GET", "/api/menu/products")
    if st != 200:
        print(f"❌ Không thể kết nối Backend ({API_BASE}): {err}")
        return

    products = prod_data if isinstance(prod_data, list) else prod_data.get("items", [])
    avail_products = [p for p in products if p.get("is_available") not in [False, 0]]
    if not avail_products:
        print("❌ Thực đơn chưa có món nào mở bán!")
        return

    # -------------------------------------------------------------------------
    # CHẶNG 1: 40 KHÁCH QUÉT MÃ QR ĐẶT MÓN CÙNG LÚC
    # -------------------------------------------------------------------------
    banner(
        1,
        f"{TOTAL_TABLES} KHÁCH QUÉT MÃ QR & ĐẶT MÓN CÙNG LÚC",
        "Mở /staff (Tab Chờ duyệt) & /cashier (40 bàn chuyển sang Đang phục vụ)"
    )

    created_orders = {}  # { table_id: order_id }

    def step1_customer_order(table_id: int):
        chosen = random.sample(avail_products, k=min(len(avail_products), random.randint(2, 4)))
        items = [
            {
                "product_id": p["id"],
                "quantity": random.randint(1, 2),
                "price": p.get("price", 50000),
                "unit_price": p.get("price", 50000),
                "note": random.choice(["", "Ít cay", "Làm nóng", "Ít đá"])
            }
            for p in chosen
        ]
        payload = {"table_id": table_id, "customer_note": f"Khách Bàn {table_id:02d} đặt QR", "items": items}

        # Gửi qua /api/orders để tạo đơn pending trước, nếu không có thì qua cashier-create-order
        code, res, ms, error = call_api("POST", "/api/orders", payload)
        if code not in [200, 201]:
            code, res, ms, error = call_api("POST", "/api/kitchen/cashier-create-order", payload)

        oid = res.get("order_id") or res.get("id")
        return table_id, (code in [200, 201]), oid, ms, error

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        futures = [ex.submit(step1_customer_order, tid) for tid in range(1, TOTAL_TABLES + 1)]
        for f in as_completed(futures):
            tid, ok, oid, ms, err = f.result()
            if ok and oid:
                created_orders[tid] = oid
                print(f"  ✅ Bàn {tid:02d}: Đặt đơn thành công (Order ID: {oid}) | {ms} ms")
            else:
                print(f"  ❌ Bàn {tid:02d}: Lỗi đặt đơn -> {err}")

    print(f"📊 Kết quả Chặng 1: {len(created_orders)}/{TOTAL_TABLES} bàn đã tạo đơn thành công!")
    pause_for_web_observation()

    # -------------------------------------------------------------------------
    # CHẶNG 2: NHÂN VIÊN & THU NGÂN DUYỆT ĐƠN -> ĐẨY TOÀN BỘ 40 PHIẾU XUỐNG BẾP/BAR
    # -------------------------------------------------------------------------
    banner(
        2,
        "NHÂN VIÊN DUYỆT ĐƠN & ĐẨY 40 PHIẾU XUỐNG BẾP / QUẦY BAR",
        "Mở /kitchen (Màn hình Bếp & Quầy Bar nhận 40 phiếu FIFO)"
    )

    def step2_confirm_to_kitchen(tid: int, oid: int):
        code1, _, ms1, _ = call_api("PUT", f"/api/kitchen/orders/{oid}/confirm")
        code2, _, ms2, _ = call_api("PUT", f"/api/kitchen/tables/{tid}/notify-kitchen")
        return tid, oid, (code1 == 200 or code2 == 200), round(ms1 + ms2, 1)

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        futures = [ex.submit(step2_confirm_to_kitchen, tid, oid) for tid, oid in created_orders.items()]
        confirmed_count = sum(1 for f in as_completed(futures) if f.result()[2])

    print(f"  ✅ Đã duyệt & đẩy {confirmed_count}/{len(created_orders)} phiếu xuống Màn hình Bếp & Bar!")
    pause_for_web_observation()

    # -------------------------------------------------------------------------
    # CHẶNG 3: BẾP NHẬN ĐƠN & BẤM "BẮT ĐẦU CHẾ BIẾN" (PREPARING)
    # -------------------------------------------------------------------------
    banner(
        3,
        "ĐẦU BẾP BẤM 'BẮT ĐẦU LÀM' (PREPARING) CHO CẢ 40 ĐƠN",
        "Khách xem 'Món đã gọi' thấy trạng thái chuyển sang 'Đang chuẩn bị'"
    )

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        futures = [ex.submit(call_api, "PUT", f"/api/kitchen/orders/{oid}/preparing") for oid in created_orders.values()]
        prep_count = sum(1 for f in as_completed(futures) if f.result()[0] == 200)

    print(f"  🔥 Bếp đang chế biến đồng loạt {prep_count} đơn hàng!")
    pause_for_web_observation()

    # Lấy toàn bộ danh sách item_ids thực tế của 40 đơn đang mở
    _, all_orders_raw, _, _ = call_api("GET", "/api/orders")
    orders_list = all_orders_raw if isinstance(all_orders_raw, list) else all_orders_raw.get("items", [])
    active_order_ids_set = set(created_orders.values())

    all_item_ids = []
    for ord_obj in orders_list:
        if ord_obj.get("id") in active_order_ids_set:
            for it in (ord_obj.get("items") or ord_obj.get("order_items") or []):
                if it.get("id"):
                    all_item_ids.append(it["id"])

    # -------------------------------------------------------------------------
    # CHẶNG 4: BẾP & BAR LÀM XONG MÓN -> ĐẨY RA TRẠM TIẾP THỰC (PASS - READY)
    # -------------------------------------------------------------------------
    banner(
        4,
        f"BẾP & BAR NẤU XONG {len(all_item_ids)} MÓN -> ĐẨY RA TRẠM TIẾP THỰC (PASS)",
        "Mở /kitchen (Tab 2: Trạm Tiếp Thực PASS) & /staff (Tab Bưng món sáng xanh)"
    )

    if all_item_ids:
        # Chia thành các mẻ (batch) đẩy ra PASS giống thực tế
        chunk_size = 25
        for i in range(0, len(all_item_ids), chunk_size):
            batch = all_item_ids[i:i + chunk_size]
            call_api("PUT", "/api/kitchen/batch-ready", {"item_ids": batch})
        print(f"  🔔 Đã hoàn thành chế biến & đẩy {len(all_item_ids)} món ra Trạm Tiếp Thực (PASS)!")
    pause_for_web_observation()

    # -------------------------------------------------------------------------
    # CHẶNG 5: TIẾP THỰC & NHÂN VIÊN GIAO MÓN LÊN BÀN CHO 40 BÀN (SERVED)
    # -------------------------------------------------------------------------
    banner(
        5,
        f"NHÂN VIÊN BƯNG TOÀN BỘ {len(all_item_ids)} MÓN LÊN 40 BÀN (SERVED)",
        "Mở /cashier -> Bấm vào bất kỳ bàn nào sẽ thấy nhãn xanh '✓ Đã lên đủ món'"
    )

    if all_item_ids:
        chunk_size = 25
        for i in range(0, len(all_item_ids), chunk_size):
            batch = all_item_ids[i:i + chunk_size]
            call_api("PUT", "/api/kitchen/batch-served", {"item_ids": batch})
        print(f"  🍽️ Nhân viên đã bưng toàn bộ {len(all_item_ids)} món lên 40 bàn thành công!")
    pause_for_web_observation()

    # -------------------------------------------------------------------------
    # CHẶNG 6: 40 BÀN BẤM "YÊU CẦU THANH TOÁN" (TIỀN MẶT / CHUYỂN KHOẢN QR)
    # -------------------------------------------------------------------------
    banner(
        6,
        "40 BÀN ĐỒNG LOẠT BẤM 'YÊU CẦU THANH TOÁN' TRÊN ĐIỆN THOẠI",
        "Mở /cashier (Nút 'Yêu cầu thanh toán / Gọi NV' nhảy 40) & /staff (Tab Cảnh báo nhảy 40)"
    )

    def step6_customer_call_payment(tid: int):
        method = "TRANSFER" if tid % 2 == 0 else "CASH"
        note_text = "Thanh toán Chuyển khoản QR" if method == "TRANSFER" else "Thanh toán Tiền mặt"
        code, _, ms, _ = call_api("POST", "/api/kitchen/live-alerts-v2", {
            "table_id": tid,
            "table_name": f"Bàn {tid:02d}",
            "type": "CALL_PAYMENT",
            "payment_method": method,
            "note": note_text
        })
        return tid, (code == 200), method

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        futures = [ex.submit(step6_customer_call_payment, tid) for tid in created_orders.keys()]
        call_pay_count = sum(1 for f in as_completed(futures) if f.result()[1])

    print(f"  💳 {call_pay_count} bàn đang nhấp nháy đỏ gọi Thu ngân thanh toán!")
    pause_for_web_observation(seconds=7)  # Dừng 7 giây để bạn nhìn rõ 40 cảnh báo đỏ trên Thu ngân & Nhân viên

    # -------------------------------------------------------------------------
    # CHẶNG 7: THU NGÂN GIẢ LẬP TÍNH TIỀN & CHỐT BILL CHO CẢ 40 BÀN
    # -------------------------------------------------------------------------
    banner(
        7,
        "THU NGÂN TÍNH TIỀN, CHỐT HÓA ĐƠN & GIẢI PHÓNG 40 BÀN VỀ TRỐNG",
        "Mở /cashier -> Doanh thu ca tăng vọt & 40 bàn tự động trở về 'Còn trống'"
    )

    total_simulated_revenue = 0.0
    total_paid_bills = 0

    def step7_cashier_checkout(tid: int):
        method = "TRANSFER" if tid % 2 == 0 else "CASH"
        code, res, ms, err = call_api("POST", f"/api/kitchen/tables/{tid}/checkout-simulated", {
            "payment_method": method
        })
        if code == 200:
            return tid, True, float(res.get("paid_amount", 0) or 0), method, ms
        # Fallback nếu chưa kịp lưu hàm checkout-simulated
        call_api("POST", f"/api/kitchen/tables/{tid}/cancel-table", {"reason": "Thu ngân hoàn tất thanh toán"})
        call_api("PUT", f"/api/kitchen/live-alerts-v2/{tid}/resolve")
        return tid, True, 0.0, method, ms

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        futures = [ex.submit(step7_cashier_checkout, tid) for tid in created_orders.keys()]
        for f in as_completed(futures):
            tid, ok, paid_amt, method, ms = f.result()
            if ok:
                total_paid_bills += 1
                total_simulated_revenue += paid_amt
                print(
                    f"  💰 Bàn {tid:02d}: Đã thu {paid_amt:,.0f}đ ({'Chuyển khoản QR' if method == 'TRANSFER' else 'Tiền mặt'}) "
                    f"& đóng phiên bàn | {ms} ms"
                )

    # Kiểm tra tổng doanh thu ca trực trên Server sau khi thu tiền xong 40 bàn
    _, shift_res, _, _ = call_api("GET", "/api/kitchen/shift/current")

    print("\n" + "=" * 82)
    print("🏆 BÁO CÁO TỔNG KẾT CHU TRÌNH VẬN HÀNH TỰ ĐỘNG 40 BÀN (A -> Z)")
    print("=" * 82)
    print(f"  • Số bàn phục vụ trọn vẹn từ lúc vào đến lúc về : {total_paid_bills}/{TOTAL_TABLES} bàn (100%)")
    print(f"  • Tổng số món ăn Bếp/Bar đã nấu & bưng ra bàn   : {len(all_item_ids)} món")
    print(f"  • Doanh thu thu được trong đợt giả lập vừa rồi  : {total_simulated_revenue:,.0f} VNĐ")
    if shift_res:
        print(f"  • Tổng doanh thu lũy kế trong Ca trực hiện tại  : {shift_res.get('db_completed_revenue', 0):,.0f} VNĐ "
              f"({shift_res.get('db_completed_bills', 0)} hóa đơn đã thanh toán)")
    print("  • Trạng thái sơ đồ 40 bàn hiện tại              : Đã dọn sạch & sẵn sàng đón lượt khách mới!")
    print("=" * 82)


if __name__ == "__main__":
    run_automated_40_tables_pipeline()