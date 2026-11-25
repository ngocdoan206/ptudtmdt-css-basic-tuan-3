// API cho công việc: xem, tìm kiếm, lọc, thêm, sửa, xoá, hoàn thành, dời, buông…
const express = require('express');
const { db, tx } = require('../db/db');
const { validateTask } = require('../services/validate');
const { stripVN } = require('../services/text');
const { addDays, nextWeekend, weekday, isValidYmd } = require('../services/dates');
const { today, stamp } = require('../services/clock');
const P = require('../services/planning');

const router = express.Router();

// ---------- tiện ích ----------
const logEvent = (taskId, type, meta) =>
  db.prepare('INSERT INTO task_events(task_id, type, at, meta) VALUES (?, ?, ?, ?)')
    .run(taskId, type, stamp(), meta ? JSON.stringify(meta) : null);

const getTask = id => db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

function bad(res, msg, code = 400) { return res.status(code).json({ error: msg }); }

function findOr404(req, res) {
  const id = Number(req.params.id);
  const t = Number.isInteger(id) ? getTask(id) : null;
  if (!t) { bad(res, 'Không tìm thấy việc này.', 404); return null; }
  return t;
}

// Gắn thêm thông tin tính toán cho task trước khi trả về giao diện
function decorate(tasks) {
  const td = today();
  const stats = P.overrunStats();
  const maxDue = tasks.reduce((m, t) => (t.due_date && t.due_date > m ? t.due_date : m), td);
  const planned = P.plannedByDay(td, maxDue, stats);
  const subStmt = db.prepare('SELECT id, title, done FROM subtasks WHERE task_id = ? ORDER BY id');
  const openStmt = db.prepare('SELECT started_at FROM focus_sessions WHERE task_id = ? AND ended_at IS NULL');
  return tasks.map(t => ({
    ...t,
    subtasks: subStmt.all(t.id).map(s => ({ ...s, done: !!s.done })),
    realistic_min: P.realisticMin(t, stats),
    ratio: +P.ratioFor(t.tag, stats).toFixed(2),
    warning: P.deadlineWarning(t, td, stats, planned),
    progress: P.weeklyProgress(t, td),
    running_since: (openStmt.get(t.id) || {}).started_at || null
  }));
}

// ---------- GET /api/tasks ----------
router.get('/', (req, res) => {
  const td = today();
  P.sweepUnconfirmed(td, stamp());
  const q = req.query;
  const where = ['deleted_at IS NULL'];
  const args = [];

  switch (q.view) {
    case 'today': where.push("due_date = ? AND status IN ('todo','done')"); args.push(td); break;
    case 'unconfirmed': where.push("status = 'unconfirmed'"); break;
    case 'upcoming': where.push("status = 'todo' AND due_date > ?"); args.push(td); break;
    case 'nodate': where.push("status = 'todo' AND due_date IS NULL"); break;
    case 'archived': where.push("status = 'archived'"); break;
    default: if (!q.status) where.push("status != 'archived'");
  }
  if (q.status) { where.push('status = ?'); args.push(q.status); }
  for (const k of ['priority', 'energy', 'lane']) if (q[k]) { where.push(`${k} = ?`); args.push(q[k]); }
  if (q.tag) { where.push('tag = ?'); args.push(String(q.tag).replace(/^#/, '').toLowerCase()); }
  if (q.from && isValidYmd(q.from)) { where.push('due_date >= ?'); args.push(q.from); }
  if (q.to && isValidYmd(q.to)) { where.push('due_date <= ?'); args.push(q.to); }
  if (q.fits) { where.push("status = 'todo' AND COALESCE(estimate_min, ?) <= ?"); args.push(P.DEFAULT_TASK_MIN, Number(q.fits) || 15); }

  let rows = db.prepare(`
    SELECT * FROM tasks WHERE ${where.join(' AND ')}
    ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date,
             CASE WHEN due_time IS NULL THEN 1 ELSE 0 END, due_time,
             CASE priority WHEN 'cao' THEN 0 WHEN 'vua' THEN 1 ELSE 2 END, id`).all(...args);

  // Tìm kiếm có dấu/không dấu (lọc bằng JS sau khi đã bỏ dấu)
  if (q.q) {
    const needle = stripVN(q.q).trim();
    rows = rows.filter(t => stripVN(`${t.title} ${t.note || ''} ${t.tag || ''}`).includes(needle));
  }
  res.json(decorate(rows));
});

// Danh sách nhãn đang dùng (cho bộ lọc)
router.get('/tags', (req, res) => {
  res.json(db.prepare(`SELECT tag, COUNT(*) AS n FROM tasks WHERE tag IS NOT NULL AND deleted_at IS NULL GROUP BY tag ORDER BY n DESC`).all());
});

router.get('/:id', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  res.json(decorate([t])[0]);
});

// ---------- POST /api/tasks ----------
function insertTask(data, subtasks = []) {
  const s = stamp();
  const r = db.prepare(`
    INSERT INTO tasks (title, note, due_date, due_time, priority, tag, energy, estimate_min, lane,
      if_then_plan, recurrence, recur_n, reserve_days_per_week, series_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.title, data.note ?? null, data.due_date ?? null, data.due_time ?? null, data.priority || 'vua',
    data.tag ?? null, data.energy || 'nang', data.estimate_min ?? null, data.lane || 'chinh',
    data.if_then_plan ?? null, data.recurrence || 'none', data.recur_n ?? null,
    data.reserve_days_per_week ?? 2, data.series_id ?? null, s, s);
  const id = Number(r.lastInsertRowid);
  if ((data.recurrence || 'none') !== 'none' && !data.series_id) {
    db.prepare('UPDATE tasks SET series_id = ? WHERE id = ?').run(id, id);
  }
  const ins = db.prepare('INSERT INTO subtasks(task_id, title, done) VALUES (?, ?, ?)');
  for (const st of subtasks) {
    const title = String(st.title || st || '').trim().slice(0, 200);
    if (title) ins.run(id, title, st.done ? 1 : 0);
  }
  logEvent(id, 'created');
  return id;
}

router.post('/', (req, res) => {
  const { data, error } = validateTask(req.body);
  if (error) return bad(res, error);
  const subs = Array.isArray(req.body.subtasks) ? req.body.subtasks : [];
  const id = tx(() => insertTask(data, subs));
  res.status(201).json(decorate([getTask(id)])[0]);
});

// ---------- PUT /api/tasks/:id ----------
router.put('/:id', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const { data, error } = validateTask(req.body, true);
  if (error) return bad(res, error);
  if (req.body.status !== undefined) {
    if (!['todo', 'done', 'let_go', 'unconfirmed', 'archived'].includes(req.body.status)) return bad(res, 'Trạng thái không hợp lệ.');
    data.status = req.body.status;
    if (data.status === 'todo') { data.completed_at = null; data.done_date = null; }
  }
  tx(() => {
    const keys = Object.keys(data);
    if (keys.length) {
      db.prepare(`UPDATE tasks SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
        .run(...keys.map(k => data[k]), stamp(), t.id);
    }
    if (Array.isArray(req.body.subtasks)) {
      db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(t.id);
      const ins = db.prepare('INSERT INTO subtasks(task_id, title, done) VALUES (?, ?, ?)');
      for (const st of req.body.subtasks) {
        const title = String(st.title || '').trim().slice(0, 200);
        if (title) ins.run(t.id, title, st.done ? 1 : 0);
      }
    }
    if (data.status === 'todo' && t.status !== 'todo') logEvent(t.id, 'restored');
  });
  res.json(decorate([getTask(t.id)])[0]);
});

// ---------- Xoá mềm + hoàn tác ----------
router.delete('/:id', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  db.prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?').run(stamp(), t.id);
  logEvent(t.id, 'deleted');
  res.json({ ok: true, id: t.id });
});

router.post('/:id/restore', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  if (t.deleted_at) db.prepare('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(stamp(), t.id);
  else if (['archived', 'let_go', 'unconfirmed'].includes(t.status)) {
    db.prepare(`UPDATE tasks SET status = 'todo', due_date = CASE WHEN due_date < ? THEN ? ELSE due_date END, updated_at = ? WHERE id = ?`)
      .run(today(), today(), stamp(), t.id);
  }
  logEvent(t.id, 'restored');
  res.json(decorate([getTask(t.id)])[0]);
});

// ---------- Phiên tập trung: Bắt đầu / Dừng ----------
function closeOpenSession(taskId) {
  const open = db.prepare('SELECT * FROM focus_sessions WHERE task_id = ? AND ended_at IS NULL').get(taskId);
  if (!open) return 0;
  const ended = new Date();
  const started = new Date(open.started_at.replace(' ', 'T') + '+07:00');
  const minutes = Math.max(1, Math.round((ended - started) / 60000));
  db.prepare('UPDATE focus_sessions SET ended_at = ?, minutes = ? WHERE id = ?').run(stamp(), minutes, open.id);
  db.prepare('UPDATE tasks SET actual_min = actual_min + ? WHERE id = ?').run(minutes, taskId);
  return minutes;
}

router.post('/:id/start', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  tx(() => {
    // chỉ chạy một phiên tại một thời điểm
    const others = db.prepare('SELECT task_id FROM focus_sessions WHERE ended_at IS NULL').all();
    for (const o of others) closeOpenSession(o.task_id);
    db.prepare('INSERT INTO focus_sessions(task_id, started_at) VALUES (?, ?)').run(t.id, stamp());
    logEvent(t.id, 'started');
  });
  res.json(decorate([getTask(t.id)])[0]);
});

router.post('/:id/stop', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const minutes = tx(() => closeOpenSession(t.id));
  res.json({ ...decorate([getTask(t.id)])[0], session_minutes: minutes });
});

// ---------- Hoàn thành (cho phép đánh dấu bù ngày đã làm) ----------
function completeTask(t, doneDate) {
  const td = today();
  const d = doneDate && isValidYmd(doneDate) && doneDate <= td ? doneDate : td;
  closeOpenSession(t.id);
  db.prepare(`UPDATE tasks SET status = 'done', completed_at = ?, done_date = ?, updated_at = ? WHERE id = ?`)
    .run(stamp(), d, stamp(), t.id);
  logEvent(t.id, d < td || t.status === 'unconfirmed' ? 'marked_late_done' : 'done', { done_date: d });
  // Việc lặp lại → tạo lần kế tiếp
  let nextId = null;
  if (t.recurrence !== 'none') {
    const exists = db.prepare(`SELECT id FROM tasks WHERE series_id = ? AND status = 'todo' AND deleted_at IS NULL`).get(t.series_id || t.id);
    if (!exists) {
      nextId = insertTask({ ...t, due_date: P.nextOccurrence(t, d), series_id: t.series_id || t.id, lane: 'chinh' },
        db.prepare('SELECT title FROM subtasks WHERE task_id = ?').all(t.id));
    }
  }
  return nextId;
}

router.post('/:id/complete', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const nextId = tx(() => completeTask(t, (req.body || {}).done_date));
  res.json({ ...decorate([getTask(t.id)])[0], next_id: nextId });
});

// ---------- Dời ----------
function resolveTarget(to) {
  const td = today();
  if (to === 'today') return td;
  if (to === 'tomorrow') return addDays(td, 1);
  if (to === 'weekend') {
    const wd = weekday(td);
    if (wd === 6) return addDays(td, 1);   // thứ bảy → chủ nhật
    if (wd === 0) return addDays(td, 6);   // chủ nhật → thứ bảy tuần sau
    return nextWeekend(td);
  }
  if (isValidYmd(to) && to >= td) return to;
  return null;
}

function postponeTask(t, target) {
  db.prepare(`UPDATE tasks SET due_date = ?, status = 'todo', postpone_count = postpone_count + ?, updated_at = ? WHERE id = ?`)
    .run(target, t.due_date && target > t.due_date ? 1 : 0, stamp(), t.id);
  logEvent(t.id, 'postponed', { from: t.due_date, to: target });
}

router.post('/:id/postpone', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const target = resolveTarget((req.body || {}).to);
  if (!target) return bad(res, 'Ngày dời đến không hợp lệ.');
  tx(() => postponeTask(t, target));
  res.json(decorate([getTask(t.id)])[0]);
});

// ---------- Buông có chủ đích ----------
function letGo(t) {
  closeOpenSession(t.id);
  db.prepare(`UPDATE tasks SET status = 'let_go', updated_at = ? WHERE id = ?`).run(stamp(), t.id);
  logEvent(t.id, 'let_go');
}

router.post('/:id/let-go', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  tx(() => letGo(t));
  res.json(decorate([getTask(t.id)])[0]);
});

// ---------- Lý do vướng (việc bị dời nhiều lần) ----------
router.post('/:id/friction', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const reason = (req.body || {}).reason;
  if (!['qua_lon', 'chua_ro', 'khong_quan_trong'].includes(reason)) return bad(res, 'Lý do không hợp lệ.');
  tx(() => {
    db.prepare('UPDATE tasks SET friction_reason = ?, updated_at = ? WHERE id = ?').run(reason, stamp(), t.id);
    if (reason === 'khong_quan_trong') letGo(t);
  });
  res.json(decorate([getTask(t.id)])[0]);
});

// ---------- Thao tác hàng loạt ----------
router.post('/bulk', (req, res) => {
  const { ids, action, to, done_date } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return bad(res, 'Chưa chọn việc nào.');
  if (!['complete', 'postpone', 'let_go'].includes(action)) return bad(res, 'Thao tác không hợp lệ.');
  const target = action === 'postpone' ? resolveTarget(to) : null;
  if (action === 'postpone' && !target) return bad(res, 'Ngày dời đến không hợp lệ.');
  const n = tx(() => {
    let c = 0;
    for (const id of ids) {
      const t = getTask(Number(id));
      if (!t || t.deleted_at) continue;
      if (action === 'complete') completeTask(t, done_date);
      if (action === 'postpone') postponeTask(t, target);
      if (action === 'let_go') letGo(t);
      c++;
    }
    return c;
  });
  res.json({ ok: true, count: n });
});

// ---------- Bước nhỏ (subtask) ----------
router.post('/:id/subtasks', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const title = String((req.body || {}).title || '').trim();
  if (!title || title.length > 200) return bad(res, 'Tên bước nhỏ cần từ 1 đến 200 ký tự.');
  db.prepare('INSERT INTO subtasks(task_id, title) VALUES (?, ?)').run(t.id, title);
  res.status(201).json(decorate([getTask(t.id)])[0]);
});

router.patch('/:id/subtasks/:sid', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  const sid = Number(req.params.sid);
  const done = (req.body || {}).done ? 1 : 0;
  db.prepare('UPDATE subtasks SET done = ? WHERE id = ? AND task_id = ?').run(done, sid, t.id);
  res.json(decorate([getTask(t.id)])[0]);
});

router.delete('/:id/subtasks/:sid', (req, res) => {
  const t = findOr404(req, res); if (!t) return;
  db.prepare('DELETE FROM subtasks WHERE id = ? AND task_id = ?').run(Number(req.params.sid), t.id);
  res.json(decorate([getTask(t.id)])[0]);
});

module.exports = { router, decorate, insertTask, completeTask, postponeTask, letGo, logEvent };
