/* ═══════════════════════════════════════════════════════════════════════
   dailyTasksView.js — 每日任务视图
   负责 HTML 渲染、DOM 事件绑定，调用 taskService。
   ═══════════════════════════════════════════════════════════════════════ */

function dailyTasksView() {
  const daily = state.dailyTemplates.find((item) => item.id === state.edit.dailyTemplate);
  const dailyTasks = state.dayDetail?.daily_tasks || [];
  const completedDaily = completedCount(dailyTasks);
  const editorHtml = state.reminderEditor === "dailyTemplate" ? dailyTaskEditor(daily) : "";
  return `
    ${topbar("每日任务", MODULE_SUBTITLES.dailyTasks, "")}
    <div class="daily-workspace">
      <section class="task-board-main">
          <div class="daily-progress">
            <span>${completedDaily} / ${dailyTasks.length} 已完成</span>
            <div><i style="width:${dailyTasks.length ? Math.round((completedDaily / dailyTasks.length) * 100) : 0}%"></i></div>
          </div>
          ${dailyTaskList(dailyTasks)}
      </section>
    </div>
    <div class="task-bottom-bar task-bottom-bar-full">
      <button class="add-line" data-action="newDailyTemplate">+ 添加任务</button>
    </div>
    ${editorHtml}
  `;
}

/* ── 每日任务列表项 ── */

function dailyTaskList(items, manage = false) {
  if (!items.length) return empty("今天还没有每日任务");
  const sorted = sortDailyTasks(items);
  const active = sorted.filter((item) => !item.completed);
  const completed = sorted.filter((item) => item.completed);
  return `
    <div class="daily-check-list">
      ${active.map((item) => dailyTaskItem(item)).join("")}
    </div>
    ${completed.length ? `
      <div class="completed-section">
        <button class="completed-toggle" data-action="toggleCompleted">
          <span class="completed-chevron">▾</span>
          <span>已完成</span>
        </button>
        <div class="daily-check-list completed-list">
          ${completed.map((item) => dailyTaskItem(item)).join("")}
        </div>
      </div>
    ` : ""}
  `;
}

function dailyTaskItem(item) {
  return `
    <article class="daily-check-item ${item.completed ? "is-completed" : ""}" data-edit="dailyTemplate" data-id="${item.template.id}">
      <input class="daily-checkbox" type="checkbox" data-toggle-task="${item.template.id}" data-completed="${item.completed ? "0" : "1"}" ${item.completed ? "checked" : ""} aria-label="${escapeHtml(item.template.title)}" />
      <div class="daily-check-content">
        <div class="daily-check-text">
          <h4>${escapeHtml(item.template.title)}</h4>
          <p><span>${dailyTimePeriodLabel(item.template.time_period)}</span>${item.note || item.template.description ? ` · ${escapeHtml(item.note || item.template.description)}` : ""}</p>
        </div>
        <div class="task-item-actions">
          <button class="task-action-btn" title="任务日志与专注" data-action="openTaskLog" data-task-type="daily_task" data-task-id="${item.template.id}" data-task-title="${escapeHtml(item.template.title)}">${iconSvg("timer")}</button>
        </div>
      </div>
    </article>`;
}

/* ── 每日任务模板表单 ── */

function dailyTemplateForm(item) {
  return `
    <form class="form-grid" data-submit="dailyTemplate">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <input type="hidden" name="default_remind_time" value="${item?.default_remind_time || ""}" />
      <input type="hidden" name="enabled" value="on" />
      ${field("名称", `<input name="title" value="${escapeHtml(item?.title || "")}" placeholder="例如：喝水、背单词、复盘" required />`)}
      ${field("时间", `<select name="time_period">${dailyTimePeriodOptions(item?.time_period || "all_day")}</select>`)}
      ${field("备注", `<textarea name="description" placeholder="可选，写一点执行标准或注意事项">${escapeHtml(item?.description || "")}</textarea>`)}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存任务" : "新增任务"}</button>
        ${item ? `<button class="btn danger" type="button" data-delete="daily-task-templates" data-id="${item.id}">删除</button>` : ""}
        ${item ? `<button class="btn" type="button" data-action="cancelEdit" data-edit-key="dailyTemplate">取消</button>` : ""}
      </div>
    </form>
  `;
}

function dailyTemplateList() {
  if (!state.dailyTemplates.length) return empty("还没有每日事项");
  return `<div class="list under-form">${state.dailyTemplates.map((item) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${item.enabled ? "已启用" : "已停用"} · ${dailyTimePeriodLabel(item.time_period)}</p>
        </div>
        <div class="row-actions">
          <button class="btn small" data-edit="dailyTemplate" data-id="${item.id}">编辑</button>
          <button class="btn small danger" data-delete="daily-task-templates" data-id="${item.id}">删除</button>
        </div>
      </div>
    </article>
  `).join("")}</div>`;
}

function dailyTaskEditor(item) {
  return taskDrawer(`
    <div class="reminder-editor-head">
      <span>${item ? "编辑每日任务" : "新增每日任务"}</span>
      <button class="icon-btn" type="button" data-action="closeTaskEditor">×</button>
    </div>
    ${dailyTemplateForm(item)}
  `);
}

/* ── 时段工具 ── */

function dailyTimePeriodOptions(current = "all_day") {
  return [
    ["morning", "早晨"],
    ["noon", "中午"],
    ["afternoon", "下午"],
    ["evening", "晚上"],
    ["night", "夜间"],
    ["all_day", "全天"],
  ].map(([value, label]) => option(value, label, current)).join("");
}

function dailyTimePeriodLabel(value) {
  return {
    morning: "早晨",
    noon: "中午",
    afternoon: "下午",
    evening: "晚上",
    night: "夜间",
    all_day: "全天",
  }[value] || "全天";
}

function sortDailyTasks(items) {
  const order = ["morning", "noon", "afternoon", "evening", "night", "all_day"];
  return [...items].sort((a, b) => {
    const completedDelta = Number(a.completed) - Number(b.completed);
    if (completedDelta) return completedDelta;
    return order.indexOf(a.template.time_period || "all_day") - order.indexOf(b.template.time_period || "all_day");
  });
}

function completedCount(items) {
  return items.filter((item) => item.completed).length;
}
