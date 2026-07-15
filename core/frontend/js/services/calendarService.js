/* ═══════════════════════════════════════════════════════════════════════
   calendarService.js — 日历 业务逻辑层
   ═══════════════════════════════════════════════════════════════════════ */

function calendarParams() {
  const params = new URLSearchParams();
  if (state.filters.tagId) params.set("tag_id", state.filters.tagId);
  return params;
}

function calendarMonthParams() {
  const params = new URLSearchParams();
  params.append("types", "range_reminders");
  params.append("types", "milestone_days");
  if (state.filters.tagId) params.set("tag_id", state.filters.tagId);
  return params;
}

async function loadMonth() {
  const params = calendarMonthParams();
  params.set("year", state.calendarYear);
  params.set("month", state.calendarMonth);
  state.monthData = await request(`/calendar/month?${params}`);
}

async function loadDay(date = state.selectedDate) {
  const params = calendarParams();
  state.dayDetail = await request(`/calendar/day/${date}${params.toString() ? `?${params}` : ""}`);
}

function syncCalendarToSelected() {
  const d = new Date(`${state.selectedDate}T00:00:00`);
  state.calendarYear = d.getFullYear();
  state.calendarMonth = d.getMonth() + 1;
}

function shiftSelectedDate(days) {
  const d = new Date(`${state.selectedDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  state.selectedDate = d.toISOString().slice(0, 10);
  syncCalendarToSelected();
}

function changeMonth(delta) {
  const date = new Date(state.calendarYear, state.calendarMonth - 1 + delta, 1);
  state.calendarYear = date.getFullYear();
  state.calendarMonth = date.getMonth() + 1;
  state.selectedDate = `${state.calendarYear}-${String(state.calendarMonth).padStart(2, "0")}-01`;
}
