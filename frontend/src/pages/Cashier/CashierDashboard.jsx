import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, Utensils, Search, RefreshCw, LogOut, 
  Trash2, Plus, Minus, Printer, DollarSign, Bell,
  ShoppingBag, Bike, Menu, Wallet, QrCode, 
  User, X, BarChart3, TrendingUp, CheckCircle2,
  Tag, ChevronLeft, ChevronRight, Phone, MapPin, Keyboard,
  Edit3, History, Calendar, Split, FileText, Gift, SlidersHorizontal
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell 
} from 'recharts';

const API_BASE = 'http://127.0.0.1:8000';

export default function CashierDashboard() {
  // --- STATE ĐIỀU HƯỚNG & PHÂN TRANG (24 Ô / TRANG) ---
  const [leftTab, setLeftTab] = useState('TABLES'); // 'TABLES' | 'MENU' | 'DASHBOARD'
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [statusRadio, setStatusRadio] = useState('ALL'); // 'ALL' | 'USED' | 'EMPTY'
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [openMenuOnSelect, setOpenMenuOnSelect] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // --- STATE DỮ LIỆU THẬT TỪ BACKEND ---
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- STATE BÀN ĐANG CHỌN & HÓA ĐƠN ---
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [customerCash, setCustomerCash] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  // --- STATE QUẢN LÝ CA ---
  const [isShiftOpen, setIsShiftOpen] = useState(() => localStorage.getItem('cashier_shift_open') === 'true');
  const [startingCash, setStartingCash] = useState(() => Number(localStorage.getItem('cashier_starting_cash')) || 500000);
  const [shiftStats, setShiftStats] = useState(() => {
    const saved = localStorage.getItem('cashier_shift_stats');
    return saved ? JSON.parse(saved) : { totalBills: 0, cashRevenue: 0, transferRevenue: 0 };
  });
  const [shiftTransactions, setShiftTransactions] = useState(() => {
    const saved = localStorage.getItem('cashier_shift_txs');
    return saved ? JSON.parse(saved) : [];
  });

  const token = localStorage.getItem('access_token');
  const staffName = localStorage.getItem('full_name') || 'Thu ngân';

  // --- XỬ LÝ URL ẢNH MÓN ĂN ---
  const getProductImageUrl = (item) => {
    const rawUrl = item.image_url || item.image || item.thumbnail;
    if (!rawUrl) return 'https://placehold.co/300x200/e2e8f0/475569?text=Mon+An';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    return `${API_BASE}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  // --- ĐỒNG BỘ DỮ LIỆU ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTables, resOrders, resMenu] = await Promise.all([
        fetch(`${API_BASE}/api/tables`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => (r.ok ? r : fetch(`${API_BASE}/api/menu`, { headers: { Authorization: `Bearer ${token}` } })))
          .catch(() => null)
      ]);

      if (resTables.ok) setTables(await resTables.json());
      if (resOrders.ok) setOrders(await resOrders.json());
      if (resMenu && resMenu.ok) {
        const menuData = await resMenu.json();
        setMenuItems(Array.isArray(menuData) ? menuData : (menuData.items || []));
      }
    } catch (err) {
      console.error('Lỗi đồng bộ dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Phím tắt F3, F4, F9, F10 chuẩn KiotViet
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        document.getElementById('pos-global-search')?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        document.getElementById('pos-customer-search')?.focus();
      } else if (e.key === 'F9' && selectedTable && currentBillTotal > 0) {
        e.preventDefault();
        setShowPayModal(true);
      } else if (e.key === 'F10' && selectedTable) {
        e.preventDefault();
        alert('Đã gửi thông báo chế biến xuống Bếp / Bar!');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Reset sạch hóa đơn khi bỏ chọn bàn
  useEffect(() => {
    if (!selectedTable) {
      setTableOrders([]);
      return;
    }
    const active = orders.filter(o =>
      (o.table_id === selectedTable.id || o.table_name === selectedTable.table_number) &&
      o.status !== 'completed' && o.status !== 'cancelled'
    );
    setTableOrders(active);
  }, [orders, selectedTable]);

  // --- TÍNH TOÁN THÔNG SỐ TỪNG BÀN ---
  const getTableSummary = (table) => {
    const active = orders.filter(o =>
      (o.table_id === table.id || o.table_name === table.table_number) &&
      o.status !== 'completed' && o.status !== 'cancelled'
    );
    let total = 0;
    let itemCount = 0;
    let earliestTime = null;

    active.forEach(o => {
      const oTotal = Number(o.total_amount) || 0;
      if (oTotal > 0) {
        total += oTotal;
      } else if (o.items) {
        total += o.items.reduce((s, it) => s + (Number(it.unit_price || it.price || 0) * Number(it.quantity || 1)), 0);
      }

      if (o.items && Array.isArray(o.items)) {
        itemCount += o.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
      }
      if (o.created_at) {
        const parsed = new Date(o.created_at.replace(' ', 'T'));
        if (!isNaN(parsed.getTime()) && (!earliestTime || parsed < earliestTime)) {
          earliestTime = parsed;
        }
      }
    });

    let durationText = '1p';
    if (earliestTime) {
      const diffMins = Math.max(1, Math.floor((Date.now() - earliestTime.getTime()) / 60000));
      durationText = diffMins >= 60 ? `${Math.floor(diffMins / 60)}g${diffMins % 60}p` : `${diffMins}p`;
    }

    return { total, itemCount, durationText, hasOrder: active.length > 0 };
  };

  // --- DANH SÁCH MÓN GỘP ---
  const flattenedBillItems = useMemo(() => {
    if (!selectedTable) return [];
    const list = [];
    tableOrders.forEach(order => {
      (order.items || []).forEach(item => {
        list.push({ ...item, order_id: order.id });
      });
    });
    return list;
  }, [tableOrders, selectedTable]);

  const currentBillTotal = useMemo(() => {
    if (!selectedTable) return 0;
    return flattenedBillItems.reduce((sum, item) => {
      return sum + (Number(item.unit_price || item.price || 0) * Number(item.quantity || 1));
    }, 0);
  }, [flattenedBillItems, selectedTable]);

  const currentBillQty = useMemo(() => {
    if (!selectedTable) return 0;
    return flattenedBillItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  }, [flattenedBillItems, selectedTable]);

  // --- CHỌN / BỎ CHỌN BÀN ---
  const handleSelectTable = (table) => {
    setSelectedTable(table);
    setCustomerCash(0);
    if (openMenuOnSelect) setLeftTab('MENU');
  };

  const handleClearSelectedTable = () => {
    setSelectedTable(null);
    setTableOrders([]);
    setCustomerCash(0);
  };

  // --- MỞ / CHỐT CA ---
  const handleToggleShift = () => {
    if (isShiftOpen) {
      const expectedCash = startingCash + shiftStats.cashRevenue;
      if (window.confirm(`XÁC NHẬN CHỐT CA?\n• Tiền đầu ca: ${startingCash.toLocaleString()}đ\n• Thu tiền mặt: ${shiftStats.cashRevenue.toLocaleString()}đ\n• Tổng tiền mặt trong két: ${expectedCash.toLocaleString()}đ`)) {
        setIsShiftOpen(false);
        const emptyStats = { totalBills: 0, cashRevenue: 0, transferRevenue: 0 };
        setShiftStats(emptyStats);
        setShiftTransactions([]);
        localStorage.setItem('cashier_shift_open', 'false');
        localStorage.setItem('cashier_shift_stats', JSON.stringify(emptyStats));
        localStorage.setItem('cashier_shift_txs', JSON.stringify([]));
      }
    } else {
      const cash = prompt('Nhập tiền lẻ đầu ca (VNĐ):', startingCash);
      if (cash !== null && !isNaN(Number(cash))) {
        setStartingCash(Number(cash));
        setIsShiftOpen(true);
        localStorage.setItem('cashier_shift_open', 'true');
        localStorage.setItem('cashier_starting_cash', cash);
      }
    }
  };

  // --- THÊM MÓN ---
  const handleAddMenuItemToTable = async (product) => {
    if (!selectedTable) {
      alert('Vui lòng chọn một bàn ở tab [Phòng bàn] trước khi thêm món!');
      setLeftTab('TABLES');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table_id: selectedTable.id,
          items: [{ product_id: product.id, quantity: 1, price: Number(product.price) || 0 }]
        })
      });
      if (res.ok) await fetchData();
      else alert('Không thể thêm món!');
    } catch (err) {
      alert('Lỗi kết nối server!');
    }
  };

  // --- CẬP NHẬT SỐ LƯỢNG (+/-) ---
  const handleUpdateItemQty = async (item, delta) => {
    const newQty = Number(item.quantity || 1) + delta;
    if (newQty <= 0) return handleCancelItem(item.id);
    try {
      const res = await fetch(`${API_BASE}/api/orders/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: newQty })
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- HỦY MÓN ---
  const handleCancelItem = async (itemId) => {
    if (!window.confirm('Xóa món này khỏi hóa đơn?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/items/${itemId}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) await fetchData();
    } catch (err) {
      alert('Lỗi kết nối!');
    }
  };

  // --- THANH TOÁN ---
  const handleConfirmPayment = async () => {
    if (!isShiftOpen) return alert('⚠️ Vui lòng bấm [Chưa mở ca] ở góc trên bên phải để mở ca trước khi thu tiền!');
    if (!selectedTable) return;

    try {
      const res = await fetch(`${API_BASE}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table_id: selectedTable.id,
          amount: currentBillTotal,
          method: paymentMethod
        })
      });

      if (res.ok) {
        const nextStats = {
          totalBills: shiftStats.totalBills + 1,
          cashRevenue: paymentMethod === 'CASH' ? shiftStats.cashRevenue + currentBillTotal : shiftStats.cashRevenue,
          transferRevenue: paymentMethod === 'TRANSFER' ? shiftStats.transferRevenue + currentBillTotal : shiftStats.transferRevenue
        };
        const nowHour = new Date().getHours();
        const nextTxs = [
          {
            id: Date.now(),
            table: selectedTable.table_number,
            amount: currentBillTotal,
            method: paymentMethod,
            hour: `${String(nowHour).padStart(2, '0')}:00`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          },
          ...shiftTransactions
        ];

        setShiftStats(nextStats);
        setShiftTransactions(nextTxs);
        localStorage.setItem('cashier_shift_stats', JSON.stringify(nextStats));
        localStorage.setItem('cashier_shift_txs', JSON.stringify(nextTxs));

        setShowPayModal(false);
        handleClearSelectedTable();
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Lỗi thanh toán: ${err.detail || 'Vui lòng thử lại'}`);
      }
    } catch (err) {
      alert('Lỗi kết nối server!');
    }
  };

  // --- LỌC & PHÂN TRANG 24 Ô MỖI MÀN HÌNH ---
  const floors = useMemo(() => {
    const set = new Set(tables.map(t => t.zone || t.floor).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [tables]);

  const usedCount = tables.filter(t => ['occupied', 'busy', 'payment_pending'].includes(t.status)).length;
  const emptyCount = tables.length - usedCount;

  const filteredTables = tables.filter(t => {
    const isUsed = ['occupied', 'busy', 'payment_pending'].includes(t.status);
    if (statusRadio === 'USED' && !isUsed) return false;
    if (statusRadio === 'EMPTY' && isUsed) return false;
    if (selectedFloor !== 'ALL' && (t.zone || t.floor) !== selectedFloor) return false;
    if (searchQuery && !(t.table_number || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const allGridItems = useMemo(() => {
    const specials = [
      { id: 'SPECIAL_TAKEAWAY', isSpecial: true, type: 'TAKEAWAY', label: 'Mang về' },
      { id: 'SPECIAL_DELIVERY', isSpecial: true, type: 'DELIVERY', label: 'Giao đi' },
    ];
    return [...specials, ...filteredTables];
  }, [filteredTables]);

  const ITEMS_PER_PAGE = 24;
  const totalPages = Math.max(1, Math.ceil(allGridItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedGridItems = allGridItems.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // --- LỌC THỰC ĐƠN ---
  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(m => m.category_name || m.category || 'Món chính'));
    return ['Tất cả', ...Array.from(cats)];
  }, [menuItems]);

  const filteredMenu = menuItems.filter(m => {
    const cat = m.category_name || m.category || 'Món chính';
    const matchCat = activeCategory === 'Tất cả' || cat === activeCategory;
    const matchSearch = (m.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const realChartData = useMemo(() => {
    const grouped = {};
    shiftTransactions.forEach(tx => {
      grouped[tx.hour] = (grouped[tx.hour] || 0) + tx.amount;
    });
    const keys = Object.keys(grouped).sort();
    return keys.length === 0 ? [{ time: 'Hiện tại', revenue: 0 }] : keys.map(k => ({ time: k, revenue: grouped[k] }));
  }, [shiftTransactions]);

  const changeAmount = customerCash > currentBillTotal ? customerCash - currentBillTotal : 0;

  return (
    <div className="vh-100 d-flex flex-column overflow-hidden select-none" style={{ backgroundColor: '#003e9c', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      
      {/* ================= 1. TOP HEADER KIOTVIET FNB ================= */}
      <header className="px-2 pt-1.5 d-flex justify-content-between align-items-end text-white" style={{ backgroundColor: '#003e9c', height: '46px' }}>
        
        {/* CỤM TAB TRÁI */}
        <div className="d-flex align-items-end gap-1 h-100">
          <button
            onClick={() => setLeftTab('TABLES')}
            className={`kv-tab ${leftTab === 'TABLES' ? 'active' : ''}`}
          >
            <LayoutGrid size={15} /> Phòng bàn
          </button>

          <button
            onClick={() => setLeftTab('MENU')}
            className={`kv-tab ${leftTab === 'MENU' ? 'active' : ''}`}
          >
            <Utensils size={15} /> Thực đơn
          </button>

          <button
            onClick={() => setLeftTab('DASHBOARD')}
            className={`kv-tab ${leftTab === 'DASHBOARD' ? 'active' : ''}`}
          >
            <BarChart3 size={15} /> Báo cáo ca
          </button>

          {/* Ô TÌM KIẾM NHANH */}
          <div className="ms-2 mb-1.5 d-none d-xl-flex align-items-center rounded-pill px-3" style={{ width: '240px', height: '30px', backgroundColor: 'rgba(255,255,255,0.16)' }}>
            <Search size={14} className="text-white-50 me-2" />
            <input
              id="pos-global-search"
              type="text"
              placeholder="Tìm món, bàn (F3)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="form-control form-control-sm bg-transparent border-0 text-white shadow-none p-0 kv-placeholder"
              style={{ fontSize: '12.5px' }}
            />
            {searchQuery && <X size={13} className="text-white-50 cursor-pointer" onClick={() => setSearchQuery('')} />}
          </div>
        </div>

        {/* CỤM TAB ĐƠN HÀNG & HỆ THỐNG BÊN PHẢI */}
        <div className="d-flex align-items-end gap-2 h-100">
          {selectedTable && (
            <div className="kv-tab active d-flex align-items-center gap-2 pe-2">
              <span>{selectedTable.table_number}</span>
              <span
                onClick={(e) => { e.stopPropagation(); handleClearSelectedTable(); }}
                className="rounded-circle d-inline-flex align-items-center justify-content-center kv-close-x"
              >
                <X size={12} />
              </span>
            </div>
          )}

          <div className="d-flex align-items-center gap-2 mb-1.5">
            <button
              onClick={handleToggleShift}
              className="btn btn-sm fw-bold rounded-pill px-2.5 py-0 d-flex align-items-center gap-1.5 border-0"
              style={{
                backgroundColor: isShiftOpen ? '#16a34a' : '#facc15',
                color: isShiftOpen ? '#ffffff' : '#1e293b',
                fontSize: '11.5px',
                height: '26px'
              }}
            >
              <span className="rounded-circle" style={{ width: '6px', height: '6px', backgroundColor: isShiftOpen ? '#ffffff' : '#1e293b' }}></span>
              {isShiftOpen ? 'Ca đang mở' : 'Chưa mở ca'}
            </button>

            <button onClick={fetchData} className="btn btn-sm text-white p-1 rounded-circle kv-icon-btn" title="Đồng bộ dữ liệu">
              <RefreshCw size={15} className={loading ? 'spin-anim' : ''} />
            </button>

            <div className="d-flex align-items-center gap-1.5 ps-2 border-start border-white border-opacity-25 position-relative">
              <span className="fw-semibold d-none d-sm-inline" style={{ fontSize: '12.5px' }}>{staffName}</span>
              <button onClick={() => setShowMenuDropdown(!showMenuDropdown)} className="btn btn-sm text-white p-1 rounded-2 kv-icon-btn">
                <Menu size={18} />
              </button>

              {showMenuDropdown && (
                <div className="position-absolute end-0 top-100 mt-1 bg-white rounded-3 shadow-lg py-1.5 text-dark border" style={{ width: '210px', zIndex: 1050 }}>
                  <button onClick={() => { setLeftTab('DASHBOARD'); setShowMenuDropdown(false); }} className="dropdown-item px-3 py-2 small d-flex align-items-center gap-2">
                    <BarChart3 size={15} className="text-primary"/> Báo cáo doanh thu ca
                  </button>
                  <button onClick={() => { window.print(); setShowMenuDropdown(false); }} className="dropdown-item px-3 py-2 small d-flex align-items-center gap-2">
                    <Printer size={15} className="text-primary"/> In hóa đơn tạm
                  </button>
                  <div className="dropdown-divider my-1"></div>
                  <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="dropdown-item px-3 py-2 small d-flex align-items-center gap-2 text-danger fw-bold">
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ================= 2. KHÔNG GIAN LÀM VIỆC 2 CỘT BO GÓC ================= */}
      <div className="flex-grow-1 px-2 pb-1 row g-2 overflow-hidden m-0">
        
        {/* === CỘT TRÁI: PHÒNG BÀN / THỰC ĐƠN / BÁO CÁO (58%) === */}
        <div className="col-md-7 col-lg-7 h-100 d-flex flex-column">
          <div className="shadow-sm flex-grow-1 d-flex flex-column overflow-hidden" style={{ backgroundColor: '#f1f5f9', borderRadius: '0 14px 14px 14px' }}>
            
            {/* --- TAB 1: PHÒNG BÀN --- */}
            {leftTab === 'TABLES' && (
              <>
                <div className="px-3 pt-2.5 pb-2 bg-white border-bottom">
                  {/* Bộ lọc tầng/khu vực dạng viên thuốc chuẩn KiotViet */}
                  <div className="d-flex gap-1.5 mb-2 overflow-auto">
                    {floors.map(fl => (
                      <button
                        key={fl}
                        onClick={() => { setSelectedFloor(fl); setCurrentPage(1); }}
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold border-0"
                        style={{
                          backgroundColor: selectedFloor === fl ? '#003e9c' : '#f1f5f9',
                          color: selectedFloor === fl ? '#ffffff' : '#475569',
                          fontSize: '12px'
                        }}
                      >
                        {fl === 'ALL' ? 'Tất cả' : fl}
                      </button>
                    ))}
                  </div>

                  {/* Radio lọc trạng thái bàn */}
                  <div className="d-flex align-items-center gap-4 fw-semibold text-secondary" style={{ fontSize: '12.5px' }}>
                    <label className="d-flex align-items-center gap-1.5 cursor-pointer mb-0">
                      <input type="radio" checked={statusRadio === 'ALL'} onChange={() => { setStatusRadio('ALL'); setCurrentPage(1); }} className="form-check-input mt-0" />
                      <span className={statusRadio === 'ALL' ? 'text-dark fw-bold' : ''}>Tất cả ({tables.length})</span>
                    </label>
                    <label className="d-flex align-items-center gap-1.5 cursor-pointer mb-0">
                      <input type="radio" checked={statusRadio === 'USED'} onChange={() => { setStatusRadio('USED'); setCurrentPage(1); }} className="form-check-input mt-0" />
                      <span className={statusRadio === 'USED' ? 'text-primary fw-bold' : ''}>Sử dụng ({usedCount})</span>
                    </label>
                    <label className="d-flex align-items-center gap-1.5 cursor-pointer mb-0">
                      <input type="radio" checked={statusRadio === 'EMPTY'} onChange={() => { setStatusRadio('EMPTY'); setCurrentPage(1); }} className="form-check-input mt-0" />
                      <span className={statusRadio === 'EMPTY' ? 'text-dark fw-bold' : ''}>Còn trống ({emptyCount})</span>
                    </label>
                  </div>
                </div>

                {/* LƯỚI 6 CỘT x 4 HÀNG = 24 Ô CHUẨN TỶ LỆ VUÔNG VỨC */}
                <div className="p-3 flex-grow-1 overflow-auto">
                  <div className="kv-24-grid">
                    {paginatedGridItems.map(item => {
                      if (item.isSpecial) {
                        const isDelivery = item.type === 'DELIVERY';
                        return (
                          <div
                            key={item.id}
                            onClick={() => setLeftTab('MENU')}
                            className="kv-table-card"
                            style={{ backgroundColor: isDelivery ? '#7ea6e0' : 'transparent' }}
                          >
                            <div
                              className="rounded-3 d-flex align-items-center justify-content-center mb-1.5"
                              style={{
                                width: '54px',
                                height: '54px',
                                backgroundColor: isDelivery ? '#003e9c' : '#cbd5e1',
                                color: isDelivery ? '#ffffff' : '#334155'
                              }}
                            >
                              {isDelivery ? <Bike size={28} /> : <ShoppingBag size={26} />}
                            </div>
                            <span className="fw-bold" style={{ fontSize: '13px', color: isDelivery ? '#0f172a' : '#334155' }}>
                              {item.label}
                            </span>
                          </div>
                        );
                      }

                      const t = item;
                      const summary = getTableSummary(t);
                      const isOccupied = ['occupied', 'busy', 'payment_pending'].includes(t.status);
                      const isSelected = selectedTable?.id === t.id;

                      // Bảng màu chuẩn 100% ảnh mẫu KiotViet FnB
                      let cardBg = 'transparent';
                      let labelColor = '#1e293b';
                      let strokeColor = '#475569';
                      let innerTextColor = '#0f172a';

                      if (isSelected) {
                        cardBg = '#002b73';       // Xanh navy đậm khi đang chọn
                        labelColor = '#ffffff';
                        strokeColor = '#93c5fd';
                        innerTextColor = '#ffffff';
                      } else if (isOccupied) {
                        cardBg = '#7ea6e0';       // Xanh dương dịu khi bàn có khách
                        labelColor = '#0f172a';
                        strokeColor = '#1e3a8a';
                        innerTextColor = '#0f172a';
                      }

                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTable(t)}
                          className={`kv-table-card ${isSelected ? 'shadow' : ''}`}
                          style={{ backgroundColor: cardBg }}
                        >
                          {/* Biểu tượng bàn ăn 4 ghế cách điệu chuẩn KiotViet */}
                          <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '104px', height: '64px' }}>
                            <svg width="104" height="64" viewBox="0 0 104 64" fill="none" className="position-absolute top-0 start-0">
                              {/* 2 Ghế trên */}
                              <rect x="24" y="2" width="22" height="4" rx="2" fill={strokeColor} opacity="0.7" />
                              <rect x="58" y="2" width="22" height="4" rx="2" fill={strokeColor} opacity="0.7" />
                              {/* Mặt bàn chính */}
                              <rect x="8" y="9" width="88" height="46" rx="11" stroke={strokeColor} strokeWidth="2.2" fill={isSelected ? 'rgba(255,255,255,0.06)' : 'transparent'} />
                              {/* 2 Ghế dưới */}
                              <rect x="24" y="58" width="22" height="4" rx="2" fill={strokeColor} opacity="0.7" />
                              <rect x="58" y="58" width="22" height="4" rx="2" fill={strokeColor} opacity="0.7" />
                            </svg>

                            {/* Thông tin Tiền + Thời gian + Số món nằm gọn bên trong mặt bàn */}
                            {isOccupied && (
                              <div className="position-relative z-1 w-100 px-3" style={{ color: innerTextColor, fontSize: '11.5px', lineHeight: '1.3' }}>
                                <div className="d-flex justify-content-between align-items-center fw-bold">
                                  <span>{summary.total > 0 ? summary.total.toLocaleString() : '0'}</span>
                                  <span style={{ fontSize: '11px', opacity: 0.9 }}>{summary.durationText}</span>
                                </div>
                                <div className="d-flex align-items-center gap-1 mt-1 fw-bold" style={{ fontSize: '11px', opacity: 0.92 }}>
                                  <Utensils size={11} /> {summary.itemCount}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tên bàn bên dưới */}
                          <div className="fw-bold mt-1.5 text-center text-truncate w-100" style={{ fontSize: '13px', color: labelColor }}>
                            {t.table_number}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* THANH ĐIỀU HƯỚNG PHÂN TRANG < 1/2 > */}
                <div className="px-3 py-2 border-top bg-white d-flex justify-content-between align-items-center" style={{ fontSize: '12.5px' }}>
                  <label className="d-flex align-items-center gap-2 cursor-pointer mb-0 text-secondary">
                    <input
                      type="checkbox"
                      checked={openMenuOnSelect}
                      onChange={(e) => setOpenMenuOnSelect(e.target.checked)}
                      className="form-check-input mt-0"
                    />
                    <span>Mở thực đơn khi chọn bàn</span>
                  </label>

                  <div className="d-flex align-items-center gap-2 text-dark fw-bold">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="btn btn-sm p-1 border-0 text-secondary"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>{safePage}/{totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="btn btn-sm p-1 border-0 text-secondary"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* --- TAB 2: THỰC ĐƠN (CÓ ẢNH MÓN ĂN THẬT) --- */}
            {leftTab === 'MENU' && (
              <div className="d-flex flex-column h-100 bg-white">
                <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center gap-2">
                  <div className="d-flex gap-1.5 overflow-auto" style={{ scrollbarWidth: 'none' }}>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className="btn btn-sm rounded-pill px-3 fw-bold flex-shrink-0 border-0"
                        style={{
                          backgroundColor: activeCategory === cat ? '#003e9c' : '#f1f5f9',
                          color: activeCategory === cat ? '#ffffff' : '#475569',
                          fontSize: '12px'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setLeftTab('TABLES')} className="btn btn-sm btn-outline-primary fw-bold rounded-pill flex-shrink-0">
                    Sơ đồ bàn
                  </button>
                </div>

                <div className="p-3 overflow-auto flex-grow-1" style={{ backgroundColor: '#f1f5f9' }}>
                  <div className="row g-2.5">
                    {filteredMenu.map(item => (
                      <div key={item.id} className="col-6 col-sm-4 col-xl-3">
                        <div
                          onClick={() => handleAddMenuItemToTable(item)}
                          className="card border-0 rounded-3 overflow-hidden cursor-pointer hover-card h-100 bg-white shadow-sm"
                        >
                          <div className="position-relative bg-light" style={{ height: '105px' }}>
                            <img
                              src={getProductImageUrl(item)}
                              alt={item.name}
                              className="w-100 h-100 object-fit-cover"
                              onError={(e) => { e.target.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Mon+An'; }}
                            />
                            <span className="position-absolute bottom-0 end-0 m-1.5 badge text-white fw-bold" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', fontSize: '11.5px' }}>
                              {Number(item.price).toLocaleString()}đ
                            </span>
                          </div>
                          <div className="p-2 text-center">
                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '12.5px' }}>{item.name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 3: BÁO CÁO CA --- */}
            {leftTab === 'DASHBOARD' && (
              <div className="p-4 overflow-auto flex-grow-1" style={{ backgroundColor: '#f1f5f9' }}>
                <h5 className="fw-bold text-dark mb-3">Tổng Quan Doanh Thu Ca Trực</h5>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="bg-white p-3 rounded-4 shadow-sm border-start border-primary border-4">
                      <div className="text-muted small fw-bold mb-1"><TrendingUp size={15} className="text-primary me-1"/> Doanh thu ca</div>
                      <div className="fs-4 fw-bold text-dark">{(shiftStats.cashRevenue + shiftStats.transferRevenue).toLocaleString()}đ</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-3 rounded-4 shadow-sm border-start border-success border-4">
                      <div className="text-muted small fw-bold mb-1"><CheckCircle2 size={15} className="text-success me-1"/> Hóa đơn đã thu</div>
                      <div className="fs-4 fw-bold text-success">{shiftStats.totalBills} đơn</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-3 rounded-4 shadow-sm border-start border-warning border-4">
                      <div className="text-muted small fw-bold mb-1"><Wallet size={15} className="text-warning me-1"/> Tiền mặt trong két</div>
                      <div className="fs-4 fw-bold text-dark">{(startingCash + shiftStats.cashRevenue).toLocaleString()}đ</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-4 shadow-sm">
                  <h6 className="fw-bold mb-3 small text-uppercase text-muted">Biểu đồ thu tiền theo giờ</h6>
                  <div style={{ height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={realChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => `${Number(v).toLocaleString()}đ`} />
                        <Bar dataKey="revenue" fill="#003e9c" radius={[6, 6, 0, 0]} barSize={40}>
                          {realChartData.map((_, idx) => (
                            <Cell key={idx} fill={idx % 2 === 0 ? '#003e9c' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* === CỘT PHẢI: HÓA ĐƠN CHI TIẾT & THANH TOÁN (42%) === */}
        <div className="col-md-5 col-lg-5 h-100 d-flex flex-column">
          <div className="bg-white rounded-4 shadow-sm flex-grow-1 d-flex flex-column overflow-hidden">
            
            {/* HEADER HÓA ĐƠN CHUẨN KIOTVIET (BÀN + TÌM KHÁCH F4 + BẢNG GIÁ CHUNG) */}
            <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center gap-2 bg-white">
              <div className="d-flex align-items-center gap-2 flex-grow-1">
                <span className="badge rounded-pill px-3 py-1.5 fw-bold d-flex align-items-center gap-1.5 flex-shrink-0" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '12px' }}>
                  <LayoutGrid size={13} /> {selectedTable ? selectedTable.table_number : 'Chưa chọn bàn'}
                </span>

                <div className="d-none d-xl-flex align-items-center bg-light rounded-pill px-2.5 py-1 flex-grow-1 border" style={{ maxWidth: '210px' }}>
                  <Search size={12} className="text-muted me-1.5" />
                  <input
                    id="pos-customer-search"
                    type="text"
                    placeholder="Tìm khách hàng (F4)"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="form-control form-control-sm bg-transparent border-0 shadow-none p-0"
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>

              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                <span className="badge bg-light text-secondary border rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: '11.5px' }}>
                  <Tag size={12} className="me-1" /> Bảng giá chung
                </span>
                {selectedTable && (
                  <button onClick={handleClearSelectedTable} className="btn btn-sm btn-light border rounded-circle p-1" title="Đóng bàn">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* DANH SÁCH MÓN TRONG HÓA ĐƠN */}
            <div className="flex-grow-1 overflow-auto px-3 py-2 bg-white">
              {!selectedTable ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted text-center">
                  <ShoppingBag size={46} className="mb-2 opacity-20" />
                  <h6 className="fw-bold text-dark">Chưa chọn bàn</h6>
                  <p className="small px-4 mb-0">Bấm chọn một bàn bên trái để xem hóa đơn hoặc gọi món.</p>
                </div>
              ) : flattenedBillItems.length === 0 ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted text-center">
                  <Utensils size={42} className="mb-2 opacity-25 text-primary" />
                  <h6 className="fw-bold text-dark">{selectedTable.table_number} chưa gọi món</h6>
                  <button onClick={() => setLeftTab('MENU')} className="btn btn-sm text-white mt-2 rounded-pill px-4 fw-bold" style={{ backgroundColor: '#003e9c' }}>
                    + Thêm món ngay
                  </button>
                </div>
              ) : (
                <div className="d-flex flex-column">
                  {flattenedBillItems.map((item, idx) => {
                    const unitPrice = Number(item.unit_price || item.price || 0);
                    const qty = Number(item.quantity || 1);
                    const lineTotal = unitPrice * qty;

                    return (
                      <div key={`${item.order_id}-${item.id || idx}`} className="py-2.5 border-bottom d-flex align-items-center justify-content-between gap-2">
                        <div className="d-flex align-items-start gap-2 flex-grow-1">
                          <button
                            onClick={() => handleCancelItem(item.id)}
                            className="btn btn-sm text-muted kv-trash-btn p-0 mt-0.5"
                            title="Xóa món"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                              {idx + 1}. {item.product_name || item.name}
                            </div>
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              {item.note ? item.note : 'Không có Ghi chú/Món thêm'}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateItemQty(item, -1)}
                            className="btn btn-xs btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center"
                            style={{ width: '24px', height: '24px' }}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="fw-bold text-dark text-center" style={{ width: '22px', fontSize: '13px' }}>{qty}</span>
                          <button
                            onClick={() => handleUpdateItemQty(item, 1)}
                            className="btn btn-xs btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center"
                            style={{ width: '24px', height: '24px' }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <div className="text-end" style={{ minWidth: '90px' }}>
                          <div className="text-muted border-bottom pb-0.5" style={{ fontSize: '11.5px' }}>{unitPrice.toLocaleString()}</div>
                          <div className="fw-bold text-dark pt-0.5" style={{ fontSize: '13.5px' }}>{lineTotal.toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER HÓA ĐƠN: DÃY ICON TIỆN ÍCH + TỔNG TIỀN + 3 NÚT LỚN */}
            <div className="p-3 bg-white border-top">
              <div className="d-flex justify-content-between align-items-center mb-2.5 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-1">
                  <span className="badge bg-light text-dark border px-2.5 py-1.5 rounded-pill fw-semibold">
                    <User size={12} className="me-1" /> {staffName}
                  </span>
                  <button onClick={() => setLeftTab('MENU')} className="btn btn-sm bg-light border rounded-pill px-2.5 py-1 fw-bold text-primary" style={{ fontSize: '11.5px' }}>
                    + Thêm món
                  </button>
                  <button onClick={() => alert('Tính năng tách/ghép bàn')} className="btn btn-sm btn-light border rounded-circle p-1.5 text-secondary d-none d-xl-inline-flex" title="Tách / Ghép bàn">
                    <Split size={13} />
                  </button>
                  <button onClick={() => alert('Lịch sử gọi món')} className="btn btn-sm btn-light border rounded-circle p-1.5 text-secondary d-none d-xl-inline-flex" title="Lịch sử gọi món">
                    <History size={13} />
                  </button>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small fw-semibold">Tổng tiền</span>
                  <span className="badge rounded-pill px-2 text-white" style={{ backgroundColor: '#1d4ed8' }}>{currentBillQty}</span>
                  <span className="fs-4 fw-bold text-dark">{currentBillTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-4">
                  <button
                    onClick={() => alert('Đã gửi thông báo xuống Bếp / Bar!')}
                    disabled={!selectedTable}
                    className="btn w-100 py-2.5 fw-bold text-dark bg-light border rounded-3 d-flex align-items-center justify-content-center gap-1.5"
                    style={{ fontSize: '13px' }}
                  >
                    <Bell size={15} /> Thông báo (F10)
                  </button>
                </div>

                <div className="col-4">
                  <button
                    onClick={() => window.print()}
                    disabled={!selectedTable || currentBillTotal <= 0}
                    className="btn w-100 py-2.5 fw-bold rounded-3 d-flex align-items-center justify-content-center gap-1.5"
                    style={{ backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', fontSize: '13px' }}
                  >
                    <Printer size={15} /> In tạm tính
                  </button>
                </div>

                <div className="col-4">
                  <button
                    onClick={() => setShowPayModal(true)}
                    disabled={!selectedTable || currentBillTotal <= 0}
                    className="btn w-100 py-2.5 fw-bold text-white rounded-3 d-flex align-items-center justify-content-center gap-1.5 border-0 shadow-sm"
                    style={{ backgroundColor: '#003e9c', fontSize: '13.5px' }}
                  >
                    <DollarSign size={16} /> Thanh toán (F9)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ================= 3. BOTTOM STATUS BAR XANH NAVY ================= */}
      <footer className="px-3 py-1 text-white d-flex justify-content-center align-items-center gap-4" style={{ backgroundColor: '#003e9c', fontSize: '11.5px' }}>
        <span className="d-flex align-items-center gap-1 opacity-90"><Phone size={12} /> Hỗ trợ 1900 6522</span>
        <span className="d-flex align-items-center gap-1 opacity-90"><MapPin size={12} /> Chi nhánh trung tâm</span>
        <span className="d-flex align-items-center gap-1 opacity-90"><Keyboard size={12} /> Phím tắt (F3 / F4 / F9 / F10)</span>
        <span className="px-2.5 py-0.5 rounded-pill fw-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
          Phiên bản 2.19.0
        </span>
      </footer>

      {/* ================= MODAL THANH TOÁN ================= */}
      {showPayModal && selectedTable && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)' }} onClick={() => setShowPayModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header text-white py-3" style={{ backgroundColor: '#003e9c' }}>
                <h5 className="modal-title fw-bold">Thanh Toán • {selectedTable.table_number}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPayModal(false)} />
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-3">
                  <div className="text-muted small fw-bold text-uppercase">Tổng tiền thanh toán</div>
                  <div className="display-5 fw-bold text-danger">{currentBillTotal.toLocaleString()}đ</div>
                </div>

                <div className="d-flex gap-2 mb-3">
                  <button
                    onClick={() => setPaymentMethod('CASH')}
                    className={`btn flex-grow-1 py-2.5 fw-bold rounded-3 d-flex align-items-center justify-content-center gap-2 ${paymentMethod === 'CASH' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  >
                    <Wallet size={18} /> Tiền mặt
                  </button>
                  <button
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`btn flex-grow-1 py-2.5 fw-bold rounded-3 d-flex align-items-center justify-content-center gap-2 ${paymentMethod === 'TRANSFER' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                  >
                    <QrCode size={18} /> Chuyển khoản QR
                  </button>
                </div>

                {paymentMethod === 'CASH' && (
                  <div className="p-3 bg-light rounded-3 border">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-bold text-muted">Tiền khách đưa:</span>
                      <div className="d-flex gap-1">
                        {[100000, 200000, 500000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCustomerCash(amt)}
                            className={`btn btn-xs px-2 py-1 rounded-2 fw-bold ${customerCash === amt ? 'btn-dark text-white' : 'btn-white border'}`}
                            style={{ fontSize: '11px' }}
                          >
                            {amt / 1000}k
                          </button>
                        ))}
                      </div>
                    </div>
                    {customerCash > 0 && (
                      <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                        <span className="small text-muted">Tiền thừa trả khách:</span>
                        <span className="fw-bold text-success fs-5">{changeAmount.toLocaleString()}đ</span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'TRANSFER' && (
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <QrCode size={84} className="text-primary mb-2" />
                    <div className="small text-muted">Khách quét mã VietQR để chuyển đúng số tiền <b>{currentBillTotal.toLocaleString()}đ</b>.</div>
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button onClick={() => setShowPayModal(false)} className="btn btn-light border px-4 rounded-3 fw-bold">Hủy</button>
                <button onClick={handleConfirmPayment} className="btn btn-success px-4 py-2 rounded-3 fw-bold shadow-sm">
                  XÁC NHẬN THU TIỀN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= CSS TỐI ƯU CHUẨN KIOTVIET FNB ================= */}
      <style dangerouslySetInnerHTML={{__html: `
        .kv-tab {
          background: transparent;
          color: rgba(255, 255, 255, 0.92);
          border: none;
          padding: 7px 16px;
          font-weight: 700;
          font-size: 13px;
          border-top-left-radius: 11px;
          border-top-right-radius: 11px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .kv-tab:hover:not(.active) {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }
        .kv-tab.active {
          background: #ffffff;
          color: #003e9c;
        }
        .kv-close-x {
          width: 18px;
          height: 18px;
          color: #64748b;
        }
        .kv-close-x:hover {
          background-color: #e2e8f0;
          color: #0f172a;
        }
        .kv-icon-btn:hover {
          background-color: rgba(255, 255, 255, 0.16);
        }
        .kv-placeholder::placeholder {
          color: rgba(255, 255, 255, 0.65);
        }
        .kv-24-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
        }
        .kv-table-card {
          height: 112px;
          border-radius: 14px;
          padding: 8px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.12s ease, background-color 0.15s ease;
        }
        .kv-table-card:hover {
          filter: brightness(0.96);
        }
        .hover-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.08) !important;
        }
        .kv-trash-btn:hover {
          color: #dc2626 !important;
        }
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}