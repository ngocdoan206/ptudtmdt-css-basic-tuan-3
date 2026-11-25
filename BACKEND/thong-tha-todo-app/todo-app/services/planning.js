// Các thuật toán lập kế hoạch dựa trên tâm lý học hành vi.
// Các ngưỡng (0,5 / 0,8 / 5 mẫu / 10 check-in / 30 phút mặc định) là THAM SỐ BAN ĐẦU, có thể chỉnh.

const { db, getSettings } = require('../db/db');
const { addDays, diffDays, weekday, mondayOf } = require('./dates');

const DEFAULT_TASK_MIN = 30;   // việc chưa ước lượng thì tạm coi là 30 phút
const MIN_SAMPLES = 5;         // cần ≥5 việc đã xong có đủ dữ liệu mới tính hệ số trễ
const MIRROR_MIN_CHECKINS = 10;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- 1. Hệ số trễ cá nhân (planning fallacy) ----------
// = tổng thời gian thực tế / tổng thời gian ước tính của các việc đã xong
function overrunStats() {
  const rows = db.prepare(`
    SELECT COALESCE(tag, '') AS tag, COUNT(*) AS n, SUM(actual_min) AS act, SUM(estimate_min) AS est
    FROM tasks
    WHERE status = 'done' AND deleted_at IS NULL AND estimate_min > 0 AND actual_min > 0
    GROUP BY COALESCE(tag, '')`).all();
  let n = 0, act = 0, est = 0;
  const byTag = {};
  for (const r of rows) {
    n += r.n; act += r.act; est += r.est;
    byTag[r.tag] = { n: r.n, ratio: clamp(r.act / r.est, 0.5, 3) };
  }
  const global = n >= MIN_SAMPLES ? clamp(act / est, 0.5, 3) : 1;
  return { global, globalSamples: n, byTag };
}

function ratioFor(tag, stats) {
  const t = stats.byTag[tag || ''];
  if (t && t.n >= MIN_SAMPLES) return t.ratio;
  return stats.global;
}

// Số phút "thực tế dự kiến" của một việc = ước tính × hệ số trễ
function realisticMin(task, stats) {
  return Math.round((task.estimate_min || DEFAULT_TASK_MIN) * ratioFor(task.tag, stats));
}

// ---------- 2. Sức chứa của một ngày ----------
function checkinOf(date) {
  return db.prepare('SELECT * FROM daily_checkins WHERE date = ?').get(date) || null;
}

// Giờ trống "thô" của ngày (check-in nếu có, nếu không lấy mặc định trong cài đặt)
function availableMin(date) {
  const c = checkinOf(date);
  if (c && c.available_min > 0) return c.available_min;
  return getSettings().daily_capacity_min;
}

// Sức chứa đề xuất = giờ trống / hệ số trễ toàn cục
function capacityMin(date, stats) {
  return Math.round(availableMin(date) / stats.global);
}

// Tổng phút đã xếp cho một ngày (chỉ việc chưa xong)
function plannedByDay(fromDate, toDate, stats) {
  const rows = db.prepare(`
    SELECT id, due_date, estimate_min, tag, lane FROM tasks
    WHERE status = 'todo' AND deleted_at IS NULL AND due_date BETWEEN ? AND ?`).all(fromDate, toDate);
  const map = {};
  for (const t of rows) {
    const d = (map[t.due_date] ||= { total: 0, chinh: 0, neu_con_suc: 0, items: [] });
    const m = realisticMin(t, stats);
    d.total += m; d[t.lane] += m; d.items.push({ id: t.id, m, lane: t.lane });
  }
  return map;
}

// ---------- 3. Cảnh báo hạn theo khối lượng việc ----------
// need = ước tính × hệ số trễ của chính việc này
// free = tổng sức chứa từ hôm nay đến hạn − các việc khác (làn chính) có hạn sớm hơn hoặc cùng ngày
//        (giả định làm việc hạn sớm trước – Earliest Deadline First)
// Chỉ cảnh báo việc đủ lớn (≥45 phút) và hạn từ ngày mai trở đi: việc hôm nay đã có thanh sức chứa,
// việc nhỏ luôn chen vào được → tránh "nhờn" cảnh báo.
const WARN_MIN_NEED = 45;
function deadlineWarning(task, today, stats, plannedMap) {
  if (task.status !== 'todo' || !task.due_date || task.due_date <= today || task.lane !== 'chinh') return null;
  const need = realisticMin(task, stats);
  if (need < WARN_MIN_NEED) return null;
  let cap = 0, others = 0;
  for (let d = today; d <= task.due_date; d = addDays(d, 1)) {
    cap += capacityMin(d, stats);
    const p = plannedMap[d];
    if (p) others += p.items.filter(x => x.id !== task.id && x.lane === 'chinh').reduce((s, x) => s + x.m, 0);
  }
  const free = Math.max(0, cap - others);
  const r = free > 0 ? need / free : Infinity;
  const daysLeft = diffDays(today, task.due_date);
  if (r > 1) return { level: 'khong_kip', need, free, daysLeft,
    text: 'Không kịp nếu làm như thường lệ' };
  if (r >= 0.8) return { level: 'nen_bat_dau', need, free, daysLeft,
    text: 'Hôm nay là ngày bắt đầu muộn nhất hợp lý' };
  if (r >= 0.5) return { level: 'nhac_nhe', need, free, daysLeft,
    text: 'Nên xếp lịch cho việc này sớm' };
  return null;
}

// ---------- 4. Tấm gương dữ liệu (mood ↔ số việc xếp/xong) ----------
const MOOD_ICON = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

function moodMirror(today) {
  const checkins = db.prepare('SELECT date, mood FROM daily_checkins WHERE date < ? ORDER BY date').all(today);
  if (checkins.length < MIRROR_MIN_CHECKINS) return { ready: false, have: checkins.length, need: MIRROR_MIN_CHECKINS };
  const stmt = db.prepare(`
    SELECT COUNT(*) AS planned, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM tasks WHERE due_date = ? AND deleted_at IS NULL AND status != 'archived'`);
  const byMood = {};
  for (const c of checkins) {
    const r = stmt.get(c.date);
    const b = (byMood[c.mood] ||= { days: 0, planned: 0, done: 0 });
    b.days++; b.planned += r.planned; b.done += r.done || 0;
  }
  const rows = Object.entries(byMood).map(([mood, b]) => ({
    mood: Number(mood), icon: MOOD_ICON[mood], days: b.days,
    avgPlanned: +(b.planned / b.days).toFixed(1), avgDone: +(b.done / b.days).toFixed(1)
  })).sort((a, b) => a.mood - b.mood);

  const todayCheckin = checkinOf(today);
  const pick = rows.find(r => todayCheckin && r.mood === todayCheckin.mood) || rows[rows.length - 1];
  const sentence = pick && pick.days >= 2
    ? `Những ngày bạn chọn ${pick.icon}, bạn thường xếp khoảng ${fmt(pick.avgPlanned)} việc và xong ${fmt(pick.avgDone)} việc.`
    : null;
  return { ready: true, rows, sentence };
}
const fmt = x => String(Math.round(x * 10) / 10).replace('.', ',');

// ---------- 5. Việc khởi động khi tâm trạng/năng lượng thấp ----------
function starterTask(today) {
  const c = checkinOf(today);
  if (!c || (c.mood > 2 && c.energy !== 'thap')) return null;
  return db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'todo' AND deleted_at IS NULL AND due_date <= ?
      AND (estimate_min <= 15 OR energy = 'nhe')
    ORDER BY COALESCE(estimate_min, 999), id LIMIT 1`).get(today) || null;
}

// ---------- 6. Việc lặp lại ----------
function nextOccurrence(task, completedDate) {
  const base = task.due_date || completedDate;
  if (task.recurrence === 'daily') return addDays(base > completedDate ? base : completedDate, 1);
  if (task.recurrence === 'weekly') {
    let d = addDays(base, 7);
    while (d <= completedDate) d = addDays(d, 7);
    return d;
  }
  if (task.recurrence === 'after_n_days') return addDays(completedDate, Math.max(1, task.recur_n || 1));
  return null;
}

// Tiến độ tuần dạng "x/7 ngày" – KHÔNG dùng streak liên tiếp, có ngày nghỉ dự phòng
function weeklyProgress(task, today) {
  if (task.recurrence === 'none') return null;
  const seriesId = task.series_id || task.id;
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const done = db.prepare(`
    SELECT COUNT(DISTINCT done_date) AS n FROM tasks
    WHERE (series_id = ? OR id = ?) AND status = 'done' AND done_date BETWEEN ? AND ?`)
    .get(seriesId, seriesId, monday, sunday).n;
  if (task.recurrence === 'daily') {
    const reserve = task.reserve_days_per_week ?? 2;
    return { done, target: 7 - reserve, reserve, unit: 'ngày', label: `${done}/7 ngày trong tuần` };
  }
  return { done, target: 1, reserve: 0, unit: 'lần', label: `${done} lần trong tuần` };
}

// ---------- 7. Quét việc của ngày đã qua chưa đánh dấu → 'unconfirmed' ----------
function sweepUnconfirmed(today, stamp) {
  const rows = db.prepare(`
    SELECT id FROM tasks WHERE status = 'todo' AND deleted_at IS NULL AND due_date < ?`).all(today);
  if (!rows.length) return 0;
  const up = db.prepare(`UPDATE tasks SET status = 'unconfirmed', updated_at = ? WHERE id = ?`);
  const ev = db.prepare(`INSERT INTO task_events(task_id, type, at) VALUES (?, 'unconfirmed', ?)`);
  for (const r of rows) { up.run(stamp, r.id); ev.run(r.id, stamp); }
  return rows.length;
}

// ---------- 8. Có nên mời "Bắt đầu lại" (fresh start) không ----------
function freshStartSuggestion(today) {
  const dismissed = db.prepare(`SELECT value FROM settings WHERE key = 'fresh_start_seen'`).get();
  if (dismissed && dismissed.value === today) return null;
  const leftover = db.prepare(`
    SELECT COUNT(*) AS n FROM tasks WHERE status = 'unconfirmed' AND deleted_at IS NULL`).get().n;
  const last = db.prepare(`SELECT MAX(at) AS at FROM task_events WHERE type != 'unconfirmed'`).get().at;
  const daysAway = last ? diffDays(last.slice(0, 10), today) : 0;
  const isLandmark = weekday(today) === 1 || today.endsWith('-01');
  if (daysAway >= 3 && leftover > 0) return { reason: 'away', daysAway, leftover };
  if (isLandmark && leftover >= 5) return { reason: weekday(today) === 1 ? 'monday' : 'month', daysAway, leftover };
  return null;
}

module.exports = {
  DEFAULT_TASK_MIN, overrunStats, ratioFor, realisticMin, checkinOf, availableMin, capacityMin,
  plannedByDay, deadlineWarning, moodMirror, starterTask, nextOccurrence, weeklyProgress,
  sweepUnconfirmed, freshStartSuggestion, MOOD_ICON
};
