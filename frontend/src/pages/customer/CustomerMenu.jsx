import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Plus, Minus, Utensils,
  X, CheckCircle2, AlertCircle, Send, ChevronRight, MapPin, Clock,
  Bell, Ban, Lock, Wallet, QrCode, Sparkles, HelpCircle
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); 

  const [tableInfo, setTableInfo] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchMenu, setSearchMenu] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showCart, setShowCart] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [selectedQuickRequest, setSelectedQuickRequest] = useState('Gọi nhân viên hỗ trợ');
  const [myOrders, setMyOrders] = useState([]);
  
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [rejectedNotice, setRejectedNotice] = useState(null);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState('');

  const [outOfStockNames, setOutOfStockNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'); } catch { return []; }
  });
  const [rejectedItemIds, setRejectedItemIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'); } catch { return []; }
  });

  const fetchMyOrders = async () => {
    if (!tableInfo?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/table/${tableInfo.id}/active`);
      if (res.ok) {
        const data = await res.json();
        if (data.session_status === 'closed' || data.is_closed) {
          setSessionClosed(true);
          return;
        }
        setMyOrders(Array.isArray(data) ? data : (data.items || []));
      } else if (res.status === 410 || res.status === 403) {
        setSessionClosed(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenuProducts = async () => {
    try {
      const resProducts = await fetch(`${API_BASE}/api/products`);
      if (resProducts.ok) {
        setMenuItems(await resProducts.json());
      }
      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!token) {
          setError('Không tìm thấy mã bàn. Vui lòng quét lại mã QR.');
          setLoading(false);
          return;
        }

        const resTable = await fetch(`${API_BASE}/api/tables/qr/${token}`);
        if (resTable.ok) {
          const tableData = await resTable.json();
          if (tableData.session_status === 'closed' || tableData.qr_expired) {
            setSessionClosed(true);
          }
          setTableInfo(tableData);
        } else if (resTable.status === 410) {
          setSessionClosed(true);
        } else {
          setTableInfo({ id: 1, name: 'Bàn 01' });
        }

        await fetchMenuProducts();
      } catch (err) {
        console.error(err);
        setError('Lỗi kết nối đến máy chủ.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  useEffect(() => {
    if (!tableInfo?.id || sessionClosed) return;
    fetchMyOrders();

    const interval = setInterval(() => {
      fetchMyOrders();
      fetchMenuProducts();
    }, 4000);

    const bc = new BroadcastChannel('smartpos_channel');
    bc.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'KITCHEN_OUT_OF_STOCK' && payload) {
        setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
        setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
        setCart(prev => prev.filter(c => c.name !== payload.product_name));
        setRejectedNotice(payload);
        fetchMyOrders();
        fetchMenuProducts();
      }
      if (type === 'PRODUCT_RESTORED' || type === 'STAFF_SWAPPED_ITEM' || type === 'CASHIER_CONFIRMED_CANCEL') {
        setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
        setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
        fetchMyOrders();
        fetchMenuProducts();
      }
      if ((type === 'SESSION_CLOSED' || type === 'TABLE_CANCELLED') && payload) {
        if (!payload.table_id || Number(payload.table_id) === Number(tableInfo.id)) {
          setSessionClosed(true);
        }
      }
    };

    const handleStorage = () => {
      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [tableInfo?.id, sessionClosed]);

  const categories = useMemo(() => {
    return ['Tất cả', ...new Set(menuItems.map(item => item.category_name || item.category?.name || 'Khác'))];
  }, [menuItems]);

  const handleAddToCart = (item) => {
    const isOut = item.is_available === false || item.is_available === 0 || outOfStockNames.includes(item.name);
    if (isOut) {
      return alert(`Món "${item.name}" hiện đang tạm hết. Quý khách vui lòng chọn món khác nhé!`);
    }
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { ...item, qty: 1, note: '' }]);
    }
  };

  const handleRemoveFromCart = (itemId) => {
    const existing = cart.find(c => c.id === itemId);
    if (!existing) return;
    if (existing.qty > 1) {
      setCart(cart.map(c => c.id === itemId ? { ...c, qty: c.qty - 1 } : c));
    } else {
      setCart(cart.filter(c => c.id !== itemId));
    }
  };

  const handleItemNoteChange = (itemId, noteText) => {
    setCart(cart.map(c => c.id === itemId ? { ...c, note: noteText } : c));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (Number(item.price || 0) * item.qty), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // Kiểm tra các món hợp lệ đã gọi và Tổng tiền tạm tính
  const validOrderedItemsCount = useMemo(() => {
    return myOrders.filter(item => {
      const st = String(item.status || item.item_status || '').toLowerCase();
      const itemName = item.name || item.product_name;
      const isRejected =
        ['out_of_stock', 'cancelled', 'canceled', 'cancelled_by_kitchen', 'rejected'].includes(st) ||
        rejectedItemIds.includes(item.id) ||
        (outOfStockNames.includes(itemName) && st !== 'served');
      return !isRejected;
    }).length;
  }, [myOrders, rejectedItemIds, outOfStockNames]);

  const validHistoryTotal = useMemo(() => {
    return myOrders.reduce((sum, item) => {
      const st = String(item.status || item.item_status || '').toLowerCase();
      const itemName = item.name || item.product_name;
      const isRejected =
        ['out_of_stock', 'cancelled', 'canceled', 'cancelled_by_kitchen', 'rejected'].includes(st) ||
        rejectedItemIds.includes(item.id) ||
        (outOfStockNames.includes(itemName) && st !== 'served');
      if (isRejected) return sum;
      return sum + (Number(item.price || item.unit_price || 0) * Number(item.qty || item.quantity || 1));
    }, 0);
  }, [myOrders, rejectedItemIds, outOfStockNames]);

  const hasActiveValidOrder = validOrderedItemsCount > 0 && validHistoryTotal > 0;

  const handleSubmitOrder = async () => {
    if (sessionClosed) return alert('Phiên phục vụ đã kết thúc!');
    if (!tableInfo) return alert('Lỗi: Không xác định được bàn!');
    if (cart.length === 0) return alert('Giỏ hàng đang trống!');

    const unavailableInCart = cart.find(c => outOfStockNames.includes(c.name));
    if (unavailableInCart) {
      alert(`⚠️ Món "${unavailableInCart.name}" vừa tạm hết. Hệ thống sẽ bỏ món này khỏi giỏ hàng.`);
      setCart(cart.filter(c => c.id !== unavailableInCart.id));
      return;
    }

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
        fetchMyOrders();
        setShowHistory(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Lỗi: ${errData.detail || 'Không thể tạo đơn hàng'}`);
      }
    } catch (err) {
      alert('Lỗi kết nối khi gửi đơn hàng!');
    } finally {
      setSubmitting(false);
    }
  };

  // --- GỌI NHÂN VIÊN / YÊU CẦU THANH TOÁN (CHẶN NẾU CHƯA ĐẶT MÓN) ---
  const handleRequestService = async (type, paymentMethod = 'CASH', customNote = '') => {
    if (!tableInfo?.id) return;

    // Chặn tuyệt đối nếu chưa gọi món nào mà bấm Gọi thanh toán
    if (type === 'CALL_PAYMENT' && !hasActiveValidOrder) {
      return alert('Bạn chưa gọi món nào nên chưa thể yêu cầu thanh toán!');
    }

    try {
      // Gọi sang /api/kitchen/tables/{id}/call đã khai báo trong kitchen.py để không bị lỗi 404
      await fetch(`${API_BASE}/api/kitchen/tables/${tableInfo.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          payment_method: paymentMethod,
          note: customNote || selectedQuickRequest
        })
      }).catch(() => null);

      const reqPayload = {
        table_id: tableInfo.id,
        table_name: tableInfo.name || `Bàn 0${tableInfo.id}`,
        type,
        payment_method: paymentMethod,
        note: customNote || selectedQuickRequest,
        timestamp: Date.now()
      };

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'CUSTOMER_CALL_SERVICE', payload: reqPayload });
      bc.close();

      setShowCallModal(false);
      setServiceSuccessMsg(
        type === 'CALL_PAYMENT'
          ? `Đã gửi yêu cầu thanh toán (${paymentMethod === 'TRANSFER' ? 'Chuyển khoản QR' : 'Tiền mặt'}). Thu ngân sẽ hỗ trợ bạn ngay!`
          : `Đã gửi yêu cầu "${customNote || selectedQuickRequest}" tới nhân viên!`
      );
      setTimeout(() => setServiceSuccessMsg(''), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredMenu = menuItems.filter(item => {
    const itemCategory = item.category_name || item.category?.name || 'Khác';
    const matchCategory = activeCategory === 'Tất cả' || itemCategory === activeCategory;
    const matchSearch = (item.name || '').toLowerCase().includes(searchMenu.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (loading) return <div className="vh-100 d-flex align-items-center justify-content-center fw-bold text-primary">Đang tải thực đơn...</div>;
  if (error) return <div className="vh-100 d-flex flex-column align-items-center justify-content-center p-4 text-center"><AlertCircle size={48} className="text-danger mb-3"/> <h5>{error}</h5></div>;

  if (sessionClosed) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light p-4">
        <div className="bg-white p-4 rounded-4 shadow text-center" style={{ maxWidth: '400px' }}>
          <div className="rounded-circle bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
            <Lock size={32} />
          </div>
          <h5 className="fw-bold text-dark mb-2">Phiên phục vụ đã kết thúc</h5>
          <p className="text-muted small mb-3">
            Hóa đơn tại <b>{tableInfo?.name || 'bàn này'}</b> đã được đóng. Quý khách muốn gọi thêm vui lòng liên hệ nhân viên để mở phiên mới nhé!
          </p>
          <span className="badge bg-light text-secondary border px-3 py-2 rounded-pill">
            Cảm ơn Quý khách & Hẹn gặp lại!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="vh-100 d-flex justify-content-center bg-light" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="w-100 h-100 d-flex flex-column position-relative bg-white shadow-sm" style={{ maxWidth: '480px' }}>
        
        {/* HEADER GỌN ĐẸP, THOÁNG ĐÃNG */}
        <div className="px-3 pt-3 pb-2 shadow-sm sticky-top z-3 bg-white" style={{ borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          <div className="d-flex justify-content-between align-items-center mb-2.5">
            <div>
              <h4 className="fw-bold mb-0 text-dark">Thực Đơn</h4>
              <div className="text-muted small d-flex align-items-center gap-1 mt-0.5">
                <MapPin size={14} className="text-danger" /> 
                <span className="fw-bold text-danger">{tableInfo?.name || 'Bàn 01'}</span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              {/* Nút chuông hỗ trợ nhỏ gọn tinh tế */}
              <button
                onClick={() => setShowCallModal(true)}
                className="btn btn-light border rounded-pill fw-bold d-flex align-items-center gap-1.5 px-3 py-1.5 shadow-sm text-dark"
                style={{ fontSize: '13px' }}
                title="Gọi nhân viên / Hỗ trợ"
              >
                <Bell size={15} className="text-danger" />
                <span>Hỗ trợ</span>
              </button>

              {/* Nút Đã gọi */}
              <button 
                onClick={() => setShowHistory(true)} 
                className="btn btn-outline-primary rounded-pill fw-bold d-flex align-items-center gap-1.5 px-3 py-1.5 shadow-sm"
                style={{ fontSize: '13px' }}
              >
                <Clock size={15} />
                <span>Đã gọi ({myOrders.length})</span>
              </button>
            </div>
          </div>

          {serviceSuccessMsg && (
            <div className="alert alert-success py-2 px-3 small fw-semibold mb-2 rounded-3 d-flex align-items-center gap-2 border-0 shadow-sm" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span>{serviceSuccessMsg}</span>
            </div>
          )}
          
          <div className="input-group bg-light rounded-4 overflow-hidden border-0 mb-2.5">
            <span className="input-group-text bg-transparent border-0"><Search size={18} className="text-secondary"/></span>
            <input 
              type="text" 
              className="form-control bg-transparent border-0 shadow-none ps-0 text-dark" 
              placeholder="Tìm tên món ăn..." 
              value={searchMenu}
              onChange={(e) => setSearchMenu(e.target.value)}
            />
          </div>

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
          <div className="d-flex flex-column gap-3">
            {filteredMenu.map(item => {
              const qtyInCart = cart.find(c => c.id === item.id)?.qty || 0;
              const isOutOfStock =
                item.is_available === false ||
                item.is_available === 0 ||
                outOfStockNames.includes(item.name);

              return (
                <div
                  key={item.id}
                  className="card border-0 shadow-sm rounded-4 p-2 d-flex flex-row gap-3 bg-white position-relative"
                  style={{ opacity: isOutOfStock ? 0.55 : 1 }}
                >
                  <div className="position-relative flex-shrink-0" style={{ width: '90px', height: '90px' }}>
                    <img 
                      src={item.image_url ? (item.image_url.startsWith('http') ? item.image_url : `${API_BASE}${item.image_url}`) : 'https://placehold.co/100x100?text=No+Image'} 
                      alt={item.name} 
                      className="rounded-3 object-fit-cover w-100 h-100" 
                      onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=No+Image'; }}
                    />
                    {isOutOfStock && (
                      <div
                        className="position-absolute top-0 start-0 w-100 h-100 rounded-3 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
                      >
                        <span className="badge bg-danger text-white fw-bold">Tạm hết</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow-1 d-flex flex-column justify-content-between py-1">
                    <div>
                      <h6 className={`fw-bold mb-1 lh-base ${isOutOfStock ? 'text-muted text-decoration-line-through' : 'text-dark'}`} style={{ fontSize: '15px' }}>
                        {item.name}
                      </h6>
                      {item.description && <p className="text-muted small mb-1 text-truncate-2" style={{ fontSize: '12px' }}>{item.description}</p>}
                    </div>
                    
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="text-primary fw-bold" style={{ fontSize: '15px' }}>{item.price?.toLocaleString()}đ</span>
                      
                      {isOutOfStock ? (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger rounded-pill px-2.5 py-1.5 fw-bold">
                          Tạm hết hàng
                        </span>
                      ) : qtyInCart === 0 ? (
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
          <div className="position-absolute bottom-0 w-100 p-3" style={{ zIndex: 1000 }}>
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

        {/* MODAL GIỎ HÀNG */}
        {showCart && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center bg-white" style={{ zIndex: 2000 }}>
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
                          src={item.image_url ? (item.image_url.startsWith('http') ? item.image_url : `${API_BASE}${item.image_url}`) : 'https://placehold.co/100x100?text=No+Image'} 
                          alt={item.name} 
                          className="rounded-3 object-fit-cover flex-shrink-0 border" 
                          style={{ width: '60px', height: '60px' }}
                        />
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{item.name}</div>
                            <div className="fw-bold text-primary ms-2">{(item.price * item.qty).toLocaleString()}đ</div>
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
                              <button onClick={() => handleRemoveFromCart(item.id)} className="btn btn-sm btn-link text-dark p-0 px-2"><Minus size={14}/></button>
                              <span className="fw-bold" style={{ minWidth: '20px', textAlign: 'center', fontSize: '13px' }}>{item.qty}</span>
                              <button onClick={() => handleAddToCart(item)} className="btn btn-sm btn-link text-primary p-0 px-2"><Plus size={14}/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                >
                  {submitting ? 'Đang gửi đơn...' : <><Send size={18} /> Xác Nhận Đặt Món</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL LỊCH SỬ ĐẶT MÓN ("MÓN ĐÃ GỌI") */}
        {showHistory && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-end flex-column" style={{ zIndex: 2500, backgroundColor: 'rgba(15, 23, 42, 0.6)' }} onClick={() => setShowHistory(false)}>
            <div className="bg-white w-100 rounded-top-4 p-3 d-flex flex-column" style={{ maxHeight: '85vh', maxWidth: '480px', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">Món đã gọi ({tableInfo?.name})</h5>
                <button onClick={() => setShowHistory(false)} className="btn btn-light rounded-circle p-2"><X size={20} /></button>
              </div>

              <div className="overflow-auto flex-grow-1 mb-3">
                {myOrders.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <Utensils size={48} className="mb-3 opacity-25" />
                    <p className="mb-1 fw-bold text-dark">Bạn chưa gọi món nào</p>
                    <small>Hãy chọn món trên thực đơn và bấm Xác nhận đặt món nhé!</small>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {myOrders.map((item, idx) => {
                      const rawStatus = String(item.status || item.item_status || 'pending').toLowerCase();
                      const itemName = item.name || item.product_name;
                      const isRejectedOrOut =
                        ['out_of_stock', 'cancelled', 'canceled', 'cancelled_by_kitchen', 'rejected'].includes(rawStatus) ||
                        rejectedItemIds.includes(item.id) ||
                        (outOfStockNames.includes(itemName) && rawStatus !== 'served');
                      const qty = Number(item.qty || item.quantity || 1);
                      const price = Number(item.price || item.unit_price || 0);

                      return (
                        <div
                          key={idx}
                          className={`d-flex justify-content-between align-items-center p-3 rounded-3 border ${
                            isRejectedOrOut ? 'bg-danger bg-opacity-10 border-danger' : 'bg-light'
                          }`}
                        >
                          <div>
                            <div className={`fw-bold ${isRejectedOrOut ? 'text-danger text-decoration-line-through' : 'text-dark'}`}>
                              <span className="text-danger me-2">{qty}x</span> 
                              {itemName}
                            </div>
                            {item.note && <div className="text-muted small mt-1">* {item.note}</div>}
                            
                            <div className="mt-1.5">
                              {isRejectedOrOut ? (
                                <span className="badge bg-danger text-white">
                                  Hết món • Chờ đổi hoặc hủy (0đ)
                                </span>
                              ) : (
                                <>
                                  {rawStatus === 'pending' && <span className="badge bg-secondary">Chờ xác nhận</span>}
                                  {(rawStatus === 'confirmed' || rawStatus === 'cooking' || rawStatus === 'preparing') && (
                                    <span className="badge bg-warning text-dark">Đang chuẩn bị</span>
                                  )}
                                  {(rawStatus === 'ready' || rawStatus === 'done') && (
                                    <span className="badge bg-info text-dark">Đã nấu xong</span>
                                  )}
                                  {rawStatus === 'served' && (
                                    <span className="badge bg-success">Đã lên món</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-end">
                            {isRejectedOrOut ? (
                              <span className="fw-bold text-danger small">0đ</span>
                            ) : (
                              <span className="fw-bold text-primary">{(price * qty).toLocaleString()}đ</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {hasActiveValidOrder && (
                <div className="border-top pt-3 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-muted small">Tổng tạm tính:</div>
                    <div className="fw-bolder fs-5 text-danger">{validHistoryTotal.toLocaleString()}đ</div>
                  </div>
                  <button
                    onClick={() => { setShowHistory(false); setShowCallModal(true); }}
                    className="btn btn-primary rounded-pill px-4 py-2 fw-bold shadow-sm"
                  >
                    Yêu cầu thanh toán
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* BOTTOM SHEET HỖ TRỢ & THANH TOÁN (THIẾT KẾ HIỆN ĐẠI, CHẶN KHI 0 ĐƠN) */}
        {/* ===================================================================== */}
        {showCallModal && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-end"
            style={{ zIndex: 2600, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowCallModal(false)}
          >
            <div
              className="bg-white w-100 rounded-top-4 p-4 shadow-lg"
              style={{ maxWidth: '480px', margin: '0 auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Thanh gạch ngang kéo (Drag Handle) */}
              <div className="mx-auto mb-3 rounded-pill bg-secondary bg-opacity-25" style={{ width: '42px', height: '5px' }}></div>

              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="fw-bolder mb-0 text-dark">Hỗ trợ tại {tableInfo?.name}</h5>
                  <small className="text-muted">Chọn yêu cầu để nhân viên phục vụ bạn nhanh nhất</small>
                </div>
                <button onClick={() => setShowCallModal(false)} className="btn btn-light rounded-circle p-2">
                  <X size={18} />
                </button>
              </div>

              {/* PHẦN 1: GỌI NHÂN VIÊN HỖ TRỢ TẠI BÀN (LUÔN MỞ) */}
              <div className="p-3 rounded-4 border bg-light mb-3">
                <div className="d-flex align-items-center gap-2 fw-bold text-dark mb-2" style={{ fontSize: '14px' }}>
                  <Bell size={16} className="text-primary" />
                  <span>1. Gọi nhân viên hỗ trợ</span>
                </div>

                {/* Các tag chọn nhanh lý do gọi */}
                <div className="d-flex flex-wrap gap-1.5 mb-3">
                  {[
                    'Gọi nhân viên hỗ trợ',
                    'Xin thêm đá / trà đá',
                    'Xin thêm chén / đũa / giấy ăn',
                    'Nhờ tư vấn thực đơn'
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedQuickRequest(tag)}
                      className={`btn btn-xs rounded-pill px-2.5 py-1 fw-semibold ${
                        selectedQuickRequest === tag
                          ? 'btn-primary text-white shadow-sm'
                          : 'bg-white text-secondary border'
                      }`}
                      style={{ fontSize: '12px' }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleRequestService('CALL_STAFF', 'NONE', selectedQuickRequest)}
                  className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                >
                  <Send size={15} /> Gửi yêu cầu: "{selectedQuickRequest}"
                </button>
              </div>

              {/* PHẦN 2: YÊU CẦU THANH TOÁN (CHỈ BẬT KHI ĐÃ ĐẶT MÓN) */}
              <div className="p-3 rounded-4 border" style={{ backgroundColor: hasActiveValidOrder ? '#ffffff' : '#f8fafc' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2 fw-bold text-dark" style={{ fontSize: '14px' }}>
                    <Wallet size={16} className="text-success" />
                    <span>2. Yêu cầu thanh toán</span>
                  </div>
                  {hasActiveValidOrder && (
                    <span className="badge bg-danger bg-opacity-10 text-danger fw-bold px-2.5 py-1 rounded-pill">
                      Tạm tính: {validHistoryTotal.toLocaleString()}đ
                    </span>
                  )}
                </div>

                {!hasActiveValidOrder ? (
                  <div className="p-2.5 rounded-3 bg-secondary bg-opacity-10 text-secondary small d-flex align-items-center gap-2">
                    <HelpCircle size={18} className="flex-shrink-0" />
                    <span>Bạn chưa đặt món nào (`Đã gọi: 0`). Vui lòng đặt món trước khi gọi thanh toán nhé!</span>
                  </div>
                ) : (
                  <div className="row g-2 mt-1">
                    <div className="col-6">
                      <button
                        onClick={() => handleRequestService('CALL_PAYMENT', 'CASH', 'Thanh toán Tiền mặt')}
                        className="btn btn-outline-success w-100 py-2.5 rounded-3 fw-bold d-flex flex-column align-items-center gap-1"
                      >
                        <Wallet size={20} />
                        <span style={{ fontSize: '13px' }}>Tiền mặt</span>
                      </button>
                    </div>
                    <div className="col-6">
                      <button
                        onClick={() => handleRequestService('CALL_PAYMENT', 'TRANSFER', 'Thanh toán Chuyển khoản QR')}
                        className="btn btn-outline-primary w-100 py-2.5 rounded-3 fw-bold d-flex flex-column align-items-center gap-1"
                      >
                        <QrCode size={20} />
                        <span style={{ fontSize: '13px' }}>Chuyển khoản QR</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* POPUP BÁO KHÁCH KHI BẾP VỪA BÁO HẾT MÓN */}
        {rejectedNotice && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 3000, backgroundColor: 'rgba(15, 23, 42, 0.75)' }}>
            <div className="bg-white rounded-4 p-4 w-100 shadow-lg text-center" style={{ maxWidth: '380px' }}>
              <div className="rounded-circle bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center mb-2" style={{ width: '56px', height: '56px' }}>
                <Ban size={28} />
              </div>
              <h6 className="fw-bold text-dark mb-2">Thông báo hết món</h6>
              <p className="small text-secondary mb-3">
                Rất tiếc, món <b className="text-danger">{rejectedNotice.product_name}</b> bạn vừa gọi hiện đã hết nguyên liệu. Nhân viên sẽ ra hỗ trợ bạn đổi món khác hoặc hủy món nhé!
              </p>
              <button
                onClick={() => setRejectedNotice(null)}
                className="btn btn-danger w-100 py-2 rounded-pill fw-bold"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}