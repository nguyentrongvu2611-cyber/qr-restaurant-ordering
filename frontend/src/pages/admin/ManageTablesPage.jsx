import React, { useState, useEffect } from 'react';
import {
  QrCode, Plus, Layers, Users, Trash2, Edit3, RefreshCw,
  Download, Printer, Copy, Check, ExternalLink, Search, Armchair, Key, AlertTriangle 
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const STATUS_CONFIG = {
  available: {
    label: 'Bàn trống',
    badgeClass: 'bg-success-subtle text-success border border-success-subtle',
  },
  occupied: {
    label: 'Đang phục vụ',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
  },
  paying: {
    label: 'Chờ thanh toán',
    badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
  },
  reserved: {
    label: 'Đã đặt trước',
    badgeClass: 'bg-secondary-subtle text-secondary border border-secondary-subtle',
  },
};

export default function ManageTablesPage() {
  // --- STATE DỮ LIỆU ---
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);

  // --- STATE FORMS ---
  const [editingTable, setEditingTable] = useState(null);
  const [singleForm, setSingleForm] = useState({ table_number: '', capacity: 4, status: 'available' });
  
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ prefix: 'Bàn ', start_num: 1, end_num: 12, capacity: 4 });

  // --- STATE MODALS ---
  const [selectedQrTable, setSelectedQrTable] = useState(null);
  
  // State quản lý Popup Xác nhận chuyên nghiệp
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', onConfirm: null
  });

  const token = localStorage.getItem('access_token');

  // --- HÀM GỌI API ---
  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data);
        // Cập nhật lại thông tin bàn đang xem trong Modal (nếu có)
        if (selectedQrTable) {
          const updated = data.find((t) => t.id === selectedQrTable.id);
          if (updated) setSelectedQrTable(updated);
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách bàn:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // --- HÀM TIỆN ÍCH ---
  const getQrUrl = (url) => {
    if (!url) return 'https://placehold.co/200x200?text=No+QR';
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
  };

  const handleCopyLink = (table) => {
    navigator.clipboard.writeText(table.order_url);
    setCopiedId(table.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = async (table) => {
    try {
      const imgUrl = getQrUrl(table.qr_image_url);
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `QR_${table.table_number.replace(/\s+/g, '_')}.png`;
      link.click();
    } catch (err) {
      alert('Lỗi khi tải ảnh!');
    }
  };

  // In 1 thẻ QR
  const handlePrintQrCard = (table) => {
    const imgUrl = getQrUrl(table.qr_image_url);
    const printWindow = window.open('', '_blank', 'width=450,height=620');
    printWindow.document.write(`
      <html>
        <head>
          <title>In Thẻ QR - ${table.table_number}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { border: 2px solid #0d6efd; border-radius: 20px; padding: 30px; text-align: center; width: 300px; }
            .brand { color: #0d6efd; font-weight: bold; font-size: 18px; letter-spacing: 1px; }
            .table-name { font-size: 32px; font-weight: 800; margin: 12px 0; color: #111; }
            .qr-img { width: 220px; height: 220px; margin: 10px auto; }
            .guide { font-size: 14px; color: #444; margin-top: 12px; line-height: 1.5; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="card">
            <div class="brand">SMARTPOS RESTAURANT</div>
            <div class="table-name">${table.table_number}</div>
            <img class="qr-img" src="${imgUrl}" />
            <div class="guide"><b>QUÉT MÃ QR ĐỂ GỌI MÓN</b><br/>Mở Camera để quét mã và đặt món</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // In hàng loạt thẻ QR
  const handlePrintAllQrCards = () => {
    if (filteredTables.length === 0) return alert('Không có bàn nào để in!');
    
    const cardsHtml = filteredTables.map(table => `
        <div class="qr-card">
          <div class="brand">SMARTPOS RESTAURANT</div>
          <div class="table-name">${table.table_number}</div>
          <img class="qr-img" src="${getQrUrl(table.qr_image_url)}" />
          <div class="guide"><b>QUÉT MÃ QR ĐỂ GỌI MÓN</b></div>
        </div>
      `).join('');

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>In Tất Cả Mã QR</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
            .qr-card { border: 2px dashed #0d6efd; border-radius: 16px; padding: 18px 12px; text-align: center; page-break-inside: avoid; }
            .brand { color: #0d6efd; font-weight: bold; font-size: 13px; }
            .table-name { font-size: 28px; font-weight: 800; margin: 6px 0 8px 0; color: #111; text-transform: uppercase; }
            .qr-img { width: 175px; height: 175px; display: block; margin: 0 auto; }
            .guide { font-size: 12px; color: #444; margin-top: 8px; }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 400);">
          <div class="grid">${cardsHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- XỬ LÝ CHỌN BÀN ---
  const toggleSelectTable = (id) => {
    if (selectedTableIds.includes(id)) setSelectedTableIds(selectedTableIds.filter(item => item !== id));
    else setSelectedTableIds([...selectedTableIds, id]);
  };

  const toggleSelectAll = () => {
    if (selectedTableIds.length === filteredTables.length && filteredTables.length > 0) setSelectedTableIds([]);
    else setSelectedTableIds(filteredTables.map(t => t.id));
  };

  // --- XỬ LÝ POPUP XÁC NHẬN ---
  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };
  const closeConfirm = () => setConfirmModal({ ...confirmModal, isOpen: false });

  // --- API THÊM / SỬA / XÓA BÀN ---
  const handleSaveSingleTable = async (e) => {
    e.preventDefault();
    if (!singleForm.table_number.trim()) return;
    setLoading(true);
    try {
      const url = editingTable ? `${API_BASE}/api/tables/${editingTable.id}` : `${API_BASE}/api/tables`;
      const method = editingTable ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...singleForm, capacity: parseInt(singleForm.capacity, 10) || 4 }),
      });
      if (res.ok) {
        setEditingTable(null);
        setSingleForm({ table_number: '', capacity: 4, status: 'available' });
        fetchTables();
      } else {
        const err = await res.json();
        alert(err.detail || 'Lỗi lưu thông tin bàn');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tables/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...bulkForm, capacity: parseInt(bulkForm.capacity, 10) || 4 }),
      });
      if (res.ok) {
        setShowBulkModal(false);
        fetchTables();
      } else {
        const err = await res.json();
        alert(err.detail || 'Lỗi tạo hàng loạt bàn');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateQr = (tableId) => {
    showConfirm('Cấp lại mã QR', 'Mã QR cũ in trên bàn sẽ hết hiệu lực. Bạn có chắc chắn muốn cấp lại?', async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/tables/${tableId}/regenerate-qr`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) fetchTables();
      } finally {
        setLoading(false);
        closeConfirm();
      }
    });
  };

  const handleDeleteTable = (table) => {
    showConfirm('Xóa Bàn Ăn', `Bạn có chắc muốn xóa "${table.table_number}" khỏi hệ thống?`, async () => {
      const res = await fetch(`${API_BASE}/api/tables/${table.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (editingTable?.id === table.id) {
          setEditingTable(null);
          setSingleForm({ table_number: '', capacity: 4, status: 'available' });
        }
        fetchTables();
      } else {
        const err = await res.json();
        alert(err.detail || 'Không thể xóa bàn');
      }
      closeConfirm();
    });
  };

  // --- API XÓA QR HÀNG LOẠT ---
  const handleDeleteSelectedQr = () => {
    if (selectedTableIds.length === 0) return;
    showConfirm('Xóa Mã QR Đã Chọn', `Bạn có chắc chắn muốn xóa mã QR của ${selectedTableIds.length} bàn đã chọn?`, async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tables/qr/delete-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ table_ids: selectedTableIds })
        });
        if (res.ok) {
          setSelectedTableIds([]);
          fetchTables();
        }
      } catch (err) { alert("Lỗi khi xóa QR"); }
      closeConfirm();
    });
  };

  const handleDeleteAllQr = () => {
    showConfirm('Xóa Toàn Bộ Mã QR', 'CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ mã QR của tất cả các bàn?', async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tables/qr/delete-all`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setSelectedTableIds([]);
          fetchTables();
        }
      } catch (err) { alert("Lỗi khi xóa toàn bộ QR"); }
      closeConfirm();
    });
  };


  // --- LỌC DỮ LIỆU ---
  const countAvailable = tables.filter((t) => t.status === 'available').length;
  const countOccupied = tables.filter((t) => t.status === 'occupied').length;
  const totalSeats = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);

  const filteredTables = tables.filter((t) => {
    const matchSearch = t.table_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' ? true : t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="container-fluid px-1">
      {/* 4 THẺ THỐNG KÊ */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="p-3 bg-light rounded-4 border d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Tổng số bàn</div>
              <div className="fw-bold fs-5 text-dark">{tables.length} bàn</div>
            </div>
            <Armchair size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-success bg-opacity-10 rounded-4 border border-success-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-success small fw-semibold">Bàn đang trống</div>
              <div className="fw-bold fs-5 text-success">{countAvailable} bàn</div>
            </div>
            <div className="rounded-circle bg-success" style={{ width: '12px', height: '12px' }} />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-warning bg-opacity-10 rounded-4 border border-warning-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-warning-emphasis small fw-semibold">Đang có khách</div>
              <div className="fw-bold fs-5 text-warning-emphasis">{countOccupied} bàn</div>
            </div>
            <div className="rounded-circle bg-warning" style={{ width: '12px', height: '12px' }} />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-light rounded-4 border d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Tổng sức chứa</div>
              <div className="fw-bold fs-5 text-dark">{totalSeats} ghế</div>
            </div>
            <Users size={22} className="text-primary" />
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* CỘT TRÁI: THÊM BÀN & TẠO HÀNG LOẠT */}
        <div className="col-12 col-lg-4">
          {/* Card 1: Thêm / Sửa 1 bàn */}
          <div className="card border shadow-none rounded-4 mb-3">
            <div className={`card-header text-white rounded-top-4 py-3 d-flex justify-content-between align-items-center ${editingTable ? 'bg-warning text-dark' : 'bg-primary'}`}>
              <div className="d-flex align-items-center gap-2 fw-semibold">
                <Plus size={18} />
                <span>{editingTable ? `Sửa: ${editingTable.table_number}` : 'Thêm Bàn Mới & Tạo QR'}</span>
              </div>
              {editingTable && (
                <button type="button" onClick={() => { setEditingTable(null); setSingleForm({ table_number: '', capacity: 4, status: 'available' }); }} className="btn btn-sm btn-light py-0 px-2 small">Hủy</button>
              )}
            </div>
            <div className="card-body">
              <form onSubmit={handleSaveSingleTable}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Tên / Số hiệu bàn *</label>
                  <input type="text" required placeholder="VD: Bàn 01..." value={singleForm.table_number} onChange={(e) => setSingleForm({ ...singleForm, table_number: e.target.value })} className="form-control form-control-sm rounded-3 py-2" />
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-semibold text-secondary">Số ghế ngồi</label>
                    <input type="number" min="1" max="30" value={singleForm.capacity} onChange={(e) => setSingleForm({ ...singleForm, capacity: e.target.value })} className="form-control form-control-sm rounded-3 py-2" />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold text-secondary">Trạng thái mặc định</label>
                    <select value={singleForm.status} onChange={(e) => setSingleForm({ ...singleForm, status: e.target.value })} className="form-select form-select-sm rounded-3 py-2">
                      <option value="available">🟢 Bàn trống</option>
                      <option value="occupied">🟡 Đang phục vụ</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={loading} className={`btn btn-sm w-100 py-2 fw-semibold rounded-3 ${editingTable ? 'btn-warning' : 'btn-primary'}`}>
                  {editingTable ? 'Lưu Cập Nhật Bàn' : '+ Tạo Bàn & Sinh Mã QR'}
                </button>
              </form>
            </div>
          </div>

          {/* Card 2: Tạo nhanh nhiều bàn */}
          <div className="card border shadow-none rounded-4 bg-light">
            <div className="card-body">
              <h6 className="fw-bold small mb-1 d-flex align-items-center gap-2"><Layers size={16} className="text-primary" /> Khởi tạo nhanh nhiều bàn</h6>
              <p className="text-muted mb-3" style={{ fontSize: '12px' }}>Tự động sinh hàng loạt bàn ăn kèm mã QR riêng biệt chỉ trong 1 lần bấm.</p>
              <button type="button" onClick={() => setShowBulkModal(!showBulkModal)} className="btn btn-outline-primary btn-sm w-100 rounded-3 fw-semibold">⚡ Tạo Hàng Loạt Bàn</button>
              {showBulkModal && (
                <form onSubmit={handleBulkCreate} className="mt-3 pt-3 border-top animate__animated animate__fadeIn">
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Tiền tố tên bàn</label>
                    <input type="text" value={bulkForm.prefix} onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })} className="form-control form-control-sm" />
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Từ số</label>
                      <input type="number" min="1" value={bulkForm.start_num} onChange={(e) => setBulkForm({ ...bulkForm, start_num: e.target.value })} className="form-control form-control-sm" />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Đến số</label>
                      <input type="number" min="1" value={bulkForm.end_num} onChange={(e) => setBulkForm({ ...bulkForm, end_num: e.target.value })} className="form-control form-control-sm" />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Số ghế</label>
                      <input type="number" min="1" value={bulkForm.capacity} onChange={(e) => setBulkForm({ ...bulkForm, capacity: e.target.value })} className="form-control form-control-sm" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn btn-success btn-sm w-100 mt-2 fw-semibold">Xác Nhận Tạo Bàn</button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: DANH SÁCH SƠ ĐỒ BÀN & MÃ QR */}
        <div className="col-12 col-lg-8">
          <div className="card border shadow-none rounded-4">
            <div className="card-body">
              
              {/* HÀNG 1: TIÊU ĐỀ & NÚT THAO TÁC CHÍNH */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="fw-bold mb-0">Danh Sách Bàn & Mã QR</h5>
                  <small className="text-muted">Quản lý sơ đồ, mã QR và trạng thái bàn ăn</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <button type="button" onClick={handleDeleteAllQr} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 rounded-3 fw-semibold">
                    <Trash2 size={15} /> Xóa Tất Cả QR
                  </button>
                  <button type="button" onClick={handlePrintAllQrCards} disabled={filteredTables.length === 0} className="btn btn-primary btn-sm d-flex align-items-center gap-1 fw-semibold px-3 rounded-3">
                    <Printer size={15} /> In QR ({filteredTables.length})
                  </button>
                </div>
              </div>

              {/* HÀNG 2: THANH CÔNG CỤ (TÌM KIẾM, LỌC, CHỌN) */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 p-2 bg-light rounded-3 border">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="input-group input-group-sm" style={{ width: '180px' }}>
                    <span className="input-group-text bg-white border-end-0"><Search size={14} className="text-muted" /></span>
                    <input type="text" placeholder="Tìm số bàn..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-control bg-white border-start-0 shadow-none" />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select form-select-sm bg-white shadow-none" style={{ width: '155px' }}>
                    <option value="ALL">Trạng thái: Tất cả</option>
                    <option value="available">🟢 Bàn trống</option>
                    <option value="occupied">🟡 Đang phục vụ</option>
                    <option value="paying">🔵 Chờ thanh toán</option>
                    <option value="reserved">⚪ Đã đặt trước</option>
                  </select>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="form-check d-flex align-items-center gap-2 mb-0">
                    <input type="checkbox" className="form-check-input mt-0 shadow-none" id="selectAllCheckbox" checked={selectedTableIds.length === filteredTables.length && filteredTables.length > 0} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                    <label className="form-check-label small fw-semibold text-muted" htmlFor="selectAllCheckbox" style={{ cursor: 'pointer' }}>Chọn tất cả</label>
                  </div>
                  {selectedTableIds.length > 0 && (
                    <button onClick={handleDeleteSelectedQr} className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 animate__animated animate__fadeIn">
                      <Trash2 size={14} /> Xóa {selectedTableIds.length} QR đã chọn
                    </button>
                  )}
                </div>
              </div>

              {/* DANH SÁCH THẺ BÀN */}
              {filteredTables.length === 0 ? (
                <div className="text-center text-muted py-5 bg-light rounded-4 border">
                  <QrCode size={36} className="mb-2 opacity-50" />
                  <div className="small">Chưa có bàn nào trong hệ thống. Hãy thêm bàn ở cột bên trái.</div>
                </div>
              ) : (
                <div className="row g-3">
                  {filteredTables.map((t) => {
                    const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.available;
                    const isSelected = selectedTableIds.includes(t.id);
                    return (
                      <div className="col-12 col-sm-6 col-xl-4" key={t.id}>
                        <div className={`card h-100 rounded-4 shadow-sm border ${isSelected ? 'border-danger' : ''}`} style={{ borderWidth: isSelected ? '2px' : '1px' }}>
                          <div className="card-body p-3 d-flex flex-column justify-content-between">
                            
                            {/* HEADER THẺ BÀN */}
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <div className="d-flex align-items-start gap-2">
                                <input type="checkbox" className="form-check-input mt-1 shadow-none" checked={isSelected} onChange={() => toggleSelectTable(t.id)} style={{ cursor: 'pointer', width: '18px', height: '18px' }} />
                                <div>
                                  <h6 className="fw-bold mb-0 text-dark">{t.table_number}</h6>
                                  <small className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '12px' }}><Users size={12} /> {t.capacity} ghế</small>
                                </div>
                              </div>
                              <span className={`badge rounded-pill ${st.badgeClass}`} style={{ fontSize: '11px' }}>{st.label}</span>
                            </div>

                            {/* Ảnh Mã QR */}
                            <div onClick={() => setSelectedQrTable(t)} style={{ cursor: 'pointer' }} className="my-2 p-2 bg-light rounded-3 border text-center transition-all hover-shadow" title="Bấm để phóng to">
                              <img src={getQrUrl(t.qr_image_url)} alt={`QR ${t.table_number}`} className="rounded" style={{ width: '125px', height: '125px', objectFit: 'contain' }} />
                              <div className="text-primary fw-semibold mt-1" style={{ fontSize: '11px' }}>Bấm phóng to / In QR</div>
                            </div>

                            {/* Thanh thao tác nhanh */}
                            <div className="d-flex justify-content-between align-items-center pt-2 border-top gap-1 flex-wrap">
                              <button type="button" onClick={() => handleCopyLink(t)} className="btn btn-sm btn-light border flex-grow-1 d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '11px' }} title="Sao chép link">
                                {copiedId === t.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                {copiedId === t.id ? 'Đã chép' : 'Link'}
                              </button>
                              <button type="button" onClick={() => setSelectedQrTable(t)} className="btn btn-sm btn-outline-info" title="Xem Token"><Key size={13} /></button>
                              <button type="button" onClick={() => handlePrintQrCard(t)} className="btn btn-sm btn-outline-primary" title="In QR"><Printer size={13} /></button>
                              <button type="button" onClick={() => { setEditingTable(t); setSingleForm({ table_number: t.table_number, capacity: t.capacity, status: t.status }); }} className="btn btn-sm btn-outline-secondary" title="Sửa"><Edit3 size={13} /></button>
                              <button type="button" onClick={() => handleDeleteTable(t)} className="btn btn-sm btn-outline-danger" title="Xóa"><Trash2 size={13} /></button>
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CHI TIẾT MÃ QR BÀN & TOKEN */}
      {selectedQrTable && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, backdropFilter: 'blur(4px)' }} onClick={() => setSelectedQrTable(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg animate__animated animate__zoomIn">
              <div className="modal-header border-bottom-0 pb-0">
                <h6 className="modal-title fw-bold">Mã QR Đặt Món — {selectedQrTable.table_number}</h6>
                <button type="button" className="btn-close" onClick={() => setSelectedQrTable(null)} />
              </div>
              <div className="modal-body text-center p-4">
                <div className="p-3 bg-light rounded-4 border d-inline-block mb-3 shadow-sm">
                  <img src={getQrUrl(selectedQrTable.qr_image_url)} alt="QR Code" style={{ width: '230px', height: '230px' }} />
                </div>
                
                <div className="small text-muted mb-2 text-break bg-light p-2 rounded border text-start">
                  <div className="fw-bold text-dark mb-1">Link gọi món:</div>
                  {selectedQrTable.order_url}
                </div>

                <div className="small text-muted mb-4 text-break bg-warning bg-opacity-10 p-2 rounded border border-warning text-start">
                  <div className="fw-bold text-dark mb-1 d-flex justify-content-between align-items-center">
                    <span>Mã Token:</span>
                    <button className="btn btn-sm btn-warning py-0 px-2 fw-bold" onClick={() => {
                      navigator.clipboard.writeText(selectedQrTable.qr_code_token);
                      alert("Đã copy Token!");
                    }}>Copy</button>
                  </div>
                  <code>{selectedQrTable.qr_code_token}</code>
                </div>

                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <button onClick={() => handleDownloadQr(selectedQrTable)} className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3">
                    <Download size={15} /> Tải PNG
                  </button>
                  <button onClick={() => handlePrintQrCard(selectedQrTable)} className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 px-3">
                    <Printer size={15} /> In thẻ
                  </button>
                  <a href={selectedQrTable.order_url} target="_blank" rel="noreferrer" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 px-3">
                    <ExternalLink size={15} /> Mở Link
                  </a>
                  <button onClick={() => handleRegenerateQr(selectedQrTable.id)} className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1 px-3 text-dark">
                    <RefreshCw size={15} /> Cấp lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN CHUYÊN NGHIỆP */}
      {confirmModal.isOpen && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 3000, backdropFilter: 'blur(4px)' }} onClick={closeConfirm}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg animate__animated animate__zoomIn">
              <div className="modal-body p-4 text-center">
                <div className="bg-danger bg-opacity-10 text-danger rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '70px', height: '70px' }}>
                  <AlertTriangle size={36} />
                </div>
                <h5 className="fw-bold mb-2 text-dark">{confirmModal.title}</h5>
                <p className="text-muted mb-4">{confirmModal.message}</p>
                <div className="d-flex gap-2 justify-content-center">
                  <button onClick={closeConfirm} className="btn btn-light fw-bold px-4 py-2 rounded-3 border flex-fill">Hủy bỏ</button>
                  <button onClick={confirmModal.onConfirm} className="btn btn-danger fw-bold px-4 py-2 rounded-3 shadow-sm flex-fill">Đồng ý</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}