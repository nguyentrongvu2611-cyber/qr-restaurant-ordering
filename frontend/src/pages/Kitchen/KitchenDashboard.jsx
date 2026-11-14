import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock, CheckCircle2, RefreshCw, LogOut, Volume2,
  VolumeX, RotateCcw, Check, AlertTriangle, UserCheck,
  History, Utensils, ChefHat, Eye, Wine
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

// Bảng màu cho danh sách "Tất cả món cần nấu / cần pha" ở cột phải
const SUMMARY_PALETTES = [
  { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', badgeBg: '#e11d48', badgeText: '#ffffff' },
  { bg: '#fffbeb', border: '#fde68a', text: '#b45309', badgeBg: '#d97706', badgeText: '#ffffff' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', badgeBg: '#059669', badgeText: '#ffffff' },
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badgeBg: '#2563eb', badgeText: '#ffffff' },
  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', badgeBg: '#7c3aed', badgeText: '#ffffff' },
  { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490', badgeBg: '#0891b2', badgeText: '#ffffff' }
];

export default function KitchenDashboard() {
  // 'KITCHEN_SCREEN' (Chỉ xem cho Đầu bếp) | 'PASS_SCREEN' (Tiếp thực Bếp) | 'BAR_SCREEN' (Quầy Bar)
  const [screenMode, setScreenMode] = useState('PASS_SCREEN');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('kds_sound') !== 'false');
  const [showUndoModal, setShowUndoModal] = useState(false);

  const [orders, setOrders] = useState([]);
  const [dbOrderTimes, setDbOrderTimes] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [selectedWaiterByTicket, setSelectedWaiterByTicket] = useState({});

  const [dispatchLogs, setDispatchLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_pass_dispatch_logs') || '[]'); } catch { return []; }
  });
  const [recentActions, setRecentActions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_kds_undo_actions') || '[]'); } catch { return []; }
  });

  const [loading, setLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [localServedItemIds, setLocalServedItemIds] = useState([]);

  const [restoredItemIds, setRestoredItemIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_restored_item_ids') || '[]'); } catch { return []; }
  });

  const [outOfStockNames, setOutOfStockNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'); } catch { return []; }
  });
  const [rejectedItemIds, setRejectedItemIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'); } catch { return []; }
  });

  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const [outOfStockData, setOutOfStockData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const token = localStorage.getItem('access_token');
  const prevOrderIdsRef = useRef(new Set());

  const playKitchenSound = (type = 'NEW_ORDER') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'CANCEL_ALERT') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.setValueAtTime(220, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('kds_sound', String(next));
    if (next) playKitchenSound('NEW_ORDER');
  };

  // Cập nhật đồng hồ thời gian thực mỗi 10 giây
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // LẤY DANH SÁCH NHÂN VIÊN THẬT TỪ DATABASE
  const fetchRealStaffUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/staff-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setStaffList(data);
          return;
        }
      }
      const resAdminUsers = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);
      if (resAdminUsers && resAdminUsers.ok) {
        const usersData = await resAdminUsers.json();
        const list = (Array.isArray(usersData) ? usersData : (usersData.items || [])).map(u => ({
          id: u.id,
          full_name: u.full_name || u.name || u.username
        }));
        if (list.length > 0) setStaffList(list);
      }
    } catch (e) {
      console.error('Lỗi tải danh sách nhân viên thật:', e);
    }
  };

  // ĐỒNG BỘ ĐƠN HÀNG & THỜI GIAN THẬT TỪ BACKEND
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOrders, resTimes] = await Promise.all([
        fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/kitchen/order-timestamps`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);

      let fetchedTimes = {};
      if (resTimes && resTimes.ok) {
        const timeData = await resTimes.json();
        fetchedTimes = timeData.order_times || {};
        setDbOrderTimes(fetchedTimes);
      }

      if (resOrders.ok) {
        const data = await resOrders.json();
        const rawList = Array.isArray(data) ? data : (data.items || data.orders || []);
        const autoConfirmed = JSON.parse(localStorage.getItem('pos_cashier_confirmed_orders') || '[]');

        const activeOrders = rawList.filter(o => {
          const st = String(o.status).toLowerCase();
          return ['confirmed', 'cooking', 'preparing', 'ready'].includes(st) || autoConfirmed.includes(o.id);
        });

        // Lưu mốc thời gian thực lần đầu nhìn thấy Order vào localStorage nếu API /api/orders thiếu created_at
        const savedRealTimestamps = JSON.parse(localStorage.getItem('pos_real_order_timestamps') || '{}');
        let changedTs = false;
        activeOrders.forEach(o => {
          const dbIso = o.created_at || o.order_time || fetchedTimes[String(o.id)];
          if (dbIso) {
            const parsed = new Date(String(dbIso).replace(' ', 'T')).getTime();
            if (!isNaN(parsed) && savedRealTimestamps[o.id] !== parsed) {
              savedRealTimestamps[o.id] = parsed;
              changedTs = true;
            }
          } else if (!savedRealTimestamps[o.id]) {
            savedRealTimestamps[o.id] = Date.now();
            changedTs = true;
          }
        });
        if (changedTs) {
          localStorage.setItem('pos_real_order_timestamps', JSON.stringify(savedRealTimestamps));
        }

        const currentIds = new Set(activeOrders.map(o => o.id));
        if (prevOrderIdsRef.current.size > 0) {
          let hasNew = false;
          currentIds.forEach(id => {
            if (!prevOrderIdsRef.current.has(id)) hasNew = true;
          });
          if (hasNew) playKitchenSound('NEW_ORDER');
        }
        prevOrderIdsRef.current = currentIds;

        // Sắp xếp FIFO chuẩn xác theo thời gian đặt từ cũ đến mới
        activeOrders.sort((a, b) => {
          const tA = savedRealTimestamps[a.id] || a.id;
          const tB = savedRealTimestamps[b.id] || b.id;
          return tA - tB;
        });

        setOrders(activeOrders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealStaffUsers();
    fetchData();
    const interval = setInterval(fetchData, 3500);

    const bc = new BroadcastChannel('smartpos_channel');
    bc.onmessage = (event) => {
      const { type } = event.data || {};
      if (
        type === 'PRODUCT_RESTORED' ||
        type === 'ORDER_CONFIRMED' ||
        type === 'CASHIER_CREATED_ORDER' ||
        type === 'STAFF_SWAPPED_ITEM' ||
        type === 'EXPO_SERVED'
      ) {
        setOutOfStockNames(JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]'));
        setRejectedItemIds(JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]'));
        setRestoredItemIds(JSON.parse(localStorage.getItem('pos_restored_item_ids') || '[]'));
        fetchData();
      }
      if (type === 'CASHIER_CONFIRMED_CANCEL') {
        playKitchenSound('CANCEL_ALERT');
        fetchData();
      }
    };

    return () => {
      clearInterval(interval);
      bc.close();
    };
  }, [soundEnabled]);

  const classifyItemFlow = (item) => {
    const rawStation = String(
      item.station || item.category_station || item.category_name || item.category || ''
    ).toLowerCase();
    const name = String(item.product_name || item.name || '').toLowerCase();

    if (
      /(trà|cà phê|cafe|bạc xỉu|sinh tố|nước ép|ép|soda|sữa|matcha|đá xay|ca cao|mojito|cocktail|macchiato|latte)/.test(name) ||
      rawStation.includes('pha chế')
    ) {
      return 'BAR_CRAFT';
    }

    if (
      /(nước suối|aquafina|lavie|dasani|coca|pepsi|7up|sting|redbull|bò húc|bia |tiger|heineken|lon|đóng chai|khăn lạnh)/.test(name) ||
      rawStation.includes('fast') ||
      rawStation.includes('đóng chai')
    ) {
      return 'BAR_FAST';
    }

    return 'KITCHEN';
  };

  // =========================================================================
  // TÍNH THỜI GIAN ĐẶT MÓN & SỐ PHÚT CHỜ THẬT 100% (KHÔNG DÙNG SỐ MOCK 2P)
  // =========================================================================
  const getRealOrderTiming = (order) => {
    const savedRealTimestamps = JSON.parse(localStorage.getItem('pos_real_order_timestamps') || '{}');
    const rawIso = order.created_at || order.order_time || dbOrderTimes[String(order.id)];

    let startMs = null;
    if (rawIso) {
      const parsed = new Date(String(rawIso).replace(' ', 'T')).getTime();
      if (!isNaN(parsed)) startMs = parsed;
    }
    if (!startMs && savedRealTimestamps[order.id]) {
      startMs = Number(savedRealTimestamps[order.id]);
    }
    if (!startMs) {
      startMs = Date.now();
    }

    const diffMins = Math.max(0, Math.floor((nowTick - startMs) / 60000));
    const elapsedLabel = diffMins === 0 ? 'Vừa xong' : diffMins >= 60 ? `${Math.floor(diffMins / 60)}g${diffMins % 60}p` : `${diffMins} phút`;
    const orderTimeText = new Date(startMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    let topBarColor = '#003e9c';
    let headerBg = '#eff6ff';
    let timerBg = '#dbeafe';
    let timerText = '#1e40af';

    if (diffMins >= 15) {
      topBarColor = '#dc2626';
      headerBg = '#fef2f2';
      timerBg = '#fee2e2';
      timerText = '#b91c1c';
    } else if (diffMins >= 8) {
      topBarColor = '#d97706';
      headerBg = '#fffbeb';
      timerBg = '#fef3c7';
      timerText = '#b45309';
    }

    return { elapsedMins: diffMins, elapsedLabel, orderTimeText, topBarColor, headerBg, timerBg, timerText };
  };

  const enrichedOrders = useMemo(() => {
    // Đếm số lượt gọi của từng bàn để đánh dấu "+ Gọi thêm (Lượt 2, Lượt 3...)"
    const tableBatchCounter = {};

    return orders.map(order => {
      const timing = getRealOrderTiming(order);
      const orderCode = order.order_code || `ORD-${order.id}`;
      const tableName = order.table_name || `Bàn 0${order.table_id}`;

      tableBatchCounter[tableName] = (tableBatchCounter[tableName] || 0) + 1;
      const batchNumber = tableBatchCounter[tableName];

      // Trong phạm vi CÙNG 1 LƯỢT ORDER, nếu có 2 dòng cùng tên món thì gộp lại cho gọn
      const mergedItemsInSameOrder = {};
      (order.items || order.order_items || []).forEach(item => {
        const rawStatus = String(item.item_status || item.status || 'confirmed').toLowerCase();
        const isCancelled =
          rawStatus === 'cancelled' ||
          rawStatus === 'canceled' ||
          rawStatus === 'out_of_stock' ||
          Boolean(item.is_cancelled) ||
          rejectedItemIds.includes(item.id);

        const isServed =
          (rawStatus === 'served' && !restoredItemIds.includes(item.id)) ||
          localServedItemIds.includes(item.id);
        const flowType = classifyItemFlow(item);

        if (isCancelled || isServed) return;

        const itemName = item.product_name || item.name;
        const key = `${itemName}__${item.note || ''}__${flowType}`;
        if (!mergedItemsInSameOrder[key]) {
          mergedItemsInSameOrder[key] = {
            ...item,
            orderId: order.id,
            orderCode,
            tableId: order.table_id,
            tableName,
            elapsedMins: timing.elapsedMins,
            elapsedLabel: timing.elapsedLabel,
            orderTimeText: timing.orderTimeText,
            flowType,
            quantity: Number(item.quantity || 1),
            allItemIds: [item.id]
          };
        } else {
          mergedItemsInSameOrder[key].quantity += Number(item.quantity || 1);
          mergedItemsInSameOrder[key].allItemIds.push(item.id);
        }
      });

      return {
        ...order,
        orderCode,
        tableName,
        batchNumber,
        isAddOnBatch: batchNumber > 1,
        ...timing,
        enrichedItems: Object.values(mergedItemsInSameOrder)
      };
    });
  }, [orders, dbOrderTimes, localServedItemIds, restoredItemIds, rejectedItemIds, nowTick]);

  // =========================================================================
  // CHUẨN NGHIỆP VỤ BẾP (FIFO):
  // MỖI ORDER LÀ 1 PHIẾU RIÊNG BIỆT XẾP THEO THỨ TỰ THỜI GIAN ĐẶT!
  // Order gọi thêm sau BẮT BUỘC nằm ở vị trí sau (không gộp vào order đầu tiên)
  // =========================================================================
  const kitchenOrderTickets = useMemo(() => {
    return enrichedOrders
      .map(order => {
        const kItems = order.enrichedItems.filter(it => it.flowType === 'KITCHEN');
        return {
          ...order,
          ticketKey: `KITCHEN_ORD_${order.id}`,
          activeKitchenItems: kItems
        };
      })
      .filter(o => o.activeKitchenItems.length > 0)
      .map((o, idx) => ({ ...o, seqNumber: idx + 1 }));
  }, [enrichedOrders]);

  // BẢNG TẤT CẢ MÓN CẦN NẤU Ở CỘT PHẢI
  const allKitchenDishesSummary = useMemo(() => {
    const map = {};
    kitchenOrderTickets.forEach(ticket => {
      ticket.activeKitchenItems.forEach(item => {
        const name = item.product_name || item.name;
        if (!map[name]) {
          map[name] = { name, totalQty: 0, byTable: [] };
        }
        const q = Number(item.quantity) || 1;
        map[name].totalQty += q;
        map[name].byTable.push(
          `${ticket.tableName}${ticket.isAddOnBatch ? ` (L${ticket.batchNumber})` : ''}: ${q}`
        );
      });
    });
    return Object.values(map)
      .map(d => ({
        ...d,
        tablesText: d.byTable.join(' • ')
      }))
      .sort((a, b) => b.totalQty - a.totalQty);
  }, [kitchenOrderTickets]);

  // DỮ LIỆU MÀN HÌNH QUẦY BAR (THEO TỪNG ORDER FIFO)
  const barFastItems = useMemo(() => {
    const list = [];
    enrichedOrders.forEach(order => {
      order.enrichedItems.forEach(item => {
        if (item.flowType === 'BAR_FAST') {
          list.push({
            ...item,
            batchNumber: order.batchNumber,
            isAddOnBatch: order.isAddOnBatch
          });
        }
      });
    });
    return list;
  }, [enrichedOrders]);

  const barCraftOrderTickets = useMemo(() => {
    return enrichedOrders
      .map(order => {
        const bItems = order.enrichedItems.filter(it => it.flowType === 'BAR_CRAFT');
        return {
          ...order,
          ticketKey: `BAR_ORD_${order.id}`,
          activeBarItems: bItems
        };
      })
      .filter(o => o.activeBarItems.length > 0)
      .map((o, idx) => ({ ...o, seqNumber: idx + 1 }));
  }, [enrichedOrders]);

  const allBarDrinksSummary = useMemo(() => {
    const map = {};
    barCraftOrderTickets.forEach(ticket => {
      ticket.activeBarItems.forEach(item => {
        const name = item.product_name || item.name;
        if (!map[name]) {
          map[name] = { name, totalQty: 0, byTable: [] };
        }
        const q = Number(item.quantity) || 1;
        map[name].totalQty += q;
        map[name].byTable.push(
          `${ticket.tableName}${ticket.isAddOnBatch ? ` (L${ticket.batchNumber})` : ''}: ${q}`
        );
      });
    });
    return Object.values(map)
      .map(d => ({
        ...d,
        tablesText: d.byTable.join(' • ')
      }))
      .sort((a, b) => b.totalQty - a.totalQty);
  }, [barCraftOrderTickets]);

  // HÀM GIAO MÓN CHO NHÂN VIÊN & LƯU HOÀN TÁC
  const handleAssignWaiterAndServe = async (ticketKey, tableName, itemsToServe, sourceStation = 'PASS Bếp') => {
    if (!itemsToServe || itemsToServe.length === 0) return;
    const defaultStaffName = staffList[0]?.full_name || localStorage.getItem('full_name') || 'Nhân viên phục vụ';
    const assignedWaiter = selectedWaiterByTicket[ticketKey] || defaultStaffName;
    const itemIds = itemsToServe.flatMap(i => i.allItemIds || [i.id]);

    const nextRestored = restoredItemIds.filter(id => !itemIds.includes(id));
    setRestoredItemIds(nextRestored);
    localStorage.setItem('pos_restored_item_ids', JSON.stringify(nextRestored));

    setLocalServedItemIds(prev => [...new Set([...prev, ...itemIds])]);

    const summaryText = itemsToServe.map(i => `${i.quantity}x ${i.product_name || i.name}`).join(', ');
    const actionId = `ACT-${Date.now()}`;

    const newAction = {
      id: actionId,
      itemIds,
      orderIds: [...new Set(itemsToServe.map(i => i.orderId).filter(Boolean))],
      tableName,
      station: sourceStation,
      waiterName: assignedWaiter,
      summary: `${tableName}: ${summaryText} (Giao NV: ${assignedWaiter})`,
      timeLabel: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    const nextActions = [newAction, ...recentActions.slice(0, 19)];
    setRecentActions(nextActions);
    localStorage.setItem('pos_kds_undo_actions', JSON.stringify(nextActions));

    const newLog = {
      id: actionId,
      station: sourceStation,
      tableName,
      waiterName: assignedWaiter,
      itemsText: summaryText,
      time: newAction.timeLabel
    };
    const nextLogs = [newLog, ...dispatchLogs.slice(0, 39)];
    setDispatchLogs(nextLogs);
    localStorage.setItem('pos_pass_dispatch_logs', JSON.stringify(nextLogs));

    try {
      const res = await fetch(`${API_BASE}/api/kitchen/batch-served`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_ids: itemIds, staff_name: assignedWaiter })
      });

      if (!res.ok) {
        await Promise.all(
          itemIds.map(id =>
            fetch(`${API_BASE}/api/kitchen/items/${id}/served`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}` }
            }).catch(() => null)
          )
        );
      }

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({
        type: 'EXPO_SERVED',
        payload: { item_ids: itemIds, table_name: tableName, staff_name: assignedWaiter }
      });
      bc.close();

      setToastMessage({
        type: 'success',
        text: `[${sourceStation}] Đã giao món của ${tableName} cho NV: ${assignedWaiter}`
      });
      setTimeout(() => setToastMessage(null), 3000);
      fetchData();
    } catch (e) {}
  };

  const handleUndoAction = async (record) => {
    if (!record || !record.itemIds) return;

    const nextRestored = [...new Set([...restoredItemIds, ...record.itemIds])];
    setRestoredItemIds(nextRestored);
    localStorage.setItem('pos_restored_item_ids', JSON.stringify(nextRestored));

    setLocalServedItemIds(prev => prev.filter(id => !record.itemIds.includes(id)));

    const nextActions = recentActions.filter(r => r.id !== record.id);
    setRecentActions(nextActions);
    localStorage.setItem('pos_kds_undo_actions', JSON.stringify(nextActions));

    const nextLogs = dispatchLogs.filter(l => l.id !== record.id);
    setDispatchLogs(nextLogs);
    localStorage.setItem('pos_pass_dispatch_logs', JSON.stringify(nextLogs));

    try {
      const res = await fetch(`${API_BASE}/api/kitchen/batch-unserve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_ids: record.itemIds })
      }).catch(() => null);

      if (!res || !res.ok) {
        const orderIdsToRestore = record.orderIds || [];
        await Promise.all(
          orderIdsToRestore.map(oid =>
            fetch(`${API_BASE}/api/kitchen/orders/${oid}/confirm`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}` }
            }).catch(() => null)
          )
        );
      }

      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'ORDER_CONFIRMED', payload: { restored_ids: record.itemIds } });
      bc.close();

      setToastMessage({
        type: 'success',
        text: `Đã hoàn tác & khôi phục lại: ${record.summary}`
      });
      setTimeout(() => setToastMessage(null), 3000);
      await fetchData();
    } catch (e) {
      console.error('Lỗi hoàn tác:', e);
    }
  };

  const openReportOutOfStockModal = (e, item) => {
    if (e) e.stopPropagation();
    const itemName = item.product_name || item.name;
    const productId = item.product_id || item.menu_item_id || item.id;
    const unitPrice = Number(item.unit_price || item.price || 52000);
    const qty = Number(item.quantity || 1);

    setOutOfStockData({
      itemId: item.id,
      allItemIds: item.allItemIds || [item.id],
      productId,
      itemName,
      quantity: qty,
      deductedAmount: unitPrice * qty,
      tableId: item.tableId,
      tableName: item.tableName,
      orderId: item.orderId,
      orderCode: item.orderCode
    });
    setShowOutOfStockModal(true);
  };

  const confirmReportOutOfStock = async () => {
    if (!outOfStockData) return;
    const { itemId, allItemIds, productId, itemName, quantity, deductedAmount, tableId, tableName, orderId, orderCode } = outOfStockData;

    const savedNames = JSON.parse(localStorage.getItem('pos_out_of_stock_names') || '[]');
    const nextNames = [...new Set([...savedNames, itemName])];
    localStorage.setItem('pos_out_of_stock_names', JSON.stringify(nextNames));
    setOutOfStockNames(nextNames);

    const savedRejectedIds = JSON.parse(localStorage.getItem('pos_rejected_item_ids') || '[]');
    const nextRejectedIds = [...new Set([...savedRejectedIds, ...(allItemIds || [itemId])])];
    localStorage.setItem('pos_rejected_item_ids', JSON.stringify(nextRejectedIds));
    setRejectedItemIds(nextRejectedIds);

    const alertPayload = {
      id: `ALERT-${Date.now()}`,
      item_id: itemId,
      product_id: productId,
      product_name: itemName,
      quantity,
      deducted_amount: deductedAmount,
      table_id: tableId,
      table_name: tableName,
      order_id: orderId,
      order_code: orderCode,
      timestamp: Date.now()
    };

    try {
      const bc = new BroadcastChannel('smartpos_channel');
      bc.postMessage({ type: 'KITCHEN_OUT_OF_STOCK', payload: alertPayload });
      bc.close();

      await fetch(`${API_BASE}/api/kitchen/out-of-stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: productId,
          product_name: itemName,
          order_item_id: itemId,
          order_id: orderId
        })
      }).catch(() => null);

      setShowOutOfStockModal(false);
      setOutOfStockData(null);
      setToastMessage({ type: 'success', text: `Đã báo hết "${itemName}" (${tableName})` });
      setTimeout(() => setToastMessage(null), 3000);
      fetchData();
    } catch (err) {}
  };

  const totalKitchenDishesCount = allKitchenDishesSummary.reduce((s, d) => s + d.totalQty, 0);
  const defaultWaiterName = staffList[0]?.full_name || localStorage.getItem('full_name') || 'Nhân viên phục vụ';

  // =========================================================================
  // THUẬT TOÁN XẾP PHIẾU 5 CỘT THEO ĐÚNG THỨ TỰ THỜI GIAN ĐẶT (FIFO)
  // =========================================================================
  const renderPackedMasonryColumns = (tickets, columnCount = 5, isInteractivePass = false, stationLabel = 'PASS Bếp') => {
    if (tickets.length === 0) {
      return (
        <div className="h-100 bg-white rounded-3 border d-flex flex-column align-items-center justify-content-center text-muted">
          <CheckCircle2 size={48} className="mb-2 opacity-25 text-success" />
          <h6 className="fw-bold text-dark mb-1">Hiện không có phiếu nào đang chờ</h6>
          <span className="small">Khi có đơn mới được duyệt, các phiếu sẽ xếp theo đúng thứ tự thời gian đặt (FIFO)</span>
        </div>
      );
    }

    const cols = Array.from({ length: columnCount }, () => []);
    const colWeights = Array.from({ length: columnCount }, () => 0);

    tickets.forEach((ticket) => {
      const itemsList = ticket.activeKitchenItems || ticket.activeBarItems || [];
      const weight = 2 + itemsList.length;

      let shortestColIdx = 0;
      for (let i = 1; i < columnCount; i++) {
        if (colWeights[i] < colWeights[shortestColIdx]) {
          shortestColIdx = i;
        }
      }

      cols[shortestColIdx].push(ticket);
      colWeights[shortestColIdx] += weight;
    });

    return (
      <div className="packed-columns-wrapper" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
        {cols.map((colTickets, colIdx) => (
          <div key={colIdx} className="packed-column-stack">
            {colTickets.map((ticket) => {
              const itemsList = ticket.activeKitchenItems || ticket.activeBarItems || [];
              const currentWaiter = selectedWaiterByTicket[ticket.ticketKey] || defaultWaiterName;
              const totalParts = itemsList.reduce((s, i) => s + i.quantity, 0);

              return (
                <div
                  key={ticket.ticketKey}
                  className="packed-ticket-card"
                  style={{ borderTop: `3.5px solid ${ticket.topBarColor || '#003e9c'}` }}
                >
                  {/* 1. ĐỈNH THẺ: SỐ THỨ TỰ + TÊN BÀN + NHÃN LƯỢT GỌI THÊM + GIỜ ĐẶT THẬT */}
                  <div className="packed-ticket-header" style={{ backgroundColor: ticket.headerBg || '#eff6ff' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="seq-pill" style={{ backgroundColor: ticket.topBarColor || '#003e9c' }}>
                          #{ticket.seqNumber}
                        </span>
                        <span className="fw-bolder text-dark" style={{ fontSize: '15px' }}>
                          {ticket.tableName}
                        </span>
                        {ticket.isAddOnBatch && (
                          <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '9.5px', padding: '2px 5px' }}>
                            +Gọi thêm (L{ticket.batchNumber})
                          </span>
                        )}
                      </div>
                      <span
                        className="badge rounded-pill fw-bold d-flex align-items-center gap-1 flex-shrink-0"
                        style={{ backgroundColor: ticket.timerBg, color: ticket.timerText, fontSize: '10.5px', padding: '2px 7px' }}
                      >
                        <Clock size={10} /> {ticket.elapsedLabel}
                      </span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center text-secondary" style={{ fontSize: '10.5px' }}>
                      <span className="text-truncate" title={`${ticket.orderCode} • Đặt lúc ${ticket.orderTimeText}`}>
                        <b>{ticket.orderCode}</b> • Lúc {ticket.orderTimeText}
                      </span>
                      <span className="fw-bold text-dark">{itemsList.length} món ({totalParts})</span>
                    </div>
                  </div>

                  {/* 2. THÂN THẺ */}
                  <div className="packed-ticket-body">
                    {itemsList.map((item) => (
                      <div key={item.id} className="packed-item-line">
                        <div className="flex-grow-1 pe-1" style={{ minWidth: 0 }}>
                          <div className="d-flex align-items-baseline gap-1">
                            <span className="fw-bolder text-danger flex-shrink-0" style={{ fontSize: '13.5px' }}>
                              {item.quantity}x
                            </span>
                            <span className="fw-bold text-dark" style={{ fontSize: '13px', lineHeight: '1.22', wordBreak: 'break-word' }}>
                              {item.product_name || item.name}
                            </span>
                          </div>
                          {item.note && (
                            <div className="item-note-tag">
                              ⚠️ {item.note}
                            </div>
                          )}
                        </div>

                        {isInteractivePass && (
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => openReportOutOfStockModal(e, item)}
                              className="btn-mini-out"
                              title="Báo hết món này"
                            >
                              Hết
                            </button>
                            <button
                              onClick={() => handleAssignWaiterAndServe(ticket.ticketKey, ticket.tableName, [item], stationLabel)}
                              className="btn-mini-serve"
                              title="Giao lẻ món này"
                            >
                              Giao
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 3. ĐÁY THẺ */}
                  {isInteractivePass ? (
                    <div className="packed-ticket-footer">
                      <div className="d-flex align-items-center gap-1 mb-1">
                        <UserCheck size={12} className="text-primary flex-shrink-0" />
                        <select
                          value={currentWaiter}
                          onChange={(e) => setSelectedWaiterByTicket({ ...selectedWaiterByTicket, [ticket.ticketKey]: e.target.value })}
                          className="form-select form-select-sm fw-bold text-dark rounded-1 border-secondary-subtle"
                          style={{ fontSize: '11.5px', height: '25px', padding: '1px 22px 1px 6px' }}
                        >
                          {staffList.map(st => (
                            <option key={st.id} value={st.full_name}>
                              NV: {st.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleAssignWaiterAndServe(ticket.ticketKey, ticket.tableName, itemsList, stationLabel)}
                        className="btn-packed-submit"
                      >
                        <Check size={13} /> Giao {currentWaiter} ({totalParts})
                      </button>
                    </div>
                  ) : (
                    <div className="packed-ticket-footer d-flex justify-content-between align-items-center text-secondary py-1">
                      <span style={{ fontSize: '10.5px' }}>Đặt lúc {ticket.orderTimeText}</span>
                      <span className="badge bg-primary bg-opacity-10 text-primary fw-bold" style={{ fontSize: '10.5px', padding: '2px 6px' }}>
                        Tổng: {totalParts} phần
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="vh-100 d-flex flex-column select-none" style={{ backgroundColor: '#e2e8f0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      
      {/* TOP HEADER */}
      <header className="px-3 py-2 d-flex flex-wrap justify-content-between align-items-center gap-2 text-white shadow-sm" style={{ backgroundColor: '#003e9c' }}>
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-white text-primary p-1 rounded-2 d-flex align-items-center justify-content-center">
              <ChefHat size={19} />
            </div>
            <div>
              <h6 className="mb-0 fw-bolder text-white" style={{ fontSize: '14.5px' }}>Hệ Thống Điều Phối Bếp & Bar</h6>
              <small className="text-white-50" style={{ fontSize: '10.5px' }}>Xếp theo đúng thứ tự lượt gọi món (FIFO) • Thời gian thực</small>
            </div>
          </div>

          <div className="d-flex gap-1 ms-2">
            <button
              onClick={() => setScreenMode('KITCHEN_SCREEN')}
              className={`light-nav-tab ${screenMode === 'KITCHEN_SCREEN' ? 'active' : ''}`}
            >
              <Eye size={14} />
              <span>1. Màn Hình Bếp (Chỉ Xem)</span>
              <span className="tab-count">{kitchenOrderTickets.length} phiếu</span>
            </button>

            <button
              onClick={() => setScreenMode('PASS_SCREEN')}
              className={`light-nav-tab ${screenMode === 'PASS_SCREEN' ? 'active' : ''}`}
            >
              <UserCheck size={14} />
              <span>2. Trạm Tiếp Thực Bếp (PASS)</span>
              <span className={`tab-count ${kitchenOrderTickets.length > 0 ? 'bg-danger text-white' : ''}`}>
                {kitchenOrderTickets.length} phiếu
              </span>
            </button>

            <button
              onClick={() => setScreenMode('BAR_SCREEN')}
              className={`light-nav-tab ${screenMode === 'BAR_SCREEN' ? 'active' : ''}`}
            >
              <Wine size={14} />
              <span>3. Màn Hình Bar (Tự Giao NV)</span>
              <span className="tab-count">{barFastItems.length + barCraftOrderTickets.length}</span>
            </button>
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center">
          <button
            onClick={() => setShowUndoModal(true)}
            disabled={recentActions.length === 0}
            className="btn btn-sm btn-light rounded-pill px-3 py-1 fw-bold text-dark d-flex align-items-center gap-1"
            style={{ fontSize: '12px' }}
          >
            <RotateCcw size={13} /> Hoàn tác ({recentActions.length})
          </button>

          <button
            onClick={toggleSound}
            className="btn btn-sm btn-light rounded-pill px-3 py-1 fw-bold text-dark d-flex align-items-center gap-1"
            style={{ fontSize: '12px' }}
          >
            {soundEnabled ? <Volume2 size={14} className="text-success" /> : <VolumeX size={14} className="text-secondary" />}
            <span className="d-none d-xl-inline">{soundEnabled ? 'Âm báo: Bật' : 'Âm báo: Tắt'}</span>
          </button>

          <button onClick={fetchData} className="btn btn-sm btn-light rounded-circle p-1 text-dark" title="Làm mới">
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          </button>

          <button
            onClick={() => { window.location.href = '/login'; }}
            className="btn btn-sm btn-danger rounded-pill px-3 py-1 fw-bold d-flex align-items-center gap-1"
            style={{ fontSize: '12px' }}
          >
            <LogOut size={13} /> Thoát
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MÀN HÌNH 1: BẾP (CHỈ XEM) */}
      {/* ================================================================= */}
      {screenMode === 'KITCHEN_SCREEN' && (
        <div className="flex-grow-1 p-2 overflow-hidden">
          <div className="kds-main-split h-100">
            <div className="kds-left-tickets h-100 overflow-auto pe-1">
              {renderPackedMasonryColumns(kitchenOrderTickets, 5, false, 'PASS Bếp')}
            </div>

            <div className="right-panel-box h-100">
              <div className="right-panel-header">
                <div className="d-flex align-items-center gap-2">
                  <Utensils size={16} className="text-primary" />
                  <span className="fw-bolder text-dark" style={{ fontSize: '13.5px' }}>
                    TẤT CẢ MÓN CẦN NẤU
                  </span>
                </div>
                <span className="badge rounded-pill bg-primary text-white fw-bold px-2 py-1" style={{ fontSize: '11.5px' }}>
                  Tổng: {totalKitchenDishesCount}
                </span>
              </div>

              <div className="right-panel-body">
                {allKitchenDishesSummary.length === 0 ? (
                  <div className="text-center text-muted py-5 small">Chưa có món ăn nào cần chế biến</div>
                ) : (
                  allKitchenDishesSummary.map((dish, idx) => {
                    const palette = SUMMARY_PALETTES[idx % SUMMARY_PALETTES.length];
                    return (
                      <div
                        key={dish.name}
                        className="right-inner-card d-flex justify-content-between align-items-center"
                        style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
                      >
                        <div className="pe-2" style={{ minWidth: 0 }}>
                          <div className="fw-bolder" style={{ color: palette.text, fontSize: '14px', lineHeight: '1.25' }}>
                            {dish.name}
                          </div>
                          <div className="mt-1 fw-semibold text-secondary" style={{ fontSize: '11.5px', lineHeight: '1.3' }}>
                            {dish.tablesText}
                          </div>
                        </div>
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center fw-bolder flex-shrink-0"
                          style={{
                            backgroundColor: palette.badgeBg,
                            color: palette.badgeText,
                            minWidth: '38px',
                            height: '38px',
                            fontSize: '16px',
                            padding: '0 8px'
                          }}
                        >
                          {dish.totalQty}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MÀN HÌNH 2: TRẠM TIẾP THỰC BẾP */}
      {/* ================================================================= */}
      {screenMode === 'PASS_SCREEN' && (
        <div className="flex-grow-1 p-2 overflow-hidden">
          <div className="kds-main-split h-100">
            <div className="kds-left-tickets h-100 overflow-auto pe-1">
              {renderPackedMasonryColumns(kitchenOrderTickets, 5, true, 'PASS Bếp')}
            </div>

            <div className="right-split-column h-100">
              <div className="right-panel-box">
                <div className="right-panel-header">
                  <span className="fw-bolder text-dark d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                    <Utensils size={15} className="text-primary" /> TẤT CẢ MÓN ĐANG CHỜ
                  </span>
                  <span className="badge rounded-pill bg-primary text-white fw-bold">
                    {totalKitchenDishesCount} phần
                  </span>
                </div>
                <div className="right-panel-body">
                  {allKitchenDishesSummary.length === 0 ? (
                    <div className="text-center text-muted py-4 small">Không có món đang chờ</div>
                  ) : (
                    allKitchenDishesSummary.map((dish, idx) => {
                      const palette = SUMMARY_PALETTES[idx % SUMMARY_PALETTES.length];
                      return (
                        <div
                          key={dish.name}
                          className="right-inner-card d-flex justify-content-between align-items-center"
                          style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
                        >
                          <div className="pe-2" style={{ minWidth: 0 }}>
                            <div className="fw-bolder" style={{ color: palette.text, fontSize: '13.5px', lineHeight: '1.2' }}>
                              {dish.name}
                            </div>
                            <div className="mt-1 fw-semibold text-secondary" style={{ fontSize: '11px' }}>
                              {dish.tablesText}
                            </div>
                          </div>
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center fw-bolder flex-shrink-0"
                            style={{
                              backgroundColor: palette.badgeBg,
                              color: palette.badgeText,
                              minWidth: '34px',
                              height: '34px',
                              fontSize: '15px',
                              padding: '0 6px'
                            }}
                          >
                            {dish.totalQty}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="right-panel-box">
                <div className="right-panel-header">
                  <span className="fw-bolder text-dark d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                    <History size={15} className="text-success" /> LỊCH SỬ GIAO NHÂN VIÊN
                  </span>
                  <span className="badge bg-secondary">{dispatchLogs.length} lượt</span>
                </div>

                <div className="right-panel-body">
                  {dispatchLogs.length === 0 ? (
                    <div className="text-center text-muted py-4 small">Chưa có lượt bàn giao nào</div>
                  ) : (
                    dispatchLogs.map((log, index) => (
                      <div key={index} className="right-inner-card bg-light border">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-bolder text-dark" style={{ fontSize: '13px' }}>
                            {log.tableName}
                            <small className="badge bg-white text-secondary border ms-1">{log.station}</small>
                          </span>
                          <span className="text-muted" style={{ fontSize: '10.5px' }}>{log.time}</span>
                        </div>
                        <div className="text-dark fw-semibold mb-1" style={{ fontSize: '12px' }}>{log.itemsText}</div>
                        <div className="d-flex align-items-center gap-1 text-success fw-bold" style={{ fontSize: '11.5px' }}>
                          <UserCheck size={12} /> NV nhận: {log.waiterName}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MÀN HÌNH 3: QUẦY BAR */}
      {/* ================================================================= */}
      {screenMode === 'BAR_SCREEN' && (
        <div className="flex-grow-1 p-2 overflow-hidden">
          <div className="bar-main-split h-100">
            
            <div className="right-panel-box h-100">
              <div className="right-panel-header" style={{ backgroundColor: '#ecfdf5' }}>
                <div>
                  <div className="fw-bolder text-success" style={{ fontSize: '13px' }}>1. LUỒNG PHỤC VỤ NHANH</div>
                  <div className="text-secondary" style={{ fontSize: '10.5px' }}>Nước đóng chai, lon, bia (Giao luôn)</div>
                </div>
                <span className="badge bg-success text-white">{barFastItems.length}</span>
              </div>

              <div className="right-panel-body">
                {barFastItems.length === 0 ? (
                  <div className="text-center text-muted py-5 small">Không có đơn nước đóng chai/lon</div>
                ) : (
                  barFastItems.map(item => {
                    const fastKey = `FAST_${item.id}`;
                    const currentWaiter = selectedWaiterByTicket[fastKey] || defaultWaiterName;
                    return (
                      <div key={item.id} className="right-inner-card border bg-light">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="badge bg-primary text-white">
                            {item.tableName} {item.isAddOnBatch ? `(L${item.batchNumber})` : ''}
                          </span>
                          <span className="text-muted" style={{ fontSize: '10.5px' }}>{item.orderCode} • {item.orderTimeText}</span>
                        </div>
                        <div className="fw-bold text-dark mb-2" style={{ fontSize: '13.5px' }}>
                          <span className="text-danger me-1">{item.quantity}x</span>
                          {item.product_name || item.name}
                        </div>

                        <select
                          value={currentWaiter}
                          onChange={(e) => setSelectedWaiterByTicket({ ...selectedWaiterByTicket, [fastKey]: e.target.value })}
                          className="form-select form-select-sm fw-bold text-dark mb-2 rounded-1"
                          style={{ fontSize: '11.5px', height: '26px', padding: '1px 20px 1px 6px' }}
                        >
                          {staffList.map(st => (
                            <option key={st.id} value={st.full_name}>
                              NV: {st.full_name}
                            </option>
                          ))}
                        </select>

                        <div className="d-flex gap-1">
                          <button onClick={(e) => openReportOutOfStockModal(e, item)} className="btn-mini-out">
                            Hết
                          </button>
                          <button
                            onClick={() => handleAssignWaiterAndServe(fastKey, item.tableName, [item], 'Quầy Bar')}
                            className="btn btn-sm btn-success flex-fill rounded-1 fw-bold py-1"
                            style={{ fontSize: '11.5px' }}
                          >
                            ✓ Giao {currentWaiter}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="h-100 overflow-auto px-1">
              {renderPackedMasonryColumns(barCraftOrderTickets, 4, true, 'Quầy Bar')}
            </div>

            <div className="right-split-column h-100">
              <div className="right-panel-box">
                <div className="right-panel-header">
                  <span className="fw-bolder text-dark" style={{ fontSize: '13px' }}>TẤT CẢ MÓN CẦN PHA</span>
                  <span className="badge rounded-pill bg-primary text-white fw-bold">
                    {allBarDrinksSummary.reduce((s, d) => s + d.totalQty, 0)} ly
                  </span>
                </div>
                <div className="right-panel-body">
                  {allBarDrinksSummary.length === 0 ? (
                    <div className="text-center text-muted py-4 small">Chưa có món nước cần pha</div>
                  ) : (
                    allBarDrinksSummary.map((drink, idx) => {
                      const palette = SUMMARY_PALETTES[(idx + 2) % SUMMARY_PALETTES.length];
                      return (
                        <div
                          key={drink.name}
                          className="right-inner-card d-flex justify-content-between align-items-center"
                          style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
                        >
                          <div className="pe-2" style={{ minWidth: 0 }}>
                            <div className="fw-bolder" style={{ color: palette.text, fontSize: '13.5px', lineHeight: '1.25' }}>
                              {drink.name}
                            </div>
                            <div className="mt-1 text-secondary fw-semibold" style={{ fontSize: '11px' }}>
                              {drink.tablesText}
                            </div>
                          </div>
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center fw-bolder flex-shrink-0"
                            style={{
                              backgroundColor: palette.badgeBg,
                              color: palette.badgeText,
                              minWidth: '34px',
                              height: '34px',
                              fontSize: '15px',
                              padding: '0 6px'
                            }}
                          >
                            {drink.totalQty}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="right-panel-box">
                <div className="right-panel-header">
                  <span className="fw-bolder text-dark d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                    <History size={15} className="text-success" /> LỊCH SỬ GIAO NHÂN VIÊN
                  </span>
                  <span className="badge bg-secondary">{dispatchLogs.length} lượt</span>
                </div>
                <div className="right-panel-body">
                  {dispatchLogs.length === 0 ? (
                    <div className="text-center text-muted py-4 small">Chưa có lượt giao nước nào</div>
                  ) : (
                    dispatchLogs.map((log, index) => (
                      <div key={index} className="right-inner-card bg-light border">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-bolder text-dark" style={{ fontSize: '13px' }}>
                            {log.tableName}
                            <small className="badge bg-white text-secondary border ms-1">{log.station}</small>
                          </span>
                          <span className="text-muted" style={{ fontSize: '10.5px' }}>{log.time}</span>
                        </div>
                        <div className="text-dark fw-semibold mb-1" style={{ fontSize: '12px' }}>{log.itemsText}</div>
                        <div className="d-flex align-items-center gap-1 text-success fw-bold" style={{ fontSize: '11.5px' }}>
                          <UserCheck size={12} /> NV nhận: {log.waiterName}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMessage && (
        <div
          className="position-fixed bottom-0 end-0 m-4 px-3 py-2 rounded-3 shadow text-white fw-bold d-flex align-items-center gap-2"
          style={{ zIndex: 9999, backgroundColor: '#10b981' }}
        >
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '13px' }}>{toastMessage.text}</span>
        </div>
      )}

      {/* MODAL HOÀN TÁC */}
      {showUndoModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} onClick={() => setShowUndoModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header bg-primary text-white py-3">
                <h6 className="modal-title fw-bold mb-0">Hoàn Tác Lượt Giao Vừa Bấm ({recentActions.length})</h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowUndoModal(false)} />
              </div>
              <div className="modal-body p-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {recentActions.length === 0 ? (
                  <div className="text-center text-muted py-4">Không có thao tác nào cần hoàn tác.</div>
                ) : (
                  recentActions.map(rec => (
                    <div key={rec.id} className="p-2 mb-2 border rounded-3 bg-light d-flex justify-content-between align-items-center gap-2">
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>{rec.summary}</div>
                        <small className="text-muted">Trạm: {rec.station} • Lúc: {rec.timeLabel}</small>
                      </div>
                      <button
                        onClick={() => { handleUndoAction(rec); setShowUndoModal(false); }}
                        className="btn btn-sm btn-warning fw-bold rounded-pill px-3 flex-shrink-0"
                      >
                        <RotateCcw size={13} className="me-1" /> Khôi phục
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BÁO HẾT MÓN */}
      {showOutOfStockModal && outOfStockData && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 3000 }} onClick={() => setShowOutOfStockModal(false)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-body p-4 text-center">
                <AlertTriangle size={36} className="text-danger mb-2" />
                <h6 className="fw-bold text-dark mb-1">Xác Nhận Báo Hết Món</h6>
                <div className="bg-light p-3 rounded-3 my-3 border text-start small">
                  <div className="mb-1">Món: <b className="text-danger">{outOfStockData.itemName}</b></div>
                  <div>Vị trí: <b className="text-dark">{outOfStockData.tableName} ({outOfStockData.orderCode})</b></div>
                </div>
                <div className="d-flex gap-2">
                  <button onClick={() => setShowOutOfStockModal(false)} className="btn btn-sm btn-light border fw-bold flex-fill py-2 rounded-3">
                    Hủy
                  </button>
                  <button onClick={confirmReportOutOfStock} className="btn btn-sm btn-danger fw-bold flex-fill py-2 rounded-3">
                    Đồng ý Báo Hết
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .light-nav-tab {
          background: rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.9);
          border: none;
          padding: 6px 13px;
          font-size: 12.5px;
          font-weight: 700;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .light-nav-tab:hover {
          background: rgba(255, 255, 255, 0.24);
          color: #ffffff;
        }
        .light-nav-tab.active {
          background: #ffffff;
          color: #003e9c;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        }
        .tab-count {
          background: rgba(15, 23, 42, 0.12);
          padding: 1px 6px;
          border-radius: 6px;
          font-size: 11px;
        }

        .kds-main-split {
          display: grid;
          grid-template-columns: minmax(0, 3.8fr) minmax(275px, 1fr);
          gap: 10px;
        }

        .bar-main-split {
          display: grid;
          grid-template-columns: minmax(225px, 0.95fr) minmax(0, 3fr) minmax(265px, 1.05fr);
          gap: 10px;
        }

        .right-split-column {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
          min-height: 0;
        }

        .right-panel-box {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
        }
        .right-panel-header {
          padding: 10px 14px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .right-panel-body {
          padding: 12px 14px;
          flex-grow: 1;
          overflow-y: auto;
        }
        .right-inner-card {
          padding: 10px 12px;
          margin-bottom: 9px;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }
        .right-inner-card:last-child {
          margin-bottom: 0;
        }

        .packed-columns-wrapper {
          display: grid;
          gap: 8px;
          align-items: start;
        }
        .packed-column-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .packed-ticket-card {
          background: #ffffff;
          border: 1px solid #94a3b8;
          border-radius: 8px;
          height: auto;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
        }
        .packed-ticket-header {
          padding: 6px 10px;
          border-bottom: 1px solid #cbd5e1;
        }
        .seq-pill {
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .packed-ticket-body {
          padding: 2px 10px;
          height: auto;
        }
        .packed-item-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: 1px dashed #e2e8f0;
        }
        .packed-item-line:last-child {
          border-bottom: none;
        }
        .item-note-tag {
          color: #b45309;
          background: #fef3c7;
          font-size: 10.5px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
          margin-top: 2px;
          display: inline-block;
        }
        .btn-mini-out {
          background: #ffffff;
          color: #dc2626;
          border: 1px solid #fca5a5;
          padding: 1px 6px;
          font-size: 10.5px;
          font-weight: 700;
          border-radius: 4px;
        }
        .btn-mini-out:hover {
          background: #dc2626;
          color: #ffffff;
        }
        .btn-mini-serve {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #6ee7b7;
          padding: 1px 6px;
          font-size: 10.5px;
          font-weight: 700;
          border-radius: 4px;
        }
        .btn-mini-serve:hover {
          background: #059669;
          color: #ffffff;
        }
        .packed-ticket-footer {
          padding: 6px 10px;
          background: #f8fafc;
          border-top: 1px solid #cbd5e1;
        }
        .btn-packed-submit {
          width: 100%;
          background: #16a34a;
          color: #ffffff;
          border: none;
          padding: 5px 8px;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: background 0.15s ease;
        }
        .btn-packed-submit:hover {
          background: #15803d;
        }
      `}} />
    </div>
  );
}