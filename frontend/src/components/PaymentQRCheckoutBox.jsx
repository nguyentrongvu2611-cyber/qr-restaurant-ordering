import React, { useState, useEffect } from 'react';
import { RefreshCw, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function PaymentQRCheckoutBox({ amount = 0, orderCode = '' }) {
  const [qrInfo, setQrInfo] = useState(null);
  const [fullConfig, setFullConfig] = useState(null);
  const [showEditBackup, setShowEditBackup] = useState(false);
  const [backupForm, setBackupForm] = useState({
    backup_bank_id: 'VCB',
    backup_account_no: '',
    backup_account_name: '',
    backup_custom_qr_url: '',
  });
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('access_token');
  const cashierName = localStorage.getItem('full_name') || 'Thu ngân';

  const loadCheckoutQr = async () => {
    try {
      const [checkoutRes, cfgRes] = await Promise.all([
        fetch(`${API_BASE}/api/payment-qr/checkout-qr?amount=${amount}&order_code=${encodeURIComponent(orderCode)}`),
        fetch(`${API_BASE}/api/payment-qr`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (checkoutRes.ok) setQrInfo(await checkoutRes.json());
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setFullConfig(cfg);
        setBackupForm({
          backup_bank_id: cfg.backup_bank_id || 'VCB',
          backup_account_no: cfg.backup_account_no || '',
          backup_account_name: cfg.backup_account_name || '',
          backup_custom_qr_url: cfg.backup_custom_qr_url || '',
        });
      }
    } catch (err) {
      console.error('Lỗi tải mã QR thanh toán:', err);
    }
  };

  useEffect(() => {
    loadCheckoutQr();
  }, [amount, orderCode]);

  // Chuyển nóng 1 chạm giữa QR Chính <-> QR Phụ
  const handleToggleMode = async () => {
    if (!qrInfo) return;
    const nextMode = qrInfo.mode === 'PRIMARY' ? 'BACKUP' : 'PRIMARY';
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment-qr/switch-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active_mode: nextMode, updated_by: cashierName }),
      });
      if (res.ok) loadCheckoutQr();
    } finally {
      setLoading(false);
    }
  };

  // Thu ngân cập nhật QR Phụ khi có sự cố
  const handleSaveBackupByCashier = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment-qr/cashier-backup`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...backupForm,
          active_mode: 'BACKUP',
          updated_by: cashierName,
        }),
      });
      if (res.ok) {
        setShowEditBackup(false);
        loadCheckoutQr();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!qrInfo) return null;

  const resolvedImgUrl = qrInfo.qr_url?.startsWith('/static')
    ? `${API_BASE}${qrInfo.qr_url}`
    : qrInfo.qr_url;

  return (
    <div className="p-3 bg-light rounded-4 border text-center">
      {/* Thanh trạng thái & nút chuyển kênh cho Thu ngân */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-2">
        <span className={`badge ${qrInfo.mode === 'BACKUP' ? 'bg-warning text-dark' : 'bg-primary'}`}>
          {qrInfo.mode === 'BACKUP' ? '🟡 Đang dùng QR Phụ' : '🟢 Đang dùng QR Chính'}
        </span>

        <div className="d-flex gap-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleToggleMode}
            className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center gap-1"
            style={{ fontSize: '11px' }}
            title="Chuyển đổi nhanh khi ngân hàng chính lỗi"
          >
            <RefreshCw size={12} />
            {qrInfo.mode === 'PRIMARY' ? 'Đổi sang QR Phụ' : 'Về QR Chính'}
          </button>

          <button
            type="button"
            onClick={() => setShowEditBackup(!showEditBackup)}
            className="btn btn-sm btn-outline-warning text-dark py-0 px-2 d-flex align-items-center gap-1"
            style={{ fontSize: '11px' }}
            title="Thu ngân có quyền sửa tài khoản QR dự phòng"
          >
            <Edit3 size={12} /> Sửa QR Phụ
          </button>
        </div>
      </div>

      {/* Ảnh mã QR thanh toán */}
      {resolvedImgUrl ? (
        <img
          src={resolvedImgUrl}
          alt="VietQR Thanh Toán"
          className="rounded-3 border bg-white p-1 my-1"
          style={{ width: '210px', height: '210px', objectFit: 'contain' }}
        />
      ) : (
        <div className="text-danger small py-4">
          <AlertTriangle size={18} className="mb-1" /><br />
          Chưa thiết lập số tài khoản cho kênh này!
        </div>
      )}

      <div className="small text-dark mt-1">
        <b>{qrInfo.bank_id}</b> • {qrInfo.account_no}
        <div className="text-muted" style={{ fontSize: '11px' }}>{qrInfo.account_name}</div>
      </div>

      {/* Form Thu ngân chỉnh sửa QR Phụ khi cần */}
      {showEditBackup && (
        <form onSubmit={handleSaveBackupByCashier} className="mt-3 pt-2 border-top text-start">
          <div className="fw-bold text-warning-emphasis mb-2" style={{ fontSize: '12px' }}>
            ✏️ Cập nhật Tài khoản QR Dự Phòng (Ca trực)
          </div>
          <div className="row g-2 mb-2">
            <div className="col-4">
              <input
                type="text"
                required
                placeholder="Mã NH (VD: VCB)"
                value={backupForm.backup_bank_id}
                onChange={(e) => setBackupForm({ ...backupForm, backup_bank_id: e.target.value.toUpperCase() })}
                className="form-control form-control-sm"
              />
            </div>
            <div className="col-8">
              <input
                type="text"
                required
                placeholder="Số tài khoản phụ"
                value={backupForm.backup_account_no}
                onChange={(e) => setBackupForm({ ...backupForm, backup_account_no: e.target.value })}
                className="form-control form-control-sm"
              />
            </div>
            <div className="col-12">
              <input
                type="text"
                required
                placeholder="Tên chủ tài khoản phụ"
                value={backupForm.backup_account_name}
                onChange={(e) => setBackupForm({ ...backupForm, backup_account_name: e.target.value.toUpperCase() })}
                className="form-control form-control-sm"
              />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-1">
            <button type="button" onClick={() => setShowEditBackup(false)} className="btn btn-sm btn-light">
              Đóng
            </button>
            <button type="submit" disabled={loading} className="btn btn-sm btn-warning fw-semibold">
              Lưu & Bật QR Phụ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}