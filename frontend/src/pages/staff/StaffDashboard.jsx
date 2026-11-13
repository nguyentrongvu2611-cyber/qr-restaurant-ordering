import React, { useState, useEffect } from 'react';
import {
  Utensils, CheckCircle2, PlusCircle, FileText, 
  LogOut, RefreshCw, AlertTriangle, Clock, Bell,
  User, QrCode, Home, Camera, X, Search, Minus, CreditCard,
  Lock, MessageSquare, Palette, ChevronRight, BookOpen,
  ArrowLeft, Moon, Type, Users
} from 'lucide-react';
import { io } from 'socket.io-client';

const API_BASE = 'http://127.0.0.1:8000';

export default function StaffDashboard() {
  // --- STATE ĐIỀU HƯỚNG ---
  const [currentView, setCurrentView] = useState('HOME');
  const [activeTab, setActiveTab] = useState('PENDING'); // Mặc định vào Tab Chờ
  const [profileSubView, setProfileSubView] = useState('MAIN'); 
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- STATE CÀI ĐẶT GIAO DIỆN ---
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('staff_settings');
    return saved ? JSON.parse(saved) : { darkMode: false, largeText: false }; 
  });

  useEffect(() => {
    localStorage.setItem('staff_settings', JSON.stringify(settings));
  }, [settings]);

  // --- STATE DỮ LIỆU ---
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [outOfStockAlert, setOutOfStockAlert] = useState(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // --- STATE MODALS ---
  const [selectedTable, setSelectedTable] = useState(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [searchMenu, setSearchMenu] = useState('');

  const token = localStorage.getItem('access_token');
  const staffName = localStorage.getItem('full_name') || 'Nguyễn Trọng Vũ';
  const staffId = localStorage.getItem('user_id') || '2311558552'; 
  const avatarLetter = staffName.charAt(0).toUpperCase();

  // --- GỌI API ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const resTables = await fetch(`${API_BASE}/api/tables`, { headers: { Authorization: `Bearer ${token}` } });
      if (resTables.ok) setTables(await resTables.json());

      const resProducts = await fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
      if (resProducts.ok) setMenuItems(await resProducts.json());

      const resOrders = await fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (resOrders && resOrders.ok) setOrders(await resOrders.json());
    } catch (err) {
      console.error('Lỗi đồng bộ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- SOCKET.IO ---
  useEffect(() => {
    let socket = io(API_BASE, { transports: ['websocket'], auth: { token: token } });
    
    socket.on('connect', () => console.log('🔗 Socket.IO Connected'));

    socket.on('item_out_of_stock', (data) => {
      setOutOfStockAlert({
        tableName: data.table_name || 'Bàn không xác định',
        itemName: data.item_name || 'Món không xác định',
        message: data.message || 'Bếp vừa báo hết món này.'
      });
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [token]);

  const executeLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  // --- HÀM XỬ LÝ GIỎ HÀNG ---
  const handleAddItemToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    else setCart([...cart, { ...item, qty: 1 }]);
  };

  const handleRemoveItemFromCart = (itemId) => {
    const existing = cart.find(c => c.id === itemId);
    if (existing.qty > 1) setCart(cart.map(c => c.id === itemId ? { ...c, qty: c.qty - 1 } : c));
    else setCart(cart.filter(c => c.id !== itemId));
  };

  const submitAddItems = (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Chưa chọn món nào!");
    alert(`Đã gửi ${cart.length} loại món xuống Bếp cho ${selectedTable.table_number || selectedTable.name}`);
    setShowAddItemModal(false);
    setCart([]);
  };

  // --- LỌC DỮ LIỆU (ĐÃ SỬA LỖI) ---
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  
  // Sửa lại để nhận diện trạng thái 'occupied' của Backend
  const activeTables = tables.filter((t) => {
    const status = (t.status || '').toLowerCase();
    return status === 'occupied' || status === 'busy' || status === 'payment_pending';
  });

  const filteredMenu = menuItems.filter(item => item.name.toLowerCase().includes(searchMenu.toLowerCase()));

  const renderSubPageHeader = (title) => (
    <div className="d-flex align-items-center mb-3 p-3 shadow-sm sticky-top" style={{ top: 0, zIndex: 1000, backgroundColor: settings.darkMode ? '#1e1e1e' : '#fff', color: settings.darkMode ? '#fff' : '#000' }}>
      <button onClick={() => setProfileSubView('MAIN')} className={`btn ${settings.darkMode ? 'btn-dark' : 'btn-light'} rounded-circle p-2 me-3`}>
        <ArrowLeft size={20} />
      </button>
      <h5 className="fw-bold mb-0">{title}</h5>
    </div>
  );

  const handleConfirmOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/confirm`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Đã duyệt đơn hàng! Đơn đã được chuyển xuống Bếp.");
        fetchData(); // Load lại danh sách để đơn biến mất khỏi tab Chờ
      } else {
        alert("Lỗi khi duyệt đơn!");
      }
    } catch (err) {
      alert("Lỗi kết nối!");
    }
  };

  const themeClass = settings.darkMode ? 'dark-mode' : '';
  const textSizeClass = settings.largeText ? 'text-large' : '';

  return (
    <div className={`vh-100 d-flex flex-column position-relative ${themeClass} ${textSizeClass}`} 
         style={{ backgroundColor: settings.darkMode ? '#121212' : '#f4f6f9', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* CSS CHO DARK MODE VÀ LARGE TEXT */}
      <style dangerouslySetInnerHTML={{__html: `
        .dark-mode .bg-white, .dark-mode .card, .dark-mode .list-group-item { background-color: #1e1e1e !important; border-color: #333 !important; }
        .dark-mode .text-dark { color: #f8f9fa !important; }
        .dark-mode .text-muted { color: #adb5bd !important; }
        .dark-mode .bg-light { background-color: #2c2c2c !important; color: #f8f9fa !important; }
        .dark-mode .border-bottom-light { border-bottom: 1px solid #333 !important; }
        .dark-mode .card-hover { border-color: #333; }
        
        .text-large { font-size: 18px; }
        .text-large .small, .text-large .badge, .text-large .fw-semibold, .text-large .fs-6 { font-size: 15px !important; }
        
        .card-hover:active { transform: scale(0.98); }
        .btn-press:active { transform: scale(0.95); }
        .glow-effect { box-shadow: 0 0 15px rgba(13, 110, 253, 0.4); }
        @keyframes scanAnim { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      `}} />

      {/* THÔNG BÁO ĐỎ KHẨN CẤP */}
      {outOfStockAlert && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-4 p-4 mx-4 text-center animate__animated animate__shakeX">
            <div className="bg-danger bg-opacity-10 text-danger p-3 rounded-circle d-inline-flex mb-3">
              <AlertTriangle size={48} />
            </div>
            <h5 className="fw-bold text-danger mb-2">Bếp báo hết món!</h5>
            <p className="text-dark mb-1"><b>{outOfStockAlert.tableName}</b> đã gọi <b>{outOfStockAlert.itemName}</b>.</p>
            <div className="d-flex gap-2 mt-4">
              <button onClick={() => setOutOfStockAlert(null)} className="btn btn-light flex-grow-1 fw-bold">Để sau</button>
              <button onClick={() => { alert("Đã gửi yêu cầu hủy!"); setOutOfStockAlert(null); }} className="btn btn-danger flex-grow-1 fw-bold">Báo Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER TRANG CHỦ */}
      {!showScanner && currentView === 'HOME' && (
        <header 
          className="px-3 py-3 sticky-top text-white shadow-sm position-relative" 
          style={{ background: 'linear-gradient(135deg, #004b93 0%, #0066cc 100%)', zIndex: 1030, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', marginBottom: '10px' }}
        >
          <button 
            onClick={fetchData} 
            className="position-absolute top-0 end-0 m-3 border-0 bg-transparent text-white btn-press" 
            style={{ width: '38px', height: '38px', zIndex: 10 }}
          >
            <RefreshCw size={22} className={loading ? 'spin-anim' : ''} />
          </button>

          <div className="d-flex align-items-center gap-3 pe-5">
            <div className="position-relative flex-shrink-0">
              <div className="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: '46px', height: '46px', fontSize: '18px' }}>
                {avatarLetter}
              </div>
              <span className="position-absolute bottom-0 end-0 bg-success border border-white border-2 rounded-circle" style={{ width: '12px', height: '12px' }}></span>
            </div>
            
            <div className="text-truncate">
              <div className="fw-bold lh-1 mb-1 d-flex align-items-center gap-2" style={{ fontSize: '16px' }}>
                {staffName} 
                <span className="badge bg-white text-primary" style={{ fontSize: '9px' }}>Staff</span>
              </div>
              <div className="text-white-50 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                <Clock size={12} /> Ca sáng (08:00 - 16:00)
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-light border-opacity-25">
            <span className="text-white-50" style={{ fontSize: '12px' }}>Trạng thái làm việc:</span>
            <button 
              onClick={() => setIsAvailable(!isAvailable)} 
              className={`btn btn-sm rounded-pill fw-bold d-flex align-items-center gap-2 px-3 ${isAvailable ? 'btn-success' : 'btn-danger'}`} 
              style={{ fontSize: '12px' }}
            >
              {isAvailable ? <><CheckCircle2 size={14} /> Sẵn sàng</> : <><X size={14} /> Đang bận</>}
            </button>
          </div>
        </header>
      )}

      {/* ========================================== */}
      {/* VIEW 1: TRANG CHỦ */}
      {/* ========================================== */}
      {currentView === 'HOME' && (
        <>
          <div className="px-3 mb-2">
            <div className="d-flex bg-white p-2 rounded-4 shadow-sm" style={{ gap: '8px' }}>
              <button onClick={() => setActiveTab('PENDING')} className={`btn flex-grow-1 py-2 rounded-3 fw-bold border-0 ${activeTab === 'PENDING' ? 'bg-warning text-dark shadow-sm' : 'text-secondary bg-light'}`}>Chờ ({pendingOrders.length})</button>
              <button onClick={() => setActiveTab('ACTIVE')} className={`btn flex-grow-1 py-2 rounded-3 fw-bold border-0 ${activeTab === 'ACTIVE' ? 'bg-primary text-white shadow-sm' : 'text-secondary bg-light'}`}>Bàn ăn ({activeTables.length})</button>
            </div>
          </div>

          <div className="p-3 flex-grow-1 overflow-auto" style={{ paddingBottom: '100px' }}>
            
            {/* TAB ĐANG CHỜ (ĐÃ THÊM GIAO DIỆN HIỂN THỊ) */}
            {activeTab === 'PENDING' && (
              <div className="d-flex flex-column gap-3">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <CheckCircle2 size={48} className="text-success mb-3 opacity-50" />
                    <h5 className="fw-bold">Không có đơn chờ</h5>
                  </div>
                ) : (
                  pendingOrders.map((o) => (
                    <div key={o.id} className="card border-0 shadow-sm rounded-4 p-3 bg-white card-hover border-start border-warning border-4">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h5 className="fw-bold text-dark mb-1">{o.table_name || `Bàn #${o.table_id}`}</h5>
                          <span className="text-muted small">Mã đơn: {o.order_code || `#${o.id}`}</span>
                        </div>
                        <div className="badge bg-warning text-dark">Chờ duyệt</div>
                      </div>
                      
                      <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <div className="text-muted small">
                          Tổng tiền: <strong className="text-primary">{o.total_amount?.toLocaleString()}đ</strong>
                        </div>
                        <button 
  onClick={() => handleConfirmOrder(o.id)} 
  className="btn btn-warning text-dark fw-bold btn-sm rounded-pill px-3"
>
  Xác nhận đơn
</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB BÀN ĂN (ĐÃ SỬA LOGIC LỌC) */}
            {activeTab === 'ACTIVE' && (
              <div className="d-flex flex-column gap-3">
                {activeTables.length === 0 ? (
                  <div className="text-center py-5 my-3 text-white bg-primary rounded-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #004b93 0%, #0066cc 100%)' }}>
                    <Utensils size={42} className="mb-3 opacity-50" /><h5 className="fw-bold">Chưa có khách</h5>
                  </div>
                ) : (
                  activeTables.map((t) => {
                    const tableName = t.table_number || t.name || `Bàn #${t.id}`;
                    const isPendingPayment = t.status === 'payment_pending';
                    
                    return (
                      <div key={t.id} className={`card border-0 shadow-sm rounded-4 p-3 bg-white card-hover border-start border-4 ${isPendingPayment ? 'border-warning' : 'border-primary'}`}>
                        <div className="d-flex justify-content-between mb-2 border-bottom pb-2">
                          <div>
                            <h5 className="fw-bold text-dark mb-1">{tableName} {isPendingPayment && <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '10px' }}>Chờ TT</span>}</h5>
                            <span className="text-muted small"><Users size={12}/> {t.capacity} ghế</span>
                          </div>
                          <div className="text-end">
                            <div className="text-muted small text-uppercase" style={{ fontSize: '10px' }}>Tạm tính</div>
                            <div className="fw-bold text-primary fs-6">{t.total_amount?.toLocaleString() || 0}đ</div>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <button onClick={() => { setSelectedTable(t); setShowAddItemModal(true); }} className="btn btn-sm btn-outline-primary flex-grow-1 rounded-3 btn-press">+ Thêm món</button>
                          <button onClick={() => { setSelectedTable(t); setShowTransferModal(true); }} className="btn btn-sm btn-outline-dark flex-grow-1 rounded-3 btn-press">Đổi bàn</button>
                        </div>
                        {!isPendingPayment && (
                          <button 
  onClick={async () => {
    try {
      // Gọi API cập nhật trạng thái bàn
      const res = await fetch(`${API_BASE}/api/tables/${t.id}/request-payment`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert(`Đã gửi yêu cầu thanh toán ${tableName} tới Thu ngân!`);
        fetchData(); // Load lại danh sách để bàn chuyển màu Vàng
      } else {
        alert("Lỗi khi gửi yêu cầu!");
      }
    } catch (err) {
      alert("Lỗi kết nối!");
    }
  }} 
  className="btn btn-warning text-dark w-100 mt-2 rounded-3 fw-bold btn-press"
>
  <CreditCard size={16}/> Yêu cầu Thanh toán
</button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================== */}
      {/* VIEW 2: THỰC ĐƠN */}
      {/* ========================================== */}
      {currentView === 'MENU' && (
        <div className="p-3 flex-grow-1 overflow-auto d-flex flex-column" style={{ paddingBottom: '100px' }}>
          <h4 className="fw-bold text-dark mb-3">Tra cứu Thực đơn</h4>
          
          <div className="input-group mb-4 shadow-sm rounded-4 overflow-hidden border-0">
            <span className="input-group-text bg-white border-0"><Search size={18} className="text-muted" /></span>
            <input 
              type="text" 
              className="form-control border-0 shadow-none ps-0" 
              placeholder="Tìm tên món ăn..." 
              value={searchMenu} 
              onChange={(e) => setSearchMenu(e.target.value)} 
            />
          </div>

          <div className="d-flex flex-column gap-4">
            {filteredMenu.length === 0 ? (
              <div className="text-center text-muted mt-5">
                <BookOpen size={48} className="mb-3 opacity-25" />
                <p>Không tìm thấy món ăn nào.</p>
              </div>
            ) : (
              Object.entries(
                filteredMenu.reduce((acc, item) => {
                  const category = item.category_name || item.category?.name || 'Chưa phân loại';
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(item);
                  return acc;
                }, {})
              ).map(([categoryName, items]) => (
                
                <div key={categoryName} className="category-group animate__animated animate__fadeIn">
                  <div className="d-flex align-items-center mb-3">
                    <h6 className="fw-bold text-primary mb-0 text-uppercase" style={{ letterSpacing: '0.5px' }}>{categoryName}</h6>
                    <div className="flex-grow-1 ms-3 border-bottom" style={{ borderColor: '#e2e8f0' }}></div>
                    <span className="badge bg-primary bg-opacity-10 text-primary ms-3 rounded-pill">{items.length} món</span>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {items.map((item, index) => (
                      <div key={item.id || index} className={`card border-0 shadow-sm rounded-4 p-2 card-hover ${!item.is_available ? 'bg-light opacity-75' : 'bg-white'}`}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="flex-shrink-0">
                            <img 
                             src={item.image_url ? `${API_BASE}${item.image_url}` : "https://placehold.co/100x100?text=No+Image"}
                              alt={item.name} 
                              className="rounded-3 object-fit-cover shadow-sm" 
                              style={{ width: '65px', height: '65px' }} 
                              onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=No+Image'; }}
                            />
                          </div>
                          <div className="flex-grow-1 overflow-hidden">
                            <h6 className="fw-bold text-dark mb-1 text-truncate">
                              {item.name}
                              {!item.is_available && <span className="badge bg-danger ms-2" style={{ fontSize: '10px' }}>Tạm hết</span>}
                            </h6>
                            <div className="fw-bold text-primary" style={{ fontSize: '15px' }}>{item.price?.toLocaleString()}đ</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 3: CÁ NHÂN & CÀI ĐẶT */}
      {/* ========================================== */}
      {currentView === 'PROFILE' && (
        <div className="flex-grow-1 overflow-auto" style={{ backgroundColor: settings.darkMode ? '#121212' : '#f4f6f9', paddingBottom: '100px' }}>
          
          {profileSubView === 'MAIN' && (
            <>
              <div className="text-white p-4 pt-5 pb-5" style={{ backgroundColor: '#004b93' }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-white rounded-circle d-flex align-items-center justify-content-center shadow" style={{ width: '70px', height: '70px', overflow: 'hidden', border: '3px solid white' }}>
                    <span className="text-primary fw-bold fs-2">{avatarLetter}</span>
                  </div>
                  <div>
                    <h4 className="fw-bold mb-1">{staffName}</h4>
                    <p className="mb-0 text-white-50 fs-6">MSSV/Mã NV: {staffId}</p>
                  </div>
                </div>
              </div>

              <div className="px-3" style={{ marginTop: '-20px' }}>
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                  <div className="list-group list-group-flush">
                    <button onClick={() => setProfileSubView('INFO')} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent btn-press">
                      <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-circle"><User size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Thông tin nhân viên</span><ChevronRight size={18} className="text-muted" />
                    </button>
                    <button onClick={() => setShowScanner(true)} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent btn-press">
                      <div className="bg-info bg-opacity-10 text-info p-2 rounded-circle"><QrCode size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Chấm công (QR)</span><ChevronRight size={18} className="text-muted" />
                    </button>
                    <button onClick={() => setProfileSubView('PASS')} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent btn-press">
                      <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-circle"><Lock size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Đổi mật khẩu</span><ChevronRight size={18} className="text-muted" />
                    </button>
                    <button onClick={() => setProfileSubView('TERMS')} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent btn-press">
                      <div className="p-2 rounded-circle" style={{ color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)' }}><FileText size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Điều khoản và chính sách</span><ChevronRight size={18} className="text-muted" />
                    </button>
                    <button onClick={() => setProfileSubView('FEEDBACK')} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent btn-press">
                      <div className="bg-warning bg-opacity-10 text-warning p-2 rounded-circle"><MessageSquare size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Góp ý ứng dụng</span><ChevronRight size={18} className="text-muted" />
                    </button>
                    <div className="list-group-item p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent">
                      <div className="bg-light text-secondary p-2 rounded-circle"><Bell size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Thông báo</span>
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input shadow-none" type="checkbox" defaultChecked style={{ width: '40px', height: '22px', cursor: 'pointer' }} />
                      </div>
                    </div>
                    <button onClick={() => setProfileSubView('SETTINGS')} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom-light bg-transparent btn-press">
                      <div className="bg-light text-secondary p-2 rounded-circle"><Palette size={20} /></div>
                      <span className="fw-semibold text-dark flex-grow-1 text-start">Thiết lập giao diện</span><ChevronRight size={18} className="text-muted" />
                    </button>
                    <button onClick={handleLogoutClick} className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-0 bg-transparent btn-press">
                        <div className="bg-danger bg-opacity-10 text-danger p-2 rounded-circle"><LogOut size={20} /></div>
                        <span className="fw-semibold text-danger flex-grow-1 text-start">Đăng xuất</span><ChevronRight size={18} className="text-muted" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {profileSubView === 'INFO' && (
            <div className="animate__animated animate__fadeIn">
              {renderSubPageHeader('Thông tin nhân viên')}
              <div className="p-3">
                <div className="card border-0 shadow-sm rounded-4 p-4">
                  <div className="mb-3"><label className="text-muted small">Họ và tên</label><div className="fw-bold text-dark">{staffName}</div></div>
                  <div className="mb-3"><label className="text-muted small">Mã nhân viên</label><div className="fw-bold text-dark">{staffId}</div></div>
                  <div><label className="text-muted small">Chức vụ</label><div className="fw-bold text-dark">Nhân viên phục vụ (Staff)</div></div>
                </div>
              </div>
            </div>
          )}

          {profileSubView === 'PASS' && (
            <div className="animate__animated animate__fadeIn">
              {renderSubPageHeader('Đổi mật khẩu')}
              <div className="p-3">
                <form className="card border-0 shadow-sm rounded-4 p-4" onSubmit={(e) => { e.preventDefault(); alert('Đã cập nhật mật khẩu (demo)'); setProfileSubView('MAIN'); }}>
                  <input type="text" name="username" value={staffName} readOnly hidden autoComplete="username" />
                  <div className="mb-3">
                    <label className="form-label text-muted small">Mật khẩu hiện tại</label>
                    <input type="password" autoComplete="current-password" className="form-control bg-light border-0 shadow-none" placeholder="Nhập mật khẩu cũ..." required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small">Mật khẩu mới</label>
                    <input type="password" autoComplete="new-password" className="form-control bg-light border-0 shadow-none" placeholder="Nhập mật khẩu mới..." required />
                  </div>
                  <div className="mb-4">
                    <label className="form-label text-muted small">Xác nhận mật khẩu</label>
                    <input type="password" autoComplete="new-password" className="form-control bg-light border-0 shadow-none" placeholder="Nhập lại mật khẩu..." required />
                  </div>
                  <button type="submit" className="btn btn-primary w-100 py-2 rounded-3 fw-bold">Cập nhật mật khẩu</button>
                </form>
              </div>
            </div>
          )}

          {profileSubView === 'TERMS' && (
            <div className="animate__animated animate__fadeIn">
              {renderSubPageHeader('Điều khoản và chính sách')}
              <div className="p-3">
                <div className="card border-0 shadow-sm rounded-4 p-4" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <p><b>1. Quy định chung:</b> Nhân viên phải tuân thủ giờ giấc làm việc, trang phục lịch sự và thái độ phục vụ khách hàng tận tình.</p>
                  <p><b>2. Bảo mật thông tin:</b> Tuyệt đối không chia sẻ tài khoản đăng nhập hệ thống cho người khác. Mọi thao tác trên hệ thống đều được ghi log.</p>
                  <p><b>3. Quy trình hủy món:</b> Nhân viên không được tự ý hủy món. Mọi thay đổi phải được xác nhận bởi Bếp và Thu ngân.</p>
                  <p className="mb-0 text-muted fst-italic">* Vui lòng liên hệ quản lý nếu có thắc mắc.</p>
                </div>
              </div>
            </div>
          )}

          {profileSubView === 'FEEDBACK' && (
            <div className="animate__animated animate__fadeIn">
              {renderSubPageHeader('Góp ý ứng dụng')}
              <div className="p-3">
                <div className="card border-0 shadow-sm rounded-4 p-4">
                  <div className="mb-3">
                    <label className="form-label text-muted small">Loại góp ý</label>
                    <select className="form-select bg-light border-0 shadow-none">
                      <option>Báo lỗi hệ thống</option>
                      <option>Đề xuất tính năng</option>
                      <option>Góp ý thái độ đồng nghiệp</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small">Nội dung chi tiết</label>
                    <textarea className="form-control bg-light border-0 shadow-none" rows="4" placeholder="Nhập nội dung góp ý..."></textarea>
                  </div>
                  <button onClick={() => { alert('Cảm ơn bạn đã gửi góp ý!'); setProfileSubView('MAIN'); }} className="btn btn-primary w-100 py-2 rounded-3 fw-bold">Gửi góp ý</button>
                </div>
              </div>
            </div>
          )}

          {profileSubView === 'SETTINGS' && (
            <div className="animate__animated animate__fadeIn">
              {renderSubPageHeader('Thiết lập giao diện')}
              <div className="p-3">
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                  <div className="list-group list-group-flush">
                    <div className="list-group-item p-3 d-flex align-items-center justify-content-between border-bottom-light bg-transparent">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-dark text-white p-2 rounded-circle"><Moon size={18} /></div>
                        <span className="fw-semibold text-dark">Chế độ tối (Dark Mode)</span>
                      </div>
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input shadow-none" type="checkbox" style={{ width: '40px', height: '22px', cursor: 'pointer' }} 
                          checked={settings.darkMode} onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })} />
                      </div>
                    </div>
                    <div className="list-group-item p-3 d-flex align-items-center justify-content-between border-bottom-light bg-transparent">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-circle"><Type size={18} /></div>
                        <span className="fw-semibold text-dark">Cỡ chữ lớn</span>
                      </div>
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input shadow-none" type="checkbox" style={{ width: '40px', height: '22px', cursor: 'pointer' }} 
                          checked={settings.largeText} onChange={(e) => setSettings({ ...settings, largeText: e.target.checked })} />
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-center text-muted small mt-4">* Giao diện tự động thay đổi ngay lập tức.</p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL THÊM MÓN */}
      {showAddItemModal && selectedTable && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <form className="bg-white w-100 rounded-top-4 p-3 animate__animated animate__slideInUp" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto' }} onSubmit={submitAddItems}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0 text-dark">Thêm món - {selectedTable.table_number || selectedTable.name}</h5>
              <button type="button" onClick={() => { setShowAddItemModal(false); setCart([]); }} className="btn btn-light rounded-circle p-2"><X size={20} /></button>
            </div>
            <div className="overflow-auto flex-grow-1 mb-3">
              {menuItems.filter(m => m.is_available).map(item => (
                <div key={item.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                  <div><div className="fw-semibold text-dark">{item.name}</div><div className="text-muted small">{item.price?.toLocaleString()}đ</div></div>
                  <div className="d-flex align-items-center gap-2 bg-light rounded-pill p-1">
                    <button type="button" className="btn btn-sm btn-white rounded-circle shadow-sm p-1" onClick={() => handleRemoveItemFromCart(item.id)}><Minus size={14}/></button>
                    <span className="fw-bold text-dark" style={{ minWidth: '20px', textAlign: 'center' }}>{cart.find(c => c.id === item.id)?.qty || 0}</span>
                    <button type="button" className="btn btn-sm btn-white rounded-circle shadow-sm p-1" onClick={() => handleAddItemToCart(item)}><PlusCircle size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary w-100 py-3 rounded-3 fw-bold btn-press">
              Gửi Bếp ({cart.reduce((sum, item) => sum + item.qty, 0)} món)
            </button>
          </form>
        </div>
      )}

      {/* MODAL CHUYỂN BÀN */}
      {showTransferModal && selectedTable && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white w-100 rounded-4 p-3 mx-3 animate__animated animate__zoomIn" style={{ maxWidth: '400px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0 text-dark">Chuyển {selectedTable.table_number || selectedTable.name} sang:</h5>
              <button onClick={() => setShowTransferModal(false)} className="btn btn-light rounded-circle p-2"><X size={20} /></button>
            </div>
            <div className="row g-2 mb-3">
              {tables.filter(t => t.status === 'available').length === 0 ? <p className="text-center text-muted">Hết bàn trống!</p> : 
                tables.filter(t => t.status === 'available').map(t => (
                  <div className="col-6" key={t.id}>
                    <button onClick={() => { alert(`Đã chuyển khách sang ${t.table_number || t.name}`); setShowTransferModal(false); }} className="btn btn-outline-primary w-100 py-3 rounded-3 fw-bold">{t.table_number || t.name}</button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUÉT MÃ */}
      {showScanner && (
        <div className="position-fixed top-0 start-0 w-100 vh-100 bg-black" style={{ zIndex: 2500, display: 'flex', flexDirection: 'column' }}>
          <div className="p-4 d-flex justify-content-between align-items-center">
            <span className="text-white fw-bold fs-5">Quét mã điểm danh</span>
            <button onClick={() => setShowScanner(false)} className="btn btn-dark bg-opacity-50 rounded-circle p-2 border-0 text-white"><X size={24} /></button>
          </div>
          <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center position-relative">
            <div className="position-relative border border-3 border-primary rounded-4" style={{ width: '260px', height: '260px', boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)' }}>
              <div className="w-100 bg-primary bg-gradient position-absolute" style={{ height: '3px', top: '0', animation: 'scanAnim 2s infinite linear', boxShadow: '0 0 10px #0ea5e9' }}></div>
            </div>
            <p className="text-white-50 mt-5">Di chuyển camera để đưa mã QR vào khung</p>
          </div>
          <div className="p-4 pb-5 text-center">
            <button onClick={() => { setIsCheckedIn(true); setShowScanner(false); alert("Chấm công thành công!"); }} className="btn btn-primary rounded-pill px-5 py-3 fw-bold d-inline-flex align-items-center gap-2 btn-press">
              <Camera size={20} /> Giả lập chụp mã thành công
            </button>
          </div>
        </div>
      )}
      
      {/* MODAL XÁC NHẬN ĐĂNG XUẤT */}
      {showLogoutModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-4 p-4 mx-3 text-center animate__animated animate__zoomIn" style={{ maxWidth: '350px', width: '100%' }}>
            <div className="bg-danger bg-opacity-10 text-danger p-3 rounded-circle d-inline-flex mb-3">
              <LogOut size={40} />
            </div>
            <h5 className="fw-bold text-dark mb-2">Đăng xuất</h5>
            <p className="text-muted small mb-4">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không? Mọi thay đổi chưa lưu sẽ bị mất.</p>
            <div className="d-flex gap-2">
              <button onClick={() => setShowLogoutModal(false)} className="btn btn-light flex-grow-1 fw-bold py-2 rounded-3">
                Hủy bỏ
              </button>
              <button onClick={executeLogout} className="btn btn-danger flex-grow-1 fw-bold py-2 rounded-3">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      {!showScanner && profileSubView === 'MAIN' && (
        <div className="position-fixed bottom-0 w-100 border-top shadow-lg d-flex justify-content-around align-items-center py-2 px-2" style={{ maxWidth: '480px', left: 0, right: 0, margin: '0 auto', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', zIndex: 1040, paddingBottom: 'max(10px, env(safe-area-inset-bottom))', backgroundColor: settings.darkMode ? '#1e1e1e' : '#fff', borderColor: settings.darkMode ? '#333' : '#dee2e6' }}>
          <button onClick={() => setCurrentView('HOME')} className={`btn border-0 d-flex flex-column align-items-center gap-1 ${currentView === 'HOME' ? 'text-primary' : 'text-secondary'}`} style={{ minWidth: '60px' }}>
            <Home size={22} /><span style={{ fontSize: '10px', fontWeight: currentView === 'HOME' ? '700' : '500' }}>Trang chủ</span>
          </button>
          <button onClick={() => setCurrentView('MENU')} className={`btn border-0 d-flex flex-column align-items-center gap-1 ${currentView === 'MENU' ? 'text-primary' : 'text-secondary'}`} style={{ minWidth: '60px' }}>
            <BookOpen size={22} /><span style={{ fontSize: '10px', fontWeight: currentView === 'MENU' ? '700' : '500' }}>Thực đơn</span>
          </button>
          <button onClick={() => setShowScanner(true)} className={`btn border-0 d-flex flex-column align-items-center gap-1 text-secondary`} style={{ minWidth: '60px' }}>
            <div className={`rounded-circle d-flex align-items-center justify-content-center shadow bg-primary text-white glow-effect`} style={{ width: '46px', height: '46px' }}><QrCode size={22} /></div>
            <span style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px' }}>Chấm công</span>
          </button>
          <button onClick={() => setCurrentView('PROFILE')} className={`btn border-0 d-flex flex-column align-items-center gap-1 ${currentView === 'PROFILE' ? 'text-primary' : 'text-secondary'}`} style={{ minWidth: '60px' }}>
            <User size={22} /><span style={{ fontSize: '10px', fontWeight: currentView === 'PROFILE' ? '700' : '500' }}>Cá nhân</span>
          </button>
        </div>
      )}
    </div>
  );
}