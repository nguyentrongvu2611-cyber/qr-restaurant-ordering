import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function AuthPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
      if (user.role === 'admin') navigate('/admin/menu', { replace: true });
      else if (user.role === 'kitchen') navigate('/kitchen', { replace: true });
      else if (user.role === 'staff') navigate('/staff', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      const role = res.data.user.role;
      if (role === 'admin') navigate('/admin/menu', { replace: true });
      else if (role === 'kitchen') navigate('/kitchen', { replace: true });
      else if (role === 'staff') navigate('/staff', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Sai tên đăng nhập hoặc mật khẩu!');
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="card shadow-sm p-4" style={{ maxWidth: '420px', width: '100%' }}>
        <h3 className="text-center text-primary fw-bold mb-1">QUẢN LÝ QUÁN ĂN QR</h3>
        <p className="text-center text-muted mb-4">Đăng nhập hệ thống nội bộ</p>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label fw-semibold">Tên đăng nhập</label>
            <input type="text" className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold">Mật khẩu</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary w-100 fw-bold py-2">ĐĂNG NHẬP</button>
        </form>
      </div>
    </div>
  );
}
