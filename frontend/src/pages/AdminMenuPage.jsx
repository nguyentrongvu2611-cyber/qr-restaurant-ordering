import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';

export default function AdminMenuPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [catForm, setCatForm] = useState({ id: null, name: '', description: '', display_order: 0 });
  const [prodForm, setProdForm] = useState({
    id: null, category_id: '', name: '', price: '', description: '', image_url: '', is_available: true,
  });

  const fetchData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([api.get('/admin/categories'), api.get('/admin/products')]);
      setCategories(catRes.data);
      setProducts(prodRes.data);
      if (catRes.data.length > 0 && !prodForm.category_id) {
        setProdForm((prev) => ({ ...prev, category_id: catRes.data[0].id }));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    try {
      if (catForm.id) await api.put(`/admin/categories/${catForm.id}`, catForm);
      else await api.post('/admin/categories', catForm);
      setCatForm({ id: null, name: '', description: '', display_order: 0 });
      fetchData();
    } catch (err) { alert(err.response?.data?.detail || 'Lỗi lưu danh mục'); }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Xóa danh mục này?')) return;
    try { await api.delete(`/admin/categories/${id}`); fetchData(); }
    catch (err) { alert(err.response?.data?.detail || 'Không thể xóa danh mục'); }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...prodForm, category_id: Number(prodForm.category_id), price: Number(prodForm.price) };
      if (prodForm.id) await api.put(`/admin/products/${prodForm.id}`, payload);
      else await api.post('/admin/products', payload);
      setProdForm({ id: null, category_id: categories[0]?.id || '', name: '', price: '', description: '', image_url: '', is_available: true });
      fetchData();
    } catch (err) { alert(err.response?.data?.detail || 'Lỗi lưu món ăn'); }
  };

  const handleToggleAvailable = async (prod) => {
    await api.put(`/admin/products/${prod.id}`, { is_available: !prod.is_available });
    fetchData();
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Xóa món ăn này?')) return;
    await api.delete(`/admin/products/${id}`);
    fetchData();
  };

  return (
    <AdminLayout title="2. Quản lý Danh mục & Thực đơn (ADM03 - ADM07)">
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">Danh mục Món ăn (ADM04)</div>
            <div className="card-body">
              <form onSubmit={handleSaveCategory} className="mb-4">
                <div className="mb-2">
                  <label className="form-label fw-semibold">Tên danh mục</label>
                  <input type="text" className="form-control" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold">Thứ tự hiển thị</label>
                  <input type="number" className="form-control" value={catForm.display_order} onChange={(e) => setCatForm({ ...catForm, display_order: Number(e.target.value) })} />
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button type="submit" className="btn btn-success flex-grow-1">{catForm.id ? 'Cập nhật' : '+ Thêm danh mục'}</button>
                  {catForm.id && <button type="button" className="btn btn-secondary" onClick={() => setCatForm({ id: null, name: '', description: '', display_order: 0 })}>Hủy</button>}
                </div>
              </form>
              <table className="table table-bordered table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>TT</th><th>Tên danh mục</th><th className="text-center">Thao tác</th></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.display_order}</td>
                      <td className="fw-semibold">{c.name}</td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-warning me-1" onClick={() => setCatForm(c)}>Sửa</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCategory(c.id)}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">Danh sách Món ăn & Giá bán (ADM03, ADM05, ADM06, ADM07)</div>
            <div className="card-body">
              <form onSubmit={handleSaveProduct} className="row g-3 mb-4 border-bottom pb-4">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Danh mục</label>
                  <select className="form-select" value={prodForm.category_id} onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })} required>
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Tên món ăn</label>
                  <input type="text" className="form-control" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Giá bán (VNĐ)</label>
                  <input type="number" className="form-control" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Link hình ảnh (URL)</label>
                  <input type="text" className="form-control" value={prodForm.image_url || ''} onChange={(e) => setProdForm({ ...prodForm, image_url: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Mô tả ngắn</label>
                  <input type="text" className="form-control" value={prodForm.description || ''} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} />
                </div>
                <div className="col-12 d-flex gap-2">
                  <button type="submit" className="btn btn-primary">{prodForm.id ? 'Lưu thay đổi món' : '+ Thêm món mới'}</button>
                  {prodForm.id && <button type="button" className="btn btn-secondary" onClick={() => setProdForm({ id: null, category_id: categories[0]?.id || '', name: '', price: '', description: '', image_url: '', is_available: true })}>Hủy</button>}
                </div>
              </form>
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle mb-0">
                  <thead className="table-light"><tr><th>Hình</th><th>Tên món</th><th>Danh mục</th><th>Giá bán</th><th className="text-center">Tình trạng</th><th className="text-center">Thao tác</th></tr></thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td><img src={p.image_url || 'https://via.placeholder.com/60?text=Mon'} alt={p.name} className="rounded" style={{ width: '50px', height: '50px', objectFit: 'cover' }} /></td>
                        <td><div className="fw-bold">{p.name}</div><small className="text-muted">{p.description}</small></td>
                        <td><span className="badge bg-info text-dark">{p.category_name}</span></td>
                        <td className="fw-bold text-danger">{p.price.toLocaleString('vi-VN')} đ</td>
                        <td className="text-center">
                          <button className={`btn btn-sm ${p.is_available ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => handleToggleAvailable(p)}>
                            {p.is_available ? 'Còn món' : 'Hết món'}
                          </button>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-warning me-1" onClick={() => setProdForm(p)}>Sửa</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteProduct(p.id)}>Xóa</button>
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
    </AdminLayout>
  );
}
