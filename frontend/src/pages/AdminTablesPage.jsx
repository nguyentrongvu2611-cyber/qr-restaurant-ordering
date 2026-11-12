import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';

export default function AdminTablesPage() {
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState({ id: null, table_number: '', capacity: 4, status: 'available' });

  const fetchTables = async () => {
    try {
      const res = await api.get('/admin/tables');
      setTables(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchTables(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.put(`/admin/tables/${form.id}`, {
          table_number: form.table_number,
          capacity: Number(form.capacity),
          status: form.status,
        });
      } else {
        await api.post('/admin/tables', {
          table_number: form.table_number,
          capacity: Number(form.capacity),
        });
      }
      setForm({ id: null, table_number: '', capacity: 4, status: 'available' });
      fetchTables();
    } catch (err) { alert(err.response?.data?.detail || 'Lỗi lưu thông tin bàn!'); }
  };

  const handleRegenerateQR = async (id) => {
    if (!window.confirm('Tạo lại mã QR mới sẽ vô hiệu hóa mã QR cũ của bàn này. Tiếp tục?')) return;
    await api.post(`/admin/tables/${id}/regenerate-qr`);
    fetchTables();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa bàn này khỏi hệ thống?')) return;
    try { await api.delete(`/admin/tables/${id}`); fetchTables(); }
    catch (err) { alert(err.response?.data?.detail || 'Không thể xóa bàn'); }
  };

  const handlePrintQR = (table) => {
    const win = window.open('', '_blank', 'width=400,height=500');
    win.document.write(`
      <html>
        <head><title>In Mã QR - ${table.table_number}</title></head>
        <body style="text-align:center; font-family:Arial; padding:20px;">
          <h2>QUÉT MÃ ĐỂ GỌI MÓN</h2>
          <h1 style="color:#0d6efd;">${table.table_number}</h1>
          <img src="${table.qr_image_url}" style="width:240px; height:240px;" />
          <p style="font-size:12px; color:#555;">Mã bàn: ${table.qr_code_token}</p>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <AdminLayout title="3. Quản lý Bàn ăn & Mã QR (ADM08 - ADM10)">
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">
              {form.id ? 'Cập nhật thông tin Bàn' : 'Thêm Bàn ăn mới (Tự sinh QR)'}
            </div>
            <div className="card-body">
              <form onSubmit={handleSave}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Tên / Số bàn</label>
                  <input type="text" className="form-control" placeholder="VD: Bàn 01" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Số ghế ngồi</label>
                  <input type="number" className="form-control" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
                </div>
                {form.id && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Trạng thái bàn</label>
                    <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="available">Trống (Available)</option>
                      <option value="occupied">Đang có khách (Occupied)</option>
                      <option value="reserved">Đã đặt trước (Reserved)</option>
                    </select>
                  </div>
                )}
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary flex-grow-1 fw-bold">{form.id ? 'Lưu thay đổi' : '+ Tạo bàn & Sinh QR'}</button>
                  {form.id && <button type="button" className="btn btn-secondary" onClick={() => setForm({ id: null, table_number: '', capacity: 4, status: 'available' })}>Hủy</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="row g-3">
            {tables.map((t) => (
              <div className="col-md-6 col-xl-4" key={t.id}>
                <div className="card shadow-sm h-100 text-center">
                  <div className="card-header d-flex justify-content-between align-items-center bg-white">
                    <span className="fw-bold fs-5 text-primary">{t.table_number}</span>
                    <span className={`badge ${t.status === 'available' ? 'bg-success' : t.status === 'occupied' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                      {t.status === 'available' ? 'Trống' : t.status === 'occupied' ? 'Có khách' : 'Đặt trước'}
                    </span>
                  </div>
                  <div className="card-body">
                    <img src={t.qr_image_url} alt={`QR ${t.table_number}`} className="img-thumbnail mb-2" style={{ width: '150px', height: '150px' }} />
                    <div className="small text-muted mb-2">Sức chứa: {t.capacity} ghế</div>
                    <div className="d-flex justify-content-center gap-1 flex-wrap">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handlePrintQR(t)}>In QR</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => handleRegenerateQR(t.id)}>Đổi mã</button>
                      <button className="btn btn-sm btn-warning" onClick={() => setForm(t)}>Sửa</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>Xóa</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
