import { useNavigate } from "react-router-dom";

export default function KitchenKDS() {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem("role"); navigate("/login"); };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Màn hình Bếp (KDS - Giới hạn 5 phiếu FIFO)</h3>
        <button className="btn btn-outline-danger btn-sm" onClick={logout}>Đăng xuất</button>
      </div>
      <div className="alert alert-info">Khu vực hiển thị tối đa 5 phiếu cũ nhất, phiếu thứ 6 trở đi bị khóa.</div>
    </div>
  );
}