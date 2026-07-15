/* ═══════════════════════════════════════════════════════════════════════
   utils.js — 基础工具函数
   日期格式化、HTML 转义等纯函数，不依赖 state。
   ═══════════════════════════════════════════════════════════════════════ */

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDateText(value) {
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
}

function formatShortDate(value) {
  if (!value) return "";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(d);
}

function formatDateTimeText(value) {
  if (!value) return "自动生成";
  const normalized = String(value).includes("T") ? value : String(value).replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function monthTitle(year, month) {
  return `${year} 年 ${String(month).padStart(2, "0")} 月`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : "#3b7f6d";
}

function softColor(color) {
  return `${safeColor(color)}22`;
}

function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "string") return options.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function formData(form) {
  const raw = new FormData(form);
  const data = {};
  raw.forEach((value, key) => {
    if (key in data) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    } else {
      data[key] = value;
    }
  });
  return data;
}

function cleanPayload(payload) {
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") payload[key] = null;
  });
  return payload;
}

function presetColor(color, fallback) {
  const safe = safeColor(color);
  return colorPresets.some(([value]) => value.toLowerCase() === safe.toLowerCase()) ? safe : fallback;
}

function rangeColor(item = {}) {
  const text = String(item.title || item.id || "");
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colorPresets[hash % colorPresets.length][0];
}
