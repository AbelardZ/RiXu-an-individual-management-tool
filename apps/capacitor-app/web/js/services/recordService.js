/* ═══════════════════════════════════════════════════════════════════════
   recordService.js — 微记 业务逻辑层
   ═══════════════════════════════════════════════════════════════════════ */

async function loadRecords() {
  const params = new URLSearchParams({ date: state.selectedDate });
  state.records = await request(`/records?${params}`);
}

async function saveRecord(form, data) {
  const recordDate = data.record_date || state.selectedDate;
  const payload = cleanPayload({
    record_type_id: Number(data.record_type_id),
    record_date: recordDate,
    occurred_at: data.occurred_time ? `${recordDate}T${data.occurred_time}:00` : null,
    data: collectRecordData(form),
    note: data.note,
    color: data.color,
    tag_ids: [],
  });
  if (data.id) {
    await request(`/records/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    trackChange("records", data.id, "update");
  } else {
    const saved = await request("/records", { method: "POST", body: JSON.stringify(payload) });
    trackChange("records", saved.id, "create");
  }
  state.edit.record = null;
  state.recordFormTypeId = "";
}

async function saveRecordType(form, data) {
  const schema = collectRecordSchema(form);
  const payload = {
    name: data.name,
    icon: data.icon || null,
    color: data.color || null,
    schema,
    enabled: Boolean(data.enabled),
  };
  const saved = data.id
    ? await request(`/record-types/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) })
    : await request("/record-types", { method: "POST", body: JSON.stringify(payload) });
  if (data.id) trackChange("record_types", data.id, "update");
  else trackChange("record_types", saved.id, "create");
  state.edit.recordType = saved.id;
  state.recordTypeModal = true;
}
