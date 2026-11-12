import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import AdminMenuPage from './pages/AdminMenuPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminTablesPage from './pages/AdminTablesPage';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

function AdminComingSoon({ title, desc }) {
  return (
    <AdminLayout title={title}>
      <div className="alert alert-info shadow-sm">
        <h5 className="fw-bold">{title}</h5>
        <p className="mb-0">{desc}</p>
      </div>
    </AdminLayout>
  );
}

function PlaceholderRolePage({ title, roleName }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };
  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-dark bg-dark px-4">
        <span className="navbar-brand fw-bold">{title}</span>
        <div className="d-flex align-items-center gap-3 text-white">
          <span>Xin chào, <strong>{user.full_name}</strong> ({roleName})</span>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </nav>
      <div className="container mt-5 text-center">
        <div className="alert alert-info">
          Bạn đang ở khu vực dành riêng cho <strong>{roleName}</strong>. Đã chặn cứng quyền truy cập chéo trang.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthPage />} />

        {/* 8 Nhóm chức năng của ADMIN */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRole="admin"><AdminComingSoon title="1. Tổng quan (Dashboard - ADM02)" desc="Thống kê doanh thu ngày, số đơn, trạng thái bàn." /></ProtectedRoute>} />
        <Route path="/admin/menu" element={<ProtectedRoute allowedRole="admin"><AdminMenuPage /></ProtectedRoute>} />
        <Route path="/admin/tables" element={<ProtectedRoute allowedRole="admin"><AdminTablesPage /></ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute allowedRole="admin"><AdminComingSoon title="4. Quản lý Đơn hàng (ADM11)" desc="Xem danh sách toàn bộ đơn hàng, chi tiết món và hủy đơn khi có sự cố." /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRole="admin"><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/promotions" element={<ProtectedRoute allowedRole="admin"><AdminComingSoon title="6. Quản lý Khuyến mãi / Voucher (ADM14)" desc="Phân hệ mở rộng quản lý mã giảm giá." /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowedRole="admin"><AdminComingSoon title="7. Báo cáo & Thống kê (ADM15 - ADM16)" desc="Biểu đồ doanh thu theo ngày/tháng/năm và Top món bán chạy." /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowedRole="admin"><AdminComingSoon title="8. Cài đặt & Hệ thống (ADM01, ADM17, ADM18)" desc="Đổi mật khẩu Admin, xem lịch sử thao tác và cấu hình tên quán/hotline in hóa đơn." /></ProtectedRoute>} />

        {/* Khu vực BẾP & NHÂN VIÊN */}
        <Route path="/kitchen" element={<ProtectedRoute allowedRole="kitchen"><PlaceholderRolePage title="MÀN HÌNH NHÀ BẾP (KITCHEN)" roleName="Nhân viên Bếp" /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute allowedRole="staff"><PlaceholderRolePage title="MÀN HÌNH PHỤC VỤ & THU NGÂN (STAFF)" roleName="Nhân viên Phục vụ" /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
