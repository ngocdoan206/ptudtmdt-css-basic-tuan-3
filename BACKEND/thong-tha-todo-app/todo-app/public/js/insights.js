// Trang Hiểu mình: thống kê hành vi dạng "tấm gương"
renderTopbar('insights');
const $ = s => document.querySelector(s);
const C = { primary: '#0F6157', sun: '#F7C948', rose: '#D97A9C', ink: '#1D2A2C', muted: '#55666A', grid: '#E4DDD0' };
const charts = {};
let range = 7;

if (window.Chart) {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = C.muted;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
}

function drawChart(id, config) {
  if (!window.Chart) return;
  charts[id]?.destroy();
  config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: C.grid }, ticks: { precision: 0 } } } }, config.options || {});
  charts[id] = new Chart(document.getElementById(id), config);
}

const kpi = (v, l) => el('div', { class: 'card kpi' }, el('div', { class: 'v' }, v), el('div', { class: 'l' }, l));
const section = (id, title, ...nodes) => $(id).replaceChildren(el('h2', {}, title), ...nodes);
const table = (head, rows) => el('table', { class: 'mirror-table' },
  el('thead', {}, el('tr', {}, head.map(h => el('th', { scope: 'col' }, h)))),
  el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => el('td', {}, c))))));

async function load() {
  try {
    const plan = await api('GET', '/api/today-plan'); TODAY = plan.date;
    const d = await api('GET', `/api/insights?range=${range}`);

    $('#kpis').replaceChildren(
      kpi(d.totals.done, `việc đã xong trong ${range} ngày`),
      kpi(d.totals.letGo, 'việc đã buông có chủ đích'),
      kpi(d.totals.ratioSamples >= 5 ? `×${fmtNum(d.totals.ratio)}` : '—', 'hệ số trễ chung (thực tế / dự tính)'),
      kpi(d.totals.checkins, 'lần check-in tâm trạng'));

    drawChart('c-days', { type: 'bar', data: {
      labels: d.doneByDay.map(x => { const t = ymdToDate(x.date); return `${t.getUTCDate()}/${t.getUTCMonth() + 1}`; }),
      datasets: [{ label: 'Việc xong', data: d.doneByDay.map(x => x.n), backgroundColor: C.primary, borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } } } });

    drawChart('c-mood', { type: 'bar', data: {
      labels: d.byMood.map(x => `${x.icon} (${x.days} ngày)`),
      datasets: [
        { label: 'Đã xếp', data: d.byMood.map(x => x.avgPlanned), backgroundColor: C.sun, borderColor: C.ink, borderWidth: 1, borderRadius: 6 },
        { label: 'Đã xong', data: d.byMood.map(x => x.avgDone), backgroundColor: C.primary, borderRadius: 6 }] },
      options: { scales: { y: { beginAtZero: true, grid: { color: C.grid } }, x: { grid: { display: false } } } } });

    drawChart('c-tag', { type: 'bar', data: {
      labels: d.byTag.map(x => '#' + x.tag),
      datasets: [{ label: 'Việc xong', data: d.byTag.map(x => x.n), backgroundColor: C.primary, borderRadius: 6 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: C.grid }, ticks: { precision: 0 } }, y: { grid: { display: false } } } } });

    const best = d.hours.indexOf(Math.max(...d.hours));
    drawChart('c-hour', { type: 'bar', data: {
      labels: d.hours.map((_, h) => `${h}h`),
      datasets: [{ label: 'Việc xong', data: d.hours, backgroundColor: d.hours.map((_, h) => h === best ? C.sun : C.primary), borderColor: d.hours.map((_, h) => h === best ? C.ink : C.primary), borderWidth: 1, borderRadius: 4 }] },
      options: { plugins: { legend: { display: false }, subtitle: { display: Math.max(...d.hours) > 0, text: `Giờ bạn hoàn thành nhiều việc nhất: khoảng ${best}h`, color: C.ink, padding: { bottom: 8 } } } } });

    const prioOrder = ['cao', 'vua', 'thap'];
    drawChart('c-prio', { type: 'doughnut', data: {
      labels: prioOrder.map(p => PRIORITY_LABEL[p]),
      datasets: [{ data: prioOrder.map(p => (d.byPriority.find(x => x.priority === p) || {}).n || 0), backgroundColor: [C.ink, C.primary, C.sun], borderColor: '#fff', borderWidth: 2 }] },
      options: { scales: {}, plugins: { legend: { position: 'bottom' } } } });

    // Hệ số trễ theo nhãn
    section('#ratios', 'Bạn thường mất bao lâu so với dự tính?',
      d.ratios.length ? table(['Nhãn', 'Hệ số', 'Diễn giải'], d.ratios.map(r => [
        '#' + r.tag, `×${fmtNum(r.ratio)}`,
        r.ratio >= 1.1 ? `việc 60 phút thường mất ~${Math.round(60 * r.ratio)} phút` : r.ratio <= 0.9 ? 'thường xong sớm hơn dự tính' : 'ước lượng khá sát'])) :
        el('p', { class: 'muted' }, 'Chưa đủ dữ liệu. Hãy dùng nút Bắt đầu/Dừng khi làm việc.'),
      el('p', { class: 'small muted' }, 'Ước lượng thiếu thời gian là hiện tượng rất phổ biến (planning fallacy). App dùng hệ số này để tính sức chứa và cảnh báo hạn sát với thực tế của bạn.'));

    // Năng lượng
    const eLabel = { thap: 'Thấp', vua: 'Vừa', cao: 'Cao' };
    section('#energy', 'Năng lượng và tỉ lệ hoàn thành',
      d.byEnergy.length ? table(['Năng lượng', 'Số ngày', 'TB đã xếp', 'TB đã xong', 'Tỉ lệ xong'],
        ['thap', 'vua', 'cao'].map(k => d.byEnergy.find(x => x.key === k)).filter(Boolean)
          .map(x => [eLabel[x.key], x.days, fmtNum(x.avgPlanned), fmtNum(x.avgDone), `${x.rate}%`])) :
        el('p', { class: 'muted' }, 'Chưa có check-in nào trong khoảng này.'));

    // Ngày quá tải
    section('#overload', 'Những ngày xếp quá sức',
      d.overload.length ? table(['Ngày', 'Đã xếp (thực tế)', 'Sức chứa'], d.overload.slice(-8).reverse().map(x => [fmtDay(x.date), fmtMin(x.planned), fmtMin(x.capacity)])) :
        el('p', { class: 'muted' }, 'Không có ngày nào xếp vượt sức chứa. 👍'),
      d.overload.length ? el('p', { class: 'small muted' }, `${d.overload.length}/${range} ngày bị xếp quá tải. Ta thường nghĩ tương lai rảnh hơn hiện tại, nên dễ nhận thêm việc.`) : null);

    // Việc hay bị dời
    section('#postponed', 'Việc hay bị dời và lý do vướng',
      d.postponedByTag.length ? table(['Nhãn', 'Số lần dời'], d.postponedByTag.map(x => ['#' + x.tag, x.n])) : el('p', { class: 'muted' }, 'Chưa có việc nào bị dời.'),
      d.friction.length ? el('p', { style: 'margin-top:10px' }, 'Lý do bạn đã chọn: ', d.friction.map(f => `${FRICTION_LABEL[f.reason]} (${f.n})`).join(' · ')) : null,
      el('p', { class: 'small muted' }, 'Việc bị dời nhiều lần thường do quá lớn, chưa rõ cách làm hoặc gây khó chịu, chứ không phải do lười.'));

    // Việc lặp lại
    section('#recurring', 'Việc lặp lại tuần này',
      d.recurring.length ? el('div', { class: 'stack', style: 'gap:8px' }, d.recurring.map(r =>
        el('div', {}, el('b', {}, r.title), el('br'), el('span', { class: 'chip progress' }, r.progress.label + (r.progress.reserve ? ` · mục tiêu ${r.progress.target} ngày, ${r.progress.reserve} ngày dự phòng` : ''))))) :
        el('p', { class: 'muted' }, 'Chưa có việc lặp lại.'),
      el('p', { class: 'small muted' }, 'Đếm theo tuần thay vì chuỗi ngày liên tiếp: bỏ lỡ một ngày không làm mất hết công sức.'));
  } catch (e) { showError(e); }
}

document.querySelectorAll('#range button').forEach(b => b.addEventListener('click', () => {
  range = Number(b.dataset.range);
  document.querySelectorAll('#range button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  load();
}));

$('#seed-btn').addEventListener('click', () => {
  const dlg = openDialog('Nạp dữ liệu mẫu?', [el('p', {}, 'Toàn bộ dữ liệu hiện tại sẽ được thay bằng dữ liệu giả lập ~30 ngày.')], [
    el('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Huỷ'),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      try { const r = await api('POST', '/api/seed'); dlg.close(); toast(`Đã nạp ${r.tasks} việc và ${r.checkins} lần check-in.`); load(); } catch (e) { showError(e); }
    } }, 'Nạp dữ liệu')]);
});
$('#reset-btn').addEventListener('click', () => {
  const dlg = openDialog('Xoá sạch dữ liệu?', [el('p', {}, 'Mọi việc, check-in và lịch sử sẽ bị xoá vĩnh viễn. Không thể hoàn tác.')], [
    el('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Huỷ'),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      try { await api('POST', '/api/reset'); dlg.close(); toast('Đã xoá sạch dữ liệu.'); load(); } catch (e) { showError(e); }
    } }, 'Xoá sạch')]);
});

load();
