// Kiểm tra dữ liệu đầu vào cho task. Trả về { data } hoặc { error } (thông báo tiếng Việt).
const { isValidYmd } = require('./dates');

const ENUMS = {
  priority: ['thap', 'vua', 'cao'],
  energy: ['nhe', 'nang'],
  lane: ['chinh', 'neu_con_suc'],
  recurrence: ['none', 'daily', 'weekly', 'after_n_days'],
  friction_reason: ['qua_lon', 'chua_ro', 'khong_quan_trong']
};

function intOrNull(v, min, max, label) {
  if (v === undefined) return { skip: true };
  if (v === null || v === '') return { value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${label} phải là số nguyên từ ${min} đến ${max}.` };
  return { value: n };
}

// partial = true khi sửa (chỉ kiểm tra trường được gửi lên)
function validateTask(body, partial = false) {
  const b = body || {};
  const data = {};

  if (!partial || b.title !== undefined) {
    const title = String(b.title ?? '').trim();
    if (!title) return { error: 'Tên việc không được để trống.' };
    if (title.length > 200) return { error: 'Tên việc tối đa 200 ký tự.' };
    data.title = title;
  }
  if (b.note !== undefined) {
    const note = b.note === null ? null : String(b.note).trim();
    if (note && note.length > 2000) return { error: 'Ghi chú tối đa 2000 ký tự.' };
    data.note = note || null;
  }
  if (b.due_date !== undefined) {
    if (b.due_date === null || b.due_date === '') data.due_date = null;
    else if (!isValidYmd(b.due_date)) return { error: 'Ngày không hợp lệ (định dạng YYYY-MM-DD).' };
    else data.due_date = b.due_date;
  }
  if (b.due_time !== undefined) {
    if (b.due_time === null || b.due_time === '') data.due_time = null;
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.due_time)) return { error: 'Giờ không hợp lệ (định dạng HH:MM).' };
    else data.due_time = b.due_time;
  }
  if (b.tag !== undefined) {
    const tag = b.tag === null ? '' : String(b.tag).trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
    if (tag.length > 30) return { error: 'Nhãn tối đa 30 ký tự.' };
    data.tag = tag || null;
  }
  for (const k of ['priority', 'energy', 'lane', 'recurrence']) {
    if (b[k] !== undefined) {
      if (!ENUMS[k].includes(b[k])) return { error: `Giá trị "${k}" không hợp lệ.` };
      data[k] = b[k];
    }
  }
  if (b.friction_reason !== undefined) {
    if (b.friction_reason !== null && !ENUMS.friction_reason.includes(b.friction_reason)) return { error: 'Lý do không hợp lệ.' };
    data.friction_reason = b.friction_reason;
  }
  for (const [k, min, max, label] of [
    ['estimate_min', 1, 1440, 'Thời lượng (phút)'],
    ['recur_n', 1, 365, 'Số ngày lặp'],
    ['reserve_days_per_week', 0, 6, 'Số ngày dự phòng']
  ]) {
    const r = intOrNull(b[k], min, max, label);
    if (r.error) return r;
    if (!r.skip) data[k] = r.value;
  }
  if (data.reserve_days_per_week === null) data.reserve_days_per_week = 2;
  if (b.if_then_plan !== undefined) {
    const p = b.if_then_plan === null ? '' : String(b.if_then_plan).trim();
    if (p.length > 300) return { error: 'Kế hoạch "khi nào, ở đâu" tối đa 300 ký tự.' };
    data.if_then_plan = p || null;
  }
  const rec = data.recurrence ?? b.recurrence;
  if (rec === 'after_n_days' && (data.recur_n ?? b.recur_n) == null && !partial) {
    return { error: 'Việc lặp "sau N ngày" cần nhập số ngày N.' };
  }
  return { data };
}

module.exports = { validateTask, ENUMS };
