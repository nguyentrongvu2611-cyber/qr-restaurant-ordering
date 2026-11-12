import { useNavigate } from "react-router-dom";

export default function BarScreen() {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem("role"); navigate("/login"); };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Màn hình Quầy Bar (Pha chế)</h3>
        <button className="btn btn-outline-danger btn-sm" onClick={logout}>Đăng xuất</button>
      </div>
      <div className="alert alert-primary">Khu vực nhận tự động các đơn đồ uống/tráng miệng từ Phục vụ.</div>
    </div>
  );
}