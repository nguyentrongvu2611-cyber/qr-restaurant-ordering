import { useNavigate } from "react-router-dom";

export default function StaffMap() {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem("role"); navigate("/login"); };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Sơ đồ bàn - Nhân viên Phục vụ</h3>
        <button className="btn btn-outline-danger btn-sm" onClick={logout}>Đăng xuất</button>
      </div>
      <div className="alert alert-success">Khu vực quản lý sơ đồ bàn, xác nhận đơn QR và gửi yêu cầu thanh toán.</div>
    </div>
  );
}