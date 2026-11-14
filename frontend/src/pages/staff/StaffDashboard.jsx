import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, CheckCircle2, Bell, Utensils,
  QrCode, User, Home, AlertTriangle, Check, BookOpen, LogOut,
  Repeat, Ban, Eye, X
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function StaffDashboard() {
  const [bottomNav, setBottomNav] = useState('HOME'); // 'HOME' | 'MENU' | 'PROFILE'
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'READY' | 'TABLES'
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuProducts, setMenuProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Danh sách tên món bị Bếp báo hết & danh sách dòng order_item bị báo hết
  const [outOfStockNames, setOutOfStockNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'); } catch { return []; }
  });
  const [rejectedItemIds, setRejectedItemIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'); } catch { return []; }
  });
  // Danh sách các món Nhân viên đã bấm "Báo Thu ngân hủy" (đang chờ Thu ngân xác nhận)
  const [requestedCancelIds, setRequestedCancelIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]').map(r => r.item_id); } catch { return []; }
  });

  // Xem chi tiết Order của 1 bàn khi nhân viên bấm vào bàn
  const [viewingTable, setViewingTable] = useState(null);
  // Modal Đổi món cho khách khi món cũ bị hết
  const [swappingItem, setSwappingItem] = useState(null);

  const [serviceRequests, setServiceRequests] = useState([]);
  const [readyToast, setReadyToast] = useState(null);

  const token = localStorage.getItem('access_token');
  const staffName = localStorage.getItem('full_name') || 'Nguyễn Trọng Vũ';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOrders, resTables, resProducts] = await Promise.all([
        fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/tables`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);
      if (resOrders.ok) setOrders(await resOrders.json());
      if (resTables.ok) setTables(await resTables.json());
      if (resProducts && resProducts.ok) setMenuProducts(await resProducts.json());

      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
      setRequestedCancelIds(JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]').map(r => r.item_id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);

    const bc = new BroadcastChannel('smartpos_channel');
    bc.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'KITCHEN_OUT_OF_STOCK' && payload) {
        setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
        setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
        fetchData();
      }
      if (type === 'CASHIER_CONFIRMED_CANCEL' || type === 'TABLE_CANCELLED') {
        fetchData();
      }
      if (type === 'CUSTOMER_CALL_SERVICE' && payload) {
        setServiceRequests(prev => [payload, ...prev]);
      }
    };

    const handleStorageChange = () => {
      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
      setRequestedCancelIds(JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]').map(r => r.item_id));
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      bc.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Kiểm tra 1 dòng món trong đơn có đang bị Bếp báo hết hay không
  const isItemOutOfStock = (item) => {
    const st = String(item.item_status || item.status || '').toLowerCase();
    const name = item.product_name || item.name;
    if (st === 'cancelled' || st === 'served') return false;
    return st === 'out_of_stock' || rejectedItemIds.includes(item.id) || outOfStockNames.includes(name);
  };

  // Tìm TẤT CẢ các món đang bị Bếp báo hết trong các bàn đang hoạt động để hiện cố định trên màn hình Nhân viên
  const outOfStockOrderItems = useMemo(() => {
    const list = [];
    orders.forEach(order => {
      const oStatus = String(order.status).toLowerCase();
      if (['completed', 'cancelled', 'paid'].includes(oStatus)) return;
      const tName = order.table_name || `Bàn 0${order.table_id}`;
      (order.items || order.order_items || []).forEach(item => {
        if (isItemOutOfStock(item)) {
          list.push({
            ...item,
            order_id: order.id,
            order_code: order.order_code || `ORD-${order.id}`,
            table_id: order.table_id,
            table_name: tName
          });
        }
      });
    });
    return list;
  }, [orders, outOfStockNames, rejectedItemIds]);

  // 1. NHÂN VIÊN ĐỔI MÓN MỚI CHO KHÁCH (KHI MÓN CŨ HẾT HÀNG)
  const handleConfirmSwapItem = async (newProduct) => {
    if (!swappingItem) return;
    try {
      await fetch(`${API_BASE}/api/kitchen/items/${swappingItem.id}/swap`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_product_id: newProduct.id })
      });

      // Xóa ID dòng món đó khỏi danh sách rejected để trở lại bình thường với món mới
      const nextRejected = rejectedItemIds.filter(id => id !== swappingItem.id);
      localStorage.setItem('pos_rejected_item_ids', JSON.stringify(nextRejected));
      setRejectedItemIds(nextRejected);

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({
        type: 'STAFF_SWAPPED_ITEM',
        payload: {
          table_name: swappingItem.table_name,
          old_name: swappingItem.product_name || swappingItem.name,
          new_name: newProduct.name
        }
      });
      bc.close();

      setSwappingItem(null);
      await fetchData();
    } catch (e) {
      alert('Lỗi khi đổi món cho khách!');
    }
  };

  // 2. NHÂN VIÊN BẤM "KHÁCH HỦY MÓN" -> GỬI YÊU CẦU CHO THU NGÂN XÁC NHẬN XÓA MÓN
  const handleRequestCashierCancelItem = (item, tableName, orderCode) => {
    const reqObj = {
      req_id: `REQ-${Date.now()}`,
      item_id: item.id,
      order_id: item.order_id,
      order_code: orderCode || `ORD-${item.order_id}`,
      table_name: tableName,
      product_name: item.product_name || item.name,
      quantity: item.quantity || 1,
      price: Number(item.unit_price || item.price || 0),
      staff_name: staffName,
      reason: 'Món hết - Khách yêu cầu hủy món',
      timestamp: Date.now()
    };

    const existing = JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]');
    const updated = [reqObj, ...existing.filter(r => r.item_id !== item.id)];
    localStorage.setItem('pos_staff_cancel_requests', JSON.stringify(updated));
    setRequestedCancelIds(updated.map(r => r.item_id));

    const bc = new BroadcastChannel('smartpos_channel');
    bc.postMessage({ type: 'STAFF_REQUEST_CANCEL_ITEM', payload: reqObj });
    bc.close();
  };

  // Chỉ hiện đơn do Khách quét QR (không hiện đơn do Thu ngân nhập tay)
  const cashierAutoIds = JSON.parse(localStorage.getItem('pos_cashier_confirmed_orders') || '[]');
  const pendingOrders = orders.filter(
    o => String(o.status).toLowerCase() === 'pending' && !cashierAutoIds.includes(o.id)
  );

  // Lọc các món Đã nấu xong (ready) chờ nhân viên bưng ra bàn
  const readyToServeList = [];
  orders.forEach(order => {
    if (['confirmed', 'cooking', 'preparing', 'ready'].includes(String(order.status).toLowerCase())) {
      (order.items || order.order_items || []).forEach(item => {
        const st = String(item.item_status || item.status || '').toLowerCase();
        if (st === 'ready' || st === 'done') {
          readyToServeList.push({
            id: item.id,
            orderId: order.id,
            orderCode: order.order_code || `ORD-${order.id}`,
            tableName: order.table_name || `Bàn 0${order.table_id}`,
            productName: item.product_name || item.name,
            quantity: item.quantity,
            note: item.note
          });
        }
      });
    }
  });

  // Nhân viên bấm "Xác nhận đơn" -> Gọi vào API /api/kitchen/orders/{id}/confirm trong kitchen.py
  const handleConfirmOrder = async (orderId) => {
    try {
      // 1. Gọi API mới trong kitchen.py (cập nhật cả Order lẫn từng dòng OrderItem sang 'confirmed')
      const res = await fetch(`${API_BASE}/api/kitchen/orders/${orderId}/confirm`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fallback nếu cần
      if (!res.ok) {
        await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'confirmed' })
        }).catch(() => null);
      }

      // 2. Đánh dấu đơn đã được duyệt và báo sang màn hình Bếp + Thu ngân ngay lập tức
      const autoConfirmed = JSON.parse(localStorage.getItem('pos_cashier_confirmed_orders') || '[]');
      if (!autoConfirmed.includes(orderId)) {
        autoConfirmed.push(orderId);
        localStorage.setItem('pos_cashier_confirmed_orders', JSON.stringify(autoConfirmed));
      }

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'ORDER_CONFIRMED', payload: { order_id: orderId } });
      bc.close();

      await fetchData();
    } catch (e) {
      alert('Lỗi xác nhận đơn!');
    }
  };

  const handleMarkServed = async (itemId) => {
    try {
      await fetch(`${API_BASE}/api/kitchen/items/${itemId}/served`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const occupiedTablesCount = tables.filter(t => ['occupied', 'busy', 'payment_pending'].includes(t.status)).length;

  // Các món còn hàng để chọn khi Đổi món cho khách
  const availableProductsForSwap = useMemo(() => {
    return menuProducts.filter(
      p => p.is_available !== false && p.is_available !== 0 && !outOfStockNames.includes(p.name)
    );
  }, [menuProducts, outOfStockNames]);

  const renderStaffItemBadge = (it, ord) => {
    if (isItemOutOfStock(it)) {
      return <span className="badge rounded-pill bg-danger text-white px-2.5 py-1">Bếp báo hết</span>;
    }
    let st = String(it.item_status || it.status || '').toLowerCase();
    const ordSt = String(ord?.status || '').toLowerCase();
    if ((!st || st === 'pending') && ['confirmed', 'preparing', 'cooking', 'ready'].includes(ordSt)) {
      st = ordSt;
    }

    if (st === 'served' || st === 'completed') {
      return <span className="badge rounded-pill bg-success text-white px-2.5 py-1">✓ Đã lên món</span>;
    }
    if (st === 'ready' || st === 'done') {
      return <span className="badge rounded-pill bg-info text-dark fw-bold px-2.5 py-1">🔔 Chờ bưng ra bàn</span>;
    }
    if (st === 'preparing' || st === 'cooking') {
      return <span className="badge rounded-pill bg-warning text-dark fw-bold px-2.5 py-1">🔥 Đang chế biến</span>;
    }
    if (st === 'confirmed') {
      return <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary px-2.5 py-1">Đã chuyển Bếp/Bar</span>;
    }
    return <span className="badge rounded-pill bg-secondary text-white px-2.5 py-1">Chờ xác nhận</span>;
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light position-relative" style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '84px' }}>
      
      {/* HEADER NHÂN VIÊN */}
      <div className="p-3 text-white rounded-bottom-4 shadow-sm" style={{ backgroundColor: '#0047ab' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2.5">
            <div className="rounded-circle bg-white text-primary fw-bolder d-flex align-items-center justify-content-center position-relative" style={{ width: '44px', height: '44px', fontSize: '18px' }}>
              {staffName.charAt(0)}
              <span className="position-absolute bottom-0 end-0 rounded-circle bg-success border border-white" style={{ width: '11px', height: '11px' }}></span>
            </div>
            <div>
              <div className="d-flex align-items-center gap-1.5">
                <h6 className="fw-bold mb-0">{staffName}</h6>
                <span className="badge bg-white text-primary rounded-pill" style={{ fontSize: '10px' }}>Staff</span>
              </div>
              <small className="text-white-50" style={{ fontSize: '11.5px' }}>Chỉ xem bàn, xác nhận đơn & đổi món</small>
            </div>
          </div>
          <button onClick={fetchData} className="btn btn-sm text-white p-1.5 rounded-circle">
            <RefreshCw size={18} className={loading ? 'spin-anim' : ''} />
          </button>
        </div>

        <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-25">
          <span className="small text-white-50">Trạng thái làm việc:</span>
          <span className="badge bg-success rounded-pill px-3 py-1.5 d-flex align-items-center gap-1">
            <CheckCircle2 size={13} /> Sẵn sàng
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHUNG CẢNH BÁO CỐ ĐỊNH: MÓN ĐÃ HẾT CẦN BÁO KHÁCH ĐỔI MÓN HOẶC BÁO HỦY */}
      {/* ========================================================================= */}
      {outOfStockOrderItems.length > 0 && (
        <div className="mx-3 mt-3 p-3 rounded-4 bg-danger bg-opacity-10 border border-danger shadow-sm">
          <div className="d-flex align-items-center gap-2 text-danger fw-bolder mb-2" style={{ fontSize: '13.5px' }}>
            <AlertTriangle size={18} />
            <span>MÓN BẾP BÁO HẾT CẦN BÁO KHÁCH ({outOfStockOrderItems.length})</span>
          </div>

          <div className="d-flex flex-column gap-2">
            {outOfStockOrderItems.map(item => {
              const isWaitingCashier = requestedCancelIds.includes(item.id);
              return (
                <div key={item.id} className="bg-white p-2.5 rounded-3 border border-danger shadow-sm">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <span className="badge bg-danger text-white">{item.table_name} • {item.order_code}</span>
                    <span className="text-danger fw-bold small">Hết món</span>
                  </div>
                  <div className="fw-bolder text-dark mb-2" style={{ fontSize: '14.5px' }}>
                    {item.quantity}x {item.product_name || item.name}
                  </div>

                  {isWaitingCashier ? (
                    <div className="p-2 rounded-2 bg-warning bg-opacity-25 text-dark small fw-bold text-center">
                      ⏳ Đã gửi yêu cầu hủy món sang Thu ngân (Chờ Thu ngân xác nhận xóa)
                    </div>
                  ) : (
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => setSwappingItem(item)}
                        className="btn btn-sm btn-primary fw-bold flex-fill rounded-pill d-flex align-items-center justify-content-center gap-1"
                        style={{ fontSize: '12px' }}
                      >
                        <Repeat size={13} /> Đổi món khác
                      </button>
                      <button
                        onClick={() => handleRequestCashierCancelItem(item, item.table_name, item.order_code)}
                        className="btn btn-sm btn-outline-danger fw-bold flex-fill rounded-pill d-flex align-items-center justify-content-center gap-1"
                        style={{ fontSize: '12px' }}
                      >
                        <Ban size={13} /> Khách hủy (Báo Thu ngân)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CẢNH BÁO KHÁCH GỌI NHÂN VIÊN / THANH TOÁN */}
      {serviceRequests.map((req, idx) => (
        <div key={idx} className="mx-3 mt-2 p-2.5 rounded-3 bg-danger text-white shadow d-flex justify-content-between align-items-center">
          <div className="small fw-bold">
            🚨 {req.table_name}: {req.type === 'CALL_PAYMENT' ? 'Yêu cầu thanh toán' : 'Gọi nhân viên hỗ trợ'}!
          </div>
          <button
            onClick={() => setServiceRequests(prev => prev.filter((_, i) => i !== idx))}
            className="btn btn-xs bg-white text-danger fw-bold rounded-pill px-2.5"
          >
            Đã hỗ trợ
          </button>
        </div>
      ))}

      {/* NỘI DUNG TRANG CHỦ */}
      {bottomNav === 'HOME' && (
        <>
          <div className="px-3 mt-3">
            <div className="bg-white p-1.5 rounded-4 shadow-sm d-flex gap-1">
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`btn flex-grow-1 rounded-3 fw-bold py-2 border-0 ${activeTab === 'PENDING' ? 'bg-warning text-dark shadow-sm' : 'text-secondary'}`}
                style={{ fontSize: '13px' }}
              >
                Chờ ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('READY')}
                className={`btn flex-grow-1 rounded-3 fw-bold py-2 border-0 ${activeTab === 'READY' ? 'bg-success text-white shadow-sm' : 'text-secondary'}`}
                style={{ fontSize: '13px' }}
              >
                Bưng món ({readyToServeList.length})
              </button>
              <button
                onClick={() => setActiveTab('TABLES')}
                className={`btn flex-grow-1 rounded-3 fw-bold py-2 border-0 ${activeTab === 'TABLES' ? 'bg-primary text-white shadow-sm' : 'text-secondary'}`}
                style={{ fontSize: '13px' }}
              >
                Bàn ăn ({occupiedTablesCount})
              </button>
            </div>
          </div>

          <div className="p-3 flex-grow-1">
            {/* TAB 1: ĐƠN CHỜ DUYỆT */}
            {activeTab === 'PENDING' && (
              pendingOrders.length === 0 ? (
                <div className="text-center text-muted py-5">Không có đơn nào đang chờ duyệt.</div>
              ) : (
                pendingOrders.map(order => {
                  const items = order.items || order.order_items || [];
                  const total = Number(order.total_amount) || items.reduce((s, i) => s + (Number(i.unit_price || i.price || 0) * Number(i.quantity || 1)), 0);
                  const tName = order.table_name || `Bàn 0${order.table_id}`;

                  return (
                    <div key={order.id} className="card border-0 shadow-sm rounded-4 mb-3 border-start border-warning border-4">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <h5 className="fw-bolder text-dark mb-0">{tName}</h5>
                            <small className="text-muted">Mã đơn: {order.order_code || `ORD-${order.id}`}</small>
                          </div>
                          <span className="badge bg-warning text-dark rounded-pill px-2.5 py-1 fw-bold">Chờ duyệt</span>
                        </div>

                        {items.length > 0 && (
                          <div className="bg-light rounded-3 p-2 mb-2.5">
                            {items.map((it, idx) => {
                              const out = isItemOutOfStock(it);
                              const waitingCancel = requestedCancelIds.includes(it.id);
                              return (
                                <div key={idx} className="py-1 border-bottom last-border-0">
                                  <div className="d-flex justify-content-between align-items-center small">
                                    <span className={`fw-semibold ${out ? 'text-danger text-decoration-line-through' : 'text-dark'}`}>
                                      <b className="text-danger me-1">{it.quantity}x</b> {it.product_name || it.name}
                                      {out && <span className="badge bg-danger ms-1">Bếp báo hết</span>}
                                    </span>
                                    <span className="text-muted">{(Number(it.unit_price || it.price || 0) * Number(it.quantity || 1)).toLocaleString()}đ</span>
                                  </div>

                                  {out && (
                                    <div className="d-flex gap-1.5 mt-1.5">
                                      <button
                                        onClick={() => setSwappingItem({ ...it, table_name: tName, order_id: order.id })}
                                        className="btn btn-xs btn-primary rounded-pill px-2.5 py-0.5 fw-bold"
                                        style={{ fontSize: '11px' }}
                                      >
                                        <Repeat size={11} className="me-1" /> Đổi món
                                      </button>
                                      {waitingCancel ? (
                                        <span className="badge bg-warning text-dark">Chờ Thu ngân xóa</span>
                                      ) : (
                                        <button
                                          onClick={() => handleRequestCashierCancelItem(it, tName, order.order_code)}
                                          className="btn btn-xs btn-outline-danger rounded-pill px-2.5 py-0.5 fw-bold"
                                          style={{ fontSize: '11px' }}
                                        >
                                          <Ban size={11} className="me-1" /> Khách hủy món
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                          <div>
                            <span className="text-muted small">Tổng tiền: </span>
                            <span className="fw-bolder text-primary fs-6">{total.toLocaleString()}đ</span>
                          </div>
                          <button
                            onClick={() => handleConfirmOrder(order.id)}
                            className="btn btn-warning fw-bold rounded-pill px-3.5 py-1.5 shadow-sm"
                            style={{ fontSize: '13px' }}
                          >
                            Xác nhận đơn
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* TAB 2: BƯNG MÓN */}
            {activeTab === 'READY' && (
              readyToServeList.length === 0 ? (
                <div className="text-center text-muted py-5">Chưa có món nào chờ bưng tại Trạm Tiếp Thực.</div>
              ) : (
                readyToServeList.map(item => (
                  <div key={item.id} className="card border-0 shadow-sm rounded-4 mb-2.5 border-start border-success border-4">
                    <div className="card-body p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge bg-primary mb-1">{item.tableName}</span>
                        <div className="fw-bold text-dark fs-6">
                          <span className="text-danger me-1">{item.quantity}x</span> {item.productName}
                        </div>
                        {item.note && <div className="small text-danger fw-semibold">Ghi chú: {item.note}</div>}
                      </div>
                      <button
                        onClick={() => handleMarkServed(item.id)}
                        className="btn btn-success fw-bold rounded-pill px-3 py-2 d-flex align-items-center gap-1"
                      >
                        <Check size={15} /> Đã lên món
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* TAB 3: SƠ ĐỒ BÀN (BẤM VÀO BÀN ĐỂ XEM ORDER CỦA BÀN ĐÓ & ĐỔI MÓN) */}
            {activeTab === 'TABLES' && (
              <div className="row g-2.5">
                {tables.map(t => {
                  const tableOrders = orders.filter(
                    o => (o.table_id === t.id || o.table_name === t.table_number) &&
                    !['completed', 'cancelled', 'paid'].includes(String(o.status).toLowerCase())
                  );
                  const isOccupied = ['occupied', 'busy', 'payment_pending'].includes(t.status) || tableOrders.length > 0;
                  const hasOutItem = tableOrders.some(o => (o.items || o.order_items || []).some(isItemOutOfStock));

                  return (
                    <div key={t.id} className="col-6">
                      <div
                        onClick={() => setViewingTable(t)}
                        className={`p-3 rounded-4 shadow-sm border text-center cursor-pointer position-relative ${
                          hasOutItem
                            ? 'bg-danger bg-opacity-10 border-danger'
                            : isOccupied
                            ? 'bg-primary bg-opacity-10 border-primary'
                            : 'bg-white'
                        }`}
                      >
                        {hasOutItem && (
                          <span className="position-absolute top-0 end-0 m-1.5 badge rounded-pill bg-danger">
                            Có món hết!
                          </span>
                        )}
                        <div className="fw-bold text-dark fs-6">{t.table_number}</div>
                        <span className={`badge rounded-pill mt-1 ${isOccupied ? 'bg-primary' : 'bg-secondary bg-opacity-25 text-secondary'}`}>
                          {isOccupied ? `Xem Order (${tableOrders.length} đơn)` : 'Bàn trống'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB THỰC ĐƠN (CHỈ XEM TRẠNG THÁI CÒN MÓN / TẠM HẾT - KHÔNG CHO NHÂN VIÊN TỰ SỬA) */}
      {bottomNav === 'MENU' && (
        <div className="p-3 flex-grow-1">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold text-dark mb-0">Trạng thái Thực đơn hôm nay</h6>
            <span className="badge bg-light text-secondary border">Chỉ xem (Bếp quản lý)</span>
          </div>
          <div className="d-flex flex-column gap-2">
            {menuProducts.map(p => {
              const avail = p.is_available !== false && p.is_available !== 0 && !outOfStockNames.includes(p.name);
              return (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-3 shadow-sm border d-flex justify-content-between align-items-center ${
                    avail ? 'bg-white' : 'bg-danger bg-opacity-10 border-danger'
                  }`}
                  style={{ opacity: avail ? 1 : 0.7 }}
                >
                  <div>
                    <div className={`fw-bold ${avail ? 'text-dark' : 'text-danger text-decoration-line-through'}`}>{p.name}</div>
                    <small className="text-primary fw-semibold">{Number(p.price || 0).toLocaleString()}đ</small>
                  </div>
                  <span className={`badge rounded-pill px-3 py-1.5 ${avail ? 'bg-success' : 'bg-danger'}`}>
                    {avail ? 'Còn món' : 'Đã hết món'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CÁ NHÂN */}
      {bottomNav === 'PROFILE' && (
        <div className="p-3 flex-grow-1">
          <div className="bg-white p-3 rounded-4 shadow-sm mb-3">
            <div className="fw-bold text-dark">{staffName}</div>
            <div className="small text-muted">Vai trò: Nhân viên phục vụ (Chỉ xem order, xác nhận đơn & đổi món)</div>
          </div>
          <button
            onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            className="btn btn-outline-danger w-100 rounded-3 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      )}

     {/* MODAL XEM CHI TIẾT ORDER CỦA BÀN (CHO NHÂN VIÊN ĐỔI MÓN HOẶC BÁO THU NGÂN HỦY) */}
      {viewingTable && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 2100 }}
          onClick={() => setViewingTable(null)}
        >
          <div className="modal-dialog modal-dialog-centered mx-3" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-primary text-white py-3">
                <h6 className="modal-title fw-bold mb-0">
                  Chi tiết Order • {viewingTable.table_number}
                </h6>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewingTable(null)}
                />
              </div>

              <div className="modal-body p-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {(() => {
                  const tOrders = orders.filter(
                    o =>
                      (o.table_id === viewingTable.id || o.table_name === viewingTable.table_number) &&
                      !['completed', 'cancelled', 'paid'].includes(String(o.status).toLowerCase())
                  );

                  if (tOrders.length === 0) {
                    return (
                      <div className="text-center text-muted py-4">
                        Bàn này hiện chưa có món nào.
                      </div>
                    );
                  }

                  // Các đơn của khách mới quét QR đang chờ nhân viên duyệt
                  const pendingConfirmOrders = tOrders.filter(
                    o => String(o.status).toLowerCase() === 'pending'
                  );

                  // Gom các món trùng tên và cùng trạng thái lại thành 1 dòng gọn gàng
                  const mergedMap = {};
                  tOrders.forEach(ord => {
                    const ordSt = String(ord.status || '').toLowerCase();
                    (ord.items || ord.order_items || []).forEach(it => {
                      const rawSt = String(it.item_status || it.status || '').toLowerCase();
                      if (rawSt === 'cancelled') return;

                      let st = rawSt;
                      if (
                        (!st || st === 'pending') &&
                        ['confirmed', 'preparing', 'cooking', 'ready'].includes(ordSt)
                      ) {
                        st = ordSt;
                      }

                      const out = isItemOutOfStock(it);
                      if (out) st = 'out_of_stock';

                      const name = it.product_name || it.name;
                      const key = out ? `OUT_${it.id}` : `${name}__${st}`;

                      if (!mergedMap[key]) {
                        mergedMap[key] = {
                          ...it,
                          name,
                          quantity: Number(it.quantity || 1),
                          effectiveStatus: st,
                          isOut: out,
                          order_id: ord.id,
                          order_code: ord.order_code || `ORD-${ord.id}`
                        };
                      } else {
                        mergedMap[key].quantity += Number(it.quantity || 1);
                      }
                    });
                  });

                  const mergedList = Object.values(mergedMap);

                  const renderBadgeVN = (st) => {
                    if (st === 'out_of_stock') {
                      return <span className="badge rounded-pill bg-danger text-white px-2.5 py-1">Bếp báo hết</span>;
                    }
                    if (st === 'served' || st === 'completed') {
                      return <span className="badge rounded-pill bg-success text-white px-2.5 py-1">✓ Đã lên món</span>;
                    }
                    if (st === 'ready' || st === 'done') {
                      return <span className="badge rounded-pill bg-info text-dark fw-bold px-2.5 py-1">Chờ tại PASS</span>;
                    }
                    if (st === 'preparing' || st === 'cooking') {
                      return <span className="badge rounded-pill bg-warning text-dark fw-bold px-2.5 py-1">Đang chế biến</span>;
                    }
                    if (st === 'confirmed') {
                      return (
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary px-2.5 py-1">
                          Đã chuyển Bếp/Bar
                        </span>
                      );
                    }
                    return <span className="badge rounded-pill bg-secondary text-white px-2.5 py-1">Chờ xác nhận</span>;
                  };

                  return (
                    <div>
                      {/* Nếu có đơn đang chờ duyệt thì hiện nút duyệt nhanh ở trên cùng */}
                      {pendingConfirmOrders.map(pOrd => (
                        <div
                          key={pOrd.id}
                          className="p-2.5 mb-2.5 rounded-3 bg-warning bg-opacity-10 border border-warning d-flex justify-content-between align-items-center"
                        >
                          <span className="small fw-bold text-dark">
                            Đơn mới: {pOrd.order_code || `ORD-${pOrd.id}`}
                          </span>
                          <button
                            onClick={() => handleConfirmOrder(pOrd.id)}
                            className="btn btn-xs btn-warning fw-bold rounded-pill px-3 py-1"
                          >
                            Xác nhận đơn
                          </button>
                        </div>
                      ))}

                      {/* Danh sách món ăn đã gom gọn của bàn */}
                      <div className="d-flex flex-column gap-2">
                        {mergedList.map((it, idx) => {
                          const waitingCancel = requestedCancelIds.includes(it.id);
                          return (
                            <div
                              key={it.id || idx}
                              className={`p-2.5 rounded-3 border ${
                                it.isOut ? 'bg-danger bg-opacity-10 border-danger' : 'bg-white shadow-xs'
                              }`}
                            >
                              <div className="d-flex justify-content-between align-items-center gap-2">
                                <span
                                  className={`fw-bold ${
                                    it.isOut ? 'text-danger text-decoration-line-through' : 'text-dark'
                                  }`}
                                  style={{ fontSize: '14.5px' }}
                                >
                                  <b className="text-danger me-1.5">{it.quantity}x</b>
                                  {it.name}
                                </span>
                                {renderBadgeVN(it.effectiveStatus)}
                              </div>

                              {it.note && (
                                <div className="small text-muted mt-1">Ghi chú: {it.note}</div>
                              )}

                              {/* Chỉ khi món bị hết, nhân viên mới có nút Đổi món hoặc Báo khách hủy */}
                              {it.isOut && (
                                <div className="d-flex gap-2 mt-2 pt-2 border-top border-danger border-opacity-25">
                                  <button
                                    onClick={() =>
                                      setSwappingItem({
                                        ...it,
                                        table_name: viewingTable.table_number,
                                        order_id: it.order_id
                                      })
                                    }
                                    className="btn btn-xs btn-primary fw-bold flex-fill rounded-pill py-1"
                                  >
                                    🔄 Đổi món khác
                                  </button>
                                  {waitingCancel ? (
                                    <span className="badge bg-warning text-dark d-flex align-items-center px-2">
                                      Đã báo Thu ngân xóa
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleRequestCashierCancelItem(
                                          it,
                                          viewingTable.table_number,
                                          it.order_code
                                        )
                                      }
                                      className="btn btn-xs btn-outline-danger fw-bold flex-fill rounded-pill py-1"
                                    >
                                      🚫 Khách hủy (Báo Thu ngân)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="modal-footer bg-light py-2">
                <button
                  onClick={() => setViewingTable(null)}
                  className="btn btn-sm btn-secondary fw-bold px-4 rounded-pill"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHỌN MÓN MỚI ĐỂ ĐỔI CHO KHÁCH */}
      {swappingItem && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 2500 }} onClick={() => setSwappingItem(null)}>
          <div className="modal-dialog modal-dialog-centered mx-3" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-primary text-white py-3">
                <div>
                  <h6 className="modal-title fw-bold mb-0">Đổi Món Cho Khách • {swappingItem.table_name}</h6>
                  <small className="opacity-75">Món hết: {swappingItem.product_name || swappingItem.name}</small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSwappingItem(null)} />
              </div>
              <div className="modal-body p-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div className="small fw-bold text-muted mb-2">Chọn món còn hàng bên dưới để thay thế:</div>
                <div className="d-flex flex-column gap-2">
                  {availableProductsForSwap.map(prod => (
                    <div key={prod.id} className="p-2.5 rounded-3 border bg-white d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-bold text-dark">{prod.name}</div>
                        <small className="text-primary fw-bold">{Number(prod.price || 0).toLocaleString()}đ</small>
                      </div>
                      <button
                        onClick={() => handleConfirmSwapItem(prod)}
                        className="btn btn-sm btn-success fw-bold rounded-pill px-3"
                      >
                        Chọn đổi
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <div
        className="position-fixed bottom-0 start-50 translate-middle-x w-100 bg-white border-top shadow-lg py-2 px-3 d-flex justify-content-around align-items-center rounded-top-4"
        style={{ maxWidth: '480px', zIndex: 1050 }}
      >
        <button
          onClick={() => setBottomNav('HOME')}
          className={`btn btn-sm border-0 d-flex flex-column align-items-center gap-1 ${bottomNav === 'HOME' ? 'text-primary fw-bold' : 'text-secondary'}`}
        >
          <Home size={20} />
          <span style={{ fontSize: '11px' }}>Trang chủ</span>
        </button>

        <button
          onClick={() => setBottomNav('MENU')}
          className={`btn btn-sm border-0 d-flex flex-column align-items-center gap-1 position-relative ${bottomNav === 'MENU' ? 'text-primary fw-bold' : 'text-secondary'}`}
        >
          <BookOpen size={20} />
          <span style={{ fontSize: '11px' }}>Thực đơn</span>
          {outOfStockNames.length > 0 && (
            <span className="position-absolute top-0 end-0 badge rounded-pill bg-danger" style={{ fontSize: '9px' }}>
              {outOfStockNames.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setBottomNav('HOME')}
          className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow"
          style={{ width: '48px', height: '48px', marginTop: '-18px' }}
        >
          <QrCode size={22} className="text-white" />
        </button>

        <button
          onClick={() => setBottomNav('PROFILE')}
          className={`btn btn-sm border-0 d-flex flex-column align-items-center gap-1 ${bottomNav === 'PROFILE' ? 'text-primary fw-bold' : 'text-secondary'}`}
        >
          <User size={20} />
          <span style={{ fontSize: '11px' }}>Cá nhân</span>
        </button>
      </div>
    </div>
  );
}