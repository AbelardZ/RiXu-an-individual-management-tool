/* ═══════════════════════════════════════════════════════════════════════
   countdownsView.js — 倒数日 & 近期任务 视图层
   ═══════════════════════════════════════════════════════════════════════ */

function countdownsView() {
  const milestone = state.milestoneDays.find((item) => item.id === state.edit.milestoneDay);
  const editorHtml = state.reminderEditor === "milestoneDay" ? taskDrawer(countdownEditor(milestone)) : "";
  const detailHtml = state.reminderEditor === "milestoneDetail" && milestone ? countdownDetailModal(milestone) : "";
  return `
    ${topbar("倒数日", MODULE_SUBTITLES.countdowns, `<button class="btn-link" data-action="newMilestoneDay">添加倒数日</button>`)}
    <div class="countdown-page">
      ${countdownList(state.milestoneDays)}
    </div>
    ${editorHtml}
    ${detailHtml}
  `;
}

function countdownList(items) {
  if (!items.length) {
    return `
      <section class="countdown-empty">
        <h3>还没有倒数日</h3>
        <p>添加一个目标日期，让每一天都知道自己离它还有多远。</p>
        <button class="btn-link" data-action="newMilestoneDay">添加倒数日</button>
      </section>
    `;
  }
  return `<div class="countdown-strip-list">${items.map((item) => countdownStrip(item)).join("")}</div>`;
}

function countdownStrip(item) {
  const days = Number(item.countdown_days || 0);
  const isPast = days < 0;
  const isToday = days === 0;
  const timing = countdownTimingParts(days);
  const bgStyle = item.background_url ? `style="background-image: linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.25)), url('${escapeHtml(item.background_url)}'); background-size: cover; background-position: center;"` : "";
  return `
    <article class="countdown-strip ${isPast ? "is-past" : ""} ${isToday ? "is-today" : ""}" data-action="openMilestoneDetail" data-id="${item.id}" ${bgStyle}>
      <div class="countdown-strip-left">
        <h3>${escapeHtml(item.title)}</h3>
        <span>${formatShortDate(item.target_date || item.occurrence_date)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</span>
      </div>
      <div class="countdown-strip-right">
        <span>${timing.prefix}</span>
        <strong>${timing.value}</strong>
        ${timing.unit ? `<em>${timing.unit}</em>` : ""}
      </div>
    </article>
  `;
}

function countdownDetailModal(item) {
  const days = Number(item.countdown_days || 0);
  const isPast = days < 0;
  const isToday = days === 0;
  const timing = countdownTimingParts(days);
  const bgStyle = item.background_url ? `style="background-image: linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.2)), url('${escapeHtml(item.background_url)}'); background-size: cover; background-position: center;"` : "";
  return `
    <div class="modal-backdrop" data-action="closeMilestoneDetail">
      <div class="countdown-detail-wrap">
        <section class="countdown-detail-card ${isPast ? "is-past" : ""} ${isToday ? "is-today" : ""}" ${bgStyle}>
          <button class="countdown-detail-close icon-btn" data-action="closeMilestoneDetail">×</button>
          <div class="countdown-detail-body">
            <div class="countdown-detail-top">
              <span>${formatShortDate(item.target_date || item.occurrence_date)}</span>
              ${item.completed ? `<em>已完成</em>` : ""}
            </div>
            <h2>${escapeHtml(item.title)}</h2>
            <div class="countdown-number"><span>${timing.prefix}</span><strong>${timing.value}</strong>${timing.unit ? `<em>${timing.unit}</em>` : ""}</div>
            ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
          </div>
        </section>
        <div class="countdown-detail-actions">
          <button class="btn" data-action="editMilestoneFromDetail" data-id="${item.id}">编辑</button>
          <button class="btn" data-action="setMilestoneBg" data-id="${item.id}">编辑背景</button>
          ${item.background_url ? `<button class="btn" data-action="clearMilestoneBg" data-id="${item.id}">删除背景</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

function countdownTimingParts(days) {
  if (days === 0) return { prefix: "就是", value: "今天", unit: "" };
  return {
    prefix: days < 0 ? "已经" : "还有",
    value: Math.abs(days),
    unit: "天",
  };
}

function countdownEditor(item) {
  return `
    <div class="reminder-editor-head">
      <span>${item ? "编辑倒数日" : "新增倒数日"}</span>
      <button class="icon-btn" type="button" data-action="closeTaskEditor">×</button>
    </div>
    <form class="form-grid" data-submit="milestoneDay">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <input type="hidden" name="date_type" value="once" />
      <input type="hidden" name="show_countdown" value="on" />
      <input type="hidden" name="show_after_due" value="on" />
      <input type="hidden" name="enabled" value="on" />
      ${field("名称", `<input name="title" value="${escapeHtml(item?.title || "")}" placeholder="例如：考试、旅行、交付日" required />`)}
      ${field("目标日期", datePickerHtml("target_date", item?.target_date || state.selectedDate, { required: true }))}
      ${field("备注", `<textarea name="note" placeholder="可选，写下为什么期待这一天">${escapeHtml(item?.note || "")}</textarea>`)}
      <label class="check"><input name="completed" type="checkbox" ${item?.completed ? "checked" : ""} /> 已完成</label>
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存倒数日" : "新增倒数日"}</button>
        ${item ? `<button class="btn danger" type="button" data-delete="milestone-days" data-id="${item.id}">删除</button>` : ""}
      </div>
    </form>
  `;
}

/* ── 近期任务视图 ── */

function nearTasksView() {
  const range = state.rangeReminders.find((item) => item.id === state.edit.rangeReminder);
  const category = state.rangeCategories.find((item) => item.id === state.edit.rangeCategory);
  const visibleTasks = rangeTasksForCurrentView();
  const completedRange = visibleTasks.filter((item) => item.status === "completed").length;
  const editorHtml = nearTaskEditorHtml(range, category);
  return `
    ${topbar("近期任务", MODULE_SUBTITLES.nearTasks, "")}
    <div class="task-workspace">
      ${rangeTaskSidebar()}
      <section class="task-board-main">
        <div class="task-board-head">
          <div>
            <h3>${rangeTaskViewTitle()}</h3>
            <p>${completedRange} / ${visibleTasks.length} 已完成</p>
          </div>
        </div>
        ${rangeTaskList(visibleTasks)}
      </section>
    </div>
    <div class="task-bottom-bar">
      <div class="task-bottom-left">
        <button class="btn-link" data-action="manageRangeCategories">管理分类</button>
      </div>
      <div class="task-bottom-right">
        <button class="add-line" data-action="newRangeReminder">+ 添加任务</button>
      </div>
    </div>
    ${editorHtml}
  `;
}

function rangeTaskSidebar() {
  const todayCount = todayRangeTasks().length;
  const allCount = state.rangeReminders.filter((item) => item.status !== "cancelled").length;
  return `
    <aside class="task-sidebar">
      <div class="task-sidebar-primary">
      <button class="${state.selectedRangeCategory === "today" ? "active" : ""}" data-action="selectRangeCategory" data-category-id="today">
        <strong>今天</strong><em>${todayCount}</em>
      </button>
      <button class="${state.selectedRangeCategory === "all" ? "active" : ""}" data-action="selectRangeCategory" data-category-id="all">
        <strong>全部</strong><em>${allCount}</em>
      </button>
      </div>
      <div class="task-sidebar-divider"></div>
      <div class="task-category-list">
        ${state.rangeCategories.length ? state.rangeCategories.map((category) => `
          <button class="${state.selectedRangeCategory === String(category.id) ? "active" : ""}" data-action="selectRangeCategory" data-category-id="${category.id}">
            <span class="task-category-name"><span class="task-category-icon" style="--category-color:${rangeColor(category)}">${escapeHtml(category.icon || "□")}</span><strong>${escapeHtml(category.title)}</strong></span>
            <em>${rangeCategoryCount(category.id)}</em>
          </button>
        `).join("") : `<div class="task-sidebar-empty">还没有自定义分类</div>`}
      </div>
    </aside>
  `;
}

function todayRangeTasks() {
  return state.rangeReminders.filter((item) => {
    if (item.status === "cancelled") return false;
    // 没有设置日期范围的任务始终显示在"今天"
    if (!item.start_date && !item.end_date) return true;
    // 有日期范围的任务检查是否在今天范围内
    const hasStart = item.start_date && item.start_date <= state.selectedDate;
    const hasEnd = item.end_date && item.end_date >= state.selectedDate;
    // 只有开始日期：从该日期起都算
    if (item.start_date && !item.end_date) return hasStart;
    // 只有结束日期：截止日期前都算
    if (!item.start_date && item.end_date) return hasEnd;
    return hasStart && hasEnd;
  });
}

function rangeTasksForCurrentView() {
  const selected = String(state.selectedRangeCategory || "today");
  let items = state.rangeReminders.filter((item) => item.status !== "cancelled");
  if (selected === "today") items = todayRangeTasks();
  if (!["today", "all"].includes(selected)) items = items.filter((item) => String(item.category_id || "") === selected);
  return items.sort((a, b) => {
    const completedDelta = Number(a.status === "completed") - Number(b.status === "completed");
    if (completedDelta) return completedDelta;
    return String(a.end_date).localeCompare(String(b.end_date)) || String(a.start_date).localeCompare(String(b.start_date));
  });
}

function rangeTaskViewTitle() {
  const selected = String(state.selectedRangeCategory || "today");
  if (selected === "today") return "今天应该做的事情";
  if (!["today", "all"].includes(selected)) {
    const category = state.rangeCategories.find((item) => String(item.id) === selected);
    if (category) return `${escapeHtml(category.icon || "□")} ${escapeHtml(category.title)}`;
  }
  return "全部近期任务";
}

function rangeCategoryCount(id) {
  return state.rangeReminders.filter((item) => item.status !== "cancelled" && item.category_id === id).length;
}

function rangeTaskList(items) {
  if (!items.length) return empty("这里还没有近期任务");
  const active = items.filter((item) => item.status !== "completed");
  const completed = items.filter((item) => item.status === "completed");
  return `
    <div class="daily-check-list">
      ${active.map((item) => rangeTaskItem(item)).join("")}
    </div>
    ${completed.length ? `
      <div class="completed-section">
        <button class="completed-toggle" data-action="toggleCompleted">
          <span class="completed-chevron">▾</span>
        <span>已完成</span>
        </button>
        <div class="daily-check-list completed-list">
          ${completed.map((item) => rangeTaskItem(item)).join("")}
        </div>
      </div>
    ` : ""}
  `;
}

function rangeTaskItem(item) {
  const hasStart = item.start_date;
  const hasEnd = item.end_date;
  let dateInfo = "";
  if (hasStart && hasEnd) {
    dateInfo = `${formatShortDate(item.start_date)} 至 ${formatShortDate(item.end_date)}`;
  } else if (hasStart) {
    dateInfo = `从 ${formatShortDate(item.start_date)} 开始`;
  } else if (hasEnd) {
    dateInfo = `截止 ${formatShortDate(item.end_date)}`;
  }
  return `
    <article class="daily-check-item ${item.status === "completed" ? "is-completed" : ""}" data-edit="rangeReminder" data-id="${item.id}">
      <input class="daily-checkbox" type="checkbox" data-toggle-range="${item.id}" data-completed="${item.status === "completed" ? "0" : "1"}" ${item.status === "completed" ? "checked" : ""} aria-label="${escapeHtml(item.title)}" />
      <div class="daily-check-content">
        <div class="daily-check-text">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${dateInfo}${rangeStepSummary(item)}${item.description ? ` · ${escapeHtml(item.description)}` : ""}</p>
        </div>
        <div class="task-item-actions">
          <button class="task-action-btn" title="任务日志与专注" data-action="openTaskLog" data-task-type="range_reminder" data-task-id="${item.id}" data-task-title="${escapeHtml(item.title)}">${iconSvg("timer")}</button>
        </div>
      </div>
    </article>`;
}

function rangeStepSummary(item) {
  const steps = item.steps || [];
  if (!steps.length) return "";
  return ` · 步骤 ${steps.filter((step) => step.completed).length}/${steps.length}`;
}

function rangeTaskEditor(item) {
  return rangeReminderForm(item);
}

function nearTaskEditorHtml(range, category) {
  if (state.reminderEditor === "rangeCategoryManager") {
    return modalDrawer(rangeCategoryManager(), "管理分类");
  }
  if (state.reminderEditor === "rangeCategory") {
    return taskDrawer(rangeCategoryEditor(category), category ? "编辑分类" : "新增分类");
  }
  if (state.reminderEditor === "rangeReminder") {
    return taskDrawer(rangeTaskEditor(range), range ? "编辑近期任务" : "新增近期任务");
  }
  return "";
}

function modalDrawer(body, title) {
  return taskDrawer(body, title);
}

function taskDrawer(body, title) {
  return `
    <div class="todo-drawer-backdrop" data-action="closeTaskEditor"></div>
    <aside class="reminder-editor todo-detail-drawer">
      <div class="reminder-editor-head">
        <span>${escapeHtml(title || "")}</span>
        <button class="icon-btn" type="button" data-action="closeTaskEditor">×</button>
      </div>
      ${body}
    </aside>
  `;
}

function rangeCategoryEditor(item) {
  return `
    <form class="form-grid" data-submit="rangeCategory">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      ${field("标题", `<input name="title" value="${escapeHtml(item?.title || "")}" placeholder="例如：工作、学习、家庭" required />`)}
      ${field("图标", categoryIconPickerHtml(item?.icon || "📋"))}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存分类" : "新增分类"}</button>
        ${item ? `<button class="btn danger" type="button" data-delete="range-task-categories" data-id="${item.id}">删除</button>` : ""}
      </div>
    </form>
  `;
}

function rangeCategoryManager() {
  return `
    <div class="category-manager">
      <button class="add-line category-manager-add" data-action="newRangeCategory">新增分类</button>
      ${state.rangeCategories.length ? `
        <div class="category-manager-list">
          ${state.rangeCategories.map((category) => `
            <article class="category-manager-item">
              <div>
                <span class="category-manager-icon" style="--category-color:${rangeColor(category)}">${escapeHtml(category.icon || "□")}</span>
                <strong>${escapeHtml(category.title)}</strong>
                <em>${rangeCategoryCount(category.id)} 项任务</em>
              </div>
              <div class="row-actions">
                <button class="btn small" data-edit="rangeCategory" data-id="${category.id}">编辑</button>
                <button class="btn small danger" data-delete="range-task-categories" data-id="${category.id}">删除</button>
              </div>
            </article>
          `).join("")}
        </div>
      ` : empty("还没有分类，先新增一个吧")}
    </div>
  `;
}

function categoryIconPickerHtml(current = "📋") {
  return `
    ${iconPickerHtml(current)}
    <input class="control compact-icon-input" data-custom-icon value="${escapeHtml(current)}" maxlength="16" placeholder="自定义图标" />
  `;
}

function rangeReminderForm(item) {
  return `
    <form class="form-grid" data-submit="rangeReminder">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <input type="hidden" name="status" value="${item?.status || "active"}" />
      <input type="hidden" name="display_mode" value="${item?.display_mode || "every_day"}" />
      ${field("名称", `<input name="title" value="${escapeHtml(item?.title || "")}" placeholder="例如：完成项目方案" required />`)}
      ${field("分类", `<select name="category_id">
        ${option("", "不分类", item?.category_id || "")}
        ${state.rangeCategories.map((category) => option(category.id, `${category.icon || "□"} ${category.title}`, item?.category_id || "")).join("")}
      </select>`)}
      ${rangeStepEditor(item?.steps || [])}
      <div class="two-col">
        ${field("开始日期", datePickerHtml("start_date", item?.start_date || "", { placeholder: "不设置则无期限" }))}
        ${field("结束日期", datePickerHtml("end_date", item?.end_date || "", { placeholder: "不设置则无期限" }))}
      </div>
      ${field("备注", `<textarea name="description" rows="4" placeholder="可选，补充任务背景或注意事项">${escapeHtml(item?.description || "")}</textarea>`)}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存任务" : "新增任务"}</button>
        ${item ? `<button class="btn danger" type="button" data-delete="range-reminders" data-id="${item.id}">删除</button>` : ""}
        ${item ? `<button class="btn" type="button" data-action="cancelEdit" data-edit-key="rangeReminder">取消</button>` : ""}
      </div>
    </form>
  `;
}

function rangeStepEditor(steps = []) {
  const rows = steps.length ? steps : [];
  return `
    <div class="field">
      <span>步骤</span>
      <div class="step-editor" data-step-editor>
        ${rows.length ? rows.map((step) => rangeStepRow(step)).join("") : `<p class="step-empty-hint">暂无步骤，点击下方添加</p>`}
      </div>
      <button class="step-add-btn" type="button" data-action="addRangeStep">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
        <span>添加步骤</span>
      </button>
    </div>
  `;
}

function rangeStepRow(step = {}) {
  return `
    <div class="range-step-row">
      <button type="button" class="step-check ${step.completed ? "done" : ""}" data-action="toggleStepCheck" title="${step.completed ? "标记为未完成" : "标记为已完成"}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-5"/></svg>
      </button>
      <input type="hidden" name="step_id" value="${escapeHtml(step.id || "")}" />
      <input type="hidden" name="step_completed" value="${step.completed ? "1" : "0"}" />
      <input name="step_title" class="step-input ${step.completed ? "done" : ""}" value="${escapeHtml(step.title || "")}" placeholder="输入步骤名称" />
      <button type="button" class="step-remove-btn" data-action="removeRangeStep" title="删除步骤">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
  `;
}

function milestoneForm(item) {
  return `
    <form class="form-grid" data-submit="milestoneDay">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      ${field("标题", `<input name="title" value="${escapeHtml(item?.title || "")}" required />`)}
      ${field("日期类型", `<select name="date_type" id="milestoneType">
        ${option("once", "一次性日期", item?.date_type || "once")}
        ${option("yearly", "每年重复", item?.date_type)}
      </select>`)}
      <div class="two-col">
        ${field("目标日期", datePickerHtml("target_date", item?.target_date || state.selectedDate))}
        ${field("起始年份", `<input name="start_year" type="number" min="1" value="${item?.start_year || ""}" />`)}
      </div>
      <div class="two-col">
        ${field("月份", `<input name="month" type="number" min="1" max="12" value="${item?.month || ""}" />`)}
        ${field("日期", `<input name="day" type="number" min="1" max="31" value="${item?.day || ""}" />`)}
      </div>
      ${field("提前提醒天数", `<input name="remind_days_before" type="number" min="0" value="${item?.remind_days_before || 0}" />`)}
      ${field("备注", `<textarea name="note">${escapeHtml(item?.note || "")}</textarea>`)}
      <div class="check-row">
        <label class="check"><input name="show_countdown" type="checkbox" ${item?.show_countdown === false ? "" : "checked"} /> 显示倒数</label>
        <label class="check"><input name="show_after_due" type="checkbox" ${item?.show_after_due === false ? "" : "checked"} /> 到期后显示</label>
        <label class="check"><input name="completed" type="checkbox" ${item?.completed ? "checked" : ""} /> 已完成</label>
        <label class="check"><input name="enabled" type="checkbox" ${item?.enabled === false ? "" : "checked"} /> 启用</label>
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存周期日子" : "新增周期日子"}</button>
        ${item ? `<button class="btn" type="button" data-action="cancelEdit" data-edit-key="milestoneDay">取消</button>` : ""}
      </div>
    </form>
  `;
}

function importantDateSettings(item) {
  return `
    <div class="reminder-editor-head">
      <span>管理重要日</span>
      <button class="icon-btn" type="button" data-action="closeTaskEditor">×</button>
    </div>
    ${importantDateForm(item)}
    <div class="important-date-list">
      <div class="section-head"><h3>已添加</h3></div>
      ${importantDateList(state.importantDates)}
    </div>
  `;
}

function importantDateForm(item) {
  const frequency = item?.date_type || state.importantDateFrequency || "yearly";
  const selectedColor = presetColor(item?.color, "#9D4E3D");
  return `
    <form class="form-grid" data-submit="milestoneDay">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <input type="hidden" name="show_countdown" value="" />
      <input type="hidden" name="show_after_due" value="on" />
      <input type="hidden" name="enabled" value="on" />
      ${field("名称", `<input name="title" value="${escapeHtml(item?.title || "")}" placeholder="例如：运动日、工资日、纪念日" required />`)}
      ${colorPaletteField("颜色", selectedColor)}
      ${field("备注", `<textarea name="note" placeholder="可选">${escapeHtml(item?.note || "")}</textarea>`)}
      ${field("频率", `<select name="date_type" id="importantDateFrequency">
        ${option("weekly", "每周", frequency)}
        ${option("monthly", "每月", frequency)}
        ${option("yearly", "每年", frequency)}
      </select>`)}
      ${frequency === "weekly" ? "" : field("日期口径", `<select name="calendar_type">
        ${option("solar", "公历", item?.calendar_type || "solar")}
        ${option("lunar", "农历", item?.calendar_type || "solar")}
      </select>`)}
      ${importantDateFields(frequency, item)}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存重要日期" : "新增重要日期"}</button>
        ${item ? `<button class="btn danger" type="button" data-delete="milestone-days" data-id="${item.id}">删除</button>` : ""}
      </div>
    </form>
  `;
}

function importantDateFields(frequency, item) {
  if (frequency === "weekly") {
    return field("星期", `<select name="day">
      ${[["1", "星期一"], ["2", "星期二"], ["3", "星期三"], ["4", "星期四"], ["5", "星期五"], ["6", "星期六"], ["7", "星期日"]].map(([value, label]) => option(value, label, item?.day || "1")).join("")}
    </select>`);
  }
  if (frequency === "monthly") {
    return field("每月日期", `<input name="day" type="number" min="1" max="31" value="${item?.day || new Date(`${state.selectedDate}T00:00:00`).getDate()}" required />`);
  }
  const selected = new Date(`${item?.occurrence_date || item?.target_date || state.selectedDate}T00:00:00`);
  return `<div class="two-col">
    ${field("月份", `<input name="month" type="number" min="1" max="12" value="${item?.month || selected.getMonth() + 1}" required />`)}
    ${field("日期", `<input name="day" type="number" min="1" max="31" value="${item?.day || selected.getDate()}" required />`)}
  </div>`;
}

function importantDateList(items) {
  if (!items.length) return empty("还没有重要日期");
  return `<div class="list">${items.map((item) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h4><span class="dot big" style="background:${safeColor(item.color || "#9D4E3D")}"></span>${escapeHtml(item.title)}</h4>
          <p>${importantDateFrequencyLabel(item)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</p>
        </div>
        <button class="btn small" type="button" data-action="editImportantDate" data-id="${item.id}">编辑</button>
      </div>
    </article>
  `).join("")}</div>`;
}

function importantDateFrequencyLabel(item) {
  if (item.date_type === "weekly") return `每周 · ${["", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][item.day || 1]}`;
  const calendar = item.calendar_type === "lunar" ? "农历" : "公历";
  if (item.date_type === "monthly") return `每月 · ${calendar} ${item.day} 日`;
  return `每年 · ${calendar} ${item.month} 月 ${item.day} 日`;
}

function addRangeStepRow() {
  const container = document.querySelector("[data-step-editor]");
  if (container) {
    const hint = container.querySelector(".step-empty-hint");
    if (hint) hint.remove();
    container.insertAdjacentHTML("beforeend", rangeStepRow());
  }
}

function removeRangeStepRow(button) {
  const row = button.closest(".range-step-row");
  if (row) row.remove();
}

function toggleStepCheck(button) {
  const row = button.closest(".range-step-row");
  if (!row) return;
  const isDone = button.classList.toggle("done");
  const hidden = row.querySelector('input[name="step_completed"]');
  const input = row.querySelector(".step-input");
  if (hidden) hidden.value = isDone ? "1" : "0";
  if (input) input.classList.toggle("done", isDone);
}
