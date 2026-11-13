import React, { useState, useEffect } from 'react';
import {
  FolderPlus, Plus, Trash2, Search, Utensils, Coffee,
  CheckCircle2, XCircle, Image as ImageIcon, Layers,
  Edit3, EyeOff
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function ManageMenuPage() {
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stationFilter, setStationFilter] = useState('ALL');

  const [editingCatId, setEditingCatId] = useState(null);
  const [catForm, setCatForm] = useState({
    name: '',
    description: '',
    target_station: 'KITCHEN',
    display_order: 1,
    is_active: true,
  });

  const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
  };
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProdId, setEditingProdId] = useState(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    price: '',
    category_id: '',
    description: '',
    image_url: '',
    is_available: true,
  });

  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('access_token');
  const [uploadingImage, setUploadingImage] = useState(false);

const handleImageUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploadingImage(true);
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/api/menu/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setProdForm((prev) => ({ ...prev, image_url: data.image_url }));
    } else {
      const err = await res.json();
      alert(err.detail || 'Tải ảnh thất bại');
    }
  } catch (err) {
    console.error('Lỗi upload ảnh:', err);
    alert('Không thể kết nối server để tải ảnh');
  } finally {
    setUploadingImage(false);
  }
};
  const fetchAllData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/api/menu/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
        if (catData.length > 0 && !prodForm.category_id) {
          setProdForm((prev) => ({ ...prev, category_id: catData[0].id }));
        }
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setAllProducts(prodData);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu thực đơn:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const resetCatForm = () => {
    setEditingCatId(null);
    setCatForm({
      name: '',
      description: '',
      target_station: 'KITCHEN',
      display_order: categories.length + 1,
      is_active: true,
    });
  };

  const handleEditCategoryClick = (e, cat) => {
    e.stopPropagation();
    setEditingCatId(cat.id);
    setCatForm({
      name: cat.name,
      description: cat.description || '',
      target_station: cat.target_station || 'KITCHEN',
      display_order: cat.display_order || 0,
      is_active: cat.is_active,
    });
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    setLoading(true);
    try {
      const url = editingCatId
        ? `${API_BASE}/api/menu/categories/${editingCatId}`
        : `${API_BASE}/api/menu/categories`;
      const method = editingCatId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...catForm,
          display_order: parseInt(catForm.display_order, 10) || 0,
        }),
      });
      if (res.ok) {
        resetCatForm();
        fetchAllData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Lỗi lưu danh mục');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (e, catId) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa danh mục này?')) return;
    const res = await fetch(`${API_BASE}/api/menu/categories/${catId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      if (selectedCatId === catId) setSelectedCatId(null);
      if (editingCatId === catId) resetCatForm();
      fetchAllData();
    } else {
      const err = await res.json();
      alert(err.detail || 'Không thể xóa danh mục');
    }
  };

  const openAddProductForm = () => {
    if (categories.length === 0) {
      alert('Bạn cần tạo ít nhất 1 danh mục bên cột trái trước khi thêm món!');
      return;
    }
    setEditingProdId(null);
    setProdForm({
      name: '',
      price: '',
      category_id: selectedCatId || categories[0]?.id || '',
      description: '',
      image_url: '',
      is_available: true,
    });
    setShowProductForm(true);
  };

  const openEditProductForm = (prod) => {
    setEditingProdId(prod.id);
    setProdForm({
      name: prod.name,
      price: prod.price,
      category_id: prod.category_id,
      description: prod.description || '',
      image_url: prod.image_url || '',
      is_available: prod.is_available,
    });
    setShowProductForm(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingProdId
        ? `${API_BASE}/api/menu/products/${editingProdId}`
        : `${API_BASE}/api/menu/products`;
      const method = editingProdId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...prodForm,
          price: parseFloat(prodForm.price),
          category_id: parseInt(prodForm.category_id, 10),
        }),
      });
      if (res.ok) {
        setShowProductForm(false);
        setEditingProdId(null);
        fetchAllData();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProduct = async (prodId) => {
    const res = await fetch(`${API_BASE}/api/menu/products/${prodId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchAllData();
  };

  const handleDeleteProduct = async (prodId) => {
    if (!window.confirm('Xóa món này khỏi thực đơn?')) return;
    const res = await fetch(`${API_BASE}/api/menu/products/${prodId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchAllData();
  };

  const availableCount = allProducts.filter((p) => p.is_available).length;
  const outOfStockCount = allProducts.length - availableCount;

  const displayedProducts = allProducts.filter((p) => {
    const matchCat = selectedCatId ? p.category_id === selectedCatId : true;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'AVAILABLE'
        ? p.is_available
        : !p.is_available;
    const matchStation = stationFilter === 'ALL' ? true : p.station === stationFilter;
    return matchCat && matchSearch && matchStatus && matchStation;
  });

  return (
    <div className="container-fluid px-1">
      {/* 4 THẺ THỐNG KÊ THỰC TẾ TỪ MYSQL */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="p-3 bg-light rounded-4 border d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Danh mục thực đơn</div>
              <div className="fw-bold fs-5 text-dark">{categories.length} nhóm</div>
            </div>
            <Layers size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-light rounded-4 border d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Tổng món thực đơn</div>
              <div className="fw-bold fs-5 text-dark">{allProducts.length} món</div>
            </div>
            <Utensils size={22} className="text-primary" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-success bg-opacity-10 rounded-4 border border-success-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-success small fw-semibold">Đang phục vụ</div>
              <div className="fw-bold fs-5 text-success">{availableCount} món</div>
            </div>
            <CheckCircle2 size={22} className="text-success" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 bg-danger bg-opacity-10 rounded-4 border border-danger-subtle d-flex justify-content-between align-items-center">
            <div>
              <div className="text-danger small fw-semibold">Tạm hết hàng</div>
              <div className="fw-bold fs-5 text-danger">{outOfStockCount} món</div>
            </div>
            <XCircle size={22} className="text-danger" />
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* CỘT TRÁI: QUẢN LÝ DANH MỤC */}
        <div className="col-12 col-lg-4">
          <div className="card border shadow-none rounded-4 mb-4">
            <div className={`card-header text-white rounded-top-4 py-3 d-flex justify-content-between align-items-center ${editingCatId ? 'bg-warning text-dark' : 'bg-primary'}`}>
              <div className="d-flex align-items-center gap-2 fw-semibold">
                <FolderPlus size={18} />
                <span>{editingCatId ? 'Chỉnh Sửa Danh Mục' : 'Tạo Danh Mục Thực Đơn'}</span>
              </div>
              {editingCatId && (
                <button type="button" onClick={resetCatForm} className="btn btn-sm btn-light py-0 px-2 small">
                  Hủy sửa
                </button>
              )}
            </div>
            <div className="card-body">
              <form onSubmit={handleSaveCategory}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Tên danh mục *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Khai Vị, Món Chính, Đồ Uống..."
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    className="form-control form-control-sm rounded-3 py-2"
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-8">
                    <label className="form-label small fw-semibold text-secondary">Trạm tiếp nhận *</label>
                    <select
                      value={catForm.target_station}
                      onChange={(e) => setCatForm({ ...catForm, target_station: e.target.value })}
                      className="form-select form-select-sm rounded-3 py-2"
                    >
                      <option value="KITCHEN">👨‍🍳 Bếp Chế Biến</option>
                      <option value="BAR">🍹 Quầy Pha Chế (Bar)</option>
                    </select>
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-semibold text-secondary">Thứ tự hiện</label>
                    <input
                      type="number"
                      min="0"
                      value={catForm.display_order}
                      onChange={(e) => setCatForm({ ...catForm, display_order: e.target.value })}
                      className="form-control form-control-sm rounded-3 py-2"
                    />
                  </div>
                </div>

                <div className="mb-3">
  <label className="form-label small fw-semibold text-secondary">Mô tả ngắn</label>
  <input
    type="text"
    placeholder="Chọn nhanh gợi ý bên dưới hoặc tự nhập..."
    value={catForm.description}
    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
    className="form-control form-control-sm rounded-3 py-2 mb-2"
  />
  <div className="d-flex flex-wrap gap-1">
    {[
      'Phục vụ nóng trong 15–20 phút',
      'Món đặc trưng bán chạy nhất quán',
      'Chế biến tươi mới ngay khi gọi',
      'Dành cho nhóm 2–6 người',
      'Pha chế tươi mát tại quầy Bar',
      'Phục vụ lạnh ngay sau 5 phút',
    ].map((preset, idx) => (
      <button
        key={idx}
        type="button"
        onClick={() => setCatForm({ ...catForm, description: preset })}
        className={`btn btn-sm rounded-pill py-0 px-2 border ${
          catForm.description === preset
            ? 'btn-primary text-white'
            : 'btn-light text-secondary'
        }`}
        style={{ fontSize: '11px' }}
      >
        {preset}
      </button>
    ))}
  </div>
</div>

                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="catActiveSwitch"
                    checked={catForm.is_active}
                    onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })}
                  />
                  <label className="form-check-label small text-secondary" htmlFor="catActiveSwitch">
                    Hiển thị danh mục này trên Menu khách hàng
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-sm w-100 py-2 fw-semibold rounded-3 ${editingCatId ? 'btn-warning' : 'btn-primary'}`}
                >
                  {editingCatId ? 'Lưu Cập Nhật Danh Mục' : '+ Thêm Danh Mục'}
                </button>
              </form>
            </div>
          </div>

          {/* Danh sách danh mục */}
          <div className="card border shadow-none rounded-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                <Layers size={17} className="text-primary" />
                Danh mục hiện có ({categories.length})
              </h6>

              <div className="list-group list-group-flush gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedCatId(null)}
                  className={`list-group-item list-group-item-action border-0 rounded-3 d-flex justify-content-between align-items-center py-2.5 ${
                    selectedCatId === null ? 'bg-primary bg-opacity-10 text-primary fw-semibold' : ''
                  }`}
                >
                  <span>Tất cả món trong thực đơn</span>
                  <span className="badge bg-secondary rounded-pill">{allProducts.length}</span>
                </button>

                {categories.length === 0 ? (
                  <div className="text-center text-muted small py-3">
                    Chưa có danh mục nào trong MySQL.
                  </div>
                ) : (
                  categories.map((cat) => {
                    const isSelected = selectedCatId === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCatId(cat.id)}
                        style={{ cursor: 'pointer' }}
                        className={`list-group-item list-group-item-action border-0 rounded-3 d-flex justify-content-between align-items-center py-2.5 ${
                          isSelected ? 'bg-primary bg-opacity-10 text-primary fw-semibold' : ''
                        }`}
                      >
                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                          <span className="badge bg-light text-muted border" style={{ fontSize: '10px' }}>
                            #{cat.display_order}
                          </span>
                          {cat.target_station === 'BAR' ? (
                            <Coffee size={16} className="text-warning flex-shrink-0" />
                          ) : (
                            <Utensils size={16} className="text-primary flex-shrink-0" />
                          )}
                          <div className="text-truncate">
                            <div className="small d-flex align-items-center gap-1">
                              <span>{cat.name}</span>
                              {!cat.is_active && <EyeOff size={12} className="text-muted" title="Đang ẩn" />}
                            </div>
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              {cat.target_station === 'BAR' ? 'Quầy Bar' : 'Bếp nấu'}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-1">
                          <span className="badge bg-light text-dark border rounded-pill me-1">
                            {cat.product_count}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleEditCategoryClick(e, cat)}
                            className="btn btn-sm btn-link text-secondary p-1"
                            title="Sửa danh mục"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCategory(e, cat.id)}
                            className="btn btn-sm btn-link text-danger p-1"
                            title="Xóa danh mục"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: DANH SÁCH MÓN ĂN & ĐỒ UỐNG */}
        <div className="col-12 col-lg-8">
          <div className="card border shadow-none rounded-4">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-0">
                    {selectedCatId
                      ? `Danh mục: ${categories.find((c) => c.id === selectedCatId)?.name}`
                      : 'Tất cả Món ăn & Đồ uống'}
                  </h5>
                  <small className="text-muted">Quản lý giá bán, hình ảnh và trạng thái phục vụ trực tiếp trên MySQL</small>
                </div>

                <button
                  type="button"
                  onClick={openAddProductForm}
                  className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3 py-2 rounded-3 fw-semibold"
                >
                  <Plus size={16} /> Thêm Món Mới
                </button>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 mb-4 bg-light p-2.5 rounded-3 border">
                <div className="input-group input-group-sm" style={{ maxWidth: '240px' }}>
                  <span className="input-group-text bg-white border-end-0">
                    <Search size={14} className="text-muted" />
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm tên món..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-control bg-white border-start-0"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select form-select-sm bg-white"
                  style={{ width: '160px' }}
                >
                  <option value="ALL">Trạng thái: Tất cả</option>
                  <option value="AVAILABLE">✅ Đang còn món</option>
                  <option value="OUT_OF_STOCK">⛔ Tạm hết hàng</option>
                </select>

                <select
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                  className="form-select form-select-sm bg-white"
                  style={{ width: '165px' }}
                >
                  <option value="ALL">Trạm: Tất cả</option>
                  <option value="KITCHEN">👨‍🍳 Bếp nấu</option>
                  <option value="BAR">🍹 Quầy Bar</option>
                </select>
              </div>

              {showProductForm && (
                <form onSubmit={handleSaveProduct} className="bg-light p-3.5 rounded-4 border mb-4">
                  <h6 className="fw-bold small text-primary mb-3">
                    {editingProdId ? '✏️ Chỉnh Sửa Thông Tin Món' : '➕ Thêm Món Ăn / Đồ Uống Mới'}
                  </h6>
                  <div className="row g-3">
                    <div className="col-md-5">
                      <label className="form-label small fw-semibold">Tên món *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Bò Lúc Lắc Khoai Tây"
                        value={prodForm.name}
                        onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                        className="form-control form-control-sm"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Giá bán (VNĐ) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="1000"
                        placeholder="85000"
                        value={prodForm.price}
                        onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })}
                        className="form-control form-control-sm"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Thuộc danh mục *</label>
                      <select
                        required
                        value={prodForm.category_id}
                        onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })}
                        className="form-select form-select-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
  <label className="form-label small fw-semibold">Hình ảnh món ăn (Chọn từ máy)</label>
  <div className="d-flex gap-2 align-items-center">
    <input
      key={editingProdId || 'new'}
      type="file"
      accept="image/*"
      onChange={handleImageUpload}
      disabled={uploadingImage}
      className="form-control form-control-sm"
    />
    {uploadingImage && (
      <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
    )}
    {prodForm.image_url && !uploadingImage && (
      <img
        src={getImageUrl(prodForm.image_url)}
        alt="Preview"
        className="rounded border object-fit-cover flex-shrink-0"
        style={{ width: '36px', height: '36px' }}
      />
    )}
  </div>
</div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Mô tả thành phần / ghi chú</label>
                      <input
                        type="text"
                        placeholder="VD: Thăn bò Úc 200g, sốt tiêu đen"
                        value={prodForm.description}
                        onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                        className="form-control form-control-sm"
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="btn btn-sm btn-outline-secondary"
                    >
                      Hủy
                    </button>
                    <button type="submit" disabled={loading} className="btn btn-sm btn-success px-4 fw-semibold">
                      {editingProdId ? 'Lưu Thay Đổi' : 'Lưu Món Vào Thực Đơn'}
                    </button>
                  </div>
                </form>
              )}

              <div className="table-responsive">
                <table className="table table-hover align-middle small mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Món ăn / Đồ uống</th>
                      <th>Danh mục & Trạm</th>
                      <th>Đơn giá</th>
                      <th>Trạng thái</th>
                      <th className="text-end">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedProducts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-5">
                          Chưa có món nào trong MySQL. Tạo danh mục bên trái rồi bấm <b>+ Thêm Món Mới</b>.
                        </td>
                      </tr>
                    ) : (
                      displayedProducts.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              {p.image_url ? (
                                <img
                                  src={getImageUrl(p.image_url)}
                                  alt={p.name}
                                  className="rounded-3 object-fit-cover border"
                                  style={{ width: '48px', height: '48px' }}
                                />
                              ) : (
                                <div
                                  className="rounded-3 bg-light border d-flex align-items-center justify-content-center text-muted"
                                  style={{ width: '48px', height: '48px', flexShrink: 0 }}
                                >
                                  <ImageIcon size={18} />
                                </div>
                              )}
                              <div>
                                <div className="fw-semibold text-dark">{p.name}</div>
                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                  {p.description || 'Không có mô tả'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1 align-items-start">
                              <span className="badge bg-primary-subtle text-primary">
                                {p.category_name || 'Chưa phân loại'}
                              </span>
                              <span className="text-muted" style={{ fontSize: '11px' }}>
                                {p.station === 'BAR' ? '🍹 Quầy Bar' : '👨‍🍳 Bếp nấu'}
                              </span>
                            </div>
                          </td>
                          <td className="fw-bold text-dark">
                            {p.price.toLocaleString('vi-VN')}đ
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleToggleProduct(p.id)}
                              className={`btn btn-sm rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1 border-0 ${
                                p.is_available
                                  ? 'bg-success-subtle text-success fw-semibold'
                                  : 'bg-danger-subtle text-danger fw-semibold'
                              }`}
                            >
                              {p.is_available ? (
                                <>
                                  <CheckCircle2 size={14} /> Còn món
                                </>
                              ) : (
                                <>
                                  <XCircle size={14} /> Hết món
                                </>
                              )}
                            </button>
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEditProductForm(p)}
                                className="btn btn-sm btn-outline-secondary rounded-3"
                                title="Sửa món"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="btn btn-sm btn-outline-danger rounded-3"
                                title="Xóa món"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}