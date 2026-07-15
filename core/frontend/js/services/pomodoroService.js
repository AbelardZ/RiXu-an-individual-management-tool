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
    };
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
  } catch (error) {
    setToast("启动番茄钟失败: " + error.message);
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

    // 只更新番茄钟浮窗 DOM，不全量渲染
    updatePomodoroFloatDOM();
  }, 1000);
}

function updatePomodoroFloatDOM() {
  const float = document.getElementById("pomodoroFloat");
  if (!float) return;
  const minutes = Math.floor(state.pomodoro.remainingSeconds / 60);
  const seconds = state.pomodoro.remainingSeconds % 60;
  const timeEl = float.querySelector(".pomodoro-time");
  if (timeEl) timeEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const planned = state.pomodoro.plannedMinutes;
  const progress = planned > 0 ? ((planned * 60 - state.pomodoro.remainingSeconds) / (planned * 60)) * 100 : 0;
  const ring = float.querySelector(".pomodoro-ring-fg");
  if (ring) ring.setAttribute("stroke-dashoffset", 2 * Math.PI * 54 * (1 - progress / 100));
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
