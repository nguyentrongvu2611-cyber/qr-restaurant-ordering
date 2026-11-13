import React, { useState, useEffect } from 'react';
import {
  ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw,
  LogOut, ArrowRight, Bell, X, UtensilsCrossed
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function KitchenDashboard() {
  // --- STATE ĐIỀU HƯỚNG MÀN HÌNH ---
  const [viewMode, setViewMode] = useState('MAIN'); // 'MAIN' | 'EXPEDITER'

  // --- STATE DỮ LIỆU THẬT ---
  const [orders, setOrders] = useState([]); // Chứa danh sách đơn hàng thật
  const [readyItems, setReadyItems] = useState([]); // Chứa các món đã nấu xong
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('access_token');

    // --- HÀM GỌI API THẬT ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Gọi API lấy danh sách đơn hàng từ Backend
      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // 1. LẤY DỮ LIỆU TỪ API (Dòng này đang bị thiếu gây ra lỗi)
        const data = await res.json(); 
        
        // 2. Lọc các đơn ĐÃ ĐƯỢC NHÂN VIÊN DUYỆT
        const activeOrders = data.filter(o => 
          o.status === 'confirmed' || o.status === 'cooking'
        );

        setOrders(activeOrders);

        // 3. Gom các món đã nấu xong (Ready) sang màn hình Tiếp thực
        const readyList = [];
        activeOrders.forEach(order => {
          const items = order.items || order.order_items || [];
          items.forEach(item => {
            // Kiểm tra nếu món đã xong
            if (item.item_status === 'ready') {
              readyList.push({
                id: item.id,
                orderId: order.id,
                tableName: order.table_name || `Bàn #${order.table_id}`,
                name: item.product_name,
                qty: item.quantity,
                readyTime: 'Vừa xong'
              });
            }
          });
        });
        setReadyItems(readyList);
      } else {
        setError("Không thể tải dữ liệu từ Backend.");
      }
    } catch (err) {
      console.error("Lỗi API:", err);
      setError("Lỗi kết nối đến server Backend.");
    } finally {
      setLoading(false);
    }
  };

  // Tự động gọi API khi mở trang và cứ 5 giây cập nhật 1 lần
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- XỬ LÝ CẬP NHẬT TRẠNG THÁI MÓN ---
  const handleItemDone = async (orderId, itemId, tableName, itemName, qty) => {
    try {
      // Gọi API báo món đã xong
      await fetch(`${API_BASE}/api/kitchen/items/${itemId}/done`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      
      // Load lại data để cập nhật giao diện
      fetchData(); 
    } catch (err) {
      alert("Lỗi khi cập nhật trạng thái món!");
    }
  };

  const handleHandover = (readyItemId) => {
    // Xóa món khỏi màn hình chờ giao (Thực tế nên gọi API xác nhận)
    setReadyItems(readyItems.filter(item => item.id !== readyItemId));
  };

  // --- LOGIC PHÂN BỔ HÀNG ĐỢI (FIFO) ---
  // Chỉ lấy tối đa 5 đơn hàng đầu tiên (hoặc tối đa 7 phiếu tùy bạn cài đặt)
  const displayOrders = orders.slice(0, 7); 

  return (
    <div className="vh-100 d-flex flex-column" style={{ backgroundColor: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ========================================== */}
      {/* HEADER ĐIỀU HƯỚNG */}
      {/* ========================================== */}
      <header className="bg-dark text-white px-3 py-2 d-flex justify-content-between align-items-center shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <div className="bg-danger p-1.5 rounded shadow-sm">
            <ChefHat size={20} />
          </div>
          <div>
            <h6 className="mb-0 fw-bold">Hệ Thống Nhà Bếp</h6>
            <div className="text-white-50" style={{ fontSize: '11px' }}>
              {loading ? 'Đang đồng bộ...' : 'Realtime Connected'}
            </div>
          </div>
        </div>

        {/* Nút chuyển đổi Màn hình */}
        <div className="d-flex bg-secondary bg-opacity-25 rounded-pill p-1">
          <button 
            onClick={() => setViewMode('MAIN')}
            className={`btn btn-sm rounded-pill px-3 fw-bold border-0 ${viewMode === 'MAIN' ? 'bg-white text-dark shadow-sm' : 'text-white-50 bg-transparent'}`}
            style={{ fontSize: '13px' }}
          >
            Màn hình Bếp
          </button>
          <button 
            onClick={() => setViewMode('EXPEDITER')}
            className={`btn btn-sm rounded-pill px-3 fw-bold border-0 position-relative ${viewMode === 'EXPEDITER' ? 'bg-white text-dark shadow-sm' : 'text-white-50 bg-transparent'}`}
            style={{ fontSize: '13px' }}
          >
            Trạm Tiếp Thực
            {readyItems.length > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light">
                {readyItems.length}
              </span>
            )}
          </button>
        </div>

        <div className="d-flex gap-2 align-items-center">
          <button onClick={fetchData} className="btn btn-outline-light btn-sm rounded-circle p-2" title="Làm mới">
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
          <button className="btn btn-danger btn-sm px-2 rounded-2 fw-bold" style={{ fontSize: '12px' }}>
            <LogOut size={14} className="me-1"/> Thoát
          </button>
        </div>
      </header>

      {/* ========================================== */}
      {/* NỘI DUNG CHÍNH */}
      {/* ========================================== */}
      <div className="flex-grow-1 p-2 overflow-hidden d-flex flex-column">
        
        {error && (
          <div className="alert alert-danger py-2 mb-2">{error}</div>
        )}

        {/* ------------------------------------------ */}
        {/* CHẾ ĐỘ 1: MÀN HÌNH CHÍNH (DÀNH CHO ĐẦU BẾP) */}
        {/* ------------------------------------------ */}
        {viewMode === 'MAIN' && (
          <>
            <div className="alert alert-info border-0 shadow-sm rounded-2 d-flex align-items-center gap-2 mb-2 py-1 px-3">
              <AlertCircle size={16} />
              <span className="fw-semibold" style={{ fontSize: '13px' }}>Quy tắc FIFO: Ưu tiên phiếu cũ nhất. Giới hạn hiển thị tối đa 7 phiếu.</span>
            </div>

            {/* LƯỚI HIỂN THỊ PHIẾU (Tự động chia cột, thu nhỏ kích thước) */}
            <div className="row g-2 overflow-auto align-content-start pb-3" style={{ flex: 1 }}>
              {displayOrders.length === 0 && !loading ? (
                <div className="col-12 text-center py-5 mt-5 text-muted">
                  <CheckCircle2 size={64} className="text-success mb-3 opacity-25" />
                  <h5 className="fw-bold">Không có đơn hàng nào</h5>
                  <p>Hiện tại chưa có khách nào gọi món.</p>
                </div>
              ) : (
                displayOrders.map((order) => {
                  const items = order.items || order.order_items || [];
                  // Tính thời gian chờ (nếu API không trả về, mặc định 5 phút)
                  const timeElapsed = order.time_elapsed || 5; 
                  const isWarning = timeElapsed > 15;

                  return (
                    <div key={order.id} className="col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2">
                      <div className={`card border-0 shadow-sm rounded-3 h-100 ${isWarning ? 'border-start border-danger border-4' : 'border-start border-warning border-4'}`}>
                        
                        {/* Card Header */}
                        <div className="card-header bg-white border-0 py-1.5 px-2 d-flex justify-content-between align-items-center">
                          <div className="text-truncate" style={{ maxWidth: '70%' }}>
                            <h6 className="fw-bold mb-0 text-dark text-truncate" style={{ fontSize: '14px' }}>
                              {order.table_name || `Bàn #${order.table_id}`}
                            </h6>
                          </div>
                          <div className={`badge d-flex align-items-center gap-1 ${isWarning ? 'bg-danger' : 'bg-warning text-dark'}`} style={{ fontSize: '10px' }}>
                            <Clock size={10} /> {timeElapsed}p
                          </div>
                        </div>

                        {/* Danh sách món (Thu nhỏ font, padding) */}
                        <div className="card-body p-1 overflow-auto" style={{ maxHeight: '220px' }}>
                          {items.length === 0 ? (
                             <div className="text-muted text-center small py-2">Không có món</div>
                          ) : (
                            items.map(item => (
                              <div key={item.id} className={`d-flex justify-content-between align-items-center p-1 mb-1 rounded-2 ${item.item_status === 'ready' ? 'bg-success bg-opacity-10 opacity-50' : 'bg-light'}`}>
                                <div className="text-truncate" style={{ maxWidth: '70%' }}>
                                  <div className="fw-bold text-dark text-truncate" style={{ fontSize: '12px' }}>
                                    <span className="text-danger me-1">{item.quantity}x</span> 
                                    {item.product_name}
                                  </div>
                                  {item.note && <div className="text-warning fw-semibold text-truncate" style={{ fontSize: '10px' }}>* {item.note}</div>}
                                </div>
                                {item.item_status === 'ready' ? (
                                  <CheckCircle2 className="text-success flex-shrink-0" size={16} />
                                ) : (
                                  <button 
                                    onClick={() => handleItemDone(order.id, item.id, order.table_name, item.product_name, item.quantity)}
                                    className="btn btn-sm btn-outline-success rounded-pill fw-bold px-2 py-0 flex-shrink-0"
                                    style={{ fontSize: '11px' }}
                                  >
                                    Xong
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Nút báo hết (Thu nhỏ) */}
                        <div className="card-footer bg-white border-0 p-1">
                          <button className="btn btn-outline-danger w-100 rounded-2 fw-bold py-0" style={{ fontSize: '11px' }}>
                            <X size={12} className="me-1" /> Hết món
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ------------------------------------------ */}
        {/* CHẾ ĐỘ 2: MÀN HÌNH PHỤ (TRẠM TIẾP THỰC) */}
        {/* ------------------------------------------ */}
        {viewMode === 'EXPEDITER' && (
          <div className="w-100 d-flex flex-column h-100">
            <div className="alert alert-success border-0 shadow-sm rounded-2 d-flex align-items-center gap-2 mb-2 py-1 px-3">
              <Bell size={16} />
              <span className="fw-semibold" style={{ fontSize: '13px' }}>Món đã chín. Bấm "Bàn giao" để nhân viên bưng ra bàn.</span>
            </div>

            <div className="row g-2 overflow-auto align-content-start pb-3" style={{ flex: 1 }}>
              {readyItems.length === 0 ? (
                <div className="col-12 text-center py-5 mt-5 text-muted">
                  <CheckCircle2 size={64} className="text-success mb-3 opacity-25" />
                  <h5 className="fw-bold">Trạm giao nhận trống</h5>
                  <p>Đang chờ Bếp nấu các món tiếp theo.</p>
                </div>
              ) : (
                readyItems.map(item => (
                  <div key={item.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-3 bg-white border-start border-success border-4 animate__animated animate__fadeInUp">
                      <div className="card-body p-2 d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span className="badge bg-primary mb-1" style={{ fontSize: '11px' }}>{item.tableName}</span>
                            <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '14px' }}>
                              <span className="text-danger me-1">{item.qty}x</span> 
                              {item.name}
                            </h6>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleHandover(item.id)}
                          className="btn btn-success w-100 py-1.5 mt-auto rounded-2 fw-bold shadow-sm d-flex justify-content-center align-items-center gap-1"
                          style={{ fontSize: '12px' }}
                        >
                          <ArrowRight size={14} /> BÀN GIAO
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}