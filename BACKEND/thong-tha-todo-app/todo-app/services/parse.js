// Phân tích câu "thêm nhanh" tiếng Việt thành một task.
// Ví dụ: "nộp báo cáo mai 9h #học !cao 30p" →
//   { title: 'nộp báo cáo', due_date: <ngày mai>, due_time: '09:00', tag: 'học', priority: 'cao', estimate_min: 30 }
//
// Quy ước (để không nhầm giờ với thời lượng):
//   Giờ:       9h, 14h30, 9:15        → due_time
//   Thời lượng: 30p, 45ph, 90phut, 1h30p, 2tieng / 2 tiếng → estimate_min
//   Ngày:      hôm nay, mai / ngày mai, ngày kia, thứ 2..thứ 7 (t2..t7), chủ nhật / cn, dd/mm, dd/mm/yyyy
//   Nhãn: #ten-nhan   Ưu tiên: !cao !vua !thap   Việc nhẹ đầu: ~nhe

const { addDays, weekday, isValidYmd } = require('./dates');
const { stripVN } = require('./text');

function parseQuickAdd(text, today) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const norm = words.map(w => stripVN(w));
  const used = new Array(words.length).fill(false);
  const out = {};

  const mark = (...idx) => idx.forEach(i => { used[i] = true; });

  // Ngày thứ wd (0 = CN) gần nhất tính từ hôm nay (bao gồm hôm nay)
  const nextWeekday = wd => {
    const delta = (wd - weekday(today) + 7) % 7;
    return addDays(today, delta);
  };

  for (let i = 0; i < words.length; i++) {
    if (used[i]) continue;
    const w = norm[i];
    const next = norm[i + 1];

    // --- Cụm 2 từ ---
    if (w === 'hom' && next === 'nay') { out.due_date = today; mark(i, i + 1); continue; }
    if (w === 'ngay' && next === 'mai') { out.due_date = addDays(today, 1); mark(i, i + 1); continue; }
    if (w === 'ngay' && next === 'kia') { out.due_date = addDays(today, 2); mark(i, i + 1); continue; }
    if (w === 'chu' && next === 'nhat') { out.due_date = nextWeekday(0); mark(i, i + 1); continue; }
    if (w === 'thu' && /^[2-7]$/.test(next || '')) { out.due_date = nextWeekday(Number(next) - 1); mark(i, i + 1); continue; }
    if (/^\d+(\.\d+)?$/.test(w) && (next === 'tieng' || next === 'phut' || next === 'p')) {
      out.estimate_min = Math.round(Number(w) * (next === 'tieng' ? 60 : 1)); mark(i, i + 1); continue;
    }

    // --- Một từ ---
    if (w === 'mai') { out.due_date = addDays(today, 1); mark(i); continue; }
    if (w === 'cn') { out.due_date = nextWeekday(0); mark(i); continue; }
    let m;
    if ((m = w.match(/^t([2-7])$/))) { out.due_date = nextWeekday(Number(m[1]) - 1); mark(i); continue; }

    // dd/mm hoặc dd/mm/yyyy
    if ((m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/))) {
      const y0 = Number(today.slice(0, 4));
      const pad = n => String(n).padStart(2, '0');
      let ymd = `${m[3] || y0}-${pad(m[2])}-${pad(m[1])}`;
      if (!m[3] && ymd < today) ymd = `${y0 + 1}-${pad(m[2])}-${pad(m[1])}`; // đã qua thì hiểu là năm sau
      if (isValidYmd(ymd)) { out.due_date = ymd; mark(i); continue; }
    }

    // Thời lượng: 30p, 45ph, 90phut, 1h30p, 2tieng
    if ((m = w.match(/^(\d{1,3})(p|ph|phut)$/))) { out.estimate_min = Number(m[1]); mark(i); continue; }
    if ((m = w.match(/^(\d{1,2})h(\d{1,2})(p|ph|phut)$/))) { out.estimate_min = Number(m[1]) * 60 + Number(m[2]); mark(i); continue; }
    if ((m = w.match(/^(\d+(?:[.,]\d+)?)tieng$/))) { out.estimate_min = Math.round(Number(m[1].replace(',', '.')) * 60); mark(i); continue; }

    // Giờ: 9h, 14h30, 9:15
    if ((m = w.match(/^(\d{1,2})h(\d{2})?$/)) || (m = w.match(/^(\d{1,2}):(\d{2})$/))) {
      const h = Number(m[1]), mi = Number(m[2] || 0);
      if (h <= 23 && mi <= 59) {
        out.due_time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
        mark(i);
        if (i > 0 && !used[i - 1] && (norm[i - 1] === 'luc' || norm[i - 1] === 'vao')) mark(i - 1); // bỏ chữ "lúc"
        continue;
      }
    }

    // Nhãn, ưu tiên, năng lượng
    if (w.startsWith('#') && w.length > 1) { out.tag = words[i].slice(1).toLowerCase(); mark(i); continue; }
    if (w === '!cao' || w === '!vua' || w === '!thap') { out.priority = w.slice(1); mark(i); continue; }
    if (w === '~nhe') { out.energy = 'nhe'; mark(i); continue; }
  }

  out.title = words.filter((_, i) => !used[i]).join(' ').trim();
  return out;
}

module.exports = { parseQuickAdd };
