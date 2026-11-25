// API: check-in, kế hoạch hôm nay, thêm nhanh, bắt đầu lại, thống kê "Hiểu mình", cài đặt, dữ liệu mẫu
const express = require('express');
const { db, tx, getSettings } = require('../db/db');
const { addDays, diffDays, hourOf } = require('../services/dates');
const { today, stamp } = require('../services/clock');
const { parseQuickAdd } = require('../services/parse');
const P = require('../services/planning');
const { decorate, logEvent } = require('./tasks');

const router = express.Router();
const bad = (res, msg) => res.status(400).json({ error: msg });

// ---------- Check-in ----------
router.get('/checkins/today', (req, res) => {
  res.json(P.checkinOf(today()));
});

router.put('/checkins/today', (req, res) => {
  const { mood, energy, available_min } = req.body || {};
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return bad(res, 'Tâm trạng phải từ 1 đến 5.');
  if (!['thap', 'vua', 'cao'].includes(energy)) return bad(res, 'Năng lượng không hợp lệ.');
  let avail = null;
  if (available_min !== undefined && available_min !== null && available_min !== '') {
    avail = Number(available_min);
    if (!Number.isInteger(avail) || avail < 0 || avail > 1440) return bad(res, 'Giờ trống phải từ 0 đến 1440 phút.');
  }
  db.prepare(`
    INSERT INTO daily_checkins(date, mood, energy, available_min, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, energy = excluded.energy, available_min = excluded.available_min`)
    .run(today(), mood, energy, avail, stamp());
  res.json(P.checkinOf(today()));
});

router.get('/checkins', (req, res) => {
  const from = req.query.from || addDays(today(), -30);
  const to = req.query.to || today();
  res.json(db.prepare('SELECT * FROM daily_checkins WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to));
});

router.delete('/checkins', (req, res) => {
  db.prepare('DELETE FROM daily_checkins').run();
  res.json({ ok: true });
});

// ---------- Kế hoạch hôm nay ----------
router.get('/today-plan', (req, res) => {
  const td = today();
  P.sweepUnconfirmed(td, stamp());
  const settings = getSettings();
  const stats = P.overrunStats();
  const planned = P.plannedByDay(td, td, stats)[td] || { total: 0, chinh: 0, neu_con_suc: 0 };
  const checkin = P.checkinOf(td);
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS todo,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM tasks WHERE due_date = ? AND deleted_at IS NULL`).get(td);
  const unconfirmed = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'unconfirmed' AND deleted_at IS NULL`).get().n;
  const [ch, cm] = settings.close_day_time.split(':').map(Number);

  res.json({
    date: td,
    checkin,
    needCheckin: settings.mood_checkin_enabled && !checkin,
    settings,
    capacity: {
      available: P.availableMin(td),
      suggested: P.capacityMin(td, stats),
      ratio: +stats.global.toFixed(2),
      ratioSamples: stats.globalSamples,
      plannedMain: planned.chinh,
      plannedBonus: planned.neu_con_suc
    },
    counts: { todo: counts.todo || 0, done: counts.done || 0 },
    unconfirmed,
    starter: P.starterTask(td),
    mirror: P.moodMirror(td),
    freshStart: P.freshStartSuggestion(td),
    closeDay: { time: settings.close_day_time, due: hourOf() * 60 >= ch * 60 + cm && (counts.todo || 0) > 0 }
  });
});

// ---------- Thêm nhanh: phân tích câu tiếng Việt ----------
router.post('/parse', (req, res) => {
  const text = String((req.body || {}).text || '');
  if (!text.trim()) return bad(res, 'Hãy gõ nội dung việc cần làm.');
  const r = parseQuickAdd(text, today());
  if (!r.title) return bad(res, 'Chưa có tên việc. Ví dụ: "nộp báo cáo mai 9h #học 30p".');
  res.json(r);
});

// ---------- Bắt đầu lại (fresh start) ----------
router.post('/fresh-start', (req, res) => {
  const keep = new Set(((req.body || {}).keep_ids || []).map(Number));
  const td = today();
  const n = tx(() => {
    const rows = db.prepare(`SELECT id FROM tasks WHERE status = 'unconfirmed' AND deleted_at IS NULL`).all();
    let c = 0;
    for (const r of rows) {
      if (keep.has(r.id)) {
        db.prepare(`UPDATE tasks SET status = 'todo', due_date = ?, updated_at = ? WHERE id = ?`).run(td, stamp(), r.id);
        logEvent(r.id, 'restored');
      } else {
        db.prepare(`UPDATE tasks SET status = 'archived', updated_at = ? WHERE id = ?`).run(stamp(), r.id);
        logEvent(r.id, 'archived');
        c++;
      }
    }
    db.prepare(`INSERT INTO settings(key, value) VALUES ('fresh_start_seen', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(td);
    return c;
  });
  res.json({ ok: true, archived: n, kept: keep.size });
});

router.post('/fresh-start/dismiss', (req, res) => {
  db.prepare(`INSERT INTO settings(key, value) VALUES ('fresh_start_seen', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(today());
  res.json({ ok: true });
});

// ---------- Hiểu mình (thống kê hành vi) ----------
router.get('/insights', (req, res) => {
  const range = [7, 30].includes(Number(req.query.range)) ? Number(req.query.range) : 7;
  const td = today();
  const from = addDays(td, -(range - 1));
  const stats = P.overrunStats();
  const days = Array.from({ length: range }, (_, i) => addDays(from, i));

  // Việc hoàn thành theo ngày
  const doneRows = db.prepare(`
    SELECT done_date AS d, COUNT(*) AS n FROM tasks
    WHERE status = 'done' AND deleted_at IS NULL AND done_date BETWEEN ? AND ? GROUP BY done_date`).all(from, td);
  const doneMap = Object.fromEntries(doneRows.map(r => [r.d, r.n]));

  const byTag = db.prepare(`
    SELECT COALESCE(tag, '(không nhãn)') AS tag, COUNT(*) AS n FROM tasks
    WHERE status = 'done' AND deleted_at IS NULL AND done_date BETWEEN ? AND ? GROUP BY tag ORDER BY n DESC`).all(from, td);
  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) AS n FROM tasks
    WHERE status = 'done' AND deleted_at IS NULL AND done_date BETWEEN ? AND ? GROUP BY priority`).all(from, td);

  // Hệ số trễ theo nhãn
  const ratios = Object.entries(stats.byTag)
    .filter(([, v]) => v.n >= 3)
    .map(([tag, v]) => ({ tag: tag || '(không nhãn)', ratio: +v.ratio.toFixed(2), samples: v.n }))
    .sort((a, b) => b.ratio - a.ratio);

  // Tỉ lệ hoàn thành theo tâm trạng / năng lượng
  const checkins = db.prepare('SELECT * FROM daily_checkins WHERE date BETWEEN ? AND ?').all(from, td);
  const dayStmt = db.prepare(`
    SELECT COUNT(*) AS planned, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM tasks WHERE due_date = ? AND deleted_at IS NULL AND status != 'archived'`);
  const group = key => {
    const g = {};
    for (const c of checkins) {
      if (c.date === td) continue;
      const r = dayStmt.get(c.date);
      const b = (g[c[key]] ||= { days: 0, planned: 0, done: 0 });
      b.days++; b.planned += r.planned; b.done += r.done || 0;
    }
    return Object.entries(g).map(([k, b]) => ({
      key: k, days: b.days, avgPlanned: +(b.planned / b.days).toFixed(1), avgDone: +(b.done / b.days).toFixed(1),
      rate: b.planned ? Math.round((b.done / b.planned) * 100) : 0
    }));
  };

  // Khung giờ hoàn thành
  const hours = Array(24).fill(0);
  for (const r of db.prepare(`SELECT completed_at FROM tasks WHERE status = 'done' AND deleted_at IS NULL AND done_date BETWEEN ? AND ? AND completed_at IS NOT NULL`).all(from, td)) {
    hours[Number(r.completed_at.slice(11, 13))]++;
  }

  // Ngày xếp quá sức chứa
  const dayTasks = db.prepare(`SELECT estimate_min, tag FROM tasks WHERE due_date = ? AND deleted_at IS NULL AND status != 'archived' AND lane = 'chinh'`);
  const overload = days.map(d => {
    const planned = dayTasks.all(d).reduce((s, t) => s + P.realisticMin(t, stats), 0);
    return { date: d, planned, capacity: P.capacityMin(d, stats) };
  }).filter(x => x.planned > x.capacity);

  // Việc hay bị dời và lý do vướng
  const postponedByTag = db.prepare(`
    SELECT COALESCE(tag, '(không nhãn)') AS tag, SUM(postpone_count) AS n FROM tasks
    WHERE deleted_at IS NULL AND postpone_count > 0 GROUP BY tag ORDER BY n DESC LIMIT 6`).all();
  const friction = db.prepare(`
    SELECT friction_reason AS reason, COUNT(*) AS n FROM tasks
    WHERE friction_reason IS NOT NULL AND deleted_at IS NULL GROUP BY friction_reason`).all();
  const letGo = db.prepare(`
    SELECT COUNT(*) AS n FROM task_events WHERE type = 'let_go' AND substr(at, 1, 10) BETWEEN ? AND ?`).get(from, td).n;

  // Việc lặp lại – tiến độ tuần
  const recurring = decorate(db.prepare(`
    SELECT * FROM tasks WHERE recurrence != 'none' AND status = 'todo' AND deleted_at IS NULL`).all())
    .map(t => ({ title: t.title, progress: t.progress }));

  res.json({
    range, from, to: td,
    totals: {
      done: doneRows.reduce((s, r) => s + r.n, 0),
      letGo,
      ratio: +stats.global.toFixed(2),
      ratioSamples: stats.globalSamples,
      checkins: checkins.length
    },
    doneByDay: days.map(d => ({ date: d, n: doneMap[d] || 0 })),
    byTag, byPriority, ratios,
    byMood: group('mood').map(x => ({ ...x, icon: P.MOOD_ICON[x.key] })).sort((a, b) => a.key - b.key),
    byEnergy: group('energy'),
    hours,
    overload,
    postponedByTag, friction, recurring,
    mirror: P.moodMirror(td)
  });
});

// ---------- Cài đặt ----------
router.get('/settings', (req, res) => res.json(getSettings()));

router.put('/settings', (req, res) => {
  const b = req.body || {};
  const up = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  if (b.daily_capacity_min !== undefined) {
    const n = Number(b.daily_capacity_min);
    if (!Number.isInteger(n) || n < 30 || n > 960) return bad(res, 'Sức chứa mặc định phải từ 30 đến 960 phút.');
    up.run(String(n), 'daily_capacity_min');
  }
  if (b.close_day_time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.close_day_time)) return bad(res, 'Giờ Khép ngày không hợp lệ.');
    up.run(b.close_day_time, 'close_day_time');
  }
  if (b.mood_checkin_enabled !== undefined) up.run(b.mood_checkin_enabled ? '1' : '0', 'mood_checkin_enabled');
  res.json(getSettings());
});

// ---------- Dữ liệu mẫu ----------
router.post('/seed', (req, res) => {
  const { seed } = require('../db/seed');
  res.json(seed());
});

router.post('/reset', (req, res) => {
  const { reset } = require('../db/seed');
  reset();
  res.json({ ok: true });
});

module.exports = { router };
