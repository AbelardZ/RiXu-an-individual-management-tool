/* ═══════════════════════════════════════════════════════════════════════
   syncService.js — 变更追踪 & 自动同步调度
   
   策略：
   - 每次 CRUD 操作后调用 trackChange() 记录变更
   - 每 30 秒自动检查并推送本地变更
   - 在线时实时同步，离线时累积变更
   - 使用 localStorage 持久化变更队列，防止页面刷新丢失
   ═══════════════════════════════════════════════════════════════════════ */

/* ── 变更追踪 ── */

const SYNC_TABLES = [
  "tags",
  "tag_links",
  "record_types",
  "records",
  "journal_entries",
  "daily_task_templates",
  "range_task_categories",
  "range_reminders",
  "milestone_days",
  "attachments",
];

/**
 * 记录一次变更
 * @param {string} table - 表名
 * @param {number|string} recordId - 记录 ID
 * @param {'create'|'update'|'delete'} operation - 操作类型
 */
function trackChange(table, recordId, operation) {
  if (!SYNC_TABLES.includes(table)) return;
  
  const queue = getChangeQueue();
  // 去重：同一记录的多次 update 只保留最后一次
  const existingIdx = queue.findIndex(
    c => c.table === table && c.record_id === recordId
  );
  const change = {
    table,
    record_id: recordId,
    operation,
    timestamp: new Date().toISOString(),
  };
  
  if (existingIdx >= 0) {
    // 如果已有 delete，不再覆盖
    if (queue[existingIdx].operation === "delete") return;
    queue[existingIdx] = change;
  } else {
    queue.push(change);
  }
  
  saveChangeQueue(queue);
}

/**
 * 获取变更队列
 */
function getChangeQueue() {
  try {
    const raw = localStorage.getItem("dayorder.changeQueue");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 保存变更队列
 */
function saveChangeQueue(queue) {
  // 限制队列最大 500 条
  if (queue.length > 500) {
    queue = queue.slice(-500);
  }
  localStorage.setItem("dayorder.changeQueue", JSON.stringify(queue));
}

/**
 * 清空变更队列
 */
function clearChangeQueue() {
  localStorage.removeItem("dayorder.changeQueue");
}

/* ── 同步调度器 ── */

let syncTimer = null;
let syncInProgress = false;

/**
 * 启动自动同步（每 30 秒）
 */
function startAutoSync() {
  stopAutoSync();
  syncTimer = setInterval(() => {
    performSync();
  }, 30000);
  // 首次立即执行
  performSync();
}

/**
 * 停止自动同步
 */
function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

/**
 * 执行一次完整同步周期
 */
async function performSync() {
  if (syncInProgress) return;
  if (!state.token) return;
  
  syncInProgress = true;
  state.syncStatus = "syncing";
  updateSyncIndicator();
  
  try {
    // 1. 检查在线状态
    let status = { online: false };
    try {
      status = await request("/sync/status");
    } catch {}
    if (!status.online) {
      state.syncStatus = "offline";
      state.syncMessage = "离线 — 变更将在恢复连接后同步";
      updateSyncIndicator();
      syncInProgress = false;
      return;
    }
    
    // 2. 推送本地变更
    const queue = getChangeQueue();
    if (queue.length > 0) {
      const pushed = await pushLocalChanges(queue);
      if (pushed) {
        clearChangeQueue();
      }
    }
    
    // 3. 拉取云端变更
    const lastSync = localStorage.getItem("dayorder.lastSyncTime") || undefined;
    let result = null;
    try {
      const query = lastSync ? `?since=${encodeURIComponent(lastSync)}` : '';
      result = await request(`/sync/pull${query}`);
    } catch {}
    
    if (result && result.changes) {
      const changeCount = countChanges(result.changes);
      if (changeCount > 0) {
        // 应用云端变更到本地状态
        await applyRemoteChangesToState(result.changes);
        state.syncMessage = `已同步 ${changeCount} 条变更`;
      } else {
        state.syncMessage = "已是最新";
      }
    }
    
    // 4. 更新最后同步时间
    localStorage.setItem("dayorder.lastSyncTime", new Date().toISOString());
    state.syncStatus = "synced";
    
  } catch (err) {
    console.error("同步失败:", err);
    state.syncStatus = "error";
    state.syncMessage = "同步失败: " + (err.message || "未知错误");
  }
  
  updateSyncIndicator();
  syncInProgress = false;
}

/**
 * 推送本地变更到服务器
 */
async function pushLocalChanges(queue) {
  try {
    // 收集变更涉及的实际数据
    const changes = {};
    for (const item of queue) {
      if (!changes[item.table]) {
        changes[item.table] = [];
      }
      // 从本地状态获取最新数据
      const record = getLocalRecord(item.table, item.record_id);
      if (record) {
        changes[item.table].push(record);
      } else if (item.operation === "delete") {
        changes[item.table].push({
          id: item.record_id,
          deleted_at: item.timestamp,
          _deleted: true,
        });
      }
    }
    
    if (Object.keys(changes).length === 0) return true;
    
    const result = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes }),
    });
    return result && result.status === "ok";
  } catch {
    return false;
  }
}

/**
 * 从本地状态获取记录数据
 */
function getLocalRecord(table, recordId) {
  const id = parseInt(recordId);
  switch (table) {
    case "tags":
      return state.tags.find(t => t.id === id);
    case "record_types":
      return state.recordTypes.find(t => t.id === id);
    case "records":
      return state.records.find(r => r.id === id);
    case "journal_entries":
      return state.journals.find(j => j.id === id);
    case "daily_task_templates":
      return state.dailyTemplates.find(t => t.id === id);
    case "range_task_categories":
      return state.rangeCategories.find(c => c.id === id);
    case "range_reminders":
      return state.rangeReminders.find(r => r.id === id);
    case "milestone_days":
      return state.milestoneDays.find(m => m.id === id);
    default:
      return null;
  }
}

/**
 * 统计变更数量
 */
function countChanges(changes) {
  let count = 0;
  for (const table of Object.keys(changes)) {
    count += changes[table].length;
  }
  return count;
}

/**
 * 将云端变更应用到本地状态（触发重新加载）
 */
async function applyRemoteChangesToState(changes) {
  // 简单策略：重新加载所有受影响的数据
  const affectedTables = new Set(Object.keys(changes));
  
  // 重新加载相关数据
  if (affectedTables.has("tags") || affectedTables.has("tag_links")) {
    try { state.tags = await request("/tags"); } catch {}
  }
  if (affectedTables.has("record_types") || affectedTables.has("records")) {
    try { state.recordTypes = await request("/record-types"); } catch {}
    try { state.records = await request("/records"); } catch {}
  }
  if (affectedTables.has("journal_entries")) {
    try { state.journals = await request("/journals"); } catch {}
  }
  if (affectedTables.has("daily_task_templates")) {
    try { state.dailyTemplates = await request("/daily-tasks"); } catch {}
  }
  if (affectedTables.has("range_task_categories") || affectedTables.has("range_reminders")) {
    try { state.rangeCategories = await request("/range-categories"); } catch {}
    try { state.rangeReminders = await request("/range-reminders"); } catch {}
  }
  if (affectedTables.has("milestone_days")) {
    try { state.milestoneDays = await request("/milestones"); } catch {}
  }
  
  // 重新渲染
  render();
}

/* ── 同步状态 UI ── */

function updateSyncIndicator() {
  const el = document.getElementById("syncIndicator");
  if (!el) return;
  
  const statusMap = {
    online: { cls: "sync-online", text: "在线" },
    offline: { cls: "sync-offline", text: "离线" },
    syncing: { cls: "sync-syncing", text: "同步中…" },
    synced: { cls: "sync-synced", text: "已同步" },
    error: { cls: "sync-error", text: "同步失败" },
  };
  
  const info = statusMap[state.syncStatus] || statusMap.offline;
  el.className = `side-sync-status ${info.cls}`;
  el.innerHTML = `
    <span class="sync-dot"></span>
    <span class="sync-label">${info.text}</span>
    ${state.syncMessage ? `<span class="sync-message">${state.syncMessage}</span>` : ""}
  `;
}

/**
 * 手动触发同步
 */
async function manualSync() {
  if (syncInProgress) return;
  state.syncMessage = "手动同步中…";
  updateSyncIndicator();
  await performSync();
  setToast(state.syncStatus === "synced" ? "同步完成" : state.syncMessage);
}
