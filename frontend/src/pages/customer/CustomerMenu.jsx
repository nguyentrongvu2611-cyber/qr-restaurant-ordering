import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Plus, Minus, Utensils, ShoppingBag, 
  X, CheckCircle2, AlertCircle, Send, ChevronRight, MapPin, Clock
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); 

  // --- STATE ---
  const [tableInfo, setTableInfo] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchMenu, setSearchMenu] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showCart, setShowCart] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- HÀM LẤY LỊCH SỬ ĐẶT MÓN ---
  const fetchMyOrders = async () => {
    if (!tableInfo?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/table/${tableInfo.id}/active`);
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data.items || []);
      }
    } catch (err) { console.error(err); }
  };

  // --- 1. LẤY DỮ LIỆU BÀN VÀ MENU ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!token) {
          setError("Không tìm thấy mã bàn. Vui lòng quét lại mã QR.");
          setLoading(false);
          return;
        }

        const resTable = await fetch(`${API_BASE}/api/tables/qr/${token}`);
        if (resTable.ok) {
          const tableData = await resTable.json();
          setTableInfo(tableData);
        } else {
          setTableInfo({ name: 'Bàn đang chọn' });
        }

        const resProducts = await fetch(`${API_BASE}/api/products`);
        if (resProducts.ok) {
          setMenuItems(await resProducts.json());
        }
      } catch (err) {
        console.error(err);
        setError("Lỗi kết nối đến máy chủ.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Tự động load lịch sử khi đã có thông tin bàn
  useEffect(() => {
    if (tableInfo) fetchMyOrders();
  }, [tableInfo, showHistory]);

  // Trích xuất danh mục
  const categories = ['Tất cả', ...new Set(menuItems.map(item => item.category_name || item.category?.name || 'Khác'))];

  // --- 2. XỬ LÝ GIỎ HÀNG ---
  const handleAddToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { ...item, qty: 1, note: '' }]);
    }
  };

  const handleRemoveFromCart = (itemId) => {
    const existing = cart.find(c => c.id === itemId);
    if (existing.qty > 1) {
      setCart(cart.map(c => c.id === itemId ? { ...c, qty: c.qty - 1 } : c));
    } else {
      setCart(cart.filter(c => c.id !== itemId));
    }
  };

  const handleItemNoteChange = (itemId, noteText) => {
    setCart(cart.map(c => c.id === itemId ? { ...c, note: noteText } : c));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // --- 3. GỬI ĐƠN HÀNG ---
  const handleSubmitOrder = async () => {
    if (!tableInfo) return alert("Lỗi: Không xác định được bàn!");
    if (cart.length === 0) return alert("Giỏ hàng đang trống!");

    setSubmitting(true);
    try {
      const orderPayload = {
        table_id: tableInfo.id,
        customer_note: note,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.qty,
          note: item.note
        }))
      };

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (res.ok) {
        setShowCart(false);
        setCart([]);
        setNote('');
        alert("Đặt món thành công! Vui lòng chờ nhân viên xác nhận nhé.");
        fetchMyOrders(); // Load lại lịch sử ngay lập tức
      } else {
        const errData = await res.json();
        alert(`Lỗi: ${errData.detail || 'Không thể tạo đơn hàng'}`);
      }
    } catch (err) {
      alert("Lỗi kết nối khi gửi đơn hàng!");
    } finally {
      setSubmitting(false);
    }
  };

  // Lọc món ăn
  const filteredMenu = menuItems.filter(item => {
    if (!item.is_available) return false;
    const itemCategory = item.category_name || item.category?.name || 'Khác';
    const matchCategory = activeCategory === 'Tất cả' || itemCategory === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchMenu.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (loading) return <div className="vh-100 d-flex align-items-center justify-content-center fw-bold text-primary">Đang tải thực đơn...</div>;
  if (error) return <div className="vh-100 d-flex flex-column align-items-center justify-content-center p-4 text-center"><AlertCircle size={48} className="text-danger mb-3"/> <h5>{error}</h5></div>;

  return (
    <div className="vh-100 d-flex justify-content-center bg-light" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* KHUNG APP GIỚI HẠN 480PX */}
      <div className="w-100 h-100 d-flex flex-column position-relative bg-white shadow-sm" style={{ maxWidth: '480px' }}>
        
        {/* HEADER & TÌM KIẾM */}
        <div className="px-3 pt-4 pb-2 shadow-sm sticky-top z-3 bg-white" style={{ borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          
          {/* Thông tin bàn & Nút Lịch sử */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h4 className="fw-bold mb-0 text-dark">Thực Đơn</h4>
              <div className="text-muted small d-flex align-items-center gap-1 mt-1">
                <MapPin size={14} className="text-danger" /> 
                <span className="fw-bold text-danger">{tableInfo?.name || 'Đang tải...'}</span>
              </div>
            </div>
            <button 
              onClick={() => setShowHistory(true)} 
              className="btn btn-outline-primary btn-sm rounded-pill fw-bold d-flex align-items-center gap-1 shadow-sm"
            >
              <Clock size={16} /> Đã gọi ({myOrders.length})
            </button>
          </div>
          
          {/* Thanh tìm kiếm */}
          <div className="input-group bg-light rounded-4 overflow-hidden border-0 mb-3">
            <span className="input-group-text bg-transparent border-0"><Search size={18} className="text-secondary"/></span>
            <input 
              type="text" 
              className="form-control bg-transparent border-0 shadow-none ps-0 text-dark" 
              placeholder="Tìm tên món ăn..." 
              value={searchMenu}
              onChange={(e) => setSearchMenu(e.target.value)}
            />
          </div>

          {/* Thanh danh mục */}
          <div className="d-flex gap-2 overflow-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map((cat, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveCategory(cat)}
                className={`btn btn-sm rounded-pill px-3 fw-semibold flex-shrink-0 ${activeCategory === cat ? 'btn-primary shadow-sm' : 'btn-light border text-secondary'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* DANH SÁCH MÓN ĂN */}
        <div className="flex-grow-1 overflow-auto p-3" style={{ paddingBottom: totalItems > 0 ? '100px' : '20px', backgroundColor: '#f8f9fa' }}>
          
          {filteredMenu.length === 0 && (
            <div className="text-center text-muted mt-5">
              <Search size={48} className="mb-3 opacity-25" />
              <p>Không tìm thấy món ăn nào.</p>
            </div>
          )}

          <div className="d-flex flex-column gap-3">
            {filteredMenu.map(item => {
              const qtyInCart = cart.find(c => c.id === item.id)?.qty || 0;
              return (
                <div key={item.id} className="card border-0 shadow-sm rounded-4 p-2 d-flex flex-row gap-3 bg-white">
                  <img 
                    src={item.image_url ? `${API_BASE}${item.image_url}` : "https://placehold.co/100x100?text=No+Image"} 
                    alt={item.name} 
                    className="rounded-3 object-fit-cover flex-shrink-0" 
                    style={{ width: '90px', height: '90px' }}
                  />
                  <div className="flex-grow-1 d-flex flex-column justify-content-between py-1">
                    <div>
                      <h6 className="fw-bold text-dark mb-1 lh-base" style={{ fontSize: '15px' }}>{item.name}</h6>
                      {item.description && <p className="text-muted small mb-1 text-truncate-2" style={{fontSize: '12px'}}>{item.description}</p>}
                    </div>
                    
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="text-primary fw-bold" style={{ fontSize: '15px' }}>{item.price?.toLocaleString()}đ</span>
                      
                      {qtyInCart === 0 ? (
                        <button onClick={() => handleAddToCart(item)} className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center p-0 shadow-sm" style={{ width: '32px', height: '32px' }}>
                          <Plus size={18} />
                        </button>
                      ) : (
                        <div className="d-flex align-items-center gap-2 bg-primary rounded-pill p-1 shadow-sm">
                          <button onClick={() => handleRemoveFromCart(item.id)} className="btn btn-sm btn-primary text-white rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '26px', height: '26px' }}><Minus size={14}/></button>
                          <span className="fw-bold text-white" style={{ minWidth: '18px', textAlign: 'center', fontSize: '14px' }}>{qtyInCart}</span>
                          <button onClick={() => handleAddToCart(item)} className="btn btn-sm btn-primary text-white rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '26px', height: '26px' }}><Plus size={14}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* THANH GIỎ HÀNG NỔI */}
        {totalItems > 0 && (
          <div className="position-absolute bottom-0 w-100 p-3 animate__animated animate__slideInUp" style={{ zIndex: 1000 }}>
            <button onClick={() => setShowCart(true)} className="btn btn-dark w-100 py-3 rounded-4 d-flex justify-content-between align-items-center px-4 shadow-lg" style={{ backgroundColor: '#1e293b' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="position-relative bg-white text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '34px', height: '34px', fontSize: '15px' }}>
                  {totalItems}
                </div>
                <span className="fw-bold fs-6">Xem giỏ hàng</span>
              </div>
              <div className="d-flex align-items-center gap-1 text-warning fw-bold fs-5">
                {totalAmount.toLocaleString()}đ <ChevronRight size={20} />
              </div>
            </button>
          </div>
        )}

        {/* MODAL GIỎ HÀNG (FULL SCREEN) */}
        {showCart && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center bg-white animate__animated animate__fadeIn" style={{ zIndex: 2000 }}>
            <div className="w-100 h-100 d-flex flex-column bg-white" style={{ maxWidth: '480px' }}>
              
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white sticky-top">
                <h5 className="fw-bold mb-0">Giỏ hàng của bạn</h5>
                <button onClick={() => setShowCart(false)} className="btn btn-light rounded-circle p-2 shadow-sm">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-grow-1 overflow-auto p-3 bg-light">
                <div className="border rounded-4 overflow-hidden bg-white shadow-sm mb-3">
                  {cart.map((item, index) => (
                    <div key={item.id} className={`p-3 ${index !== cart.length - 1 ? 'border-bottom' : ''}`}>
                      <div className="d-flex gap-3 align-items-start">
                        <img 
                          src={item.image_url ? `${API_BASE}${item.image_url}` : "https://placehold.co/100x100?text=No+Image"} 
                          alt={item.name} 
                          className="rounded-3 object-fit-cover flex-shrink-0 border" 
                          style={{ width: '60px', height: '60px' }}
                          onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=No+Image'; }}
                        />
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <div className="fw-bold text-dark" style={{ fontSize: '14px', lineHeight: '1.3' }}>
                              {item.name}
                            </div>
                            <div className="fw-bold text-primary ms-2 text-nowrap" style={{ fontSize: '14px' }}>
                              {(item.price * item.qty).toLocaleString()}đ
                            </div>
                          </div>
                          
                          <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
                            <input 
                              type="text" 
                              className="form-control form-control-sm bg-light border-0 shadow-none" 
                              placeholder="Ghi chú món..." 
                              value={item.note}
                              onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                              style={{ fontSize: '12px', height: '28px' }}
                            />
                            <div className="d-flex align-items-center bg-light rounded-pill border flex-shrink-0">
                              <button onClick={() => handleRemoveFromCart(item.id)} className="btn btn-sm btn-link text-dark p-0 px-2 text-decoration-none"><Minus size={14}/></button>
                              <span className="fw-bold" style={{ minWidth: '20px', textAlign: 'center', fontSize: '13px' }}>{item.qty}</span>
                              <button onClick={() => handleAddToCart(item)} className="btn btn-sm btn-link text-primary p-0 px-2 text-decoration-none"><Plus size={14}/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="bg-white p-3 border-top">
                    <label className="form-label text-muted small fw-bold mb-1">Ghi chú chung cho đơn:</label>
                    <input 
                      type="text" 
                      className="form-control bg-light border-0 shadow-none" 
                      placeholder="VD: Lên món dần, thêm chén..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 border-top shadow-lg">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted fw-semibold">Tổng thanh toán</span>
                  <span className="fw-bold fs-4 text-primary">{totalAmount.toLocaleString()}đ</span>
                </div>
                <button 
                  onClick={handleSubmitOrder} 
                  disabled={submitting}
                  className="btn btn-primary w-100 py-3 rounded-4 fw-bold shadow d-flex justify-content-center align-items-center gap-2"
                  style={{ fontSize: '16px' }}
                >
                  {submitting ? 'Đang gửi đơn...' : <><Send size={18} /> Xác Nhận Đặt Món</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL LỊCH SỬ ĐẶT MÓN */}
        {showHistory && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-end flex-column animate__animated animate__fadeIn" style={{ zIndex: 2500, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white w-100 rounded-top-4 p-3 animate__animated animate__slideInUp d-flex flex-column" style={{ maxHeight: '85vh', maxWidth: '480px', margin: '0 auto' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">Món đã gọi ({tableInfo?.name})</h5>
                <button onClick={() => setShowHistory(false)} className="btn btn-light rounded-circle p-2"><X size={20} /></button>
              </div>

              <div className="overflow-auto flex-grow-1 mb-3">
                {myOrders.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <Utensils size={48} className="mb-3 opacity-25" />
                    <p>Bạn chưa gọi món nào.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {myOrders.map((item, idx) => (
                      <div key={idx} className="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 border">
                        <div>
                          <div className="fw-bold text-dark">
                            <span className="text-danger me-2">{item.qty}x</span> 
                            {item.name}
                          </div>
                          {item.note && <div className="text-muted small mt-1">* {item.note}</div>}
                          
                          <div className="mt-1">
                            {item.status === 'pending' && <span className="badge bg-secondary">Chờ xác nhận</span>}
                            {item.status === 'cooking' && <span className="badge bg-warning text-dark">Bếp đang nấu</span>}
                            {item.status === 'ready' && <span className="badge bg-info text-dark">Đã nấu xong</span>}
                            {item.status === 'served' && <span className="badge bg-success">Đã lên món</span>}
                          </div>
                        </div>
                        <div className="fw-bold text-primary">{(item.price * item.qty).toLocaleString()}đ</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}