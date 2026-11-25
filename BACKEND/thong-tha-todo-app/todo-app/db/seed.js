// Dữ liệu mẫu để demo: ~30 ngày lịch sử + hôm nay + 7 ngày tới.
// Dữ liệu được sinh có chủ đích để mọi tính năng đều nhìn thấy được khi trình bày.
// Lưu ý: đây là DỮ LIỆU GIẢ LẬP, không phải kết quả nghiên cứu.
const { db, tx } = require('./db');
const { addDays, weekday, mondayOf } = require('../services/dates');
const { today: getToday } = require('../services/clock');

// Bộ sinh số ngẫu nhiên có hạt giống → lần nào nạp cũng ra cùng một bộ dữ liệu
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = {
  'học': [
    ['Ôn chương 3 Kinh tế vi mô', 60], ['Làm bài tập cá nhân PTUDTMDT', 90], ['Đọc paper về planning fallacy', 45],
    ['Viết phần 2 báo cáo nhóm', 120], ['Chuẩn bị slide thuyết trình', 60], ['Ôn từ vựng IELTS', 20],
    ['Làm quiz trên LMS', 15], ['Đọc giáo trình Digital Marketing chương 5', 50], ['Ghi chú bài giảng Khoa học dữ liệu', 30]
  ],
  'việc': [
    ['Trả lời email của nhóm', 15], ['Cập nhật sheet phân công', 20], ['Họp nhóm đồ án', 45],
    ['Viết caption fanpage', 30], ['Kiểm tra số liệu báo cáo tháng', 60], ['Gửi file cho trưởng nhóm', 10]
  ],
  'nhà': [
    ['Giặt và phơi đồ', 30], ['Dọn bàn học', 15], ['Đi chợ mua đồ cho tuần', 60],
    ['Trả tiền điện nước', 10], ['Nấu cơm tối', 45]
  ],
  'sức-khoẻ': [
    ['Tập yoga 20 phút', 20], ['Đi bộ quanh công viên', 30], ['Ngủ trước 23h', 10], ['Uống đủ 2 lít nước', 5]
  ]
};
// Hệ số trễ "thật" dùng để sinh dữ liệu: việc học hay mất lâu hơn dự tính nhất
const TRUE_RATIO = { 'học': 1.45, 'việc': 1.15, 'nhà': 1.0, 'sức-khoẻ': 0.95 };
const TAGS = Object.keys(POOL);

function reset() {
  tx(() => {
    for (const t of ['subtasks', 'focus_sessions', 'task_events', 'daily_checkins', 'tasks']) db.exec(`DELETE FROM ${t}`);
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('tasks','subtasks','task_events','focus_sessions')`);
    db.exec(`DELETE FROM settings WHERE key = 'fresh_start_seen'`);
  });
}

function seed() {
  reset();
  const rand = mulberry32(20261125);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const td = getToday();
  const pad = n => String(n).padStart(2, '0');
  const at = (d, h, m = 0) => `${d} ${pad(h)}:${pad(m)}:00`;

  const insTask = db.prepare(`
    INSERT INTO tasks (title, note, due_date, due_time, priority, tag, energy, estimate_min, actual_min, status, lane,
      if_then_plan, friction_reason, postpone_count, recurrence, recur_n, reserve_days_per_week, series_id,
      created_at, updated_at, completed_at, done_date)
    VALUES (@title, @note, @due_date, @due_time, @priority, @tag, @energy, @estimate_min, @actual_min, @status, @lane,
      @if_then_plan, @friction_reason, @postpone_count, @recurrence, @recur_n, @reserve, @series_id,
      @created_at, @updated_at, @completed_at, @done_date)`);
  const insEvent = db.prepare('INSERT INTO task_events(task_id, type, at, meta) VALUES (?, ?, ?, ?)');
  const insFocus = db.prepare('INSERT INTO focus_sessions(task_id, started_at, ended_at, minutes) VALUES (?, ?, ?, ?)');
  const insSub = db.prepare('INSERT INTO subtasks(task_id, title, done) VALUES (?, ?, ?)');
  const insCheck = db.prepare('INSERT INTO daily_checkins(date, mood, energy, available_min, created_at) VALUES (?, ?, ?, ?, ?)');

  function addTask(o) {
    const row = {
      note: null, due_time: null, priority: 'vua', energy: 'nang', actual_min: 0, status: 'todo', lane: 'chinh',
      if_then_plan: null, friction_reason: null, postpone_count: 0, recurrence: 'none', recur_n: null, reserve: 2,
      series_id: null, completed_at: null, done_date: null, ...o
    };
    row.created_at ||= at(row.due_date || td, 7, between(0, 50));
    row.updated_at ||= row.completed_at || row.created_at;
    const id = Number(insTask.run(row).lastInsertRowid);
    insEvent.run(id, 'created', row.created_at, null);
    return id;
  }

  let count = 0;
  return tx(() => {
    // ---------- 30 ngày đã qua ----------
    for (let back = 30; back >= 1; back--) {
      const d = addDays(td, -back);
      const wd = weekday(d);
      // Tâm trạng: cuối tuần vui hơn một chút
      const mood = Math.min(5, Math.max(1, Math.round(1.1 + rand() * 4.2 + (wd === 0 || wd === 6 ? 0.5 : 0))));
      const energy = mood >= 4 ? (rand() < 0.7 ? 'cao' : 'vua') : mood <= 2 ? (rand() < 0.7 ? 'thap' : 'vua') : pick(['thap', 'vua', 'cao']);
      const avail = pick([180, 210, 240, 240, 270, 300]);
      if (back <= 28) insCheck.run(d, mood, energy, avail, at(d, 7, between(5, 40)));

      // Mô phỏng: ngày vui xếp nhiều việc hơn nhưng số việc xong không tăng tương ứng
      const planned = mood >= 5 ? between(6, 8) : mood === 4 ? between(5, 6) : mood === 3 ? between(3, 5) : between(2, 3);
      const capacityDone = energy === 'cao' ? between(4, 5) : energy === 'vua' ? between(3, 4) : between(2, 3);
      for (let i = 0; i < planned; i++) {
        const tag = pick(TAGS);
        const [title, est] = pick(POOL[tag]);
        const isDone = i < capacityDone;
        const base = { title, tag, estimate_min: est, due_date: d, priority: pick(['thap', 'vua', 'vua', 'cao']),
          energy: est <= 20 ? 'nhe' : 'nang', lane: i >= 5 ? 'neu_con_suc' : 'chinh' };
        if (isDone) {
          const actual = Math.max(5, Math.round(est * TRUE_RATIO[tag] * (0.8 + rand() * 0.4)));
          // giờ hoàn thành: nhiều nhất buổi sáng 9–11h và tối 20–22h
          const h = pick([8, 9, 9, 10, 10, 11, 14, 15, 16, 20, 20, 21, 21, 22]);
          const m = between(0, 59);
          const id = addTask({ ...base, status: 'done', actual_min: actual, completed_at: at(d, h, m), done_date: d });
          const startH = Math.max(6, h - Math.ceil(actual / 60));
          insFocus.run(id, at(d, startH, m), at(d, h, m), actual);
          insEvent.run(id, 'started', at(d, startH, m), null);
          insEvent.run(id, 'done', at(d, h, m), null);
        } else if (back <= 1 && i === capacityDone) {
          // vài việc của hôm qua chưa đánh dấu → hiện thẻ "Hôm qua còn N việc"
          const id = addTask({ ...base, status: 'unconfirmed' });
          insEvent.run(id, 'unconfirmed', at(td, 6, 0), null);
        } else if (rand() < 0.45) {
          const friction = rand() < 0.6 ? pick(['qua_lon', 'chua_ro', 'khong_quan_trong']) : null;
          const id = addTask({ ...base, status: 'let_go', friction_reason: friction, postpone_count: friction ? between(2, 4) : 0 });
          insEvent.run(id, 'let_go', at(d, 21, between(0, 50)), null);
        } else {
          // bị dời sang ngày khác rồi làm xong muộn
          const cand = addDays(d, between(1, 3));
          const moved = cand < td ? cand : d;
          const actual = Math.round(est * TRUE_RATIO[tag]);
          const id = addTask({ ...base, due_date: moved, postpone_count: moved > d ? 1 : 0, status: 'done',
            actual_min: actual, completed_at: at(moved, 20, between(0, 59)), done_date: moved });
          if (moved > d) insEvent.run(id, 'postponed', at(d, 21, 30), JSON.stringify({ from: d, to: moved }));
          insEvent.run(id, 'done', at(moved, 20, 30), null);
          insFocus.run(id, at(moved, 19, 0), at(moved, 20, 30), actual);
        }
        count++;
      }
    }

    // ---------- Việc lặp lại (đã có tiến độ trong tuần) ----------
    const monday = mondayOf(td);
    const runId = addTask({ title: 'Đi bộ 20 phút sau bữa tối', tag: 'sức-khoẻ', estimate_min: 20, energy: 'nhe',
      due_date: td, due_time: '19:30', recurrence: 'daily', reserve: 2 });
    db.prepare('UPDATE tasks SET series_id = ? WHERE id = ?').run(runId, runId);
    for (let d = monday; d < td; d = addDays(d, 1)) {
      if (rand() < 0.75) {
        const id = addTask({ title: 'Đi bộ 20 phút sau bữa tối', tag: 'sức-khoẻ', estimate_min: 20, energy: 'nhe',
          due_date: d, recurrence: 'daily', series_id: runId, status: 'done', actual_min: 22,
          completed_at: at(d, 20, 5), done_date: d });
        insEvent.run(id, 'done', at(d, 20, 5), null);
      }
    }
    const plantId = addTask({ title: 'Tưới cây ngoài ban công', tag: 'nhà', estimate_min: 10, energy: 'nhe',
      due_date: addDays(td, 1), recurrence: 'after_n_days', recur_n: 3 });
    db.prepare('UPDATE tasks SET series_id = ? WHERE id = ?').run(plantId, plantId);

    // ---------- Hôm nay ----------
    const big = addTask({ title: 'Viết phần Phân tích dữ liệu cho tiểu luận', tag: 'học', estimate_min: 75, priority: 'cao',
      due_date: td, due_time: '14:00', if_then_plan: 'Ăn trưa xong, ngồi thư viện tầng 3 làm 45 phút đầu' });
    insSub.run(big, 'Xuất bảng kết quả phân cụm', 1);
    insSub.run(big, 'Viết nhận xét cho từng cụm', 0);
    insSub.run(big, 'Chèn biểu đồ và chú thích', 0);
    addTask({ title: 'Trả lời email của nhóm', tag: 'việc', estimate_min: 10, energy: 'nhe', due_date: td, due_time: '09:00' });
    addTask({ title: 'Ôn từ vựng IELTS', tag: 'học', estimate_min: 20, energy: 'nhe', due_date: td });
    const stuck = addTask({ title: 'Dọn lại tủ quần áo', tag: 'nhà', estimate_min: 45, due_date: td, postpone_count: 3,
      priority: 'thap', created_at: at(addDays(td, -9), 8, 0) });
    for (let k = 3; k >= 1; k--) insEvent.run(stuck, 'postponed', at(addDays(td, -k * 2), 21, 0), null);
    addTask({ title: 'Đọc thêm 1 chương sách kỹ năng', tag: 'học', estimate_min: 40, due_date: td, lane: 'neu_con_suc', priority: 'thap' });
    const doneToday = addTask({ title: 'Làm quiz trên LMS', tag: 'học', estimate_min: 15, energy: 'nhe', due_date: td,
      status: 'done', actual_min: 18, completed_at: at(td, 8, 20), done_date: td });
    insEvent.run(doneToday, 'done', at(td, 8, 20), null);

    // ---------- 7 ngày tới (có đủ 3 mức cảnh báo hạn) ----------
    addTask({ title: 'Hoàn thiện báo cáo đồ án cuối kỳ', tag: 'học', estimate_min: 180, priority: 'cao', due_date: addDays(td, 2),
      note: 'Gồm phần 3, 4 và kết luận. Gửi nhóm đọc lại trước khi nộp.' });
    addTask({ title: 'Chuẩn bị slide thuyết trình PTUDTMDT', tag: 'học', estimate_min: 90, priority: 'cao', due_date: addDays(td, 1) });
    addTask({ title: 'Ôn tập giữa kỳ Quản lý dự án', tag: 'học', estimate_min: 180, due_date: addDays(td, 5) });
    addTask({ title: 'Đi chợ mua đồ cho tuần', tag: 'nhà', estimate_min: 60, due_date: nextSat(td) });
    addTask({ title: 'Họp nhóm đồ án', tag: 'việc', estimate_min: 45, due_date: addDays(td, 6), due_time: '19:00' });
    addTask({ title: 'Kiểm tra số liệu báo cáo tháng', tag: 'việc', estimate_min: 60, due_date: addDays(td, 4) });
    addTask({ title: 'Trả tiền điện nước', tag: 'nhà', estimate_min: 10, energy: 'nhe', due_date: addDays(td, 6) });

    // ---------- Chưa xếp ngày ----------
    addTask({ title: 'Tìm hiểu khoá học thiết kế UI', tag: 'học', estimate_min: 30, priority: 'thap' });
    addTask({ title: 'Lên danh sách quà sinh nhật mẹ', estimate_min: 20, energy: 'nhe' });

    const n = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
    return { ok: true, tasks: n, checkins: db.prepare('SELECT COUNT(*) AS n FROM daily_checkins').get().n };
  });

  function nextSat(d) { const wd = weekday(d); return addDays(d, wd === 6 ? 7 : 6 - wd || 7); }
}

module.exports = { seed, reset };

// Chạy trực tiếp: npm run seed
if (require.main === module) {
  console.log(seed());
}
