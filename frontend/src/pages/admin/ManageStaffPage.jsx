import React, { useState, useEffect } from 'react';
import {
  UserPlus, Users, Shield, Search, Edit3, KeyRound,
  Lock, Unlock, CheckCircle2, XCircle, Eye, EyeOff, Phone, AlertTriangle
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const ROLE_CONFIG = {
  admin: {
    label: 'Quản trị viên (ADMIN)',
    short: 'ADMIN',
    badgeClass: 'bg-dark text-white',
  },
  cashier: {
    label: 'Thu ngân (CASHIER)',
    short: 'THU NGÂN',
    badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle',
  },
  staff: {
    label: 'Phục vụ (STAFF)',
    short: 'PHỤC VỤ',
    badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
  },
  kitchen: {
    label: 'Bếp / Pha chế (KITCHEN)',
    short: 'BẾP / BAR',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
  },
};

export default function ManageStaffPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success' | 'danger', text: string }

  const showToast = (text, type = 'success') => {
  setToast({ text, type });
  setTimeout(() => setToast(null), 3000);
};
  // Bộ lọc & tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form tạo / sửa tài khoản nhân viên
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    role: 'staff',
  });

  // Modal cấp lại mật khẩu
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const token = localStorage.getItem('access_token');
  const currentUsername = localStorage.getItem('username') || 'admin';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách nhân sự:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setEditingUser(null);
    setShowPassword(false);
    setForm({
      full_name: '',
      username: '',
      password: '',
      phone: '',
      role: 'staff',
    });
  };

  // Tạo mới hoặc cập nhật thông tin nhân viên
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        const res = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
          }),
        });
        if (res.ok) {
          resetForm();
          fetchUsers();
        } else {
          const err = await res.json();
          alert(err.detail || 'Lỗi cập nhật nhân sự');
        }
      } else {
        const res = await fetch(`${API_BASE}/api/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          resetForm();
          fetchUsers();
        } else {
          const err = await res.json();
          alert(err.detail || 'Lỗi tạo tài khoản nhân viên');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Khóa / Mở khóa tài khoản
  const handleToggleActive = (user) => {
    if (user.username === currentUsername) {
      showToast('Không thể tự khóa tài khoản Quản trị viên đang đăng nhập!', 'danger');
      return;
    }
    setConfirmToggleUser(user);
  };
  const executeToggleActive = async () => {
    if (!confirmToggleUser) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${confirmToggleUser.id}/toggle-active`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const actionLabel = confirmToggleUser.is_active ? 'Đã khóa' : 'Đã mở khóa';
        showToast(`${actionLabel} tài khoản "${confirmToggleUser.username}" thành công!`, 'success');
        setConfirmToggleUser(null);
        fetchUsers();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Không thể thay đổi trạng thái tài khoản', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  // Cấp lại mật khẩu mới
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPwdUser || newPassword.trim().length < 4) {
      showToast('Mật khẩu mới cần tối thiểu 4 ký tự', 'danger');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${resetPwdUser.id}/reset-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword.trim() }),
      });
      if (res.ok) {
        showToast(`Đã đổi mật khẩu mới cho ${resetPwdUser.full_name} (${resetPwdUser.username}) thành công!`, 'success');
        setResetPwdUser(null);
        setNewPassword('');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Lỗi đặt lại mật khẩu', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  // Thống kê nhanh
  const activeCount = users.filter((u) => u.is_active).length;
  const lockedCount = users.length - activeCount;
  const staffKitchenCount = users.filter((u) => ['staff', 'kitchen', 'cashier'].includes((u.role || '').toLowerCase())).length;

  // Lọc danh sách nhân sự
  const filteredUsers = users.filter((u) => {
    const roleKey = (u.role || '').toLowerCase();
    const matchSearch =
      (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm);
    const matchRole = roleFilter === 'ALL' ? true : roleKey === roleFilter;
    const matchStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? u.is_active
        : !u.is_active;
    return matchSearch && matchRole && matchStatus;
  });

  // Lấy 2 chữ cái đầu làm Avatar tròn
  const getInitials = (name) => {
    if (!name) return 'NV';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="container-fluid px-1">
      {/* 4 THẺ THỐNG KÊ NHÂN SỰ */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="p-3 bg-light rounded-4 border d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Tổng tài khoản</div>
              <div className="fw-bold fs-5 text-dark">{users.length} nhân sự</div>
            </div>
            <Users size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-success bg-opacity-10 rounded-4 border border-success-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-success small fw-semibold">Đang hoạt động</div>
              <div className="fw-bold fs-5 text-success">{activeCount} tài khoản</div>
            </div>
            <CheckCircle2 size={22} className="text-success" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-primary bg-opacity-10 rounded-4 border border-primary-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-primary small fw-semibold">Vận hành (Phục vụ/Bếp)</div>
              <div className="fw-bold fs-5 text-primary">{staffKitchenCount} nhân viên</div>
            </div>
            <Shield size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-danger bg-opacity-10 rounded-4 border border-danger-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-danger small fw-semibold">Đang bị khóa</div>
              <div className="fw-bold fs-5 text-danger">{lockedCount} tài khoản</div>
            </div>
            <XCircle size={22} className="text-danger" />
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* CỘT TRÁI: CẤP TÀI KHOẢN MỚI / SỬA PHÂN QUYỀN */}
        <div className="col-12 col-lg-4">
          <div className="card border shadow-none rounded-4">
            <div className={`card-header text-white rounded-top-4 py-3 d-flex justify-content-between align-items-center ${editingUser ? 'bg-warning text-dark' : 'bg-primary'}`}>
              <div className="d-flex align-items-center gap-2 fw-semibold">
                <UserPlus size={18} />
                <span>{editingUser ? `Chỉnh Sửa: ${editingUser.username}` : 'Cấp Tài Khoản Nhân Sự'}</span>
              </div>
              {editingUser && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-sm btn-light py-0 px-2 small"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            <div className="card-body">
              <form onSubmit={handleSubmitForm}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Họ và tên nhân viên *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="form-control form-control-sm rounded-3 py-2"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Tên đăng nhập (Username) *</label>
                  <input
  type="text"
  required
  disabled={Boolean(editingUser)}
  autoComplete="off"
  placeholder="VD: phucvu01, thungan01, bep01..."
  value={form.username}
  onChange={(e) => setForm({ ...form, username: e.target.value.trim() })}
  className="form-control form-control-sm rounded-3 py-2"
/>
                  {editingUser && (
                    <small className="text-muted" style={{ fontSize: '11px' }}>
                      Không thể thay đổi tên đăng nhập đã cấp.
                    </small>
                  )}
                </div>

                {!editingUser && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Mật khẩu cấp phát *</label>
                    <div className="input-group input-group-sm">
                      <input
  type={showPassword ? 'text' : 'password'}
  required
  autoComplete="new-password"
  placeholder="Nhập mật khẩu ban đầu..."
  value={form.password}
  onChange={(e) => setForm({ ...form, password: e.target.value })}
  className="form-control rounded-start-3 py-2"
/>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn btn-outline-secondary rounded-end-3"
                        title="Hiện / Ẩn mật khẩu"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    placeholder="VD: 0901234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="form-control form-control-sm rounded-3 py-2"
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-semibold text-secondary">Vai trò & Phân quyền màn hình *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="form-select form-select-sm rounded-3 py-2 fw-semibold"
                  >
                    <option value="staff">🧑‍🍳 Nhân viên Phục vụ (STAFF)</option>
                    <option value="cashier">💳 Nhân viên Thu ngân (CASHIER)</option>
                    <option value="kitchen">🔥 Bộ phận Bếp / Pha chế (KITCHEN)</option>
                    <option value="admin">🛡️ Quản trị viên hệ thống (ADMIN)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-sm w-100 py-2 fw-semibold rounded-3 ${editingUser ? 'btn-warning' : 'btn-primary'}`}
                >
                  {editingUser ? 'Lưu Cập Nhật Nhân Sự' : '+ Tạo Tài Khoản & Phân Quyền'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: DANH SÁCH TÀI KHOẢN NHÂN VIÊN */}
        <div className="col-12 col-lg-8">
          <div className="card border shadow-none rounded-4">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="fw-bold mb-0">Danh Sách Tài Khoản Nhân Sự</h5>
                  <small className="text-muted">Quản lý phân quyền truy cập, cấp lại mật khẩu và khóa/mở khóa tài khoản</small>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="input-group input-group-sm" style={{ width: '195px' }}>
                    <span className="input-group-text bg-light border-end-0">
                      <Search size={14} className="text-muted" />
                    </span>
                    <input
                      type="text"
                      placeholder="Tìm tên, username, SĐT..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="form-control bg-light border-start-0"
                    />
                  </div>

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="form-select form-select-sm bg-light"
                    style={{ width: '150px' }}
                  >
                    <option value="ALL">Vai trò: Tất cả</option>
                    <option value="admin">ADMIN</option>
                    <option value="cashier">Thu ngân</option>
                    <option value="staff">Phục vụ</option>
                    <option value="kitchen">Bếp / Bar</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select form-select-sm bg-light"
                    style={{ width: '155px' }}
                  >
                    <option value="ALL">Trạng thái: Tất cả</option>
                    <option value="ACTIVE">🟢 Hoạt động</option>
                    <option value="LOCKED">🔴 Đã khóa</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle small mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nhân viên</th>
                      <th>Tài khoản</th>
                      <th>Liên hệ</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th className="text-end">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-5">
                          Không tìm thấy tài khoản nhân sự nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const roleKey = (u.role || 'staff').toLowerCase();
                        const rCfg = ROLE_CONFIG[roleKey] || {
                          label: u.role,
                          short: (u.role || '').toUpperCase(),
                          badgeClass: 'bg-secondary-subtle text-secondary',
                        };
                        const isSelf = u.username === currentUsername;

                        return (
                          <tr key={u.id} className={!u.is_active ? 'opacity-75 bg-light' : ''}>
                            <td>
                              <div className="d-flex align-items-center gap-2.5">
                                <div
                                  className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: '36px', height: '36px', fontSize: '12px' }}
                                >
                                  {getInitials(u.full_name)}
                                </div>
                                <div>
                                  <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                                    <span>{u.full_name}</span>
                                    {isSelf && (
                                      <span className="badge bg-primary-subtle text-primary" style={{ fontSize: '10px' }}>
                                        Bạn
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '11px' }}>
                                    ID: #{u.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <code className="text-primary fw-semibold bg-light px-2 py-1 rounded border">
                                {u.username}
                              </code>
                            </td>
                            <td className="text-muted">
                              {u.phone ? (
                                <span className="d-inline-flex align-items-center gap-1">
                                  <Phone size={12} /> {u.phone}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              <span className={`badge rounded-pill px-2.5 py-1 ${rCfg.badgeClass}`}>
                                {rCfg.short}
                              </span>
                            </td>
                            <td>
                              {u.is_active ? (
                                <span className="badge rounded-pill bg-success-subtle text-success px-2.5 py-1">
                                  ● Đang hoạt động
                                </span>
                              ) : (
                                <span className="badge rounded-pill bg-danger-subtle text-danger px-2.5 py-1">
                                  ● Đã khóa
                                </span>
                              )}
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser(u);
                                    setForm({
                                      full_name: u.full_name || '',
                                      username: u.username || '',
                                      password: '',
                                      phone: u.phone || '',
                                      role: roleKey,
                                    });
                                  }}
                                  className="btn btn-sm btn-outline-secondary rounded-3"
                                  title="Sửa thông tin & phân quyền"
                                >
                                  <Edit3 size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetPwdUser(u);
                                    setNewPassword('');
                                  }}
                                  className="btn btn-sm btn-outline-primary rounded-3"
                                  title="Cấp lại mật khẩu mới"
                                >
                                  <KeyRound size={14} />
                                </button>

                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => handleToggleActive(u)}
                                  className={`btn btn-sm rounded-3 ${
                                    u.is_active ? 'btn-outline-danger' : 'btn-outline-success'
                                  }`}
                                  title={
                                    isSelf
                                      ? 'Không thể tự khóa chính mình'
                                      : u.is_active
                                      ? 'Khóa tài khoản'
                                      : 'Mở khóa tài khoản'
                                  }
                                >
                                  {u.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                              </div>
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
        </div>
      </div>

      {/* MODAL CẤP LẠI MẬT KHẨU NHÂN VIÊN */}
      {resetPwdUser && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setResetPwdUser(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h6 className="modal-title fw-bold">Đặt Lại Mật Khẩu</h6>
                <button type="button" className="btn-close" onClick={() => setResetPwdUser(null)} />
              </div>
              <form onSubmit={handleResetPasswordSubmit}>
                <div className="modal-body">
                  <div className="small text-muted mb-2">
                    Tài khoản: <b className="text-dark">{resetPwdUser.username}</b> ({resetPwdUser.full_name})
                  </div>
                  <label className="form-label small fw-semibold">Mật khẩu mới *</label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    placeholder="Nhập mật khẩu mới..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-control form-control-sm"
                    autoFocus
                  />
                </div>
                <div className="modal-footer border-top">
                  <button type="button" onClick={() => setResetPwdUser(null)} className="btn btn-sm btn-light">
                    Hủy
                  </button>
                  <button type="submit" disabled={loading} className="btn btn-sm btn-primary fw-semibold">
                    Xác Nhận Đổi
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* TOAST THÔNG BÁO GÓC PHẢI */}
      {toast && (
        <div
          className="position-fixed top-0 end-0 p-3"
          style={{ zIndex: 1080 }}
        >
          <div
            className={`alert ${
              toast.type === 'danger' ? 'alert-danger border-danger' : 'alert-success border-success'
            } shadow-lg rounded-4 d-flex align-items-center gap-2 py-2.5 px-3.5 mb-0 small fw-semibold`}
          >
            {toast.type === 'danger' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN KHÓA / MỞ KHÓA TÀI KHOẢN */}
      {confirmToggleUser && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)' }}
          onClick={() => !loading && setConfirmToggleUser(null)}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-body p-4 text-center">
                <div
                  className={`mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center ${
                    confirmToggleUser.is_active
                      ? 'bg-danger bg-opacity-10 text-danger'
                      : 'bg-success bg-opacity-10 text-success'
                  }`}
                  style={{ width: '56px', height: '56px' }}
                >
                  {confirmToggleUser.is_active ? <Lock size={26} /> : <Unlock size={26} />}
                </div>

                <h5 className="fw-bold text-dark mb-1">
                  {confirmToggleUser.is_active ? 'Xác Nhận Khóa Tài Khoản?' : 'Mở Khóa Tài Khoản Nhân Sự?'}
                </h5>

                <p className="text-muted small mb-3">
                  {confirmToggleUser.is_active ? (
                    <>
                      Nhân viên <b className="text-dark">{confirmToggleUser.full_name}</b> (
                      <code className="text-primary">{confirmToggleUser.username}</code>) sẽ bị đăng xuất và không thể truy cập hệ thống cho đến khi được mở khóa lại.
                    </>
                  ) : (
                    <>
                      Khôi phục quyền đăng nhập và thao tác hệ thống cho nhân viên{' '}
                      <b className="text-dark">{confirmToggleUser.full_name}</b> (
                      <code className="text-primary">{confirmToggleUser.username}</code>).
                    </>
                  )}
                </p>

                <div className="d-flex justify-content-center gap-2 mt-4">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setConfirmToggleUser(null)}
                    className="btn btn-light border px-4 py-2 rounded-3 fw-semibold small"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={executeToggleActive}
                    className={`btn px-4 py-2 rounded-3 fw-semibold small d-flex align-items-center gap-1.5 ${
                      confirmToggleUser.is_active ? 'btn-danger' : 'btn-success'
                    }`}
                  >
                    {confirmToggleUser.is_active ? (
                      <>
                        <Lock size={15} /> Xác Nhận Khóa
                      </>
                    ) : (
                      <>
                        <Unlock size={15} /> Xác Nhận Mở Khóa
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}