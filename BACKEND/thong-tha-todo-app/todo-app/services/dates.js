// Xử lý ngày giờ theo múi giờ Việt Nam.
// KHÔNG dùng toISOString() để lấy ngày vì nó trả về giờ UTC → lệch ngày sau 17h.

const TZ = 'Asia/Ho_Chi_Minh';

// Trả về 'YYYY-MM-DD' của một thời điểm theo giờ Việt Nam
function ymdOf(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Giờ hiện tại theo giờ Việt Nam (0–23)
function hourOf(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(date));
}

// Thời điểm hiện tại dạng 'YYYY-MM-DD HH:MM:SS' giờ Việt Nam (lưu vào DB, dễ đọc)
function nowStamp(date = new Date()) {
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(date);
  return `${ymdOf(date)} ${t}`;
}

// Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD' (tính bằng UTC thuần để không bị ảnh hưởng múi giờ)
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10); // an toàn vì dt là nửa đêm UTC
}

// Số ngày từ a đến b (b - a)
function diffDays(a, b) {
  const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

// Thứ trong tuần của 'YYYY-MM-DD': 0 = Chủ nhật … 6 = Thứ bảy
function weekday(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Thứ hai của tuần chứa ngày ymd
function mondayOf(ymd) {
  const wd = weekday(ymd);
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

// Thứ bảy gần nhất sắp tới (nếu hôm nay là thứ bảy/chủ nhật thì lấy hôm nay)
function nextWeekend(ymd) {
  const wd = weekday(ymd);
  if (wd === 6 || wd === 0) return ymd;
  return addDays(ymd, 6 - wd);
}

function isValidYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

module.exports = { TZ, ymdOf, hourOf, nowStamp, addDays, diffDays, weekday, mondayOf, nextWeekend, isValidYmd };
