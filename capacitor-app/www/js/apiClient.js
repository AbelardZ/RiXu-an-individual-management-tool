/* ═══════════════════════════════════════════════════════════════════════
   apiClient.js — 统一 API 请求层
   所有 fetch/request 统一走这里，负责 token、headers、JSON、FormData、错误处理。
   支持云端 JWT token 和本地 session token 双模式。
   
   API 地址优先级：
   1. localStorage 中的 dayorder.apiBase（用户可在登录页配置）
   2. 当前页面同源的 /api（默认，适用于本地和同域部署）
   3. Capacitor 环境：使用 OfflineAPI 离线优先策略
   ═══════════════════════════════════════════════════════════════════════ */

const API = (() => {
  // 支持通过 localStorage 配置云端 API 地址
  const stored = localStorage.getItem("dayorder.apiBase");
  if (stored) return stored.replace(/\/$/, "") + "/api";
  // 默认使用同源相对路径
  return "/api";
})();

async function request(path, options = {}) {
  // ── Capacitor 环境：使用离线优先 API ──
  if (typeof OfflineAPI !== 'undefined' && CapacitorPlatform && !CapacitorPlatform.isElectron()) {
    // 对于认证相关请求，始终走远程（登录/注册不能离线）
    const authPaths = ['/auth/login', '/auth/register', '/auth/me', '/auth/logout', '/auth/offline-status'];
    const isAuthRequest = authPaths.some(p => path.startsWith(p));
    
    if (!isAuthRequest) {
      try {
        return await OfflineAPI.request(path, options);
      } catch (error) {
        // 离线 API 失败时，回退到原始 fetch
        console.warn('[apiClient] OfflineAPI failed, falling back to fetch:', error.message);
      }
    }
  }

  // ── 原始 fetch 逻辑（Electron / Web / 认证请求） ──
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {}
    const error = new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join("; ") : detail);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

/* ── 云端同步 API ── */

async function syncPush() {
  if (!state.token) return null;
  try {
    return await request("/sync/push", { method: "POST", body: JSON.stringify({ changes: {} }) });
  } catch {
    return null;
  }
}

async function syncPull() {
  if (!state.token) return null;
  try {
    return await request("/sync/pull");
  } catch {
    return null;
  }
}

async function syncStatus() {
  if (!state.token) return { online: false, last_sync_log: [] };
  try {
    return await request("/sync/status");
  } catch {
    return { online: false, last_sync_log: [] };
  }
}

/* ── 备份导出 API ── */

async function backupStatus() {
  if (!state.token) return null;
  try {
    return await request("/backup/status");
  } catch {
    return null;
  }
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
  try {
    return await request("/auth/offline-status");
  } catch {
    return { has_offline_credentials: false };
  }
}

async function offlineLogin(email, password) {
  return await request("/auth/login/offline", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
