import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutGrid, Utensils, Search, RefreshCw, LogOut, 
  Trash2, Plus, Minus, Printer, DollarSign, Bell,
  ShoppingBag, Bike, Menu, Wallet, QrCode, 
  User, X, BarChart3, TrendingUp, CheckCircle2,
  ChevronLeft, ChevronRight, Phone, MapPin, Keyboard,
  History, Percent, Clock, Check, Ban, Send, Tag, FileText,
  Package, ArrowLeftRight, Users, Download, Star, ChevronDown,
  Eye, ShoppingCart, AlertCircle, Calendar, Armchair, UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';

const API_BASE = 'http://127.0.0.1:8000';

const BANK_CONFIGS = {
  VCB: {
    bankId: 'VCB',
    bankName: 'Vietcombank (Cổng chính)',
    accountNo: '1012345678',
    accountName: 'NH SMARTPOS',
    template: 'compact2'
  },
  MB: {
    bankId: 'MB',
    bankName: 'MB Bank (Dự phòng)',
    accountNo: '0987654321',
    accountName: 'NH SMARTPOS',
    template: 'compact2'
  }
};

const DONUT_COLORS = ['#0066ff', '#f59e0b', '#10b981', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];
const AVATAR_COLORS = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function CashierDashboard() {
  // 'POS' (Màn hình Bán hàng Thu ngân) | 'MANAGEMENT' (Màn hình Quản lý)
  const [appMode, setAppMode] = useState('POS');
  // Đã xóa Sổ quỹ & Báo cáo -> Chỉ giữ 4 phân hệ: 'OVERVIEW' | 'PRODUCTS' | 'TRANSACTIONS' | 'STAFF'
  const [mgmtTopTab, setMgmtTopTab] = useState('OVERVIEW');

  const [leftTab, setLeftTab] = useState('TABLES');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [statusRadio, setStatusRadio] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [openMenuOnSelect, setOpenMenuOnSelect] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Bộ lọc Thời gian dùng chung cho Tổng quan, Hàng hóa & Giao dịch
  const todayIso = new Date().toISOString().slice(0, 10);
  const [dateRangePreset, setDateRangePreset] = useState('TODAY'); // 'TODAY' | 'YESTERDAY' | '7DAYS' | 'ALL'
  const [customFromDate, setCustomFromDate] = useState(todayIso);
  const [customToDate, setCustomToDate] = useState(todayIso);

  // Bộ lọc cho trang Hàng hóa
  const [mgmtCategoryFilter, setMgmtCategoryFilter] = useState('Tất cả');
  const [mgmtStockFilter, setMgmtStockFilter] = useState('ALL');
  const [mgmtSearch, setMgmtSearch] = useState('');

  // Bộ lọc cho trang Giao dịch (Click vào đơn xổ ra chi tiết món bên dưới)
  const [txStatusFilter, setTxStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'SERVING' | 'CANCELLED'
  const [txSearch, setTxSearch] = useState('');
  const [expandedTxId, setExpandedTxId] = useState(null);

  // Bộ lọc Checkbox cho trang Nhân viên
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [checkedStaffIds, setCheckedStaffIds] = useState([]);

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [realStaffList, setRealStaffList] = useState([]);
  const [dbOrderTimes, setDbOrderTimes] = useState({});
  const [dbSessionTimes, setDbSessionTimes] = useState({});
  const [loading, setLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  const [draftItemsByTable, setDraftItemsByTable] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_cashier_draft_carts') || '{}'); } catch { return {}; }
  });
  const [sendingToKitchen, setSendingToKitchen] = useState(false);

  useEffect(() => {
    localStorage.setItem('pos_cashier_draft_carts', JSON.stringify(draftItemsByTable));
  }, [draftItemsByTable]);

  const [outOfStockNames, setOutOfStockNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'); } catch { return []; }
  });
  const [rejectedItemIds, setRejectedItemIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'); } catch { return []; }
  });
  const [staffCancelRequests, setStaffCancelRequests] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]'); } catch { return []; }
  });

  const [showCancelTableModal, setShowCancelTableModal] = useState(false);
  const [cancelTableReason, setCancelTableReason] = useState('Khách đổi ý không dùng bữa');

  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [selectedBankGate, setSelectedBankGate] = useState('VCB');
  const [customerCash, setCustomerCash] = useState(0);

  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountValue, setDiscountValue] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');

  const [showPayModal, setShowPayModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [activeReceiptModalData, setActiveReceiptModalData] = useState(null);

  const [isShiftOpen, setIsShiftOpen] = useState(() => localStorage.getItem('cashier_shift_open') !== 'false');
  const [shiftInfo, setShiftInfo] = useState({
    shift_code: `CA-${new Date().getDate()}${new Date().getMonth() + 1}`,
    opened_at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    db_completed_bills: 0,
    db_completed_revenue: 0,
    db_active_orders_count: 0,
    db_active_revenue: 0
  });
  const [startingCash, setStartingCash] = useState(() => Number(localStorage.getItem('cashier_starting_cash')) || 500000);
  const [actualCountedCash, setActualCountedCash] = useState('');
  const [shiftNote, setShiftNote] = useState('');

  const [shiftStats, setShiftStats] = useState(() => {
    const saved = localStorage.getItem('cashier_shift_stats');
    return saved ? JSON.parse(saved) : { totalBills: 0, cashRevenue: 0, transferRevenue: 0 };
  });
  const [shiftTransactions, setShiftTransactions] = useState(() => {
    const saved = localStorage.getItem('cashier_shift_txs');
    return saved ? JSON.parse(saved) : [];
  });

  const [deviceSettings] = useState(() => {
    const saved = localStorage.getItem('pos_device_settings');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      paperSize: 'K80',
      autoPrintOnCheckout: true
    };
  });

  const token = localStorage.getItem('access_token');
  const staffName = localStorage.getItem('full_name') || 'Bùi Hữu Huy';
  const staffRole = localStorage.getItem('role') || 'cashier';
  const prevAlertCountRef = useRef(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowMenuDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Xử lý khi chọn preset thời gian (Hôm nay / Hôm qua / 7 ngày qua)
  const handleSelectDatePreset = (preset) => {
    setDateRangePreset(preset);
    const now = new Date();
    const toStr = now.toISOString().slice(0, 10);
    if (preset === 'TODAY') {
      setCustomFromDate(toStr);
      setCustomToDate(toStr);
    } else if (preset === 'YESTERDAY') {
      const yes = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setCustomFromDate(yes);
      setCustomToDate(yes);
    } else if (preset === '7DAYS') {
      const seven = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      setCustomFromDate(seven);
      setCustomToDate(toStr);
    }
  };

  const playNotificationBeep = () => {
    if (!deviceSettings.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  };

  const getProductImageUrl = (item) => {
    const rawUrl = item.image_url || item.image || item.thumbnail;
    if (!rawUrl) return 'https://placehold.co/300x300/e2e8f0/475569?text=Mon+An';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    return `${API_BASE}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTables, resOrders, resMenu, resTimes, resStaff, resShift] = await Promise.all([
        fetch(`${API_BASE}/api/tables`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => (r.ok ? r : fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } })))
          .catch(() => null),
        fetch(`${API_BASE}/api/kitchen/order-timestamps`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${API_BASE}/api/kitchen/staff-users`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${API_BASE}/api/kitchen/shift/current`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);

      let fetchedOrderTimes = {};
      if (resTimes && resTimes.ok) {
        const timeData = await resTimes.json();
        fetchedOrderTimes = timeData.order_times || {};
        setDbOrderTimes(fetchedOrderTimes);
        setDbSessionTimes(timeData.session_times || {});
      }

      if (resStaff && resStaff.ok) {
        const staffData = await resStaff.json();
        if (Array.isArray(staffData)) setRealStaffList(staffData);
      }

      if (resShift && resShift.ok) {
        const sData = await resShift.json();
        setShiftInfo(prev => ({ ...prev, ...sData }));
      }

      if (resTables.ok) setTables(await resTables.json());
      if (resOrders.ok) {
        const ordList = await resOrders.json();
        setOrders(ordList);

        const savedOrderTs = JSON.parse(localStorage.getItem('pos_real_order_timestamps') || '{}');
        const savedTableTs = JSON.parse(localStorage.getItem('pos_real_table_start_times') || '{}');
        let changed = false;

        ordList.forEach(o => {
          const st = String(o.status).toLowerCase();
          if (st === 'completed' || st === 'cancelled') return;

          const dbIso = o.created_at || o.order_time || fetchedOrderTimes[String(o.id)];
          let ms = null;
          if (dbIso) {
            const parsed = new Date(String(dbIso).replace(' ', 'T')).getTime();
            if (!isNaN(parsed)) ms = parsed;
          }
          if (!ms) {
            ms = savedOrderTs[o.id] || Date.now();
          }
          if (savedOrderTs[o.id] !== ms) {
            savedOrderTs[o.id] = ms;
            changed = true;
          }

          const tKey = o.table_id || o.table_name;
          if (tKey && (!savedTableTs[tKey] || ms < savedTableTs[tKey])) {
            savedTableTs[tKey] = ms;
            changed = true;
          }
        });

        if (changed) {
          localStorage.setItem('pos_real_order_timestamps', JSON.stringify(savedOrderTs));
          localStorage.setItem('pos_real_table_start_times', JSON.stringify(savedTableTs));
        }
      }

      if (resMenu && resMenu.ok) {
        const menuData = await resMenu.json();
        setMenuItems(Array.isArray(menuData) ? menuData : (menuData.items || []));
      }

      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
      setStaffCancelRequests(JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]'));
    } catch (err) {
      console.error('Lỗi đồng bộ dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);

    const bc = new BroadcastChannel('smartpos_channel');
    bc.onmessage = (event) => {
      const { type } = event.data || {};
      if (
        type === 'KITCHEN_OUT_OF_STOCK' ||
        type === 'STAFF_REQUEST_CANCEL_ITEM' ||
        type === 'STAFF_SWAPPED_ITEM' ||
        type === 'CUSTOMER_CALL_SERVICE' ||
        type === 'EXPO_SERVED' ||
        type === 'ITEM_READY_TO_SERVE'
      ) {
        playNotificationBeep();
        fetchData();
      }
    };

    const handleStorage = () => {
      setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
      setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
      setStaffCancelRequests(JSON.parse(localStorage.getItem('pos_staff_cancel_requests') || '[]'));
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [deviceSettings.soundEnabled]);

  const isItemOutOfStock = (item) => {
    const st = String(item.status || item.item_status || '').toLowerCase();
    const name = item.product_name || item.name;
    if (st === 'cancelled' || st === 'served') return false;
    return st === 'out_of_stock' || rejectedItemIds.includes(item.id) || outOfStockNames.includes(name);
  };

  const isProductUnavailable = (product) => {
    return (
      product.is_available === false ||
      product.is_available === 0 ||
      outOfStockNames.includes(product.name)
    );
  };

  const handleToggleProductAvailability = async (product) => {
    const currentlyUnavailable = isProductUnavailable(product);
    const nextAvailable = currentlyUnavailable;

    let nextOutNames = [...outOfStockNames];
    if (!nextAvailable) {
      if (!nextOutNames.includes(product.name)) nextOutNames.push(product.name);
      await fetch(`${API_BASE}/api/kitchen/out-of-stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: product.id, product_name: product.name })
      }).catch(() => null);
    } else {
      nextOutNames = nextOutNames.filter(n => n !== product.name);
      await fetch(`${API_BASE}/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_available: true })
      }).catch(() => null);
    }

    localStorage.setItem('pos_out_of_stock_names', JSON.stringify(nextOutNames));
    setOutOfStockNames(nextOutNames);

    const bc = new BroadcastChannel('smartpos_channel');
    bc.postMessage({ type: nextAvailable ? 'PRODUCT_RESTORED' : 'KITCHEN_OUT_OF_STOCK', payload: { product_name: product.name } });
    bc.close();

    await fetchData();
  };

  const isTableCalling = (table) => {
    if (!table || dismissedAlerts.includes(table.id)) return false;
    if (
      table.status === 'payment_pending' ||
      table.status === 'calling_staff' ||
      table.need_support ||
      table.payment_requested ||
      table.call_staff
    ) {
      return true;
    }
    const activeOrders = orders.filter(
      o => (o.table_id === table.id || o.table_name === table.table_number) &&
      o.status !== 'completed' && o.status !== 'cancelled'
    );
    return activeOrders.some(o => o.payment_requested || o.call_staff || o.status === 'payment_pending');
  };

  const getCallReason = (table) => {
    if (table.status === 'payment_pending' || table.payment_requested) return 'Gọi thanh toán';
    if (table.status === 'calling_staff' || table.call_staff || table.need_support) return 'Gọi nhân viên';
    return 'Yêu cầu hỗ trợ';
  };

  const callingTables = useMemo(() => {
    return tables.filter(t => isTableCalling(t));
  }, [tables, orders, dismissedAlerts]);

  useEffect(() => {
    if (callingTables.length > prevAlertCountRef.current) {
      playNotificationBeep();
    }
    prevAlertCountRef.current = callingTables.length;
  }, [callingTables.length]);

  const handleResolveAlert = async (e, table) => {
    e.stopPropagation();
    setDismissedAlerts(prev => [...prev, table.id]);
    try {
      await fetch(`${API_BASE}/api/tables/${table.id}/resolve-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);
    } catch (err) {}
  };

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

  const currentDraftItems = useMemo(() => {
    if (!selectedTable) return [];
    return draftItemsByTable[selectedTable.id] || [];
  }, [draftItemsByTable, selectedTable]);

  const hasPendingCustomerOrder = useMemo(() => {
    return tableOrders.some(o => String(o.status).toLowerCase() === 'pending');
  }, [tableOrders]);

  // Lấy mốc thời gian thật của 1 Order (ms)
  const getOrderRealTimestampMs = (order) => {
    const savedOrderTs = JSON.parse(localStorage.getItem('pos_real_order_timestamps') || '{}');
    const rawIso = order.created_at || order.order_time || dbOrderTimes[String(order.id)];
    if (rawIso) {
      const parsed = new Date(String(rawIso).replace(' ', 'T')).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    if (savedOrderTs[order.id]) return Number(savedOrderTs[order.id]);
    return Date.now();
  };

  // Kiểm tra 1 mốc thời gian (ms) có nằm trong bộ lọc Thời gian đang chọn không
  const isTimestampInSelectedRange = (ms) => {
    if (dateRangePreset === 'ALL') return true;
    const d = new Date(ms);
    const itemDateStr = d.toISOString().slice(0, 10);
    if (customFromDate && itemDateStr < customFromDate) return false;
    if (customToDate && itemDateStr > customToDate) return false;
    return true;
  };

  const getTableRealStartTimeMs = (table, activeOrdersOfTable) => {
    const savedTableTs = JSON.parse(localStorage.getItem('pos_real_table_start_times') || '{}');
    const savedOrderTs = JSON.parse(localStorage.getItem('pos_real_order_timestamps') || '{}');

    const sessInfo = dbSessionTimes[String(table.id)];
    if (sessInfo?.started_at) {
      const parsed = new Date(String(sessInfo.started_at).replace(' ', 'T')).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    let earliestMs = null;
    activeOrdersOfTable.forEach(o => {
      const rawIso = o.created_at || o.order_time || dbOrderTimes[String(o.id)];
      if (rawIso) {
        const parsed = new Date(String(rawIso).replace(' ', 'T')).getTime();
        if (!isNaN(parsed) && (!earliestMs || parsed < earliestMs)) {
          earliestMs = parsed;
        }
      } else if (savedOrderTs[o.id]) {
        const ms = Number(savedOrderTs[o.id]);
        if (!earliestMs || ms < earliestMs) earliestMs = ms;
      }
    });

    if (earliestMs) return earliestMs;
    if (savedTableTs[table.id]) return Number(savedTableTs[table.id]);
    return null;
  };

  const currentSessionInfo = useMemo(() => {
    if (!selectedTable) return null;
    const firstOrder = tableOrders[0];
    const sessDb = dbSessionTimes[String(selectedTable.id)];

    const sessionCode =
      sessDb?.session_code ||
      selectedTable.session_code ||
      firstOrder?.session_code ||
      (firstOrder ? `SES-${String(firstOrder.id).padStart(4, '0')}` : `SES-${String(selectedTable.id).padStart(2, '0')}01`);

    const startMs = getTableRealStartTimeMs(selectedTable, tableOrders);
    let startTimeText = 'Chưa mở đơn';
    let fullDateTimeText = '--/--/---- --:--';
    let durationLabel = '0 phút';

    if (startMs) {
      const d = new Date(startMs);
      startTimeText = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      fullDateTimeText = d.toLocaleString('vi-VN');
      const diffMins = Math.max(0, Math.floor((nowTick - startMs) / 60000));
      durationLabel = diffMins === 0 ? 'Vừa vào' : diffMins >= 60 ? `${Math.floor(diffMins / 60)}g ${diffMins % 60}p` : `${diffMins} phút`;
    }

    return { sessionCode, startTimeText, fullDateTimeText, durationLabel, hasActiveSession: tableOrders.length > 0 };
  }, [selectedTable, tableOrders, dbSessionTimes, dbOrderTimes, nowTick]);

  const getTableSummary = (table) => {
    const active = orders.filter(o =>
      (o.table_id === table.id || o.table_name === table.table_number) &&
      o.status !== 'completed' && o.status !== 'cancelled'
    );
    const tableDrafts = draftItemsByTable[table.id] || [];

    let total = 0;
    let itemCount = 0;

    active.forEach(o => {
      (o.items || o.order_items || []).forEach(it => {
        const st = String(it.status || it.item_status || '').toLowerCase();
        if (st === 'cancelled') return;
        const q = Number(it.quantity) || 1;
        itemCount += q;
        if (!isItemOutOfStock(it)) {
          total += Number(it.unit_price || it.price || 0) * q;
        }
      });
    });

    tableDrafts.forEach(d => {
      itemCount += Number(d.quantity || 1);
      total += Number(d.unit_price || 0) * Number(d.quantity || 1);
    });

    const startMs = getTableRealStartTimeMs(table, active);
    let durationText = 'Mới mở';
    let startClock = '';
    if (startMs) {
      const diffMins = Math.max(0, Math.floor((nowTick - startMs) / 60000));
      durationText = diffMins === 0 ? 'Vừa vào' : diffMins >= 60 ? `${Math.floor(diffMins / 60)}g${diffMins % 60}p` : `${diffMins}p`;
      startClock = new Date(startMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    return { total, itemCount, durationText, startClock, hasOrder: active.length > 0 || tableDrafts.length > 0 };
  };

  // GOM CÙNG MÓN VÀO 1 DÒNG DUY NHẤT TRÊN HÓA ĐƠN
  const flattenedBillItems = useMemo(() => {
    if (!selectedTable) return [];
    const sentByNameMap = {};

    tableOrders.forEach(order => {
      const orderSt = String(order.status || 'pending').toLowerCase();
      (order.items || order.order_items || []).forEach(item => {
        const itemSt = String(item.status || item.item_status || '').toLowerCase();
        if (itemSt === 'cancelled') return;

        let effectiveStatus = itemSt || orderSt;
        if (effectiveStatus === 'pending' && ['confirmed', 'preparing', 'cooking', 'ready'].includes(orderSt)) {
          effectiveStatus = orderSt;
        }
        const out = isItemOutOfStock(item);
        if (out) effectiveStatus = 'out_of_stock';

        const pId = item.product_id || item.menu_item_id || item.id;
        const pName = item.product_name || item.name;
        const qty = Number(item.quantity || 1);

        const mergeKey = out ? `OUT_${item.id}` : `MERGED_${pName}`;

        if (!sentByNameMap[mergeKey]) {
          sentByNameMap[mergeKey] = {
            ...item,
            product_id: pId,
            product_name: pName,
            name: pName,
            quantity: qty,
            order_id: order.id,
            isDraft: false,
            kitchen_status: effectiveStatus,
            servedQty: effectiveStatus === 'served' ? qty : 0,
            cookingQty: effectiveStatus !== 'served' && !out ? qty : 0,
            allItemIds: [item.id]
          };
        } else {
          sentByNameMap[mergeKey].quantity += qty;
          sentByNameMap[mergeKey].allItemIds.push(item.id);
          if (effectiveStatus === 'served') {
            sentByNameMap[mergeKey].servedQty += qty;
          } else if (!out) {
            sentByNameMap[mergeKey].cookingQty += qty;
          }
          if (sentByNameMap[mergeKey].cookingQty > 0 && sentByNameMap[mergeKey].servedQty > 0) {
            sentByNameMap[mergeKey].kitchen_status = 'partial_served';
          } else if (sentByNameMap[mergeKey].cookingQty === 0) {
            sentByNameMap[mergeKey].kitchen_status = 'served';
          }
        }
      });
    });

    const list = Object.values(sentByNameMap);

    currentDraftItems.forEach(draft => {
      list.push({
        id: `DRAFT-${draft.product_id}`,
        product_id: draft.product_id,
        product_name: draft.name,
        name: draft.name,
        unit_price: draft.unit_price,
        price: draft.unit_price,
        quantity: draft.quantity,
        note: draft.note,
        isDraft: true,
        kitchen_status: 'draft_unsent'
      });
    });

    return list;
  }, [tableOrders, selectedTable, outOfStockNames, rejectedItemIds, currentDraftItems]);

  const subTotalAmount = useMemo(() => {
    if (!selectedTable) return 0;
    return flattenedBillItems.reduce((sum, item) => {
      if (item.kitchen_status === 'out_of_stock') return sum;
      return sum + (Number(item.unit_price || item.price || 0) * Number(item.quantity || 1));
    }, 0);
  }, [flattenedBillItems, selectedTable]);

  const discountAmount = useMemo(() => {
    if (subTotalAmount <= 0 || discountValue <= 0) return 0;
    if (discountType === 'PERCENT') {
      return Math.min(subTotalAmount, Math.round((subTotalAmount * Math.min(100, discountValue)) / 100));
    }
    return Math.min(subTotalAmount, Number(discountValue) || 0);
  }, [subTotalAmount, discountType, discountValue]);

  const currentBillTotal = Math.max(0, subTotalAmount - discountAmount);

  const currentBillQty = useMemo(() => {
    if (!selectedTable) return 0;
    return flattenedBillItems.reduce((sum, item) => {
      if (item.kitchen_status === 'out_of_stock') return sum;
      return sum + Number(item.quantity || 1);
    }, 0);
  }, [flattenedBillItems, selectedTable]);

  const unservedItemsCount = useMemo(() => {
    return flattenedBillItems.filter(item => {
      const st = String(item.kitchen_status).toLowerCase();
      return st !== 'served' && st !== 'completed';
    }).length;
  }, [flattenedBillItems]);

  // =========================================================================
  // DỮ LIỆU THẬT CHO DASHBOARD TỔNG QUAN (GIỐNG ẢNH 3), HÀNG HÓA & GIAO DỊCH
  // =========================================================================
  const filteredOrdersByDate = useMemo(() => {
    return orders.filter(o => {
      const ms = getOrderRealTimestampMs(o);
      return isTimestampInSelectedRange(ms);
    });
  }, [orders, dbOrderTimes, dateRangePreset, customFromDate, customToDate]);

  // 1. Thống kê số lượng món theo khoảng ngày lọc cho trang Hàng hóa
  const realProductMetrics = useMemo(() => {
    const activeOrderedByProduct = {};
    const soldInShiftByProduct = {};

    filteredOrdersByDate.forEach(o => {
      const st = String(o.status || '').toLowerCase();
      if (st === 'cancelled') return;
      (o.items || o.order_items || []).forEach(it => {
        const iSt = String(it.item_status || it.status || '').toLowerCase();
        if (iSt === 'cancelled' || iSt === 'out_of_stock') return;
        const pName = it.product_name || it.name;
        const q = Number(it.quantity || 1);
        if (st === 'completed' || st === 'paid' || st === 'served' || iSt === 'served') {
          soldInShiftByProduct[pName] = (soldInShiftByProduct[pName] || 0) + q;
        } else {
          activeOrderedByProduct[pName] = (activeOrderedByProduct[pName] || 0) + q;
        }
      });
    });

    return { activeOrderedByProduct, soldInShiftByProduct };
  }, [filteredOrdersByDate]);

  // 2. Dữ liệu cho trang Tổng quan (Dashboard Ảnh 3)
  const overviewDashboardData = useMemo(() => {
    let totalRevenue = 0;
    let validOrdersCount = 0;
    const categoryRevMap = {};

    // Map tên sản phẩm sang Danh mục
    const productCatLookup = {};
    menuItems.forEach(m => {
      productCatLookup[m.name] = m.category_name || m.category || 'Món Chính & Cơm';
    });

    filteredOrdersByDate.forEach(o => {
      const st = String(o.status || '').toLowerCase();
      if (st === 'cancelled') return;
      validOrdersCount += 1;

      const items = o.items || o.order_items || [];
      items.forEach(it => {
        const iSt = String(it.item_status || it.status || '').toLowerCase();
        if (iSt === 'cancelled' || iSt === 'out_of_stock') return;
        const name = it.product_name || it.name;
        const q = Number(it.quantity || 1);
        const p = Number(it.unit_price || it.price || 0);
        const lineRev = q * p;

        totalRevenue += lineRev;
        const catName = productCatLookup[name] || 'Món Chính & Cơm';
        categoryRevMap[catName] = (categoryRevMap[catName] || 0) + lineRev;
      });
    });

    const donutData = Object.entries(categoryRevMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Biểu đồ cột doanh thu 7 ngày gần nhất (Giống Ảnh 3)
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dailyBarData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const isoDay = d.toISOString().slice(0, 10);
      const label = `${dayLabels[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      let revOfDay = 0;
      orders.forEach(o => {
        if (String(o.status || '').toLowerCase() === 'cancelled') return;
        const ms = getOrderRealTimestampMs(o);
        const oIso = new Date(ms).toISOString().slice(0, 10);
        if (oIso === isoDay) {
          (o.items || o.order_items || []).forEach(it => {
            const iSt = String(it.item_status || it.status || '').toLowerCase();
            if (iSt !== 'cancelled' && iSt !== 'out_of_stock') {
              revOfDay += Number(it.unit_price || it.price || 0) * Number(it.quantity || 1);
            }
          });
        }
      });

      dailyBarData.push({
        dayLabel: label,
        revenue: revOfDay,
        revenueK: Math.round(revOfDay / 1000)
      });
    }

    return {
      totalRevenue,
      validOrdersCount,
      donutData,
      dailyBarData
    };
  }, [filteredOrdersByDate, orders, menuItems]);

  // 3. Danh sách Đơn Giao Dịch thật cho tab "Giao dịch" (Bấm vào đơn xổ ra chi tiết món + Nút in lại K80)
  const unifiedTransactionOrders = useMemo(() => {
    const list = [];

    // Lấy từ bảng Orders trên DB
    orders.forEach(o => {
      const ms = getOrderRealTimestampMs(o);
      if (!isTimestampInSelectedRange(ms)) return;

      const rawItems = (o.items || o.order_items || []).filter(it => {
        const iSt = String(it.item_status || it.status || '').toLowerCase();
        return iSt !== 'cancelled';
      });

      const calcTotal = rawItems.reduce((s, it) => {
        if (isItemOutOfStock(it)) return s;
        return s + Number(it.unit_price || it.price || 0) * Number(it.quantity || 1);
      }, 0);

      const totalQty = rawItems.reduce((s, it) => s + Number(it.quantity || 1), 0);
      const st = String(o.status || 'pending').toLowerCase();

      let statusCategory = 'SERVING';
      let statusLabel = 'Đang phục vụ';
      let statusBadgeClass = 'bg-primary bg-opacity-10 text-primary border-primary';

      if (st === 'completed' || st === 'paid') {
        statusCategory = 'COMPLETED';
        statusLabel = 'Đã hoàn thành';
        statusBadgeClass = 'bg-success bg-opacity-10 text-success border-success';
      } else if (st === 'cancelled') {
        statusCategory = 'CANCELLED';
        statusLabel = 'Đã hủy';
        statusBadgeClass = 'bg-danger bg-opacity-10 text-danger border-danger';
      }

      list.push({
        txId: `ORD-${o.id}`,
        orderCode: o.order_code || `ORD-${String(o.id).padStart(5, '0')}`,
        tableName: o.table_name || `Bàn 0${o.table_id}`,
        sessionCode: o.session_code || `SES-00${o.table_id || o.id}`,
        createdAtMs: ms,
        createdAtText: new Date(ms).toLocaleString('vi-VN'),
        cashierName: staffName,
        totalQty,
        totalAmount: Number(o.total_amount) || calcTotal,
        statusCategory,
        statusLabel,
        statusBadgeClass,
        items: rawItems
      });
    });

    return list
      .filter(tx => {
        if (txStatusFilter !== 'ALL' && tx.statusCategory !== txStatusFilter) return false;
        if (txSearch) {
          const q = txSearch.toLowerCase();
          if (!tx.orderCode.toLowerCase().includes(q) && !tx.tableName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [orders, dbOrderTimes, dateRangePreset, customFromDate, customToDate, txStatusFilter, txSearch]);

  // 4. Danh sách Vị trí công việc & Nhân viên đã lọc cho tab "Nhân viên"
  const distinctStaffPositions = useMemo(() => {
    const set = new Set(realStaffList.map(s => s.position || s.role || 'Nhân viên phục vụ'));
    return Array.from(set);
  }, [realStaffList]);

  const filteredStaffMembers = useMemo(() => {
    return realStaffList.filter(s => {
      const pos = s.position || s.role || 'Nhân viên phục vụ';
      if (selectedPositions.length > 0 && !selectedPositions.includes(pos)) return false;
      if (staffSearch) {
        const q = staffSearch.toLowerCase();
        const code = (s.staff_code || `NV00${s.id}`).toLowerCase();
        if (!(s.full_name || '').toLowerCase().includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [realStaffList, selectedPositions, staffSearch]);

  const getKitchenStatusBadge = (item) => {
    const st = String(item.kitchen_status || 'pending').toLowerCase();
    if (st === 'draft_unsent') {
      return { label: 'Lưu nháp • Chờ bấm Thông báo (F10)', bg: '#fef3c7', color: '#d97706' };
    }
    if (st === 'out_of_stock') {
      return { label: 'Bếp báo hết (Chờ đổi/xóa)', bg: '#fee2e2', color: '#dc2626' };
    }
    if (st === 'partial_served') {
      return {
        label: `Đã lên ${item.servedQty}/${item.quantity} • Đang làm ${item.cookingQty}`,
        bg: '#dbeafe',
        color: '#1d4ed8'
      };
    }
    if (st === 'served' || st === 'completed') {
      return { label: '✓ Đã lên đủ món', bg: '#dcfce7', color: '#15803d' };
    }
    if (st === 'ready' || st === 'done') {
      return { label: 'Chờ tại PASS', bg: '#dbeafe', color: '#1d4ed8' };
    }
    if (st === 'cooking' || st === 'preparing') {
      return { label: 'Đang chế biến', bg: '#fef3c7', color: '#b45309' };
    }
    if (st === 'confirmed') {
      return { label: 'Đã chuyển Bếp/Bar', bg: '#e0f2fe', color: '#0369a1' };
    }
    return { label: 'Khách đặt • Chờ xác nhận', bg: '#fee2e2', color: '#b91c1c' };
  };

  const addProductToDraftCart = (productObj) => {
    if (!selectedTable) {
      alert('Vui lòng chọn một bàn ở tab [Phòng bàn] trước khi thêm món!');
      setLeftTab('TABLES');
      return;
    }

    const savedTableTs = JSON.parse(localStorage.getItem('pos_real_table_start_times') || '{}');
    if (!savedTableTs[selectedTable.id]) {
      savedTableTs[selectedTable.id] = Date.now();
      localStorage.setItem('pos_real_table_start_times', JSON.stringify(savedTableTs));
    }

    const prodId = productObj.product_id || productObj.id;
    const prodName = productObj.product_name || productObj.name;
    const prodPrice = Number(productObj.unit_price || productObj.price || 0);

    setDraftItemsByTable(prev => {
      const tableId = selectedTable.id;
      const currentList = prev[tableId] || [];
      const existingIdx = currentList.findIndex(i => i.product_id === prodId || i.name === prodName);

      let nextList;
      if (existingIdx > -1) {
        nextList = currentList.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        nextList = [
          ...currentList,
          {
            product_id: prodId,
            name: prodName,
            unit_price: prodPrice,
            quantity: 1,
            note: ''
          }
        ];
      }
      return { ...prev, [tableId]: nextList };
    });
  };

  const handleAddMenuItemToTable = (product) => {
    if (isProductUnavailable(product)) {
      return alert(`⚠️ Món "${product.name}" hiện đã hết hàng, không thể thêm vào bàn!`);
    }
    addProductToDraftCart(product);
  };

  const handleNotifyKitchenForTable = async () => {
    if (!selectedTable || sendingToKitchen) return;
    const tableId = selectedTable.id;
    const drafts = draftItemsByTable[tableId] || [];

    if (drafts.length === 0 && !hasPendingCustomerOrder) {
      return alert(`Hiện không có món mới lưu nháp nào cần thông báo cho Bếp/Bar!`);
    }

    setSendingToKitchen(true);
    try {
      let createdOrderId = null;
      const nowMs = Date.now();

      if (drafts.length > 0) {
        const res = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            table_id: tableId,
            status: 'confirmed',
            items: drafts.map(d => ({
              product_id: d.product_id,
              quantity: d.quantity,
              price: d.unit_price,
              note: d.note || ''
            }))
          })
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          createdOrderId = data?.id || data?.order_id;
          if (createdOrderId) {
            const savedOrderTs = JSON.parse(localStorage.getItem('pos_real_order_timestamps') || '{}');
            savedOrderTs[createdOrderId] = nowMs;
            localStorage.setItem('pos_real_order_timestamps', JSON.stringify(savedOrderTs));
          }
          setDraftItemsByTable(prev => ({ ...prev, [tableId]: [] }));
        } else {
          alert('Không thể gửi phiếu xuống Bếp!');
          setSendingToKitchen(false);
          return;
        }
      }

      await fetch(`${API_BASE}/api/kitchen/tables/${tableId}/notify-kitchen`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);

      if (createdOrderId) {
        const autoConfirmed = JSON.parse(localStorage.getItem('pos_cashier_confirmed_orders') || '[]');
        if (!autoConfirmed.includes(createdOrderId)) {
          autoConfirmed.push(createdOrderId);
          localStorage.setItem('pos_cashier_confirmed_orders', JSON.stringify(autoConfirmed));
        }
      }

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'CASHIER_CREATED_ORDER', payload: { table_id: tableId, order_id: createdOrderId } });
      bc.close();

      await fetchData();
    } catch (e) {
      alert('Lỗi kết nối khi gửi thông báo xuống Bếp!');
    } finally {
      setSendingToKitchen(false);
    }
  };

  const handleExportProductsCSV = () => {
    const headers = ['Mã hàng,Tên hàng,Nhóm hàng,Giá bán,Khách đang đặt,Đã bán,Trạng thái'];
    const rows = menuItems.map(p => {
      const code = p.code || `SP${String(p.id).padStart(6, '0')}`;
      const cat = p.category_name || p.category || 'Món chính';
      const activeQty = realProductMetrics.activeOrderedByProduct[p.name] || 0;
      const soldQty = realProductMetrics.soldInShiftByProduct[p.name] || 0;
      const st = isProductUnavailable(p) ? 'Tạm hết' : 'Còn hàng';
      return `"${code}","${p.name}","${cat}",${p.price || 0},${activeQty},${soldQty},"${st}"`;
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hang_Hoa_SmartPOS_${customFromDate}_${customToDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenReceiptPreview = (receiptType = 'PROVISIONAL', customTx = null) => {
    if (!selectedTable && !customTx) return;

    const now = new Date();
    const receiptObj = customTx || {
      id: receiptType === 'FINAL' ? `HD-${Date.now().toString().slice(-6)}` : `TT-${Date.now().toString().slice(-5)}`,
      isFinalInvoice: receiptType === 'FINAL',
      title: receiptType === 'FINAL' ? 'HÓA ĐƠN THANH TOÁN' : 'PHIẾU TẠM TÍNH',
      table: selectedTable?.table_number || 'Bàn khách',
      sessionCode: currentSessionInfo?.sessionCode || 'N/A',
      startTime: currentSessionInfo?.fullDateTimeText || now.toLocaleString('vi-VN'),
      checkoutTime: now.toLocaleString('vi-VN'),
      durationLabel: currentSessionInfo?.durationLabel || 'Vừa vào',
      cashier: staffName,
      items: flattenedBillItems.filter(it => it.kitchen_status !== 'out_of_stock'),
      totalQty: currentBillQty,
      subtotal: subTotalAmount,
      discountType,
      discountValue,
      discountAmount,
      voucherCode,
      totalAmount: currentBillTotal,
      paymentMethod: receiptType === 'FINAL' ? paymentMethod : 'CHƯA THANH TOÁN',
      customerCash: receiptType === 'FINAL' && paymentMethod === 'CASH' ? (customerCash || currentBillTotal) : 0,
      changeAmount: receiptType === 'FINAL' && paymentMethod === 'CASH' ? Math.max(0, (customerCash || currentBillTotal) - currentBillTotal) : 0,
      qrUrl: dynamicVietQrUrl
    };

    setActiveReceiptModalData(receiptObj);
  };

  // Mở xem trước & In lại trực tiếp từ 1 dòng Đơn giao dịch trong trang Giao dịch
  const handleReprintTransactionOrder = (txRecord) => {
    const bank = BANK_CONFIGS[selectedBankGate] || BANK_CONFIGS.VCB;
    const qr = `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNo}-${bank.template}.png?amount=${txRecord.totalAmount}&addInfo=${encodeURIComponent(txRecord.orderCode)}&accountName=${encodeURIComponent(bank.accountName)}`;

    const receiptObj = {
      id: txRecord.orderCode,
      isFinalInvoice: txRecord.statusCategory === 'COMPLETED',
      title: txRecord.statusCategory === 'COMPLETED' ? 'HÓA ĐƠN THANH TOÁN (IN LẠI)' : 'PHIẾU TẠM TÍNH ĐƠN HÀNG',
      table: txRecord.tableName,
      sessionCode: txRecord.sessionCode,
      startTime: txRecord.createdAtText,
      checkoutTime: new Date().toLocaleString('vi-VN'),
      durationLabel: txRecord.statusLabel,
      cashier: txRecord.cashierName || staffName,
      items: txRecord.items || [],
      totalQty: txRecord.totalQty,
      subtotal: txRecord.totalAmount,
      discountAmount: 0,
      totalAmount: txRecord.totalAmount,
      paymentMethod: 'CASH',
      customerCash: txRecord.totalAmount,
      changeAmount: 0,
      qrUrl: qr
    };
    setActiveReceiptModalData(receiptObj);
  };

  const triggerDedicatedK80Print = (receipt) => {
    if (!receipt) return;
    const printWin = window.open('', '_blank', 'width=420,height=720');
    if (!printWin) {
      alert('Vui lòng cho phép mở popup để in hóa đơn K80!');
      return;
    }

    const rowsHtml = (receipt.items || [])
      .map((it, i) => {
        const uPrice = Number(it.unit_price || it.price || 0);
        const q = Number(it.quantity || 1);
        return `
          <tr>
            <td style="padding: 5px 0; border-bottom: 1px dashed #ccc;">
              <div style="font-weight: 700;">${i + 1}. ${it.product_name || it.name}</div>
            </td>
            <td style="padding: 5px 4px; text-align: center; border-bottom: 1px dashed #ccc; font-weight: 700;">${q}</td>
            <td style="padding: 5px 4px; text-align: right; border-bottom: 1px dashed #ccc;">${uPrice.toLocaleString()}</td>
            <td style="padding: 5px 0; text-align: right; border-bottom: 1px dashed #ccc; font-weight: 700;">${(uPrice * q).toLocaleString()}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${receipt.title} - ${receipt.table}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body {
            font-family: 'Segoe UI', Roboto, Arial, sans-serif;
            width: 74mm;
            margin: 0 auto;
            padding: 6px;
            color: #000;
            font-size: 12.5px;
            line-height: 1.4;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row-flex { display: flex; justify-content: space-between; margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; }
          th { border-bottom: 1px solid #000; padding: 4px 0; text-transform: uppercase; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div style="font-size: 16px; font-weight: 800;">NHÀ HÀNG SMARTPOS</div>
          <div style="font-size: 11.5px;">Chi nhánh Trung Tâm • Hotline: 1900 6522</div>
          <div style="font-size: 15px; font-weight: 800; margin-top: 8px;">${receipt.title}</div>
          <div style="font-size: 11.5px;">Số phiếu: <b>${receipt.id}</b></div>
        </div>

        <div class="divider"></div>

        <div class="row-flex"><span>Bàn phục vụ:</span><b style="font-size: 14px;">${receipt.table}</b></div>
        <div class="row-flex"><span>Mã phiên:</span><b>${receipt.sessionCode}</b></div>
        <div class="row-flex"><span>Giờ khách vào:</span><span>${receipt.startTime}</span></div>
        <div class="row-flex"><span>Giờ xuất phiếu:</span><span>${receipt.checkoutTime}</span></div>
        <div class="row-flex"><span>Thu ngân:</span><span>${receipt.cashier}</span></div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Tên món</th>
              <th style="text-align: center;">SL</th>
              <th style="text-align: right;">Đ.Giá</th>
              <th style="text-align: right;">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="row-flex"><span>Tổng số lượng:</span><b>${receipt.totalQty} phần</b></div>
        <div class="row-flex"><span>Tạm tính:</span><b>${Number(receipt.subtotal || 0).toLocaleString()}đ</b></div>
        ${
          receipt.discountAmount > 0
            ? `<div class="row-flex"><span>Giảm giá:</span><b>-${Number(receipt.discountAmount).toLocaleString()}đ</b></div>`
            : ''
        }
        <div class="divider"></div>
        <div class="row-flex" style="font-size: 15.5px; font-weight: 800;">
          <span>TỔNG THANH TOÁN:</span>
          <span>${Number(receipt.totalAmount || 0).toLocaleString()}đ</span>
        </div>

        <div class="divider"></div>
        <div class="center" style="font-size: 11.5px;">
          <div>Quý khách vui lòng kiểm tra lại hóa đơn</div>
          <div class="bold">Cảm ơn Quý khách & Hẹn gặp lại!</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        document.getElementById('pos-global-search')?.focus();
      } else if (e.key === 'F9' && selectedTable && currentBillTotal > 0) {
        e.preventDefault();
        handleInitiateCheckout();
      } else if (e.key === 'F10' && selectedTable) {
        e.preventDefault();
        handleNotifyKitchenForTable();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleInitiateCheckout = () => {
    if (!selectedTable || currentBillTotal <= 0) return;
    if (!isShiftOpen) {
      alert('⚠️ Vui lòng mở ca làm việc trước khi thực hiện thanh toán!');
      setShowShiftModal(true);
      return;
    }
    if (currentDraftItems.length > 0) {
      return alert(`⚠️ Bàn này đang có ${currentDraftItems.length} món lưu nháp chưa bấm "Thông báo (F10)" cho Bếp. Vui lòng bấm "Thông báo (F10)" hoặc xóa món nháp trước khi thanh toán!`);
    }
    if (unservedItemsCount > 0) {
      const confirmProceed = window.confirm(
        `⚠️ Bàn ${selectedTable.table_number} vẫn còn ${unservedItemsCount} dòng món chưa lên đủ.\nBạn có chắc chắn muốn chốt đơn và thanh toán ngay không?`
      );
      if (!confirmProceed) return;
    }
    setCustomerCash(currentBillTotal);
    setShowPayModal(true);
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    setCustomerCash(0);
    setDiscountValue(0);
    setVoucherCode('');
    if (openMenuOnSelect) setLeftTab('MENU');
  };

  const handleClearSelectedTable = () => {
    setSelectedTable(null);
    setTableOrders([]);
    setCustomerCash(0);
    setDiscountValue(0);
    setVoucherCode('');
  };

  const handleApproveStaffCancelRequest = async (req) => {
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/items/${req.item_id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: req.reason || 'Nhân viên báo khách hủy món hết' })
      });

      if (res.ok) {
        const updatedReqs = staffCancelRequests.filter(r => r.item_id !== req.item_id);
        localStorage.setItem('pos_staff_cancel_requests', JSON.stringify(updatedReqs));
        setStaffCancelRequests(updatedReqs);

        const nextRejected = rejectedItemIds.filter(id => id !== req.item_id);
        localStorage.setItem('pos_rejected_item_ids', JSON.stringify(nextRejected));
        setRejectedItemIds(nextRejected);

        const bc = new BroadcastChannel('smartpos_channel');
        bc.postMessage({ type: 'CASHIER_CONFIRMED_CANCEL', payload: req });
        bc.close();

        await fetchData();
      }
    } catch (e) {
      alert('Lỗi khi xác nhận xóa món!');
    }
  };

  const handleConfirmCancelTable = async (e) => {
    e.preventDefault();
    if (!selectedTable) return;
    if (!cancelTableReason.trim()) return alert('Vui lòng nhập lý do hủy/đóng bàn!');

    try {
      setDraftItemsByTable(prev => ({ ...prev, [selectedTable.id]: [] }));

      const allSentIds = flattenedBillItems.filter(i => !i.isDraft).flatMap(i => i.allItemIds || [i.id]);
      await Promise.all(
        allSentIds.map(id =>
          fetch(`${API_BASE}/api/kitchen/items/${id}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reason: cancelTableReason })
          }).catch(() => null)
        )
      );

      await fetch(`${API_BASE}/api/kitchen/tables/${selectedTable.id}/cancel-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelTableReason })
      }).catch(() => null);

      const savedTableTs = JSON.parse(localStorage.getItem('pos_real_table_start_times') || '{}');
      delete savedTableTs[selectedTable.id];
      localStorage.setItem('pos_real_table_start_times', JSON.stringify(savedTableTs));

      const nextReqs = staffCancelRequests.filter(r => r.table_name !== selectedTable.table_number);
      localStorage.setItem('pos_staff_cancel_requests', JSON.stringify(nextReqs));
      setStaffCancelRequests(nextReqs);

      setTables(prev => prev.map(t => (t.id === selectedTable.id ? { ...t, status: 'available' } : t)));

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({
        type: 'TABLE_CANCELLED',
        payload: { table_id: selectedTable.id, table_name: selectedTable.table_number, reason: cancelTableReason }
      });
      bc.close();

      setShowCancelTableModal(false);
      handleClearSelectedTable();
      await fetchData();
    } catch (err) {
      alert('Lỗi khi hủy bàn!');
    }
  };

  const handleUpdateItemQty = async (item, delta) => {
    if (item.isDraft) {
      setDraftItemsByTable(prev => {
        const tableId = selectedTable.id;
        const currentList = prev[tableId] || [];
        const nextList = currentList
          .map(d => (d.product_id === item.product_id || d.name === item.name ? { ...d, quantity: d.quantity + delta } : d))
          .filter(d => d.quantity > 0);
        return { ...prev, [tableId]: nextList };
      });
      return;
    }

    if (delta > 0) {
      addProductToDraftCart(item);
      return;
    }

    const targetItemId = (item.allItemIds && item.allItemIds[item.allItemIds.length - 1]) || item.id;
    const newQty = Number(item.quantity || 1) + delta;
    if (newQty <= 0) return handleCancelItem(item);

    try {
      const res = await fetch(`${API_BASE}/api/kitchen/items/${targetItemId}/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: 1 })
      });
      if (!res.ok || (item.allItemIds && item.allItemIds.length > 1)) {
        await fetch(`${API_BASE}/api/kitchen/items/${targetItemId}/cancel`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason: 'Giảm số lượng trên hóa đơn' })
        });
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelItem = async (item) => {
    if (item.isDraft) {
      setDraftItemsByTable(prev => {
        const tableId = selectedTable.id;
        const currentList = prev[tableId] || [];
        return {
          ...prev,
          [tableId]: currentList.filter(d => d.product_id !== item.product_id && d.name !== item.name)
        };
      });
      return;
    }

    const idsToCancel = item.allItemIds || [item.id];
    const itemName = item.product_name || item.name || 'món này';
    const st = String(item.kitchen_status || 'pending').toLowerCase();

    let cancelReason = 'Khách yêu cầu hủy món';
    if (st === 'cooking' || st === 'preparing' || st === 'served' || st === 'ready' || st === 'partial_served') {
      const inputReason = window.prompt(
        `⚠️ Món "${itemName}" đang ở trạng thái chế biến/đã lên.\nNhập lý do xóa món:`
      );
      if (inputReason === null) return;
      cancelReason = inputReason.trim() || 'Thu ngân xóa món';
    }

    try {
      await Promise.all(
        idsToCancel.map(id =>
          fetch(`${API_BASE}/api/kitchen/items/${id}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reason: cancelReason })
          })
        )
      );

      const nextReqs = staffCancelRequests.filter(r => !idsToCancel.includes(r.item_id));
      localStorage.setItem('pos_staff_cancel_requests', JSON.stringify(nextReqs));
      setStaffCancelRequests(nextReqs);

      const nextRejected = rejectedItemIds.filter(id => !idsToCancel.includes(id));
      localStorage.setItem('pos_rejected_item_ids', JSON.stringify(nextRejected));
      setRejectedItemIds(nextRejected);

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'CASHIER_CONFIRMED_CANCEL', payload: { item_ids: idsToCancel } });
      bc.close();

      await fetchData();
    } catch (err) {
      alert('Lỗi kết nối khi xóa món!');
    }
  };

  const handleOpenShiftSubmit = async (e) => {
    e.preventDefault();
    const cashNum = Number(startingCash) || 0;

    try {
      const res = await fetch(`${API_BASE}/api/kitchen/shift/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          starting_cash: cashNum,
          staff_name: staffName,
          note: shiftNote
        })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.shift) setShiftInfo(prev => ({ ...prev, ...data.shift }));
      }
    } catch (err) {}

    setStartingCash(cashNum);
    setIsShiftOpen(true);
    setActualCountedCash('');
    setShiftNote('');
    localStorage.setItem('cashier_shift_open', 'true');
    localStorage.setItem('cashier_starting_cash', String(cashNum));
    setShowShiftModal(false);
  };

  const handleCloseShiftSubmit = async (e) => {
    e.preventDefault();
    const expectedCash = startingCash + shiftStats.cashRevenue;
    const counted = Number(actualCountedCash) || 0;

    try {
      await fetch(`${API_BASE}/api/kitchen/shift/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          actual_cash: counted,
          expected_cash: expectedCash,
          cash_revenue: shiftStats.cashRevenue,
          transfer_revenue: shiftStats.transferRevenue,
          total_bills: shiftStats.totalBills,
          staff_name: staffName,
          note: shiftNote
        })
      }).catch(() => null);
    } catch (err) {}

    setIsShiftOpen(false);
    const emptyStats = { totalBills: 0, cashRevenue: 0, transferRevenue: 0 };
    setShiftStats(emptyStats);
    setShiftTransactions([]);
    setActualCountedCash('');
    setShiftNote('');
    localStorage.setItem('cashier_shift_open', 'false');
    localStorage.setItem('cashier_shift_stats', JSON.stringify(emptyStats));
    localStorage.setItem('cashier_shift_txs', JSON.stringify([]));
    setShowShiftModal(false);
  };

  const handleConfirmPayment = async () => {
    if (!isShiftOpen) {
      alert('⚠️ Vui lòng mở ca trước khi thu tiền!');
      setShowShiftModal(true);
      return;
    }
    if (!selectedTable) return;

    const payload = {
      table_id: selectedTable.id,
      session_id: currentSessionInfo?.sessionCode,
      amount: currentBillTotal,
      subtotal: subTotalAmount,
      discount_amount: discountAmount,
      voucher_code: voucherCode || null,
      method: paymentMethod,
      bank_gate: paymentMethod === 'TRANSFER' ? selectedBankGate : null,
      close_session: true,
      reset_table_status: 'available'
    };

    try {
      const res = await fetch(`${API_BASE}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const now = new Date();
        const nowHour = now.getHours();
        const finalReceiptObj = {
          id: `HD-${Date.now().toString().slice(-6)}`,
          isFinalInvoice: true,
          title: 'HÓA ĐƠN THANH TOÁN',
          table: selectedTable.table_number,
          sessionCode: currentSessionInfo?.sessionCode || 'N/A',
          startTime: currentSessionInfo?.fullDateTimeText || now.toLocaleString('vi-VN'),
          checkoutTime: now.toLocaleString('vi-VN'),
          durationLabel: currentSessionInfo?.durationLabel || 'Vừa xong',
          subtotal: subTotalAmount,
          discountAmount: discountAmount,
          voucherCode,
          totalAmount: currentBillTotal,
          amount: currentBillTotal,
          totalQty: currentBillQty,
          paymentMethod: paymentMethod,
          method: paymentMethod,
          customerCash: paymentMethod === 'CASH' ? (customerCash || currentBillTotal) : 0,
          changeAmount: paymentMethod === 'CASH' ? Math.max(0, (customerCash || currentBillTotal) - currentBillTotal) : 0,
          bankGate: paymentMethod === 'TRANSFER' ? selectedBankGate : null,
          items: flattenedBillItems.filter(i => i.kitchen_status !== 'out_of_stock'),
          cashier: staffName,
          hour: `${String(nowHour).padStart(2, '0')}:00`,
          time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          date: now.toLocaleDateString('vi-VN'),
          qrUrl: dynamicVietQrUrl
        };

        const nextStats = {
          totalBills: shiftStats.totalBills + 1,
          cashRevenue: paymentMethod === 'CASH' ? shiftStats.cashRevenue + currentBillTotal : shiftStats.cashRevenue,
          transferRevenue: paymentMethod === 'TRANSFER' ? shiftStats.transferRevenue + currentBillTotal : shiftStats.transferRevenue
        };
        const nextTxs = [finalReceiptObj, ...shiftTransactions];

        setShiftStats(nextStats);
        setShiftTransactions(nextTxs);
        localStorage.setItem('cashier_shift_stats', JSON.stringify(nextStats));
        localStorage.setItem('cashier_shift_txs', JSON.stringify(nextTxs));

        const savedTableTs = JSON.parse(localStorage.getItem('pos_real_table_start_times') || '{}');
        delete savedTableTs[selectedTable.id];
        localStorage.setItem('pos_real_table_start_times', JSON.stringify(savedTableTs));

        const bc = new BroadcastChannel('smartpos_channel');
        bc.postMessage({ type: 'SESSION_CLOSED', payload: { table_id: selectedTable.id } });
        bc.close();

        setTables(prev => prev.map(t => (t.id === selectedTable.id ? { ...t, status: 'available' } : t)));
        setShowPayModal(false);
        handleClearSelectedTable();

        setActiveReceiptModalData(finalReceiptObj);
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Lỗi thanh toán: ${err.detail || 'Vui lòng thử lại'}`);
      }
    } catch (err) {
      alert('Lỗi kết nối server!');
    }
  };

  const floors = useMemo(() => {
    const set = new Set(tables.map(t => t.zone || t.floor).filter(Boolean));
    return Array.from(set);
  }, [tables]);

  const usedCount = tables.filter(t => ['occupied', 'busy', 'payment_pending'].includes(t.status)).length;
  const emptyCount = tables.length - usedCount;
  const callingCount = callingTables.length;

  const filteredTables = tables.filter(t => {
    const isUsed = ['occupied', 'busy', 'payment_pending'].includes(t.status);
    const calling = isTableCalling(t);
    if (statusRadio === 'USED' && !isUsed) return false;
    if (statusRadio === 'EMPTY' && isUsed) return false;
    if (statusRadio === 'CALLING' && !calling) return false;
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

  const filteredMgmtProducts = useMemo(() => {
    return menuItems.filter(p => {
      const cat = p.category_name || p.category || 'Món chính';
      const unavail = isProductUnavailable(p);
      if (mgmtCategoryFilter !== 'Tất cả' && cat !== mgmtCategoryFilter) return false;
      if (mgmtStockFilter === 'AVAILABLE' && unavail) return false;
      if (mgmtStockFilter === 'OUT_OF_STOCK' && !unavail) return false;
      if (mgmtSearch) {
        const q = mgmtSearch.toLowerCase();
        const code = `sp${String(p.id).padStart(6, '0')}`;
        if (!(p.name || '').toLowerCase().includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [menuItems, mgmtCategoryFilter, mgmtStockFilter, mgmtSearch, outOfStockNames]);

  const changeAmount = customerCash > currentBillTotal ? customerCash - currentBillTotal : 0;
  const activeBank = BANK_CONFIGS[selectedBankGate] || BANK_CONFIGS.VCB;
  const vietQrTransferInfo = selectedTable
    ? `TT ${selectedTable.table_number} ${currentSessionInfo?.sessionCode || ''}`.trim()
    : 'THANH TOAN SMARTPOS';
  const dynamicVietQrUrl = `https://img.vietqr.io/image/${activeBank.bankId}-${activeBank.accountNo}-${activeBank.template}.png?amount=${currentBillTotal}&addInfo=${encodeURIComponent(vietQrTransferInfo)}&accountName=${encodeURIComponent(activeBank.accountName)}`;

  const needsKitchenNotify = currentDraftItems.length > 0 || hasPendingCustomerOrder;

  const expectedCashInDrawer = startingCash + shiftStats.cashRevenue;
  const countedCashNum = actualCountedCash === '' ? expectedCashInDrawer : Number(actualCountedCash);
  const cashDiscrepancy = countedCashNum - expectedCashInDrawer;

  const displayDateLabel = customFromDate === customToDate
    ? customFromDate.split('-').reverse().join('/')
    : `${customFromDate.split('-').reverse().join('/')} - ${customToDate.split('-').reverse().join('/')}`;

  return (
    <div className="vh-100 d-flex flex-column overflow-hidden select-none pos-app-wrapper" style={{ backgroundColor: appMode === 'MANAGEMENT' ? '#f4f6f9' : '#003e9c', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      
      {/* ================================================================= */}
      {/* CHẾ ĐỘ 1: CỔNG QUẢN LÝ (ĐÃ XÓA SỔ QUỸ & BÁO CÁO -> CÒN 4 TAB) */}
      {/* ================================================================= */}
      {appMode === 'MANAGEMENT' ? (
        <div className="vh-100 d-flex flex-column overflow-hidden" style={{ backgroundColor: '#f4f6f9' }}>
          {/* Thanh điều hướng màu xanh chuẩn KiotViet */}
          <header className="px-4 d-flex justify-content-between align-items-center text-white shadow-sm" style={{ backgroundColor: '#0056b3', height: '50px', flexShrink: 0 }}>
            <div className="d-flex align-items-center gap-1 h-100">
              {[
                { id: 'OVERVIEW', label: 'Tổng quan', icon: Eye },
                { id: 'PRODUCTS', label: 'Hàng hóa', icon: Package },
                { id: 'TRANSACTIONS', label: 'Giao dịch', icon: ArrowLeftRight },
                { id: 'STAFF', label: 'Nhân viên', icon: Users }
              ].map(tab => {
                const IconComp = tab.icon;
                const isAct = mgmtTopTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMgmtTopTab(tab.id)}
                    className={`btn btn-sm h-100 rounded-0 px-3.5 fw-bold d-flex align-items-center gap-2 border-0 ${
                      isAct ? 'text-white' : 'text-white opacity-85 bg-transparent'
                    }`}
                    style={{
                      backgroundColor: isAct ? '#003e9c' : 'transparent',
                      borderBottom: isAct ? '3px solid #facc15' : 'none',
                      fontSize: '13.5px'
                    }}
                  >
                    <IconComp size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                onClick={() => setAppMode('POS')}
                className="btn btn-sm fw-bold text-white px-3.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5 shadow-xs"
                style={{ backgroundColor: '#003e9c', border: '1px solid rgba(255,255,255,0.28)', fontSize: '13px' }}
              >
                <ShoppingCart size={15} /> Bán hàng (POS)
              </button>
            </div>
          </header>

          {/* NỘI DUNG TỪNG TAB TRONG CỔNG QUẢN LÝ */}
          <div className="flex-grow-1 overflow-auto p-3">
            
            {/* ============================================================= */}
            {/* TAB 1: TỔNG QUAN (DASHBOARD GIỐNG HỆT ẢNH 3, DỮ LIỆU THẬT) */}
            {/* ============================================================= */}
            {mgmtTopTab === 'OVERVIEW' && (
              <div className="container-fluid px-2">
                {/* Thanh Tra soát doanh thu theo thời gian giống Ảnh 3 */}
                <div className="bg-white rounded-4 border p-3 mb-3 shadow-xs d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '44px', height: '44px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                      <Calendar size={22} />
                    </div>
                    <div>
                      <div className="fw-bolder text-dark" style={{ fontSize: '15px' }}>
                        Tra soát doanh thu: Ngày {displayDateLabel}
                      </div>
                      <small className="text-muted">Chọn nhanh mốc thời gian hoặc lọc theo khoảng ngày tùy ý</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-center flex-wrap gap-2">
                    <div className="btn-group">
                      {[
                        { id: 'TODAY', label: 'Hôm nay' },
                        { id: 'YESTERDAY', label: 'Hôm qua' },
                        { id: '7DAYS', label: '7 ngày qua' },
                        { id: 'ALL', label: 'Tất cả' }
                      ].map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectDatePreset(p.id)}
                          className={`btn btn-sm fw-bold px-3 py-1.5 ${
                            dateRangePreset === p.id ? 'btn-primary text-white' : 'btn-outline-secondary bg-white text-dark'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="d-flex align-items-center gap-2 bg-light border rounded-3 px-3 py-1">
                      <span className="small text-secondary fw-semibold">Từ:</span>
                      <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => { setCustomFromDate(e.target.value); setDateRangePreset('CUSTOM'); }}
                        className="form-control form-control-sm border-0 bg-transparent fw-bold p-0 shadow-none"
                        style={{ width: '115px' }}
                      />
                      <span className="small text-secondary fw-semibold ms-1">Đến:</span>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => { setCustomToDate(e.target.value); setDateRangePreset('CUSTOM'); }}
                        className="form-control form-control-sm border-0 bg-transparent fw-bold p-0 shadow-none"
                        style={{ width: '115px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4 THẺ KPI CÓ ĐƯỜNG CONG SPARKLINE GIỐNG HỆT ẢNH 3 */}
                <div className="row g-3 mb-3">
                  {/* Card 1: Doanh thu */}
                  <div className="col-md-6 col-xl-3">
                    <div className="bg-white rounded-4 border p-3.5 shadow-xs h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                          <DollarSign size={18} />
                        </div>
                        <span className="badge rounded-pill fw-bold px-2.5 py-1" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '11px' }}>
                          Ngày {displayDateLabel}
                        </span>
                      </div>

                      <svg viewBox="0 0 240 42" className="w-100 my-1" style={{ height: '38px' }}>
                        <path d="M 0 38 L 150 38 Q 200 38 240 8 L 240 42 L 0 42 Z" fill="rgba(37, 99, 235, 0.12)" />
                        <path d="M 0 38 L 150 38 Q 200 38 240 8" fill="none" stroke="#2563eb" strokeWidth="2.2" />
                      </svg>

                      <div>
                        <div className="fw-bolder text-dark" style={{ fontSize: '23px' }}>
                          {overviewDashboardData.totalRevenue.toLocaleString('vi-VN')}đ
                        </div>
                        <div className="text-muted small">Doanh thu ({displayDateLabel})</div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Số đơn hàng phát sinh */}
                  <div className="col-md-6 col-xl-3">
                    <div className="bg-white rounded-4 border p-3.5 shadow-xs h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px', backgroundColor: '#ecfdf5', color: '#059669' }}>
                          <ShoppingBag size={18} />
                        </div>
                        <span className="badge rounded-pill fw-bold px-2.5 py-1" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '11px' }}>
                          Theo ngày lọc
                        </span>
                      </div>

                      <svg viewBox="0 0 240 42" className="w-100 my-1" style={{ height: '38px' }}>
                        <path d="M 0 38 L 150 38 Q 200 38 240 8 L 240 42 L 0 42 Z" fill="rgba(16, 185, 129, 0.12)" />
                        <path d="M 0 38 L 150 38 Q 200 38 240 8" fill="none" stroke="#059669" strokeWidth="2.2" />
                      </svg>

                      <div>
                        <div className="fw-bolder text-dark" style={{ fontSize: '23px' }}>
                          {overviewDashboardData.validOrdersCount} đơn
                        </div>
                        <div className="text-muted small">Số đơn hàng phát sinh</div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Bàn đang phục vụ */}
                  <div className="col-md-6 col-xl-3">
                    <div className="bg-white rounded-4 border p-3.5 shadow-xs h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px', backgroundColor: '#fffbeb', color: '#d97706' }}>
                          <Armchair size={18} />
                        </div>
                        <span className="badge rounded-pill fw-bold px-2.5 py-1" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '11px' }}>
                          {tables.length > 0 ? Math.round((usedCount / tables.length) * 100) : 0}% công suất
                        </span>
                      </div>

                      <svg viewBox="0 0 240 42" className="w-100 my-1" style={{ height: '38px' }}>
                        <path d="M 0 38 L 150 38 Q 200 38 240 8 L 240 42 L 0 42 Z" fill="rgba(245, 158, 11, 0.14)" />
                        <path d="M 0 38 L 150 38 Q 200 38 240 8" fill="none" stroke="#f59e0b" strokeWidth="2.2" />
                      </svg>

                      <div>
                        <div className="fw-bolder text-dark" style={{ fontSize: '23px' }}>
                          {usedCount} / {tables.length} bàn
                        </div>
                        <div className="text-muted small">Bàn đang phục vụ (Hiện tại)</div>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Nhân sự hoạt động */}
                  <div className="col-md-6 col-xl-3">
                    <div className="bg-white rounded-4 border p-3.5 shadow-xs h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px', backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                          <UserCheck size={18} />
                        </div>
                        <span className="badge rounded-pill fw-bold px-2.5 py-1" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '11px' }}>
                          Đang mở
                        </span>
                      </div>

                      <svg viewBox="0 0 240 42" className="w-100 my-1" style={{ height: '38px' }}>
                        <path d="M 0 38 L 150 38 Q 200 38 240 8 L 240 42 L 0 42 Z" fill="rgba(124, 58, 237, 0.12)" />
                        <path d="M 0 38 L 150 38 Q 200 38 240 8" fill="none" stroke="#7c3aed" strokeWidth="2.2" />
                      </svg>

                      <div>
                        <div className="fw-bolder text-dark" style={{ fontSize: '23px' }}>
                          {realStaffList.length} tài khoản
                        </div>
                        <div className="text-muted small">Nhân sự hoạt động</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HÀNG DƯỚI: BIỂU ĐỒ TRÒN DONUT (DOANH THU THEO DANH MỤC) + BIỂU ĐỒ CỘT (DOANH THU TỪNG NGÀY) */}
                <div className="row g-3">
                  <div className="col-lg-4">
                    <div className="bg-white rounded-4 border p-4 shadow-xs h-100 d-flex flex-column justify-content-between">
                      <h6 className="fw-bolder text-dark mb-2">Doanh thu theo Danh mục</h6>

                      <div style={{ width: '100%', height: '210px' }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={overviewDashboardData.donutData.length > 0 ? overviewDashboardData.donutData : [{ name: 'Chưa có dữ liệu', value: 1 }]}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={82}
                              paddingAngle={3}
                            >
                              {(overviewDashboardData.donutData.length > 0 ? overviewDashboardData.donutData : [{ name: 'Chưa có', value: 1 }]).map((entry, idx) => (
                                <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val) => `${Number(val).toLocaleString()}đ`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="border-top pt-3 mt-2 d-flex flex-column gap-2">
                        {overviewDashboardData.donutData.map((cat, idx) => (
                          <div key={cat.name} className="d-flex justify-content-between align-items-center small">
                            <span className="d-flex align-items-center gap-2 text-secondary fw-semibold">
                              <span className="rounded-circle d-inline-block" style={{ width: '9px', height: '9px', backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span>
                              {cat.name}
                            </span>
                            <b className="text-dark">{cat.value.toLocaleString('vi-VN')}đ</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-8">
                    <div className="bg-white rounded-4 border p-4 shadow-xs h-100 d-flex flex-column">
                      <div className="mb-3">
                        <h6 className="fw-bolder text-dark mb-0">Biểu đồ Doanh thu theo từng ngày</h6>
                        <small className="text-muted">Ngày {displayDateLabel}</small>
                      </div>

                      <div className="flex-grow-1" style={{ minHeight: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overviewDashboardData.dailyBarData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              tickFormatter={(v) => `${v}k`}
                            />
                            <Tooltip formatter={(val) => [`${(Number(val) * 1000).toLocaleString()}đ`, 'Doanh thu']} />
                            <Bar dataKey="revenueK" fill="#0066ff" radius={[6, 6, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: HÀNG HÓA (ĐÃ SỬA CSS BO TRÒN KHÔNG TRÀN VIỀN + LỌC THỜI GIAN) */}
            {/* ============================================================= */}
            {mgmtTopTab === 'PRODUCTS' && (
              <div className="container-fluid px-2">
                <div className="bg-white rounded-4 border p-3 mb-3 shadow-xs d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <h5 className="fw-bolder text-dark mb-0">Hàng hóa</h5>
                    <div className="input-group input-group-sm" style={{ width: '320px' }}>
                      <span className="input-group-text bg-light border-end-0 rounded-start-3"><Search size={14} className="text-secondary" /></span>
                      <input
                        type="text"
                        value={mgmtSearch}
                        onChange={(e) => setMgmtSearch(e.target.value)}
                        placeholder="Theo mã, tên hàng..."
                        className="form-control bg-light border-start-0 rounded-end-3 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      onClick={fetchData}
                      className="btn btn-sm btn-success fw-bold px-3 py-1.5 rounded-3 d-flex align-items-center gap-1.5"
                    >
                      <RefreshCw size={14} /> Đồng bộ thực đơn
                    </button>
                    <button
                      onClick={handleExportProductsCSV}
                      className="btn btn-sm btn-success fw-bold px-3 py-1.5 rounded-3 d-flex align-items-center gap-1.5"
                    >
                      <Download size={14} /> Xuất file
                    </button>
                  </div>
                </div>

                <div className="row g-3">
                  {/* Sidebar trái: Đã sửa CSS bo tròn gọn trong khung, không bị tràn */}
                  <div className="col-lg-3 col-xl-2" style={{ minWidth: '240px' }}>
                    {/* Khối lọc Thời gian tra soát mới thêm */}
                    <div className="mgmt-filter-card mb-3">
                      <div className="mgmt-filter-title">
                        <span>Thời gian tra soát</span>
                        <Calendar size={14} className="text-primary" />
                      </div>
                      <div className="d-flex flex-column gap-1.5 mb-2">
                        {[
                          { id: 'TODAY', label: 'Hôm nay' },
                          { id: 'YESTERDAY', label: 'Hôm qua' },
                          { id: '7DAYS', label: '7 ngày qua' },
                          { id: 'ALL', label: 'Toàn thời gian' }
                        ].map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectDatePreset(p.id)}
                            className={`mgmt-category-btn ${dateRangePreset === p.id ? 'active' : ''}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="pt-2 border-top small">
                        <div className="text-muted mb-1" style={{ fontSize: '11px' }}>Từ ngày - Đến ngày:</div>
                        <input
                          type="date"
                          value={customFromDate}
                          onChange={(e) => { setCustomFromDate(e.target.value); setDateRangePreset('CUSTOM'); }}
                          className="form-control form-control-sm rounded-2 mb-1.5 fw-semibold"
                        />
                        <input
                          type="date"
                          value={customToDate}
                          onChange={(e) => { setCustomToDate(e.target.value); setDateRangePreset('CUSTOM'); }}
                          className="form-control form-control-sm rounded-2 fw-semibold"
                        />
                      </div>
                    </div>

                    {/* Khối lọc Nhóm hàng */}
                    <div className="mgmt-filter-card mb-3">
                      <div className="mgmt-filter-title">
                        <span>Nhóm hàng</span>
                        <ChevronDown size={14} />
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {categories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setMgmtCategoryFilter(cat)}
                            className={`mgmt-category-btn ${mgmtCategoryFilter === cat ? 'active' : ''}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Khối lọc Tồn kho / Trạng thái */}
                    <div className="mgmt-filter-card">
                      <div className="mgmt-filter-title">
                        <span>Tồn kho / Trạng thái</span>
                        <ChevronDown size={14} />
                      </div>
                      <div className="d-flex flex-column gap-2 small fw-semibold text-secondary">
                        <label className="d-flex align-items-center gap-2 cursor-pointer">
                          <input type="radio" checked={mgmtStockFilter === 'ALL'} onChange={() => setMgmtStockFilter('ALL')} className="form-check-input mt-0" />
                          <span>Tất cả ({menuItems.length})</span>
                        </label>
                        <label className="d-flex align-items-center gap-2 cursor-pointer">
                          <input type="radio" checked={mgmtStockFilter === 'AVAILABLE'} onChange={() => setMgmtStockFilter('AVAILABLE')} className="form-check-input mt-0" />
                          <span>Còn hàng trong kho ({menuItems.filter(p => !isProductUnavailable(p)).length})</span>
                        </label>
                        <label className="d-flex align-items-center gap-2 cursor-pointer">
                          <input type="radio" checked={mgmtStockFilter === 'OUT_OF_STOCK'} onChange={() => setMgmtStockFilter('OUT_OF_STOCK')} className="form-check-input mt-0" />
                          <span>Hết hàng trong kho ({menuItems.filter(p => isProductUnavailable(p)).length})</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Bảng dữ liệu Hàng hóa bo góc chuẩn, không tràn viền */}
                  <div className="col-lg col-xl">
                    <div className="mgmt-table-wrapper">
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '13.5px' }}>
                          <thead className="mgmt-table-head">
                            <tr>
                              <th style={{ width: '40px' }} className="ps-3"><input type="checkbox" className="form-check-input" /></th>
                              <th style={{ width: '36px' }}><Star size={14} className="text-secondary" /></th>
                              <th>Mã hàng</th>
                              <th>Tên hàng</th>
                              <th>Nhóm hàng</th>
                              <th className="text-end">Giá bán</th>
                              <th className="text-center">Khách đang đặt</th>
                              <th className="text-center">Đã bán ({displayDateLabel})</th>
                              <th className="text-end pe-3">Trạng thái phục vụ</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ backgroundColor: '#fffbeb', fontWeight: 800 }}>
                              <td colSpan={5} className="text-end text-secondary py-2.5">
                                Tổng cộng ({filteredMgmtProducts.length} mã hàng):
                              </td>
                              <td className="text-end text-dark py-2.5">
                                {filteredMgmtProducts.reduce((s, p) => s + Number(p.price || 0), 0).toLocaleString()}
                              </td>
                              <td className="text-center text-primary py-2.5">
                                {filteredMgmtProducts.reduce((s, p) => s + (realProductMetrics.activeOrderedByProduct[p.name] || 0), 0)}
                              </td>
                              <td className="text-center text-success py-2.5">
                                {filteredMgmtProducts.reduce((s, p) => s + (realProductMetrics.soldInShiftByProduct[p.name] || 0), 0)}
                              </td>
                              <td></td>
                            </tr>

                            {filteredMgmtProducts.map(prod => {
                              const code = prod.code || `SP${String(prod.id).padStart(6, '0')}`;
                              const unavail = isProductUnavailable(prod);
                              const activeOrdQty = realProductMetrics.activeOrderedByProduct[prod.name] || 0;
                              const soldQty = realProductMetrics.soldInShiftByProduct[prod.name] || 0;

                              return (
                                <tr key={prod.id}>
                                  <td className="ps-3"><input type="checkbox" className="form-check-input" /></td>
                                  <td><Star size={14} className="text-muted opacity-50" /></td>
                                  <td className="fw-bold text-primary">{code}</td>
                                  <td>
                                    <div className="d-flex align-items-center gap-2.5">
                                      <img
                                        src={getProductImageUrl(prod)}
                                        alt={prod.name}
                                        className="rounded-3 border object-fit-cover flex-shrink-0"
                                        style={{ width: '38px', height: '38px' }}
                                        onError={(e) => { e.target.src = 'https://placehold.co/60x60/e2e8f0/475569?text=SP'; }}
                                      />
                                      <span className={`fw-bold ${unavail ? 'text-danger text-decoration-line-through' : 'text-dark'}`}>
                                        {prod.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge bg-light text-secondary border rounded-pill px-2.5 py-1">
                                      {prod.category_name || prod.category || 'Món chính'}
                                    </span>
                                  </td>
                                  <td className="text-end fw-bold">{Number(prod.price || 0).toLocaleString()}</td>
                                  <td className="text-center fw-bold text-primary">{activeOrdQty}</td>
                                  <td className="text-center fw-bold text-success">{soldQty}</td>
                                  <td className="text-end pe-3">
                                    <button
                                      onClick={() => handleToggleProductAvailability(prod)}
                                      className={`btn btn-xs rounded-pill px-3 py-1 fw-bold ${
                                        unavail ? 'btn-danger text-white' : 'btn-outline-success'
                                      }`}
                                      style={{ fontSize: '12px' }}
                                    >
                                      {unavail ? 'Tạm hết (Mở lại)' : 'Còn hàng'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-3.5 py-2.5 border-top bg-light small text-muted">
                        Hiển thị 1 - {filteredMgmtProducts.length} / Tổng số {menuItems.length} mặt hàng thực tế
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 3: GIAO DỊCH (GIỐNG TRANG HÀNG HÓA • BẤM VÀO ĐƠN XỔ RA MÓN + NÚT IN LẠI) */}
            {/* ============================================================= */}
            {mgmtTopTab === 'TRANSACTIONS' && (
              <div className="container-fluid px-2">
                <div className="bg-white rounded-4 border p-3 mb-3 shadow-xs d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <h5 className="fw-bolder text-dark mb-0">Đơn giao dịch</h5>
                    <div className="input-group input-group-sm" style={{ width: '320px' }}>
                      <span className="input-group-text bg-light border-end-0 rounded-start-3"><Search size={14} className="text-secondary" /></span>
                      <input
                        type="text"
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        placeholder="Tìm theo mã đơn (ORD-...), tên bàn..."
                        className="form-control bg-light border-start-0 rounded-end-3 shadow-none"
                      />
                    </div>
                  </div>
                  <div className="text-muted small fw-semibold">
                    💡 Bấm trực tiếp vào một dòng đơn giao dịch để xem chi tiết các món ăn và in lại hóa đơn
                  </div>
                </div>

                <div className="row g-3">
                  {/* Sidebar lọc thời gian & trạng thái đơn bên trái */}
                  <div className="col-lg-3 col-xl-2" style={{ minWidth: '240px' }}>
                    <div className="mgmt-filter-card mb-3">
                      <div className="mgmt-filter-title">
                        <span>Thời gian giao dịch</span>
                        <Calendar size={14} className="text-primary" />
                      </div>
                      <div className="d-flex flex-column gap-1.5 mb-2">
                        {[
                          { id: 'TODAY', label: 'Hôm nay' },
                          { id: 'YESTERDAY', label: 'Hôm qua' },
                          { id: '7DAYS', label: '7 ngày qua' },
                          { id: 'ALL', label: 'Toàn thời gian' }
                        ].map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectDatePreset(p.id)}
                            className={`mgmt-category-btn ${dateRangePreset === p.id ? 'active' : ''}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="pt-2 border-top small">
                        <input
                          type="date"
                          value={customFromDate}
                          onChange={(e) => { setCustomFromDate(e.target.value); setDateRangePreset('CUSTOM'); }}
                          className="form-control form-control-sm rounded-2 mb-1.5 fw-semibold"
                        />
                        <input
                          type="date"
                          value={customToDate}
                          onChange={(e) => { setCustomToDate(e.target.value); setDateRangePreset('CUSTOM'); }}
                          className="form-control form-control-sm rounded-2 fw-semibold"
                        />
                      </div>
                    </div>

                    <div className="mgmt-filter-card">
                      <div className="mgmt-filter-title">
                        <span>Trạng thái đơn</span>
                        <ChevronDown size={14} />
                      </div>
                      <div className="d-flex flex-column gap-2 small fw-semibold text-secondary">
                        {[
                          { id: 'ALL', label: 'Tất cả đơn giao dịch' },
                          { id: 'SERVING', label: 'Đang phục vụ tại bàn' },
                          { id: 'COMPLETED', label: 'Đã hoàn thành / Đã thu' },
                          { id: 'CANCELLED', label: 'Đơn đã hủy' }
                        ].map(st => (
                          <label key={st.id} className="d-flex align-items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={txStatusFilter === st.id}
                              onChange={() => setTxStatusFilter(st.id)}
                              className="form-check-input mt-0"
                            />
                            <span>{st.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bảng Đơn Giao Dịch (Click vào dòng sẽ xổ ra danh sách món + nút In lại hóa đơn) */}
                  <div className="col-lg col-xl">
                    <div className="mgmt-table-wrapper">
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '13.5px' }}>
                          <thead className="mgmt-table-head">
                            <tr>
                              <th className="ps-3" style={{ width: '40px' }}></th>
                              <th>Mã giao dịch</th>
                              <th>Thời gian đặt</th>
                              <th>Bàn phục vụ</th>
                              <th>Mã phiên</th>
                              <th className="text-center">Số lượng món</th>
                              <th className="text-end">Tổng cộng</th>
                              <th className="text-end pe-3">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ backgroundColor: '#fffbeb', fontWeight: 800 }}>
                              <td colSpan={5} className="text-end text-secondary py-2.5">
                                Tổng cộng ({unifiedTransactionOrders.length} đơn giao dịch):
                              </td>
                              <td className="text-center text-primary py-2.5">
                                {unifiedTransactionOrders.reduce((s, t) => s + t.totalQty, 0)} món
                              </td>
                              <td className="text-end text-danger py-2.5">
                                {unifiedTransactionOrders.reduce((s, t) => s + t.totalAmount, 0).toLocaleString()}đ
                              </td>
                              <td></td>
                            </tr>

                            {unifiedTransactionOrders.map(tx => {
                              const isExpanded = expandedTxId === tx.txId;
                              return (
                                <React.Fragment key={tx.txId}>
                                  <tr
                                    onClick={() => setExpandedTxId(isExpanded ? null : tx.txId)}
                                    className="cursor-pointer"
                                    style={{ backgroundColor: isExpanded ? '#eff6ff' : 'transparent' }}
                                  >
                                    <td className="ps-3 text-center">
                                      <ChevronDown
                                        size={16}
                                        className="text-primary transition-all"
                                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                      />
                                    </td>
                                    <td className="fw-bolder text-primary">{tx.orderCode}</td>
                                    <td>{tx.createdAtText}</td>
                                    <td className="fw-bold text-dark">{tx.tableName}</td>
                                    <td>{tx.sessionCode}</td>
                                    <td className="text-center fw-bold">{tx.totalQty} phần</td>
                                    <td className="text-end fw-bolder text-dark">{tx.totalAmount.toLocaleString()}đ</td>
                                    <td className="text-end pe-3">
                                      <span className={`badge rounded-pill border px-2.5 py-1 ${tx.statusBadgeClass}`}>
                                        {tx.statusLabel}
                                      </span>
                                    </td>
                                  </tr>

                                  {/* DÒNG MỞ RỘNG HIỂN THỊ DANH SÁCH MÓN, TỔNG TIỀN & NÚT IN LẠI HÓA ĐƠN NGAY BÊN DƯỚI */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={8} className="p-0 border-0">
                                        <div className="p-3.5 border-bottom" style={{ backgroundColor: '#f8fafc' }}>
                                          <div className="bg-white rounded-3 border p-3 shadow-xs">
                                            <div className="d-flex justify-content-between align-items-center pb-2 mb-2.5 border-bottom">
                                              <div>
                                                <span className="fw-bolder text-dark me-2">
                                                  Chi tiết đơn giao dịch: <span className="text-primary">{tx.orderCode}</span> ({tx.tableName})
                                                </span>
                                                <span className="text-muted small">• Giờ tạo: {tx.createdAtText}</span>
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleReprintTransactionOrder(tx);
                                                }}
                                                className="btn btn-sm btn-primary fw-bold rounded-3 px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-xs"
                                              >
                                                <Printer size={15} /> In lại hóa đơn (K80)
                                              </button>
                                            </div>

                                            <table className="table table-sm align-middle mb-2 small">
                                              <thead className="table-light">
                                                <tr>
                                                  <th>STT</th>
                                                  <th>Tên món ăn / Đồ uống</th>
                                                  <th className="text-center">Số lượng</th>
                                                  <th className="text-end">Đơn giá</th>
                                                  <th className="text-end">Thành tiền</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(tx.items || []).map((it, idx) => {
                                                  const uPrice = Number(it.unit_price || it.price || 0);
                                                  const q = Number(it.quantity || 1);
                                                  return (
                                                    <tr key={idx}>
                                                      <td>{idx + 1}</td>
                                                      <td className="fw-bold text-dark">{it.product_name || it.name}</td>
                                                      <td className="text-center fw-bold text-primary">{q}</td>
                                                      <td className="text-end">{uPrice.toLocaleString()}đ</td>
                                                      <td className="text-end fw-bold">{(uPrice * q).toLocaleString()}đ</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>

                                            <div className="d-flex justify-content-end align-items-center gap-4 pt-2 border-top">
                                              <span className="small text-secondary">
                                                Tổng số món: <b className="text-dark">{tx.totalQty} phần</b>
                                              </span>
                                              <span className="fs-6 fw-bolder text-danger">
                                                Tổng tiền đơn: {tx.totalAmount.toLocaleString()}đ
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 4: NHÂN VIÊN (GIỐNG ẢNH 4 • MÃ NV, TÊN, VỊ TRÍ, NGÀY BẮT ĐẦU, SỐ NGÀY LÀM VIỆC & CHECKBOX LỌC) */}
            {/* ============================================================= */}
            {mgmtTopTab === 'STAFF' && (
              <div className="container-fluid px-2">
                <div className="bg-white rounded-4 border p-3 mb-3 shadow-xs d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <h5 className="fw-bolder text-dark mb-0">Bảng nhân sự & Chấm công hệ thống</h5>
                    <div className="input-group input-group-sm" style={{ width: '300px' }}>
                      <span className="input-group-text bg-light border-end-0 rounded-start-3"><Search size={14} className="text-secondary" /></span>
                      <input
                        type="text"
                        value={staffSearch}
                        onChange={(e) => setStaffSearch(e.target.value)}
                        placeholder="Tìm kiếm mã nhân viên, họ tên..."
                        className="form-control bg-light border-start-0 rounded-end-3 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary bg-opacity-10 text-primary fw-bold px-3 py-2 rounded-pill">
                      Tổng nhân sự: {filteredStaffMembers.length} nhân viên
                    </span>
                  </div>
                </div>

                <div className="row g-3">
                  {/* Cột trái: Checkbox lọc theo Vị trí công việc */}
                  <div className="col-lg-3 col-xl-2" style={{ minWidth: '240px' }}>
                    <div className="mgmt-filter-card">
                      <div className="mgmt-filter-title">
                        <span>Lọc theo Vị trí làm việc</span>
                        <ChevronDown size={14} />
                      </div>
                      <div className="d-flex flex-column gap-2.5 small fw-semibold text-secondary">
                        {distinctStaffPositions.map(pos => {
                          const isChecked = selectedPositions.includes(pos);
                          return (
                            <label key={pos} className="d-flex align-items-center gap-2 cursor-pointer text-dark">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPositions([...selectedPositions, pos]);
                                  } else {
                                    setSelectedPositions(selectedPositions.filter(p => p !== pos));
                                  }
                                }}
                                className="form-check-input mt-0"
                              />
                              <span>{pos}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Bảng Nhân viên bên phải chuẩn Ảnh 4 */}
                  <div className="col-lg col-xl">
                    <div className="mgmt-table-wrapper">
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '13.5px' }}>
                          <thead className="mgmt-table-head">
                            <tr>
                              <th className="ps-3" style={{ width: '42px' }}>
                                <input
                                  type="checkbox"
                                  checked={checkedStaffIds.length > 0 && checkedStaffIds.length === filteredStaffMembers.length}
                                  onChange={(e) => {
                                    if (e.target.checked) setCheckedStaffIds(filteredStaffMembers.map(s => s.id));
                                    else setCheckedStaffIds([]);
                                  }}
                                  className="form-check-input"
                                />
                              </th>
                              <th>Mã nhân viên</th>
                              <th>Họ và tên</th>
                              <th>Vị trí làm việc</th>
                              <th>Ngày bắt đầu làm</th>
                              <th className="text-center">Số ngày làm việc</th>
                              <th className="text-end pe-3">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStaffMembers.map((st, idx) => {
                              const code = st.staff_code || `NV00${st.id}`;
                              const initials = (st.full_name || 'NV')
                                .split(' ')
                                .map(w => w[0])
                                .join('')
                                .slice(-2)
                                .toUpperCase();
                              const avatarBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                              const startDateText = st.start_date || '01/10/2026';
                              const workDaysCount = st.working_days || 45;

                              return (
                                <tr key={st.id}>
                                  <td className="ps-3">
                                    <input
                                      type="checkbox"
                                      checked={checkedStaffIds.includes(st.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) setCheckedStaffIds([...checkedStaffIds, st.id]);
                                        else setCheckedStaffIds(checkedStaffIds.filter(id => id !== st.id));
                                      }}
                                      className="form-check-input"
                                    />
                                  </td>
                                  <td className="fw-bolder text-secondary">{code}</td>
                                  <td>
                                    <div className="d-flex align-items-center gap-2.5">
                                      <div
                                        className="rounded-circle text-white fw-bolder d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: '32px', height: '32px', backgroundColor: avatarBg, fontSize: '12px' }}
                                      >
                                        {initials}
                                      </div>
                                      <span className="fw-bold text-dark">{st.full_name}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="fw-semibold text-dark">{st.position || st.role}</span>
                                  </td>
                                  <td>{startDateText}</td>
                                  <td className="text-center">
                                    <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary fw-bold px-3 py-1">
                                      {workDaysCount} ngày
                                    </span>
                                  </td>
                                  <td className="text-end pe-3">
                                    <span className="badge rounded-pill bg-success bg-opacity-10 text-success fw-bold px-2.5 py-1">
                                      ● Đang làm việc
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      ) : (
        /* ================================================================= */
        /* CHẾ ĐỘ 2: MÀN HÌNH BÁN HÀNG THU NGÂN (POS) */
        /* ================================================================= */
        <>
          <header className="px-2 pt-1.5 d-flex justify-content-between align-items-end text-white" style={{ backgroundColor: '#003e9c', height: '46px' }}>
            <div className="d-flex align-items-end gap-1 h-100">
              <button onClick={() => setLeftTab('TABLES')} className={`kv-tab ${leftTab === 'TABLES' ? 'active' : ''}`}>
                <LayoutGrid size={15} /> Phòng bàn
                {(callingCount > 0 || staffCancelRequests.length > 0) && (
                  <span className="badge rounded-pill bg-danger text-white ms-1 pulse-badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
                    {callingCount + staffCancelRequests.length}
                  </span>
                )}
              </button>

              <button onClick={() => setLeftTab('MENU')} className={`kv-tab ${leftTab === 'MENU' ? 'active' : ''}`}>
                <Utensils size={15} /> Thực đơn
              </button>

              <div className="ms-2 mb-1.5 d-none d-xl-flex align-items-center rounded-pill px-3" style={{ width: '250px', height: '30px', backgroundColor: 'rgba(255,255,255,0.16)' }}>
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

            <div className="d-flex align-items-end gap-2 h-100">
              <div className="d-flex align-items-center gap-2 mb-1.5">
                <button
                  onClick={() => setShowShiftModal(true)}
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

                <div ref={dropdownRef} className="d-flex align-items-center gap-1.5 ps-2 border-start border-white border-opacity-25 position-relative">
                  <div
                    onClick={() => setShowMenuDropdown(!showMenuDropdown)}
                    className="d-flex align-items-center gap-1.5 cursor-pointer px-2 py-1 rounded-2 kv-user-trigger"
                  >
                    <span className="fw-bold d-none d-sm-inline" style={{ fontSize: '13px' }}>
                      {staffName}
                    </span>
                    <Menu size={19} />
                  </div>

                  {showMenuDropdown && (
                    <div className="kv-pro-dropdown">
                      <div className="kv-dropdown-user-header">
                        <div className="kv-user-avatar">
                          {staffName.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="fw-bolder text-dark text-truncate" style={{ fontSize: '14.5px' }}>{staffName}</div>
                          <div className="d-flex align-items-center gap-1.5 mt-0.5">
                            <span className="badge bg-primary bg-opacity-10 text-primary fw-bold" style={{ fontSize: '10.5px' }}>
                              {staffRole === 'admin' ? 'Quản trị viên' : 'Thu ngân (Cashier)'}
                            </span>
                            <span className="text-success fw-bold" style={{ fontSize: '11px' }}>● Online</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 d-flex flex-column gap-1">
                        <button
                          onClick={() => {
                            setAppMode('MANAGEMENT');
                            setMgmtTopTab('OVERVIEW');
                            setShowMenuDropdown(false);
                          }}
                          className="kv-dropdown-item"
                        >
                          <div className="kv-item-icon bg-primary bg-opacity-10 text-primary">
                            <BarChart3 size={17} />
                          </div>
                          <div className="flex-grow-1 text-start">
                            <div className="fw-bolder text-dark">Quản lý</div>
                            <small className="text-muted">Tổng quan, Hàng hóa, Giao dịch & Nhân viên</small>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowShiftModal(true);
                            setShowMenuDropdown(false);
                          }}
                          className="kv-dropdown-item"
                        >
                          <div className="kv-item-icon bg-success bg-opacity-10 text-success">
                            <Wallet size={17} />
                          </div>
                          <div className="flex-grow-1 text-start">
                            <div className="fw-bolder text-dark">Mở / Kết ca làm việc</div>
                            <small className="text-muted">Đối soát tiền mặt & Bàn giao ca</small>
                          </div>
                        </button>

                        <div className="kv-dropdown-divider"></div>

                        <button
                          onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
                          className="kv-dropdown-item text-danger"
                        >
                          <div className="kv-item-icon bg-danger bg-opacity-10 text-danger">
                            <LogOut size={17} />
                          </div>
                          <div className="fw-bolder">Đăng xuất tài khoản</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* WORKSPACE 2 CỘT */}
          <div className="flex-grow-1 px-2 pb-1 row g-2 overflow-hidden m-0">
            
            {/* CỘT TRÁI */}
            <div className="col-md-7 col-lg-8 h-100 d-flex flex-column">
              <div className="shadow-sm flex-grow-1 d-flex flex-column overflow-hidden" style={{ backgroundColor: '#f1f5f9', borderRadius: '0 14px 14px 14px' }}>
                
                {staffCancelRequests.length > 0 && (
                  <div className="p-2.5 bg-danger text-white d-flex flex-column gap-1.5">
                    {staffCancelRequests.map((req, idx) => (
                      <div key={idx} className="d-flex justify-content-between align-items-center bg-white text-dark px-3 py-2 rounded-3 shadow-sm">
                        <div className="small">
                          <span className="badge bg-danger me-2">{req.table_name}</span>
                          Nhân viên <b>{req.staff_name}</b> báo khách hủy món hết: <b className="text-danger">{req.quantity}x {req.product_name}</b> ({req.order_code})
                        </div>
                        <button
                          onClick={() => handleApproveStaffCancelRequest(req)}
                          className="btn btn-sm btn-danger fw-bold rounded-pill px-3 flex-shrink-0"
                        >
                          <Trash2 size={13} className="me-1" /> Xác nhận xóa món
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 1: PHÒNG BÀN (CỤM FILTER TO NGANG BÀN 06 BÊN PHẢI & LƯỚI 6 Ô VUÔNG VỨC LẤP ĐẦY KHOẢNG TRẮNG) */}
                {leftTab === 'TABLES' && (
                  <>
                    <div className="px-3 py-2.5 bg-white border-bottom">
                      {floors.length > 1 && (
                        <div className="d-flex gap-1.5 overflow-auto mb-2">
                          <button
                            onClick={() => { setSelectedFloor('ALL'); setCurrentPage(1); }}
                            className="btn btn-sm rounded-pill px-3 py-1 fw-bold border-0"
                            style={{
                              backgroundColor: selectedFloor === 'ALL' ? '#003e9c' : '#f1f5f9',
                              color: selectedFloor === 'ALL' ? '#ffffff' : '#475569',
                              fontSize: '12px'
                            }}
                          >
                            Tất cả khu vực
                          </button>
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
                              {fl}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* CỤM FILTER ĐƯỢC LÀM TO NGANG BẰNG NÚT "BÀN 06 ×" BÊN PHẢI */}
                      <div className="d-flex align-items-center flex-wrap gap-2.5">
                        <label
                          onClick={() => { setStatusRadio('ALL'); setCurrentPage(1); }}
                          className={`pos-filter-pill ${statusRadio === 'ALL' ? 'active-all' : ''}`}
                        >
                          <input type="radio" checked={statusRadio === 'ALL'} readOnly className="form-check-input mt-0 me-1.5" />
                          <span>Tất cả ({tables.length})</span>
                        </label>

                        <label
                          onClick={() => { setStatusRadio('USED'); setCurrentPage(1); }}
                          className={`pos-filter-pill ${statusRadio === 'USED' ? 'active-used' : ''}`}
                        >
                          <input type="radio" checked={statusRadio === 'USED'} readOnly className="form-check-input mt-0 me-1.5" />
                          <span>Đang phục vụ ({usedCount})</span>
                        </label>

                        <label
                          onClick={() => { setStatusRadio('EMPTY'); setCurrentPage(1); }}
                          className={`pos-filter-pill ${statusRadio === 'EMPTY' ? 'active-empty' : ''}`}
                        >
                          <input type="radio" checked={statusRadio === 'EMPTY'} readOnly className="form-check-input mt-0 me-1.5" />
                          <span>Còn trống ({emptyCount})</span>
                        </label>

                        <label
                          onClick={() => { setStatusRadio('CALLING'); setCurrentPage(1); }}
                          className={`pos-filter-pill text-danger ${statusRadio === 'CALLING' ? 'active-calling' : ''}`}
                        >
                          <input type="radio" checked={statusRadio === 'CALLING'} readOnly className="form-check-input mt-0 me-1.5" />
                          <span>Yêu cầu thanh toán / Gọi NV</span>
                          <span className={`badge rounded-pill ms-1.5 ${callingCount > 0 ? 'bg-danger text-white pulse-badge' : 'bg-secondary bg-opacity-50 text-white'}`} style={{ fontSize: '12px' }}>
                            {callingCount}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* LƯỚI 6 CỘT × 4 HÀNG TỰ GIÃN ĐỀU LẤP ĐẦY KHOẢNG TRẮNG DƯỚI ĐÁY, Ô VUÔNG VỨC & CHỮ TO */}
                    <div className="p-3 flex-grow-1 overflow-auto d-flex flex-column">
                      <div className="kv-24-grid flex-grow-1">
                        {paginatedGridItems.map(item => {
                          if (item.isSpecial) {
                            const isDelivery = item.type === 'DELIVERY';
                            return (
                              <div
                                key={item.id}
                                onClick={() => setLeftTab('MENU')}
                                className="kv-table-card"
                                style={{ backgroundColor: isDelivery ? '#7ea6e0' : '#e2e8f0' }}
                              >
                                <div
                                  className="rounded-4 d-flex align-items-center justify-content-center mb-2"
                                  style={{
                                    width: '62px',
                                    height: '62px',
                                    backgroundColor: isDelivery ? '#003e9c' : '#cbd5e1',
                                    color: isDelivery ? '#ffffff' : '#334155'
                                  }}
                                >
                                  {isDelivery ? <Bike size={32} /> : <ShoppingBag size={30} />}
                                </div>
                                <span className="fw-bolder" style={{ fontSize: '15px', color: isDelivery ? '#0f172a' : '#334155' }}>
                                  {item.label}
                                </span>
                              </div>
                            );
                          }

                          const t = item;
                          const summary = getTableSummary(t);
                          const isOccupied = ['occupied', 'busy', 'payment_pending'].includes(t.status) || summary.hasOrder;
                          const isSelected = selectedTable?.id === t.id;
                          const calling = isTableCalling(t);

                          let cardBg = '#ffffff';
                          let labelColor = '#1e293b';
                          let strokeColor = '#475569';
                          let innerTextColor = '#0f172a';

                          if (calling) {
                            cardBg = '#fff1f2';
                            labelColor = '#be123c';
                            strokeColor = '#e11d48';
                            innerTextColor = '#be123c';
                          } else if (isSelected) {
                            cardBg = '#002b73';
                            labelColor = '#ffffff';
                            strokeColor = '#93c5fd';
                            innerTextColor = '#ffffff';
                          } else if (isOccupied) {
                            cardBg = '#7ea6e0';
                            labelColor = '#0f172a';
                            strokeColor = '#1e3a8a';
                            innerTextColor = '#0f172a';
                          }

                          return (
                            <div
                              key={t.id}
                              onClick={() => handleSelectTable(t)}
                              className={`kv-table-card position-relative ${isSelected ? 'shadow-md' : 'shadow-xs'} ${calling ? 'kv-calling-card' : ''}`}
                              style={{ backgroundColor: cardBg }}
                            >
                              {calling && (
                                <div className="position-absolute top-0 start-0 end-0 d-flex justify-content-between align-items-center px-2 pt-1" style={{ zIndex: 3 }}>
                                  <span className="badge bg-danger text-white d-flex align-items-center gap-1" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                    <Bell size={10} /> {getCallReason(t)}
                                  </span>
                                  <button
                                    onClick={(e) => handleResolveAlert(e, t)}
                                    className="btn btn-xs bg-white text-success border border-success fw-bold rounded-pill px-1.5 py-0"
                                    style={{ fontSize: '10px', lineHeight: '15px' }}
                                  >
                                    <Check size={10} /> Xong
                                  </button>
                                </div>
                              )}

                              {/* HÌNH BÀN LỚN HƠN & CHỮ BÊN TRONG TO RÕ HƠN */}
                              <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '132px', height: '78px' }}>
                                <svg width="132" height="78" viewBox="0 0 132 78" fill="none" className="position-absolute top-0 start-0">
                                  <rect x="28" y="2" width="26" height="4.5" rx="2.2" fill={strokeColor} opacity="0.72" />
                                  <rect x="78" y="2" width="26" height="4.5" rx="2.2" fill={strokeColor} opacity="0.72" />
                                  <rect x="4" y="9" width="124" height="60" rx="13" stroke={strokeColor} strokeWidth="2.3" fill={isSelected ? 'rgba(255,255,255,0.08)' : 'transparent'} />
                                  <rect x="28" y="71.5" width="26" height="4.5" rx="2.2" fill={strokeColor} opacity="0.72" />
                                  <rect x="78" y="71.5" width="26" height="4.5" rx="2.2" fill={strokeColor} opacity="0.72" />
                                </svg>

                                {isOccupied && (
                                  <div
                                    className="position-relative z-1 w-100 d-flex flex-column justify-content-center"
                                    style={{ color: innerTextColor, padding: '0 12px', lineHeight: '1.3' }}
                                  >
                                    <div className="d-flex justify-content-between align-items-center fw-bolder" style={{ fontSize: '12px' }}>
                                      <span>{summary.total > 0 ? summary.total.toLocaleString() : '0'}</span>
                                      <span style={{ fontSize: '10.5px', opacity: 0.92 }}>{summary.durationText}</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mt-1.5 fw-bold" style={{ fontSize: '11.5px', opacity: 0.95 }}>
                                      <span className="d-flex align-items-center gap-1">
                                        <Utensils size={11} /> {summary.itemCount}
                                      </span>
                                      {summary.startClock && <span style={{ fontSize: '10.5px' }}>{summary.startClock}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="fw-bolder mt-1.5 text-center text-truncate w-100" style={{ fontSize: '15px', color: labelColor }}>
                                {t.table_number}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="px-3 py-2 border-top bg-white d-flex justify-content-between align-items-center" style={{ fontSize: '13px' }}>
                      <label className="d-flex align-items-center gap-2 cursor-pointer mb-0 text-secondary fw-semibold">
                        <input
                          type="checkbox"
                          checked={openMenuOnSelect}
                          onChange={(e) => setOpenMenuOnSelect(e.target.checked)}
                          className="form-check-input mt-0"
                        />
                        <span>Mở thực đơn khi chọn bàn</span>
                      </label>

                      <div className="d-flex align-items-center gap-2 text-dark fw-bold">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="btn btn-sm p-1 border-0 text-secondary">
                          <ChevronLeft size={16} />
                        </button>
                        <span>{safePage}/{totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="btn btn-sm p-1 border-0 text-secondary">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: THỰC ĐƠN CỦA THU NGÂN */}
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
                      <div className="cashier-square-menu-grid">
                        {filteredMenu.map(item => {
                          const unavailable = isProductUnavailable(item);
                          const inDraftQty = currentDraftItems.find(d => d.product_id === item.id || d.name === item.name)?.quantity || 0;

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleAddMenuItemToTable(item)}
                              className={`square-menu-card bg-white shadow-xs position-relative ${
                                unavailable ? 'cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              style={{ opacity: unavailable ? 0.52 : 1 }}
                            >
                              {inDraftQty > 0 && (
                                <span
                                  className="position-absolute top-0 start-0 m-1.5 badge rounded-pill bg-warning text-dark fw-bolder shadow-sm"
                                  style={{ zIndex: 2, fontSize: '11px' }}
                                >
                                  Nháp: +{inDraftQty}
                                </span>
                              )}

                              <div className="square-img-box">
                                <img
                                  src={getProductImageUrl(item)}
                                  alt={item.name}
                                  className="w-100 h-100 object-fit-cover"
                                  style={{ filter: unavailable ? 'grayscale(70%)' : 'none' }}
                                  onError={(e) => { e.target.src = 'https://placehold.co/300x300/e2e8f0/475569?text=Mon+An'; }}
                                />
                                {unavailable && (
                                  <div
                                    className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
                                  >
                                    <span className="badge bg-danger text-white fw-bold px-2 py-1">TẠM HẾT</span>
                                  </div>
                                )}
                                <span
                                  className="position-absolute bottom-0 end-0 m-1 badge text-white fw-bold"
                                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', fontSize: '11px' }}
                                >
                                  {Number(item.price).toLocaleString()}đ
                                </span>
                              </div>

                              <div className="p-2 text-center">
                                <div
                                  className={`fw-bold text-truncate ${unavailable ? 'text-danger text-decoration-line-through' : 'text-dark'}`}
                                  style={{ fontSize: '12.5px' }}
                                  title={item.name}
                                >
                                  {item.name}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* CỘT PHẢI: CHI TIẾT PHIÊN BÀN */}
            <div className="col-md-5 col-lg-4 h-100 d-flex flex-column">
              <div className="bg-white rounded-4 shadow-sm flex-grow-1 d-flex flex-column overflow-hidden">
                
                <div className="px-3 py-2.5 border-bottom bg-white">
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div className="d-flex align-items-center gap-2">
                      {selectedTable ? (
                        <div
                          className="badge rounded-pill px-3.5 py-2 fw-bolder d-inline-flex align-items-center gap-2"
                          style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '14.5px' }}
                        >
                          <LayoutGrid size={16} />
                          <span>{selectedTable.table_number}</span>
                          <span
                            onClick={handleClearSelectedTable}
                            className="rounded-circle d-inline-flex align-items-center justify-content-center cursor-pointer ms-1"
                            style={{ width: '20px', height: '20px', backgroundColor: 'rgba(30, 64, 175, 0.15)' }}
                            title="Đóng / Bỏ chọn bàn này"
                          >
                            <X size={13} />
                          </span>
                        </div>
                      ) : (
                        <span className="badge rounded-pill px-3.5 py-2 fw-bold bg-light text-secondary border" style={{ fontSize: '14px' }}>
                          Chưa chọn bàn
                        </span>
                      )}
                    </div>

                    {selectedTable && (
                      <button
                        onClick={() => setShowCancelTableModal(true)}
                        className="btn btn-xs btn-outline-danger rounded-pill px-3 py-1.5 fw-bold d-flex align-items-center gap-1"
                        style={{ fontSize: '12.5px' }}
                      >
                        <Ban size={13} /> Hủy / Đóng bàn
                      </button>
                    )}
                  </div>

                  {selectedTable && (
                    <div className="mt-2 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center flex-wrap gap-2">
                        <span className="session-info-pill">
                          Phiên: <b className="text-dark">{currentSessionInfo?.sessionCode}</b>
                        </span>

                        <span className="session-time-pill">
                          <Clock size={15} className="text-primary flex-shrink-0" />
                          <span>Giờ vào:</span>
                          <b className="text-primary">{currentSessionInfo?.startTimeText}</b>
                        </span>

                        <span className="session-duration-pill">
                          {currentSessionInfo?.durationLabel}
                        </span>
                      </div>

                      {currentDraftItems.length > 0 && (
                        <span className="badge bg-warning text-dark fw-bolder px-2.5 py-1.5" style={{ fontSize: '12px' }}>
                          {currentDraftItems.length} món nháp chờ F10
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* DANH SÁCH MÓN TRONG HÓA ĐƠN */}
                <div className="flex-grow-1 overflow-auto px-3 py-2 bg-white">
                  {!selectedTable ? (
                    <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted text-center">
                      <ShoppingBag size={46} className="mb-2 opacity-20" />
                      <h6 className="fw-bold text-dark">Chưa chọn bàn</h6>
                      <p className="small px-4 mb-0">Bấm chọn một bàn bên trái để xem chi tiết phiên bàn hoặc gọi món hộ khách.</p>
                    </div>
                  ) : flattenedBillItems.length === 0 ? (
                    <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted text-center">
                      <Utensils size={42} className="mb-2 opacity-25 text-primary" />
                      <h6 className="fw-bold text-dark">{selectedTable.table_number} chưa gọi món</h6>
                      <div className="d-flex gap-2 mt-2">
                        <button onClick={() => setLeftTab('MENU')} className="btn btn-sm text-white rounded-pill px-3.5 fw-bold" style={{ backgroundColor: '#003e9c' }}>
                          + Chọn món hộ khách
                        </button>
                        <button
                          onClick={() => setShowCancelTableModal(true)}
                          className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                        >
                          <Trash2 size={14} /> Đóng bàn
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex flex-column">
                      {flattenedBillItems.map((item, idx) => {
                        const unitPrice = Number(item.unit_price || item.price || 0);
                        const qty = Number(item.quantity || 1);
                        const isOut = item.kitchen_status === 'out_of_stock';
                        const lineTotal = isOut ? 0 : unitPrice * qty;
                        const badge = getKitchenStatusBadge(item);

                        return (
                          <div
                            key={`${item.order_id || 'draft'}-${item.id || idx}`}
                            className={`py-3 border-bottom d-flex align-items-center justify-content-between gap-2 ${
                              isOut
                                ? 'bg-danger bg-opacity-10 px-2.5 rounded-3 my-1 border border-danger'
                                : item.isDraft
                                ? 'bg-warning bg-opacity-10 px-2.5 rounded-3 my-1 border border-warning'
                                : ''
                            }`}
                          >
                            <div className="d-flex align-items-start gap-2.5 flex-grow-1" style={{ minWidth: 0 }}>
                              <button
                                onClick={() => handleCancelItem(item)}
                                className="btn btn-sm text-danger p-0 mt-1 flex-shrink-0"
                                title="Xóa món"
                              >
                                <Trash2 size={17} />
                              </button>
                              <div style={{ minWidth: 0 }}>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span
                                    className={`fw-bolder ${isOut ? 'text-danger text-decoration-line-through' : 'text-dark'}`}
                                    style={{ fontSize: '15.5px', lineHeight: '1.3' }}
                                  >
                                    {idx + 1}. {item.product_name || item.name}
                                  </span>
                                  <span
                                    className="badge rounded-pill fw-bold"
                                    style={{ backgroundColor: badge.bg, color: badge.color, fontSize: '11px', padding: '3px 8px' }}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                                <div className="text-secondary mt-1" style={{ fontSize: '12.5px' }}>
                                  {item.note ? `Ghi chú: ${item.note}` : `Đơn giá: ${unitPrice.toLocaleString()}đ`}
                                </div>
                              </div>
                            </div>

                            <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleUpdateItemQty(item, -1)}
                                className="btn btn-xs btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center"
                                style={{ width: '28px', height: '28px' }}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="fw-bolder text-dark text-center" style={{ width: '26px', fontSize: '15.5px' }}>
                                {qty}
                              </span>
                              <button
                                onClick={() => handleUpdateItemQty(item, 1)}
                                disabled={isOut}
                                className="btn btn-xs btn-outline-primary rounded-circle p-0 d-flex align-items-center justify-content-center"
                                style={{ width: '28px', height: '28px' }}
                                title={item.isDraft ? 'Tăng số lượng nháp' : 'Thêm 1 phần vào giỏ Lưu nháp (Chờ bấm F10)'}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <div className="text-end flex-shrink-0" style={{ minWidth: '92px' }}>
                              <div className="text-muted" style={{ fontSize: '12px' }}>{unitPrice.toLocaleString()}</div>
                              <div className={`fw-bolder ${isOut ? 'text-danger' : 'text-dark'}`} style={{ fontSize: '16px' }}>
                                {isOut ? '0 (Hết)' : lineTotal.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* FOOTER HÓA ĐƠN */}
                <div className="p-3 bg-white border-top">
                  {discountAmount > 0 && (
                    <div className="d-flex justify-content-between align-items-center mb-2 px-2.5 py-1.5 rounded-3 bg-success bg-opacity-10 text-success small fw-bold">
                      <span>
                        Đã áp dụng giảm giá {discountType === 'PERCENT' ? `(${discountValue}%)` : ''}:
                      </span>
                      <span>-{discountAmount.toLocaleString()}đ</span>
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center mb-2.5 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-1.5">
                      <span className="badge bg-light text-dark border px-2.5 py-1.5 rounded-pill fw-semibold" style={{ fontSize: '11.5px' }}>
                        <User size={12} className="me-1" /> {staffName}
                      </span>
                      <button
                        onClick={() => setLeftTab('MENU')}
                        disabled={!selectedTable}
                        className="btn btn-sm bg-light border rounded-pill px-3 py-1 fw-bold text-primary"
                        style={{ fontSize: '12px' }}
                      >
                        + Thêm món
                      </button>
                      <button
                        onClick={() => setShowDiscountModal(true)}
                        disabled={!selectedTable || subTotalAmount <= 0}
                        className={`btn btn-sm rounded-pill px-3 py-1 fw-bold ${
                          discountAmount > 0 ? 'btn-success text-white' : 'bg-light border text-success'
                        }`}
                        style={{ fontSize: '12px' }}
                      >
                        <Percent size={12} className="me-1" />
                        {discountAmount > 0 ? `Giảm: -${discountAmount.toLocaleString()}đ` : 'Giảm giá'}
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small fw-semibold">Tổng tiền</span>
                      <span className="badge rounded-pill px-2.5 py-1 text-white" style={{ backgroundColor: '#1d4ed8', fontSize: '12px' }}>
                        {currentBillQty}
                      </span>
                      <span className="fs-4 fw-bolder text-danger">{currentBillTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-4">
                      <button
                        onClick={handleNotifyKitchenForTable}
                        disabled={!selectedTable || sendingToKitchen}
                        className={`btn w-100 py-2.5 fw-bold rounded-3 d-flex align-items-center justify-content-center gap-1.5 ${
                          needsKitchenNotify ? 'btn-warning text-dark shadow-sm border-warning' : 'bg-light text-dark border'
                        }`}
                        style={{ fontSize: '12.5px' }}
                      >
                        <Send size={14} />
                        <span>
                          {sendingToKitchen
                            ? 'Đang gửi...'
                            : `Thông báo (F10)${currentDraftItems.length > 0 ? ` (${currentDraftItems.reduce((s, d) => s + d.quantity, 0)})` : ''}`}
                        </span>
                      </button>
                    </div>

                    <div className="col-4">
                      <button
                        onClick={() => handleOpenReceiptPreview('PROVISIONAL')}
                        disabled={!selectedTable || flattenedBillItems.length === 0}
                        className="btn w-100 py-2.5 fw-bold rounded-3 d-flex align-items-center justify-content-center gap-1.5"
                        style={{ backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', fontSize: '12.5px' }}
                      >
                        <Printer size={15} /> In tạm tính
                      </button>
                    </div>

                    <div className="col-4">
                      <button
                        onClick={handleInitiateCheckout}
                        disabled={!selectedTable || currentBillTotal <= 0}
                        className="btn w-100 py-2.5 fw-bold text-white rounded-3 d-flex align-items-center justify-content-center gap-1.5 border-0 shadow-sm"
                        style={{ backgroundColor: '#003e9c', fontSize: '13px' }}
                      >
                        <DollarSign size={16} /> Thanh toán (F9)
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          <footer className="px-3 py-1 text-white d-flex justify-content-center align-items-center gap-4" style={{ backgroundColor: '#003e9c', fontSize: '11.5px' }}>
            <span className="d-flex align-items-center gap-1 opacity-90"><Phone size={12} /> Hỗ trợ 1900 6522</span>
            <span className="d-flex align-items-center gap-1 opacity-90"><MapPin size={12} /> Chi nhánh trung tâm</span>
            <span className="d-flex align-items-center gap-1 opacity-90"><Keyboard size={12} /> Phím tắt (F3 / F9 / F10)</span>
            <span className="px-2.5 py-0.5 rounded-pill fw-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
              Khổ in: {deviceSettings.paperSize} • Phiên bản 2.19.0
            </span>
          </footer>
        </>
      )}

      {/* MODAL MỞ / KẾT CA LÀM VIỆC */}
      {showShiftModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 3400 }} onClick={() => setShowShiftModal(false)}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: '#003e9c' }}>
                <div>
                  <h5 className="modal-title fw-bolder mb-0 d-flex align-items-center gap-2">
                    <Wallet size={20} />
                    <span>{isShiftOpen ? 'Đối Soát & Kết Ca Làm Việc' : 'Mở Ca Làm Việc Mới'}</span>
                  </h5>
                  <small className="text-white-50">
                    Mã ca: {shiftInfo.shift_code} • Nhân viên trực: {staffName}
                  </small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowShiftModal(false)} />
              </div>

              {!isShiftOpen ? (
                <form onSubmit={handleOpenShiftSubmit}>
                  <div className="modal-body p-4">
                    <div className="p-3 rounded-3 bg-light border mb-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="small text-secondary">Nhân viên nhận ca:</div>
                        <div className="fw-bolder text-dark fs-6">{staffName}</div>
                      </div>
                      <div className="text-end">
                        <div className="small text-secondary">Giờ mở ca:</div>
                        <div className="fw-bold text-primary">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>

                    <label className="form-label fw-bold small text-dark">Tiền mặt đầu ca trong két (VNĐ):</label>
                    <input
                      type="number"
                      required
                      value={startingCash}
                      onChange={(e) => setStartingCash(Number(e.target.value))}
                      className="form-control form-control-lg fw-bolder text-primary text-end mb-2"
                    />
                    <div className="d-flex gap-1.5 flex-wrap mb-3">
                      {[500000, 1000000, 2000000, 3000000].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setStartingCash(v)}
                          className="btn btn-xs btn-light border rounded-pill px-2.5 py-1 fw-semibold"
                        >
                          {v.toLocaleString()}đ
                        </button>
                      ))}
                    </div>

                    <label className="form-label fw-bold small text-dark">Ghi chú đầu ca (Tùy chọn):</label>
                    <input
                      type="text"
                      value={shiftNote}
                      onChange={(e) => setShiftNote(e.target.value)}
                      placeholder="VD: Đủ tiền lẻ trả khách..."
                      className="form-control"
                    />
                  </div>
                  <div className="modal-footer bg-light px-4 py-3">
                    <button type="button" onClick={() => setShowShiftModal(false)} className="btn btn-light border fw-bold">Đóng</button>
                    <button type="submit" className="btn btn-success fw-bold px-4">Xác nhận Mở ca</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCloseShiftSubmit}>
                  <div className="modal-body p-4">
                    <div className="p-3 rounded-3 bg-light border mb-3">
                      <div className="fw-bolder text-dark small text-uppercase mb-2 pb-1.5 border-bottom d-flex justify-content-between">
                        <span>1. Bảng kê doanh thu trong ca</span>
                        <span className="text-primary">Mở lúc: {shiftInfo.opened_at}</span>
                      </div>

                      <div className="d-flex justify-content-between py-1 small">
                        <span className="text-secondary">Tiền mặt đầu ca (1):</span>
                        <b className="text-dark">{startingCash.toLocaleString()}đ</b>
                      </div>
                      <div className="d-flex justify-content-between py-1 small">
                        <span className="text-secondary">Doanh thu Tiền mặt trong ca (2):</span>
                        <b className="text-success">+{shiftStats.cashRevenue.toLocaleString()}đ</b>
                      </div>
                      <div className="d-flex justify-content-between py-1 small">
                        <span className="text-secondary">Doanh thu Chuyển khoản VietQR:</span>
                        <b className="text-primary">+{shiftStats.transferRevenue.toLocaleString()}đ</b>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-bottom pb-2">
                        <span className="text-secondary">Tổng hóa đơn đã thanh toán:</span>
                        <b>{shiftStats.totalBills} hóa đơn (DB: {shiftInfo.db_completed_bills})</b>
                      </div>

                      <div className="d-flex justify-content-between align-items-center pt-2 mt-1">
                        <span className="fw-bolder text-dark">Tiền mặt lý thuyết trong két (1 + 2):</span>
                        <span className="fs-5 fw-bolder text-primary">{expectedCashInDrawer.toLocaleString()}đ</span>
                      </div>
                    </div>

                    {usedCount > 0 && (
                      <div className="p-2.5 rounded-3 bg-warning bg-opacity-10 border border-warning text-dark small mb-3 d-flex align-items-center gap-2">
                        <AlertCircle size={17} className="text-warning flex-shrink-0" />
                        <span>Hiện vẫn còn <b>{usedCount} bàn</b> đang phục vụ chưa thanh toán.</span>
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label fw-bolder small text-dark">2. Nhập tiền mặt thực đếm tại két (VNĐ):</label>
                      <input
                        type="number"
                        required
                        value={actualCountedCash}
                        onChange={(e) => setActualCountedCash(e.target.value)}
                        placeholder={`Nhập số tiền thực đếm (Gợi ý: ${expectedCashInDrawer.toLocaleString()})...`}
                        className="form-control form-control-lg fw-bolder text-end border-primary"
                      />
                      <div className="d-flex gap-1.5 flex-wrap mt-2">
                        <button
                          type="button"
                          onClick={() => setActualCountedCash(String(expectedCashInDrawer))}
                          className="btn btn-xs btn-outline-primary rounded-pill px-3 py-1 fw-bold"
                        >
                          Khớp đúng lý thuyết ({expectedCashInDrawer.toLocaleString()}đ)
                        </button>
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-3 border d-flex justify-content-between align-items-center mb-3 ${
                        cashDiscrepancy === 0
                          ? 'bg-success bg-opacity-10 border-success text-success'
                          : 'bg-danger bg-opacity-10 border-danger text-danger'
                      }`}
                    >
                      <span className="fw-bold small">Chênh lệch quỹ tiền mặt (Thực đếm - Lý thuyết):</span>
                      <span className="fw-bolder fs-6">
                        {cashDiscrepancy === 0
                          ? '0đ (Khớp quỹ 100%)'
                          : `${cashDiscrepancy > 0 ? '+' : ''}${cashDiscrepancy.toLocaleString()}đ (${cashDiscrepancy > 0 ? 'Thừa' : 'Thiếu'})`}
                      </span>
                    </div>

                    <div>
                      <label className="form-label fw-bold small text-dark">Ghi chú bàn giao ca:</label>
                      <input
                        type="text"
                        value={shiftNote}
                        onChange={(e) => setShiftNote(e.target.value)}
                        placeholder="Nhập ghi chú bàn giao cho ca sau..."
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div className="modal-footer bg-light px-4 py-3">
                    <button type="button" onClick={() => setShowShiftModal(false)} className="btn btn-light border fw-bold">
                      Hủy bỏ
                    </button>
                    <button type="submit" className="btn btn-danger fw-bold px-4 shadow-sm">
                      Chốt ca & Bàn giao
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HÓA ĐƠN THANH TOÁN & PHIẾU TẠM TÍNH K80 */}
      {activeReceiptModalData && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 3500 }}
          onClick={() => setActiveReceiptModalData(null)}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h6 className="modal-title fw-bold mb-0 d-flex align-items-center gap-2">
                  <FileText size={17} className="text-warning" />
                  <span>{activeReceiptModalData.title} (Chuẩn K80)</span>
                </h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveReceiptModalData(null)} />
              </div>

              <div className="modal-body p-4 bg-white" style={{ maxHeight: '75vh', overflowY: 'auto', fontFamily: 'Inter, monospace' }}>
                <div className="text-center border-bottom pb-2.5 mb-2.5">
                  <h5 className="fw-bolder text-dark mb-0">NHÀ HÀNG SMARTPOS</h5>
                  <div className="text-muted small">Chi nhánh Trung Tâm • Hotline: 1900 6522</div>
                  <div className="badge bg-primary bg-opacity-10 text-primary fw-bolder px-3 py-1.5 mt-2 fs-6">
                    {activeReceiptModalData.title}
                  </div>
                  <div className="small text-secondary mt-1">Số phiếu: <b>{activeReceiptModalData.id}</b></div>
                </div>

                <div className="small mb-2.5 pb-2.5 border-bottom">
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-secondary">Bàn phục vụ:</span>
                    <b className="text-dark fs-6">{activeReceiptModalData.table}</b>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-secondary">Mã phiên:</span>
                    <b className="text-dark">{activeReceiptModalData.sessionCode}</b>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-secondary">Giờ khách vào:</span>
                    <b className="text-dark">{activeReceiptModalData.startTime}</b>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-secondary">Giờ xuất hóa đơn:</span>
                    <b className="text-primary">{activeReceiptModalData.checkoutTime}</b>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-secondary">Thu ngân:</span>
                    <b>{activeReceiptModalData.cashier}</b>
                  </div>
                </div>

                <table className="table table-sm align-middle small mb-2.5">
                  <thead className="table-light">
                    <tr>
                      <th>Tên món</th>
                      <th className="text-center">SL</th>
                      <th className="text-end">Đ.Giá</th>
                      <th className="text-end">T.Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeReceiptModalData.items || []).map((it, i) => {
                      const uPrice = Number(it.unit_price || it.price || 0);
                      const q = Number(it.quantity || 1);
                      return (
                        <tr key={i}>
                          <td className="fw-bold text-dark">{i + 1}. {it.product_name || it.name}</td>
                          <td className="text-center fw-bold">{q}</td>
                          <td className="text-end">{uPrice.toLocaleString()}</td>
                          <td className="text-end fw-bold">{(uPrice * q).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="small border-top pt-2">
                  <div className="d-flex justify-content-between py-0.5">
                    <span>Tổng số lượng:</span>
                    <b>{activeReceiptModalData.totalQty} phần</b>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span>Tạm tính:</span>
                    <b>{Number(activeReceiptModalData.subtotal || 0).toLocaleString()}đ</b>
                  </div>
                  {activeReceiptModalData.discountAmount > 0 && (
                    <div className="d-flex justify-content-between py-0.5 text-success">
                      <span>Giảm giá:</span>
                      <b>-{Number(activeReceiptModalData.discountAmount).toLocaleString()}đ</b>
                    </div>
                  )}
                  <div className="d-flex justify-content-between py-2 border-top border-bottom my-1.5 fs-5 fw-bolder text-danger">
                    <span>TỔNG THANH TOÁN:</span>
                    <span>{Number(activeReceiptModalData.totalAmount || 0).toLocaleString()}đ</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light py-2.5">
                <button
                  type="button"
                  onClick={() => setActiveReceiptModalData(null)}
                  className="btn btn-light border fw-bold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => triggerDedicatedK80Print(activeReceiptModalData)}
                  className="btn btn-primary fw-bold px-4 d-flex align-items-center gap-1.5"
                >
                  <Printer size={16} /> In Hóa Đơn K80 Ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL % GIẢM GIÁ */}
      {showDiscountModal && selectedTable && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 3100 }} onClick={() => setShowDiscountModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-success text-white py-3">
                <h5 className="modal-title fw-bold mb-0 d-flex align-items-center gap-2">
                  <Percent size={20} /> Giảm Giá Hóa Đơn • {selectedTable.table_number}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDiscountModal(false)} />
              </div>

              <div className="modal-body p-4">
                <div className="d-flex justify-content-between align-items-center p-2.5 rounded-3 bg-light border mb-3">
                  <span className="text-secondary fw-semibold">Tạm tính hiện tại:</span>
                  <span className="fw-bolder fs-5 text-dark">{subTotalAmount.toLocaleString()}đ</span>
                </div>

                <div className="d-flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => { setDiscountType('PERCENT'); setDiscountValue(0); }}
                    className={`btn flex-fill py-2 fw-bold rounded-3 ${
                      discountType === 'PERCENT' ? 'btn-success text-white' : 'btn-outline-secondary'
                    }`}
                  >
                    Giảm theo Phần trăm (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDiscountType('AMOUNT'); setDiscountValue(0); }}
                    className={`btn flex-fill py-2 fw-bold rounded-3 ${
                      discountType === 'AMOUNT' ? 'btn-success text-white' : 'btn-outline-secondary'
                    }`}
                  >
                    Giảm theo Số tiền (VNĐ)
                  </button>
                </div>

                {discountType === 'PERCENT' ? (
                  <div className="mb-3">
                    <label className="form-label fw-bold small text-dark">Chọn nhanh mức % giảm giá:</label>
                    <div className="d-flex gap-2 flex-wrap mb-2.5">
                      {[5, 10, 15, 20, 25, 50].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountValue(pct)}
                          className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold ${
                            discountValue === pct ? 'btn-success text-white' : 'btn-light border'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.min(100, Math.max(0, Number(e.target.value))))}
                      placeholder="Nhập % giảm giá (0 - 100)..."
                      className="form-control fw-bold fs-5 text-end"
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="form-label fw-bold small text-dark">Chọn nhanh số tiền giảm:</label>
                    <div className="d-flex gap-2 flex-wrap mb-2.5">
                      {[10000, 20000, 50000, 100000, 200000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscountValue(amt)}
                          className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold ${
                            discountValue === amt ? 'btn-success text-white' : 'btn-light border'
                          }`}
                        >
                          -{amt.toLocaleString()}đ
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={subTotalAmount}
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                      placeholder="Nhập số tiền giảm (VNĐ)..."
                      className="form-control fw-bold fs-5 text-end"
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-bold small text-dark d-flex align-items-center gap-1">
                    <Tag size={14} /> Mã Voucher / Lý do giảm giá:
                  </label>
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="VD: VIP10, KHACHQUEN..."
                    className="form-control"
                  />
                </div>

                <div className="p-3 rounded-3 bg-success bg-opacity-10 border border-success d-flex justify-content-between align-items-center">
                  <div>
                    <div className="small text-secondary">Số tiền được giảm: <b className="text-success">-{discountAmount.toLocaleString()}đ</b></div>
                    <div className="fw-bold text-dark">Còn phải thanh toán:</div>
                  </div>
                  <div className="fs-4 fw-bolder text-danger">{currentBillTotal.toLocaleString()}đ</div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  onClick={() => { setDiscountValue(0); setVoucherCode(''); setShowDiscountModal(false); }}
                  className="btn btn-outline-danger fw-bold"
                >
                  Xóa giảm giá
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="btn btn-success fw-bold px-4"
                >
                  Áp dụng ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA / ĐÓNG BÀN */}
      {showCancelTableModal && selectedTable && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 3100 }} onClick={() => setShowCancelTableModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-danger text-white py-3">
                <h5 className="modal-title fw-bold mb-0 d-flex align-items-center gap-2">
                  <Ban size={20} /> Hủy / Đóng {selectedTable.table_number}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCancelTableModal(false)} />
              </div>
              <form onSubmit={handleConfirmCancelTable}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Đóng phiên phục vụ của <b>{selectedTable.table_number}</b>, hủy các món chưa thanh toán và trả bàn về trạng thái <b>Còn trống</b>.
                  </p>
                  <label className="form-label fw-bold small text-dark">Nhập lý do hủy / đóng bàn (*):</label>
                  <input
                    type="text"
                    required
                    value={cancelTableReason}
                    onChange={(e) => setCancelTableReason(e.target.value)}
                    className="form-control fw-semibold mb-2"
                  />
                  <div className="d-flex gap-1.5 flex-wrap mt-2">
                    {['Khách đổi ý không dùng bữa', 'Món hết khách hủy bàn', 'Nhân viên mở nhầm bàn'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCancelTableReason(r)}
                        className="btn btn-xs btn-light border rounded-pill px-2.5 py-1"
                        style={{ fontSize: '11px' }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" onClick={() => setShowCancelTableModal(false)} className="btn btn-light border fw-bold">Quay lại</button>
                  <button type="submit" className="btn btn-danger fw-bold px-4">Xác nhận Đóng bàn</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THANH TOÁN */}
      {showPayModal && selectedTable && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 3200 }} onClick={() => setShowPayModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header text-white py-3" style={{ backgroundColor: '#003e9c' }}>
                <h5 className="modal-title fw-bold mb-0">Chốt Hóa Đơn & Thanh Toán • {selectedTable.table_number}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPayModal(false)} />
              </div>
              <div className="modal-body p-4">
                <div className="p-2.5 rounded-3 bg-light border small mb-3">
                  <div className="d-flex justify-content-between">
                    <span className="text-secondary">Mã phiên: <b>{currentSessionInfo?.sessionCode}</b></span>
                    <span className="text-secondary">Giờ vào: <b>{currentSessionInfo?.startTimeText}</b></span>
                  </div>
                  <div className="d-flex justify-content-between mt-1">
                    <span className="text-secondary">Số lượng: <b>{currentBillQty} phần</b></span>
                    <span className="text-secondary">Thời gian ngồi: <b>{currentSessionInfo?.durationLabel}</b></span>
                  </div>
                </div>

                <div className="text-center mb-3">
                  <div className="text-muted small fw-bold text-uppercase">Tổng tiền thanh toán</div>
                  <div className="display-6 fw-bold text-danger">{currentBillTotal.toLocaleString()}đ</div>
                </div>
                <div className="d-flex gap-2 mb-3">
                  <button onClick={() => setPaymentMethod('CASH')} className={`btn flex-grow-1 py-2.5 fw-bold rounded-3 ${paymentMethod === 'CASH' ? 'btn-success text-white' : 'btn-outline-secondary'}`}>
                    Tiền mặt
                  </button>
                  <button onClick={() => setPaymentMethod('TRANSFER')} className={`btn flex-grow-1 py-2.5 fw-bold rounded-3 ${paymentMethod === 'TRANSFER' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}>
                    Chuyển khoản VietQR
                  </button>
                </div>
                {paymentMethod === 'CASH' ? (
                  <div className="p-3 bg-light rounded-3 border">
                    <label className="small fw-bold text-secondary mb-1">Tiền khách đưa:</label>
                    <input type="number" value={customerCash || ''} onChange={(e) => setCustomerCash(Number(e.target.value))} className="form-control fw-bold fs-5 text-end mb-2" />
                    <div className="d-flex gap-1.5 flex-wrap mb-2">
                      {[currentBillTotal, Math.ceil(currentBillTotal / 50000) * 50000, Math.ceil(currentBillTotal / 100000) * 100000, 500000, 1000000]
                        .filter((v, i, a) => v >= currentBillTotal && a.indexOf(v) === i)
                        .slice(0, 4)
                        .map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomerCash(val)}
                            className="btn btn-xs btn-white border rounded-pill px-2.5 py-1 fw-bold"
                          >
                            {val.toLocaleString()}đ
                          </button>
                        ))}
                    </div>
                    <div className="d-flex justify-content-between pt-2 border-top">
                      <span className="fw-semibold">Tiền thừa trả khách:</span>
                      <b className="text-success fs-5">{changeAmount.toLocaleString()}đ</b>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <img src={dynamicVietQrUrl} alt="VietQR" style={{ width: '200px', height: '200px', objectFit: 'contain' }} />
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button onClick={() => setShowPayModal(false)} className="btn btn-light border fw-bold">Hủy</button>
                <button onClick={handleConfirmPayment} className="btn btn-success fw-bold px-4">
                  Xác nhận thanh toán & Xuất Hóa Đơn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CSS CHUẨN: PILL LỌC TO RÕ • LƯỚI BÀN 6 Ô VUÔNG VỨC • BẢNG BO GÓC KHÔNG TRÀN */}
      {/* ================================================================= */}
      <style dangerouslySetInnerHTML={{__html: `
        .kv-tab { background: transparent; color: rgba(255, 255, 255, 0.92); border: none; padding: 7px 16px; font-weight: 700; font-size: 13px; border-top-left-radius: 11px; border-top-right-radius: 11px; display: inline-flex; align-items: center; gap: 6px; }
        .kv-tab.active { background: #ffffff; color: #003e9c; }

        /* CỤM NÚT LỌC TRẠNG THÁI BÀN TO NGANG NÚT BÀN 06 BÊN PHẢI */
        .pos-filter-pill {
          font-size: 14.5px;
          font-weight: 700;
          color: #475569;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          padding: 6px 15px;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          transition: all 0.15s ease;
          margin-bottom: 0;
        }
        .pos-filter-pill:hover {
          background: #eff6ff;
          border-color: #93c5fd;
        }
        .pos-filter-pill.active-all {
          background: #eff6ff;
          color: #0f172a;
          border-color: #2563eb;
          font-weight: 800;
        }
        .pos-filter-pill.active-used {
          background: #dbeafe;
          color: #1e40af;
          border-color: #2563eb;
          font-weight: 800;
        }
        .pos-filter-pill.active-empty {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #64748b;
          font-weight: 800;
        }
        .pos-filter-pill.active-calling {
          background: #fff1f2;
          color: #be123c;
          border-color: #e11d48;
          font-weight: 800;
        }

        /* LƯỚI BÀN 6 CỘT × 4 HÀNG TỰ GIÃN ĐỀU LẤP ĐẦY KHOẢNG TRẮNG DƯỚI ĐÁY */
        .kv-24-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          grid-template-rows: repeat(4, minmax(128px, 1fr));
          gap: 14px;
        }
        .kv-table-card {
          height: 100%;
          min-height: 128px;
          border-radius: 16px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid rgba(148, 163, 184, 0.28);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .kv-table-card:hover {
          transform: translateY(-2px);
        }
        .kv-calling-card { border: 2px solid #e11d48 !important; animation: pulseAlertCard 1.2s infinite ease-in-out; }
        @keyframes pulseAlertCard { 0%, 100% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.45); } 50% { box-shadow: 0 0 0 8px rgba(225, 29, 72, 0); } }

        /* KHUNG SIDEBAR & BẢNG TRONG CỔNG QUẢN LÝ BO TRÒN SẠCH ĐẸP, KHÔNG BỊ TRÀN RA NGOÀI KHUNG */
        .mgmt-filter-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }
        .mgmt-filter-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .mgmt-category-btn {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          padding: 7px 11px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          transition: all 0.12s ease;
        }
        .mgmt-category-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .mgmt-category-btn.active {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 800;
        }
        .mgmt-table-wrapper {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.05);
        }
        .mgmt-table-head {
          background: #e0f2fe;
          color: #0f172a;
          font-weight: 800;
        }
        .mgmt-table-head th {
          padding: 12px 10px;
          border-bottom: 1px solid #bae6fd;
        }

        .session-info-pill {
          font-size: 14.5px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          padding: 4px 10px;
          border-radius: 8px;
        }
        .session-time-pill {
          font-size: 15px;
          color: #334155;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 4px 11px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .session-duration-pill {
          font-size: 14.5px;
          font-weight: 800;
          color: #b45309;
          background: #fef3c7;
          border: 1px solid #fde68a;
          padding: 4px 10px;
          border-radius: 8px;
        }

        .kv-user-trigger:hover {
          background: rgba(255, 255, 255, 0.14);
        }
        .kv-pro-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 300px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
          border: 1px solid #e2e8f0;
          z-index: 2050;
          overflow: hidden;
          animation: dropdownFadeIn 0.15s ease-out;
        }
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kv-dropdown-user-header {
          padding: 14px 16px;
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .kv-user-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #003e9c;
          color: #ffffff;
          font-weight: 800;
          font-size: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0, 62, 156, 0.25);
        }
        .kv-dropdown-item {
          width: 100%;
          background: transparent;
          border: none;
          padding: 10px 12px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #1e293b;
          font-size: 13.5px;
          transition: background 0.12s ease;
        }
        .kv-dropdown-item:hover {
          background: #f1f5f9;
        }
        .kv-item-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kv-dropdown-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 4px 8px;
        }

        .cashier-square-menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
          gap: 12px;
        }
        .square-menu-card {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .square-menu-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
        }
        .square-img-box {
          width: 100%;
          aspect-ratio: 1 / 1;
          position: relative;
          background: #f8fafc;
          overflow: hidden;
        }

        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}