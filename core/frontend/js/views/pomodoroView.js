/* ═══════════════════════════════════════════════════════════════════════
   pomodoroView.js — 番茄钟悬浮窗 & 任务日志视图
   ═══════════════════════════════════════════════════════════════════════ */

/* ── 番茄钟悬浮窗（可拖动 / 小窗+全屏） ── */

function pomodoroFloatHtml() {
  if (!state.pomodoro || !state.pomodoro.active) return "";
  const session = state.pomodoro;
  const minutes = Math.floor(session.remainingSeconds / 60);
  const seconds = session.remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progress = session.plannedMinutes > 0
    ? ((session.plannedMinutes * 60 - session.remainingSeconds) / (session.plannedMinutes * 60)) * 100
    : 0;
  const isRunning = session.status === "running";
  const taskLabel = session.taskTitle || "专注";
  const isFullscreen = state.pomodoro.isFullscreen || false;
  const bgImage = state.pomodoro.bgImage || "";

  if (isFullscreen) {
    return pomodoroFullscreenHtml(timeStr, progress, isRunning, taskLabel, session, bgImage);
  }
  return pomodoroMiniHtml(timeStr, progress, isRunning, taskLabel, session);
}

function pomodoroMiniHtml(timeStr, progress, isRunning, taskLabel, session) {
  return `
    <div class="pomodoro-float ${isRunning ? "is-running" : "is-paused"}" id="pomodoroFloat"
         data-draggable="pomodoroFloat">
      <div class="pomodoro-float-handle" data-drag-handle="pomodoroFloat">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>
        <span class="pomodoro-float-task">${escapeHtml(taskLabel)}</span>
        <button class="pomodoro-float-fullscreen" data-action="togglePomodoroFullscreen" title="全屏">⛶</button>
      </div>
      <div class="pomodoro-float-body">
        <div class="pomodoro-ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" class="pomodoro-ring-bg" />
            <circle cx="60" cy="60" r="54" class="pomodoro-ring-fg"
              stroke-dasharray="${2 * Math.PI * 54}"
              stroke-dashoffset="${2 * Math.PI * 54 * (1 - progress / 100)}" />
          </svg>
          <div class="pomodoro-time">${timeStr}</div>
        </div>
        <div class="pomodoro-mode">${session.timerMode === "countdown" ? "倒计时" : "正计时"} · ${session.plannedMinutes}分钟</div>
        <div class="pomodoro-actions">
          ${isRunning
            ? `<button class="pomodoro-btn pause" data-action="pausePomodoro">暂停</button>`
            : `<button class="pomodoro-btn start" data-action="resumePomodoro">继续</button>`}
          <button class="pomodoro-btn stop" data-action="stopPomodoro">结束</button>
        </div>
      </div>
    </div>
  `;
}

function pomodoroFullscreenHtml(timeStr, progress, isRunning, taskLabel, session, bgImage) {
  const bgStyle = bgImage ? `style="background-image:url(${escapeHtml(bgImage)})"` : "";
  const bgClass = bgImage ? " has-bg" : "";
  return `
    <div class="pomodoro-fullscreen${bgClass}" id="pomodoroFullscreen" ${bgStyle}>
      <div class="pomodoro-fullscreen-overlay"></div>
      <div class="pomodoro-fullscreen-content">
        <div class="pomodoro-fullscreen-top">
          <span class="pomodoro-fullscreen-task">${escapeHtml(taskLabel)}</span>
          <div class="pomodoro-fullscreen-top-actions">
            <button class="pomodoro-fullscreen-bg-btn" data-action="uploadPomodoroBg" title="更换背景">🖼</button>
            <button class="pomodoro-fullscreen-exit" data-action="togglePomodoroFullscreen" title="退出全屏">✕</button>
          </div>
        </div>
        <div class="pomodoro-fullscreen-center">
          <div class="pomodoro-fullscreen-ring">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" class="pomodoro-ring-bg" />
              <circle cx="100" cy="100" r="90" class="pomodoro-ring-fg"
                stroke-dasharray="${2 * Math.PI * 90}"
                stroke-dashoffset="${2 * Math.PI * 90 * (1 - progress / 100)}" />
            </svg>
            <div class="pomodoro-fullscreen-time">${timeStr}</div>
          </div>
          <div class="pomodoro-fullscreen-mode">${session.timerMode === "countdown" ? "倒计时" : "正计时"} · ${session.plannedMinutes}分钟</div>
        </div>
        <div class="pomodoro-fullscreen-actions">
          ${isRunning
            ? `<button class="pomodoro-fullscreen-btn pause" data-action="pausePomodoro">暂停</button>`
            : `<button class="pomodoro-fullscreen-btn start" data-action="resumePomodoro">继续</button>`}
          <button class="pomodoro-fullscreen-btn stop" data-action="stopPomodoro">结束</button>
        </div>
      </div>
    </div>
  `;
}

/* ── 番茄钟启动弹窗 ── */

function pomodoroStartModal(taskType, taskId, taskTitle) {
  const plannedMinutes = (state.pomodoro && state.pomodoro.plannedMinutes) || 25;
  const timerMode = (state.pomodoro && state.pomodoro.timerMode) || "countdown";
  return `
    <div class="modal-backdrop" data-action="closePomodoroModal">
      <section class="modal-dialog pomodoro-start-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>开始专注</h3>
          <button class="icon-btn" type="button" data-action="closePomodoroModal">×</button>
        </div>
        <div class="modal-body">
          <div class="pomodoro-task-info">
            <span class="pomodoro-task-icon">🍅</span>
            <strong>${escapeHtml(taskTitle)}</strong>
          </div>
          <div class="pomodoro-presets">
            <span>专注时长</span>
            <div class="pomodoro-preset-btns">
              ${[15, 25, 30, 45, 60].map(m => `
                <button class="pomodoro-preset ${plannedMinutes === m ? 'active' : ''}"
                  data-action="setPomodoroMinutes" data-minutes="${m}">${m}分钟</button>
              `).join("")}
            </div>
          </div>
          <div class="pomodoro-custom-minutes">
            <input type="number" id="pomodoroCustomMinutes" value="${plannedMinutes}"
              min="1" max="180" placeholder="自定义分钟" />
          </div>
          <div class="pomodoro-mode-switch">
            <span>计时模式</span>
            <div class="mode-toggle">
              <button class="${timerMode === 'countdown' ? 'active' : ''}"
                data-action="setPomodoroMode" data-mode="countdown">倒计时</button>
              <button class="${timerMode === 'countup' ? 'active' : ''}"
                data-action="setPomodoroMode" data-mode="countup">正计时</button>
            </div>
          </div>
          <button class="btn primary full" data-action="startPomodoro"
            data-task-type="${taskType}" data-task-id="${taskId}">开始专注</button>
        </div>
      </section>
    </div>
  `;
}

/* ── 任务日志面板 ── */

function taskLogPanel(taskType, taskId, taskTitle) {
  const sessions = (state.pomodoro && state.pomodoro.sessions) || [];
  const workLogs = (state.pomodoro && state.pomodoro.workLogs) || [];
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.actual_seconds || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const logTab = (state.pomodoro && state.pomodoro.logTab) || "timer";
  const plannedMinutes = (state.pomodoro && state.pomodoro.plannedMinutes) || 25;
  const timerMode = (state.pomodoro && state.pomodoro.timerMode) || "countdown";

  return `
    <div class="task-log-panel">
      <div class="task-log-head">
        <div>
          <h3>${escapeHtml(taskTitle)}</h3>
          <span class="task-log-total">累计 ${totalMinutes} 分钟 · ${sessions.length} 次专注</span>
        </div>
        <button class="icon-btn" type="button" data-action="closeTaskLog">×</button>
      </div>

      <div class="task-log-tabs">
        <button class="${logTab === 'timer' ? 'active' : ''}" data-action="switchTaskLogTab" data-tab="timer">计时日志</button>
        <button class="${logTab === 'text' ? 'active' : ''}" data-action="switchTaskLogTab" data-tab="text">文字日志</button>
      </div>

      ${logTab === 'timer' ? taskTimerLogSection(sessions, taskType, taskId, plannedMinutes, timerMode) : taskWorkLogSection(workLogs, taskType, taskId)}
    </div>
  `;
}

function taskTimerLogSection(sessions, taskType, taskId, plannedMinutes, timerMode) {
  return `
    <div class="task-log-section">
      <div class="task-log-add-timer">
        <div class="task-log-timer-presets">
          <span>专注时长</span>
          <div class="pomodoro-preset-btns">
            ${[15, 25, 30, 45, 60].map(m => `
              <button class="pomodoro-preset ${plannedMinutes === m ? 'active' : ''}"
                data-action="setPomodoroMinutes" data-minutes="${m}">${m}分钟</button>
            `).join("")}
          </div>
        </div>
        <div class="task-log-timer-row">
          <input type="number" id="pomodoroCustomMinutes" value="${plannedMinutes}"
            min="1" max="180" placeholder="分钟" class="timer-minutes-input" />
          <div class="mode-toggle timer-mode-toggle">
            <button class="${timerMode === 'countdown' ? 'active' : ''}"
              data-action="setPomodoroMode" data-mode="countdown">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>
              倒计时
            </button>
            <button class="${timerMode === 'countup' ? 'active' : ''}"
              data-action="setPomodoroMode" data-mode="countup">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 9 10"/></svg>
              正计时
            </button>
          </div>
          <button class="btn primary timer-start-btn" data-action="startPomodoro"
            data-task-type="${taskType}" data-task-id="${taskId}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>
            开始专注
          </button>
        </div>
      </div>
      ${sessions.length ? `
        <div class="task-log-list">
          ${sessions.map(s => {
            const mins = Math.floor((s.actual_seconds || 0) / 60);
            const secs = (s.actual_seconds || 0) % 60;
            const duration = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
            const date = new Date(s.started_at);
            const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
            const timeStr = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
            return `
              <div class="task-log-card timer-card">
                <div class="task-log-card-left">
                  <div class="task-log-card-icon">⏱</div>
                  <div class="task-log-card-body">
                    <div class="task-log-card-title">${s.timer_mode === 'countdown' ? '倒计时' : '正计时'} · 计划 <b>${s.planned_minutes}分钟</b> · 实际 <b>${duration}</b></div>
                    <div class="task-log-card-meta">${dateStr} ${timeStr}</div>
                  </div>
                </div>
                <button class="task-log-card-del" type="button" data-action="deleteTimerSession" data-id="${s.id}" title="删除记录">×</button>
              </div>
            `;
          }).join("")}
        </div>
      ` : `<div class="task-log-empty">还没有计时记录</div>`}
    </div>
  `;
}

function taskWorkLogSection(logs, taskType, taskId) {
  return `
    <div class="task-log-section">
      ${logs.length ? `
        <div class="task-log-list">
          ${logs.map(log => {
            const date = new Date(log.created_at);
            const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
            const timeStr = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
            const title = log.title || '';
            return `
              <div class="task-log-card text-card">
                <div class="task-log-card-left">
                  <div class="task-log-card-icon">📝</div>
                  <div class="task-log-card-body">
                    ${title ? `<div class="task-log-card-title">${escapeHtml(title)}</div>` : ''}
                    <div class="task-log-card-content">${escapeHtml(log.content)}</div>
                    <div class="task-log-card-meta">${dateStr} ${timeStr}</div>
                  </div>
                </div>
                <button class="task-log-card-del" type="button" data-action="deleteWorkLog" data-id="${log.id}" title="删除日志">×</button>
              </div>
            `;
          }).join("")}
        </div>
      ` : `<div class="task-log-empty">还没有文字日志</div>`}
      <div class="task-log-add">
        <input id="newWorkLogTitle" placeholder="小标题（可选）" class="task-log-title-input" maxlength="80" />
        <textarea id="newWorkLogContent" placeholder="记录工作内容..." rows="4"></textarea>
        <button class="btn primary task-log-add-btn" data-action="addWorkLog"
          data-task-type="${taskType}" data-task-id="${taskId}">添加日志</button>
      </div>
    </div>
  `;
}

/* ── 主页时长统计 ── */

function timeStatsView() {
  const stats = state.timeStats;
  if (!stats) return "";
  const totalMinutes = Math.floor((stats.total_seconds || 0) / 60);
  const totalSeconds = stats.total_seconds || 0;
  const dailyTasks = stats.daily_tasks || [];
  const rangeReminders = stats.range_reminders || [];
  const rangeCategories = stats.range_categories || [];
  const categoryCompletions = stats.category_completions || [];
  const dailyCompleted = stats.daily_completed || 0;
  const dailyTotal = stats.daily_total || 0;
  const rangeCompleted = stats.range_completed || 0;
  const rangeTotal = stats.range_total || 0;

  const period = stats.period || 'day';
  const startDate = stats.start_date || '';
  const endDate = stats.end_date || '';
  let dateLabel = '';
  if (period === 'day') {
    dateLabel = formatShortDate(startDate);
  } else if (period === 'week') {
    dateLabel = `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
  } else {
    dateLabel = `${startDate.slice(0, 7)}`;
  }

  const collapsed = state.timeStatsCollapsed || {};

  return `
    <div class="time-stats-section">
      <div class="time-stats-head">
        <h3>数据统计</h3>
        <div class="time-stats-period">
          <button class="${period === 'day' ? 'active' : ''}" data-action="switchTimeStats" data-period="day">日</button>
          <button class="${period === 'week' ? 'active' : ''}" data-action="switchTimeStats" data-period="week">周</button>
          <button class="${period === 'month' ? 'active' : ''}" data-action="switchTimeStats" data-period="month">月</button>
        </div>
      </div>

      <div class="time-stats-nav">
        <button class="time-stats-arrow" data-action="prevTimeStats">‹</button>
        <span class="time-stats-date">${dateLabel}</span>
        <button class="time-stats-arrow" data-action="nextTimeStats">›</button>
      </div>

      <!-- 总览卡片 -->
      <div class="time-stats-overview">
        <div class="time-stats-card">
          <div class="time-stats-card-icon">⏱</div>
          <div class="time-stats-card-num">${totalMinutes}</div>
          <div class="time-stats-card-label">专注分钟</div>
        </div>
        <div class="time-stats-card">
          <div class="time-stats-card-icon">✅</div>
          <div class="time-stats-card-num">${dailyCompleted + rangeCompleted}</div>
          <div class="time-stats-card-label">完成任务</div>
        </div>
        <div class="time-stats-card">
          <div class="time-stats-card-icon">📋</div>
          <div class="time-stats-card-num">${dailyTotal + rangeTotal}</div>
          <div class="time-stats-card-label">总任务数</div>
        </div>
      </div>

      <!-- 任务完成统计 -->
      <div class="time-stats-group">
        <button class="time-stats-collapse" data-action="toggleStatsCollapse" data-key="completion">
          <span class="time-stats-collapse-arrow ${!collapsed.completion ? 'open' : ''}">▾</span>
          <h4>任务完成</h4>
          <span class="time-stats-collapse-summary">${dailyCompleted + rangeCompleted}/${dailyTotal + rangeTotal}</span>
        </button>
        <div class="time-stats-collapse-body ${collapsed.completion ? 'hidden' : ''}">
          ${dailyTotal > 0 ? `
            <div class="time-stats-sub-group">
              <div class="time-stats-sub-label">每日任务 <b>${dailyCompleted}/${dailyTotal}</b></div>
              <div class="time-stats-bar">
                <div class="time-stats-bar-track"><div class="time-stats-bar-fill" style="width:${dailyTotal > 0 ? (dailyCompleted/dailyTotal*100) : 0}%; background:#27ae60"></div></div>
              </div>
            </div>
          ` : ''}
          ${rangeTotal > 0 ? `
            <div class="time-stats-sub-group">
              <div class="time-stats-sub-label">近期任务 <b>${rangeCompleted}/${rangeTotal}</b></div>
              <div class="time-stats-bar">
                <div class="time-stats-bar-track"><div class="time-stats-bar-fill" style="width:${rangeTotal > 0 ? (rangeCompleted/rangeTotal*100) : 0}%; background:#f39c12"></div></div>
              </div>
            </div>
          ` : ''}
          ${categoryCompletions.length > 0 ? `
            <div class="time-stats-sub-group">
              <div class="time-stats-sub-label">按分类</div>
              ${categoryCompletions.map(c => `
                <div class="time-stats-bar">
                  <div class="time-stats-bar-label">
                    <span>${escapeHtml(c.task_title)}</span>
                    <span>${c.completed_count}/${c.total_count}</span>
                  </div>
                  <div class="time-stats-bar-track"><div class="time-stats-bar-fill" style="width:${c.total_count > 0 ? (c.completed_count/c.total_count*100) : 0}%; background:var(--accent)"></div></div>
                </div>
              `).join("")}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 专注时长统计 -->
      ${(dailyTasks.length > 0 || rangeReminders.length > 0 || rangeCategories.length > 0) ? `
      <div class="time-stats-group">
        <button class="time-stats-collapse" data-action="toggleStatsCollapse" data-key="duration">
          <span class="time-stats-collapse-arrow ${!collapsed.duration ? 'open' : ''}">▾</span>
          <h4>专注时长</h4>
          <span class="time-stats-collapse-summary">${totalMinutes}分钟</span>
        </button>
        <div class="time-stats-collapse-body ${collapsed.duration ? 'hidden' : ''}">
          ${rangeCategories.length > 0 ? `
            <div class="time-stats-sub-group">
              <div class="time-stats-sub-label">分类汇总</div>
              ${rangeCategories.map(t => timeStatsBar(t, totalSeconds)).join("")}
            </div>
          ` : ''}
          ${rangeReminders.length > 0 ? `
            <div class="time-stats-sub-group">
              <div class="time-stats-sub-label">近期任务</div>
              ${rangeReminders.map(t => timeStatsBar(t, totalSeconds)).join("")}
            </div>
          ` : ''}
          ${dailyTasks.length > 0 ? `
            <div class="time-stats-sub-group">
              <div class="time-stats-sub-label">每日任务</div>
              ${dailyTasks.map(t => timeStatsBar(t, totalSeconds)).join("")}
            </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${!dailyTasks.length && !rangeReminders.length && dailyTotal === 0 && rangeTotal === 0 ? `
        <div class="time-stats-empty">还没有数据记录</div>
      ` : ""}
    </div>
  `;
}

function timeStatsBar(item, totalSeconds) {
  const minutes = Math.floor(item.total_seconds / 60);
  const pct = totalSeconds > 0 ? (item.total_seconds / totalSeconds * 100) : 0;
  const hue = (item.task_id * 47 + 180) % 360;
  return `
    <div class="time-stats-bar">
      <div class="time-stats-bar-label">
        <span>${escapeHtml(item.task_title || item.category_title || `#${item.task_id}`)}</span>
        <span>${minutes}分钟 · ${item.session_count}次</span>
      </div>
      <div class="time-stats-bar-track">
        <div class="time-stats-bar-fill" style="width:${Math.max(pct, 2)}%; background:hsl(${hue},55%,55%)"></div>
      </div>
    </div>
  `;
}
