/* ═══════════════════════════════════════════════════════════════════════
   calendarView.js — 日历 & 今日 视图层
   ═══════════════════════════════════════════════════════════════════════ */

function todayView() {
  const detail = state.dayDetail;
  return `
    ${topbar("今日", MODULE_SUBTITLES.today, "")}
    ${todayTopPanel()}
    ${detail ? dayDashboard(detail) : empty("正在加载今日内容")}
    ${todayStatsSection()}
  `;
}

/* ── 今日统计区（数据看板 + 折线图） ── */

function todayStatsSection() {
  const stats = state.timeStats;
  const period = state.timeStatsPeriod || "day";
  if (!stats) return "";

  const totalMinutes = Math.floor((stats.total_seconds || 0) / 60);
  const dailyCompleted = stats.daily_completed || 0;
  const dailyTotal = stats.daily_total || 0;
  const rangeCompleted = stats.range_completed || 0;
  const rangeTotal = stats.range_total || 0;
  const totalCompleted = dailyCompleted + rangeCompleted;
  const totalTasks = dailyTotal + rangeTotal;

  const periodLabels = { day: "今日", week: "本周", month: "本月" };

  return `
    <div class="today-stats-section">
      <div class="today-stats-header">
        <h3>数据看板</h3>
        <div class="today-stats-tabs">
          <button class="${period === 'day' ? 'active' : ''}" data-action="switchTimeStats" data-period="day">日</button>
          <button class="${period === 'week' ? 'active' : ''}" data-action="switchTimeStats" data-period="week">周</button>
          <button class="${period === 'month' ? 'active' : ''}" data-action="switchTimeStats" data-period="month">月</button>
        </div>
      </div>
      <div class="today-stats-card">
        <div class="today-stats-item">
          <span class="today-stats-num">${totalMinutes}</span>
          <span class="today-stats-label">专注分钟</span>
        </div>
        <div class="today-stats-divider"></div>
        <div class="today-stats-item">
          <span class="today-stats-num">${totalCompleted}<small>/${totalTasks}</small></span>
          <span class="today-stats-label">完成任务</span>
        </div>
      </div>
      ${stats.trend ? trendChart(stats.trend, period) : ""}
    </div>
  `;
}

function trendChart(trend, period) {
  if (!trend || !trend.length) return "";
  const maxVal = Math.max(...trend.map(d => d.minutes || 0), 1);
  const maxTasks = Math.max(...trend.map(d => d.completed || 0), 1);
  const w = trend.length * 44;
  const h = 80;
  const pointsMinutes = trend.map((d, i) => `${i * 44 + 22},${h - (d.minutes || 0) / maxVal * h}`).join(" ");
  const pointsTasks = trend.map((d, i) => `${i * 44 + 22},${h - (d.completed || 0) / maxTasks * h}`).join(" ");

  return `
    <div class="trend-chart">
      <div class="trend-legend">
        <span class="trend-legend-item"><i style="background:var(--brand-60)"></i>专注分钟</span>
        <span class="trend-legend-item"><i style="background:var(--brand-40)"></i>完成任务</span>
      </div>
      <svg viewBox="0 0 ${w} ${h}" class="trend-svg" preserveAspectRatio="none">
        <polyline points="${pointsMinutes}" fill="none" stroke="var(--brand-60)" stroke-width="2" vector-effect="non-scaling-stroke" />
        <polyline points="${pointsTasks}" fill="none" stroke="var(--brand-40)" stroke-width="2" stroke-dasharray="4,3" vector-effect="non-scaling-stroke" />
      </svg>
      <div class="trend-labels">
        ${trend.map(d => `<span>${d.label || ''}</span>`).join("")}
      </div>
    </div>
  `;
}

function dayDashboard(detail) {
  return `
    <div class="layout">
      <section>
        ${section("每日事项", dailyTaskList(detail.daily_tasks))}
        ${section("阶段事项", rangeList(detail.range_reminders))}
        ${section("重要日期", cycleDayList(detail.milestone_days))}
      </section>
      <aside>
        ${section("微记", recordList(detail.records))}
        ${section("札记", journalList(detail.journals))}
      </aside>
    </div>
  `;
}

function calendarView() {
  const editingImportantDate = state.importantDates.find((item) => item.id === state.edit.milestoneDay);
  const settingsHtml = state.reminderEditor === "importantDate" ? taskDrawer(importantDateSettings(editingImportantDate)) : "";
  return `
    ${topbar("日历", MODULE_SUBTITLES.calendar, `
      <button class="icon-btn" data-action="prevMonth" title="上一月">‹</button>
      <button class="cal-month-btn" data-action="thisMonth">${state.calendarYear}年${state.calendarMonth}月</button>
      <button class="icon-btn" data-action="nextMonth" title="下一月">›</button>
      <button class="btn-link" data-action="openImportantDateSettings">管理重要日</button>
    `)}
    <div class="layout">
      <section>${calendarGrid()}</section>
      <aside class="panel calendar-side">
        ${state.dayDetail ? dayAsideHeader(state.dayDetail) : empty("选择日期查看详情")}
        <div class="calendar-side-body">
          ${state.dayDetail ? dayAside(state.dayDetail) : ""}
        </div>
      </aside>
    </div>
    ${settingsHtml}
  `;
}

function calendarGrid() {
  if (!state.monthData) return empty("正在加载日历");
  const first = new Date(state.calendarYear, state.calendarMonth - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  state.monthData.days.forEach((day) => cells.push(day));
  while (cells.length % 7 !== 0) cells.push(null);

  return `
    <div class="calendar-shell">
      <div class="calendar-week">${["一", "二", "三", "四", "五", "六", "日"].map((d) => `<div>${d}</div>`).join("")}</div>
      <div class="calendar-grid">
        ${cells.map((day) => day ? dayCell(day) : `<div class="day-cell outside"></div>`).join("")}
      </div>
    </div>
  `;
}

function dayCell(day) {
  const selected = day.date === state.selectedDate ? "selected" : "";
  const importantDates = day.milestone_days || [];
  const rangeItems = day.range_reminders || [];
  const important = importantDates[0];
  const importantColor = safeColor(important?.color || "#9D4E3D");
  const holiday = day.holidays?.[0] || "";
  const cellStyle = important ? ` style="--day-color:${importantColor}"` : "";
  const cellClass = important ? "has-important" : holiday ? "has-holiday" : "";
  return `
    <button class="day-cell ${selected} ${cellClass}" data-date="${day.date}"${cellStyle}>
      <div class="day-num"><span>${Number(day.date.slice(-2))}</span></div>
      <div class="calendar-day-notes">
        ${important ? `<span class="important-line">${escapeHtml(important.title)}</span>` : ""}
        ${holiday ? `<span class="holiday-line">${escapeHtml(holiday)}</span>` : ""}
        ${day.lunar_label ? `<span class="lunar-line">${escapeHtml(day.lunar_label)}</span>` : ""}
      </div>
      ${rangeItems.length ? `<div class="calendar-task-strips">${rangeItems.slice(0, 3).map((item) => `
        <span class="calendar-task-strip ${item.status === "completed" ? "is-completed" : "is-active"}"><i></i><small>${escapeHtml(item.title)}</small></span>
      `).join("")}</div>` : ""}
    </button>
  `;
}

function dayAsideHeader(detail) {
  return `
    <div class="calendar-date-head">
      <h3>${formatDateText(detail.date)}</h3>
      <span>${escapeHtml(detail.lunar_label || "")}${detail.holidays?.length ? ` · ${escapeHtml(detail.holidays.join("、"))}` : ""}</span>
    </div>
  `;
}

function dayAside(detail) {
  return `
    <div class="spacer"></div>
    ${section("每日事项", dailyTaskList(detail.daily_tasks))}
    ${section("近期事项", rangeList(detail.range_reminders))}
    ${section("重要日期", cycleDayList(detail.milestone_days))}
    ${section("微记", recordList(detail.records))}
    ${section("札记", journalList(detail.journals))}
  `;
}

function cycleDayList(items) {
  if (!items.length) return empty("没有重要日期");
  return `<div class="list">${items.map((item) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${item.occurrence_date || ""}${item.anniversary_count !== null && item.anniversary_count !== undefined ? ` · 第 ${item.anniversary_count} 年` : ""}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</p>
        </div>
      </div>
    </article>`).join("")}</div>`;
}

function rangeList(items, manage = false) {
  if (!items.length) return empty("没有近期事项");
  return `<div class="daily-check-list event-card-list">${items.map((item) => `
    <article class="daily-check-item event-check-item ${item.status === "completed" ? "is-completed" : ""}" data-edit="rangeReminder" data-id="${item.id}">
      <input class="daily-checkbox" type="checkbox" data-toggle-range="${item.id}" data-completed="${item.status === "completed" ? "0" : "1"}" ${item.status === "completed" ? "checked" : ""} aria-label="${escapeHtml(item.title)}" />
      <div class="daily-check-content">
        <h4>${escapeHtml(item.title)}</h4>
        <p><span>${formatShortDate(item.start_date)} 至 ${formatShortDate(item.end_date)}</span>${item.description ? ` · ${escapeHtml(item.description)}` : ""}</p>
      </div>
      ${manage ? `<div class="row-actions event-actions"><button class="icon-btn" title="编辑" data-edit="rangeReminder" data-id="${item.id}">${iconSvg("gear")}</button><button class="icon-btn danger" title="删除" data-delete="range-reminders" data-id="${item.id}">${iconSvg("trash")}</button></div>` : ""}
    </article>`).join("")}</div>`;
}

function milestoneList(items, manage = false) {
  if (!items.length) return empty("没有日子");
  return `<div class="list">${items.map((item) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${item.occurrence_date || item.target_date || ""}${item.countdown_label ? ` · ${escapeHtml(item.countdown_label)}` : ""}${item.anniversary_count !== null && item.anniversary_count !== undefined ? ` · 第 ${item.anniversary_count} 年` : ""}</p>
        </div>
        ${manage ? `<div class="row-actions"><button class="btn small" data-edit="milestoneDay" data-id="${item.id}">编辑</button><button class="btn small danger" data-delete="milestone-days" data-id="${item.id}">删除</button></div>` : ""}
      </div>
    </article>`).join("")}</div>`;
}
