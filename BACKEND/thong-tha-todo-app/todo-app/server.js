// Thong Thả – máy chủ Express
const express = require('express');
const path = require('path');
const { db } = require('./db/db');
const { router: taskRouter } = require('./routes/tasks');
const { router: planRouter } = require('./routes/plan');

const app = express();
app.use(express.json({ limit: '100kb' }));

// Các header bảo mật cơ bản
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api/tasks', taskRouter);
app.use('/api', planRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy API này.' }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Lỗi không lường trước: trả thông báo gọn, ghi chi tiết ra terminal
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
  res.status(500).json({ error: 'Có lỗi xảy ra phía máy chủ. Vui lòng thử lại.' });
});

const PORT = Number(process.env.PORT) || 3000;

// Lần chạy đầu tiên (database trống) → tự nạp dữ liệu mẫu để demo ngay
if (db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n === 0 && process.env.NO_SEED !== '1') {
  const r = require('./db/seed').seed();
  console.log(`Đã nạp dữ liệu mẫu: ${r.tasks} việc, ${r.checkins} lần check-in.`);
}

app.listen(PORT, () => {
  console.log(`Thong Thả đang chạy tại http://localhost:${PORT}`);
});
