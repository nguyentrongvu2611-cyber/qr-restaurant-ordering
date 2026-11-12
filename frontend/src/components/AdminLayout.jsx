import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const menuGroups = [
    { path: '/admin/dashboard', label: '1. Tổng quan (Dashboard)', code: 'ADM02' },
    { path: '/admin/menu', label: '2. Quản lý Thực đơn', code: 'ADM03-07' },
    { path: '/admin/tables', label: '3. Quản lý Bàn & Mã QR', code: 'ADM08-10' },
    { path: '/admin/orders', label: '4. Quản lý Đơn hàng', code: 'ADM11' },
    { path: '/admin/users', label: '5. Quản lý Nhân sự', code: 'ADM12-13' },
    { path: '/admin/promotions', label: '6. Khuyến mãi (Voucher)', code: 'ADM14' },
    { path: '/admin/reports', label: '7. Báo cáo & Thống kê', code: 'ADM15-16' },
    { path: '/admin/settings', label: '8. Cài đặt & Hệ thống', code: 'ADM01,17,18' },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="d-flex min-vh-100 bg-light">
      <aside className="bg-dark text-white d-flex flex-column p-3" style={{ width: '270px', flexShrink: 0 }}>
        <div className="border-bottom border-secondary pb-3 mb-3">
          <h5 className="fw-bold text-warning mb-0">QR RESTAURANT</h5>
          <small className="text-secondary">Phân hệ Quản trị (Admin)</small>
        </div>
        <ul className="nav nav-pills flex-column gap-1 mb-auto">
          {menuGroups.map((item) => (
            <li className="nav-item" key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `nav-link d-flex justify-content-between align-items-center ${
                    isActive ? 'active bg-primary fw-bold' : 'text-white-50'
                  }`
                }
              >
                <span style={{ fontSize: '0.92rem' }}>{item.label}</span>
                <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>{item.code}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="border-top border-secondary pt-3 mt-3">
          <div className="small text-white-50 mb-2">
            Đăng nhập: <strong className="text-white">{user.full_name || 'Admin'}</strong>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm w-100">
            Đăng xuất (ADM01)
          </button>
        </div>
      </aside>
      <div className="flex-grow-1 d-flex flex-column">
        <header className="bg-white shadow-sm px-4 py-3 d-flex justify-content-between align-items-center">
          <h5 className="fw-bold text-primary mb-0">{title}</h5>
          <span className="badge bg-primary-subtle text-primary border border-primary">
            Quyền: Quản trị viên (Admin)
          </span>
        </header>
        <main className="p-4 flex-grow-1">{children}</main>
      </div>
    </div>
  );
}
