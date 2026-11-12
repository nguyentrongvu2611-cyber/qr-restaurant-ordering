import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ username: '', password: '', full_name: '', phone: '', role: 'staff' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchUsers = async () => {
    try { const res = await api.get('/admin/users'); setUsers(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/admin/users', formData);
      setMessage({ type: 'success', text: res.data.message });
      setFormData({ username: '', password: '', full_name: '', phone: '', role: 'staff' });
      fetchUsers();
    } catch (err) { setMessage({ type: 'danger', text: err.response?.data?.detail || 'Lỗi tạo tài khoản!' }); }
  };

  const handleToggleActive = async (id) => {
    try { await api.patch(`/admin/users/${id}/toggle-active`); fetchUsers(); }
    catch (err) { alert(err.response?.data?.detail || 'Không thể khóa tài khoản này'); }
  };

  return (
    <AdminLayout title="5. Quản lý Nhân sự & Tài khoản (ADM12 - ADM13)">
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">Cấp tài khoản mới (Chỉ Admin)</div>
            <div className="card-body">
              {message.text && <div className={`alert alert-${message.type} py-2`}>{message.text}</div>}
              <form onSubmit={handleCreateUser}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Họ và tên</label>
                  <input type="text" className="form-control" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Số điện thoại</label>
                  <input type="text" className="form-control" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Vai trò</label>
                  <select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    <option value="staff">Nhân viên Phục vụ / Thu ngân (/staff)</option>
                    <option value="kitchen">Nhân viên Bếp (/kitchen)</option>
                    <option value="admin">Quản trị viên (/admin)</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Tên đăng nhập</label>
                  <input type="text" className="form-control" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required />
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold">Mật khẩu</label>
                  <input type="password" className="form-control" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary w-100 fw-bold">+ CẤP TÀI KHOẢN</button>
              </form>
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">Danh sách Tài khoản Hệ thống</div>
            <div className="card-body table-responsive">
              <table className="table table-bordered table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>ID</th><th>Họ tên</th><th>Tài khoản</th><th>SĐT</th><th>Vai trò</th><th className="text-center">Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td className="fw-semibold">{u.full_name}</td>
                      <td><code>{u.username}</code></td>
                      <td>{u.phone || '-'}</td>
                      <td>
                        {u.role === 'admin' && <span className="badge bg-danger">ADMIN</span>}
                        {u.role === 'staff' && <span className="badge bg-primary">STAFF</span>}
                        {u.role === 'kitchen' && <span className="badge bg-warning text-dark">KITCHEN</span>}
                      </td>
                      <td className="text-center"><span className={`badge ${u.is_active ? 'bg-success' : 'bg-secondary'}`}>{u.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td>
                      <td className="text-center">
                        {u.username !== 'admin' && (
                          <button className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => handleToggleActive(u.id)}>
                            {u.is_active ? 'Khóa' : 'Mở khóa'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
