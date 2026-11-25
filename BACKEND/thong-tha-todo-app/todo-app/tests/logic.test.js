// Unit test cho các thuật toán. Chạy: npm test
// Dùng database trong bộ nhớ và ngày giả lập để kết quả luôn giống nhau.
process.env.DB_FILE = ':memory:';
process.env.FAKE_TODAY = '2026-11-25'; // Thứ Tư

const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../db/db');
const { parseQuickAdd } = require('../services/parse');
const { addDays, weekday, isValidYmd, ymdOf } = require('../services/dates');
const { stripVN } = require('../services/text');
const P = require('../services/planning');
const { validateTask } = require('../services/validate');

const TODAY = '2026-11-25';
const ins = db.prepare(`INSERT INTO tasks (title, due_date, tag, estimate_min, actual_min, status, lane, recurrence, recur_n, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-11-01 08:00:00', '2026-11-01 08:00:00')`);
const clear = () => { db.exec('DELETE FROM tasks; DELETE FROM daily_checkins; DELETE FROM task_events;'); };

// ---------- Ngày giờ ----------
test('ngày theo giờ Việt Nam không bị lệch do UTC', () => {
  // 18:30 giờ UTC ngày 25/11 = 01:30 sáng 26/11 ở Việt Nam
  assert.equal(ymdOf(new Date('2026-11-25T18:30:00Z')), '2026-11-26');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekday(TODAY), 3);
  assert.equal(isValidYmd('2026-02-30'), false);
});

test('tìm kiếm bỏ dấu tiếng Việt', () => {
  assert.equal(stripVN('Báo cáo Đồ án'), 'bao cao do an');
});

// ---------- Thêm nhanh ----------
test('parse: câu đầy đủ', () => {
  const r = parseQuickAdd('nộp báo cáo mai lúc 9h #Học !cao 1h30p ~nhe', TODAY);
  assert.deepEqual(r, { due_date: '2026-11-26', due_time: '09:00', tag: 'học', priority: 'cao', estimate_min: 90, energy: 'nhe', title: 'nộp báo cáo' });
});

test('parse: thứ, chủ nhật, ngày kia, dd/mm', () => {
  assert.equal(parseQuickAdd('họp thứ 6', TODAY).due_date, '2026-11-27');
  assert.equal(parseQuickAdd('đi chợ cn', TODAY).due_date, '2026-11-29');
  assert.equal(parseQuickAdd('học bài ngày kia', TODAY).due_date, '2026-11-27');
  assert.equal(parseQuickAdd('mua quà 24/12', TODAY).due_date, '2026-12-24');
  assert.equal(parseQuickAdd('gia hạn 01/02', TODAY).due_date, '2027-02-01'); // đã qua → năm sau
});

test('parse: giờ và thời lượng không nhầm nhau', () => {
  const r = parseQuickAdd('gọi điện 14h30 45p', TODAY);
  assert.equal(r.due_time, '14:30');
  assert.equal(r.estimate_min, 45);
  assert.equal(parseQuickAdd('ôn thi 2 tiếng', TODAY).estimate_min, 120);
  assert.equal(parseQuickAdd('chạy bộ', TODAY).title, 'chạy bộ');
});

// ---------- Kiểm tra dữ liệu ----------
test('validate: chặn tên trống, ngày sai, thời lượng âm', () => {
  assert.ok(validateTask({ title: '   ' }).error);
  assert.ok(validateTask({ title: 'a', due_date: '2026-13-01' }).error);
  assert.ok(validateTask({ title: 'a', estimate_min: -5 }).error);
  assert.equal(validateTask({ title: ' Đọc sách ', tag: '#Học Tập' }).data.tag, 'học-tập');
});

// ---------- Hệ số trễ ----------
test('hệ số trễ = 1 khi chưa đủ 5 mẫu, tính đúng khi đủ', () => {
  clear();
  assert.equal(P.overrunStats().global, 1);
  for (let i = 0; i < 5; i++) ins.run('học', '2026-11-20', 'học', 60, 90, 'done', 'chinh', 'none', null);
  const s = P.overrunStats();
  assert.equal(s.global, 1.5);
  assert.equal(P.ratioFor('học', s), 1.5);
  assert.equal(P.realisticMin({ estimate_min: 40, tag: 'học' }, s), 60);
});

// ---------- Sức chứa ----------
test('sức chứa = giờ trống ÷ hệ số trễ, ưu tiên check-in', () => {
  // vẫn giữ 5 mẫu hệ số 1.5 từ test trước
  const s = P.overrunStats();
  assert.equal(P.capacityMin(TODAY, s), 160); // 240 / 1.5
  db.prepare(`INSERT INTO daily_checkins(date, mood, energy, available_min, created_at) VALUES (?, 3, 'vua', 180, 'x')`).run(TODAY);
  assert.equal(P.capacityMin(TODAY, s), 120);
});

// ---------- Cảnh báo hạn ----------
test('cảnh báo hạn theo khối lượng, bỏ qua việc nhỏ và việc hôm nay', () => {
  clear();
  const stats = { global: 1, globalSamples: 0, byTag: {} };
  const mk = (id, due, est, lane = 'chinh') => ({ id, status: 'todo', due_date: due, estimate_min: est, tag: null, lane });
  // 2 ngày (hôm nay + mai), sức chứa 240/ngày = 480 phút
  const big = mk(1, '2026-11-26', 500);
  const mid = mk(2, '2026-11-26', 400);
  const ok = mk(3, '2026-11-26', 250);
  const small = mk(4, '2026-11-26', 20);
  const empty = {};
  assert.equal(P.deadlineWarning(big, TODAY, stats, empty).level, 'khong_kip');
  assert.equal(P.deadlineWarning(mid, TODAY, stats, empty).level, 'nen_bat_dau');
  assert.equal(P.deadlineWarning(ok, TODAY, stats, empty).level, 'nhac_nhe');
  assert.equal(P.deadlineWarning(small, TODAY, stats, empty), null);
  assert.equal(P.deadlineWarning(mk(5, TODAY, 500), TODAY, stats, empty), null);
  // việc khác đã chiếm chỗ → mức cảnh báo tăng
  const busy = { [TODAY]: { items: [{ id: 9, m: 180, lane: 'chinh' }] } }; // còn trống 480 - 180 = 300 → 250/300 ≈ 0,83
  assert.equal(P.deadlineWarning(ok, TODAY, stats, busy).level, 'nen_bat_dau');
  // việc ở làn "nếu còn sức" không chiếm chỗ
  const bonus = { [TODAY]: { items: [{ id: 9, m: 300, lane: 'neu_con_suc' }] } };
  assert.equal(P.deadlineWarning(ok, TODAY, stats, bonus).level, 'nhac_nhe');
});

// ---------- Việc lặp lại ----------
test('việc lặp: hằng ngày, hằng tuần, sau N ngày tính từ ngày làm xong', () => {
  assert.equal(P.nextOccurrence({ recurrence: 'daily', due_date: '2026-11-25' }, '2026-11-25'), '2026-11-26');
  assert.equal(P.nextOccurrence({ recurrence: 'daily', due_date: '2026-11-20' }, '2026-11-25'), '2026-11-26');
  assert.equal(P.nextOccurrence({ recurrence: 'weekly', due_date: '2026-11-18' }, '2026-11-25'), '2026-12-02');
  assert.equal(P.nextOccurrence({ recurrence: 'after_n_days', recur_n: 3, due_date: '2026-11-20' }, '2026-11-25'), '2026-11-28');
});

// ---------- Chuyển "chưa đánh dấu" ----------
test('việc của ngày đã qua chưa xử lý → unconfirmed (không phải thất bại)', () => {
  clear();
  ins.run('cũ', '2026-11-24', null, 30, 0, 'todo', 'chinh', 'none', null);
  ins.run('hôm nay', TODAY, null, 30, 0, 'todo', 'chinh', 'none', null);
  ins.run('đã xong', '2026-11-24', null, 30, 30, 'done', 'chinh', 'none', null);
  assert.equal(P.sweepUnconfirmed(TODAY, `${TODAY} 06:00:00`), 1);
  const rows = db.prepare('SELECT title, status FROM tasks ORDER BY id').all().map(r => `${r.title}:${r.status}`);
  assert.deepEqual(rows, ['cũ:unconfirmed', 'hôm nay:todo', 'đã xong:done']);
});
