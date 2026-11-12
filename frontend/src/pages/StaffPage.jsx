import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';

export default function StaffPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('tables');
  const [shiftInfo, setShiftInfo] = useState({ has_open_shift: false, shift: null });
  const [openingCash, setOpeningCash] = useState('500000');
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');

  const [overview, setOverview] = useState({ tables: [], service_requests: [], orders: [] });
  const [history, setHistory] = useState([]);
  const [billModal, setBillModal] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [moveModal, setMoveModal] = useState(null);
  const [targetTableId, setTargetTableId] = useState('');
  const prevPendingCount = useRef(0);

  const playNotificationBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  };

  const fetchAllData = async () => {
    try {
      const [shiftRes, ovRes, histRes] = await Promise.all([
        api.get('/staff/shift/current'),
        api.get('/staff/overview'),
        api.get('/staff/history'),
      ]);
      setShiftInfo(shiftRes.data);
      setOverview(ovRes.data);
      setHistory(histRes.data);

      const newPendingCount =
        ovRes.data.orders.filter((o) => o.status === 'pending').length +
        ovRes.data.service_requests.length;
      if (newPendingCount > prevPendingCount.current) {
        playNotificationBeep();
      }
      prevPendingCount.current = newPendingCount;
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(fetchAllData, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      await api.post('/staff/shift/open', { opening_cash: Number(openingCash) });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Lỗi mở ca');
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/staff/shift/close', {
        actual_cash: Number(actualCash),
        note: closeNote,
      });
      alert(
        `Đã chốt ca!\nTiền hệ thống: ${res.data.expected_cash.toLocaleString()}đ\nTiền thực tế: ${res.data.actual_cash.toLocaleString()}đ\nChênh lệch: ${res.data.difference.toLocaleString()}đ`
      );
      setActualCash('');
      setCloseNote('');
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Lỗi chốt ca');
    }
  };

  const handleConfirmOrder = async (orderId) => {
    await api.post(`/staff/orders/${orderId}/confirm`);
    fetchAllData();
  };

  const handleRejectOrder = async (orderId) => {
    const reason = window.prompt('Nhập lý do từ chối đơn (Bắt buộc):');
    if (!reason) return;
    await api.post(`/staff/orders/${orderId}/reject`, { reason });
    fetchAllData();
  };

  const handleServeOrder = async (orderId) => {
    await api.post(`/staff/orders/${orderId}/serve`);
    fetchAllData();
  };

  const handleCancelItem = async (itemId, name) => {
    const reason = window.prompt(`Nhập lý do hủy món "${name}" (Lưu Audit Log):`);
    if (!reason) return;
    await api.post(`/staff/order-items/${itemId}/cancel`, { reason });
    fetchAllData();
  };

  const handleResolveReq = async (reqId) => {
    await api.post(`/staff/service-requests/${reqId}/resolve`);
    fetchAllData();
  };

  const handleMoveOrMerge = async (e) => {
    e.preventDefault();
    try {
      const targetTable = overview.tables.find((t) => t.id === Number(targetTableId));
      if (!targetTable) return;
      if (targetTable.status === 'available') {
        await api.post('/staff/tables/transfer', {
          from_session_id: moveModal.active_session_id,
          to_table_id: targetTable.id,
        });
      } else if (targetTable.active_session_id) {
        await api.post('/staff/tables/merge', {
          source_session_id: moveModal.active_session_id,
          target_session_id: targetTable.active_session_id,
        });
      }
      setMoveModal(null);
      setTargetTableId('');
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Lỗi chuyển/gộp bàn');
    }
  };

  const openBill = async (sessionId) => {
    const res = await api.get(`/staff/sessions/${sessionId}/bill`);
    setBillModal(res.data);
  };

  const handlePrintBill = () => {
    if (!billModal) return;
    const win = window.open('', '_blank', 'width=380,height=600');
    const rows = billModal.items
      .map((i) => `<tr><td>${i.product_name} x${i.quantity}</td><td style="text-align:right">${i.line_total.toLocaleString()}đ</td></tr>`)
      .join('');
    win.document.write(`
      <html><body style="font-family:monospace; padding:15px;">
        <h3 style="text-align:center; margin:0;">HÓA ĐƠN THANH TOÁN</h3>
        <p style="text-align:center;">Bàn: <strong>${billModal.table_number}</strong> | Thu ngân: ${user.full_name}</p>
        <hr/><table style="width:100%">${rows}</table><hr/>
        <h3 style="text-align:right">TỔNG: ${billModal.total_amount.toLocaleString()}đ</h3>
        <script>window.onload=function(){window.print();window.close();}</script>
      </body></html>
    `);
    win.document.close();
  };

  const handleCheckout = async () => {
    if (!billModal) return;
    if (!window.confirm(`Xác nhận đã thu ${billModal.total_amount.toLocaleString()}đ và trả bàn?`)) return;
    const res = await api.post(`/staff/sessions/${billModal.session_id}/checkout`, { payment_method: payMethod });
    alert(res.data.message);
    setBillModal(null);
    fetchAllData();
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const pendingOrdersCount = overview.orders.filter((o) => o.status === 'pending').length;
  const readyOrdersCount = overview.orders.filter((o) => o.status === 'ready').length;
  const occupiedCount = overview.tables.filter((t) => t.status === 'occupied').length;

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-dark bg-primary px-4 shadow-sm">
        <div className="d-flex align-items-center gap-3">
          <span className="navbar-brand fw-bold mb-0">NHÂN VIÊN & THU NGÂN (STAFF)</span>
          <button
            className={`btn btn-sm ${activeTab === 'tables' ? 'btn-light text-primary fw-bold' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('tables')}
          >
            Sơ đồ Bàn & Thanh toán ({occupiedCount}/{overview.tables.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'orders' ? 'btn-light text-primary fw-bold' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('orders')}
          >
            Duyệt đơn & Phục vụ{' '}
            {(pendingOrdersCount > 0 || readyOrdersCount > 0) && (
              <span className="badge bg-danger ms-1">{pendingOrdersCount + readyOrdersCount}</span>
            )}
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'shift' ? 'btn-light text-primary fw-bold' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('shift')}
          >
            Ca làm việc & Lịch sử
          </button>
        </div>
        <div className="d-flex align-items-center gap-3 text-white">
          <span className="badge bg-warning text-dark">
            {shiftInfo.has_open_shift ? 'Ca đang mở' : 'Chưa mở ca'}
          </span>
          <span><strong>{user.full_name}</strong></span>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </nav>

      {overview.service_requests.length > 0 && (
        <div className="bg-danger text-white px-4 py-2 d-flex flex-wrap align-items-center gap-3">
          <strong>YÊU CẦU TỪ BÀN:</strong>
          {overview.service_requests.map((r) => (
            <div key={r.id} className="badge bg-white text-danger p-2 d-flex align-items-center gap-2 fs-6">
              <span>
                {r.table_number}: {r.request_type === 'request_bill' ? 'Yêu cầu thanh toán' : 'Gọi nhân viên'}
                {r.note ? ` (${r.note})` : ''}
              </span>
              <button className="btn btn-sm btn-success py-0" onClick={() => handleResolveReq(r.id)}>Đã xử lý</button>
            </div>
          ))}
        </div>
      )}

      <div className="container-fluid p-4">
        {activeTab === 'tables' && (
          <div className="row g-3">
            {overview.tables.map((t) => (
              <div className="col-md-4 col-lg-3" key={t.id}>
                <div className={`card shadow-sm h-100 border-2 ${t.has_request_payment ? 'border-warning bg-warning-subtle' : t.status === 'occupied' ? 'border-danger' : 'border-success'}`}>
                  <div className="card-header d-flex justify-content-between align-items-center bg-white">
                    <span className="fw-bold fs-5">{t.table_number}</span>
                    <span className={`badge ${t.status === 'occupied' ? 'bg-danger' : 'bg-success'}`}>
                      {t.status === 'occupied' ? 'Đang có khách' : 'Bàn trống'}
                    </span>
                  </div>
                  <div className="card-body d-flex flex-column justify-content-between">
                    <div>
                      <div className="small text-muted">Sức chứa: {t.capacity} ghế</div>
                      {t.status === 'occupied' && (
                        <div className="mt-2 fw-bold text-danger fs-5">Tạm tính: {t.session_total.toLocaleString('vi-VN')} đ</div>
                      )}
                      {t.has_request_payment && <div className="badge bg-warning text-dark mt-1">Khách đang gọi tính tiền!</div>}
                    </div>
                    {t.status === 'occupied' && t.active_session_id ? (
                      <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary btn-sm flex-grow-1 fw-bold" onClick={() => openBill(t.active_session_id)}>Xem Bill & Thu tiền</button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setMoveModal(t)}>Chuyển/Gộp</button>
                      </div>
                    ) : (
                      <div className="text-muted small mt-3">Sẵn sàng đón khách quét QR</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="row g-3">
            {overview.orders.map((o) => (
              <div className="col-md-6 col-lg-4" key={o.id}>
                <div className="card shadow-sm h-100">
                  <div className="card-header d-flex justify-content-between align-items-center bg-dark text-white">
                    <span><strong>{o.table_number}</strong> • {o.order_code}</span>
                    <span className={`badge ${o.status === 'pending' ? 'bg-warning text-dark' : o.status === 'ready' ? 'bg-success' : 'bg-info text-dark'}`}>
                      {o.status === 'pending' ? 'Chờ duyệt' : o.status === 'confirmed' ? 'Đã đẩy Bếp' : o.status === 'cooking' ? 'Đang nấu' : 'Chờ bưng (Ready)'}
                    </span>
                  </div>
                  <div className="card-body">
                    <ul className="list-group list-group-flush mb-3">
                      {o.items.map((item) => (
                        <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                          <div className={item.item_status === 'cancelled' ? 'text-decoration-line-through text-muted' : ''}>
                            <strong>{item.product_name}</strong> x{item.quantity}
                            {item.item_note && <div className="small text-danger">Ghi chú: {item.item_note}</div>}
                          </div>
                          {item.item_status !== 'cancelled' && (
                            <button className="btn btn-outline-danger btn-sm py-0" onClick={() => handleCancelItem(item.id, item.product_name)}>Hủy món</button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="d-flex gap-2">
                      {o.status === 'pending' && (
                        <>
                          <button className="btn btn-success flex-grow-1 fw-bold" onClick={() => handleConfirmOrder(o.id)}>Xác nhận đẩy Bếp</button>
                          <button className="btn btn-danger" onClick={() => handleRejectOrder(o.id)}>Từ chối</button>
                        </>
                      )}
                      {o.status === 'ready' && (
                        <button className="btn btn-primary w-100 fw-bold" onClick={() => handleServeOrder(o.id)}>Đã bưng ra bàn (Served)</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {overview.orders.length === 0 && <div className="col-12"><div className="alert alert-secondary text-center">Hiện chưa có đơn hàng nào cần xử lý.</div></div>}
          </div>
        )}

        {activeTab === 'shift' && (
          <div className="row g-4">
            <div className="col-lg-5">
              {!shiftInfo.has_open_shift ? (
                <div className="card shadow-sm">
                  <div className="card-header bg-success text-white fw-bold">Bắt đầu Ca làm việc (Nhập tiền đầu két)</div>
                  <div className="card-body">
                    <form onSubmit={handleOpenShift}>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Số tiền mặt ban đầu (VNĐ)</label>
                        <input type="number" className="form-control" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} required />
                      </div>
                      <button type="submit" className="btn btn-success w-100 fw-bold">XÁC NHẬN MỞ CA</button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="card shadow-sm">
                  <div className="card-header bg-warning text-dark fw-bold">Đối soát & Chốt ca Thu ngân</div>
                  <div className="card-body">
                    <ul className="list-group mb-3">
                      <li className="list-group-item d-flex justify-content-between"><span>Tiền đầu ca:</span><strong>{shiftInfo.shift.opening_cash.toLocaleString()} đ</strong></li>
                      <li className="list-group-item d-flex justify-content-between"><span>Thu tiền mặt trong ca:</span><strong className="text-success">+{shiftInfo.shift.cash_sales.toLocaleString()} đ</strong></li>
                      <li className="list-group-item d-flex justify-content-between bg-light"><span>Tổng dự kiến trong két:</span><strong className="text-primary">{shiftInfo.shift.expected_cash.toLocaleString()} đ</strong></li>
                    </ul>
                    <form onSubmit={handleCloseShift}>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Tiền thực tế đếm được (VNĐ)</label>
                        <input type="number" className="form-control" value={actualCash} onChange={(e) => setActualCash(e.target.value)} required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Ghi chú chênh lệch</label>
                        <input type="text" className="form-control" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
                      </div>
                      <button type="submit" className="btn btn-danger w-100 fw-bold">CHỐT CA & BÁO CÁO ADMIN</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
            <div className="col-lg-7">
              <div className="card shadow-sm">
                <div className="card-header bg-dark text-white fw-bold">Lịch sử Hóa đơn đã thanh toán (STF12)</div>
                <div className="card-body table-responsive">
                  <table className="table table-bordered align-middle mb-0">
                    <thead className="table-light"><tr><th>Mã GD</th><th>Bàn</th><th>Số tiền</th><th>Hình thức</th><th>Thời gian</th></tr></thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>#{h.id}</td><td className="fw-bold">{h.table_number}</td><td className="text-success fw-bold">{h.amount.toLocaleString()} đ</td>
                          <td>{h.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản QR'}</td><td>{new Date(h.paid_at).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {billModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog"><div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title fw-bold">Hóa đơn - {billModal.table_number}</h5>
              <button className="btn-close btn-close-white" onClick={() => setBillModal(null)}></button>
            </div>
            <div className="modal-body">
              <table className="table table-sm">
                <thead><tr><th>Món</th><th className="text-center">SL</th><th className="text-end">Thành tiền</th></tr></thead>
                <tbody>
                  {billModal.items.map((it, idx) => (
                    <tr key={idx}><td>{it.product_name}</td><td className="text-center">{it.quantity}</td><td className="text-end">{it.line_total.toLocaleString()} đ</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="d-flex justify-content-between fs-5 fw-bold text-danger border-top pt-2">
                <span>TỔNG CỘNG:</span><span>{billModal.total_amount.toLocaleString()} đ</span>
              </div>
              <div className="mt-3">
                <label className="form-label fw-semibold">Hình thức thanh toán:</label>
                <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer_qr">Chuyển khoản QR</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={handlePrintBill}>In hóa đơn (STF11)</button>
              <button className="btn btn-success fw-bold" onClick={handleCheckout}>Xác nhận Thanh toán & Trả bàn</button>
            </div>
          </div></div>
        </div>
      )}

      {moveModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog"><form onSubmit={handleMoveOrMerge} className="modal-content">
            <div className="modal-header bg-dark text-white">
              <h5 className="modal-title">Chuyển / Gộp bàn từ {moveModal.table_number}</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setMoveModal(null)}></button>
            </div>
            <div className="modal-body">
              <select className="form-select" value={targetTableId} onChange={(e) => setTargetTableId(e.target.value)} required>
                <option value="">-- Chọn bàn đích --</option>
                {overview.tables.filter((t) => t.id !== moveModal.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.table_number} ({t.status === 'available' ? 'Trống -> Chuyển bàn' : 'Có khách -> Gộp bàn'})</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setMoveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary fw-bold">Thực hiện</button>
            </div>
          </form></div>
        </div>
      )}
    </div>
  );
}
