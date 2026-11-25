// Trang Hôm nay
renderTopbar('today');

const $ = s => document.querySelector(s);
const MOODS = [[1, '😞', 'Rất tệ'], [2, '😕', 'Hơi buồn'], [3, '😐', 'Bình thường'], [4, '🙂', 'Vui'], [5, '😄', 'Rất vui']];
const ENERGY_LABEL = { thap: 'Năng lượng thấp', vua: 'Năng lượng vừa', cao: 'Năng lượng cao' };
let plan = null;
let todayTasks = [];
let filterMode = 'all';
let modalShown = false;

// Video: tôn trọng chế độ giảm chuyển động
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { const v = $('#hero-video'); v.removeAttribute('autoplay'); v.pause(); }

// ---------- Tải dữ liệu ----------
async function load() {
  try {
    const [p, tasks, upcoming] = await Promise.all([
      api('GET', '/api/today-plan'),
      api('GET', '/api/tasks?view=today'),
      api('GET', '/api/tasks?view=upcoming')
    ]);
    plan = p; TODAY = p.date; todayTasks = tasks;
    renderHero();
    await renderNotices();
    renderCapacity();
    renderLists();
    renderUpcoming(upcoming);
    renderCloseDay();
    maybeOpenModals();
  } catch (e) {
    $('#main-list').replaceChildren(emptyState('🔌', e.message));
    showError(e);
  }
}
const refresh = () => load();

// ---------- Banner ----------
function renderHero() {
  const h = new Date().getHours();
  $('#hello').textContent = h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  $('#today-label').textContent = fmtDay(plan.date, { long: true }).replace('Hôm nay, ', `${WEEKDAYS[ymdToDate(plan.date).getUTCDay()]}, `);
  const chips = [];
  if (plan.checkin) {
    const m = MOODS.find(x => x[0] === plan.checkin.mood);
    chips.push(el('button', { class: 'chip-dark', type: 'button', onclick: openCheckin, 'aria-label': 'Sửa check-in hôm nay' },
      `${m[1]} ${m[2]} · ${ENERGY_LABEL[plan.checkin.energy]} · ${fmtMin(plan.capacity.available)} trống`));
  } else if (plan.settings.mood_checkin_enabled) {
    chips.push(el('button', { class: 'chip-dark', type: 'button', onclick: openCheckin }, 'Check-in 10 giây →'));
  }
  chips.push(el('span', { class: 'chip-dark' }, `${plan.counts.done} xong · ${plan.counts.todo} còn lại`));
  $('#hero-chips').replaceChildren(...chips);
}

// ---------- Thông báo ----------
async function renderNotices() {
  const box = $('#notices');
  const items = [];

  // Hôm qua còn việc chưa đánh dấu → thẻ gộp, không phán xét
  if (plan.unconfirmed > 0) {
    const list = await api('GET', '/api/tasks?view=unconfirmed');
    const ids = list.map(t => t.id);
    const rows = el('ul', { class: 'subtasks', style: 'margin-top:8px' }, list.slice(0, 6).map(t =>
      el('li', { style: 'flex-wrap:wrap' },
        el('span', { style: 'flex:1;min-width:160px' }, `${t.title} `, el('span', { class: 'muted small' }, `(${fmtDay(t.due_date).toLowerCase()})`)),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(Tasks.complete(t.id, t.due_date), 'Đã ghi nhận là đã làm.') }, 'Đã làm'),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(Tasks.postpone(t.id, 'today'), 'Đã đưa vào hôm nay.') }, 'Làm hôm nay'),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(Tasks.letGo(t.id), 'Đã buông.') }, 'Buông'))));
    items.push(el('div', { class: 'notice rose', role: 'region', 'aria-label': 'Việc chưa đánh dấu' },
      el('span', { class: 'ico', 'aria-hidden': 'true' }, '🌱'),
      el('div', { style: 'flex:1' },
        el('p', {}, el('b', {}, `Còn ${plan.unconfirmed} việc của mấy hôm trước chưa đánh dấu. `),
          'Không như dự tính là chuyện bình thường. Việc nào đã làm thì ghi nhận, việc nào cần thì đưa vào hôm nay.'),
        rows,
        list.length > 6 ? el('p', { class: 'small' }, `…và ${list.length - 6} việc khác.`) : null,
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(api('POST', '/api/tasks/bulk', { ids, action: 'complete' }), 'Đã ghi nhận tất cả.') }, 'Tất cả đã làm'),
          el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(api('POST', '/api/tasks/bulk', { ids, action: 'postpone', to: 'today' }), 'Đã đưa tất cả vào hôm nay.') }, 'Đưa hết vào hôm nay'),
          el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(api('POST', '/api/tasks/bulk', { ids, action: 'let_go' }), 'Đã buông tất cả.') }, 'Buông hết')))));
  }

  // Tâm trạng/năng lượng thấp → việc khởi động
  if (plan.starter) {
    const s = plan.starter;
    items.push(el('div', { class: 'notice mint' },
      el('span', { class: 'ico', 'aria-hidden': 'true' }, '🌤️'),
      el('div', {},
        el('p', {}, el('b', {}, 'Bắt đầu nhẹ thôi: '), `"${s.title}"`, s.estimate_min ? ` (~${fmtMin(s.estimate_min)})` : '',
          '. Một việc nhỏ xong trước giúp lấy đà cho cả ngày.'),
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => act(Tasks.start(s.id), 'Bắt đầu nào. Cứ từ từ.') }, 'Bắt đầu việc này')))));
  }

  // Tấm gương dữ liệu: chỉ nói sự thật, không khuyên răn
  if (plan.mirror && plan.mirror.ready && plan.mirror.sentence) {
    items.push(el('div', { class: 'notice sun' },
      el('span', { class: 'ico', 'aria-hidden': 'true' }, '🪞'),
      el('div', {}, el('p', {}, plan.mirror.sentence),
        el('p', { class: 'small', style: 'margin-top:4px' }, 'Đây là dữ liệu của chính bạn. ', el('a', { href: '/insights' }, 'Xem thêm ở Hiểu mình')))));
  } else if (plan.mirror && !plan.mirror.ready) {
    items.push(el('div', { class: 'notice' },
      el('span', { class: 'ico', 'aria-hidden': 'true' }, '🪞'),
      el('p', { class: 'small muted' }, `Sau ${plan.mirror.need} lần check-in, app sẽ cho bạn thấy tâm trạng ảnh hưởng thế nào tới số việc bạn xếp và làm xong (hiện có ${plan.mirror.have}).`)));
  }
  box.replaceChildren(...items);
}

async function act(promise, msg) {
  try { await promise; toast(msg); refresh(); } catch (e) { showError(e); }
}

// ---------- Sức chứa ----------
function renderCapacity() {
  const c = plan.capacity;
  const used = c.plannedMain;
  const pct = Math.min(100, Math.round((used / Math.max(1, c.suggested)) * 100));
  const over = used - c.suggested;
  const bar = el('div', { class: 'bar', role: 'img', 'aria-label': `Đã xếp ${used} trên ${c.suggested} phút` },
    el('div', { class: 'fill' + (over > 0 ? ' over' : ''), style: `width:${pct}%` }));
  const ratioText = c.ratioSamples >= 5
    ? `Từ ${c.ratioSamples} việc đã làm, bạn thường mất gấp ${fmtNum(c.ratio)} lần thời gian dự tính, nên ${fmtMin(c.available)} trống ≈ ${fmtMin(c.suggested)} làm được thật.`
    : 'Khi bạn dùng nút Bắt đầu/Dừng, app sẽ học tốc độ thật của bạn để ước lượng sát hơn.';
  const nodes = [
    el('h2', { id: 'cap-title' }, 'Sức chứa hôm nay'),
    el('div', { class: 'legend' },
      el('div', {}, el('span', { class: 'big' }, fmtMin(used)), el('span', { class: 'muted' }, ` / ${fmtMin(c.suggested)} đã xếp`)),
      c.plannedBonus ? el('span', { class: 'chip lane' }, `+ ${fmtMin(c.plannedBonus)} "nếu còn sức"`) : null),
    bar,
    el('p', { class: 'small muted', style: 'margin:0' }, ratioText)
  ];
  if (over > 15) {
    const candidate = todayTasks.filter(t => t.status === 'todo' && t.lane === 'chinh')
      .sort((a, b) => ({ thap: 0, vua: 1, cao: 2 }[a.priority] - { thap: 0, vua: 1, cao: 2 }[b.priority]) || b.realistic_min - a.realistic_min)[0];
    nodes.push(el('div', { class: 'nudge' },
      `Hôm nay đang xếp nhiều hơn sức chứa khoảng ${fmtMin(over)}. Lúc lên kế hoạch ta hay lạc quan hơn thực tế, nên bớt một chút sẽ dễ thở hơn.`,
      candidate ? el('div', { class: 'row' },
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(api('PUT', `/api/tasks/${candidate.id}`, { lane: 'neu_con_suc' }), 'Đã chuyển sang "Nếu còn sức".') }, `Chuyển "${candidate.title}" sang Nếu còn sức`),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(Tasks.postpone(candidate.id, 'tomorrow'), 'Đã dời sang ngày mai.') }, 'Dời việc đó sang mai')) : null));
  }
  $('#capacity').replaceChildren(...nodes);
}

// ---------- Danh sách ----------
function renderLists() {
  const opts = { refresh, onEdit: t => openTaskForm(t, { onSaved: refresh }), compact: true };
  let main = todayTasks.filter(t => t.status === 'todo' && t.lane === 'chinh');
  const bonus = todayTasks.filter(t => t.status === 'todo' && t.lane === 'neu_con_suc');
  const done = todayTasks.filter(t => t.status === 'done');

  // Việc khởi động lên đầu
  if (plan.starter) main.sort((a, b) => (b.id === plan.starter.id) - (a.id === plan.starter.id));
  if (filterMode === 'fits') main = [...main, ...bonus].filter(t => (t.estimate_min || 30) <= 15);
  if (filterMode === 'tired') main = [...main, ...bonus].filter(t => t.energy === 'nhe');

  const mainList = $('#main-list');
  if (!main.length) {
    const msg = filterMode === 'fits' ? ['⏱️', 'Không có việc nào vừa 15 phút. Thử chia nhỏ một việc lớn?']
      : filterMode === 'tired' ? ['🛋️', 'Chưa có việc "nhẹ đầu" nào. Nghỉ ngơi cũng là một lựa chọn tốt.']
      : todayTasks.length ? ['🎉', 'Xong hết việc chính rồi! Xem phần "Nếu còn sức" nếu muốn làm thêm.']
      : ['☕', 'Hôm nay chưa có việc nào. Gõ vào ô phía trên để thêm.'];
    mainList.replaceChildren(emptyState(...msg));
  } else mainList.replaceChildren(...main.map(t => renderTask(t, opts)));

  $('#bonus-list').replaceChildren(...(bonus.length ? bonus.map(t => renderTask(t, { ...opts, side: true })) : [el('p', { class: 'small muted' }, 'Trống. Việc thêm vượt sức chứa sẽ được gợi ý vào đây.')]));
  $('#done-list').replaceChildren(...done.map(t => renderTask(t, opts)));
  $('#done-wrap').querySelector('summary').textContent = `Đã xong hôm nay (${done.length})`;
  $('#done-wrap').style.display = done.length ? '' : 'none';
}

function renderUpcoming(list) {
  const flagged = list.filter(t => t.warning).slice(0, 5);
  const box = $('#up-list');
  if (!flagged.length) { box.replaceChildren(el('p', { class: 'small muted' }, 'Mọi việc sắp tới đều trong tầm tay. 👍')); return; }
  box.replaceChildren(...flagged.map(t => renderTask(t, { refresh, onEdit: x => openTaskForm(x, { onSaved: refresh }), compact: true, side: true })));
}

document.querySelectorAll('.segmented button').forEach(b => b.addEventListener('click', () => {
  filterMode = b.dataset.mode;
  document.querySelectorAll('.segmented button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderLists();
}));

// ---------- Thêm nhanh ----------
let parseTimer, lastParsed = null;
$('#quick-input').addEventListener('input', () => {
  clearTimeout(parseTimer);
  const text = $('#quick-input').value;
  if (!text.trim()) { $('#parse-preview').replaceChildren(); lastParsed = null; return; }
  parseTimer = setTimeout(async () => {
    try {
      const p = await api('POST', '/api/parse', { text });
      lastParsed = p;
      const chips = [el('span', { class: 'chip' }, p.title)];
      chips.push(el('span', { class: 'chip' }, p.due_date ? fmtDay(p.due_date) : 'Hôm nay'));
      if (p.due_time) chips.push(el('span', { class: 'chip' }, p.due_time));
      if (p.estimate_min) chips.push(el('span', { class: 'chip' }, fmtMin(p.estimate_min)));
      if (p.tag) chips.push(el('span', { class: 'chip' }, '#' + p.tag));
      if (p.priority) chips.push(el('span', { class: 'chip' }, PRIORITY_LABEL[p.priority]));
      if (p.energy === 'nhe') chips.push(el('span', { class: 'chip' }, 'Nhẹ đầu'));
      $('#parse-preview').replaceChildren(...chips);
    } catch { $('#parse-preview').replaceChildren(); lastParsed = null; }
  }, 250);
});

$('#quick-form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('#quick-input').value.trim();
  if (!text) { $('#quick-input').focus(); return; }
  try {
    const p = lastParsed && text ? await api('POST', '/api/parse', { text }) : await api('POST', '/api/parse', { text });
    const data = { ...p, due_date: p.due_date || plan.date };
    // Vượt sức chứa hôm nay → đề xuất vào làn "Nếu còn sức" (người dùng có thể giữ lại làn chính)
    let toBonus = false;
    if (data.due_date === plan.date) {
      const realistic = Math.round((data.estimate_min || 30) * plan.capacity.ratio);
      toBonus = plan.capacity.plannedMain + realistic > plan.capacity.suggested;
      if (toBonus) data.lane = 'neu_con_suc';
    }
    const t = await api('POST', '/api/tasks', data);
    $('#quick-input').value = ''; $('#parse-preview').replaceChildren(); lastParsed = null;
    if (toBonus) {
      toast('Hôm nay đã gần đủ sức chứa, mình đặt việc này vào "Nếu còn sức".', {
        actionText: 'Giữ ở việc chính', timeout: 7000,
        onAction: async () => { await api('PUT', `/api/tasks/${t.id}`, { lane: 'chinh' }); refresh(); }
      });
    } else toast(`Đã thêm cho ${fmtDay(t.due_date).toLowerCase()}.`);
    refresh();
  } catch (err) { showError(err); }
});

$('#detail-add').addEventListener('click', () => openTaskForm(null, { defaults: { due_date: plan?.date }, onSaved: refresh }));

// ---------- Check-in ----------
function openCheckin() {
  let mood = plan.checkin?.mood || null;
  let energy = plan.checkin?.energy || null;
  const err = el('div', { class: 'error', role: 'alert' });
  const moodRow = el('div', { class: 'mood-row', role: 'group', 'aria-label': 'Tâm trạng' }, MOODS.map(([v, e, l]) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(mood === v), 'aria-label': l }, e, el('span', {}, l));
    b.addEventListener('click', () => { mood = v; moodRow.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    return b;
  }));
  const energyRow = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Năng lượng' }, [['thap', 'Thấp'], ['vua', 'Vừa'], ['cao', 'Cao']].map(([v, l]) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(energy === v) }, l);
    b.addEventListener('click', () => { energy = v; energyRow.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    return b;
  }));
  const avail = el('select', { id: 'ci-avail' }, Array.from({ length: 16 }, (_, i) => (i + 1) * 30).map(m => el('option', { value: m }, fmtMin(m))));
  avail.value = String(plan.checkin?.available_min || Math.round(plan.settings.daily_capacity_min / 30) * 30);

  const save = el('button', { class: 'btn btn-primary', type: 'button' }, 'Lưu');
  const dlg = openDialog('Hôm nay bạn thế nào?', [
    err,
    el('div', { class: 'field' }, el('label', {}, 'Tâm trạng'), moodRow),
    el('div', { class: 'field' }, el('label', {}, 'Năng lượng'), energyRow),
    el('div', { class: 'field' }, el('label', { for: 'ci-avail' }, 'Hôm nay bạn có khoảng bao nhiêu thời gian trống cho việc riêng?'), avail),
    el('p', { class: 'small muted' }, 'App dùng câu trả lời để gợi ý số việc vừa sức. Dữ liệu tâm trạng chỉ lưu trên máy này, có thể tắt trong Cài đặt. App không chẩn đoán sức khoẻ tinh thần.')
  ], [
    el('button', { class: 'btn', type: 'button', onclick: () => { try { localStorage.setItem('skip-checkin', plan.date); } catch {} dlg.close(); } }, 'Bỏ qua hôm nay'),
    save
  ]);
  save.addEventListener('click', async () => {
    if (!mood || !energy) { err.textContent = 'Chọn tâm trạng và năng lượng nhé (một chạm mỗi dòng).'; err.classList.add('show'); return; }
    try {
      await api('PUT', '/api/checkins/today', { mood, energy, available_min: Number(avail.value) });
      dlg.close(); toast('Cảm ơn bạn! Kế hoạch đã điều chỉnh theo sức hôm nay.'); refresh();
    } catch (e) { err.textContent = e.message; err.classList.add('show'); }
  });
}

// ---------- Khép ngày ----------
function renderCloseDay() {
  $('#close-day-time').textContent = `Nhắc vào ${plan.settings.close_day_time} mỗi ngày (đổi trong Cài đặt).`;
  if (plan.closeDay.due) $('#close-day-btn').classList.add('btn-sun');
}

function openCloseDay() {
  const pending = todayTasks.filter(t => t.status === 'todo');
  if (!pending.length) { toast('Hôm nay không còn việc nào cần khép. Ngủ ngon! 🌙'); return; }
  const rows = el('div', { class: 'stack', style: 'gap:8px' });
  const draw = () => {
    const left = pending.filter(t => !t._done);
    rows.replaceChildren(...(left.length ? left.map(t => el('div', { class: 'task', style: 'grid-template-columns:1fr' },
      el('div', {}, el('div', { class: 't-title' }, t.title),
        el('div', { class: 't-actions', style: 'justify-content:flex-start;margin-top:8px' },
          el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => step(t, Tasks.complete(t.id)) }, 'Xong'),
          el('button', { class: 'btn btn-sm', type: 'button', onclick: () => step(t, Tasks.postpone(t.id, 'tomorrow')) }, 'Dời sang mai'),
          el('button', { class: 'btn btn-sm', type: 'button', onclick: () => step(t, Tasks.letGo(t.id)) }, 'Buông'))))) :
      [emptyState('🌙', 'Đã khép ngày. Hôm nay bạn đã làm đủ rồi.')]));
  };
  const step = async (t, p) => { try { await p; t._done = true; draw(); } catch (e) { showError(e); } };
  draw();
  openDialog('Khép ngày', [el('p', { class: 'muted', style: 'margin-top:0' }, 'Mỗi việc một chạm. Không có lựa chọn nào là "sai".'), rows], [
    el('button', { class: 'btn', type: 'button', onclick: async e => {
      const ids = pending.filter(t => !t._done).map(t => t.id);
      if (ids.length) { try { await api('POST', '/api/tasks/bulk', { ids, action: 'postpone', to: 'tomorrow' }); } catch (err) { showError(err); } }
      e.target.closest('dialog').close();
    } }, 'Dời hết phần còn lại sang mai'),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: e => e.target.closest('dialog').close() }, 'Xong')
  ], { onClose: refresh });
}
$('#close-day-btn').addEventListener('click', openCloseDay);

// Một lời nhắc duy nhất mỗi ngày vào giờ Khép ngày (khi tab đang mở)
function scheduleCloseDayReminder() {
  if (!plan) return;
  const [h, m] = plan.settings.close_day_time.split(':').map(Number);
  const target = new Date(); target.setHours(h, m, 0, 0);
  const ms = target - Date.now();
  if (ms <= 0) return;
  setTimeout(() => {
    let key = null; try { key = localStorage.getItem('closeday-reminded'); } catch {}
    if (key === plan.date) return;
    try { localStorage.setItem('closeday-reminded', plan.date); } catch {}
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Thong Thả · Khép ngày', { body: '30 giây để khép lại hôm nay nhé.' });
    }
    toast('Đến giờ Khép ngày rồi 🌙', { actionText: 'Mở', onAction: openCloseDay, timeout: 15000 });
    $('#close-day-btn').classList.add('btn-sun');
  }, Math.min(ms, 2 ** 31 - 1));
}

// ---------- Bắt đầu lại (fresh start) ----------
async function openFreshStart() {
  const fs = plan.freshStart;
  const list = await api('GET', '/api/tasks?view=unconfirmed');
  const chosen = new Set();
  const title = fs.reason === 'away' ? `Chào mừng quay lại 👋` : fs.reason === 'monday' ? 'Tuần mới, trang mới ✨' : 'Tháng mới, trang mới ✨';
  const intro = fs.reason === 'away'
    ? `Bạn vắng ${fs.daysAway} ngày, còn ${fs.leftover} việc cũ. Không cần giải quyết hết: chọn tối đa 3 việc cho hôm nay, phần còn lại sẽ được cất vào Kho (lấy lại được bất cứ lúc nào).`
    : `Còn ${fs.leftover} việc cũ chưa đánh dấu. Một khởi đầu mới là dịp tốt để chọn lại: tối đa 3 việc cho hôm nay, phần còn lại cất vào Kho.`;
  const count = el('span', {}, '0');
  const items = el('div', { class: 'stack', style: 'gap:6px' }, list.map(t => {
    const cb = el('input', { type: 'checkbox', class: 'check', 'aria-label': t.title });
    cb.addEventListener('change', () => {
      if (cb.checked && chosen.size >= 3) { cb.checked = false; toast('Tối đa 3 việc thôi, để hôm nay nhẹ nhàng.'); return; }
      cb.checked ? chosen.add(t.id) : chosen.delete(t.id); count.textContent = chosen.size;
    });
    return el('label', { style: 'display:flex;gap:10px;align-items:center;font-weight:500' }, cb, t.title);
  }));
  const dlg = openDialog(title, [el('p', { style: 'margin-top:0' }, intro), items], [
    el('button', { class: 'btn', type: 'button', onclick: async () => { await api('POST', '/api/fresh-start/dismiss').catch(() => {}); dlg.close(); } }, 'Để sau'),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      try { const r = await api('POST', '/api/fresh-start', { keep_ids: [...chosen] }); dlg.close(); toast(`Đã cất ${r.archived} việc vào Kho. Bắt đầu thôi!`); refresh(); }
      catch (e) { showError(e); }
    } }, 'Bắt đầu lại với ', count, ' việc')
  ]);
}

function maybeOpenModals() {
  if (modalShown) return;
  modalShown = true;
  if (plan.freshStart) { openFreshStart().catch(showError); return; }
  let skipped = null; try { skipped = localStorage.getItem('skip-checkin'); } catch {}
  if (plan.needCheckin && skipped !== plan.date) openCheckin();
}

load().then(scheduleCloseDayReminder);
