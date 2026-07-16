/* ═══════════════════════════════════════════════════════════════════════
   apiClient.js — 统一 API 请求层（内置离线支持）
   
   API 地址由 CapacitorPlatform 内核自动决定：
   - Electron / 本地8000端口 → 同源 /api
   - Capacitor 移动端 / 远程 → http://39.104.75.202/api
   
   离线策略：
   - GET 请求：优先网络，失败时读 IndexedDB 缓存
   - POST/PATCH/PUT：网络失败时写入本地 + 入同步队列
   - DELETE：网络失败时标记删除 + 入同步队列
   - 网络恢复时自动推送队列
   ═══════════════════════════════════════════════════════════════════════ */

const API = (() => {
  if (typeof CapacitorPlatform !== 'undefined') {
    const base = CapacitorPlatform.getApiBase();
    if (base) return base.replace(/\/$/, "") + "/api";
  }
  // Electron 桌面端：走本地后端（本地后端通过 CLOUD_API_URL 自动转发到云端）
  if (window.__DAYORDER_ELECTRON__) {
    return "/api";
  }
  return "/api";
})();

// ── 离线缓存 key 生成 ──
function cacheKey(path) {
  return 'dayorder.cache.' + path.replace(/[^a-zA-Z0-9]/g, '_');
}

// ── 从路径推断表名（用于离线写入） ──
function tableFromPath(path) {
  const m = path.match(/^\/([a-z][a-z-]*?)(?:s\b|\/|$)/);
  if (!m) return null;
  const t = m[1].replace(/-/g, '_');
  const map = {
    tag: 'tags', record_type: 'record_types', record: 'records',
    journal: 'journal_entries', daily_task_template: 'daily_task_templates',
    range_task_category: 'range_task_categories', range_reminder: 'range_reminders',
    milestone_day: 'milestone_days', attachment: 'attachments',
    work_log: 'work_logs', timer_session: 'timer_sessions',
    weather_city: 'weather_cities',
  };
  return map[t] || t;
}

// ── 核心请求函数 ──
async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isRead = method === 'GET';
  const isWrite = ['POST', 'PATCH', 'PUT'].includes(method);
  const isDelete = method === 'DELETE';
  const isAuth = path.startsWith('/auth/');

  // 登录/注册必须走本地后端（创建本地 session）
  const baseUrl = isAuth ? "/api" : API;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  // ── 在线：正常请求 + 缓存 ──
  if (navigator.onLine) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { ...options, headers });

      if (!response.ok) {
        let detail = response.statusText;
        try { const body = await response.json(); detail = body.detail || detail; } catch {}
        const error = new Error(Array.isArray(detail) ? detail.map(i => i.msg).join('; ') : detail);
        error.status = response.status;
        throw error;
      }

      if (response.status === 204) return null;
      const data = await response.json();

      // 缓存 GET 响应
      if (isRead && data && !isAuth) {
        try { localStorage.setItem(cacheKey(path), JSON.stringify({ data, ts: Date.now() })); } catch {}
      }

      return data;
    } catch (error) {
      // 网络错误时走离线逻辑
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        return handleOffline(path, options, method, isRead, isWrite, isDelete, isAuth);
      }
      throw error;
    }
  }

  // ── 离线 ──
  return handleOffline(path, options, method, isRead, isWrite, isDelete, isAuth);
}

// ── 离线处理 ──
async function handleOffline(path, options, method, isRead, isWrite, isDelete, isAuth) {
  // 认证请求不能离线
  if (isAuth) throw new Error('离线模式：请连接网络后登录');

  // GET：从缓存读取
  if (isRead) {
    try {
      const raw = localStorage.getItem(cacheKey(path));
      if (raw) {
        const cached = JSON.parse(raw);
        console.log('[Offline] 从缓存读取:', path);
        return cached.data;
      }
    } catch {}
    throw new Error('离线模式：数据未缓存，请连接网络后重试');
  }

  // POST/PATCH/PUT：写入本地 + 入队
  if (isWrite) {
    let body = {};
    try { if (options.body) body = JSON.parse(options.body); } catch {}

    const table = tableFromPath(path);
    const id = body.id || ('local_' + Date.now());
    const data = { ...body, id, _offline: true, _createdAt: new Date().toISOString() };

    // 存入 IndexedDB
    if (table && typeof CapacitorPlatform !== 'undefined') {
      await CapacitorPlatform.localSet(table, String(id), data);
    }

    // 入同步队列
    if (typeof CapacitorPlatform !== 'undefined') {
      CapacitorPlatform.addToSyncQueue({
        table, record_id: id, operation: 'insert',
        data, timestamp: new Date().toISOString(),
      });
    }

    console.log('[Offline] 离线创建，已入队:', table, id);
    return data;
  }

  // DELETE：标记删除 + 入队
  if (isDelete) {
    const table = tableFromPath(path);
    const idMatch = path.match(/\/([a-f0-9-]{36}|\d+)$/);
    const id = idMatch ? idMatch[1] : null;

    if (table && id && typeof CapacitorPlatform !== 'undefined') {
      await CapacitorPlatform.localDelete(table, String(id));
      CapacitorPlatform.addToSyncQueue({
        table, record_id: id, operation: 'delete',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[Offline] 离线删除，已入队:', table, id);
    return null;
  }

  throw new Error('离线模式：不支持的操作');
}

// ── 推送同步队列 ──
async function pushSyncQueue() {
  if (!navigator.onLine || !state.token) return;
  if (typeof CapacitorPlatform === 'undefined') return;

  const queue = CapacitorPlatform.getSyncQueue();
  if (queue.length === 0) return;

  console.log('[Sync] 推送队列:', queue.length, '条');
  try {
    const resp = await fetch(`${API}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ changes: queue }),
    });
    if (resp.ok) {
      CapacitorPlatform.clearSyncQueue();
      console.log('[Sync] 推送成功');
    }
  } catch (e) {
    console.warn('[Sync] 推送失败，下次重试:', e.message);
  }
}

// ── 网络恢复时自动推送 ──
window.addEventListener('online', () => {
  if (state.token) {
    console.log('[Sync] 网络恢复，自动同步...');
    pushSyncQueue();
  }
});

/* ── 云端同步 API ── */

async function syncPush() {
  if (!state.token) return null;
  try { return await request("/sync/push", { method: "POST", body: JSON.stringify({ changes: {} }) }); }
  catch { return null; }
}

async function syncPull() {
  if (!state.token) return null;
  try { return await request("/sync/pull"); }
  catch { return null; }
}

async function syncStatus() {
  if (!state.token) return { online: false, last_sync_log: [] };
  try { return await request("/sync/status"); }
  catch { return { online: false, last_sync_log: [] }; }
}

/* ── 备份导出 API ── */

async function backupStatus() {
  if (!state.token) return null;
  try { return await request("/backup/status"); }
  catch { return null; }
}

async function triggerBackup() {
  return await request("/backup/auto", { method: "POST" });
}

async function exportData(format = "json") {
  return await request(`/backup/export/${format}`, { method: "POST" });
}

async function openFolder(type = "workspace") {
  return await request(`/backup/open/${type}`, { method: "POST" });
}

/* ── 离线状态检测 ── */

async function checkOfflineStatus() {
  try { return await request("/auth/offline-status"); }
  catch { return { has_offline_credentials: false }; }
}

async function offlineLogin(email, password) {
  return await request("/auth/login/offline", {
    method: "POST", body: JSON.stringify({ email, password }),
  });
}
