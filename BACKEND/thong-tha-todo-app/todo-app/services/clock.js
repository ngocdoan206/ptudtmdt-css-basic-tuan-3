// "Đồng hồ" của app. Cho phép giả lập ngày bằng biến môi trường FAKE_TODAY (dùng khi test/demo).
const { ymdOf, nowStamp } = require('./dates');

function today() {
  return process.env.FAKE_TODAY || ymdOf();
}

function stamp() {
  const s = nowStamp();
  return process.env.FAKE_TODAY ? `${process.env.FAKE_TODAY}${s.slice(10)}` : s;
}

module.exports = { today, stamp };
