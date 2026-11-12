import { useNavigate } from "react-router-dom";

export default function CashierDashboard() {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem("role"); navigate("/login"); };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Quầy Thu Ngân - Quản lý Ca & Thanh toán</h3>
        <button className="btn btn-outline-danger btn-sm" onClick={logout}>Đăng xuất</button>
      </div>
      <div className="alert alert-warning">Khu vực Mở/Chốt ca, duyệt Hủy/Đổi món và chốt hóa đơn thanh toán.</div>
    </div>
  );
}