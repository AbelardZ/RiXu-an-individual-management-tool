/* ═══════════════════════════════════════════════════════════════════════
   recordsView.js — 微记 视图层
   ═══════════════════════════════════════════════════════════════════════ */

function recordsView() {
  const activeType = state.recordTypes.find((type) => type.enabled) || state.recordTypes[0];
  const editingRecord = state.records.find((item) => item.id === state.edit.record);
  const composerHtml = editingRecord || state.recordFormTypeId ? recordComposerModal(editingRecord, activeType) : "";
  return `
    ${topbar("微记", MODULE_SUBTITLES.records, "")}
    <div class="records-full">
      <section class="record-today-zone">
        <div class="record-panel-head">
          <div class="record-hero">
            <span>今日事件</span>
            <h2>${state.records.length ? `${state.records.length} 条微记` : "还没有微记"}</h2>
          </div>
        </div>
        ${state.records.length ? recordList(state.records, true) : `<div class="record-empty-state">选择一个类型，记下刚刚发生的事。</div>`}
      </section>
      <section class="record-add-zone">
        <div class="record-panel-head">
          <div class="record-hero compact">
            <h2>${editingRecord ? "编辑微记" : "添加微记"}</h2>
          </div>
          <button class="btn-link" data-action="openRecordTypeModal">管理类型</button>
        </div>
        ${recordTypeTiles()}
      </section>
    </div>
    ${composerHtml}
  `;
}

function recordComposerModal(item, fallbackType) {
  return `
    <div class="record-composer-backdrop" data-action="clearRecordComposer">
      <section class="record-composer-dialog" role="dialog" aria-modal="true" aria-label="${item ? "编辑微记" : "添加微记"}" data-modal-panel="recordComposer">
        ${recordForm(item, fallbackType)}
      </section>
    </div>
  `;
}

function recordForm(item, fallbackType) {
  if (!state.recordTypes.length) return empty("先创建一个微记类型");
  const selectedTypeId = item?.record_type_id || state.recordFormTypeId || fallbackType?.id;
  const selectedType = state.recordTypes.find((type) => type.id === Number(selectedTypeId)) || fallbackType;
  return `
    <form class="form-grid record-composer" data-submit="record">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <input type="hidden" name="record_type_id" value="${selectedTypeId}" />
      <div class="record-composer-head">
        <span class="record-type-icon" style="--type-color:${safeColor(selectedType?.color || "#0078d4")}">${escapeHtml(selectedType?.icon || "□")}</span>
        <div><strong>${escapeHtml(selectedType?.name || "微记")}</strong><small>${item ? "编辑这条微记的明细" : "填写这次发生的明细"}</small></div>
        <button class="icon-btn" type="button" data-action="clearRecordComposer">×</button>
      </div>
      ${field("日期", datePickerHtml("record_date", item?.record_date || state.selectedDate, { required: true }))}
      ${field("发生时间", timePickerHtml("occurred_time", item?.occurred_at ? String(item.occurred_at).slice(11, 16) : ""))}
      ${field("备注", `<textarea name="note">${escapeHtml(item?.note || "")}</textarea>`)}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存微记" : "新增微记"}</button>
        <button class="btn" type="button" data-action="clearRecordComposer">取消</button>
      </div>
    </form>
  `;
}

function recordTypeTiles() {
  const types = state.recordTypes.filter((type) => type.enabled);
  if (!types.length) return empty("还没有可用的微记类型，先打开设置创建一个");
  return `<div class="record-type-grid">${types.map((type) => `
    <button class="record-type-tile ${String(state.recordFormTypeId) === String(type.id) ? "active" : ""}" data-action="selectRecordType" data-type-id="${type.id}" style="--type-color:${safeColor(type.color || "#0078d4")}">
      <span class="record-type-tile-icon">${escapeHtml(type.icon || "□")}</span>
      <strong>${escapeHtml(type.name)}</strong>
    </button>
  `).join("")}</div>`;
}

function renderRecordFields(type, data = {}) {
  const fields = type?.schema?.fields || type?.record_schema?.fields || [];
  if (!fields.length) return field("内容", `<input name="data.__text" value="${escapeHtml(data.__text || "")}" placeholder="记录内容" />`);
  return fields.map((item) => {
    const key = item.key || item.label;
    const name = `data.${key}`;
    const label = item.label || key;
    const value = data[key] ?? "";
    if (item.type === "boolean") {
      return field(label, `<label class="check"><input name="${name}" type="checkbox" value="true" ${value ? "checked" : ""} /> 已完成</label>`);
    }
    if (item.type === "number") {
      return field(label, `<input name="${name}" type="number" value="${escapeHtml(value)}" ${item.required ? "required" : ""} />`);
    }
    if (item.type === "date") {
      return field(label, datePickerHtml(name, value, { required: item.required }));
    }
    if (item.type === "time") {
      return field(label, timePickerHtml(name, value, { required: item.required }));
    }
    if (["select", "single", "radio"].includes(item.type)) {
      const options = normalizeOptions(item.options);
      return field(label, `<select name="${name}" ${item.required ? "required" : ""}>${options.map((opt) => option(opt, opt, value)).join("")}</select>`);
    }
    return field(label, `<input name="${name}" value="${escapeHtml(value)}" ${item.required ? "required" : ""} />`);
  }).join("");
}

function recordTypeForm(item) {
  const selectedColor = presetColor(item?.color, "#3A6EA5");
  return `
    <form class="record-type-form" data-submit="recordType">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <div class="record-type-form-top">
        <div class="record-type-preview" style="--type-color:${selectedColor}">
          <span>${escapeHtml(item?.icon || "□")}</span>
        </div>
        <div class="record-type-basics">
          ${field("类型名称", `<input name="name" value="${escapeHtml(item?.name || "")}" placeholder="例如：健身、吃药、阅读" required />`)}
          <div class="record-type-inline">
            ${colorPaletteField("颜色", selectedColor)}
            <label class="check"><input name="enabled" type="checkbox" ${item?.enabled === false ? "" : "checked"} /> 启用</label>
          </div>
        </div>
      </div>
      ${field("图标", iconPickerHtml(item?.icon || "□"))}
      <div class="form-actions">
        <button class="btn primary" type="submit">${item ? "保存类型" : "新增类型"}</button>
        ${item ? `<button class="btn" type="button" data-action="newRecordType">新建类型</button>` : ""}
      </div>
    </form>
  `;
}

function iconPickerHtml(current = "📝") {
  const icons = ["📝","💪","💊","📖","🏃","🚴","🏊","🧘","🎯","💼","🎓","🎨","🎵","🍽","☕","💤","🧹","🛒","💻","📱","✈","🚗","❤","⭐","🔥","🌈","🎉","🎂","💡","🔧","📊","💰","🌱","🐾","⏰","✅","📌","🎮","🧠","🗣","✍","🏠","🌍","📷","🎬","📦","🔔","📋","🗓"];
  return `
    <div class="icon-picker">
      <input type="hidden" name="icon" value="${escapeHtml(current)}" />
      ${icons.map((icon) => `<button type="button" class="icon-option ${icon === current ? "active" : ""}" data-icon="${escapeHtml(icon)}" data-action="pickIcon">${icon}</button>`).join("")}
    </div>
  `;
}

function recordTypeModalHtml() {
  if (!state.recordTypeModal) return "";
  const editingType = state.recordTypes.find((item) => item.id === state.edit.recordType);
  return `
    <div class="modal-backdrop">
      <section class="record-type-modal" role="dialog" aria-modal="true" aria-label="管理微记类型" data-modal-panel="recordType">
        <div class="modal-head">
          <div><h3>管理微记类型</h3></div>
          <button class="icon-btn" type="button" data-action="closeRecordTypeModal">×</button>
        </div>
        <div class="record-type-modal-body">
          <aside>${recordTypeList()}</aside>
          <section>${recordTypeForm(editingType)}</section>
        </div>
      </section>
    </div>
  `;
}

function refreshRecordTypeModal() {
  const body = document.querySelector(".record-type-modal-body");
  if (!state.recordTypeModal || !body) {
    render();
    return;
  }
  const editingType = state.recordTypes.find((item) => item.id === state.edit.recordType);
  body.innerHTML = `
    <aside>${recordTypeList()}</aside>
    <section>${recordTypeForm(editingType)}</section>
  `;
  // 重新绑定表单事件
  body.querySelectorAll("form[data-submit]").forEach((form) => {
    form.addEventListener("submit", handleSubmit);
  });
}

function emptyRecordField() {
  return { key: "", label: "", type: "text", required: false, options: "" };
}

function recordFieldRow(item = emptyRecordField()) {
  return `
    <div class="field-row">
      <div class="field-row-main">
        <input name="field_label" value="${escapeHtml(item.label || "")}" placeholder="显示名称，例如：项目" />
        <select name="field_type">
          ${option("text", "文本", item.type)}
          ${option("number", "数字", item.type)}
          ${option("boolean", "勾选", item.type)}
          ${option("select", "单选", item.type)}
          ${option("date", "日期", item.type)}
          ${option("time", "时间", item.type)}
        </select>
        <input name="field_options" value="${escapeHtml(normalizeOptions(item.options).join("，"))}" placeholder="选项，逗号分隔" class="field-options-input" />
        <label class="check field-required-check"><input name="field_required" type="checkbox" ${item.required ? "checked" : ""} /> 必填</label>
      </div>
      <button class="btn small danger" type="button" data-action="removeRecordField" title="删除字段">×</button>
    </div>
  `;
}

function recordTypeFields(item) {
  return (item?.schema?.fields || item?.record_schema?.fields || []).map((fieldItem) => ({
    key: fieldItem.key || "",
    label: fieldItem.label || fieldItem.key || "",
    type: normalizeFieldType(fieldItem.type),
    required: Boolean(fieldItem.required),
    options: normalizeOptions(fieldItem.options).join("，"),
  }));
}

function normalizeFieldType(type) {
  if (["text", "number", "boolean", "select", "date", "time"].includes(type)) return type;
  if (["single", "radio"].includes(type)) return "select";
  return "text";
}

function collectRecordSchema(form) {
  const fields = Array.from(form.querySelectorAll(".field-row")).map((row, index) => {
    const label = row.querySelector('[name="field_label"]')?.value.trim() || "";
    const key = slugFieldKey(label, index);
    const type = row.querySelector('[name="field_type"]')?.value || "text";
    const options = normalizeOptions(row.querySelector('[name="field_options"]')?.value || "");
    const required = Boolean(row.querySelector('[name="field_required"]')?.checked);
    const field = { key, label: label || key, type, required };
    if (type === "select") field.options = options;
    return field;
  }).filter((item) => item.key && item.label);
  return { fields };
}

function slugFieldKey(value, index = 0) {
  const ascii = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return ascii || `field_${index + 1}`;
}

function addRecordFieldRow() {
  const container = document.getElementById("recordFieldRows");
  if (container) container.insertAdjacentHTML("beforeend", recordFieldRow(emptyRecordField()));
}

function removeRecordFieldRow(button) {
  const row = button.closest(".field-row");
  if (row) row.remove();
}

function recordTypeFieldCount(type) {
  return recordTypeFields(type).length;
}

function recordTypeList() {
  if (!state.recordTypes.length) return empty("还没有微记类型");
  return `<div class="record-type-manage-list">${state.recordTypes.map((item) => `
    <article class="record-type-manage-item ${state.edit.recordType === item.id ? "active" : ""}" style="--type-color:${safeColor(item.color || "#0078d4")}">
      <button type="button" class="record-type-manage-main" data-edit="recordType" data-id="${item.id}">
        <span class="record-type-manage-icon">${escapeHtml(item.icon || "□")}</span>
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <p>${item.enabled ? "已启用" : "已停用"} · ${((item.schema || item.record_schema || {}).fields || []).length} 个字段</p>
        </div>
      </button>
      <button class="record-type-manage-delete" type="button" data-delete="record-types" data-id="${item.id}" title="删除类型">
        ${iconSvg("trash")}
      </button>
    </article>
  `).join("")}</div>`;
}

function recordList(items, manage = false) {
  if (!items.length) return empty("没有微记");
  const sorted = [...items].sort((a, b) => String(b.occurred_at || b.created_at || "").localeCompare(String(a.occurred_at || a.created_at || "")));
  return `<div class="daily-check-list event-card-list">${sorted.map((item) => {
    const type = recordTypeById(item.record_type_id);
    return `
    <article class="daily-check-item event-check-item record-check-item" data-edit="record" data-id="${item.id}">
      <span class="event-check-icon" style="--type-color:${safeColor(type?.color || "#0078d4")}">${escapeHtml(type?.icon || "□")}</span>
      <div class="daily-check-content">
        <h4>${escapeHtml(type?.name || "微记")}</h4>
        <p><span>${escapeHtml(recordTimeLabel(item))}</span> · ${recordSummary(item)}</p>
        ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
      </div>
      ${manage ? `<div class="row-actions event-actions"><button class="icon-btn" title="编辑" data-edit="record" data-id="${item.id}">${iconSvg("gear")}</button><button class="icon-btn danger" title="删除" data-delete="records" data-id="${item.id}">${iconSvg("trash")}</button></div>` : ""}
    </article>`;
  }).join("")}</div>`;
}

function recordTypeCount(id) {
  return state.records.filter((item) => item.record_type_id === id).length;
}

function recordTypeName(id) {
  return state.recordTypes.find((item) => item.id === id)?.name || "微记";
}

function recordTypeById(id) {
  return state.recordTypes.find((item) => item.id === id);
}

function recordTimeLabel(item) {
  if (!item.occurred_at) return "全天";
  return String(item.occurred_at).slice(11, 16) || "全天";
}

function recordSummary(item) {
  const pairs = Object.entries(item.data || {})
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${value === true ? "是" : value === false ? "否" : value}`);
  return escapeHtml(pairs.join(" · "));
}
