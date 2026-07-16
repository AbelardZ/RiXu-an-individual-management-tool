/* ═══════════════════════════════════════════════════════════════════════
   journalsView.js — 札记 视图层
   ═══════════════════════════════════════════════════════════════════════ */

function journalsView() {
  const editing = state.journals.find((item) => item.id === state.edit.journal);
  const files = filteredJournals();
  const groups = journalFileGroups(files);
  return `
    ${topbar("札记", MODULE_SUBTITLES.journals, `<button class="icon-btn" type="button" data-action="newJournal" title="新建札记">+</button>`)}
    <div class="obsidian-shell">
      <aside class="vault-sidebar">
        <div class="vault-search-wrap">
          <input id="journalSearch" class="vault-search" value="${escapeHtml(state.journalSearch)}" placeholder="搜索文件..." />
        </div>
        <div id="journalTagFilterMount">${journalSidebarTagFilter()}</div>
        <div class="vault-list">
          ${files.length ? groups.map((group) => `
            <section class="vault-section">
              <div class="vault-section-title"><span>${group.label}</span><em>${group.items.length}</em></div>
              ${group.items.map((item) => journalFileButton(item, item.id === editing?.id)).join("")}
            </section>
          `).join("") : empty(state.journalSearch || state.journalTagFilter ? "没有匹配的札记" : "还没有历史札记")}
        </div>
      </aside>
      <section class="markdown-workspace">
        ${journalEditor(editing)}
      </section>
    </div>
  `;
}

function journalSidebarTagFilter() {
  const counts = journalTagCounts();
  const visibleTags = state.tags;
  if (!visibleTags.length) return "";
  const selected = state.journalTagFilter ? Number(state.journalTagFilter) : "";
  return `
    <div class="vault-tag-filter" aria-label="按标签筛选札记">
      <button class="${!selected ? "active" : ""}" type="button" data-action="filterJournalTag" data-tag-id="">
        <span>全部</span>
        <em>${state.journals.length}</em>
      </button>
      ${visibleTags.map((tag) => `
        <button class="${selected === tag.id ? "active" : ""}" type="button" data-action="filterJournalTag" data-tag-id="${tag.id}">
          <span class="tag-dot" style="--tag-color:${safeColor(tag.color)}"></span>
          <span>${escapeHtml(tag.name)}</span>
          <em>${counts.get(tag.id) || 0}</em>
        </button>
      `).join("")}
    </div>
  `;
}

function journalTagCounts() {
  const counts = new Map();
  state.journals.forEach((item) => {
    (item.tags || []).forEach((tag) => {
      counts.set(tag.id, (counts.get(tag.id) || 0) + 1);
    });
  });
  return counts;
}

function journalFileButton(item, active = false) {
  return `
    <div class="vault-file-row ${active ? "active" : ""}">
      <button class="vault-file" data-edit="journal" data-id="${item.id}" title="${escapeHtml(item.title)}">
        <span class="vault-file-main">
          <span class="vault-file-icon">md</span>
          <span class="vault-file-name">${escapeHtml(item.title)}</span>
        </span>
        <small>${formatShortDate(item.entry_date)} · ${journalWordCount(item)} 字</small>
      </button>
      <button class="vault-file-delete" type="button" data-delete="journals" data-id="${item.id}" title="删除札记" aria-label="删除 ${escapeHtml(item.title)}">
        ${iconSvg("trash")}
      </button>
    </div>
  `;
}

function journalWordCount(item) {
  return String(item.markdown_content || "").replace(/\s+/g, "").length;
}

function journalFileGroups(files) {
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const groups = [
    { key: "today", label: "今天", items: [] },
    { key: "month", label: "本月", items: [] },
    { key: "earlier", label: "更早", items: [] },
  ];
  files.forEach((item) => {
    const date = String(item.entry_date || "");
    if (date === today) groups[0].items.push(item);
    else if (date.slice(0, 7) === currentMonth) groups[1].items.push(item);
    else groups[2].items.push(item);
  });
  return groups.filter((group) => group.items.length);
}

function journalEditor(item) {
  const markdown = item?.markdown_content || "";
  const mode = state.journalMode === "read" ? "read" : "edit";
  const readonlyAttr = mode === "read" ? "readonly aria-readonly=\"true\"" : "";
  return `
    <form class="journal-editor" id="journalForm" data-submit="journal">
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <input type="hidden" name="entry_date" value="${item?.entry_date || state.selectedDate}" />
      <input type="hidden" name="summary" value="" />
      <input name="change_summary" type="hidden" value="${item?.id ? "自动保存" : "创建札记"}" />
      <div class="editor-tabbar">
        <input name="title" class="journal-title-inline" value="${escapeHtml(item?.title || "")}" placeholder="未命名札记" ${readonlyAttr} />
        ${mode === "read" ? journalReadTags(item) : journalTagMenu(item)}
        <div class="journal-mode-switch" aria-label="札记模式">
          <button class="${mode === "edit" ? "active" : ""}" type="button" data-action="journalMode" data-mode="edit">编辑</button>
          <button class="${mode === "read" ? "active" : ""}" type="button" data-action="journalMode" data-mode="read">阅读</button>
        </div>
        ${mode === "read" ? `<button class="btn small journal-edit-now" type="button" data-action="journalMode" data-mode="edit">开始编辑</button>` : ""}
      </div>
      <div class="markdown-canvas is-${mode}">
        <div class="markdown-line-shadow" aria-hidden="true"></div>
        <textarea name="markdown_content" id="markdownInput" class="markdown-input" placeholder="今天有什么想法？">${escapeHtml(markdown)}</textarea>
        <article id="markdownPreview" class="markdown-preview" aria-label="Markdown 阅读预览">${markdownPreview(markdown)}</article>
        <div class="journal-corner-meta">
          <span class="journal-time-meta">创建 ${formatDateTimeText(item?.created_at)} · 最后编辑 ${formatDateTimeText(item?.updated_at)}</span>
          <span class="autosave-status" id="journalAutosaveStatus">${escapeHtml(state.journalAutosaveStatus || "已保存")}</span>
        </div>
      </div>
    </form>
  `;
}

function journalReadTags(item) {
  const tags = item?.tags || [];
  if (!tags.length) return `<div class="journal-read-tags muted">无标签</div>`;
  return `
    <div class="journal-read-tags">
      ${tags.map((tag) => `<span class="journal-read-tag" style="--tag-color:${safeColor(tag.color)}">${escapeHtml(tag.name)}</span>`).join("")}
    </div>
  `;
}

function journalTagMenu(item) {
  const selected = new Set((item?.tags || []).map((tag) => String(tag.id)));
  const count = selected.size;
  return `
    <details class="journal-tag-menu">
      <summary>
        <span class="tag-summary-mark">#</span>
        <span class="tag-summary-text">${escapeHtml(journalTagSummary(item))}</span>
        ${count ? `<span class="tag-summary-count">${count}</span>` : ""}
      </summary>
      <div class="journal-tag-popover">
        <div class="journal-tag-popover-head">
          <strong>标签</strong>
          <span>可多选</span>
        </div>
        <div class="journal-tag-options">
          ${state.tags.length ? state.tags.map((tag) => `
            <div class="journal-tag-option">
              <label class="journal-tag-choice">
                <input class="tag-checkbox" type="checkbox" name="tag_ids" value="${tag.id}" ${selected.has(String(tag.id)) ? "checked" : ""} />
                <span class="tag-check"></span>
                <span class="tag-dot" style="--tag-color:${safeColor(tag.color)}"></span>
                <span class="tag-option-name">${escapeHtml(tag.name)}</span>
              </label>
              <button class="journal-tag-delete" type="button" data-delete="tags" data-id="${tag.id}" title="删除标签 ${escapeHtml(tag.name)}" aria-label="删除标签 ${escapeHtml(tag.name)}">
                ${iconSvg("trash")}
              </button>
            </div>
          `).join("") : '<p class="journal-tag-empty">还没有标签</p>'}
        </div>
        <label class="journal-new-tag">
          <span>新增</span>
          <input name="tag_names" placeholder="新标签，用逗号分隔" />
        </label>
      </div>
    </details>
  `;
}

function journalTagSummary(item) {
  const names = (item?.tags || []).map((tag) => tag.name).filter(Boolean);
  if (!names.length) return "标签";
  if (names.length <= 2) return names.join("、");
  return `${names.length} 个标签`;
}

function refreshJournalTagFilter() {
  const mount = document.getElementById("journalTagFilterMount");
  if (mount) mount.innerHTML = journalSidebarTagFilter();
}

function journalTagNames(item) {
  return (item?.tags || []).map((tag) => tag.name).filter(Boolean).join("，");
}

function filteredJournals() {
  const keyword = (state.journalSearch || "").trim().toLowerCase();
  const tagId = state.journalTagFilter ? Number(state.journalTagFilter) : null;
  if (!keyword && !tagId) return state.journals;
  return state.journals.filter((item) => {
    if (tagId && !(item.tags || []).some((tag) => tag.id === tagId)) return false;
    const text = `${item.title || ""} ${item.markdown_content || ""} ${journalTagNames(item)}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });
}

function journalList(items, manage = false) {
  if (!items.length) return empty("没有札记");
  return `<div class="daily-check-list event-card-list">${items.map((item) => `
    <article class="daily-check-item event-check-item journal-check-item" data-edit="journal" data-id="${item.id}">
      <span class="event-check-icon journal-icon">札</span>
      <div class="daily-check-content">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml((item.summary || item.markdown_content || "").replace(/[#>*_`]/g, "").slice(0, 140))}</p>
        ${tagsHtml(item.tags)}
      </div>
      ${manage ? `<div class="row-actions event-actions"><button class="icon-btn" title="编辑" data-edit="journal" data-id="${item.id}">${iconSvg("gear")}</button><button class="icon-btn danger" title="删除" data-delete="journals" data-id="${item.id}">${iconSvg("trash")}</button></div>` : ""}
    </article>`).join("")}</div>`;
}
