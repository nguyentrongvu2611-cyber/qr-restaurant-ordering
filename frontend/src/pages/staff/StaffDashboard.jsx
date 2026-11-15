import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, CheckCircle2, Utensils,
  QrCode, User, Home, AlertTriangle, Check, BookOpen, LogOut,
  Repeat, Ban, X, Plus, Minus, Trash2, Search, ChevronRight,
  IdCard, Lock, FileText, MessageSquare, Bell, BarChart3, Eye
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';
const MAX_PREVIEW_ITEMS = 3; // Chỉ hiển thị tối đa 3 món trên thẻ ngoài, bấm vào mở Popup xem hết

export default function StaffDashboard() {
  const [bottomNav, setBottomNav] = useState('HOME'); // 'HOME' | 'MENU' | 'PROFILE'
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'READY' | 'TABLES'
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuProducts, setMenuProducts] = useState([]);
  const [staffProfileInfo, setStaffProfileInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  // Trạng thái bật/tắt thông báo trên trang Cá nhân (Giống Ảnh 4)
  const [notifyEnabled, setNotifyEnabled] = useState(() => localStorage.getItem('staff_notify_enabled') !== 'false');
  // Popup chi tiết cho các mục trong trang Cá nhân: 'INFO' | 'STATS' | 'PASSWORD' | 'SOP' | 'FEEDBACK' | null
  const [profileSubModal, setProfileSubModal] = useState(null);
  const [pwdForm, setPwdForm] = useState({ oldPwd: '', newPwd: '', confirmPwd: '' });
  const [feedbackText, setFeedbackText] = useState('');

  const [outOfStockNames, setOutOfStockNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'); } catch { return []; }
  });
  const [rejectedItemIds, setRejectedItemIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'); } catch { return []; }
  });
  const [requestedCancelIds, setRequestedCancelIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]').map(r => r.item_id); } catch { return []; }
  });

  // Popup 1: Xem & Sửa chi tiết Order của 1 bàn (hoặc khi bấm vào đơn dài ở tab Chờ duyệt)
  const [viewingTable, setViewingTable] = useState(null);
  // Popup 2: Đổi món cho khách
  const [swappingItem, setSwappingItem] = useState(null);
  const [swapSearch, setSwapSearch] = useState('');
  // Popup 3: Thêm món mới vào Đơn hoặc Bàn
  const [addingToTarget, setAddingToTarget] = useState(null);
  const [addSearch, setAddSearch] = useState('');
  const [addCategory, setAddCategory] = useState('Tất cả');
  // Popup 4: Xác nhận xóa món
  const [confirmDeletePopup, setConfirmDeletePopup] = useState(null);

  const [serviceRequests, setServiceRequests] = useState([]);
  const [staffToast, setStaffToast] = useState(null);

  const token = localStorage.getItem('access_token');
  const staffName = localStorage.getItem('full_name') || 'Nguyễn Trọng Vũ';

  const showToast = (text) => {
    setStaffToast(text);
    setTimeout(() => setStaffToast(null), 2600);
  };

  const handleToggleNotify = () => {
    const next = !notifyEnabled;
    setNotifyEnabled(next);
    localStorage.setItem('staff_notify_enabled', String(next));
    showToast(next ? 'Đã bật thông báo & âm báo đơn mới' : 'Đã tắt âm báo đơn mới');
  };

  const getProductImageUrl = (prodOrUrl) => {
    const rawUrl = typeof prodOrUrl === 'string'
      ? prodOrUrl
      : (prodOrUrl?.image_url || prodOrUrl?.image || prodOrUrl?.thumbnail);
    if (!rawUrl) return 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    return `${API_BASE}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  const productLookupMap = useMemo(() => {
    const byId = {};
    const byName = {};
    menuProducts.forEach(p => {
      byId[p.id] = p;
      if (p.name) byName[p.name.toLowerCase().trim()] = p;
    });
    return { byId, byName };
  }, [menuProducts]);

  const getItemImage = (item) => {
    if (item?.image_url) return getProductImageUrl(item.image_url);
    const pid = item?.product_id || item?.menu_item_id;
    if (pid && productLookupMap.byId[pid]) {
      return getProductImageUrl(productLookupMap.byId[pid]);
    }
    const nameKey = String(item?.product_name || item?.name || '').toLowerCase().trim();
    if (nameKey && productLookupMap.byName[nameKey]) {
      return getProductImageUrl(productLookupMap.byName[nameKey]);
    }
    return 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An';
  };

  const getItemUnitPrice = (item) => {
    const rawPrice = Number(item?.unit_price || item?.price || 0);
    if (rawPrice > 0) return rawPrice;
    const pid = item?.product_id || item?.menu_item_id;
    if (pid && productLookupMap.byId[pid]) return Number(productLookupMap.byId[pid].price || 0);
    const nameKey = String(item?.product_name || item?.name || '').toLowerCase().trim();
    if (nameKey && productLookupMap.byName[nameKey]) return Number(productLookupMap.byName[nameKey].price || 0);
    return 0;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOrders, resTables, resProducts, resHidden, resStaffUsers, resCalls] = await Promise.all([
        fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/tables`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => (r && r.ok ? r : fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } })))
          .catch(() => null),
        fetch(`${API_BASE}/api/kitchen/hidden-products`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${API_BASE}/api/kitchen/staff-users`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${API_BASE}/api/kitchen/live-alerts-v2`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);

      if (resOrders.ok) setOrders(await resOrders.json());
      if (resTables.ok) setTables(await resTables.json());

      if (resCalls && resCalls.ok) {
        const cData = await resCalls.json();
        setServiceRequests(cData.calls || []);
      }

      if (resStaffUsers && resStaffUsers.ok) {
        const sList = await resStaffUsers.json();
        if (Array.isArray(sList) && sList.length > 0) {
          const matched = sList.find(u => u.full_name === staffName) || sList[0];
          setStaffProfileInfo(matched);
        }
      }

      let serverHiddenIds = [];
      if (resHidden && resHidden.ok) {
        const hData = await resHidden.json();
        serverHiddenIds = hData.hidden_ids || [];
      }
      const localHiddenIds = JSON.parse(localStorage.getItem('pos_hidden_product_ids') || '[]');
      const localHiddenNames = JSON.parse(localStorage.getItem('pos_hidden_product_names') || '[]');
      const allHiddenIds = new Set([...serverHiddenIds, ...localHiddenIds].map(Number));

      
      if (resProducts && resProducts.ok) {
        const prodData = await resProducts.json();
        const rawList = Array.isArray(prodData) ? prodData : (prodData.items || []);

        const visibleProducts = rawList.filter(
          p => !allHiddenIds.has(Number(p.id)) && !localHiddenNames.includes(p.name) && p.is_deleted !== true
        );
        setMenuProducts(visibleProducts);

        const dbAvailNames = new Set(
          visibleProducts.filter(p => p.is_available === true || p.is_available === 1).map(p => p.name)
        );
        const savedOut = JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]');
        const cleanedOut = savedOut.filter(n => !dbAvailNames.has(n));
        if (cleanedOut.length !== savedOut.length) {
          localStorage.setItem('pos_out_of_stock_names', JSON.stringify(cleanedOut));
        }
        setOutOfStockNames(cleanedOut);
      } else {
        setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      }

      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
      setRequestedCancelIds(JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]').map(r => r.item_id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);

    const bc = new BroadcastChannel('smartpos_channel');
    bc.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'KITCHEN_OUT_OF_STOCK' && payload) {
        setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
        setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
        fetchData();
      }
      if (
        type === 'PRODUCT_HIDDEN_FROM_MENU' ||
        type === 'PRODUCT_RESTORED' ||
        type === 'CASHIER_CONFIRMED_CANCEL' ||
        type === 'TABLE_CANCELLED' ||
        type === 'ORDER_CONFIRMED' ||
        type === 'EXPO_SERVED'
      ) {
        fetchData();
      }
      if (type === 'CUSTOMER_CALL_SERVICE' && payload) {
        setServiceRequests(prev => [payload, ...prev]);
      }
    };

    const handleStorageChange = () => {
      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
      setRequestedCancelIds(JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]').map(r => r.item_id));
      fetchData();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      bc.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isItemOutOfStock = (item) => {
    const st = String(item.item_status || item.status || '').toLowerCase();
    const name = item.product_name || item.name;
    if (st === 'cancelled' || st === 'served') return false;
    return st === 'out_of_stock' || rejectedItemIds.includes(item.id) || outOfStockNames.includes(name);
  };

  const isProductAvailable = (prod) => {
    if (!prod) return false;
    if (prod.is_available === true || prod.is_available === 1) {
      return !outOfStockNames.includes(prod.name);
    }
    return prod.is_available !== false && prod.is_available !== 0 && !outOfStockNames.includes(prod.name);
  };

  const outOfStockOrderItems = useMemo(() => {
    const list = [];
    orders.forEach(order => {
      const oStatus = String(order.status).toLowerCase();
      if (['completed', 'cancelled', 'paid'].includes(oStatus)) return;
      const tName = order.table_name || `Bàn 0${order.table_id}`;
      (order.items || order.order_items || []).forEach(item => {
        if (isItemOutOfStock(item)) {
          list.push({
            ...item,
            order_id: order.id,
            order_code: order.order_code || `ORD-${order.id}`,
            table_id: order.table_id,
            table_name: tName
          });
        }
      });
    });
    return list;
  }, [orders, outOfStockNames, rejectedItemIds]);

  const handleStaffAdjustItemQty = async (item, delta, tableName = '') => {
    const currentQty = Number(item.quantity || 1);
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      setConfirmDeletePopup({ item, tableName });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/kitchen/items/${item.id}/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: nextQty })
      });

      if (res.ok) {
        const bc = new BroadcastChannel('smartpos_channel');
        bc.postMessage({ type: 'STAFF_SWAPPED_ITEM', payload: { item_id: item.id, quantity: nextQty } });
        bc.close();
        showToast(`Đã cập nhật: ${nextQty}x ${item.product_name || item.name}`);
        await fetchData();
      }
    } catch (e) {
      alert('Không thể cập nhật số lượng món!');
    }
  };

  const executeDeleteWrongItem = async () => {
    if (!confirmDeletePopup) return;
    const { item } = confirmDeletePopup;
    const itemName = item.product_name || item.name;

    try {
      const res = await fetch(`${API_BASE}/api/kitchen/items/${item.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: `Nhân viên ${staffName} xóa món khách gọi nhầm` })
      });

      if (res.ok) {
        const nextRejected = rejectedItemIds.filter(id => id !== item.id);
        localStorage.setItem('pos_rejected_item_ids', JSON.stringify(nextRejected));
        setRejectedItemIds(nextRejected);

        const bc = new BroadcastChannel('smartpos_channel');
        bc.postMessage({ type: 'CASHIER_CONFIRMED_CANCEL', payload: { item_id: item.id } });
        bc.close();

        setConfirmDeletePopup(null);
        showToast(`Đã xóa "${itemName}" khỏi đơn`);
        await fetchData();
      }
    } catch (e) {
      alert('Lỗi khi xóa món!');
    }
  };

  const handleConfirmSwapItem = async (newProduct) => {
    if (!swappingItem) return;
    try {
      await fetch(`${API_BASE}/api/kitchen/items/${swappingItem.id}/swap`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_product_id: newProduct.id })
      });

      const nextRejected = rejectedItemIds.filter(id => id !== swappingItem.id);
      localStorage.setItem('pos_rejected_item_ids', JSON.stringify(nextRejected));
      setRejectedItemIds(nextRejected);

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({
        type: 'STAFF_SWAPPED_ITEM',
        payload: {
          table_name: swappingItem.table_name,
          old_name: swappingItem.product_name || swappingItem.name,
          new_name: newProduct.name
        }
      });
      bc.close();

      showToast(`Đã đổi sang món: ${newProduct.name}`);
      setSwappingItem(null);
      await fetchData();
    } catch (e) {
      alert('Lỗi khi đổi món cho khách!');
    }
  };

  const handleStaffAddProductToTarget = async (product) => {
    if (!addingToTarget) return;
    const { orderId, tableId, tableName } = addingToTarget;

    try {
      if (orderId) {
        const res = await fetch(`${API_BASE}/api/kitchen/orders/${orderId}/add-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ product_id: product.id, quantity: 1 })
        });

        if (res.ok) {
          const bc = new BroadcastChannel('smartpos_channel');
          bc.postMessage({ type: 'STAFF_SWAPPED_ITEM', payload: { order_id: orderId } });
          bc.close();
          showToast(`Đã thêm +1 ${product.name} vào ${tableName}`);
          await fetchData();
          return;
        }
      }

      if (tableId) {
        const resCreate = await fetch(`${API_BASE}/api/kitchen/cashier-create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            table_id: tableId,
            status: 'confirmed',
            items: [{ product_id: product.id, quantity: 1, price: product.price, unit_price: product.price }]
          })
        });

        if (resCreate.ok) {
          const data = await resCreate.json().catch(() => ({}));
          if (data.order_id) {
            setAddingToTarget(prev => ({ ...prev, orderId: data.order_id }));
          }
          const bc = new BroadcastChannel('smartpos_channel');
          bc.postMessage({ type: 'CASHIER_CREATED_ORDER', payload: { table_id: tableId } });
          bc.close();
          showToast(`Đã thêm +1 ${product.name} cho ${tableName}`);
          await fetchData();
        }
      }
    } catch (e) {
      alert('Không thể thêm món vào bàn!');
    }
  };

  const handleRequestCashierCancelItem = (item, tableName, orderCode) => {
    const reqObj = {
      req_id: `REQ-${Date.now()}`,
      item_id: item.id,
      order_id: item.order_id,
      order_code: orderCode || `ORD-${item.order_id}`,
      table_name: tableName,
      product_name: item.product_name || item.name,
      quantity: item.quantity || 1,
      price: getItemUnitPrice(item),
      staff_name: staffName,
      reason: 'Món hết - Khách yêu cầu hủy món',
      timestamp: Date.now()
    };

    const existing = JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]');
    const updated = [reqObj, ...existing.filter(r => r.item_id !== item.id)];
    localStorage.setItem('pos_staff_cancel_requests', JSON.stringify(updated));
    setRequestedCancelIds(updated.map(r => r.item_id));

    const bc = new BroadcastChannel('smartpos_channel');
    bc.postMessage({ type: 'STAFF_REQUEST_CANCEL_ITEM', payload: reqObj });
    bc.close();
    showToast(`Đã gửi yêu cầu hủy món sang Thu ngân`);
  };

  const cashierAutoIds = JSON.parse(localStorage.getItem('pos_cashier_confirmed_orders') || '[]');
  const pendingOrders = orders.filter(
    o => String(o.status).toLowerCase() === 'pending' && !cashierAutoIds.includes(o.id)
  );

  const readyToServeList = [];
  orders.forEach(order => {
    if (['confirmed', 'cooking', 'preparing', 'ready'].includes(String(order.status).toLowerCase())) {
      (order.items || order.order_items || []).forEach(item => {
        const st = String(item.item_status || item.status || '').toLowerCase();
        if (st === 'ready' || st === 'done') {
          readyToServeList.push({
            ...item,
            id: item.id,
            orderId: order.id,
            orderCode: order.order_code || `ORD-${order.id}`,
            tableName: order.table_name || `Bàn 0${order.table_id}`,
            productName: item.product_name || item.name,
            quantity: item.quantity,
            note: item.note
          });
        }
      });
    }
  });

  const handleConfirmOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/orders/${orderId}/confirm`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'confirmed' })
        }).catch(() => null);
      }

      const autoConfirmed = JSON.parse(localStorage.getItem('pos_cashier_confirmed_orders') || '[]');
      if (!autoConfirmed.includes(orderId)) {
        autoConfirmed.push(orderId);
        localStorage.setItem('pos_cashier_confirmed_orders', JSON.stringify(autoConfirmed));
      }

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'ORDER_CONFIRMED', payload: { order_id: orderId } });
      bc.close();

      showToast('Đã xác nhận & chuyển đơn xuống Bếp/Bar!');
      await fetchData();
    } catch (e) {
      alert('Lỗi xác nhận đơn!');
    }
  };

  const handleMarkServed = async (itemId) => {
    try {
      await fetch(`${API_BASE}/api/kitchen/items/${itemId}/served`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Đã xác nhận bưng món lên bàn!');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const occupiedTablesCount = tables.filter(t => ['occupied', 'busy', 'payment_pending'].includes(t.status)).length;

  const categories = useMemo(() => {
    const set = new Set(menuProducts.map(p => p.category_name || p.category || 'Món chính'));
    return ['Tất cả', ...Array.from(set)];
  }, [menuProducts]);

  const availableProductsForSwap = useMemo(() => {
    return menuProducts.filter(p => {
      if (!isProductAvailable(p)) return false;
      if (swapSearch && !(p.name || '').toLowerCase().includes(swapSearch.toLowerCase())) return false;
      return true;
    });
  }, [menuProducts, outOfStockNames, swapSearch]);

  const filteredProductsForAdd = useMemo(() => {
    return menuProducts.filter(p => {
      if (!isProductAvailable(p)) return false;
      const cat = p.category_name || p.category || 'Món chính';
      if (addCategory !== 'Tất cả' && cat !== addCategory) return false;
      if (addSearch && !(p.name || '').toLowerCase().includes(addSearch.toLowerCase())) return false;
      return true;
    });
  }, [menuProducts, outOfStockNames, addCategory, addSearch]);

  const filteredMenuTabProducts = useMemo(() => {
    return menuProducts.filter(p => {
      const cat = p.category_name || p.category || 'Món chính';
      if (selectedCategory !== 'Tất cả' && cat !== selectedCategory) return false;
      if (menuSearch && !(p.name || '').toLowerCase().includes(menuSearch.toLowerCase())) return false;
      return true;
    });
  }, [menuProducts, selectedCategory, menuSearch]);

  const openOrderPopupForTable = (tableId, tableName) => {
    const foundTable = tables.find(t => t.id === tableId || t.table_number === tableName) || {
      id: tableId,
      table_number: tableName
    };
    setViewingTable(foundTable);
  };

  const staffCodeText = staffProfileInfo?.staff_code || 'NV002';
  const staffPositionText = staffProfileInfo?.position || 'Nhân viên phục vụ';
  const staffStartDate = staffProfileInfo?.start_date || '19/10/2026';
  const staffWorkDays = staffProfileInfo?.working_days || 28;

  return (
    <div className="min-vh-100 d-flex flex-column position-relative staff-app-shell" style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '90px', backgroundColor: '#f1f5f9' }}>
      
      {/* ================================================================= */}
      {/* HEADER TRANG CHỦ & THỰC ĐƠN (ĐÃ SỬA PADDING RỘNG RÃI, KHÔNG SÁT MÉP) */}
      {/* ================================================================= */}
      {bottomNav !== 'PROFILE' && (
        <div className="staff-top-header">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-3">
              <div className="staff-header-avatar">
                {staffName.charAt(0)}
                <span className="staff-online-dot"></span>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h6 className="fw-bolder mb-0 text-white" style={{ fontSize: '16.5px' }}>{staffName}</h6>
                  <span className="badge bg-white text-primary rounded-pill fw-bold px-2 py-0.5" style={{ fontSize: '10.5px' }}>
                    Staff
                  </span>
                </div>
                <div className="text-white-50 mt-0.5" style={{ fontSize: '12px' }}>
                  Xác nhận đơn • Sửa/Thêm món • Phục vụ bàn
                </div>
              </div>
            </div>
            <button onClick={fetchData} className="staff-refresh-btn" title="Làm mới">
              <RefreshCw size={18} className={loading ? 'spin-anim' : ''} />
            </button>
          </div>

          <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-25">
            <span className="text-white-50 fw-semibold" style={{ fontSize: '12.5px' }}>Trạng thái ca phục vụ:</span>
            <span className="badge bg-success rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1 shadow-sm" style={{ fontSize: '11.5px' }}>
              <CheckCircle2 size={13} /> Đang sẵn sàng
            </span>
          </div>
        </div>
      )}

      {/* TOAST NỔI */}
      {staffToast && (
        <div
          className="position-fixed top-0 start-50 translate-middle-x mt-3 px-4 py-2 rounded-pill shadow-lg text-white fw-bold d-flex align-items-center gap-2"
          style={{ zIndex: 4500, backgroundColor: '#10b981', fontSize: '13px' }}
        >
          <CheckCircle2 size={16} />
          <span>{staffToast}</span>
        </div>
      )}

      {/* KHUNG CẢNH BÁO MÓN HẾT */}
      {bottomNav !== 'PROFILE' && outOfStockOrderItems.length > 0 && (
        <div className="mx-3 mt-3 p-3 rounded-4 bg-danger bg-opacity-10 border border-danger shadow-sm">
          <div className="d-flex align-items-center gap-2 text-danger fw-bolder mb-2" style={{ fontSize: '13.5px' }}>
            <AlertTriangle size={18} />
            <span>MÓN BẾP BÁO HẾT CẦN ĐỔI CHO KHÁCH ({outOfStockOrderItems.length})</span>
          </div>

          <div className="d-flex flex-column gap-2">
            {outOfStockOrderItems.map(item => {
              const isWaitingCashier = requestedCancelIds.includes(item.id);
              return (
                <div key={item.id} className="bg-white p-3 rounded-3 border border-danger shadow-sm">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <img
                      src={getItemImage(item)}
                      alt={item.product_name || item.name}
                      className="rounded-3 border object-fit-cover flex-shrink-0"
                      style={{ width: '46px', height: '46px', filter: 'grayscale(60%)' }}
                      onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                    />
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="badge bg-danger text-white">{item.table_name} • {item.order_code}</span>
                        <span className="text-danger fw-bold small">Tạm hết</span>
                      </div>
                      <div className="fw-bolder text-dark mt-1" style={{ fontSize: '14.5px' }}>
                        {item.quantity}x {item.product_name || item.name}
                      </div>
                    </div>
                  </div>

                  {isWaitingCashier ? (
                    <div className="p-2 rounded-2 bg-warning bg-opacity-25 text-dark small fw-bold text-center">
                      ⏳ Đã báo Thu ngân hủy món (Chờ xác nhận)
                    </div>
                  ) : (
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => setSwappingItem(item)}
                        className="btn btn-sm btn-primary fw-bold flex-fill rounded-pill d-flex align-items-center justify-content-center gap-1"
                        style={{ fontSize: '12px' }}
                      >
                        <Repeat size={13} /> Đổi món khác
                      </button>
                      <button
                        onClick={() => handleRequestCashierCancelItem(item, item.table_name, item.order_code)}
                        className="btn btn-sm btn-outline-danger fw-bold flex-fill rounded-pill d-flex align-items-center justify-content-center gap-1"
                        style={{ fontSize: '12px' }}
                      >
                        <Ban size={13} /> Báo hủy món
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      
      {/* ================================================================= */}
      {/* TAB 1: TRANG CHỦ (THẺ ĐƠN RÚT GỌN 3 MÓN -> BẤM VÀO HIỆN POPUP) */}
      {/* ================================================================= */}
      {bottomNav === 'HOME' && (
        <>
          <div className="px-3 mt-3">
            <div className="bg-white p-1 rounded-4 shadow-sm border d-flex gap-1">
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`btn flex-grow-1 rounded-3 fw-bolder py-2 px-1 border-0 transition-all ${
                  activeTab === 'PENDING' ? 'bg-warning text-dark shadow-sm' : 'text-secondary'
                }`}
                style={{ fontSize: '12px' }}
              >
                Chờ ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('READY')}
                className={`btn flex-grow-1 rounded-3 fw-bolder py-2 px-1 border-0 transition-all ${
                  activeTab === 'READY' ? 'bg-success text-white shadow-sm' : 'text-secondary'
                }`}
                style={{ fontSize: '12px' }}
              >
                Bưng ({readyToServeList.length})
              </button>
              <button
                onClick={() => setActiveTab('ALERTS')}
                className={`btn flex-grow-1 rounded-3 fw-bolder py-2 px-1 border-0 transition-all position-relative ${
                  activeTab === 'ALERTS'
                    ? 'bg-danger text-white shadow-sm'
                    : (serviceRequests.length + outOfStockOrderItems.length) > 0
                    ? 'text-danger fw-bolder'
                    : 'text-secondary'
                }`}
                style={{ fontSize: '12px' }}
              >
                🚨 Cảnh báo ({serviceRequests.length + outOfStockOrderItems.length})
              </button>
              <button
                onClick={() => setActiveTab('TABLES')}
                className={`btn flex-grow-1 rounded-3 fw-bolder py-2 px-1 border-0 transition-all ${
                  activeTab === 'TABLES' ? 'bg-primary text-white shadow-sm' : 'text-secondary'
                }`}
                style={{ fontSize: '12px' }}
              >
                Bàn ({occupiedTablesCount})
              </button>
            </div>
          </div>

          <div className="p-3 flex-grow-1">
            {activeTab === 'PENDING' && (
              pendingOrders.length === 0 ? (
                <div className="bg-white rounded-4 border p-5 text-center text-muted shadow-sm">
                  <CheckCircle2 size={42} className="text-success opacity-50 mb-2" />
                  <div className="fw-bold text-dark">Không có đơn nào đang chờ duyệt</div>
                  <small>Khi khách quét QR đặt món, đơn sẽ hiện tại đây để bạn kiểm tra và xác nhận</small>
                </div>
              ) : (
                pendingOrders.map(order => {
                  const items = (order.items || order.order_items || []).filter(
                    it => String(it.item_status || it.status || '').toLowerCase() !== 'cancelled'
                  );
                  const total = items.reduce(
                    (s, i) => s + (isItemOutOfStock(i) ? 0 : getItemUnitPrice(i) * Number(i.quantity || 1)),
                    0
                  );
                  const tName = order.table_name || `Bàn 0${order.table_id}`;
                  const ordCode = order.order_code || `ORD-${order.id}`;

                  // CHỈ HIỂN THỊ TỐI ĐA 3 MÓN ĐẦU TIÊN CHO GỌN ĐẸP, BẤM VÀO SẼ MỞ POPUP ĐẦY ĐỦ
                  const previewItems = items.slice(0, MAX_PREVIEW_ITEMS);
                  const hiddenCount = Math.max(0, items.length - MAX_PREVIEW_ITEMS);
                  const totalQtyCount = items.reduce((s, i) => s + Number(i.quantity || 1), 0);

                  return (
                    <div key={order.id} className="staff-order-card mb-3">
                      <div className="p-3">
                        {/* Header đơn: Bấm vào để mở Popup chi tiết & sửa món */}
                        <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                          <div
                            onClick={() => openOrderPopupForTable(order.table_id, tName)}
                            className="cursor-pointer"
                          >
                            <div className="d-flex align-items-center gap-2">
                              <h5 className="fw-bolder text-dark mb-0" style={{ fontSize: '18px' }}>{tName}</h5>
                              <span className="badge bg-warning text-dark rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '11px' }}>
                                Chờ duyệt
                              </span>
                            </div>
                            <small className="text-secondary fw-semibold">
                              Mã đơn: {ordCode} • {items.length} loại ({totalQtyCount} phần)
                            </small>
                          </div>

                          <button
                            onClick={() => openOrderPopupForTable(order.table_id, tName)}
                            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '12px' }}
                          >
                            <Eye size={14} /> Sửa / Thêm món
                          </button>
                        </div>

                        {/* Danh sách rút gọn (Tối đa 3 món) - Bấm vào mở Popup ngay */}
                        <div
                          onClick={() => openOrderPopupForTable(order.table_id, tName)}
                          className="d-flex flex-column gap-2 mb-2 cursor-pointer"
                        >
                          {previewItems.map((it, idx) => {
                            const out = isItemOutOfStock(it);
                            const unitPrice = getItemUnitPrice(it);
                            const qty = Number(it.quantity || 1);

                            return (
                              <div key={it.id || idx} className={`staff-compact-item ${out ? 'out-of-stock' : ''}`}>
                                <img
                                  src={getItemImage(it)}
                                  alt={it.product_name || it.name}
                                  className="staff-compact-thumb"
                                  onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                                />
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                  <div className="d-flex justify-content-between align-items-center gap-2">
                                    <span
                                      className={`fw-bold text-truncate ${
                                        out ? 'text-danger text-decoration-line-through' : 'text-dark'
                                      }`}
                                      style={{ fontSize: '14px' }}
                                    >
                                      <b className="text-danger me-1">{qty}x</b>
                                      {it.product_name || it.name}
                                    </span>
                                    <span className="fw-bold text-primary flex-shrink-0" style={{ fontSize: '13.5px' }}>
                                      {(unitPrice * qty).toLocaleString()}đ
                                    </span>
                                  </div>
                                  {it.note && (
                                    <div className="text-warning-emphasis small fw-semibold" style={{ fontSize: '11px' }}>
                                      ⚠️ {it.note}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Thanh báo còn món ẩn (Nếu đơn dài > 3 món) -> Bấm vào bật Popup giống Bàn ăn */}
                        {hiddenCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => openOrderPopupForTable(order.table_id, tName)}
                            className="staff-more-items-banner mb-2"
                          >
                            <span>🔍 Xem thêm <b>+{hiddenCount} món khác</b> & Chỉnh sửa đơn</span>
                            <ChevronRight size={16} />
                          </button>
                        ) : (
                          <div
                            onClick={() => openOrderPopupForTable(order.table_id, tName)}
                            className="text-center text-primary fw-semibold py-1 mb-1 cursor-pointer"
                            style={{ fontSize: '12px' }}
                          >
                            👆 Chạm vào danh sách món để Tăng/Giảm, Đổi hoặc Xóa món
                          </div>
                        )}

                        {/* Footer Tổng tiền + Nút Xác nhận đơn luôn nằm gọn trong tầm mắt */}
                        <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                          <div>
                            <div className="text-muted" style={{ fontSize: '11.5px' }}>Tổng cộng ({totalQtyCount} phần):</div>
                            <div className="fw-bolder text-primary" style={{ fontSize: '18px' }}>{total.toLocaleString()}đ</div>
                          </div>
                          <button
                            onClick={() => handleConfirmOrder(order.id)}
                            className="btn btn-warning fw-bolder rounded-pill px-4 py-2 shadow-sm d-flex align-items-center gap-1"
                            style={{ fontSize: '14px' }}
                          >
                            <Check size={16} /> Xác nhận đơn
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* 2. DANH SÁCH MÓN CHỜ BƯNG */}
            {activeTab === 'READY' && (
              readyToServeList.length === 0 ? (
                <div className="bg-white rounded-4 border p-5 text-center text-muted shadow-sm">
                  <Utensils size={40} className="text-secondary opacity-50 mb-2" />
                  <div className="fw-bold text-dark">Chưa có món nào chờ bưng</div>
                  <small>Các món Bếp/Bar hoàn thành sẽ hiển thị tại đây</small>
                </div>
              ) : (
                readyToServeList.map(item => (
                  <div key={item.id} className="card border-0 shadow-sm rounded-4 mb-2 border-start border-success border-4">
                    <div className="card-body p-3 d-flex justify-content-between align-items-center gap-2">
                      <div className="d-flex align-items-center gap-3">
                        <img
                          src={getItemImage(item)}
                          alt={item.productName}
                          className="staff-compact-thumb"
                          style={{ width: '52px', height: '52px' }}
                          onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                        />
                        <div>
                          <span className="badge bg-primary mb-1">{item.tableName}</span>
                          <div className="fw-bolder text-dark" style={{ fontSize: '15px' }}>
                            <span className="text-danger me-1">{item.quantity}x</span> {item.productName}
                          </div>
                          {item.note && <div className="small text-danger fw-semibold">⚠️ {item.note}</div>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkServed(item.id)}
                        className="btn btn-success fw-bold rounded-pill px-3 py-2 d-flex align-items-center gap-1 flex-shrink-0"
                        style={{ fontSize: '13px' }}
                      >
                        <Check size={15} /> Đã lên
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* TAB CẢNH BÁO RIÊNG BIỆT CHO NHÂN VIÊN */}
            {activeTab === 'ALERTS' && (
              (serviceRequests.length === 0 && outOfStockOrderItems.length === 0) ? (
                <div className="bg-white rounded-4 border p-5 text-center text-muted shadow-sm">
                  <CheckCircle2 size={42} className="text-success opacity-50 mb-2" />
                  <div className="fw-bold text-dark">Hiện không có cảnh báo nào</div>
                  <small>Khi khách bấm Gọi hỗ trợ / Thanh toán hoặc Bếp báo hết món, cảnh báo sẽ hiện tại đây</small>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {/* 1. Danh sách khách gọi hỗ trợ / gọi thanh toán từ bàn */}
                  {serviceRequests.map((req, idx) => (
                    <div
                      key={req.call_id || idx}
                      className="bg-white p-3 rounded-4 border border-danger border-start border-4 shadow-sm"
                    >
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="badge bg-danger text-white px-2.5 py-1 rounded-pill">
                          🔔 {req.table_name}
                        </span>
                        <small className="text-muted fw-semibold">{req.time || 'Vừa xong'}</small>
                      </div>
                      <div className="fw-bolder text-dark mt-1" style={{ fontSize: '15px' }}>
                        {req.type === 'CALL_PAYMENT'
                          ? `💳 Khách yêu cầu thanh toán (${req.payment_method === 'TRANSFER' ? 'Chuyển khoản QR' : 'Tiền mặt'})`
                          : `🙋 Yêu cầu: "${req.note || 'Gọi nhân viên hỗ trợ'}"`}
                      </div>
                      <div className="d-flex justify-content-end gap-2 mt-2 pt-2 border-top">
                        <button
                          onClick={() => openOrderPopupForTable(req.table_id, req.table_name)}
                          className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                        >
                          Xem bàn
                        </button>
                        <button
                          onClick={async () => {
                            setServiceRequests(prev => prev.filter((_, i) => i !== idx));
                            if (req.table_id) {
                              await fetch(`${API_BASE}/api/kitchen/live-alerts-v2/${req.table_id}/resolve`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null);
                            }
                            showToast(`Đã xác nhận hỗ trợ ${req.table_name}`);
                          }}
                          className="btn btn-sm btn-success rounded-pill px-3 fw-bold"
                        >
                          ✓ Đã hỗ trợ khách
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 2. Danh sách món Bếp báo hết cần đổi cho khách */}
                  {outOfStockOrderItems.map(item => {
                    const isWaitingCashier = requestedCancelIds.includes(item.id);
                    return (
                      <div key={item.id} className="bg-white p-3 rounded-4 border border-warning border-start border-4 shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="badge bg-warning text-dark">{item.table_name} • {item.order_code}</span>
                          <span className="text-danger fw-bold small">⚠️ Bếp báo hết món</span>
                        </div>
                        <div className="fw-bolder text-dark my-1" style={{ fontSize: '15px' }}>
                          {item.quantity}x {item.product_name || item.name}
                        </div>
                        {isWaitingCashier ? (
                          <div className="p-2 rounded-2 bg-warning bg-opacity-25 text-dark small fw-bold text-center mt-2">
                            ⏳ Đã báo Thu ngân hủy món (Chờ xác nhận)
                          </div>
                        ) : (
                          <div className="d-flex gap-2 mt-2">
                            <button
                              onClick={() => setSwappingItem(item)}
                              className="btn btn-sm btn-primary fw-bold flex-fill rounded-pill"
                            >
                              🔄 Đổi món khác
                            </button>
                            <button
                              onClick={() => handleRequestCashierCancelItem(item, item.table_name, item.order_code)}
                              className="btn btn-sm btn-outline-danger fw-bold flex-fill rounded-pill"
                            >
                              🚫 Báo hủy món
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* 3. SƠ ĐỒ BÀN ĂN */}
            {activeTab === 'TABLES' && (
              <div className="row g-2">
                {tables.map(t => {
                  const tableOrders = orders.filter(
                    o => (o.table_id === t.id || o.table_name === t.table_number) &&
                    !['completed', 'cancelled', 'paid'].includes(String(o.status).toLowerCase())
                  );
                  const isOccupied = ['occupied', 'busy', 'payment_pending'].includes(t.status) || tableOrders.length > 0;
                  const hasOutItem = tableOrders.some(o => (o.items || o.order_items || []).some(isItemOutOfStock));
                  const totalItemsCount = tableOrders.reduce(
                    (s, o) => s + (o.items || o.order_items || []).filter(i => String(i.item_status || i.status) !== 'cancelled').reduce((acc, it) => acc + Number(it.quantity || 1), 0),
                    0
                  );

                  return (
                    <div key={t.id} className="col-6">
                      <div
                        onClick={() => setViewingTable(t)}
                        className={`p-3 rounded-4 shadow-sm border text-center cursor-pointer position-relative transition-all ${
                          hasOutItem
                            ? 'bg-danger bg-opacity-10 border-danger'
                            : isOccupied
                            ? 'bg-white border-primary border-2'
                            : 'bg-white'
                        }`}
                      >
                        {hasOutItem && (
                          <span className="position-absolute top-0 end-0 m-1 badge rounded-pill bg-danger">
                            Có món hết!
                          </span>
                        )}
                        <div className="fw-bolder text-dark" style={{ fontSize: '16px' }}>{t.table_number}</div>
                        <div className="mt-1">
                          <span className={`badge rounded-pill px-2 py-1 ${isOccupied ? 'bg-primary text-white' : 'bg-light text-secondary border'}`}>
                            {isOccupied ? `Đang ngồi • ${totalItemsCount} món` : 'Bàn trống (+ Gọi món)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* TAB 2: THỰC ĐƠN (ĐÃ CĂN CHỈNH LẠI PADDING ĐẸP, KHÔNG SÁT MÉP) */}
      {/* ================================================================= */}
      {bottomNav === 'MENU' && (
        <div className="p-3 flex-grow-1">
          <div className="bg-white p-3 rounded-4 border shadow-sm mb-3">
            <h6 className="fw-bolder text-dark mb-2" style={{ fontSize: '16px' }}>
              Thực đơn Nhà hàng ({filteredMenuTabProducts.length})
            </h6>
            <div className="input-group input-group-sm mb-2">
              <span className="input-group-text bg-light border-end-0 rounded-start-pill ps-3">
                <Search size={14} className="text-secondary" />
              </span>
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Tìm nhanh tên món ăn, đồ uống..."
                className="form-control bg-light border-start-0 rounded-end-pill shadow-none"
              />
            </div>

            <div className="d-flex gap-2 overflow-auto pb-1 pt-1" style={{ scrollbarWidth: 'none' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`btn btn-sm rounded-pill px-3 py-1 fw-bold flex-shrink-0 border-0 ${
                    selectedCategory === cat ? 'bg-primary text-white shadow-sm' : 'bg-light text-secondary'
                  }`}
                  style={{ fontSize: '12px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="d-flex flex-column gap-2">
            {filteredMenuTabProducts.map(p => {
              const avail = isProductAvailable(p);
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-4 shadow-sm border d-flex align-items-center justify-content-between gap-3 ${
                    avail ? 'bg-white' : 'bg-danger bg-opacity-10 border-danger'
                  }`}
                  style={{ opacity: avail ? 1 : 0.72 }}
                >
                  <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
                    <img
                      src={getProductImageUrl(p)}
                      alt={p.name}
                      className="rounded-3 border object-fit-cover flex-shrink-0"
                      style={{ width: '58px', height: '58px', filter: avail ? 'none' : 'grayscale(70%)' }}
                      onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className={`fw-bolder text-truncate ${avail ? 'text-dark' : 'text-danger text-decoration-line-through'}`} style={{ fontSize: '15px' }}>
                        {p.name}
                      </div>
                      <div className="text-muted small text-truncate" style={{ fontSize: '12px' }}>
                        {p.category_name || p.category || 'Món chính'}
                      </div>
                      <div className="fw-bolder text-primary mt-0.5" style={{ fontSize: '14.5px' }}>
                        {Number(p.price || 0).toLocaleString()}đ
                      </div>
                    </div>
                  </div>

                  <span className={`badge rounded-pill px-3 py-1.5 flex-shrink-0 ${avail ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger text-white'}`}>
                    {avail ? '● Còn món' : 'Tạm hết'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: TRANG CÁ NHÂN (THIẾT KẾ GIỐNG HỆT MẪU ẢNH 4 CHO NGHIỆP VỤ BÁN HÀNG) */}
      {/* ================================================================= */}
      {bottomNav === 'PROFILE' && (
        <div className="flex-grow-1 d-flex flex-column">
          {/* Banner xanh dương trên cùng giống Ảnh 4 */}
          <div className="staff-profile-hero">
            <div className="d-flex align-items-center gap-3">
              <div className="staff-profile-avatar-circle">
                {staffName.charAt(0)}
              </div>
              <div>
                <h5 className="fw-bolder text-white mb-1" style={{ fontSize: '18.5px' }}>
                  {staffName}
                </h5>
                <div className="text-white opacity-90 fw-semibold" style={{ fontSize: '13.5px' }}>
                  MNV: {staffCodeText} • {staffPositionText}
                </div>
              </div>
            </div>
          </div>

          {/* Thẻ trắng nổi chồng lên nền xanh (Overlapping Menu List) giống hệt Ảnh 4 */}
          <div className="px-3 flex-grow-1 d-flex flex-column justify-content-between">
            <div className="staff-profile-menu-card">
              {/* Mục 1: Thông tin nhân sự & Ca trực */}
              <button
                type="button"
                onClick={() => setProfileSubModal('INFO')}
                className="staff-profile-menu-item"
              >
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <IdCard size={18} />
                </div>
                <span className="staff-profile-item-label">Thông tin nhân viên & Ca trực</span>
                <ChevronRight size={17} className="text-secondary opacity-50" />
              </button>

              {/* Mục 2: Thống kê hiệu suất bán hàng & phục vụ */}
              <button
                type="button"
                onClick={() => setProfileSubModal('STATS')}
                className="staff-profile-menu-item"
              >
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                  <BarChart3 size={18} />
                </div>
                <span className="staff-profile-item-label">Thống kê phục vụ trong ca</span>
                <ChevronRight size={17} className="text-secondary opacity-50" />
              </button>

              {/* Mục 3: Đổi mật khẩu */}
              <button
                type="button"
                onClick={() => setProfileSubModal('PASSWORD')}
                className="staff-profile-menu-item"
              >
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                  <Lock size={18} />
                </div>
                <span className="staff-profile-item-label">Đổi mật khẩu</span>
                <ChevronRight size={17} className="text-secondary opacity-50" />
              </button>

              {/* Mục 4: Quy trình & Nội quy phục vụ */}
              <button
                type="button"
                onClick={() => setProfileSubModal('SOP')}
                className="staff-profile-menu-item"
              >
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                  <FileText size={18} />
                </div>
                <span className="staff-profile-item-label">Quy trình & Nội quy phục vụ</span>
                <ChevronRight size={17} className="text-secondary opacity-50" />
              </button>

              {/* Mục 5: Góp ý vận hành / Báo sự cố */}
              <button
                type="button"
                onClick={() => setProfileSubModal('FEEDBACK')}
                className="staff-profile-menu-item"
              >
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                  <MessageSquare size={18} />
                </div>
                <span className="staff-profile-item-label">Báo cáo sự cố & Góp ý vận hành</span>
                <ChevronRight size={17} className="text-secondary opacity-50" />
              </button>

              {/* Mục 6: Thông báo (Có công tắc gạt Toggle màu xanh giống hệt Ảnh 4) */}
              <div className="staff-profile-menu-item" onClick={handleToggleNotify}>
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                  <Bell size={18} />
                </div>
                <span className="staff-profile-item-label">Thông báo đơn mới & Trạm PASS</span>
                <div className={`ios-switch ${notifyEnabled ? 'active' : ''}`}>
                  <div className="ios-switch-thumb" />
                </div>
              </div>

              {/* Mục 7: Đăng xuất */}
              <button
                type="button"
                onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
                className="staff-profile-menu-item border-0"
              >
                <div className="staff-profile-icon-circle" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                  <LogOut size={18} />
                </div>
                <span className="staff-profile-item-label text-danger fw-bold">Đăng xuất</span>
                <ChevronRight size={17} className="text-secondary opacity-50" />
              </button>
            </div>

            <div className="text-center text-secondary py-4" style={{ fontSize: '13px' }}>
              Phiên bản 2.19.0
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CÁC POPUP CHI TIẾT CHO TRANG CÁ NHÂN */}
      {/* ================================================================= */}
      {profileSubModal && (
        <div className="staff-popup-backdrop" onClick={() => setProfileSubModal(null)}>
          <div className="staff-popup-sheet" onClick={e => e.stopPropagation()}>
            <div className="staff-popup-header">
              <h6 className="fw-bolder mb-0 text-white" style={{ fontSize: '16px' }}>
                {profileSubModal === 'INFO' && '🪪 Hồ Sơ Nhân Sự & Ca Trực'}
                {profileSubModal === 'STATS' && '📊 Thống Kê Phục Vụ Trong Ca'}
                {profileSubModal === 'PASSWORD' && '🔑 Đổi Mật Khẩu Tài Khoản'}
                {profileSubModal === 'SOP' && '📖 Quy Trình Phục Vụ Chuẩn (SOP)'}
                {profileSubModal === 'FEEDBACK' && '💬 Báo Cáo Sự Cố / Góp Ý'}
              </h6>
              <button type="button" onClick={() => setProfileSubModal(null)} className="staff-popup-close-btn">
                <X size={18} />
              </button>
            </div>

            <div className="staff-popup-body bg-white">
              {profileSubModal === 'INFO' && (
                <div className="d-flex flex-column gap-2">
                  <div className="p-3 rounded-3 bg-light border d-flex justify-content-between">
                    <span className="text-secondary">Họ và tên:</span>
                    <b className="text-dark">{staffName}</b>
                  </div>
                  <div className="p-3 rounded-3 bg-light border d-flex justify-content-between">
                    <span className="text-secondary">Mã nhân viên:</span>
                    <b className="text-primary">{staffCodeText}</b>
                  </div>
                  <div className="p-3 rounded-3 bg-light border d-flex justify-content-between">
                    <span className="text-secondary">Vị trí công việc:</span>
                    <b className="text-dark">{staffPositionText}</b>
                  </div>
                  <div className="p-3 rounded-3 bg-light border d-flex justify-content-between">
                    <span className="text-secondary">Chi nhánh:</span>
                    <b className="text-dark">Nhà hàng Trung Tâm</b>
                  </div>
                  <div className="p-3 rounded-3 bg-light border d-flex justify-content-between">
                    <span className="text-secondary">Ngày bắt đầu làm:</span>
                    <b className="text-dark">{staffStartDate}</b>
                  </div>
                  <div className="p-3 rounded-3 bg-light border d-flex justify-content-between">
                    <span className="text-secondary">Thâm niên làm việc:</span>
                    <span className="badge bg-success rounded-pill px-3 py-1">{staffWorkDays} ngày</span>
                  </div>
                </div>
              )}

              {profileSubModal === 'STATS' && (
                <div className="row g-2">
                  <div className="col-6">
                    <div className="p-3 rounded-4 border bg-light text-center">
                      <div className="fs-3 fw-bolder text-primary">{occupiedTablesCount}</div>
                      <div className="small text-secondary fw-semibold">Bàn đang phục vụ</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 rounded-4 border bg-light text-center">
                      <div className="fs-3 fw-bolder text-warning">{pendingOrders.length}</div>
                      <div className="small text-secondary fw-semibold">Đơn QR chờ duyệt</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 rounded-4 border bg-light text-center">
                      <div className="fs-3 fw-bolder text-success">{readyToServeList.length}</div>
                      <div className="small text-secondary fw-semibold">Món chờ bưng ra bàn</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 rounded-4 border bg-light text-center">
                      <div className="fs-3 fw-bolder text-danger">{outOfStockOrderItems.length}</div>
                      <div className="small text-secondary fw-semibold">Món hết cần đổi</div>
                    </div>
                  </div>
                </div>
              )}

              {profileSubModal === 'PASSWORD' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (pwdForm.newPwd.length < 4) {
                      return alert('Mật khẩu mới phải có ít nhất 4 ký tự!');
                    }
                    if (pwdForm.newPwd !== pwdForm.confirmPwd) {
                      return alert('Mật khẩu xác nhận không khớp!');
                    }

                    try {
                      const res = await fetch(`${API_BASE}/api/kitchen/staff/change-password`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          staff_name: staffName,
                          old_password: pwdForm.oldPwd,
                          new_password: pwdForm.newPwd
                        })
                      });

                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        showToast('Đã cập nhật mật khẩu mới vào hệ thống!');
                        setPwdForm({ oldPwd: '', newPwd: '', confirmPwd: '' });
                        setProfileSubModal(null);
                      } else {
                        alert(data.detail || 'Đổi mật khẩu thất bại!');
                      }
                    } catch (err) {
                      alert('Không thể kết nối máy chủ để đổi mật khẩu!');
                    }
                  }}
                >
                  {/* Input ẩn username giúp trình duyệt nhận diện form chuẩn xác */}
                  <input
                    type="text"
                    name="username"
                    value={staffName}
                    autoComplete="username"
                    readOnly
                    style={{ display: 'none' }}
                  />

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={pwdForm.oldPwd}
                      onChange={(e) => setPwdForm({ ...pwdForm, oldPwd: e.target.value })}
                      className="form-control rounded-3"
                      placeholder="Nhập mật khẩu cũ..."
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Mật khẩu mới</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={pwdForm.newPwd}
                      onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })}
                      className="form-control rounded-3"
                      placeholder="Nhập mật khẩu mới..."
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={pwdForm.confirmPwd}
                      onChange={(e) => setPwdForm({ ...pwdForm, confirmPwd: e.target.value })}
                      className="form-control rounded-3"
                      placeholder="Nhập lại mật khẩu mới..."
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-2">
                    Lưu mật khẩu mới
                  </button>
                </form>
              )}

              {profileSubModal === 'SOP' && (
                <div className="small text-dark d-flex flex-column gap-2">
                  <div className="p-3 rounded-3 bg-light border">
                    <b className="text-primary">1. Quy trình duyệt đơn khách quét QR:</b>
                    <div className="text-secondary mt-1">
                      Kiểm tra lại danh sách món với khách tại bàn. Nếu khách gọi nhầm hoặc muốn thêm món, bấm vào thẻ đơn để sửa trực tiếp trước khi bấm <b>Xác nhận đơn</b>.
                    </div>
                  </div>
                  <div className="p-3 rounded-3 bg-light border">
                    <b className="text-primary">2. Xử lý khi Bếp báo hết món:</b>
                    <div className="text-secondary mt-1">
                      Thông báo ngay cho khách để chọn <b>Đổi món khác</b> hoặc bấm <b>Báo hủy món</b> để Thu ngân cập nhật lại hóa đơn.
                    </div>
                  </div>
                  <div className="p-3 rounded-3 bg-light border">
                    <b className="text-primary">3. Nhận món tại Trạm Tiếp Thực (PASS):</b>
                    <div className="text-secondary mt-1">
                      Kiểm tra đúng số bàn và ghi chú chế biến trước khi bưng món ra bàn và bấm xác nhận <b>Đã lên</b>.
                    </div>
                  </div>
                </div>
              )}

              {profileSubModal === 'FEEDBACK' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    showToast('Đã gửi báo cáo lên Quản lý & Thu ngân!');
                    setFeedbackText('');
                    setProfileSubModal(null);
                  }}
                >
                  <label className="form-label small fw-bold">Nội dung sự cố / góp ý vận hành:</label>
                  <textarea
                    rows={4}
                    required
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="VD: Bàn 05 hỏng mã QR, máy in khu Bếp hết giấy..."
                    className="form-control rounded-3 mb-3"
                  />
                  <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-2">
                    Gửi báo cáo ngay
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* POPUP 1: CHI TIẾT & SỬA ORDER CỦA BÀN (DÙNG CHUNG CHO CẢ ĐƠN CHỜ DUYỆT & BÀN ĂN) */}
      {/* ================================================================= */}
      {viewingTable && (
        <div className="staff-popup-backdrop" onClick={() => setViewingTable(null)}>
          <div className="staff-popup-sheet" onClick={e => e.stopPropagation()}>
            <div className="staff-popup-header">
              <div>
                <h6 className="fw-bolder mb-0 text-white" style={{ fontSize: '16.5px' }}>
                  Chi tiết & Sửa Order • {viewingTable.table_number}
                </h6>
                <small className="text-white-50" style={{ fontSize: '12px' }}>
                  Tăng/giảm số lượng, đổi món, xóa món hoặc thêm món mới
                </small>
              </div>
              <button
                type="button"
                onClick={() => setViewingTable(null)}
                className="staff-popup-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const tOrders = orders.filter(
                o =>
                  (o.table_id === viewingTable.id || o.table_name === viewingTable.table_number) &&
                  !['completed', 'cancelled', 'paid'].includes(String(o.status).toLowerCase())
              );
              const firstActiveOrder = tOrders[0];

              const tableGrandTotal = tOrders.reduce((sumOrd, ord) => {
                const validItems = (ord.items || ord.order_items || []).filter(
                  i => String(i.item_status || i.status || '').toLowerCase() !== 'cancelled' && !isItemOutOfStock(i)
                );
                return sumOrd + validItems.reduce((s, it) => s + getItemUnitPrice(it) * Number(it.quantity || 1), 0);
              }, 0);

              return (
                <>
                  <div className="px-3 py-2 bg-white border-bottom d-flex justify-content-between align-items-center gap-2">
                    <span className="badge rounded-pill bg-light text-secondary border px-3 py-1.5 fw-bold" style={{ fontSize: '12px' }}>
                      {tOrders.length > 0 ? `Đang có ${tOrders.length} lượt gọi món` : 'Bàn đang trống'}
                    </span>

                    <button
                      onClick={() =>
                        setAddingToTarget({
                          orderId: firstActiveOrder?.id || null,
                          tableId: viewingTable.id,
                          tableName: viewingTable.table_number,
                          orderCode: firstActiveOrder?.order_code || ''
                        })
                      }
                      className="btn btn-primary btn-sm rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1 shadow-sm text-nowrap"
                      style={{ fontSize: '12.5px' }}
                    >
                      <Plus size={15} /> Thêm món mới
                    </button>
                  </div>

                  <div className="staff-popup-body">
                    {tOrders.length === 0 ? (
                      <div className="bg-white rounded-4 border p-4 text-center text-muted my-2">
                        <Utensils size={36} className="text-primary opacity-25 mb-2" />
                        <div className="fw-bold text-dark">Bàn này hiện chưa gọi món</div>
                        <small>Bấm nút <b>+ Thêm món mới</b> ở góc trên để tạo đơn hộ khách.</small>
                      </div>
                    ) : (
                      tOrders.map(ord => {
                        const isPending = String(ord.status).toLowerCase() === 'pending';
                        const activeItems = (ord.items || ord.order_items || []).filter(
                          i => String(i.item_status || i.status || '').toLowerCase() !== 'cancelled'
                        );

                        if (activeItems.length === 0) return null;

                        return (
                          <div key={ord.id} className="bg-white rounded-4 border p-3 mb-2 shadow-sm">
                            <div className="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                              <div>
                                <span className="text-secondary small fw-semibold">Mã phiếu: </span>
                                <span className="fw-bolder text-primary" style={{ fontSize: '14px' }}>
                                  {ord.order_code || `ORD-${ord.id}`}
                                </span>
                              </div>
                              {isPending && (
                                <button
                                  onClick={() => handleConfirmOrder(ord.id)}
                                  className="btn btn-warning btn-sm fw-bolder rounded-pill px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                                  style={{ fontSize: '12.5px' }}
                                >
                                  <Check size={14} /> Xác nhận đơn
                                </button>
                              )}
                            </div>

                            <div className="d-flex flex-column gap-2">
                              {activeItems.map((it, idx) => {
                                const out = isItemOutOfStock(it);
                                const st = String(it.item_status || it.status || ord.status || '').toLowerCase();
                                const isServed = st === 'served' || st === 'completed';
                                const uPrice = getItemUnitPrice(it);
                                const qty = Number(it.quantity || 1);

                                return (
                                  <div key={it.id || idx} className={`staff-popup-item-card ${out ? 'out-of-stock' : ''}`}>
                                    <div className="d-flex align-items-start gap-2">
                                      <img
                                        src={getItemImage(it)}
                                        alt={it.product_name || it.name}
                                        className="staff-popup-thumb"
                                        onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                                      />

                                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <div className="d-flex justify-content-between align-items-start gap-1">
                                          <div
                                            className={`fw-bolder ${out ? 'text-danger text-decoration-line-through' : 'text-dark'}`}
                                            style={{ fontSize: '14px', lineHeight: '1.25' }}
                                          >
                                            {it.product_name || it.name}
                                          </div>
                                          <span
                                            className={`badge rounded-pill flex-shrink-0 ${
                                              isServed
                                                ? 'bg-success text-white'
                                                : out
                                                ? 'bg-danger text-white'
                                                : isPending
                                                ? 'bg-warning text-dark'
                                                : 'bg-primary bg-opacity-10 text-primary'
                                            }`}
                                            style={{ fontSize: '10px', padding: '3px 7px' }}
                                          >
                                            {isServed ? 'Đã lên' : out ? 'Hết món' : isPending ? 'Chờ duyệt' : 'Đang phục vụ'}
                                          </span>
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center mt-1">
                                          <span className="text-muted" style={{ fontSize: '11.5px' }}>
                                            {uPrice.toLocaleString()}đ / phần
                                          </span>
                                          <span className="fw-bolder text-primary" style={{ fontSize: '13px' }}>
                                            {(uPrice * qty).toLocaleString()}đ
                                          </span>
                                        </div>

                                        {!isServed && (
                                          <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                                            <div className="d-flex align-items-center gap-1">
                                              <button
                                                onClick={() => handleStaffAdjustItemQty(it, -1, viewingTable.table_number)}
                                                className="staff-qty-btn"
                                              >
                                                <Minus size={12} />
                                              </button>
                                              <span className="fw-bolder text-danger px-1" style={{ fontSize: '14px', minWidth: '22px', textAlign: 'center' }}>
                                                {qty}
                                              </span>
                                              <button
                                                onClick={() => handleStaffAdjustItemQty(it, 1, viewingTable.table_number)}
                                                disabled={out}
                                                className="staff-qty-btn primary"
                                              >
                                                <Plus size={12} />
                                              </button>
                                            </div>

                                            <div className="d-flex align-items-center gap-1">
                                              <button
                                                onClick={() => setSwappingItem({ ...it, table_name: viewingTable.table_number, order_id: ord.id })}
                                                className="staff-action-pill swap"
                                              >
                                                <Repeat size={12} /> Đổi
                                              </button>
                                              <button
                                                onClick={() => setConfirmDeletePopup({ item: it, tableName: viewingTable.table_number })}
                                                className="staff-action-pill delete"
                                              >
                                                <Trash2 size={12} /> Xóa
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="staff-popup-footer">
                    <div>
                      <div className="text-secondary" style={{ fontSize: '11.5px' }}>Tổng tạm tính {viewingTable.table_number}:</div>
                      <div className="fw-bolder text-danger" style={{ fontSize: '18px' }}>
                        {tableGrandTotal.toLocaleString()}đ
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingTable(null)}
                      className="btn btn-secondary fw-bolder px-4 py-2 rounded-pill"
                      style={{ fontSize: '13.5px' }}
                    >
                      Đóng lại
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* POPUP 2: THÊM MÓN MỚI VÀO ĐƠN HOẶC BÀN */}
      {addingToTarget && (
        <div className="staff-popup-backdrop" style={{ zIndex: 3100 }} onClick={() => setAddingToTarget(null)}>
          <div className="staff-popup-sheet" onClick={e => e.stopPropagation()}>
            <div className="staff-popup-header">
              <div>
                <h6 className="fw-bolder mb-0 text-white" style={{ fontSize: '16px' }}>
                  ➕ Thêm Món Vào {addingToTarget.tableName}
                </h6>
                <small className="text-white-50" style={{ fontSize: '12px' }}>
                  {addingToTarget.orderCode ? `Bổ sung vào phiếu ${addingToTarget.orderCode}` : 'Chọn món bên dưới để thêm ngay'}
                </small>
              </div>
              <button type="button" onClick={() => setAddingToTarget(null)} className="staff-popup-close-btn">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-white border-bottom">
              <div className="input-group input-group-sm mb-2">
                <span className="input-group-text bg-light border-end-0 rounded-start-pill ps-3">
                  <Search size={14} className="text-secondary" />
                </span>
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Tìm nhanh tên món cần thêm..."
                  className="form-control bg-light border-start-0 rounded-end-pill shadow-none"
                />
              </div>
              <div className="d-flex gap-2 overflow-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAddCategory(cat)}
                    className={`btn btn-sm rounded-pill px-3 py-1 fw-bold flex-shrink-0 border-0 ${
                      addCategory === cat ? 'bg-primary text-white' : 'bg-light text-secondary'
                    }`}
                    style={{ fontSize: '12px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="staff-popup-body">
              <div className="d-flex flex-column gap-2">
                {filteredProductsForAdd.map(prod => (
                  <div key={prod.id} className="p-2 rounded-4 border bg-white d-flex justify-content-between align-items-center gap-2 shadow-sm">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <img
                        src={getProductImageUrl(prod)}
                        alt={prod.name}
                        className="rounded-3 border object-fit-cover flex-shrink-0"
                        style={{ width: '52px', height: '52px' }}
                        onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-bolder text-dark text-truncate" style={{ fontSize: '14px' }}>{prod.name}</div>
                        <small className="text-primary fw-bolder">{Number(prod.price || 0).toLocaleString()}đ</small>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStaffAddProductToTarget(prod)}
                      className="btn btn-sm btn-primary fw-bold rounded-pill px-3 py-1.5 flex-shrink-0 shadow-sm"
                      style={{ fontSize: '12.5px' }}
                    >
                      + Thêm
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="staff-popup-footer justify-content-end">
              <button onClick={() => setAddingToTarget(null)} className="btn btn-primary fw-bolder rounded-pill px-4 py-2">
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 3: CHỌN MÓN MỚI ĐỂ ĐỔI CHO KHÁCH */}
      {swappingItem && (
        <div className="staff-popup-backdrop" style={{ zIndex: 3200 }} onClick={() => setSwappingItem(null)}>
          <div className="staff-popup-sheet" onClick={e => e.stopPropagation()}>
            <div className="staff-popup-header">
              <div>
                <h6 className="fw-bolder mb-0 text-white" style={{ fontSize: '16px' }}>
                  🔄 Đổi Món Cho Khách • {swappingItem.table_name}
                </h6>
                <small className="text-white-50" style={{ fontSize: '12px' }}>
                  Món hiện tại: {swappingItem.product_name || swappingItem.name}
                </small>
              </div>
              <button type="button" onClick={() => setSwappingItem(null)} className="staff-popup-close-btn">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-white border-bottom">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0 rounded-start-pill ps-3">
                  <Search size={14} className="text-secondary" />
                </span>
                <input
                  type="text"
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  placeholder="Tìm món mới để đổi..."
                  className="form-control bg-light border-start-0 rounded-end-pill shadow-none"
                />
              </div>
            </div>

            <div className="staff-popup-body">
              <div className="d-flex flex-column gap-2">
                {availableProductsForSwap.map(prod => (
                  <div key={prod.id} className="p-2 rounded-4 border bg-white d-flex justify-content-between align-items-center gap-2 shadow-sm">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <img
                        src={getProductImageUrl(prod)}
                        alt={prod.name}
                        className="rounded-3 border object-fit-cover flex-shrink-0"
                        style={{ width: '52px', height: '52px' }}
                        onError={(e) => { e.target.src = 'https://placehold.co/200x200/e2e8f0/475569?text=Mon+An'; }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-bolder text-dark text-truncate" style={{ fontSize: '14px' }}>{prod.name}</div>
                        <small className="text-primary fw-bolder">{Number(prod.price || 0).toLocaleString()}đ</small>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfirmSwapItem(prod)}
                      className="btn btn-sm btn-success fw-bold rounded-pill px-3 py-1.5 flex-shrink-0 shadow-sm"
                      style={{ fontSize: '12.5px' }}
                    >
                      Chọn đổi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 4: XÁC NHẬN XÓA MÓN */}
      {confirmDeletePopup && (
        <div className="staff-popup-backdrop" style={{ zIndex: 3500 }} onClick={() => setConfirmDeletePopup(null)}>
          <div
            className="bg-white rounded-4 shadow-lg p-4 mx-3 text-center staff-confirm-dialog"
            style={{ width: '100%', maxWidth: '360px' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="rounded-circle bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: '56px', height: '56px' }}
            >
              <Trash2 size={26} />
            </div>
            <h6 className="fw-bolder text-dark mb-1" style={{ fontSize: '17px' }}>
              Xác nhận xóa món?
            </h6>
            <p className="text-secondary small mb-3">
              Bạn có chắc muốn xóa món này khỏi đơn của <b>{confirmDeletePopup.tableName}</b> không?
            </p>

            <div className="p-2 rounded-3 bg-light border d-flex align-items-center gap-2 text-start mb-3">
              <img
                src={getItemImage(confirmDeletePopup.item)}
                alt=""
                className="rounded-2 border object-fit-cover flex-shrink-0"
                style={{ width: '44px', height: '44px' }}
              />
              <div style={{ minWidth: 0 }}>
                <div className="fw-bolder text-dark text-truncate" style={{ fontSize: '14px' }}>
                  {confirmDeletePopup.item.quantity}x {confirmDeletePopup.item.product_name || confirmDeletePopup.item.name}
                </div>
                <small className="text-danger fw-bold">
                  {(getItemUnitPrice(confirmDeletePopup.item) * Number(confirmDeletePopup.item.quantity || 1)).toLocaleString()}đ
                </small>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                onClick={() => setConfirmDeletePopup(null)}
                className="btn btn-light border fw-bold flex-fill py-2 rounded-pill"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteWrongItem}
                className="btn btn-danger fw-bolder flex-fill py-2 rounded-pill shadow-sm"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <div
        className="position-fixed bottom-0 start-50 translate-middle-x w-100 bg-white border-top shadow-lg py-2 px-3 d-flex justify-content-around align-items-center rounded-top-4"
        style={{ maxWidth: '480px', zIndex: 1050 }}
      >
        <button
          onClick={() => setBottomNav('HOME')}
          className={`btn btn-sm border-0 d-flex flex-column align-items-center gap-1 ${bottomNav === 'HOME' ? 'text-primary fw-bold' : 'text-secondary'}`}
        >
          <Home size={20} />
          <span style={{ fontSize: '11px' }}>Trang chủ</span>
        </button>

        <button
          onClick={() => setBottomNav('MENU')}
          className={`btn btn-sm border-0 d-flex flex-column align-items-center gap-1 position-relative ${bottomNav === 'MENU' ? 'text-primary fw-bold' : 'text-secondary'}`}
        >
          <BookOpen size={20} />
          <span style={{ fontSize: '11px' }}>Thực đơn</span>
          {outOfStockNames.length > 0 && (
            <span className="position-absolute top-0 end-0 badge rounded-pill bg-danger" style={{ fontSize: '9px' }}>
              {outOfStockNames.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setBottomNav('HOME'); setActiveTab('TABLES'); }}
          className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow"
          style={{ width: '48px', height: '48px', marginTop: '-18px' }}
          title="Sơ đồ bàn"
        >
          <QrCode size={22} className="text-white" />
        </button>

        <button
          onClick={() => setBottomNav('PROFILE')}
          className={`btn btn-sm border-0 d-flex flex-column align-items-center gap-1 ${bottomNav === 'PROFILE' ? 'text-primary fw-bold' : 'text-secondary'}`}
        >
          <User size={20} />
          <span style={{ fontSize: '11px' }}>Cá nhân</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* CSS CHUẨN: PADDING THOÁNG ĐẸP • THẺ RÚT GỌN • TRANG CÁ NHÂN GIỐNG ẢNH 4 */}
      {/* ================================================================= */}
      <style dangerouslySetInnerHTML={{__html: `
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* HEADER CÓ PADDING RỘNG RÃI 18PX (KHÔNG BỊ SÁT MÉP TRÁI NHƯ ẢNH 1 & 3) */
        .staff-top-header {
          padding: 18px 20px 14px;
          background: linear-gradient(135deg, #003e9c 0%, #0256d4 100%);
          color: #ffffff;
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
          box-shadow: 0 4px 14px rgba(0, 62, 156, 0.18);
        }
        .staff-header-avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #ffffff;
          color: #003e9c;
          font-weight: 800;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .staff-online-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #ffffff;
        }
        .staff-refresh-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* THẺ ĐƠN RÚT GỌN TRÊN TRANG CHỦ */
        .staff-order-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          border-left: 5px solid #f59e0b;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }
        .staff-compact-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.12s ease;
        }
        .staff-compact-item:hover {
          background: #eff6ff;
        }
        .staff-compact-item.out-of-stock {
          background: #fff1f2;
          border-color: #fecdd3;
        }
        .staff-compact-thumb {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
          flex-shrink: 0;
          background: #ffffff;
        }
        .staff-more-items-banner {
          width: 100%;
          background: #eff6ff;
          border: 1px dashed #93c5fd;
          color: #1d4ed8;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12.5px;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.15s ease;
        }
        .staff-more-items-banner:hover {
          background: #dbeafe;
        }

        /* TRANG CÁ NHÂN THIẾT KẾ GIỐNG HỆT ẢNH 4 */
        .staff-profile-hero {
          background: linear-gradient(180deg, #0047ab 0%, #003e9c 100%);
          padding: 28px 22px 58px;
          color: #ffffff;
        }
        .staff-profile-avatar-circle {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: #ffffff;
          color: #0047ab;
          font-weight: 800;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid rgba(255, 255, 255, 0.35);
          flex-shrink: 0;
        }
        .staff-profile-menu-card {
          background: #ffffff;
          border-radius: 18px;
          margin-top: -34px;
          padding: 6px 14px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e8f0;
        }
        .staff-profile-menu-item {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid #f1f5f9;
          padding: 14px 4px;
          display: flex;
          align-items: center;
          gap: 14px;
          text-align: left;
          cursor: pointer;
          transition: opacity 0.12s ease;
        }
        .staff-profile-menu-item:hover {
          opacity: 0.85;
        }
        .staff-profile-icon-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .staff-profile-item-label {
          flex-grow: 1;
          font-size: 14.5px;
          font-weight: 600;
          color: #334155;
        }
        .ios-switch {
          width: 46px;
          height: 26px;
          border-radius: 999px;
          background: #cbd5e1;
          padding: 3px;
          display: flex;
          align-items: center;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }
        .ios-switch.active {
          background: #22c55e;
        }
        .ios-switch-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          transition: transform 0.2s ease;
        }
        .ios-switch.active .ios-switch-thumb {
          transform: translateX(20px);
        }

        /* NÚT TĂNG GIẢM SỐ LƯỢNG & NÚT ĐỔI/XÓA TRONG POPUP */
        .staff-qty-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .staff-qty-btn.primary {
          border-color: #93c5fd;
          color: #1d4ed8;
          background: #eff6ff;
        }
        .staff-action-pill {
          border-radius: 999px;
          padding: 4px 11px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid transparent;
          background: #ffffff;
        }
        .staff-action-pill.swap {
          color: #1d4ed8;
          border-color: #bfdbfe;
          background: #eff6ff;
        }
        .staff-action-pill.delete {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        /* POPUP HIỆN ĐẠI */
        .staff-popup-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(4px);
          z-index: 2900;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          animation: popupFadeIn 0.18s ease-out;
        }
        .staff-popup-sheet {
          width: 100%;
          max-width: 440px;
          max-height: 86vh;
          background: #f8fafc;
          border-radius: 24px;
          box-shadow: 0 22px 48px rgba(15, 23, 42, 0.32);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: popupScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .staff-confirm-dialog {
          animation: popupScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes popupFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popupScaleUp {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .staff-popup-header {
          padding: 16px 18px;
          background: linear-gradient(135deg, #0047ab 0%, #0d6efd 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .staff-popup-close-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .staff-popup-body {
          padding: 14px 16px;
          overflow-y: auto;
          flex-grow: 1;
        }
        .staff-popup-item-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 10px 12px;
        }
        .staff-popup-thumb {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
          flex-shrink: 0;
          background: #ffffff;
        }
        .staff-popup-footer {
          padding: 12px 18px;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      `}} />
    </div>
  );
}