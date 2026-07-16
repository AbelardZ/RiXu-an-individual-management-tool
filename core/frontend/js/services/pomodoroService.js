/* ═══════════════════════════════════════════════════════════════════════
   pomodoroService.js — 番茄钟 & 任务日志 业务逻辑层
   ═══════════════════════════════════════════════════════════════════════ */

/* ── 番茄钟状态管理 ── */

let pomodoroInterval = null;

function initPomodoroState() {
  if (!state.pomodoro) {
    state.pomodoro = {
      active: false,
      sessionId: null,
      taskType: "",
      taskId: null,
      taskTitle: "",
      plannedMinutes: 25,
      timerMode: "countdown",
      status: "idle",
      remainingSeconds: 0,
      elapsedSeconds: 0,
      sessions: [],
      workLogs: [],
      logTab: "timer",
      showStartModal: false,
      isFullscreen: false,
      bgImage: "",
    };
  }
  // 恢复背景图
  if (!state.pomodoro.bgImage) {
    loadPomodoroBg().then(saved => {
      if (saved && state.pomodoro) state.pomodoro.bgImage = saved;
    });
  }
}

async function startPomodoro(taskType, taskId, taskTitle) {
  initPomodoroState();
  const plannedMinutes = parseInt(document.getElementById("pomodoroCustomMinutes")?.value || state.pomodoro.plannedMinutes) || 25;
  const timerMode = state.pomodoro.timerMode || "countdown";

  try {
    const session = await request("/tasks/timer", {
      method: "POST",
      body: JSON.stringify({
        task_type: taskType,
        task_id: taskId,
        planned_minutes: plannedMinutes,
        timer_mode: timerMode,
      }),
    });

    state.pomodoro.active = true;
    state.pomodoro.sessionId = session.id;
    state.pomodoro.taskType = taskType;
    state.pomodoro.taskId = taskId;
    state.pomodoro.taskTitle = taskTitle;
    state.pomodoro.plannedMinutes = plannedMinutes;
    state.pomodoro.timerMode = timerMode;
    state.pomodoro.status = "running";
    state.pomodoro.remainingSeconds = plannedMinutes * 60;
    state.pomodoro.elapsedSeconds = 0;
    state.pomodoro.showStartModal = false;

    startPomodoroTick();
    render();
    // Electron: 弹出独立悬浮窗
    openPomodoroFloatWindow();
  } catch (error) {
    setToast("启动番茄钟失败: " + error.message);
  }
}

async function openPomodoroFloatWindow() {
  if (typeof dayOrderDesktop !== 'undefined' && dayOrderDesktop.openPomodoroFloat) {
    try {
      await dayOrderDesktop.openPomodoroFloat({});
    } catch (e) { /* 非 Electron 环境忽略 */ }
  }
}

async function closePomodoroFloatWindow() {
  if (typeof dayOrderDesktop !== 'undefined' && dayOrderDesktop.closePomodoroFloat) {
    try {
      await dayOrderDesktop.closePomodoroFloat();
    } catch (e) { /* ignore */ }
  }
}

function startPomodoroTick() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = setInterval(() => {
    if (state.pomodoro.status !== "running") return;

    if (state.pomodoro.timerMode === "countdown") {
      state.pomodoro.remainingSeconds--;
      state.pomodoro.elapsedSeconds++;
      if (state.pomodoro.remainingSeconds <= 0) {
        completePomodoro();
      }
    } else {
      state.pomodoro.elapsedSeconds++;
      state.pomodoro.remainingSeconds = state.pomodoro.elapsedSeconds;
    }

    // 同步状态到 localStorage（供独立悬浮窗读取）
    syncPomodoroStateToStorage();
    // 只更新番茄钟浮窗 DOM，不全量渲染
    updatePomodoroFloatDOM();
  }, 1000);
}

function syncPomodoroStateToStorage() {
  try {
    localStorage.setItem("dayorder.pomodoro.state", JSON.stringify({
      active: state.pomodoro.active,
      status: state.pomodoro.status,
      remainingSeconds: state.pomodoro.remainingSeconds,
      elapsedSeconds: state.pomodoro.elapsedSeconds,
      plannedMinutes: state.pomodoro.plannedMinutes,
      timerMode: state.pomodoro.timerMode,
      taskTitle: state.pomodoro.taskTitle,
      isFullscreen: state.pomodoro.isFullscreen,
      bgImage: state.pomodoro.bgImage,
    }));
  } catch (e) { /* ignore */ }
}

function updatePomodoroFloatDOM() {
  const minutes = Math.floor(state.pomodoro.remainingSeconds / 60);
  const seconds = state.pomodoro.remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const planned = state.pomodoro.plannedMinutes;
  const progress = planned > 0 ? ((planned * 60 - state.pomodoro.remainingSeconds) / (planned * 60)) * 100 : 0;

  // 更新小窗
  const float = document.getElementById("pomodoroFloat");
  if (float) {
    const timeEl = float.querySelector(".pomodoro-time");
    if (timeEl) timeEl.textContent = timeStr;
    const ring = float.querySelector(".pomodoro-ring-fg");
    if (ring) ring.setAttribute("stroke-dashoffset", 2 * Math.PI * 54 * (1 - progress / 100));
  }

  // 更新全屏
  const fs = document.getElementById("pomodoroFullscreen");
  if (fs) {
    const timeEl = fs.querySelector(".pomodoro-fullscreen-time");
    if (timeEl) timeEl.textContent = timeStr;
    const ring = fs.querySelector(".pomodoro-ring-fg");
    if (ring) ring.setAttribute("stroke-dashoffset", 2 * Math.PI * 90 * (1 - progress / 100));
  }
}

function pausePomodoro() {
  state.pomodoro.status = "paused";
  clearInterval(pomodoroInterval);
  render();
}

function resumePomodoro() {
  state.pomodoro.status = "running";
  startPomodoroTick();
  render();
}

async function stopPomodoro() {
  clearInterval(pomodoroInterval);
  const sessionId = state.pomodoro.sessionId;
  const actualSeconds = state.pomodoro.elapsedSeconds;

  state.pomodoro.active = false;
  state.pomodoro.status = "idle";
  closePomodoroFloatWindow();

  if (sessionId) {
    try {
      await request(`/tasks/timer/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: actualSeconds > 0 ? "completed" : "cancelled",
          actual_seconds: actualSeconds,
        }),
      });
    } catch { /* 静默处理 */ }
  }

  render();
}

async function completePomodoro() {
  clearInterval(pomodoroInterval);
  const sessionId = state.pomodoro.sessionId;
  const actualSeconds = state.pomodoro.plannedMinutes * 60;

  state.pomodoro.active = false;
  state.pomodoro.status = "idle";
  closePomodoroFloatWindow();

  if (sessionId) {
    try {
      await request(`/tasks/timer/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed", actual_seconds: actualSeconds }),
      });
    } catch { /* 静默处理 */ }
  }

  setToast("🍅 专注完成！");
  render();
}

/* ── 任务日志 ── */

async function loadTaskLogs(taskType, taskId) {
  initPomodoroState();
  try {
    const [sessions, workLogs] = await Promise.all([
      request(`/tasks/timer/sessions?task_type=${taskType}&task_id=${taskId}`),
      request(`/tasks/work-logs?task_type=${taskType}&task_id=${taskId}`),
    ]);
    state.pomodoro.sessions = sessions || [];
    state.pomodoro.workLogs = workLogs || [];
    // 只在首次打开或切换任务时重置为 timer
    if (!state.pomodoro._logTaskId || state.pomodoro._logTaskId !== taskId) {
      state.pomodoro.logTab = "timer";
    }
  } catch {
    state.pomodoro.sessions = [];
    state.pomodoro.workLogs = [];
  }
}

async function addWorkLog(taskType, taskId) {
  const title = document.getElementById("newWorkLogTitle")?.value?.trim() || "";
  const content = document.getElementById("newWorkLogContent")?.value?.trim();
  if (!content) return;
  try {
    await request("/tasks/work-log", {
      method: "POST",
      body: JSON.stringify({ task_type: taskType, task_id: taskId, content, title }),
    });
    const currentTab = state.pomodoro.logTab;
    await loadTaskLogs(taskType, taskId);
    state.pomodoro.logTab = currentTab; // 保持当前标签
    render();
  } catch (error) {
    setToast(error.message);
  }
}

async function deleteWorkLog(logId) {
  try {
    await request(`/tasks/work-log/${logId}`, { method: "DELETE" });
    state.pomodoro.workLogs = state.pomodoro.workLogs.filter(l => l.id !== logId);
    render();
  } catch (error) {
    setToast(error.message);
  }
}

async function deleteTimerSession(sessionId) {
  try {
    await request(`/tasks/timer/${sessionId}`, { method: "DELETE" });
    state.pomodoro.sessions = state.pomodoro.sessions.filter(s => s.id !== sessionId);
    render();
  } catch (error) {
    setToast(error.message);
  }
}

/* ── 时长统计 ── */

async function loadTimeStats(period = "day", offsetDate = null) {
  try {
    const date = offsetDate || state.timeStatsOffset || state.selectedDate;
    const result = await request(`/tasks/time-stats?period=${period}&date=${date}`);
    state.timeStats = result;
    state.timeStatsPeriod = period;
    if (offsetDate !== null) {
      state.timeStatsOffset = offsetDate;
    }
  } catch {
    state.timeStats = { period, daily_tasks: [], range_reminders: [], range_categories: [], total_seconds: 0, start_date: '', end_date: '' };
  }
}

function shiftTimeStats(direction) {
  const period = state.timeStatsPeriod || 'day';
  const currentDate = state.timeStatsOffset || state.selectedDate;
  // 使用本地时间解析避免时区问题
  const parts = currentDate.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);

  if (period === 'day') {
    d.setDate(d.getDate() + direction);
  } else if (period === 'week') {
    d.setDate(d.getDate() + direction * 7);
  } else {
    d.setMonth(d.getMonth() + direction);
  }

  const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  state.timeStatsOffset = newDate;
  loadTimeStats(period, newDate).then(() => render());
}

function toggleStatsCollapse(key) {
  if (!state.timeStatsCollapsed) state.timeStatsCollapsed = {};
  state.timeStatsCollapsed[key] = !state.timeStatsCollapsed[key];
  render();
}

function toggleStatsFold(foldId) {
  const children = document.getElementById(foldId + '-children');
  const arrow = document.getElementById(foldId + '-arrow');
  if (!children || !arrow) return;
  if (children.style.display === 'none') {
    children.style.display = 'block';
    arrow.classList.add('open');
  } else {
    children.style.display = 'none';
    arrow.classList.remove('open');
  }
}

/* ── 番茄钟全屏切换 ── */

function togglePomodoroFullscreen() {
  if (!state.pomodoro) return;
  state.pomodoro.isFullscreen = !state.pomodoro.isFullscreen;
  render();
}

/* ── 全屏背景上传 ── */

function uploadPomodoroBg() {
  // 创建隐藏的 file input
  let input = document.getElementById("pomodoroBgInput");
  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.id = "pomodoroBgInput";
    input.accept = "image/*";
    input.className = "pomodoro-bg-input";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        if (!state.pomodoro) return;
        const dataUrl = reader.result;
        state.pomodoro.bgImage = dataUrl;
        // 持久化存储
        await savePomodoroBg(dataUrl);
        render();
      };
      reader.readAsDataURL(file);
    });
  }
  input.click();
}

async function savePomodoroBg(dataUrl) {
  // Electron: 存到文件系统
  if (typeof dayOrderDesktop !== 'undefined' && dayOrderDesktop.savePomodoroBg) {
    try {
      await dayOrderDesktop.savePomodoroBg(dataUrl);
      return;
    } catch (e) { /* fallback */ }
  }
  // 浏览器: localStorage
  try {
    localStorage.setItem("pomodoroBgImage", dataUrl);
  } catch (e) { /* 忽略 */ }
}

async function loadPomodoroBg() {
  // Electron: 从文件系统读取
  if (typeof dayOrderDesktop !== 'undefined' && dayOrderDesktop.loadPomodoroBg) {
    try {
      const saved = await dayOrderDesktop.loadPomodoroBg();
      if (saved) return saved;
    } catch (e) { /* fallback */ }
  }
  // 浏览器: localStorage
  try {
    return localStorage.getItem("pomodoroBgImage");
  } catch (e) { return null; }
}

/* ── 悬浮窗拖拽 ── */

function initPomodoroDrag() {
  document.addEventListener("mousedown", (e) => {
    const handle = e.target.closest("[data-drag-handle]");
    if (!handle) return;
    const floatId = handle.dataset.dragHandle;
    const float = document.getElementById(floatId);
    if (!float) return;

    e.preventDefault();
    const rect = float.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = rect.left;
    const origTop = rect.top;

    float.classList.add("dragging");

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      float.style.left = (origLeft + dx) + "px";
      float.style.top = (origTop + dy) + "px";
      float.style.right = "auto";
      float.style.bottom = "auto";
    };

    const onUp = () => {
      float.classList.remove("dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // 触摸支持
  document.addEventListener("touchstart", (e) => {
    const handle = e.target.closest("[data-drag-handle]");
    if (!handle) return;
    const floatId = handle.dataset.dragHandle;
    const float = document.getElementById(floatId);
    if (!float) return;

    const touch = e.touches[0];
    const rect = float.getBoundingClientRect();
    const startX = touch.clientX;
    const startY = touch.clientY;
    const origLeft = rect.left;
    const origTop = rect.top;

    float.classList.add("dragging");

    const onMove = (ev) => {
      const t = ev.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      float.style.left = (origLeft + dx) + "px";
      float.style.top = (origTop + dy) + "px";
      float.style.right = "auto";
      float.style.bottom = "auto";
    };

    const onUp = () => {
      float.classList.remove("dragging");
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  });
}

// 页面加载时初始化拖拽和恢复背景图
document.addEventListener("DOMContentLoaded", () => {
  initPomodoroDrag();
  loadPomodoroBg().then(saved => {
    if (saved && state.pomodoro) {
      state.pomodoro.bgImage = saved;
    }
  });
});
