import React, { useState, useEffect } from 'react';
import {
  CreditCard, ShieldCheck, ShieldAlert, CheckCircle2,
  Upload, Save, RefreshCw, AlertTriangle
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const POPULAR_BANKS = [
  { id: 'MB', name: 'MB Bank (Quân Đội)' },
  { id: 'VCB', name: 'Vietcombank' },
  { id: 'TCB', name: 'Techcombank' },
  { id: 'BIDV', name: 'BIDV' },
  { id: 'CTG', name: 'VietinBank' },
  { id: 'ACB', name: 'ACB (Á Châu)' },
  { id: 'VPB', name: 'VPBank' },
  { id: 'TPB', name: 'TPBank' },
  { id: 'VIB', name: 'VIB' },
  { id: 'STB', name: 'Sacombank' },
  { id: 'MOMO', name: 'Ví MoMo' },
];

export default function PaymentConfigPage() {
  const [form, setForm] = useState({
    primary_bank_id: 'MB',
    primary_account_no: '',
    primary_account_name: '',
    primary_custom_qr_url: '',
    backup_bank_id: 'VCB',
    backup_account_no: '',
    backup_account_name: '',
    backup_custom_qr_url: '',
    active_mode: 'PRIMARY',
    updated_by: '',
  });

  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [savedToast, setSavedToast] = useState(false);

  const token = localStorage.getItem('access_token');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment-qr`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setForm({
          primary_bank_id: data.primary_bank_id || 'MB',
          primary_account_no: data.primary_account_no || '',
          primary_account_name: data.primary_account_name || '',
          primary_custom_qr_url: data.primary_custom_qr_url || '',
          backup_bank_id: data.backup_bank_id || 'VCB',
          backup_account_no: data.backup_account_no || '',
          backup_account_name: data.backup_account_name || '',
          backup_custom_qr_url: data.backup_custom_qr_url || '',
          active_mode: data.active_mode || 'PRIMARY',
          updated_by: data.updated_by || 'Admin',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Upload ảnh QR tĩnh từ máy tính (nếu không dùng VietQR tự động)
  const handleUploadQrImage = async (e, targetField) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(targetField);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/menu/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, [targetField]: data.image_url }));
      }
    } finally {
      setUploadingField(null);
    }
  };

  const getPreviewQr = (type) => {
    if (type === 'PRIMARY') {
      if (form.primary_custom_qr_url) {
        return form.primary_custom_qr_url.startsWith('http')
          ? form.primary_custom_qr_url
          : `${API_BASE}${form.primary_custom_qr_url}`;
      }
      if (!form.primary_bank_id || !form.primary_account_no) return '';
      return `https://img.vietqr.io/image/${form.primary_bank_id}-${form.primary_account_no}-compact2.png?accountName=${encodeURIComponent(form.primary_account_name || '')}`;
    } else {
      if (form.backup_custom_qr_url) {
        return form.backup_custom_qr_url.startsWith('http')
          ? form.backup_custom_qr_url
          : `${API_BASE}${form.backup_custom_qr_url}`;
      }
      if (!form.backup_bank_id || !form.backup_account_no) return '';
      return `https://img.vietqr.io/image/${form.backup_bank_id}-${form.backup_account_no}-compact2.png?accountName=${encodeURIComponent(form.backup_account_name || '')}`;
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment-qr/admin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
        fetchConfig();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid px-1">
      {/* Banner trạng thái kênh thanh toán hiện tại */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 bg-light">
        <div className="card-body p-3.5">
          <div className="row align-items-center g-3">
            <div className="col-12 col-lg-8">
              <div className="d-flex align-items-start gap-3">
                <div className={`p-3 rounded-4 text-white ${form.active_mode === 'PRIMARY' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span className="fw-bold text-dark fs-6">Cổng Thanh Toán Đang Kích Hoạt:</span>
                    {form.active_mode === 'PRIMARY' ? (
                      <span className="badge bg-primary px-2.5 py-1.5" style={{ fontSize: '12px' }}>
                        🟢 MÃ QR CHÍNH ({form.primary_bank_id})
                      </span>
                    ) : (
                      <span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ fontSize: '12px' }}>
                        🟡 MÃ QR PHỤ DỰ PHÒNG ({form.backup_bank_id})
                      </span>
                    )}
                  </div>
                  <div className="text-muted small">
                    Cập nhật gần nhất bởi: <b className="text-dark">{form.updated_by || 'Admin'}</b> • Thu ngân có quyền chuyển sang QR Phụ & chỉnh sửa QR Phụ khi ngân hàng chính bảo trì.
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4 d-flex justify-content-lg-end align-items-center gap-2">
              <label className="small fw-semibold text-secondary mb-0 text-nowrap">Chọn kênh ưu tiên:</label>
              <select
                value={form.active_mode}
                onChange={(e) => setForm({ ...form, active_mode: e.target.value })}
                className="form-select form-select-sm fw-semibold rounded-3"
                style={{ width: '180px' }}
              >
                <option value="PRIMARY">🟢 Dùng QR Chính</option>
                <option value="BACKUP">🟡 Dùng QR Phụ</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {savedToast && (
        <div className="alert alert-success py-2 px-3 rounded-3 d-flex align-items-center gap-2 small fw-semibold">
          <CheckCircle2 size={16} /> Đã lưu cấu hình Tài khoản & Mã QR thanh toán thành công!
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="row g-4">
          {/* CỘT 1: MÃ QR CHÍNH (CHỈ ADMIN ĐƯỢC SỬA) */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 border-primary-subtle shadow-none rounded-4">
              <div className="card-header bg-primary text-white rounded-top-4 py-3 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2 fw-semibold">
                  <ShieldCheck size={18} />
                  <span>1. Tài Khoản & Mã QR Chính (Mặc định)</span>
                </div>
                <span className="badge bg-white text-primary" style={{ fontSize: '11px' }}>
                  Chỉ Admin được sửa
                </span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Ngân hàng / Ví *</label>
                    <select
                      value={form.primary_bank_id}
                      onChange={(e) => setForm({ ...form, primary_bank_id: e.target.value })}
                      className="form-select form-select-sm"
                    >
                      {POPULAR_BANKS.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Số tài khoản *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 0901234567"
                      value={form.primary_account_no}
                      onChange={(e) => setForm({ ...form, primary_account_no: e.target.value })}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Tên chủ tài khoản (Không dấu) *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: NGUYEN VAN A"
                      value={form.primary_account_name}
                      onChange={(e) => setForm({ ...form, primary_account_name: e.target.value.toUpperCase() })}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">
                      Hoặc tải ảnh QR tĩnh riêng (Tùy chọn — bỏ trống sẽ tự sinh VietQR động kèm số tiền)
                    </label>
                    <div className="d-flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadQrImage(e, 'primary_custom_qr_url')}
                        className="form-control form-control-sm"
                      />
                      {form.primary_custom_qr_url && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, primary_custom_qr_url: '' })}
                          className="btn btn-sm btn-outline-danger"
                        >
                          Xóa ảnh
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Khung xem trước QR Chính */}
                <div className="mt-4 p-3 bg-light rounded-4 border text-center">
                  <div className="small fw-semibold text-primary mb-2">Xem trước Mã QR Chính</div>
                  {getPreviewQr('PRIMARY') ? (
                    <img
                      src={getPreviewQr('PRIMARY')}
                      alt="Primary QR"
                      className="rounded border bg-white p-1"
                      style={{ width: '190px', height: '190px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="text-muted small py-5">Nhập số tài khoản để xem trước mã VietQR</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CỘT 2: MÃ QR PHỤ DỰ PHÒNG (THU NGÂN CÓ QUYỀN CHỈNH SỬA KHI SỰ CỐ) */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 border-warning-subtle shadow-none rounded-4">
              <div className="card-header bg-warning text-dark rounded-top-4 py-3 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2 fw-semibold">
                  <ShieldAlert size={18} />
                  <span>2. Tài Khoản & Mã QR Phụ (Dự phòng)</span>
                </div>
                <span className="badge bg-dark text-warning" style={{ fontSize: '11px' }}>
                  Admin & Thu ngân được sửa
                </span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Ngân hàng / Ví dự phòng *</label>
                    <select
                      value={form.backup_bank_id}
                      onChange={(e) => setForm({ ...form, backup_bank_id: e.target.value })}
                      className="form-select form-select-sm"
                    >
                      {POPULAR_BANKS.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Số tài khoản dự phòng *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 1029384756"
                      value={form.backup_account_no}
                      onChange={(e) => setForm({ ...form, backup_account_no: e.target.value })}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Tên chủ tài khoản dự phòng *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: TRAN THI B"
                      value={form.backup_account_name}
                      onChange={(e) => setForm({ ...form, backup_account_name: e.target.value.toUpperCase() })}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">
                      Hoặc tải ảnh QR tĩnh dự phòng (Tùy chọn)
                    </label>
                    <div className="d-flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadQrImage(e, 'backup_custom_qr_url')}
                        className="form-control form-control-sm"
                      />
                      {form.backup_custom_qr_url && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, backup_custom_qr_url: '' })}
                          className="btn btn-sm btn-outline-danger"
                        >
                          Xóa ảnh
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Khung xem trước QR Phụ */}
                <div className="mt-4 p-3 bg-light rounded-4 border text-center">
                  <div className="small fw-semibold text-warning-emphasis mb-2">Xem trước Mã QR Dự Phòng</div>
                  {getPreviewQr('BACKUP') ? (
                    <img
                      src={getPreviewQr('BACKUP')}
                      alt="Backup QR"
                      className="rounded border bg-white p-1"
                      style={{ width: '190px', height: '190px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="text-muted small py-5">Nhập số tài khoản dự phòng để xem trước mã VietQR</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end mt-4">
          <button
            type="submit"
            disabled={loading || Boolean(uploadingField)}
            className="btn btn-primary px-4 py-2 fw-semibold rounded-3 d-flex align-items-center gap-2"
          >
            <Save size={17} /> Lưu Cấu Hình Thanh Toán
          </button>
        </div>
      </form>
    </div>
  );
}