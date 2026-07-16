/* ═══════════════════════════════════════════════════════════════════════
   capacitor-platform.js — Capacitor 平台适配层（内核）
   在 index.html 中最先加载
   ═══════════════════════════════════════════════════════════════════════ */

const CapacitorPlatform = (() => {
  const BUILTIN_REMOTE = 'http://39.104.75.202';

  const isNative = () => typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
  const isAndroid = () => isNative() && window.Capacitor.getPlatform() === 'android';
  const isIOS = () => isNative() && window.Capacitor.getPlatform() === 'ios';
  const isElectron = () => typeof window.dayOrderDesktop !== 'undefined';
  const isWeb = () => !isNative() && !isElectron();

  const getApiBase = () => {
    if (isElectron()) return '';
    // 本地 FastAPI 开发服务器：同源
    if ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') && location.port === '8000') return '';
    // 其他所有情况：使用远程服务器
    return BUILTIN_REMOTE;
  };

  let online = navigator.onLine;
  const networkListeners = [];
  window.addEventListener('online', () => { online = true; networkListeners.forEach(fn => fn(true)); });
  window.addEventListener('offline', () => { online = false; networkListeners.forEach(fn => fn(false)); });
  const isOnline = () => online;
  const onNetworkChange = (fn) => { networkListeners.push(fn); return () => { const i = networkListeners.indexOf(fn); if (i >= 0) networkListeners.splice(i, 1); }; };

  let idb = null;
  const initDB = () => new Promise((resolve) => {
    const req = indexedDB.open('dayorder_offline', 1);
    req.onupgradeneeded = (e) => {
      ['tags','record_types','records','journal_entries','daily_task_templates','range_task_categories','range_reminders','milestone_days','attachments','work_logs','timer_sessions','weather_cities'].forEach(t => {
        if (!e.target.result.objectStoreNames.contains(t)) e.target.result.createObjectStore(t, { keyPath: 'id' });
      });
    };
    req.onsuccess = (e) => { idb = e.target.result; resolve(); };
    req.onerror = () => { idb = null; resolve(); };
  });

  const localGet = async (table, id) => {
    if (!idb) return null;
    return new Promise(r => {
      const tx = idb.transaction(table, 'readonly');
      const req = tx.objectStore(table).get(id);
      req.onsuccess = () => r(req.result ? req.result.data : null);
      req.onerror = () => r(null);
    });
  };

  const localSet = async (table, id, data) => {
    if (!idb) return;
    return new Promise(r => {
      const tx = idb.transaction(table, 'readwrite');
      tx.objectStore(table).put({ id, data, ts: Date.now() });
      tx.oncomplete = () => r();
      tx.onerror = () => r();
    });
  };

  const localDelete = async (table, id) => {
    if (!idb) return;
    return new Promise(r => {
      const tx = idb.transaction(table, 'readwrite');
      tx.objectStore(table).delete(id);
      tx.oncomplete = () => r();
      tx.onerror = () => r();
    });
  };

  const localGetAll = async (table) => {
    if (!idb) return [];
    return new Promise(r => {
      const tx = idb.transaction(table, 'readonly');
      const req = tx.objectStore(table).getAll();
      req.onsuccess = () => r((req.result || []).map(x => x.data));
      req.onerror = () => r([]);
    });
  };

  const getSyncQueue = () => { try { return JSON.parse(localStorage.getItem('dayorder.changeQueue') || '[]'); } catch { return []; } };
  const addToSyncQueue = (change) => {
    const q = getSyncQueue();
    if (change.operation === 'update') {
      const ei = q.findIndex(c => c.table === change.table && c.record_id === change.record_id && c.operation === 'update');
      if (ei >= 0) { q[ei] = change; localStorage.setItem('dayorder.changeQueue', JSON.stringify(q)); return; }
    }
    if (change.operation === 'delete') {
      const i = q.findIndex(c => c.table === change.table && c.record_id === change.record_id && c.operation === 'update');
      if (i >= 0) q.splice(i, 1);
    }
    q.push(change);
    localStorage.setItem('dayorder.changeQueue', JSON.stringify(q));
  };
  const clearSyncQueue = () => localStorage.setItem('dayorder.changeQueue', '[]');

  const init = async () => { await initDB(); };

  // 将相对路径转为绝对远程 URL（用于图片等静态资源）
  const resolveUrl = (path) => {
    if (!path || path.startsWith('http')) return path;
    const base = getApiBase();
    if (base) return base + path;
    return path; // Electron/本地：保持相对路径
  };

  // ── 离线状态指示器 ──
  let indicatorEl = null;
  const showOfflineIndicator = () => {
    if (indicatorEl) return;
    indicatorEl = document.createElement('div');
    indicatorEl.id = 'offline-indicator';
    indicatorEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#e74c3c;color:#fff;text-align:center;padding:4px;font-size:13px;transition:transform 0.3s;transform:translateY(-100%);';
    indicatorEl.textContent = '📡 离线模式 — 数据已保存到本地，联网后自动同步';
    document.body.appendChild(indicatorEl);
    requestAnimationFrame(() => { indicatorEl.style.transform = 'translateY(0)'; });
  };
  const hideOfflineIndicator = () => {
    if (!indicatorEl) return;
    indicatorEl.style.transform = 'translateY(-100%)';
    setTimeout(() => { if (indicatorEl) { indicatorEl.remove(); indicatorEl = null; } }, 300);
  };

  // 网络变化时更新指示器
  window.addEventListener('offline', showOfflineIndicator);
  window.addEventListener('online', hideOfflineIndicator);
  if (!navigator.onLine) showOfflineIndicator();

  return {
    isNative, isAndroid, isIOS, isElectron, isWeb,
    getApiBase, BUILTIN_REMOTE, resolveUrl,
    isOnline, onNetworkChange,
    localGet, localSet, localDelete, localGetAll,
    getSyncQueue, addToSyncQueue, clearSyncQueue,
    init,
  };
})();

CapacitorPlatform.init();
