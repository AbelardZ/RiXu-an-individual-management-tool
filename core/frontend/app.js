/* ═══════════════════════════════════════════════════════════════════════
   app.js — 主应用入口
   state 定义在 js/state.js，API 请求封装在 js/apiClient.js，工具函数在 js/utils.js
   ═══════════════════════════════════════════════════════════════════════ */

const app = document.getElementById("app");
const colorPresets = [
  ["#2F5D62", "松石绿"],
  ["#3A6EA5", "雾蓝"],
  ["#5B5F97", "暮紫"],
  ["#7C3F58", "酒莓"],
  ["#8A5A44", "陶土"],
  ["#9A6B2F", "琥珀"],
  ["#4F6F52", "苔绿"],
  ["#6B705C", "橄榄灰"],
  ["#9D4E3D", "赤陶红"],
  ["#3D405B", "墨蓝"],
  ["#8E7DBE", "鸢尾紫"],
  ["#2A9D8F", "孔雀青"],
];
const menu = [
  ["today", "今日", "home"],
  ["calendar", "日历", "calendar"],
  ["records", "微记", "check"],
  ["journals", "札记", "note"],
  ["nearTasks", "近期任务", "bell"],
  ["dailyTasks", "每日任务", "check"],
  ["countdowns", "倒数日", "calendar"],
];

function setToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2800);
}

/* ── 同步状态 ── */

function syncStatusLabel() {
  switch (state.syncStatus) {
    case "online": return "在线";
    case "offline": return "离线";
    case "syncing": return "同步中…";
    case "synced": return "已同步";
    case "error": return "同步失败";
    default: return "离线";
  }
}

async function updateSyncStatus() {
  try {
    const status = await syncStatus();
    state.syncStatus = status.online ? "online" : "offline";
    state.syncMessage = status.online ? "云端已连接" : "离线模式";
    const backup = await backupStatus();
    if (backup) state.backupInfo = backup;
  } catch {
    state.syncStatus = "offline";
    state.syncMessage = "离线模式";
  }
  updateSyncIndicator();
}

/* ═══════════════════════════════════════════════════════════════════════
   自定义日期时间选择器
   ═══════════════════════════════════════════════════════════════════════ */

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const WEEKDAYS = ["一","二","三","四","五","六","日"];
const TIMEZONE_OPTIONS = [
  ["Asia/Shanghai", "北京时间"],
  ["Asia/Tokyo", "东京时间"],
  ["Asia/Singapore", "新加坡时间"],
  ["Asia/Seoul", "首尔时间"],
  ["Asia/Hong_Kong", "香港时间"],
  ["Asia/Taipei", "台北时间"],
  ["Asia/Bangkok", "曼谷时间"],
  ["Asia/Kolkata", "印度时间"],
  ["Europe/London", "伦敦时间"],
  ["Europe/Paris", "巴黎时间"],
  ["Europe/Berlin", "柏林时间"],
  ["Europe/Moscow", "莫斯科时间"],
  ["America/New_York", "纽约时间"],
  ["America/Los_Angeles", "洛杉矶时间"],
  ["America/Toronto", "多伦多时间"],
  ["America/Sao_Paulo", "圣保罗时间"],
  ["Australia/Sydney", "悉尼时间"],
  ["UTC", "UTC"],
];
const BIRTH_PLACE_OPTIONS = [
  "北京市",
  "天津市",
  "上海市",
  "重庆市",
  "河北省",
  "山西省",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "海南省",
  "四川省",
  "贵州省",
  "云南省",
  "陕西省",
  "甘肃省",
  "青海省",
  "台湾省",
  "广西壮族自治区",
  "内蒙古自治区",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "西藏自治区",
  "香港特别行政区",
  "澳门特别行政区",
];

function datePickerHtml(name, value = "", opts = {}) {
  const { required = false, placeholder = "选择日期" } = opts;
  const display = value ? formatShortDate(value) : "";
  return `
    <div class="dt-picker" data-dt-picker="date" data-name="${escapeHtml(name)}">
      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${required ? "required" : ""} />
      <button type="button" class="dt-picker-trigger" data-action="openDatePicker">
        <svg class="dt-picker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
        <span class="dt-picker-value">${escapeHtml(display || placeholder)}</span>
      </button>
    </div>
  `;
}

function timePickerHtml(name, value = "", opts = {}) {
  const { required = false, placeholder = "选择时间" } = opts;
  const display = value || "";
  return `
    <div class="dt-picker" data-dt-picker="time" data-name="${escapeHtml(name)}">
      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${required ? "required" : ""} />
      <button type="button" class="dt-picker-trigger" data-action="openTimePicker">
        <svg class="dt-picker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        <span class="dt-picker-value">${escapeHtml(display || placeholder)}</span>
      </button>
    </div>
  `;
}

/* ── 现代化日期选择器（月历表） ── */

function datePickerPanelHtml(pickerEl) {
  const hidden = pickerEl.querySelector('input[type="hidden"]');
  const current = hidden?.value || todayISO();
  const [y, m, d] = current.split("-").map(Number);
  const year = y || new Date().getFullYear();
  const month = m || new Date().getMonth() + 1;
  const day = d || new Date().getDate();
  const name = pickerEl.dataset.name;

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const today = todayISO();

  const calendarCells = [];
  for (let i = 0; i < startOffset; i += 1) calendarCells.push(null);
  for (let i = 1; i <= daysInMonth; i += 1) calendarCells.push(i);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return `
    <div class="dt-panel-backdrop">
      <div class="dt-panel dt-panel-date-modern" data-dt-panel="date">
        <div class="dt-date-nav">
          <button type="button" class="dt-date-nav-btn" data-action="dtPrevMonth">‹</button>
          <span class="dt-date-nav-title" data-dt-title>${year}年${month}月</span>
          <button type="button" class="dt-date-nav-btn" data-action="dtNextMonth">›</button>
        </div>
        <div class="dt-calendar-week">${WEEKDAYS.map((w) => `<span>${w}</span>`).join("")}</div>
        <div class="dt-calendar-grid">
          ${calendarCells.map((v) => {
            if (!v) return `<span class="dt-cal-empty"></span>`;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(v).padStart(2, "0")}`;
            const isToday = dateStr === today;
            const isActive = v === day;
            return `<button type="button" class="dt-cal-day ${isActive ? "active" : ""} ${isToday ? "today" : ""}" data-day="${v}">${v}</button>`;
          }).join("")}
        </div>
        <div class="dt-panel-foot">
          <button type="button" class="btn" data-action="closeDatePicker">取消</button>
          <button type="button" class="btn primary" data-action="confirmDatePickerModern" data-name="${escapeHtml(name)}">确定</button>
        </div>
      </div>
    </div>
  `;
}

/* ── 现代化时间选择器（AM/PM + 时 + 分 三柱） ── */

function timePickerPanelHtml(pickerEl) {
  const hidden = pickerEl.querySelector('input[type="hidden"]');
  const current = hidden?.value || "08:00";
  const [h, m] = current.split(":").map(Number);
  const hour24 = h || 8;
  const minute = m || 0;
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;
  const name = pickerEl.dataset.name;

  const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [];
  for (let i = 0; i < 60; i += 5) minutes.push(i);

  return `
    <div class="dt-panel-backdrop">
      <div class="dt-panel dt-panel-time-modern" data-dt-panel="time">
        <div class="dt-time-modern-body">
          <div class="dt-time-col">
            <div class="dt-time-col-label">AM/PM</div>
            <div class="dt-time-col-list" data-scroll="ampm">
              <button type="button" class="dt-time-item ${!isPM ? "active" : ""}" data-value="AM">AM</button>
              <button type="button" class="dt-time-item ${isPM ? "active" : ""}" data-value="PM">PM</button>
            </div>
          </div>
          <div class="dt-time-col">
            <div class="dt-time-col-label">时</div>
            <div class="dt-time-col-list" data-scroll="hour">
              ${hours12.map((v) => `<button type="button" class="dt-time-item ${v === hour12 ? "active" : ""}" data-value="${v}">${v}</button>`).join("")}
            </div>
          </div>
          <div class="dt-time-col">
            <div class="dt-time-col-label">分</div>
            <div class="dt-time-col-list" data-scroll="minute">
              ${minutes.map((v) => `<button type="button" class="dt-time-item ${v === minute ? "active" : ""}" data-value="${v}">${String(v).padStart(2, "0")}</button>`).join("")}
            </div>
          </div>
        </div>
        <div class="dt-panel-foot">
          <button type="button" class="btn" data-action="closeTimePicker">取消</button>
          <button type="button" class="btn primary" data-action="confirmTimePickerModern" data-name="${escapeHtml(name)}">确定</button>
        </div>
      </div>
    </div>
  `;
}

function openDatePickerPanel(trigger) {
  const picker = trigger.closest("[data-dt-picker]");
  if (!picker) return;
  closeAllDtPanels();
  const panel = document.createElement("div");
  panel.className = "dt-panel-container";
  panel.innerHTML = datePickerPanelHtml(picker);
  document.body.appendChild(panel);
  requestAnimationFrame(() => {
    const active = panel.querySelector(".dt-scroll-item.active");
    if (active) active.scrollIntoView({ block: "center" });
  });
  bindDtPanel(panel, picker);
}

function openTimePickerPanel(trigger) {
  const picker = trigger.closest("[data-dt-picker]");
  if (!picker) return;
  closeAllDtPanels();
  const panel = document.createElement("div");
  panel.className = "dt-panel-container";
  panel.innerHTML = timePickerPanelHtml(picker);
  document.body.appendChild(panel);
  requestAnimationFrame(() => {
    const active = panel.querySelector(".dt-scroll-item.active");
    if (active) active.scrollIntoView({ block: "center" });
  });
  bindDtPanel(panel, picker);
}

function openSelectPickerPanel(trigger) {
  const picker = trigger.closest("[data-dt-picker]");
  if (!picker) return;
  closeAllDtPanels();
  const panel = document.createElement("div");
  panel.className = "dt-panel-container";
  panel.innerHTML = selectPickerPanelHtml(picker);
  document.body.appendChild(panel);
  requestAnimationFrame(() => {
    const active = panel.querySelector(".dt-scroll-item.active");
    if (active) active.scrollIntoView({ block: "center" });
  });
  bindDtPanel(panel, picker);
}

function closeAllDtPanels() {
  document.querySelectorAll(".dt-panel-container").forEach((el) => el.remove());
}

function bindDtPanel(panel, picker) {
  const dtPanel = panel.querySelector("[data-dt-panel]");
  const backdrop = panel.querySelector(".dt-panel-backdrop");

  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeAllDtPanels();
  });

  dtPanel?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // 日历日期点击
    if (btn.classList.contains("dt-cal-day")) {
      e.preventDefault();
      const day = btn.dataset.day;
      if (day) {
        panel.querySelectorAll(".dt-cal-day").forEach((b) => b.classList.toggle("active", b.dataset.day === day));
      }
      return;
    }

    // 时间选择项点击
    if (btn.classList.contains("dt-time-item")) {
      e.preventDefault();
      const list = btn.closest("[data-scroll]");
      if (list) {
        list.querySelectorAll(".dt-time-item").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }
      return;
    }

    // 月份导航
    if (btn.dataset.action === "dtPrevMonth" || btn.dataset.action === "dtNextMonth") {
      e.preventDefault();
      const title = panel.querySelector("[data-dt-title]");
      const dir = btn.dataset.action === "dtPrevMonth" ? -1 : 1;
      if (title) {
        const [y, m] = title.textContent.replace("年", " ").replace("月", "").trim().split(/\s+/).map(Number);
        const newDate = new Date(y, m - 1 + dir, 1);
        title.textContent = `${newDate.getFullYear()}年${newDate.getMonth() + 1}月`;
        updateDtCalendarModern(panel, newDate.getFullYear(), newDate.getMonth() + 1);
      }
      return;
    }

    // 关闭
    if (btn.dataset.action === "closeDatePicker" || btn.dataset.action === "closeTimePicker" || btn.dataset.action === "closeSelectPicker") {
      closeAllDtPanels();
      return;
    }

    // 确认日期（新版）
    if (btn.dataset.action === "confirmDatePickerModern") {
      const name = btn.dataset.name;
      const title = panel.querySelector("[data-dt-title]");
      const activeDay = panel.querySelector(".dt-cal-day.active");
      if (title && activeDay) {
        const [y, m] = title.textContent.replace("年", " ").replace("月", "").trim().split(/\s+/).map(Number);
        const value = `${y}-${String(m).padStart(2, "0")}-${String(activeDay.dataset.day).padStart(2, "0")}`;
        updateDtPickerValue(picker, value);
        closeAllDtPanels();
        if (name === "datePicker" || name === "sideDatePicker") {
          state.selectedDate = value;
          syncCalendarToSelected();
          loadView().catch((e) => setToast(e.message));
        }
      }
      return;
    }

    // 确认时间（新版）
    if (btn.dataset.action === "confirmTimePickerModern") {
      const ampm = panel.querySelector('[data-scroll="ampm"] .active')?.dataset.value || "AM";
      const hour12 = parseInt(panel.querySelector('[data-scroll="hour"] .active')?.dataset.value || "12");
      const minute = parseInt(panel.querySelector('[data-scroll="minute"] .active')?.dataset.value || "0");
      let hour24 = hour12;
      if (ampm === "PM" && hour12 !== 12) hour24 = hour12 + 12;
      if (ampm === "AM" && hour12 === 12) hour24 = 0;
      const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      updateDtPickerValue(picker, value);
      closeAllDtPanels();
      return;
    }

    // 旧版确认（兼容）
    if (btn.dataset.action === "confirmDatePicker") {
      const name = btn.dataset.name;
      const year = panel.querySelector('[data-scroll="year"] .active')?.dataset.value || "";
      const month = String(panel.querySelector('[data-scroll="month"] .active')?.dataset.value || "").padStart(2, "0");
      const day = String(panel.querySelector('[data-scroll="day"] .active')?.dataset.value || "").padStart(2, "0");
      const value = `${year}-${month}-${day}`;
      updateDtPickerValue(picker, value);
      closeAllDtPanels();
      if (name === "datePicker" || name === "sideDatePicker") {
        state.selectedDate = value;
        syncCalendarToSelected();
        loadView().catch((e) => setToast(e.message));
      }
      return;
    }

    if (btn.dataset.action === "confirmTimePicker") {
      const hour = String(panel.querySelector('[data-scroll="hour"] .active')?.dataset.value || "0").padStart(2, "0");
      const minute = String(panel.querySelector('[data-scroll="minute"] .active')?.dataset.value || "0").padStart(2, "0");
      const value = `${hour}:${minute}`;
      updateDtPickerValue(picker, value);
      closeAllDtPanels();
      return;
    }

    if (btn.dataset.action === "confirmSelectPicker") {
      const value = panel.querySelector('[data-scroll="select"] .active')?.dataset.value || "";
      updateDtPickerValue(picker, value);
      closeAllDtPanels();
      return;
    }
  });
}

function updateDtCalendarModern(panel, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const today = todayISO();
  const activeDay = panel.querySelector(".dt-cal-day.active")?.dataset.day;

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let i = 1; i <= daysInMonth; i += 1) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const grid = panel.querySelector(".dt-calendar-grid");
  if (grid) {
    grid.innerHTML = cells.map((v) => {
      if (!v) return `<span class="dt-cal-empty"></span>`;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(v).padStart(2, "0")}`;
      const isToday = dateStr === today;
      const isActive = String(v) === activeDay;
      return `<button type="button" class="dt-cal-day ${isActive ? "active" : ""} ${isToday ? "today" : ""}" data-day="${v}">${v}</button>`;
    }).join("");
  }
}

function updateDtPickerValue(picker, value) {
  const hidden = picker.querySelector('input[type="hidden"]');
  if (hidden) hidden.value = value;
  const display = picker.querySelector(".dt-picker-value");
  if (display) {
    if (picker.dataset.dtPicker === "date") {
      display.textContent = value ? formatShortDate(value) : "选择日期";
    } else if (picker.dataset.dtPicker === "select") {
      const options = picker.dataset.selectType === "timezone"
        ? TIMEZONE_OPTIONS
        : picker.dataset.selectType === "birth-place"
          ? BIRTH_PLACE_OPTIONS.map((item) => [item, item])
          : [];
      const matched = options.find(([optionValue]) => optionValue === value);
      display.textContent = matched?.[1] || picker.dataset.placeholder || "请选择";
    } else {
      display.textContent = value || "选择时间";
    }
  }
  // 触发原生 change 事件
  if (hidden) hidden.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectPickerPanelHtml(pickerEl) {
  const hidden = pickerEl.querySelector('input[type="hidden"]');
  const current = hidden?.value || "";
  const name = pickerEl.dataset.name;
  const placeholder = pickerEl.dataset.placeholder || "请选择";
  const options = pickerEl.dataset.selectType === "timezone"
    ? TIMEZONE_OPTIONS
    : BIRTH_PLACE_OPTIONS.map((item) => [item, item]);
  const selectedValue = current;

  return `
    <div class="dt-panel-backdrop">
      <div class="dt-panel dt-panel-select" data-dt-panel="select">
        <div class="dt-panel-head">
          <span>${escapeHtml(placeholder)}</span>
          <button type="button" class="icon-btn" data-action="closeSelectPicker">×</button>
        </div>
        <div class="dt-panel-body dt-select-body">
          <div class="dt-select-list" data-scroll="select">
            ${options.map(([optionValue, optionLabel]) => `<button type="button" class="dt-scroll-item dt-select-item ${optionValue === selectedValue ? "active" : ""}" data-value="${escapeHtml(optionValue)}">${escapeHtml(optionLabel)}</button>`).join("")}
          </div>
        </div>
        <div class="dt-panel-foot">
          <button type="button" class="btn" data-action="closeSelectPicker">取消</button>
          <button type="button" class="btn primary" data-action="confirmSelectPicker" data-name="${escapeHtml(name)}">确定</button>
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════ */

async function bootstrap() {
  if (!state.token) {
    renderAuth();
    return;
  }
  try {
    state.user = await request("/auth/me");
    // 已登录用户刷新时也显示过渡动画
    showSplashThenRender();
    await loadView();
    updateSyncStatus();
    startAutoSync();
  } catch {
    localStorage.removeItem("dayorder.token");
    state.token = "";
    state.user = null;
    renderAuth();
  }
}

async function loadBase() {
  const [tags, recordTypes] = await Promise.all([
    request("/tags"),
    request("/record-types?include_disabled=true"),
  ]);
  state.tags = tags;
  state.recordTypes = recordTypes;
}

async function loadAccount() {
  state.profile = await request("/users/me/profile").catch(() => null);
  const storageInfo = await request("/users/me/storages").catch(() => ({ storages: [], active_storage_id: null }));
  state.storages = storageInfo.storages || [];
  state.activeStorageId = storageInfo.active_storage_id || null;
}

async function loadNowStemsBranches() {
  state.nowStemsBranches = await request("/calendar/now-stems-branches").catch(() => null);
}

async function loadView() {
  if (!state.token) return;
  state.loading = true;
  render();
  try {
    if (["today", "calendar", "records", "journals", "nearTasks", "dailyTasks", "countdowns", "tags"].includes(state.view)) {
      await loadBase();
    }
    if (state.view === "today") { await Promise.all([loadDay(), loadWeatherCitiesFromProfile().then(() => fetchAllWeather()), loadNowStemsBranches(), loadTimeStats("day")]); }
    if (state.view === "calendar") await Promise.all([loadMonth(), loadDay(), loadImportantDates()]);
    if (state.view === "records") await loadRecords();
    if (state.view === "journals") await loadJournals();
    if (state.view === "nearTasks") await Promise.all([loadNearTasksPage(), loadDay()]);
    if (state.view === "dailyTasks") await Promise.all([loadDailyTasksPage(), loadDay()]);
    if (state.view === "countdowns") await loadCountdownsPage();
    if (state.view === "tags") await loadBase();
    if (state.view === "account") await loadAccount();
  } finally {
    state.loading = false;
    render();
  }
}

function route(view, date) {
  state.view = view;
  if (date) state.selectedDate = date;
  loadView().catch((error) => setToast(error.message));
}

function workspaceAuthPanel(mode = "login") {
  const desktopAvailable = Boolean(window.dayOrderDesktop);
  const title = mode === "login" ? "选择已有工作区" : "新建工作区";
  const copy = mode === "login"
    ? "账号和数据都保存在当前工作区的本地数据库里，登录前请先打开对应的工作区。"
    : "新用户会在一个全新的工作区里创建账号、个人资料和本地数据库。";
  return `
    <div class="auth-workspace">
      <div>
        <strong>${title}</strong>
        <p>${copy}</p>
        <code data-workspace-path>正在读取当前工作区...</code>
      </div>
      ${desktopAvailable ? `
        <div class="auth-workspace-actions">
          ${mode === "login"
            ? `<button class="btn small full" type="button" data-workspace-action="existing">打开已有工作区</button>`
            : `<button class="btn small full" type="button" data-workspace-action="new">新建工作区</button>`}
        </div>
      ` : ""}
    </div>
  `;
}

async function refreshWorkspaceAuthPanel() {
  if (!window.dayOrderDesktop) {
    document.querySelectorAll("[data-workspace-path]").forEach((el) => {
      el.textContent = "当前浏览器模式使用后端启动时指定的工作区";
    });
    return;
  }
  try {
    const info = await window.dayOrderDesktop.getState();
    const path = info.workspacePath || info.defaultWorkspacePath || "未选择工作区";
    document.querySelectorAll("[data-workspace-path]").forEach((el) => {
      el.textContent = path;
    });
  } catch {
    document.querySelectorAll("[data-workspace-path]").forEach((el) => {
      el.textContent = "无法读取工作区状态";
    });
  }
}

function renderAuth(mode = "login") {
  const savedEmail = localStorage.getItem("dayorder.savedEmail") || "";
  const savedPassword = localStorage.getItem("dayorder.savedPassword") || "";
  app.innerHTML = `
    <main class="auth">
      <section class="auth-box">
        <div class="auth-brand">
          <img class="auth-logo-img" src="/assets/dayorder.png" alt="日序" />
          <h1>日序</h1>
          <p class="auth-tagline">以日为序，知命而行</p>
        </div>
        ${mode === "login" ? loginForm(savedEmail, savedPassword) : registerForm()}
      </section>
      ${toastHtml()}
    </main>
  `;
  bindAuth();
}

function loginForm(savedEmail = "", savedPassword = "") {
  const rememberChecked = savedEmail ? "checked" : "";
  return `
    <form id="loginForm" class="form-grid">
      ${field("邮箱", `<input name="email" autocomplete="email" value="${escapeHtml(savedEmail)}" required />`)}
      ${field("密码", `<input name="password" type="password" autocomplete="current-password" value="${escapeHtml(savedPassword)}" required />`)}
      <label class="check remember-me">
        <input name="remember" type="checkbox" ${rememberChecked} />
        <span>记住密码</span>
      </label>
      <button class="btn primary full" type="submit">登录</button>
    </form>
    <p class="auth-switch">还没有账号？<button class="btn text" data-auth-tab="register">注册新账号</button></p>
  `;
}

function registerForm() {
  return `
    <form id="registerForm" class="form-grid">
      ${field("邮箱", `<input name="email" autocomplete="email" required />`)}
      ${field("密码", `<input name="password" type="password" minlength="8" required />`)}
      ${field("邀请码", `<input name="invitation_code" placeholder="请输入邀请码" required />`)}
      <button class="btn primary full" type="submit">注册</button>
    </form>
    <p class="auth-switch">已有账号？<button class="btn text" data-auth-tab="login">返回登录</button></p>
  `;
}

function bindAuth() {
  app.onclick = handleAuthClick;
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => renderAuth(button.dataset.authTab));
  });
  document.querySelectorAll("[data-workspace-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.dayOrderDesktop) return;
      button.disabled = true;
      try {
        const selected = await window.dayOrderDesktop.chooseWorkspace(button.dataset.workspaceAction);
        if (!selected) button.disabled = false;
      } catch (error) {
        setToast(error.message);
        button.disabled = false;
      }
    });
  });
  document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const rawData = Object.fromEntries(new FormData(form));
    const data = { email: rawData.email, password: rawData.password };
    const remember = rawData.remember === "on";
    try {
      const result = await request("/auth/login", { method: "POST", body: JSON.stringify(data) });
      if (remember) {
        localStorage.setItem("dayorder.savedEmail", data.email);
        localStorage.setItem("dayorder.savedPassword", data.password);
      } else {
        localStorage.removeItem("dayorder.savedEmail");
        localStorage.removeItem("dayorder.savedPassword");
      }
      await enterApp(result);
    } catch (error) {
      setToast(error.message);
    }
  });
  document.getElementById("registerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = cleanPayload(Object.fromEntries(new FormData(event.target)));
    try {
      // 注册只需邮箱+密码+邀请码，身份信息在引导页填写
      const payload = {
        email: data.email,
        password: data.password,
        invitation_code: data.invitation_code,
        nickname: data.email.split("@")[0],  // 临时昵称
        gender: "unspecified",
        birth_date: "2000-01-01",  // 占位，引导页会更新
        birth_time: "12:00",
        birth_timezone: "Asia/Shanghai",
      };
      const result = await request("/auth/register", { method: "POST", body: JSON.stringify(payload) });
      state.token = result.access_token;
      localStorage.setItem("dayorder.token", result.access_token);
      state.user = result.user;
      renderOnboarding();
    } catch (error) {
      setToast(error.message);
    }
  });
}

async function handleAuthClick(event) {
  const target = event.target.closest("button, [data-action]");
  if (!target || !app.contains(target)) return;
  const action = target.dataset.action;
  try {
    if (action === "openDatePicker") openDatePickerPanel(target);
    if (action === "openTimePicker") openTimePickerPanel(target);
    if (action === "openSelectPicker") openSelectPickerPanel(target);
    if (action === "selectRegisterStorage") await selectRegisterStorage(target);
  } catch (error) {
    setToast(error.message);
  }
}

async function selectRegisterStorage(target) {
  const form = target.closest("form");
  const input = form?.querySelector("[data-register-storage-path]");
  if (!input) return;
  target.disabled = true;
  try {
    let selected = "";
    if (window.dayOrderDesktop?.selectRegistrationStorage) {
      selected = await window.dayOrderDesktop.selectRegistrationStorage();
    } else {
      const result = await request("/auth/storage-directory/browse", { method: "POST" });
      selected = result.path || "";
    }
    if (selected) input.value = selected;
  } finally {
    target.disabled = false;
  }
}

/* ── 新用户引导页 ── */

function renderOnboarding() {
  app.innerHTML = `
    <main class="auth">
      <section class="auth-box onboarding-box">
        <h1>完善信息</h1>
        <p>身份信息用于生成八字命理分析，后续可在账户设置中修改。</p>
        <form id="onboardingForm" class="form-grid">
          ${field("昵称", `<input name="nickname" required placeholder="给自己取个名字" />`)}
          ${field("个性签名", `<input name="signature" placeholder="一句话介绍自己" maxlength="200" />`)}
          ${field("性别", `<select name="gender">${option("unspecified", "未指定")} ${option("male", "男")} ${option("female", "女")} ${option("other", "其他")}</select>`)}
          ${field("出生日期", datePickerHtml("birth_date", "", { required: true }))}
          ${field("出生时间", timePickerHtml("birth_time", "", { required: true }))}
          ${field("时区", `<input name="birth_timezone" value="Asia/Shanghai" required />`)}
          ${field("出生地", `<input name="birth_place" placeholder="例如 扬州市" />`)}
          <div class="form-actions" style="margin-top: 10px;">
            <button class="btn primary full" type="submit">进入日序</button>
          </div>
        </form>
        <details class="onboarding-backup">
          <summary>本地备份地址（可选）</summary>
          <p class="onboarding-hint">数据存储在云端，本地仅作备份缓存。默认位置 C:/DayOrderBackup，可自定义。</p>
          <div class="storage-path-row">
            <input name="storage_path" data-register-storage-path placeholder="C:/DayOrderBackup" />
            <button class="btn small storage-browse-btn" type="button" data-action="selectOnboardingStorage">选择文件夹</button>
          </div>
        </details>
        <p class="onboarding-skip">
          <button class="btn text" data-action="skipOnboarding">跳过，以后再说</button>
        </p>
      </section>
      ${toastHtml()}
    </main>
  `;

  document.getElementById("onboardingForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = cleanPayload(Object.fromEntries(new FormData(event.target)));
    try {
      if (!data.birth_date || !data.birth_time) {
        throw new Error("请选择出生日期和出生时间");
      }
      // 更新 profile
      state.profile = await request("/users/me/profile", { method: "PATCH", body: JSON.stringify(data) });
      state.user = await request("/auth/me");
      // 如果设置了备份路径，创建存储
      if (data.storage_path) {
        try {
          await request("/users/me/storages", { method: "POST", body: JSON.stringify({ workspace_path: data.storage_path }) });
        } catch {}
      }
      setToast("欢迎！");
      await loadBase();
      await loadView();
      showSplashThenRender();
    } catch (error) {
      setToast(error.message);
    }
  });

  app.onclick = async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.dataset.action === "skipOnboarding") {
      await loadBase();
      await loadView();
      showSplashThenRender();
    }
    if (target.dataset.action === "openDatePicker") openDatePickerPanel(target);
    if (target.dataset.action === "openTimePicker") openTimePickerPanel(target);
    if (target.dataset.action === "selectOnboardingStorage") await selectRegisterStorage(target);
  };
}

async function enterApp(result) {
  state.token = result.access_token;
  state.user = result.user;
  localStorage.setItem("dayorder.token", state.token);
  // 先显示 splash，后台加载数据
  showSplashThenRender();
  await loadBase();
  await loadView();
}

/* ── 登录过渡动画 ── */

function showSplashThenRender() {
  const nickname = state.user?.profile?.nickname || state.user?.email?.split("@")[0] || "日序";
  const signature = state.user?.profile?.signature || "";
  const bazi = state.user?.profile?.bazi_result_json;
  let baziPhrase = "";
  if (bazi) {
    try {
      const b = typeof bazi === "string" ? JSON.parse(bazi) : bazi;
      const dayStem = b.day_stem || b.pillars?.day?.stem || "";
      const dayBranch = b.day_branch || b.pillars?.day?.branch || "";
      const dayWuXing = b.day_wu_xing || b.five_elements?.[2] || "";
      baziPhrase = `${dayStem}${dayBranch} · ${dayWuXing}`;
    } catch { baziPhrase = ""; }
  }
  // 标记 splash 进行中，阻止 render() 覆盖
  state._splashActive = true;
  app.innerHTML = `
    <div class="splash-screen">
      <div class="splash-content">
        <div class="splash-brand">
          <img class="splash-logo-img" src="/assets/dayorder.png" alt="日序" />
          <h1 class="splash-title">日序</h1>
          <p class="splash-subtitle">以日为序，知命而行</p>
        </div>
        <div class="splash-user">
          <div class="splash-name">${escapeHtml(nickname)}</div>
          ${signature ? `<div class="splash-signature">${escapeHtml(signature)}</div>` : ""}
        </div>
        <div class="splash-bar"><div class="splash-bar-fill"></div></div>
      </div>
      <button class="splash-skip" data-action="skipSplash">跳过</button>
    </div>
  `;
  // 5 秒后自动进入，点击跳过立即进入
  let splashDone = false;
  const finish = () => {
    if (splashDone) return;
    splashDone = true;
    state._splashActive = false;
    render();
  };
  const timer = setTimeout(finish, 5000);
  app.querySelector(".splash-skip")?.addEventListener("click", () => {
    clearTimeout(timer);
    finish();
  });
}

function render() {
  // splash 进行中时不覆盖
  if (state._splashActive) return;
  if (!state.token) {
    renderAuth();
    return;
  }
  const profile = state.profile || state.user?.profile || {};
  const avatarUrl = (typeof CapacitorPlatform !== 'undefined' ? CapacitorPlatform.resolveUrl(profile.avatar_url) : profile.avatar_url) || "";
  const nickname = profile.nickname || state.user?.email || "";
  const signature = profile.signature || "";

  // 番茄钟弹窗 & 日志面板（全局）
  const pomodoroStartModalHtml = (state.pomodoro?.showStartModal)
    ? pomodoroStartModal(state.pomodoro._startTaskType, state.pomodoro._startTaskId, state.pomodoro._startTaskTitle)
    : "";
  const taskLogPanelHtml = (state.pomodoro?.showLogPanel)
    ? `<div class="modal-backdrop" data-action="closeTaskLog">${taskLogPanel(state.pomodoro._logTaskType, state.pomodoro._logTaskId, state.pomodoro._logTaskTitle)}</div>`
    : "";

  app.innerHTML = `
    <div class="app-shell">
      <aside class="side">
        <div class="user-card" data-route="account" title="点击进入账户设置">
          <div class="user-avatar">
            ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="头像" />` : `<span class="avatar-placeholder">${(nickname || "日")[0]}</span>`}
          </div>
          <div class="user-info">
            <strong>${escapeHtml(nickname)}</strong>
            ${signature ? `<p>${escapeHtml(signature)}</p>` : `<p class="no-signature">写一句个性签名吧</p>`}
          </div>
        </div>
        <nav class="nav">
          ${menu.map(([id, label, icon]) => `<button class="${state.view === id ? "active" : ""}" data-route="${id}">${iconSvg(icon)}<span>${label}</span></button>`).join("")}
        </nav>
        <div class="side-footer">
          <div class="side-bottom-row">
            <div class="side-date-picker">
              ${datePickerHtml("sideDatePicker", state.selectedDate)}
            </div>
            <button class="side-sync-btn" id="syncIndicator" data-action="manualSync" title="${escapeHtml(state.syncMessage || '点击同步')}">
              <span class="sync-dot ${state.syncStatus}"></span>
            </button>
          </div>
          <button class="btn danger" data-action="logout">退出登录</button>
        </div>
      </aside>
      <main class="main">${renderView()}</main>
      ${recordTypeModalHtml()}
      ${confirmDialogHtml()}
      ${state.weatherDialog ? weatherCityDialog() : ""}
      ${pomodoroStartModalHtml}
      ${taskLogPanelHtml}
      ${pomodoroFloatHtml()}
      ${state.loading ? `<div class="loading-bar"></div>` : ""}
      ${toastHtml()}
    </div>
  `;
  bindShell();
}

function renderView() {
  if (state.view === "today") return todayView();
  if (state.view === "calendar") return calendarView();
  if (state.view === "records") return recordsView();
  if (state.view === "journals") return journalsView();
  if (state.view === "nearTasks") return nearTasksView();
  if (state.view === "dailyTasks") return dailyTasksView();
  if (state.view === "countdowns") return countdownsView();
  if (state.view === "tags") return journalsView();
  if (state.view === "account") return accountView();
  return todayView();
}

function topbar(title, subtitle, actions = "") {
  return `
    <header class="topbar">
      <div class="title-block"><h2>${title}</h2><p>${subtitle}</p></div>
      <div class="toolbar">${actions}</div>
    </header>
  `;
}

/* ── 各模块的题记映射 ── */
const MODULE_SUBTITLES = {
  today: "记录今日，把握当下",
  calendar: "纵观日月，规划未来",
  records: "点滴微记，汇聚成河",
  journals: "思绪沉淀，文字留痕",
  nearTasks: "循序渐进，功不唐捐",
  dailyTasks: "日复一日，持之以恒",
  countdowns: "心中有期，脚下有路",
  tags: "分类整理，井井有条",
  account: "个人信息与数据管理",
};

function iconSvg(name) {
  const paths = {
    home: '<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5v10h5v-6h3v6h5v-10"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    check: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12.2 2.2 2.2 4.8-5"/>',
    note: '<path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 12h6M9 16h6"/>',
    bell: '<path d="M7 10a5 5 0 0 1 10 0c0 4 2 5 2 5H5s2-1 2-5"/><path d="M10 18a2 2 0 0 0 4 0"/>',
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
    refresh: '<path d="M18 8a7 7 0 1 0 1 5"/><path d="M18 4v4h-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.1 2.1-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65v.11h-3v-.11a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.1-2.1.05-.05a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.65-1.1H5v-3h.07a1.8 1.8 0 0 0 1.65-1.1 1.8 1.8 0 0 0-.36-2l-.05-.05 2.1-2.1.05.05a1.8 1.8 0 0 0 2 .36 1.8 1.8 0 0 0 1.1-1.65V3.5h3v.11a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.05-.05 2.1 2.1-.05.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1H21v3h-.07A1.8 1.8 0 0 0 19.4 15Z"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    timer: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
    log: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  };
  return `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.note}</svg>`;
}

function dateToolbar(extra = "") {
  return `
    ${datePickerHtml("datePicker", state.selectedDate)}
    <button class="btn" data-action="yesterday">昨天</button>
    <button class="btn" data-action="goToday">今天</button>
    <button class="btn" data-action="tomorrow">明天</button>
    ${extra}
  `;
}

function tagForm(item) {
  const selectedColor = presetColor(item?.color, "#2F5D62");
  return `
    <form class="form-grid" data-submit="tag">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      ${field("名称", `<input name="name" value="${escapeHtml(item?.name || "")}" required />`)}
      ${colorPaletteField("颜色", selectedColor)}
      ${field("描述", `<textarea name="description">${escapeHtml(item?.description || "")}</textarea>`)}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存札记标签" : "新增札记标签"}</button>
        ${item ? `<button class="btn" type="button" data-action="cancelEdit" data-edit-key="tag">取消</button>` : ""}
      </div>
    </form>
  `;
}

function tagList(manage = true) {
  if (!state.tags.length) return empty("还没有标签");
  return `<div class="list">${state.tags.map((item) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h4><span class="dot big" style="background:${safeColor(item.color)}"></span>${escapeHtml(item.name)}</h4>
          <p>${escapeHtml(item.description || "无描述")}</p>
        </div>
        ${manage ? `<div class="row-actions">
          <button class="btn small" data-edit="tag" data-id="${item.id}">编辑</button>
          <button class="btn small danger" data-delete="tags" data-id="${item.id}">删除</button>
        </div>` : ""}
      </div>
    </article>
  `).join("")}</div>`;
}

function accountView() {
  const profile = state.profile || state.user?.profile;
  const isEditing = state.accountEditing || false;
  return `
    ${topbar("账户", MODULE_SUBTITLES.account, "")}
    <div class="layout account-layout account-single-column">
      <section>
        <div class="account-card-modern profile-card-modern">
          <div class="profile-header-modern">
            <div class="profile-cover"></div>
            <div class="profile-avatar-wrapper">
              <div class="user-avatar extra-large ${isEditing ? '' : 'no-upload'}" data-action="${isEditing ? 'uploadAvatar' : ''}" title="${isEditing ? '点击上传头像' : ''}">
                ${profile?.avatar_url ? `<img src="${escapeHtml(typeof CapacitorPlatform !== 'undefined' ? CapacitorPlatform.resolveUrl(profile.avatar_url) : profile.avatar_url)}" alt="头像" />` : `<span class="avatar-placeholder">${(profile?.nickname || "日")[0]}</span>`}
                ${isEditing ? `
                <span class="avatar-upload-overlay">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </span>` : ''}
              </div>
              <div class="profile-title-modern">
                <h2>${escapeHtml(profile?.nickname || "新用户")}</h2>
                <p>${escapeHtml(profile?.signature || "尚未设置个性签名")}</p>
              </div>
              ${!isEditing ? `
              <button class="btn primary profile-edit-btn" data-action="editProfile">编辑资料</button>
              ` : ''}
            </div>
          </div>
          <div class="profile-body-modern">
            ${isEditing ? profileEditForm(profile) : profileViewCard(profile)}
          </div>
        </div>
        ${!isEditing ? `
        <div class="account-card-modern mt-20">
          <div class="card-head-modern"><h3>数据管理</h3></div>
          <div class="card-body-modern">
            <div class="account-data-actions">
              <div class="account-data-btns">
                <button class="btn" data-action="openWorkspaceFolder">📂 打开本地备份目录</button>
                <button class="btn" data-action="exportJSON">📄 导出 JSON</button>
                <button class="btn" data-action="exportSQLite">🗄 导出数据库</button>
                <button class="btn" data-action="exportFull">📦 导出完整包</button>
              </div>
            </div>
          </div>
        </div>
        ` : ''}
      </section>
    </div>
  `;
}

/* ── 查看模式：信息卡片 ── */

function profileViewCard(profile = {}) {
  const genderLabel = { male: "男", female: "女", other: "其他", unspecified: "未指定" };
  const birthDisplay = profile?.birth_date
    ? `${profile.birth_date} ${profile.birth_time || ''}`
    : "未设置";
  return `
    <div class="profile-info-grid">
      <div class="profile-info-item">
        <span class="profile-info-label">昵称</span>
        <span class="profile-info-value">${escapeHtml(profile?.nickname || "—")}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">签名</span>
        <span class="profile-info-value">${escapeHtml(profile?.signature || "—")}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">性别</span>
        <span class="profile-info-value">${genderLabel[profile?.gender] || "未指定"}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">出生</span>
        <span class="profile-info-value">${escapeHtml(birthDisplay)}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">时区</span>
        <span class="profile-info-value">${escapeHtml(profile?.birth_timezone || "—")}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">出生地</span>
        <span class="profile-info-value">${escapeHtml(profile?.birth_place || "—")}</span>
      </div>
    </div>
  `;
}

/* ── 编辑模式：表单 ── */

function profileEditForm(profile = {}) {
  if (!profile && !state.user) return empty("当前账户还没有资料");
  return `
    <form class="form-grid" data-submit="profile">
      ${field("昵称", `<input name="nickname" value="${escapeHtml(profile?.nickname || "")}" required />`)}
      ${field("个性签名", `<input name="signature" value="${escapeHtml(profile?.signature || "")}" placeholder="一句话介绍自己" maxlength="200" />`)}
      ${field("性别", `<select name="gender">
        ${option("unspecified", "未指定", profile?.gender)}
        ${option("male", "男", profile?.gender)}
        ${option("female", "女", profile?.gender)}
        ${option("other", "其他", profile?.gender)}
      </select>`)}
      ${field("出生日期", datePickerHtml("birth_date", profile?.birth_date || "", { required: true }))}
      ${field("出生时间", timePickerHtml("birth_time", profile?.birth_time || "", { required: true }))}
      ${field("时区", `<input name="birth_timezone" value="${escapeHtml(profile?.birth_timezone || "Asia/Shanghai")}" placeholder="例如 Asia/Shanghai" />`)}
      ${field("出生地", `<input name="birth_place" value="${escapeHtml(profile?.birth_place || "")}" placeholder="例如 扬州市" />`)}
      <div class="form-actions" style="margin-top: 10px; display: flex; gap: 8px;">
        <button class="btn primary" type="submit">保存资料</button>
        <button class="btn" type="button" data-action="cancelEditProfile">取消</button>
      </div>
    </form>
  `;
}

function metricCard(label, value) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`;
}

function section(title, body, meta = "") {
  return `
    <section class="section">
      <div class="section-head"><h3>${title}</h3></div>
      ${body}
    </section>
  `;
}

function field(label, control) {
  return `<label class="field"><span>${label}</span>${control}</label>`;
}

function colorPaletteField(label, current) {
  const selected = presetColor(current);
  return `
    <div class="field color-field">
      <span>${label}</span>
      <input type="hidden" name="color" value="${selected}" />
      <div class="color-palette">
        ${colorPresets.map(([value, name]) => `
          <button class="color-option ${value === selected ? "active" : ""}" type="button" data-action="pickColor" data-color="${value}" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}" style="--swatch:${value}">
            <span></span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function tagPicker(name, selected = []) {
  const selectedIds = new Set(selected.map((tag) => String(tag.id)));
  if (!state.tags.length) return "";
  return `<div class="field tag-field"><span>标签</span><div class="tag-picker">${state.tags.map((tag) => `
    <label><input type="checkbox" name="${name}" value="${tag.id}" ${selectedIds.has(String(tag.id)) ? "checked" : ""} /> <span style="--tag:${safeColor(tag.color)}">${escapeHtml(tag.name)}</span></label>
  `).join("")}</div></div>`;
}

function tagsHtml(tags = []) {
  if (!tags.length) return "";
  return `<div class="tags">${tags.map((tag) => `<span class="tag" style="background:${softColor(tag.color)}">${escapeHtml(tag.name)}</span>`).join("")}</div>`;
}

function option(value, label, current = "") {
  return `<option value="${escapeHtml(value)}" ${String(current) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function toastHtml() {
  return state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : "";
}

let confirmDialogResolver = null;

function confirmDialogHtml() {
  const dialog = state.confirmDialog;
  if (!dialog) return "";
  return `
    <div class="confirm-backdrop" data-action="confirmCancel">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" data-confirm-panel>
        <div class="confirm-mark ${dialog.tone || "danger"}">${dialog.mark || "!"}</div>
        <div class="confirm-copy">
          <h3 id="confirmTitle">${escapeHtml(dialog.title || "确认操作")}</h3>
          <p>${escapeHtml(dialog.message || "这个操作完成后可能无法撤销。")}</p>
        </div>
        <label class="confirm-skip">
          <input type="checkbox" id="confirmSkip" />
          <span>以后不再提醒此类操作</span>
        </label>
        <div class="confirm-actions">
          <button class="btn" type="button" data-action="confirmCancel">取消</button>
          <button class="btn danger" type="button" data-action="confirmAccept">${escapeHtml(dialog.confirmText || "确认")}</button>
        </div>
      </section>
    </div>
  `;
}

function confirmPreferenceKey(key) {
  return `dayorder.confirm.skip.${key}`;
}

function showConfirmDialog(options = {}) {
  const key = options.key || "default";
  if (localStorage.getItem(confirmPreferenceKey(key)) === "1") return Promise.resolve(true);
  state.confirmDialog = {
    key,
    title: options.title || "确认操作",
    message: options.message || "这个操作完成后可能无法撤销。",
    confirmText: options.confirmText || "确认",
    tone: options.tone || "danger",
    mark: options.mark || "!",
  };
  render();
  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
  });
}

function closeConfirmDialog(confirmed) {
  const dialog = state.confirmDialog;
  if (confirmed && dialog?.key && document.getElementById("confirmSkip")?.checked) {
    localStorage.setItem(confirmPreferenceKey(dialog.key), "1");
  }
  state.confirmDialog = null;
  const resolver = confirmDialogResolver;
  confirmDialogResolver = null;
  render();
  resolver?.(Boolean(confirmed));
}

function updateMarkdownPreview(event) {
  const preview = document.getElementById("markdownPreview");
  if (preview) preview.innerHTML = markdownPreview(event.target.value);
}

function bindJournalAutosave() {
  const form = document.getElementById("journalForm");
  if (!form) return;
  bindJournalLineShadow();
  if (state.journalMode === "read") return;
  form.querySelectorAll("input[name='title'], input[name='tag_names'], textarea[name='markdown_content']").forEach((input) => {
    input.addEventListener("input", () => {
      if (input.name === "markdown_content") updateMarkdownPreview({ target: input });
      updateJournalTagSummaryFromForm();
      scheduleJournalAutosave();
    });
  });
  form.querySelectorAll("input[name='tag_ids']").forEach((input) => {
    input.addEventListener("change", () => {
      updateJournalTagSummaryFromForm();
      scheduleJournalAutosave();
    });
  });
}

function bindJournalLineShadow() {
  const input = document.getElementById("markdownInput");
  const preview = document.getElementById("markdownPreview");
  if (input) {
    ["click", "keyup", "input", "scroll", "focus"].forEach((eventName) => {
      input.addEventListener(eventName, updateMarkdownLineShadow);
    });
    updateMarkdownLineShadow();
  }
  preview?.addEventListener("click", (event) => {
    const target = event.target.closest("p, h1, h2, h3, li, blockquote, pre, .math-block");
    if (!target || !preview.contains(target)) return;
    preview.querySelectorAll(".read-line-active").forEach((item) => item.classList.remove("read-line-active"));
    target.classList.add("read-line-active");
  });
}

function updateMarkdownLineShadow() {
  const input = document.getElementById("markdownInput");
  const canvas = input?.closest(".markdown-canvas");
  const shadow = canvas?.querySelector(".markdown-line-shadow");
  if (!input || !canvas || !shadow) return;
  const style = window.getComputedStyle(input);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.85;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const textBeforeCaret = input.value.slice(0, input.selectionStart || 0);
  const lineIndex = textBeforeCaret.split(/\n/).length - 1;
  const top = input.offsetTop + paddingTop + lineIndex * lineHeight - input.scrollTop;
  const visibleTop = input.offsetTop + paddingTop;
  const visibleBottom = input.offsetTop + input.clientHeight - paddingTop;
  const visible = top >= visibleTop - lineHeight && top <= visibleBottom;
  shadow.style.setProperty("--line-shadow-top", `${top}px`);
  shadow.style.setProperty("--line-shadow-left", `${input.offsetLeft + paddingLeft - 10}px`);
  shadow.style.setProperty("--line-shadow-width", `${input.clientWidth - paddingLeft - paddingRight + 20}px`);
  shadow.style.setProperty("--line-shadow-height", `${lineHeight}px`);
  shadow.classList.toggle("visible", visible && state.journalMode === "edit");
}

function updateJournalTagSummaryFromForm() {
  const form = document.getElementById("journalForm");
  const summary = form?.querySelector(".journal-tag-menu summary");
  if (!form || !summary) return;
  const checkedNames = [...form.querySelectorAll("input[name='tag_ids']:checked")].map((input) => {
    return input.closest(".journal-tag-option")?.querySelector(".tag-option-name")?.textContent.trim() || "";
  }).filter(Boolean);
  const newNames = parseTagNames(form.querySelector("input[name='tag_names']")?.value || "");
  const names = [...new Set([...checkedNames, ...newNames])];
  const text = summary.querySelector(".tag-summary-text");
  const count = summary.querySelector(".tag-summary-count");
  if (text) text.textContent = names.length ? (names.length <= 2 ? names.join("、") : `${names.length} 个标签`) : "标签";
  if (count) count.textContent = names.length ? String(names.length) : "";
  else if (names.length) summary.insertAdjacentHTML("beforeend", `<span class="tag-summary-count">${names.length}</span>`);
}

function setJournalAutosaveStatus(text, tone = "") {
  state.journalAutosaveStatus = text;
  const el = document.getElementById("journalAutosaveStatus");
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

function scheduleJournalAutosave() {
  window.clearTimeout(scheduleJournalAutosave.timer);
  setJournalAutosaveStatus("正在编辑", "pending");
  scheduleJournalAutosave.timer = window.setTimeout(runJournalAutosave, 850);
}

async function runJournalAutosave() {
  const form = document.getElementById("journalForm");
  if (!form) return;
  if (state.journalMode === "read") return;
  const data = formData(form);
  const hasContent = [data.title, data.markdown_content, data.tag_names].some((value) => String(value || "").trim()) || collectTagIds(data).length > 0;
  if (!data.id && !hasContent) {
    setJournalAutosaveStatus("开始输入后自动保存", "idle");
    return;
  }
  try {
    setJournalAutosaveStatus("保存中", "pending");
    const saved = await saveJournal(data, { silent: true });
    const idInput = form.querySelector("input[name='id']");
    if (idInput) idInput.value = saved.id;
    const entryDateInput = form.querySelector("input[name='entry_date']");
    if (entryDateInput) entryDateInput.value = saved.entry_date || state.selectedDate;
    const timeMeta = form.querySelector(".journal-corner-meta .journal-time-meta");
    if (timeMeta) {
      timeMeta.textContent = `创建 ${formatDateTimeText(saved.created_at)} · 最后编辑 ${formatDateTimeText(saved.updated_at)}`;
    }
    const tagSummary = form.querySelector(".tag-summary-text");
    if (tagSummary) tagSummary.textContent = journalTagSummary(saved);
    const tagCount = form.querySelector(".tag-summary-count");
    if (tagCount) tagCount.textContent = String((saved.tags || []).length || "");
    const newTagInput = form.querySelector("input[name='tag_names']");
    if (newTagInput) newTagInput.value = "";
    setJournalAutosaveStatus(`已保存 ${formatDateTimeText(saved.updated_at || new Date().toISOString())}`, "saved");
  } catch (error) {
    setJournalAutosaveStatus("保存失败", "error");
    setToast(error.message);
  }
}

function setJournalMode(mode, options = {}) {
  const input = document.getElementById("markdownInput");
  const preview = document.getElementById("markdownPreview");
  const canvas = input?.closest(".markdown-canvas");
  if (!input || !preview || !canvas) return;
  const nextMode = mode === "read" ? "read" : "edit";
  const previousMode = state.journalMode;
  if (previousMode === "read" && nextMode === "edit") {
    state.journalMode = "edit";
    render();
    const nextInput = document.getElementById("markdownInput");
    if (nextInput && options.focus !== false) {
      nextInput.focus();
      nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      updateMarkdownLineShadow();
    }
    return;
  }
  state.journalMode = nextMode;
  preview.innerHTML = markdownPreview(input.value);
  canvas.classList.toggle("is-read", state.journalMode === "read");
  canvas.classList.toggle("is-edit", state.journalMode === "edit");
  const title = document.querySelector(".journal-title-inline");
  if (title) title.toggleAttribute("readonly", state.journalMode === "read");
  document.querySelectorAll("[data-action='journalMode']").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.journalMode);
  });
  if (state.journalMode === "edit" && options.focus !== false) {
    input.focus();
    const position = input.value.length;
    input.setSelectionRange(position, position);
    if (options.insertText) {
      input.setRangeText(options.insertText, position, position, "end");
      preview.innerHTML = markdownPreview(input.value);
    }
    updateMarkdownLineShadow();
  }
}

function syncMarkdownFromPreview(options = {}) {
  const input = document.getElementById("markdownInput");
  const preview = document.getElementById("markdownPreview");
  if (!input || !preview) return;
  input.value = markdownFromEditable(preview);
  if (options.rerender) preview.innerHTML = markdownPreview(input.value);
}

function scheduleEditableMarkdownRender() {
  const preview = document.getElementById("markdownPreview");
  const input = document.getElementById("markdownInput");
  if (!preview || !input || state.journalMode !== "read") return;
  window.clearTimeout(scheduleEditableMarkdownRender.timer);
  scheduleEditableMarkdownRender.timer = window.setTimeout(() => {
    const caret = getEditableCaretOffset(preview);
    input.value = markdownFromEditable(preview);
    preview.innerHTML = markdownPreview(input.value);
    setEditableCaretOffset(preview, caret);
  }, 420);
}

function getEditableCaretOffset(root) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return root.innerText.length;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return root.innerText.length;
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

function setEditableCaretOffset(root, offset) {
  root.focus();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  while (node) {
    if (remaining <= node.textContent.length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= node.textContent.length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function markdownFromEditable(root) {
  if (root.querySelector(".preview-placeholder")) return "";
  const blocks = Array.from(root.childNodes)
    .map(editableBlockToMarkdown)
    .filter((block, index, all) => block || index < all.length - 1);
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function prepareEditablePreview() {
  const preview = document.getElementById("markdownPreview");
  if (preview?.querySelector(".preview-placeholder")) {
    preview.innerHTML = "<p><br></p>";
  }
}

function editableBlockToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim();
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (node.dataset.mathSource && node.classList.contains("math-block")) {
    return `$$\n${node.dataset.mathSource}\n$$`;
  }
  if (/^h[1-6]$/.test(tag)) {
    return `${"#".repeat(Number(tag[1]))} ${editableInlineToMarkdown(node)}`.trim();
  }
  if (tag === "ul" || tag === "ol") {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => `- ${editableInlineToMarkdown(child).replace(/\n+/g, " ").trim()}`)
      .join("\n");
  }
  if (tag === "br") return "";
  return editableInlineToMarkdown(node).trim();
}

function editableInlineToMarkdown(node) {
  return Array.from(node.childNodes).map((child) => {
    if (child.nodeType === Node.TEXT_NODE) return child.textContent.replace(/\u00a0/g, " ");
    if (child.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = child.tagName.toLowerCase();
    if (child.dataset.mathSource) {
      return child.classList.contains("math-block")
        ? `$$\n${child.dataset.mathSource}\n$$`
        : `$${child.dataset.mathSource}$`;
    }
    const text = editableInlineToMarkdown(child);
    if (tag === "strong" || tag === "b") return text ? `**${text}**` : "";
    if (tag === "em" || tag === "i") return text ? `*${text}*` : "";
    if (tag === "code") return text ? `\`${text}\`` : "";
    if (tag === "br") return "\n";
    if (tag === "div" || tag === "p") return `${text}\n`;
    return text;
  }).join("");
}

function markdownPreview(markdown = "") {
  const lines = String(markdown || "").split(/\r?\n/);
  let html = "";
  let inList = false;
  let mathBlock = null;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  lines.forEach((line) => {
    const text = line.trim();
    if (mathBlock) {
      if (text === "$$" || text === "\\]") {
        closeList();
        html += renderMath(mathBlock.join("\n"), true);
        mathBlock = null;
      } else {
        mathBlock.push(line);
      }
      return;
    }
    if (text === "$$") {
      closeList();
      mathBlock = [];
      return;
    }
    if (text === "\\[") {
      closeList();
      mathBlock = [];
      return;
    }
    const oneLineMath = text.match(/^\$\$\s*(.+?)\s*\$\$$/);
    if (oneLineMath) {
      closeList();
      html += renderMath(oneLineMath[1], true);
      return;
    }
    const oneLineBracketMath = text.match(/^\\\[\s*(.+?)\s*\\\]$/);
    if (oneLineBracketMath) {
      closeList();
      html += renderMath(oneLineBracketMath[1], true);
      return;
    }
    if (!text) {
      closeList();
      html += "<p><br></p>";
      return;
    }
    const heading = text.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      html += `<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`;
      return;
    }
    const item = text.match(/^[-*]\s+(.+)$/);
    if (item) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMarkdown(item[1])}</li>`;
      return;
    }
    closeList();
    html += `<p>${inlineMarkdown(text)}</p>`;
  });
  if (mathBlock) {
    closeList();
    html += renderMath(mathBlock.join("\n"), true);
  }
  closeList();
  return html || '<p class="preview-placeholder">Markdown 预览会显示在这里</p>';
}

function inlineMarkdown(value) {
  return renderInlineMath(escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>"));
}

function renderInlineMath(html) {
  return html
    .replace(/\\\((.+?)\\\)/g, (_, expression) => renderMath(unescapeHtml(expression), false))
    .replace(/\$(?!\$)([^$]+?)\$/g, (_, expression) => renderMath(unescapeHtml(expression), false));
}

function renderMath(source, display = false) {
  const mathSource = String(source || "").trim();
  const rendered = renderMathExpression(mathSource);
  const sourceAttr = escapeHtml(mathSource);
  return display
    ? `<div class="math-block" data-math-source="${sourceAttr}" contenteditable="false">${rendered}</div>`
    : `<span class="math-inline" data-math-source="${sourceAttr}" contenteditable="false">${rendered}</span>`;
}

function renderMathExpression(source) {
  let result = escapeHtml(String(source || "").trim());
  result = result.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, top, bottom) => (
    `<span class="math-frac"><span>${renderMathExpression(top)}</span><span>${renderMathExpression(bottom)}</span></span>`
  ));
  result = result.replace(/\\sqrt\{([^{}]+)\}/g, (_, value) => `<span class="math-sqrt">${renderMathExpression(value)}</span>`);
  result = result.replace(/([A-Za-z0-9)\]}α-ωΑ-Ω]+)\^\{([^{}]+)\}/g, '$1<sup>$2</sup>');
  result = result.replace(/([A-Za-z0-9)\]}α-ωΑ-Ω]+)_\{([^{}]+)\}/g, '$1<sub>$2</sub>');
  result = result.replace(/([A-Za-z0-9)\]}α-ωΑ-Ω]+)\^([A-Za-z0-9+\-=]+)/g, '$1<sup>$2</sup>');
  result = result.replace(/([A-Za-z0-9)\]}α-ωΑ-Ω]+)_([A-Za-z0-9+\-=]+)/g, '$1<sub>$2</sub>');
  const replacements = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ",
    pi: "π", rho: "ρ", sigma: "σ", phi: "φ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ",
    Lambda: "Λ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Omega: "Ω", times: "×", cdot: "·", leq: "≤",
    geq: "≥", neq: "≠", approx: "≈", infty: "∞", pm: "±", to: "→", leftarrow: "←", rightarrow: "→",
    sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln",
  };
  result = result.replace(/\\([A-Za-z]+)/g, (_, key) => replacements[key] || key);
  return result;
}

function unescapeHtml(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&");
}

function collectTagIds(data) {
  const raw = data.tag_ids;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((item) => Number(item));
}

function collectRangeSteps(form) {
  if (!form) return [];
  return [...form.querySelectorAll(".range-step-row")].map((row) => {
    const title = row.querySelector("[name='step_title']")?.value.trim() || "";
    return {
      id: row.querySelector("[name='step_id']")?.value || `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      completed: row.querySelector("[name='step_completed']")?.value === "1",
    };
  }).filter((step) => step.title);
}

function collectRecordData(form) {
  const result = {};
  form.querySelectorAll("[name^='data.']").forEach((input) => {
    const key = input.name.slice(5);
    if (input.type === "checkbox") {
      result[key] = input.checked;
    } else if (input.type === "number" && input.value !== "") {
      result[key] = Number(input.value);
    } else {
      result[key] = input.value;
    }
  });
  return result;
}

function collectRecordData(form) {
  const result = {};
  form.querySelectorAll("[name^='data.']").forEach((input) => {
    const key = input.name.slice(5);
    if (input.type === "checkbox") {
      result[key] = input.checked;
    } else if (input.type === "number" && input.value !== "") {
      result[key] = Number(input.value);
    } else {
      result[key] = input.value;
    }
  });
  return result;
}

function editMapKey(kind) {
  return {
    tag: "tags",
    recordType: "recordTypes",
    record: "records",
    journal: "journals",
    dailyTemplate: "dailyTemplates",
    rangeCategory: "rangeCategories",
    rangeReminder: "rangeReminders",
    milestoneDay: "milestoneDays",
  }[kind];
}

function bindShell() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => route(button.dataset.route));
  });
  // 日期选择器事件已通过 dt-picker 的 confirmDatePicker 处理
  document.getElementById("recordTypeSelect")?.addEventListener("change", (event) => {
    state.recordFormTypeId = event.target.value;
    render();
  });
  document.getElementById("importantDateFrequency")?.addEventListener("change", (event) => {
    state.importantDateFrequency = event.target.value || "yearly";
    render();
  });
  document.getElementById("journalSearch")?.addEventListener("input", (event) => {
    state.journalSearch = event.target.value;
    render();
  });
  bindJournalAutosave();
  document.querySelectorAll("form[data-submit]").forEach((form) => {
    form.addEventListener("submit", handleSubmit);
  });
  document.querySelectorAll("[data-custom-icon]").forEach((input) => {
    input.addEventListener("input", () => {
      const picker = input.closest(".field")?.querySelector(".icon-picker");
      const hidden = picker?.querySelector("input[name='icon']");
      if (hidden) hidden.value = input.value;
      picker?.querySelectorAll(".icon-option").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.icon === input.value);
      });
    });
  });
  app.onclick = handleClick;
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const type = form.dataset.submit;
  const data = formData(form);
  try {
    if (type === "tag") await saveTag(data);
    if (type === "recordType") {
      await saveRecordType(form, data);
      await loadBase();
      refreshRecordTypeModal();
      return;
    }
    if (type === "record") await saveRecord(form, data);
    if (type === "journal") await saveJournal(data);
    if (type === "dailyTemplate") await saveDailyTemplate(form, data);
    if (type === "rangeCategory") await saveRangeCategory(data);
    if (type === "rangeReminder") await saveRangeReminder(data);
    if (type === "milestoneDay") await saveMilestone(data);
    if (type === "profile") await saveProfile(data);
    if (type === "weatherCity") {
      addWeatherCity(data.city);
      state.weatherDialog = false;
    }
    await loadView();
  } catch (error) {
    setToast(error.message);
  }
}

async function handleClick(event) {
  const modalPanel = document.querySelector("[data-modal-panel]");
  const confirmPanel = document.querySelector("[data-confirm-panel]");
  const taskLogPanel = document.querySelector(".task-log-panel");
  const selector = "button, [data-action], [data-date], [data-edit], [data-toggle-task], [data-toggle-range]";
  let target = event.target.closest(selector);

  // 日志面板内的点击不触发 backdrop 关闭
  if (taskLogPanel?.contains(event.target)) {
    if (target?.dataset.action === "closeTaskLog" && target === event.target) {
      // 只有直接点击 backdrop 才关闭
    } else if (target?.dataset.action === "closeTaskLog") {
      return; // 阻止冒泡导致的关闭
    }
  }

  if (confirmPanel?.contains(event.target) && target && !confirmPanel.contains(target)) {
    return;
  }
  if (modalPanel?.contains(event.target)) {
    event.stopPropagation();
    if (!target || !modalPanel.contains(target)) return;
  } else if (modalPanel && target?.dataset.action === "closeRecordTypeModal" && target !== event.target) {
    return;
  }
  if (!target) return;
  try {
    if (target.dataset.route) return;
    if (target.dataset.date) {
      state.selectedDate = target.dataset.date;
      await loadDay();
      render();
      return;
    }
    if (target.dataset.action) await handleAction(target);

    // toggle 优先于 edit，避免点击 checkbox 时同时触发编辑
    if (target.dataset.toggleTask) { await toggleTask(target); return; }
    if (target.dataset.toggleRange) { await toggleRangeTask(target); return; }

    if (target.dataset.edit) {
      if (target.dataset.edit === "recordType") {
        const id = Number(target.dataset.id);
        if (state.edit.recordType !== id) {
          state.edit.recordType = id;
          state.recordTypeModal = true;
          refreshRecordTypeModal();
        }
        return;
      }
      state.edit[target.dataset.edit] = Number(target.dataset.id);
      if (["dailyTemplate", "rangeCategory", "rangeReminder", "milestoneDay"].includes(target.dataset.edit)) {
        state.reminderEditor = target.dataset.edit;
      }
      if (target.dataset.edit === "journal") {
        state.journalMode = state.journalMode === "edit" ? "edit" : "read";
        state.journalAutosaveStatus = "已保存";
        render();
      }
      render();
    }
    if (target.dataset.delete) await deleteItem(target.dataset.delete, target.dataset.id);
  } catch (error) {
    setToast(error.message);
  }
}

async function handleAction(target) {
  const action = target.dataset.action;
  if (action === "refresh") await loadView();
  if (action === "openRecordTypeModal") {
    state.recordTypeModal = true;
    render();
  }
  if (action === "closeRecordTypeModal") {
    state.recordTypeModal = false;
    render();
  }
  if (action === "newRecordType") {
    state.edit.recordType = null;
    state.recordTypeModal = true;
    refreshRecordTypeModal();
  }
  if (action === "addRecordField") {
    addRecordFieldRow();
  }
  if (action === "removeRecordField") {
    removeRecordFieldRow(target);
  }
  if (action === "openDatePicker") {
    openDatePickerPanel(target);
  }
  if (action === "openTimePicker") {
    openTimePickerPanel(target);
  }
  if (action === "openSelectPicker") {
    openSelectPickerPanel(target);
  }
  if (action === "addRangeStep") {
    addRangeStepRow();
  }
  if (action === "removeRangeStep") {
    removeRangeStepRow(target);
  }
  if (action === "toggleStepCheck") {
    toggleStepCheck(target);
  }
  if (action === "selectRecordType") {
    state.recordFormTypeId = target.dataset.typeId;
    state.edit.record = null;
    render();
  }
  if (action === "clearRecordComposer") {
    state.recordFormTypeId = "";
    state.edit.record = null;
    render();
  }
  if (action === "logout") {
    await request("/auth/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem("dayorder.token");
    state.token = "";
    state.user = null;
    renderAuth();
  }
  if (action === "openWorkspaceFolder") {
    try { await openFolder("workspace"); } catch { setToast("无法打开本地备份目录"); }
  }
  if (action === "exportJSON") {
    try {
      const result = await exportData("json");
      setToast(`已导出: ${result.name}`);
    } catch { setToast("导出失败"); }
  }
  if (action === "exportSQLite") {
    try {
      const result = await exportData("sqlite");
      setToast(`已导出: ${result.name}`);
    } catch { setToast("导出失败"); }
  }
  if (action === "exportFull") {
    try {
      const result = await exportData("full");
      setToast(`已导出: ${result.name}`);
    } catch { setToast("导出失败"); }
  }

  /* ── 番茄钟 & 任务日志 ── */
  if (action === "openPomodoroModal") {
    initPomodoroState();
    state.pomodoro.showStartModal = true;
    state.pomodoro._startTaskType = target.dataset.taskType;
    state.pomodoro._startTaskId = parseInt(target.dataset.taskId);
    state.pomodoro._startTaskTitle = target.dataset.taskTitle;
    state.pomodoro.plannedMinutes = 25;
    state.pomodoro.timerMode = "countdown";
    render();
  }
  if (action === "closePomodoroModal") {
    state.pomodoro.showStartModal = false;
    render();
  }
  if (action === "setPomodoroMinutes") {
    state.pomodoro.plannedMinutes = parseInt(target.dataset.minutes);
    const input = document.getElementById("pomodoroCustomMinutes");
    if (input) input.value = target.dataset.minutes;
    render();
  }
  if (action === "setPomodoroMode") {
    state.pomodoro.timerMode = target.dataset.mode;
    render();
  }
  if (action === "startPomodoro") {
    await startPomodoro(
      target.dataset.taskType,
      parseInt(target.dataset.taskId),
      target.dataset.taskTitle || "专注"
    );
  }
  if (action === "pausePomodoro") { pausePomodoro(); }
  if (action === "resumePomodoro") { resumePomodoro(); }
  if (action === "stopPomodoro") { await stopPomodoro(); }
  if (action === "openTaskLog") {
    initPomodoroState();
    state.pomodoro.showLogPanel = true;
    state.pomodoro._logTaskType = target.dataset.taskType;
    state.pomodoro._logTaskId = parseInt(target.dataset.taskId);
    state.pomodoro._logTaskTitle = target.dataset.taskTitle;
    await loadTaskLogs(target.dataset.taskType, parseInt(target.dataset.taskId));
    render();
  }
  if (action === "closeTaskLog") {
    state.pomodoro.showLogPanel = false;
    render();
  }
  if (action === "switchTaskLogTab") {
    state.pomodoro.logTab = target.dataset.tab;
    render();
  }
  if (action === "addWorkLog") {
    await addWorkLog(target.dataset.taskType, parseInt(target.dataset.taskId));
  }
  if (action === "deleteWorkLog") {
    await deleteWorkLog(parseInt(target.dataset.id));
  }
  if (action === "deleteTimerSession") {
    await deleteTimerSession(parseInt(target.dataset.id));
  }
  if (action === "switchTimeStats") {
    state.timeStatsOffset = state.selectedDate;
    await loadTimeStats(target.dataset.period, state.selectedDate);
    render();
  }
  if (action === "prevTimeStats") {
    shiftTimeStats(-1);
  }
  if (action === "nextTimeStats") {
    shiftTimeStats(1);
  }
  if (action === "toggleStatsCollapse") {
    toggleStatsCollapse(target.dataset.key);
  }
  if (action === "manualSync") {
    await manualSync();
  }

  if (action === "confirmAccept") {
    closeConfirmDialog(true);
    return;
  }
  if (action === "confirmCancel") {
    closeConfirmDialog(false);
    return;
  }
  if (action === "goToday") {
    state.selectedDate = todayISO();
    syncCalendarToSelected();
    await loadView();
  }
  if (action === "yesterday" || action === "tomorrow") {
    shiftSelectedDate(action === "yesterday" ? -1 : 1);
    await loadView();
  }
  if (action === "prevMonth" || action === "nextMonth") {
    changeMonth(action === "prevMonth" ? -1 : 1);
    await loadView();
  }
  if (action === "thisMonth") {
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth() + 1;
    state.selectedDate = todayISO();
    await loadView();
  }
  if (action === "openImportantDateSettings") {
    state.reminderEditor = "importantDate";
    state.edit.milestoneDay = null;
    state.importantDateFrequency = "yearly";
    render();
  }
  if (action === "newImportantDate") {
    state.edit.milestoneDay = null;
    state.importantDateFrequency = target.dataset.frequency || "yearly";
    state.reminderEditor = "importantDate";
    render();
  }
  if (action === "editImportantDate") {
    const id = Number(target.dataset.id);
    const item = state.importantDates.find((dateItem) => dateItem.id === id);
    state.edit.milestoneDay = id;
    state.importantDateFrequency = item?.date_type || "yearly";
    state.reminderEditor = "importantDate";
    render();
  }
  if (action === "cancelEdit") {
    state.edit[target.dataset.editKey] = null;
    if (["dailyTemplate", "rangeReminder", "rangeCategory"].includes(target.dataset.editKey)) {
      state.reminderEditor = null;
    }
    render();
  }
  if (action === "closeTaskEditor") {
    const closingEditor = state.reminderEditor;
    state.reminderEditor = null;
    state.edit.dailyTemplate = null;
    state.edit.rangeReminder = null;
    state.edit.rangeCategory = null;
    state.edit.milestoneDay = null;
    if (closingEditor === "importantDate") state.importantDateFrequency = "yearly";
    render();
  }
  if (action === "newDailyTemplate") {
    state.reminderEditor = "dailyTemplate";
    state.edit.dailyTemplate = null;
    render();
  }
  if (action === "newRangeReminder") {
    state.reminderEditor = "rangeReminder";
    state.edit.rangeReminder = null;
    render();
  }
  if (action === "newRangeCategory") {
    state.reminderEditor = "rangeCategory";
    state.edit.rangeCategory = null;
    render();
  }
  if (action === "manageRangeCategories") {
    state.reminderEditor = "rangeCategory";
    state.edit.rangeCategory = null;
    render();
  }
  if (action === "openDailyTemplateManager") {
    state.reminderEditor = "dailyTemplate";
    state.edit.dailyTemplate = null;
    render();
  }
  if (action === "manageRangeCategories") {
    state.reminderEditor = "rangeCategoryManager";
    state.edit.rangeCategory = null;
    state.edit.rangeReminder = null;
    render();
  }
  if (action === "selectRangeCategory") {
    state.selectedRangeCategory = target.dataset.categoryId || "today";
    state.reminderEditor = null;
    state.edit.rangeReminder = null;
    render();
  }
  if (action === "newMilestoneDay") {
    state.reminderEditor = "milestoneDay";
    state.edit.milestoneDay = null;
    render();
  }
  if (action === "newJournal") {
    // 立即创建一条空札记
    try {
      const saved = await request("/journals", {
        method: "POST",
        body: JSON.stringify({
          entry_date: state.selectedDate,
          title: "未命名",
          summary: "",
          markdown_content: "",
          change_summary: "创建札记",
          tag_ids: [],
        }),
      });
      state.edit.journal = saved.id;
      state.journals.unshift(saved);
      state.journalMode = "edit";
      state.journalAutosaveStatus = "已保存";
      render();
    } catch (error) {
      setToast(error.message);
    }
  }
  if (action === "journalMode") {
    setJournalMode(target.dataset.mode || "edit");
  }
  if (action === "filterJournalTag") {
    state.journalTagFilter = target.dataset.tagId || "";
    render();
  }
  if (action === "recalculateBazi") {
    state.profile = await request("/users/me/recalculate-bazi", { method: "POST" });
    setToast("八字已重新计算");
  }
  if (action === "uploadAvatar") {
    await uploadAvatar();
  }
  if (action === "openAvatarUpload") {
    await uploadAvatar();
  }
  if (action === "editProfile") {
    state.accountEditing = true;
    render();
  }
  if (action === "cancelEditProfile") {
    state.accountEditing = false;
    render();
  }
  if (action === "toggleCompleted") {
    const section = target.closest(".completed-section");
    if (section) {
      section.classList.toggle("is-collapsed");
      const chevron = section.querySelector(".completed-chevron");
      if (chevron) chevron.textContent = section.classList.contains("is-collapsed") ? "▸" : "▾";
    }
  }
  if (action === "pickIcon") {
    const picker = target.closest(".icon-picker");
    if (picker) {
      picker.querySelectorAll(".icon-option").forEach((btn) => btn.classList.remove("active"));
      target.classList.add("active");
      const hidden = picker.querySelector("input[name='icon']");
      if (hidden) hidden.value = target.dataset.icon;
      const customInput = picker.closest(".field")?.querySelector("[data-custom-icon]");
      if (customInput) customInput.value = target.dataset.icon;
    }
  }
  if (action === "pickColor") {
    const fieldRoot = target.closest(".color-field");
    const form = target.closest("form");
    const color = presetColor(target.dataset.color);
    fieldRoot?.querySelectorAll(".color-option").forEach((btn) => btn.classList.toggle("active", btn === target));
    const input = fieldRoot?.querySelector("input[name='color']");
    if (input) input.value = color;
    const preview = form?.querySelector(".record-type-preview");
    if (preview) preview.style.setProperty("--type-color", color);
  }
  if (action === "openMilestoneDetail") {
    const id = Number(target.dataset.id);
    state.edit.milestoneDay = id;
    state.reminderEditor = "milestoneDetail";
    render();
  }
  if (action === "closeMilestoneDetail") {
    state.reminderEditor = null;
    state.edit.milestoneDay = null;
    render();
  }
  if (action === "editMilestoneFromDetail") {
    state.reminderEditor = "milestoneDay";
    render();
  }
  if (action === "setMilestoneBg") {
    const id = Number(target.dataset.id);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const headers = {};
        if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
        const response = await fetch(`${API}/milestone-days/${id}/background`, { method: "POST", body: formData, headers });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(err.detail || "上传失败");
        }
        await loadCountdownsPage();
        render();
        setToast("背景已更新");
      } catch (error) {
        setToast(error.message);
      }
    };
    input.click();
  }
  if (action === "clearMilestoneBg") {
    const id = Number(target.dataset.id);
    try {
      const confirmed = await showConfirmDialog({
        key: "delete.milestoneBackground",
        title: "删除倒数日背景",
        message: "背景图片会从当前存储中移除。",
        confirmText: "删除",
        tone: "danger",
      });
      if (!confirmed) return;
      await request(`/milestone-days/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ background_url: null }),
      });
      await loadCountdownsPage();
      render();
      setToast("背景已删除");
    } catch (error) {
      setToast(error.message);
    }
  }
  if (action === "manageWeatherCities") {
    state.weatherDialog = true;
    render();
  }
  if (action === "closeWeatherDialog") {
    state.weatherDialog = false;
    render();
  }
  if (action === "quickAddCity") {
    addWeatherCity(target.dataset.city);
    state.weatherDialog = false;
    render();
  }
  if (action === "removeWeatherCity") {
    removeWeatherCity(target.dataset.city);
    render();
  }
}

async function uploadAvatar() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/gif,image/webp";
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers = {};
      if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
      const response = await fetch(`${API}/users/me/avatar`, { method: "POST", body: formData, headers });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(err.detail || "上传失败");
      }
      state.profile = await response.json();
      state.user = await request("/auth/me");
      render();
      setToast("头像已更新");
    } catch (error) {
      setToast(error.message);
    }
  }, { once: true });
  input.click();
}

async function saveTag(data) {
  const payload = cleanPayload({ name: data.name, color: data.color, description: data.description });
  if (data.id) {
    await request(`/tags/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    trackChange("tags", data.id, "update");
  } else {
    const saved = await request("/tags", { method: "POST", body: JSON.stringify(payload) });
    trackChange("tags", saved.id, "create");
  }
  state.edit.tag = null;
}

async function saveProfile(data) {
  state.profile = await request("/users/me/profile", { method: "PATCH", body: JSON.stringify(cleanPayload(data)) });
  state.user = await request("/auth/me");
  state.accountEditing = false;
  setToast("资料已保存");
}

async function switchStorage(id) {
  const result = await request("/users/me/storages/active", { method: "PATCH", body: JSON.stringify({ storage_id: id }) });
  state.storages = result.storages || [];
  state.activeStorageId = result.active_storage_id || null;
  resetContentState();
  await loadView();
  setToast("已切换存储位置");
}

function resetContentState() {
  state.tags = [];
  state.recordTypes = [];
  state.records = [];
  state.journals = [];
  state.journalVersions = [];
  state.dailyTemplates = [];
  state.rangeCategories = [];
  state.rangeReminders = [];
  state.milestoneDays = [];
  state.importantDates = [];
  state.dayDetail = null;
  state.monthData = null;
  Object.keys(state.edit).forEach((key) => {
    state.edit[key] = null;
  });
  state.recordFormTypeId = "";
  state.reminderEditor = null;
}

async function deleteItem(path, id) {
  const confirmed = await showConfirmDialog(deleteConfirmOptions(path));
  if (!confirmed) return;
  await request(`/${path}/${id}`, { method: "DELETE" });
  
  // 变更追踪
  const tableMap = {
    "tags": "tags",
    "record-types": "record_types",
    "records": "records",
    "journals": "journal_entries",
    "daily-task-templates": "daily_task_templates",
    "range-task-categories": "range_task_categories",
    "range-reminders": "range_reminders",
    "milestone-days": "milestone_days",
  };
  if (tableMap[path]) trackChange(tableMap[path], id, "delete");
  
  if (path === "tags" && state.journalTagFilter === String(id)) state.journalTagFilter = "";
  if (path === "range-task-categories" && state.selectedRangeCategory === String(id)) state.selectedRangeCategory = "today";
  if (["daily-task-templates", "range-reminders", "range-task-categories", "milestone-days"].includes(path)) state.reminderEditor = null;
  Object.keys(state.edit).forEach((key) => {
    if (state.edit[key] === Number(id)) state.edit[key] = null;
  });
  await loadView();
}

function deleteConfirmOptions(path) {
  const labels = {
    tags: ["删除标签", "删除后，这个标签会从相关内容中移除。"],
    "record-types": ["删除微记类型", "相关微记类型将不再可用，请确认是否继续。"],
    records: ["删除微记", "这条微记会从当前存储中删除。"],
    journals: ["删除札记", "这篇札记会从当前存储中删除。"],
    "daily-task-templates": ["删除每日任务", "这个每日任务模板会被删除，已有记录可能不再展示。"],
    "range-task-categories": ["删除任务分类", "这个分类会从当前存储中删除。"],
    "range-reminders": ["删除阶段任务", "这个阶段任务及其步骤会从当前存储中删除。"],
    "milestone-days": ["删除倒数日", "这个倒数日会从当前存储中删除，相关背景也会一并移除。"],
  };
  const [title, message] = labels[path] || ["确认删除", "这个操作完成后可能无法撤销。"];
  return {
    key: `delete.${path.replaceAll("/", ".")}`,
    title,
    message,
    confirmText: "删除",
    tone: "danger",
  };
}

bootstrap();
