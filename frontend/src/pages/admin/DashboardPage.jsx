import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, UtensilsCrossed, QrCode, Receipt, Users,
  LogOut, DollarSign, ShoppingBag,
  Armchair, UserCheck, Menu, RefreshCw, Calendar, CreditCard
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import ManageStaffPage from './ManageStaffPage';
import ManageMenuPage from './ManageMenuPage';
import ManageTablesPage from './ManageTablesPage';
import OrderHistoryPage from './OrderHistoryPage';
import PaymentConfigPage from './PaymentConfigPage';

const API_BASE = 'http://127.0.0.1:8000';

// Hàm lấy chuỗi YYYY-MM-DD theo giờ địa phương
const formatDateLocal = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function DashboardPage() {
  const todayStr = formatDateLocal(new Date());

  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // State bộ lọc khoảng ngày
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [quickPreset, setQuickPreset] = useState('today');

  const [stats, setStats] = useState({
    kpis: {
      today_revenue: 0,
      today_orders: 0,
      occupied_tables: 0,
      total_tables: 0,
      active_staff: 0,
    },
    daily_revenue: [],
    category_ratio: [],
    recent_orders: [],
  });

  const token = localStorage.getItem('access_token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{"full_name":"Quản Trị Viên Hệ Thống"}');

  const fetchDashboardData = async (sDate = startDate, eDate = endDate) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: sDate,
        end_date: eDate,
      });
      const res = await fetch(`${API_BASE}/api/admin/dashboard-stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(startDate, endDate);
  }, [startDate, endDate]);

  // Xử lý chọn nhanh mốc thời gian
  const applyPreset = (type) => {
    setQuickPreset(type);
    const now = new Date();
    if (type === 'today') {
      const t = formatDateLocal(now);
      setStartDate(t);
      setEndDate(t);
    } else if (type === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = formatDateLocal(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === '7days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setStartDate(formatDateLocal(past));
      setEndDate(formatDateLocal(now));
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const formatDisplayRange = () => {
    const [sy, sm, sd] = startDate.split('-');
    const [ey, em, ed] = endDate.split('-');
    if (startDate === endDate) return `Ngày ${sd}/${sm}/${sy}`;
    return `Từ ${sd}/${sm}/${sy} đến ${ed}/${em}/${ey}`;
  };

  const menuItems = [
    { id: 'overview', label: 'Tổng quan Dashboard', icon: LayoutDashboard },
    { id: 'menu', label: 'Quản lý Thực đơn', icon: UtensilsCrossed },
    { id: 'tables', label: 'Sơ đồ Bàn & Mã QR', icon: QrCode },
    { id: 'orders', label: 'Lịch sử Đơn hàng', icon: Receipt, count: stats.recent_orders.length },
    { id: 'staff', label: 'Nhân sự & Phân quyền', icon: Users, count: stats.kpis.active_staff },
    { id: 'payment_qr', label: 'Cấu hình Thanh toán', icon: CreditCard },
  ];

  return (
    <div className="d-flex min-vh-100 bg-light">
      {/* SIDEBAR BÊN TRÁI */}
      <aside
  className="bg-white border-end d-flex flex-column justify-content-between"
  style={{
    width: '265px',
    minWidth: '265px',
    height: '100vh',         /* Chiều cao cố định bằng 100% khung nhìn màn hình */
    position: 'sticky',      /* Ghim cứng vị trí */
    top: 0,                  /* Dính sát mép trên */
    flexShrink: 0,
  }}
>
        <div>
          <div className="d-flex align-items-center justify-content-between px-3 border-bottom" style={{ height: '64px' }}>
            <div className="d-flex align-items-center gap-2">
              <div className="bg-primary text-white fw-bold rounded-3 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                QR
              </div>
              {!sidebarCollapsed && <span className="fw-bold fs-5 text-dark">SmartPOS</span>}
            </div>
            <button className="btn btn-sm btn-light border-0" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Menu size={18} />
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="m-3 p-3 bg-light rounded-3 border d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                AD
              </div>
              <div className="overflow-hidden">
                <div className="fw-semibold text-truncate small">{currentUser.full_name}</div>
                <div className="text-muted" style={{ fontSize: '12px' }}>Quản trị viên (Admin)</div>
              </div>
            </div>
          )}

          <div className="px-2 mt-3">
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-uppercase text-muted fw-semibold" style={{ fontSize: '11px' }}>
                Điều hướng chính
              </div>
            )}
            <div className="nav flex-column gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`btn d-flex align-items-center justify-content-between px-3 py-2 text-start border-0 rounded-3 ${
                      isActive ? 'bg-primary bg-opacity-10 text-primary fw-semibold' : 'text-secondary'
                    }`}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <Icon size={18} />
                      {!sidebarCollapsed && <span className="small">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && item.count > 0 && (
                      <span className="badge rounded-pill bg-primary">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-3 border-top bg-white">
    <button
      onClick={handleLogout}
      className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold rounded-3"
    >
            <LogOut size={17} /> Đăng xuất
    </button>
  </div>
</aside>

      {/* VÙNG NỘI DUNG BÊN PHẢI */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        <header className="bg-white border-bottom px-4 d-flex align-items-center justify-content-between" style={{ height: '64px' }}>
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">
              {menuItems.find((m) => m.id === activeTab)?.label}
            </h6>
            <button onClick={() => fetchDashboardData()} className="btn btn-sm btn-light border ms-2" title="Làm mới dữ liệu từ MySQL">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="d-flex align-items-center gap-3">
            <span className="small text-muted">
              Xin chào, <strong className="text-dark">{currentUser.full_name}</strong>
            </span>
          </div>
        </header>

        <main className="flex-grow-1 p-4" style={{ minWidth: 0 }}>
          {/* TAB 1: TỔNG QUAN DỮ LIỆU THẬT */}
          {activeTab === 'overview' && (
            <>
              {/* THANH BỘ LỌC DOANH THU THEO NGÀY / KHOẢNG NGÀY */}
              <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="fw-bold small text-dark">Tra soát doanh thu: {formatDisplayRange()}</div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>Chọn nhanh mốc thời gian hoặc lọc theo khoảng ngày tùy ý</div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        onClick={() => applyPreset('today')}
                        className={`btn ${quickPreset === 'today' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      >
                        Hôm nay
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('yesterday')}
                        className={`btn ${quickPreset === 'yesterday' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      >
                        Hôm qua
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('7days')}
                        className={`btn ${quickPreset === '7days' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      >
                        7 ngày qua
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-2 bg-light px-2 py-1 rounded-3 border">
                      <span className="small text-muted">Từ:</span>
                      <input
                        type="date"
                        value={startDate}
                        max={todayStr}
                        onChange={(e) => {
                          setQuickPreset('custom');
                          setStartDate(e.target.value);
                          if (e.target.value > endDate) setEndDate(e.target.value);
                        }}
                        className="form-control form-control-sm border-0 bg-transparent"
                        style={{ width: '135px' }}
                      />
                      <span className="small text-muted">Đến:</span>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        max={todayStr}
                        onChange={(e) => {
                          setQuickPreset('custom');
                          setEndDate(e.target.value);
                        }}
                        className="form-control form-control-sm border-0 bg-transparent"
                        style={{ width: '135px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 THẺ KPI */}
              <div className="row g-3 mb-4">
                {[
                  {
                    title: startDate === endDate ? `Doanh thu (${startDate.split('-').reverse().join('/')})` : 'Tổng doanh thu kỳ chọn',
                    value: `${stats.kpis.today_revenue.toLocaleString('vi-VN')}đ`,
                    badge: formatDisplayRange(),
                    color: '#0d6efd',
                    icon: DollarSign,
                  },
                  {
                    title: 'Số đơn hàng phát sinh',
                    value: `${stats.kpis.today_orders} đơn`,
                    badge: 'Theo ngày lọc',
                    color: '#198754',
                    icon: ShoppingBag,
                  },
                  {
                    title: 'Bàn đang phục vụ (Hiện tại)',
                    value: `${stats.kpis.occupied_tables} / ${stats.kpis.total_tables} bàn`,
                    badge: stats.kpis.total_tables > 0 ? `${Math.round((stats.kpis.occupied_tables / stats.kpis.total_tables) * 100)}% công suất` : '0%',
                    color: '#ffc107',
                    icon: Armchair,
                  },
                  {
                    title: 'Nhân sự hoạt động',
                    value: `${stats.kpis.active_staff} tài khoản`,
                    badge: 'Đang mở',
                    color: '#6610f2',
                    icon: UserCheck,
                  },
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div className="col-12 col-md-6 col-xl-3" key={idx}>
                      <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div className="p-2 rounded-3 bg-light">
                              <Icon size={18} style={{ color: kpi.color }} />
                            </div>
                            <span className="badge bg-primary-subtle text-primary text-truncate" style={{ maxWidth: '140px' }}>{kpi.badge}</span>
                          </div>
                          <div style={{ height: '48px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={stats.daily_revenue.length ? stats.daily_revenue : [{ doanhThu: 0 }]}>
                                <Area type="monotone" dataKey="doanhThu" stroke={kpi.color} fill={kpi.color} fillOpacity={0.15} strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <h5 className="fw-bold mb-0 mt-2">{kpi.value}</h5>
                          <small className="text-muted">{kpi.title}</small>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BIỂU ĐỒ */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body d-flex flex-column justify-content-between">
                      <h6 className="fw-bold mb-2">Doanh thu theo Danh mục</h6>
                      {stats.category_ratio.length === 0 ? (
                        <div className="text-center text-muted small my-auto py-5">
                          Chưa có dữ liệu gọi món trong khoảng ngày đã chọn
                        </div>
                      ) : (
                        <>
                          <div style={{ height: '210px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={stats.category_ratio} innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                  {stats.category_ratio.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v) => `${v.toLocaleString('vi-VN')}đ`} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="border-top pt-2">
                            {stats.category_ratio.map((c, i) => (
                              <div key={i} className="d-flex justify-content-between small mb-1">
                                <span className="text-secondary">
                                  <span className="d-inline-block rounded-circle me-2" style={{ width: '9px', height: '9px', backgroundColor: c.color }}></span>
                                  {c.name}
                                </span>
                                <span className="fw-semibold">{c.value.toLocaleString('vi-VN')}đ</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-8">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <h6 className="fw-bold mb-1">Biểu đồ Doanh thu theo từng ngày</h6>
                      <small className="text-muted d-block mb-3">{formatDisplayRange()}</small>
                      <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.daily_revenue}>
                            <XAxis dataKey="day" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                            <Tooltip formatter={(val) => `${val.toLocaleString('vi-VN')}đ`} />
                            <Bar dataKey="doanhThu" name="Doanh thu" fill="#0d6efd" radius={[6, 6, 0, 0]} barSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DANH SÁCH ĐƠN HÀNG TRONG KHOẢNG NGÀY ĐÃ CHỌN */}
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0">Danh sách đơn hàng ({formatDisplayRange()})</h6>
                    <span className="badge bg-light text-dark border">{stats.recent_orders.length} đơn</span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle small mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Mã đơn</th>
                          <th>Bàn</th>
                          <th>Tổng tiền</th>
                          <th>Trạng thái</th>
                          <th>Thời gian tạo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recent_orders.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted py-4">
                              Không có đơn hàng nào trong {formatDisplayRange().toLowerCase()}
                            </td>
                          </tr>
                        ) : (
                          stats.recent_orders.map((o) => (
                            <tr key={o.id}>
                              <td className="fw-semibold">#{o.id}</td>
                              <td>Bàn {o.table_id}</td>
                              <td className="fw-bold text-primary">{o.total_amount.toLocaleString('vi-VN')}đ</td>
                              <td><span className="badge bg-info-subtle text-info">{o.status}</span></td>
                              <td className="text-muted">{o.created_at}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: QUẢN LÝ THỰC ĐƠN */}
          {activeTab === 'menu' && (
            <div className="bg-white rounded-4 shadow-sm p-3">
              <ManageMenuPage />
            </div>
          )}

          {/* TAB 3: QUẢN LÝ BÀN & QR */}
          {activeTab === 'tables' && (
            <div className="bg-white rounded-4 shadow-sm p-3">
              <ManageTablesPage />
            </div>
          )}

          {/* TAB 4: LỊCH SỬ ĐƠN HÀNG */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-4 shadow-sm p-3">
              <OrderHistoryPage />
            </div>
          )}

          {/* TAB 5: QUẢN LÝ NHÂN SỰ */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-4 shadow-sm p-3">
              <ManageStaffPage />
            </div>
          )}
          {/* TAB 6: CẤU HÌNH THANH TOÁN (QR CHÍNH & PHỤ) */}
          {activeTab === 'payment_qr' && (
            <div className="bg-white rounded-4 shadow-sm p-3">
              <PaymentConfigPage />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}