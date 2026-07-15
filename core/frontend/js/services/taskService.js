/* ═══════════════════════════════════════════════════════════════════════
   taskService.js — 每日任务 & 近期任务 业务逻辑层
   负责调用 API、更新 state、提供语义化函数。
   ═══════════════════════════════════════════════════════════════════════ */

/* ── 每日任务 ── */

async function loadDailyTasksPage() {
  state.dailyTemplates = await request("/daily-task-templates?include_disabled=true");
}

async function saveDailyTemplate(form, data) {
  const payload = cleanPayload({
    title: data.title,
    description: data.description,
    enabled: Boolean(data.enabled),
    time_period: data.time_period || "all_day",
    default_remind_time: data.default_remind_time,
    tag_ids: [],
  });
  let saved;
  if (data.id) {
    saved = await request(`/daily-task-templates/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    trackChange("daily_task_templates", data.id, "update");
  } else {
    saved = await request("/daily-task-templates", { method: "POST", body: JSON.stringify(payload) });
    trackChange("daily_task_templates", saved.id, "create");
  }
  state.edit.dailyTemplate = null;
  state.reminderEditor = null;
}

async function toggleTask(button) {
  const templateId = button.dataset.toggleTask;
  const targetCompleted = button.dataset.completed === "1";

  // 1. 乐观更新：立即修改本地状态
  if (state.dayDetail?.daily_tasks) {
    const task = state.dayDetail.daily_tasks.find((t) => String(t.template.id) === String(templateId));
    if (task) task.completed = targetCompleted;
  }

  // 2. 立即重新渲染（无 loading 状态）
  state.loading = false;
  render();

  // 3. 后台发送 API
  try {
    await request(`/daily-tasks/${templateId}/${state.selectedDate}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: targetCompleted }),
    });
  } catch (error) {
    // 回滚
    if (state.dayDetail?.daily_tasks) {
      const task = state.dayDetail.daily_tasks.find((t) => String(t.template.id) === String(templateId));
      if (task) task.completed = !targetCompleted;
    }
    render();
    setToast(error.message);
  }
}

/* ── 近期任务 ── */

async function loadNearTasksPage() {
  const [rangeCategories, rangeReminders] = await Promise.all([loadRangeCategoriesSafe(), request("/range-reminders")]);
  state.rangeCategories = rangeCategories;
  state.rangeReminders = rangeReminders;
}

async function loadRangeCategoriesSafe() {
  try {
    return await request("/range-task-categories");
  } catch (error) {
    if (error.status === 404 || error.message === "Not Found") return [];
    throw error;
  }
}

async function saveRangeCategory(data) {
  const payload = cleanPayload({
    title: data.title,
    icon: data.icon || "□",
  });
  let saved;
  try {
    saved = data.id
      ? await request(`/range-task-categories/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await request("/range-task-categories", { method: "POST", body: JSON.stringify(payload) });
  } catch (error) {
    if (error.status === 404 || error.message === "Not Found") {
      throw new Error("当前后端还没有加载近期任务分类接口，请重启后端后再添加分类");
    }
    throw error;
  }
  if (data.id) trackChange("range_task_categories", data.id, "update");
  else trackChange("range_task_categories", saved.id, "create");
  state.selectedRangeCategory = String(saved.id);
  state.edit.rangeCategory = saved.id;
  state.reminderEditor = null;
}

async function saveRangeReminder(data) {
  const form = document.querySelector("form[data-submit='rangeReminder']");
  const payload = cleanPayload({
    title: data.title,
    description: data.description,
    category_id: data.category_id ? Number(data.category_id) : null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    status: data.status || "active",
    display_mode: data.display_mode || "every_day",
    remind_time: null,
    steps: collectRangeSteps(form),
    tag_ids: [],
  });
  if (data.id) {
    await request(`/range-reminders/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    trackChange("range_reminders", data.id, "update");
  } else {
    const saved = await request("/range-reminders", { method: "POST", body: JSON.stringify(payload) });
    trackChange("range_reminders", saved.id, "create");
  }
  state.edit.rangeReminder = null;
  state.reminderEditor = null;
}

async function toggleRangeTask(button) {
  const itemId = button.dataset.toggleRange;
  const targetCompleted = button.dataset.completed === "1";
  const newStatus = targetCompleted ? "completed" : "active";

  // 1. 乐观更新：立即修改本地状态
  const item = state.rangeReminders.find((task) => String(task.id) === String(itemId));
  if (item) item.status = newStatus;
  if (state.dayDetail?.range_reminders) {
    const detailItem = state.dayDetail.range_reminders.find((task) => String(task.id) === String(itemId));
    if (detailItem) detailItem.status = newStatus;
  }
  // 同步更新 monthData 中的日历数据
  if (state.monthData?.days) {
    for (const day of state.monthData.days) {
      if (day.range_reminders) {
        const monthItem = day.range_reminders.find((task) => String(task.id) === String(itemId));
        if (monthItem) monthItem.status = newStatus;
      }
    }
  }

  // 2. 立即重新渲染
  state.loading = false;
  render();

  // 3. 后台发送 API
  try {
    await request(`/range-reminders/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
  } catch (error) {
    // 回滚
    if (item) item.status = targetCompleted ? "active" : "completed";
    if (state.dayDetail?.range_reminders) {
      const detailItem = state.dayDetail.range_reminders.find((task) => String(task.id) === String(itemId));
      if (detailItem) detailItem.status = targetCompleted ? "active" : "completed";
    }
    if (state.monthData?.days) {
      for (const day of state.monthData.days) {
        if (day.range_reminders) {
          const monthItem = day.range_reminders.find((task) => String(task.id) === String(itemId));
          if (monthItem) monthItem.status = targetCompleted ? "active" : "completed";
        }
      }
    }
    render();
    setToast(error.message);
  }
}

/* ── 倒数日 ── */

async function loadCountdownsPage() {
  const params = new URLSearchParams({ reference_date: state.selectedDate, include_disabled: "true", date_type: "once" });
  state.milestoneDays = await request(`/milestone-days?${params}`);
}

async function loadImportantDates() {
  const params = new URLSearchParams({ reference_date: state.selectedDate, include_disabled: "true" });
  const groups = await Promise.all(["weekly", "monthly", "yearly"].map((type) => request(`/milestone-days?${params}&date_type=${type}`)));
  state.importantDates = groups.flat();
}

async function saveMilestone(data) {
  const dateType = data.date_type || "once";
  const payload = cleanPayload({
    title: data.title,
    date_type: dateType,
    calendar_type: dateType === "once" || dateType === "weekly" ? "solar" : (data.calendar_type || "solar"),
    month: data.month ? Number(data.month) : null,
    day: data.day ? Number(data.day) : null,
    target_date: dateType === "once" ? data.target_date : null,
    start_year: data.start_year ? Number(data.start_year) : null,
    remind_days_before: Number(data.remind_days_before || 0),
    show_countdown: Boolean(data.show_countdown),
    show_after_due: Boolean(data.show_after_due),
    completed: Boolean(data.completed),
    enabled: Boolean(data.enabled),
    note: data.note,
    tag_ids: [],
  });
  if (Object.prototype.hasOwnProperty.call(data, "background_url")) payload.background_url = data.background_url || null;
  if (dateType === "weekly" && (!payload.day || payload.day < 1 || payload.day > 7)) throw new Error("每周重复的重要日期需要选择星期");
  if (dateType === "monthly" && (!payload.day || payload.day < 1 || payload.day > 31)) throw new Error("每月重复的重要日期需要填写日期");
  if (dateType === "yearly" && (!payload.month || !payload.day)) throw new Error("每年重复的重要日期需要填写月份和日期");
  if (payload.calendar_type === "lunar" && payload.day && payload.day > 30) throw new Error("农历日期不能超过三十");
  if (data.id) {
    await request(`/milestone-days/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    trackChange("milestone_days", data.id, "update");
  } else {
    const saved = await request("/milestone-days", { method: "POST", body: JSON.stringify(payload) });
    trackChange("milestone_days", saved.id, "create");
  }
  state.edit.milestoneDay = null;
  state.reminderEditor = null;
}

/* ── 通用 ── */

async function loadReminders() {
  const params = new URLSearchParams({ reference_date: state.selectedDate, include_disabled: "true" });
  const [dailyTemplates, rangeCategories, rangeReminders, milestoneDays] = await Promise.all([
    request("/daily-task-templates?include_disabled=true"),
    request("/range-task-categories"),
    request("/range-reminders"),
    request(`/milestone-days?${params}&date_type=once`),
  ]);
  state.dailyTemplates = dailyTemplates;
  state.rangeCategories = rangeCategories;
  state.rangeReminders = rangeReminders;
  state.milestoneDays = milestoneDays;
}
