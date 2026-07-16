/* ═══════════════════════════════════════════════════════════════════════
   journalService.js — 札记 业务逻辑层
   ═══════════════════════════════════════════════════════════════════════ */

async function loadJournals() {
  state.journals = await request("/journals");
  if (state.edit.journal && !state.journals.some((item) => item.id === state.edit.journal)) {
    state.edit.journal = null;
  }
}

async function loadJournalVersions(journalId) {
  state.journalVersions = journalId ? await request(`/journals/${journalId}/versions`) : [];
}

async function saveJournal(data, options = {}) {
  const tags = await ensureJournalTags(data.tag_names);
  const tagIds = [...new Set([...collectTagIds(data), ...tags.map((tag) => tag.id)])];
  const title = stringField(data.title) || "未命名札记";
  const payload = cleanPayload({
    entry_date: data.entry_date || state.selectedDate,
    title: title,
    summary: stringField(data.summary),
    markdown_content: stringField(data.markdown_content),
    change_summary: stringField(data.change_summary) || (data.id ? "自动保存" : "创建札记"),
    tag_ids: tagIds,
  });
  // Ensure title is never null/empty for the API
  if (!payload.title) payload.title = "未命名札记";
  const saved = data.id
    ? await request(`/journals/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) })
    : await request("/journals", { method: "POST", body: JSON.stringify(payload) });
  if (data.id) trackChange("journal_entries", data.id, "update");
  else trackChange("journal_entries", saved.id, "create");
  state.edit.journal = saved.id;
  const index = state.journals.findIndex((item) => item.id === saved.id);
  if (index >= 0) state.journals.splice(index, 1, saved);
  else state.journals.unshift(saved);
  state.journals.sort((a, b) => String(b.updated_at || b.entry_date || "").localeCompare(String(a.updated_at || a.entry_date || "")));
  if (!options.silent) await loadJournalVersions(saved.id);
  return saved;
}

async function ensureJournalTags(tagNamesRaw) {
  if (!tagNamesRaw) return [];
  const names = parseTagNames(tagNamesRaw);
  if (!names.length) return [];
  const byName = new Map(state.tags.map((tag) => [tag.name, tag]));
  const result = [];
  for (const name of names) {
    let created = false;
    let tag = byName.get(name);
    if (!tag) {
      tag = await request("/tags", {
        method: "POST",
        body: JSON.stringify({ name: stringField(name), color: tagColorForName(name), description: "" }),
      });
      state.tags = [...state.tags, tag].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
      byName.set(tag.name, tag);
      created = true;
    }
    if (created) refreshJournalTagFilter();
    result.push(tag);
  }
  return result;
}

function parseTagNames(raw) {
  return stringField(raw).split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
}

function stringField(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "")).join(" ");
  return String(value || "");
}

function tagColorForName(name) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colorPresets[hash % colorPresets.length][0];
}
