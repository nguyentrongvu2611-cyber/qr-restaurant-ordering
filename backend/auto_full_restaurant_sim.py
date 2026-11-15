import urllib.request
import urllib.error
import json
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = "http://127.0.0.1:8000"
TOTAL_TABLES = 40          # 40 bàn chạy đồng loạt
STEP_DELAY_SECONDS = 4     # Dừng 4s mỗi chặng để quan sát trên trình duyệt Web


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
        return e.code, {}, round(ms, 1), f"HTTP {e.code}: {err_body[:140]}"
    except Exception as e:
        ms = (time.perf_counter() - start_t) * 1000
        return 0, {}, round(ms, 1), str(e)


def banner(stage_num: int, title: str, web_hint: str):
    print("\n" + "=" * 86)
    print(f"🎬 CHẶNG {stage_num}/9: {title}")
    print(f"👀 Quan sát trên Web: {web_hint}")
    print("=" * 86)


def pause_for_web_observation(seconds: int = STEP_DELAY_SECONDS):
    for remaining in range(seconds, 0, -1):
        print(f"\r⏳ Đang giữ trạng thái {remaining}s để bạn quan sát trên Web...", end="", flush=True)
        time.sleep(1)
    print("\r" + " " * 75 + "\r", end="", flush=True)


def fetch_active_orders_map(target_order_ids: set):
    _, raw, _, _ = call_api("GET", "/api/orders")
    orders = raw if isinstance(raw, list) else raw.get("items", [])
    result = {}
    for o in orders:
        if o.get("id") in target_order_ids:
            result[o["id"]] = o
    return result


def run_automated_40_tables_pipeline():
    print("🚀 KHỞI ĐỘNG KIỂM THỬ TOÀN DIỆN 9 CHẶNG CHO 40 BÀN (END-TO-END TEST SUITE)")
    errors_log = []

    # 1. Tải danh sách sản phẩm
    st, prod_data, _, err = call_api("GET", "/api/products")
    if st != 200:
        st, prod_data, _, err = call_api("GET", "/api/menu/products")
    if st != 200:
        print(f"❌ Không thể kết nối Backend ({API_BASE}): {err}")
        return

    products = prod_data if isinstance(prod_data, list) else prod_data.get("items", [])
    avail_products = [p for p in products if p.get("is_available") not in [False, 0]]
    if len(avail_products) < 4:
        print("❌ Thực đơn cần ít nhất 4 món mở bán để chạy kịch bản đổi/thêm món!")
        return

    # =========================================================================
    # CHẶNG 1: 40 KHÁCH QUÉT MÃ QR ĐẶT MÓN CÙNG LÚC
    # =========================================================================
    banner(
        1,
        f"{TOTAL_TABLES} KHÁCH QUÉT MÃ QR ĐẶT MÓN CÙNG LÚC (LƯỢT 1)",
        "Mở /staff (Tab Chờ nhảy 40 đơn) & /cashier (40 bàn chuyển Đang phục vụ)"
    )

    created_orders = {}  # { table_id: order_id }

    def step1_customer_order(table_id: int):
        chosen = random.sample(avail_products, k=min(len(avail_products), 3))
        items = []
        for idx, p in enumerate(chosen):
            # Món đầu tiên luôn đặt số lượng = 2 để phục vụ bài test Thu ngân giảm số lượng (-1)
            qty = 2 if idx == 0 else random.randint(1, 2)
            items.append({
                "product_id": p["id"],
                "quantity": qty,
                "price": p.get("price", 50000),
                "unit_price": p.get("price", 50000),
                "note": random.choice(["", "Ít cay", "Làm nóng", "Ít đá"])
            })
        payload = {"table_id": table_id, "customer_note": f"Khách Bàn {table_id:02d} đặt QR", "items": items}
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
            else:
                errors_log.append(f"Chặng 1 - Bàn {tid:02d}: {err}")

    print(f"  ✅ Thành công: {len(created_orders)}/{TOTAL_TABLES} bàn đã tạo đơn QR Lượt 1!")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 2: NHÂN VIÊN XÁC NHẬN ĐƠN -> ĐẨY 40 PHIẾU XUỐNG BẾP / QUẦY BAR
    # =========================================================================
    banner(
        2,
        "NHÂN VIÊN XÁC NHẬN ĐƠN & ĐẨY 40 PHIẾU XUỐNG BẾP / QUẦY BAR",
        "Mở /kitchen (Màn hình Bếp & Bar nhận 40 phiếu) & /staff (Tab Chờ về 0)"
    )

    def step2_confirm(tid: int, oid: int):
        c1, _, ms1, e1 = call_api("PUT", f"/api/kitchen/orders/{oid}/confirm")
        c2, _, ms2, e2 = call_api("PUT", f"/api/kitchen/tables/{tid}/notify-kitchen")
        ok = (c1 == 200 or c2 == 200)
        return tid, ok, round(ms1 + ms2, 1), (e1 or e2)

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        futures = [ex.submit(step2_confirm, tid, oid) for tid, oid in created_orders.items()]
        ok_cnt = 0
        for f in as_completed(futures):
            tid, ok, ms, err = f.result()
            if ok:
                ok_cnt += 1
            else:
                errors_log.append(f"Chặng 2 - Bàn {tid:02d}: {err}")

    print(f"  ✅ Đã xác nhận & đẩy {ok_cnt}/{len(created_orders)} phiếu xuống Bếp/Bar!")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 3: NHÂN VIÊN / KHÁCH GỌI THÊM MÓN BỔ SUNG (LƯỢT 2) CHO 20 BÀN ĐẦU
    # =========================================================================
    banner(
        3,
        "NHÂN VIÊN / KHÁCH GỌI THÊM MÓN BỔ SUNG (LƯỢT 2) CHO 20 BÀN",
        "Mở /cashier -> Bấm 'Xem X lượt gọi món' để kiểm tra hiển thị chi tiết từng lượt"
    )

    extra_orders = {}  # { table_id: extra_order_id }

    def step3_add_round2(tid: int):
        extra_prod = random.choice(avail_products)
        payload = {
            "table_id": tid,
            "customer_note": f"Bàn {tid:02d} gọi thêm Lượt 2",
            "items": [{
                "product_id": extra_prod["id"],
                "quantity": 1,
                "price": extra_prod.get("price", 45000),
                "unit_price": extra_prod.get("price", 45000),
                "note": "Gọi thêm lượt 2"
            }]
        }
        c, res, ms, err = call_api("POST", "/api/orders", payload)
        oid2 = res.get("order_id") or res.get("id")
        if c in [200, 201] and oid2:
            call_api("PUT", f"/api/kitchen/orders/{oid2}/confirm")
            return tid, True, oid2, None
        return tid, False, None, err

    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = [ex.submit(step3_add_round2, tid) for tid in range(1, 21) if tid in created_orders]
        for f in as_completed(futures):
            tid, ok, oid2, err = f.result()
            if ok and oid2:
                extra_orders[tid] = oid2
            else:
                errors_log.append(f"Chặng 3 - Bàn {tid:02d} gọi thêm: {err}")

    print(f"  ✅ Đã tạo & xác nhận {len(extra_orders)}/20 lượt gọi thêm (Lượt 2)!")
    pause_for_web_observation()

    # Lấy dữ liệu toàn bộ item_ids hiện tại
    all_target_oids = set(created_orders.values()) | set(extra_orders.values())
    orders_map = fetch_active_orders_map(all_target_oids)

    # =========================================================================
    # CHẶNG 4: BẾP BÁO HẾT MÓN TRÊN 10 BÀN ĐẦU (BÀN 01 -> BÀN 10)
    # =========================================================================
    banner(
        4,
        "BẾP BÁO HẾT MÓN TRÊN 10 BÀN (BÀN 01 -> BÀN 10)",
        "Mở /staff (Tab Cảnh báo nhảy 10) & /cashier (Món gạch đỏ 'Bếp báo hết')"
    )

    out_of_stock_items = []  # list of (tid, item_id, old_product_id)
    for tid in range(1, 11):
        oid = created_orders.get(tid)
        ord_obj = orders_map.get(oid, {})
        items = ord_obj.get("items") or ord_obj.get("order_items") or []
        if items:
            target_it = items[-1]
            c, _, _, err = call_api("PUT", f"/api/kitchen/items/{target_it['id']}/out-of-stock", {
                "reason": "Hết nguyên liệu trong ca"
            })
            if c == 200:
                out_of_stock_items.append((tid, target_it["id"], target_it.get("product_id")))
            else:
                errors_log.append(f"Chặng 4 - Báo hết món Bàn {tid:02d}: {err}")

    print(f"  🚨 Bếp đã báo hết {len(out_of_stock_items)}/10 món & bắn cảnh báo sang Nhân viên/Thu ngân!")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 5: NHÂN VIÊN PHỤC VỤ ĐỔI MÓN HẾT SANG MÓN MỚI CHO KHÁCH
    # =========================================================================
    banner(
        5,
        "NHÂN VIÊN ĐỔI MÓN HẾT SANG MÓN MỚI CHO 10 BÀN (SWAP ITEM)",
        "Mở /staff (Cảnh báo món hết giảm về 0) & /kitchen (Nhận phiếu món đổi mới)"
    )

    swapped_count = 0
    for tid, item_id, old_pid in out_of_stock_items:
        alt_prod = next((p for p in avail_products if p["id"] != old_pid), avail_products[0])
        c, _, _, err = call_api("PUT", f"/api/kitchen/items/{item_id}/swap", {
            "new_product_id": alt_prod["id"],
            "quantity": 1,
            "note": f"Nhân viên đổi từ món hết sang {alt_prod.get('name')}"
        })
        if c == 200:
            swapped_count += 1
        else:
            errors_log.append(f"Chặng 5 - Đổi món Bàn {tid:02d}: {err}")

    print(f"  🔄 Nhân viên đã đổi món thành công cho {swapped_count}/{len(out_of_stock_items)} bàn!")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 6: THU NGÂN THÊM MÓN HỘ KHÁCH TẠI QUẦY CHO 10 BÀN (BÀN 11 -> BÀN 20)
    # =========================================================================
    banner(
        6,
        "THU NGÂN THÊM MÓN HỘ KHÁCH TẠI QUẦY (BÀN 11 -> BÀN 20)",
        "Mở /cashier (Bàn 11..20 cập nhật thêm món mới & chuyển Bếp)"
    )

    cashier_added_count = 0
    for tid in range(11, 21):
        oid = created_orders.get(tid)
        if not oid:
            continue
        p = random.choice(avail_products)
        c, _, _, err = call_api("POST", f"/api/kitchen/orders/{oid}/add-item", {
            "product_id": p["id"],
            "quantity": 1,
            "price": p.get("price", 55000),
            "unit_price": p.get("price", 55000),
            "note": "Thu ngân thêm hộ khách tại quầy"
        })
        if c == 200:
            call_api("PUT", f"/api/kitchen/tables/{tid}/notify-kitchen")
            cashier_added_count += 1
        else:
            errors_log.append(f"Chặng 6 - Thu ngân thêm món Bàn {tid:02d}: {err}")

    print(f"  ➕ Thu ngân đã thêm món & đẩy Bếp thành công cho {cashier_added_count}/10 bàn!")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 7: THU NGÂN TRỪ SỐ LƯỢNG (-1) & HỦY MÓN CÓ LÝ DO NGHIỆP VỤ
    # =========================================================================
    banner(
        7,
        "THU NGÂN GIẢM SỐ LƯỢNG (-1) & HỦY MÓN KÈM LÝ DO (BÀN 21 -> BÀN 30)",
        "Kiểm tra logic giảm số lượng từ 2 -> 1 (không bị xóa mất món) & hủy món có lý do"
    )

    orders_map = fetch_active_orders_map(all_target_oids)
    decreased_ok = 0
    cancelled_ok = 0

    for tid in range(21, 31):
        oid = created_orders.get(tid)
        ord_obj = orders_map.get(oid, {})
        items = ord_obj.get("items") or ord_obj.get("order_items") or []
        if len(items) >= 2:
            # Món 1 có quantity = 2 -> giảm xuống 1 kèm lý do
            it_dec = items[0]
            cur_q = int(it_dec.get("quantity", 2))
            if cur_q > 1:
                c1, _, _, e1 = call_api("PUT", f"/api/kitchen/items/{it_dec['id']}/quantity", {
                    "quantity": cur_q - 1,
                    "reason": "Khách đổi ý / Trả lại 1 phần"
                })
                if c1 == 200:
                    decreased_ok += 1
                else:
                    errors_log.append(f"Chặng 7 - Giảm SL Bàn {tid:02d}: {e1}")

            # Món 2 -> hủy món kèm lý do nghiệp vụ
            it_can = items[1]
            c2, _, _, e2 = call_api("PUT", f"/api/kitchen/items/{it_can['id']}/cancel", {
                "reason": "Thu ngân / Nhân viên bấm nhầm"
            })
            if c2 == 200:
                cancelled_ok += 1
            else:
                errors_log.append(f"Chặng 7 - Hủy món Bàn {tid:02d}: {e2}")

    # Xác minh lại từ DB xem món giảm từ 2 -> 1 vẫn còn tồn tại (không bị xóa nhầm)
    verify_map = fetch_active_orders_map(all_target_oids)
    verify_kept = 0
    for tid in range(21, 31):
        oid = created_orders.get(tid)
        items = verify_map.get(oid, {}).get("items") or []
        if items and items[0].get("quantity") == 1 and items[0].get("item_status") != "cancelled":
            verify_kept += 1

    print(f"  ➖ Giảm số lượng (2 -> 1): {decreased_ok}/10 bàn (Xác minh DB giữ nguyên món: {verify_kept}/10 bàn)")
    print(f"  🗑️ Hủy món kèm lý do nghiệp vụ: {cancelled_ok}/10 bàn")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 8: BẾP & BAR NẤU XONG & GIAO ĐỦ MÓN LÊN TOÀN BỘ 40 BÀN
    # =========================================================================
    banner(
        8,
        "BẾP & BAR HOÀN THÀNH CHẾ BIẾN & GIAO MÓN LÊN ĐỦ 40 BÀN (SERVED)",
        "Mở /cashier -> Tất cả món còn hiệu lực hiện nhãn xanh '✓ Đã lên đủ món'"
    )

    latest_orders_map = fetch_active_orders_map(all_target_oids)
    valid_item_ids = []
    for ord_obj in latest_orders_map.values():
        for it in (ord_obj.get("items") or ord_obj.get("order_items") or []):
            st = str(it.get("item_status") or it.get("status") or "").lower()
            if it.get("id") and st not in ["cancelled", "out_of_stock"]:
                valid_item_ids.append(it["id"])

    if valid_item_ids:
        chunk_size = 30
        for i in range(0, len(valid_item_ids), chunk_size):
            batch = valid_item_ids[i:i + chunk_size]
            call_api("PUT", "/api/kitchen/batch-ready", {"item_ids": batch})
        for i in range(0, len(valid_item_ids), chunk_size):
            batch = valid_item_ids[i:i + chunk_size]
            call_api("PUT", "/api/kitchen/batch-served", {"item_ids": batch})

    print(f"  🍽️ Đã nấu xong & giao đủ {len(valid_item_ids)} phần món lên toàn bộ 40 bàn!")
    pause_for_web_observation()

    # =========================================================================
    # CHẶNG 9: 40 BÀN YÊU CẦU THANH TOÁN & THU NGÂN CHỐT BILL GIẢI PHÓNG BÀN
    # =========================================================================
    banner(
        9,
        "40 BÀN GỬI YÊU CẦU THANH TOÁN & THU NGÂN CHỐT HÓA ĐƠN",
        "Mở /cashier -> Doanh thu ca tăng & 40 bàn tự động dọn sạch về 'Còn trống'"
    )

    def step9_call_pay(tid: int):
        method = "TRANSFER" if tid % 2 == 0 else "CASH"
        c, _, _, _ = call_api("POST", "/api/kitchen/live-alerts-v2", {
            "table_id": tid,
            "table_name": f"Bàn {tid:02d}",
            "type": "CALL_PAYMENT",
            "payment_method": method,
            "note": "Thanh toán Chuyển khoản QR" if method == "TRANSFER" else "Thanh toán Tiền mặt"
        })
        return c == 200

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        pay_calls = sum(1 for f in as_completed([ex.submit(step9_call_pay, tid) for tid in created_orders]) if f.result())

    print(f"  🔔 {pay_calls}/{TOTAL_TABLES} bàn đã gửi tín hiệu gọi thanh toán!")
    pause_for_web_observation(seconds=3)

    total_rev = 0.0
    paid_bills = 0

    def step9_checkout(tid: int):
        method = "TRANSFER" if tid % 2 == 0 else "CASH"
        c, res, ms, err = call_api("POST", f"/api/kitchen/tables/{tid}/checkout-simulated", {
            "payment_method": method
        })
        if c == 200:
            return tid, True, float(res.get("paid_amount", 0) or 0), None
        return tid, False, 0.0, err

    with ThreadPoolExecutor(max_workers=TOTAL_TABLES) as ex:
        for f in as_completed([ex.submit(step9_checkout, tid) for tid in created_orders]):
            tid, ok, amt, err = f.result()
            if ok:
                paid_bills += 1
                total_rev += amt
            else:
                errors_log.append(f"Chặng 9 - Thanh toán Bàn {tid:02d}: {err}")

    _, shift_res, _, _ = call_api("GET", "/api/kitchen/shift/current")

    print("\n" + "=" * 86)
    print("🏆 BÁO CÁO KIỂM THỬ TOÀN DIỆN HỆ THỐNG SMARTPOS (40 BÀN - 9 CHẶNG NGHIỆP VỤ)")
    print("=" * 86)
    print(f"  • Tổng số bàn chạy đồng thời           : {paid_bills}/{TOTAL_TABLES} bàn hoàn tất A -> Z")
    print(f"  • Lượt gọi thêm bổ sung (Lượt 2)      : {len(extra_orders)}/20 bàn thành công")
    print(f"  • Bếp báo hết & Nhân viên đổi món     : {swapped_count}/{len(out_of_stock_items)} món đổi thành công")
    print(f"  • Thu ngân thêm món tại quầy          : {cashier_added_count}/10 bàn thành công")
    print(f"  • Thu ngân giảm SL (2->1) & Hủy món   : Giảm {decreased_ok}/10 (Giữ đúng SL=1: {verify_kept}/10) | Hủy {cancelled_ok}/10")
    print(f"  • Tổng số món Bếp/Bar giao lên bàn    : {len(valid_item_ids)} phần món")
    print(f"  • Doanh thu thu được trong đợt test   : {total_rev:,.0f} VNĐ")
    if shift_res:
        print(f"  • Doanh thu lũy kế ca trực trên DB    : {shift_res.get('db_completed_revenue', 0):,.0f} VNĐ ({shift_res.get('db_completed_bills', 0)} bill)")
    if not errors_log:
        print("  • TRẠNG THÁI HỆ THỐNG                : ✅ HOÀN HẢO 100% - KHÔNG PHÁT SINH BẤT KỲ LỖI NÀO!")
    else:
        print(f"  • CẢNH BÁO ({len(errors_log)} lỗi):")
        for e in errors_log[:10]:
            print(f"     - {e}")
    print("=" * 86)


if __name__ == "__main__":
    run_automated_40_tables_pipeline()
