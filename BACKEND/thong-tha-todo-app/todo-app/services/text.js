// Bỏ dấu tiếng Việt để tìm kiếm "bao cao" vẫn ra "báo cáo"
function stripVN(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

module.exports = { stripVN };
