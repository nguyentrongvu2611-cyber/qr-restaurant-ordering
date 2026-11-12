import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api/auth";

export default function ManageStaffPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    phone: "",
    role: "STAFF",
  });
  const [createdAccount, setCreatedAccount] = useState(null);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, authHeader);
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError("");
    setCreatedAccount(null);
    try {
      await axios.post(`${API_URL}/users`, form, authHeader);
      setCreatedAccount({
        username: form.username,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
      });
      setForm({ username: "", password: "", full_name: "", phone: "", role: "STAFF" });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Lỗi tạo tài khoản");
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await axios.patch(`${API_URL}/users/${userId}/toggle-active`, {}, authHeader);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Không thể thay đổi trạng thái");
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const roleBadgeColor = {
    ADMIN: "bg-dark",
    CASHIER: "bg-warning text-dark",
    STAFF: "bg-success",
    KITCHEN: "bg-danger",
    BAR: "bg-info text-dark",
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
        <h3>Hệ Thống Quản Trị (ADMIN) - Cấp Tài Khoản Nhân Sự</h3>
        <div>
          <span className="me-3 fw-bold">Xin chào, {localStorage.getItem("full_name")}</span>
          <button className="btn btn-outline-danger btn-sm" onClick={logout}>Đăng xuất</button>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white fw-bold">
              Cấp Tài Khoản Mới
            </div>
            <div className="card-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              
              {createdAccount && (
                <div className="alert alert-success">
                  <strong>Đã tạo thành công! Gửi thông tin này cho nhân viên:</strong>
                  <div className="mt-2 p-2 bg-white border rounded font-monospace small">
                    Nhân viên: {createdAccount.full_name}<br />
                    Vai trò: {createdAccount.role}<br />
                    Tài khoản: <b>{createdAccount.username}</b><br />
                    Mật khẩu: <b>{createdAccount.password}</b>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                <div className="mb-2">
                  <label className="form-label">Họ và tên nhân viên *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Tên đăng nhập (Username) *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.trim() })}
                    placeholder="VD: phucvu01"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Mật khẩu cấp phát *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Nhập mật khẩu để gửi nhân viên"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Phân quyền màn hình (Role) *</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="STAFF">Nhân viên Phục vụ (STAFF)</option>
                    <option value="CASHIER">Thu ngân (CASHIER)</option>
                    <option value="KITCHEN">Nhà Bếp (KITCHEN)</option>
                    <option value="BAR">Quầy Bar (BAR)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary w-100">
                  Tạo tài khoản & Phân quyền
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header fw-bold">Danh sách Tài khoản Nhân viên</div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Họ tên</th>
                    <th>Tên đăng nhập</th>
                    <th>SĐT</th>
                    <th>Role</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td className="fw-semibold">{u.full_name}</td>
                      <td><code>{u.username}</code></td>
                      <td>{u.phone || "-"}</td>
                      <td>
                        <span className={`badge ${roleBadgeColor[u.role] || "bg-secondary"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.is_active ? (
                          <span className="badge bg-success">Đang hoạt động</span>
                        ) : (
                          <span className="badge bg-secondary">Đã khóa</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.is_active ? "btn-outline-danger" : "btn-outline-success"}`}
                          onClick={() => handleToggleStatus(u.id)}
                        >
                          {u.is_active ? "Khóa" : "Mở khóa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}