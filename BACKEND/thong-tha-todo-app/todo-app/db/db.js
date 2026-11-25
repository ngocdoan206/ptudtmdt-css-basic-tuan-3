// Kết nối SQLite bằng module có sẵn của Node (node:sqlite) – không cần cài thư viện native.
const fs = require('fs');
const path = require('path');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('\n[Thong Thả] Phiên bản Node.js hiện tại chưa hỗ trợ node:sqlite.');
  console.error('Hãy cài Node.js 22.13 trở lên (khuyên dùng bản LTS mới nhất tại https://nodejs.org).\n');
  process.exit(1);
}

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'thongtha.db');
if (DB_FILE !== ':memory:') fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Cài đặt mặc định
const DEFAULT_SETTINGS = {
  daily_capacity_min: '240',
  close_day_time: '21:00',
  mood_checkin_enabled: '1'
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

// Chạy nhiều câu lệnh trong một transaction (lỗi thì huỷ toàn bộ)
function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return {
    daily_capacity_min: Number(s.daily_capacity_min),
    close_day_time: s.close_day_time,
    mood_checkin_enabled: s.mood_checkin_enabled === '1'
  };
}

module.exports = { db, tx, getSettings, DB_FILE };
