import React, { useState, useEffect } from 'react';
import {
  Search, Calendar, Download, Eye, Printer, Receipt,
  TrendingUp, ShoppingBag, XCircle, Clock, CheckCircle2, ChefHat
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const ORDER_STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', badge: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' },
  preparing: { label: 'Đang chế biến', badge: 'bg-info-subtle text-info-emphasis border border-info-subtle' },
  served: { label: 'Đã phục vụ', badge: 'bg-primary-subtle text-primary border border-primary-subtle' },
  completed: { label: 'Hoàn tất', badge: 'bg-success-subtle text-success border border-success-subtle' },
  paid: { label: 'Đã thanh toán', badge: 'bg-success-subtle text-success border border-success-subtle' },
  cancelled: { label: 'Đã hủy', badge: 'bg-danger-subtle text-danger border border-danger-subtle' },
};

export default function OrderHistoryPage() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [summary, setSummary] = useState({
    total_orders: 0,
    valid_revenue: 0,
    avg_order_value: 0,
    cancelled_count: 0,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal chi tiết đơn hàng
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const token = localStorage.getItem('access_token');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        status: statusFilter,
        search: searchTerm,
      });
      const res = await fetch(`${API_BASE}/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử đơn hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [startDate, endDate, statusFilter]);

  // Chọn nhanh khoảng thời gian
  const setQuickRange = (daysBack) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysBack);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Xem chi tiết 1 đơn hàng
  const handleViewDetail = async (orderId) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const detail = await res.json();
        setSelectedOrder(detail);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  // Xuất file CSV mở bằng Excel
  const handleExportCsv = () => {
    if (orders.length === 0) {
      alert('Không có dữ liệu đơn hàng để xuất!');
      return;
    }
    const headers = ['Mã Đơn', 'Bàn', 'Số lượng món', 'Tổng tiền (VNĐ)', 'Trạng thái', 'Thời gian tạo', 'Ghi chú'];
    const csvRows = [
      headers.join(','),
      ...orders.map((o) =>
        [
          `"${o.order_code}"`,
          `"${o.table_number}"`,
          o.item_count,
          o.total_amount,
          `"${ORDER_STATUS_MAP[o.status]?.label || o.status}"`,
          `"${o.created_at}"`,
          `"${(o.note || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Lich_Su_Don_Hang_${startDate}_den_${endDate}.csv`;
    link.click();
  };

  // In lại phiếu hóa đơn chi tiết
  const handlePrintReceipt = (order) => {
    const itemsHtml = order.items
      .map(
        (it) => `
        <tr>
          <td style="padding: 6px 0;">${it.product_name} ${it.item_note ? `<br/><small style="color:#666">(${it.item_note})</small>` : ''}</td>
          <td style="text-align:center;">${it.quantity}</td>
          <td style="text-align:right;">${it.subtotal.toLocaleString('vi-VN')}đ</td>
        </tr>
      `
      )
      .join('');

    const win = window.open('', '_blank', 'width=420,height=650');
    win.document.write(`
      <html>
        <head>
          <title>Hóa Đơn ${order.order_code}</title>
          <style>
            body { font-family: monospace; width: 320px; margin: 0 auto; padding: 20px; color: #111; }
            h2 { text-align: center; margin: 0 0 4px 0; }
            .sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; border-top: 1px dashed #333; border-bottom: 1px dashed #333; }
            .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 12px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <h2>SMARTPOS RESTAURANT</h2>
          <div class="sub">PHIẾU CHI TIẾT ĐƠN HÀNG</div>
          <div style="font-size:13px; margin-bottom:10px;">
            <div><b>Mã đơn:</b> ${order.order_code}</div>
            <div><b>Vị trí:</b> ${order.table_number}</div>
            <div><b>Thời gian:</b> ${order.created_at}</div>
          </div>
          <table>
            <thead>
              <tr style="border-bottom:1px solid #ccc;">
                <th style="text-align:left; padding:6px 0;">Món</th>
                <th>SL</th>
                <th style="text-align:right;">Thành tiền</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="total">TỔNG CỘNG: ${order.total_amount.toLocaleString('vi-VN')}đ</div>
          <div style="text-align:center; font-size:12px; margin-top:20px;">Cảm ơn quý khách & Hẹn gặp lại!</div>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="container-fluid px-1">
      {/* 4 THẺ THỐNG KÊ ĐỐI SOÁT */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="p-3 bg-light rounded-4 border d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Tổng đơn hàng</div>
              <div className="fw-bold fs-5 text-dark">{summary.total_orders} đơn</div>
            </div>
            <ShoppingBag size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-success bg-opacity-10 rounded-4 border border-success-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-success small fw-semibold">Doanh thu hợp lệ</div>
              <div className="fw-bold fs-5 text-success">
                {summary.valid_revenue.toLocaleString('vi-VN')}đ
              </div>
            </div>
            <TrendingUp size={22} className="text-success" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-primary bg-opacity-10 rounded-4 border border-primary-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-primary small fw-semibold">Trung bình / Đơn</div>
              <div className="fw-bold fs-5 text-primary">
                {Math.round(summary.avg_order_value).toLocaleString('vi-VN')}đ
              </div>
            </div>
            <Receipt size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-danger bg-opacity-10 rounded-4 border border-danger-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-danger small fw-semibold">Đơn đã hủy</div>
              <div className="fw-bold fs-5 text-danger">{summary.cancelled_count} đơn</div>
            </div>
            <XCircle size={22} className="text-danger" />
          </div>
        </div>
      </div>

      {/* KHUNG BỘ LỌC & BẢNG DỮ LIỆU CHÍNH */}
      <div className="card border shadow-none rounded-4">
        <div className="card-body">
          {/* Thanh công cụ lọc ngày, trạng thái, tìm kiếm & xuất Excel */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-3 border-bottom">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="btn-group btn-group-sm" role="group">
                <button type="button" onClick={() => setQuickRange(0)} className="btn btn-outline-secondary">
                  Hôm nay
                </button>
                <button type="button" onClick={() => setQuickRange(6)} className="btn btn-outline-secondary">
                  7 ngày
                </button>
                <button type="button" onClick={() => setQuickRange(29)} className="btn btn-outline-secondary">
                  30 ngày
                </button>
              </div>

              <div className="d-flex align-items-center gap-1 bg-light px-2 py-1 rounded-3 border">
                <Calendar size={14} className="text-muted" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-control form-control-sm border-0 bg-transparent p-0"
                  style={{ width: '125px' }}
                />
                <span className="text-muted small">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-control form-control-sm border-0 bg-transparent p-0"
                  style={{ width: '125px' }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select form-select-sm bg-light"
                style={{ width: '165px' }}
              >
                <option value="ALL">Trạng thái: Tất cả</option>
                <option value="pending">🟡 Chờ xác nhận</option>
                <option value="preparing">🔵 Đang chế biến</option>
                <option value="served">🟣 Đã phục vụ</option>
                <option value="completed">🟢 Hoàn tất</option>
                <option value="cancelled">🔴 Đã hủy</option>
              </select>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchOrders();
                }}
                className="input-group input-group-sm"
                style={{ width: '220px' }}
              >
                <span className="input-group-text bg-light border-end-0">
                  <Search size={14} className="text-muted" />
                </span>
                <input
                  type="text"
                  placeholder="Mã đơn hoặc số bàn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control bg-light border-start-0"
                />
              </form>

              <button
                type="button"
                onClick={handleExportCsv}
                className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 fw-semibold px-3 rounded-3"
              >
                <Download size={15} /> Xuất Excel (CSV)
              </button>
            </div>
          </div>

          {/* Bảng danh sách đơn hàng */}
          <div className="table-responsive">
            <table className="table table-hover align-middle small mb-0">
              <thead className="table-light">
                <tr>
                  <th>Mã đơn hàng</th>
                  <th>Bàn / Vị trí</th>
                  <th>Số lượng món</th>
                  <th>Tổng thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Thời gian tạo</th>
                  <th className="text-end">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-5">
                      Đang tải dữ liệu đơn hàng từ MySQL...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-5">
                      Không có đơn hàng nào trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const st = ORDER_STATUS_MAP[o.status] || {
                      label: o.status,
                      badge: 'bg-secondary-subtle text-secondary',
                    };
                    return (
                      <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => handleViewDetail(o.id)}>
                        <td className="fw-bold text-primary">{o.order_code || `#${o.id}`}</td>
                        <td>
                          <span className="badge bg-light text-dark border px-2.5 py-1">
                            {o.table_number}
                          </span>
                        </td>
                        <td>{o.item_count} món</td>
                        <td className="fw-bold text-dark">{o.total_amount.toLocaleString('vi-VN')}đ</td>
                        <td>
                          <span className={`badge rounded-pill px-2.5 py-1 ${st.badge}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="text-muted">{o.created_at}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(o.id);
                            }}
                            className="btn btn-sm btn-outline-primary rounded-3 d-inline-flex align-items-center gap-1"
                          >
                            <Eye size={14} /> Xem món
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL CHI TIẾT ĐƠN HÀNG & IN LẠI HÓA ĐƠN */}
      {selectedOrder && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedOrder(null)}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <div>
                  <h6 className="modal-title fw-bold mb-0">
                    Chi Tiết Đơn Hàng — <span className="text-primary">{selectedOrder.order_code}</span>
                  </h6>
                  <small className="text-muted">
                    Vị trí: <b>{selectedOrder.table_number}</b> • Tạo lúc: {selectedOrder.created_at}
                  </small>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelectedOrder(null)} />
              </div>

              <div className="modal-body p-4">
                {/* Danh sách món trong đơn */}
                <h6 className="fw-bold small text-uppercase text-muted mb-2">Danh sách món đã gọi</h6>
                <div className="table-responsive border rounded-3 mb-3">
                  <table className="table table-sm align-middle small mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Tên món</th>
                        <th className="text-center">SL</th>
                        <th className="text-end">Đơn giá</th>
                        <th className="text-end">Thành tiền</th>
                        <th className="text-center">Trạng thái bếp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((it) => (
                        <tr key={it.id}>
                          <td>
                            <div className="fw-semibold">{it.product_name}</div>
                            {it.item_note && (
                              <div className="text-muted" style={{ fontSize: '11px' }}>
                                Ghi chú: {it.item_note}
                              </div>
                            )}
                            {it.cancel_reason && (
                              <div className="text-danger" style={{ fontSize: '11px' }}>
                                Lý do hủy: {it.cancel_reason}
                              </div>
                            )}
                          </td>
                          <td className="text-center fw-bold">x{it.quantity}</td>
                          <td className="text-end">{it.unit_price.toLocaleString('vi-VN')}đ</td>
                          <td className="text-end fw-bold">{it.subtotal.toLocaleString('vi-VN')}đ</td>
                          <td className="text-center">
                            <span className="badge bg-light text-dark border">{it.item_status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tổng kết thanh toán & Lịch sử trạng thái */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded-3 border h-100 small">
                      <div className="fw-bold mb-1">Thông tin thanh toán</div>
                      <div>Hình thức: <b>{selectedOrder.payment.method}</b></div>
                      <div>Trạng thái: <b>{selectedOrder.payment.status}</b></div>
                      {selectedOrder.note && <div className="mt-1 text-muted">Ghi chú đơn: {selectedOrder.note}</div>}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-3 bg-primary bg-opacity-10 rounded-3 border border-primary-subtle h-100 d-flex flex-column justify-content-center align-items-end">
                      <div className="text-muted small">Tổng giá trị đơn hàng</div>
                      <div className="fs-4 fw-bold text-primary">
                        {selectedOrder.total_amount.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top">
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(selectedOrder)}
                  className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3"
                >
                  <Printer size={15} /> In lại phiếu thanh toán
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="btn btn-secondary btn-sm px-3"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}