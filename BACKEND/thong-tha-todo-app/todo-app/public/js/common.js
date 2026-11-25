// Thong Thả – tiện ích dùng chung cho mọi trang.
// Nguyên tắc an toàn: mọi dữ liệu người dùng đều hiển thị bằng textContent (hàm el), không ghép vào innerHTML.

// ---------- Gọi API ----------
async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new Error('Không kết nối được máy chủ. Kiểm tra lại cửa sổ Terminal đang chạy "npm start".');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

// ---------- Tạo phần tử DOM an toàn ----------
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style') n.style.cssText = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

// Biểu tượng SVG nội bộ (không chứa dữ liệu người dùng)
const ICONS = {
  play: '<path d="M8 5v14l11-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  dots: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  cal: '<path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>'
};
function icon(name, size = 16) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'currentColor'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name]; // chỉ là hình vẽ cố định trong code
  return s;
}

// ---------- Định dạng ----------
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
let TODAY = null; // lấy từ máy chủ để khớp múi giờ

function ymdToDate(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function addDaysYmd(ymd, n) { const d = ymdToDate(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function diffYmd(a, b) { return Math.round((ymdToDate(b) - ymdToDate(a)) / 86400000); }

function fmtDay(ymd, { long = false } = {}) {
  if (!ymd) return 'Chưa xếp ngày';
  const d = ymdToDate(ymd);
  const dm = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (TODAY) {
    const k = diffYmd(TODAY, ymd);
    if (k === 0) return long ? `Hôm nay, ${dm}` : 'Hôm nay';
    if (k === 1) return long ? `Ngày mai, ${dm}` : 'Ngày mai';
    if (k === -1) return long ? `Hôm qua, ${dm}` : 'Hôm qua';
  }
  return `${WEEKDAYS[d.getUTCDay()]}, ${dm}`;
}
function fmtMin(m) {
  if (m == null) return '';
  m = Math.round(m);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}
function fmtNum(x) { return String(x).replace('.', ','); }

const PRIORITY_LABEL = { cao: 'Ưu tiên cao', vua: 'Ưu tiên vừa', thap: 'Ưu tiên thấp' };
const STATUS_LABEL = { todo: 'Cần làm', done: 'Đã xong', let_go: 'Đã buông', unconfirmed: 'Chưa đánh dấu', archived: 'Trong Kho' };
const FRICTION_LABEL = { qua_lon: 'Quá lớn', chua_ro: 'Chưa rõ cách làm', khong_quan_trong: 'Không còn quan trọng' };

// ---------- Thanh điều hướng ----------
function renderTopbar(active) {
  const links = [['/', 'Hôm nay', 'today'], ['/tasks', 'Tất cả việc', 'tasks'], ['/insights', 'Hiểu mình', 'insights'], ['/settings', 'Cài đặt', 'settings']];
  const mark = el('span', { class: 'brand-mark', 'aria-hidden': 'true' });
  mark.append(icon('cal', 20));
  const header = el('header', { class: 'topbar' },
    el('div', { class: 'inner' },
      el('a', { class: 'brand', href: '/' }, mark, 'Thong Thả'),
      el('nav', { class: 'nav', 'aria-label': 'Điều hướng chính' },
        links.map(([href, text, key]) => el('a', { href, 'aria-current': key === active ? 'page' : null }, text)))));
  document.body.prepend(header);
}

// ---------- Toast (thông báo ngắn, có nút Hoàn tác) ----------
function toast(message, { actionText, onAction, timeout = 4000 } = {}) {
  let box = document.querySelector('.toasts');
  if (!box) { box = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = el('div', { class: 'toast' }, el('span', { text: message }));
  let timer;
  if (actionText) {
    t.append(el('button', { type: 'button', text: actionText, onclick: async () => { clearTimeout(timer); t.remove(); await onAction(); } }));
  }
  box.append(t);
  timer = setTimeout(() => t.remove(), timeout);
}
function showError(e) { toast(e.message || String(e), { timeout: 6000 }); }

// ---------- Hộp thoại ----------
function openDialog(title, bodyNodes, footNodes, { onClose } = {}) {
  const dlg = el('dialog', { 'aria-labelledby': 'dlg-title' },
    el('div', { class: 'dlg-head' },
      el('h2', { id: 'dlg-title', text: title }),
      el('button', { class: 'btn btn-ghost icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: () => dlg.close() }, icon('x'))),
    el('div', { class: 'dlg-body' }, bodyNodes),
    el('div', { class: 'dlg-foot' }, footNodes));
  dlg.addEventListener('close', () => { dlg.remove(); onClose && onClose(); });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

// ---------- Thao tác với task ----------
const Tasks = {
  complete: (id, done_date) => api('POST', `/api/tasks/${id}/complete`, done_date ? { done_date } : {}),
  reopen: id => api('PUT', `/api/tasks/${id}`, { status: 'todo' }),
  postpone: (id, to) => api('POST', `/api/tasks/${id}/postpone`, { to }),
  letGo: id => api('POST', `/api/tasks/${id}/let-go`),
  restore: id => api('POST', `/api/tasks/${id}/restore`),
  remove: id => api('DELETE', `/api/tasks/${id}`),
  start: id => api('POST', `/api/tasks/${id}/start`),
  stop: id => api('POST', `/api/tasks/${id}/stop`),
  friction: (id, reason) => api('POST', `/api/tasks/${id}/friction`, { reason }),
  addSub: (id, title) => api('POST', `/api/tasks/${id}/subtasks`, { title }),
  toggleSub: (id, sid, done) => api('PATCH', `/api/tasks/${id}/subtasks/${sid}`, { done })
};

// Xoá có Hoàn tác trong 5 giây (không dùng hộp thoại hỏi lại)
async function deleteWithUndo(task, refresh) {
  await Tasks.remove(task.id);
  refresh();
  toast(`Đã xoá "${task.title}"`, {
    actionText: 'Hoàn tác', timeout: 5000,
    onAction: async () => { await Tasks.restore(task.id); refresh(); toast('Đã khôi phục.'); }
  });
}

// Menu nhỏ (dời ngày, thêm thao tác)
function makeMenu(label, buttonContent, items, { ariaLabel } = {}) {
  const wrap = el('div', { class: 'menu' });
  const btn = el('button', { class: 'btn btn-sm', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': ariaLabel || label }, buttonContent);
  const pop = el('div', { class: 'menu-pop', role: 'menu' }, items);
  const close = () => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach(m => m !== wrap && m.classList.remove('open'));
    const open = !wrap.classList.contains('open');
    wrap.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
    if (open) pop.querySelector('button, input')?.focus();
  });
  pop.addEventListener('click', e => { if (e.target.closest('button')) close(); });
  wrap.append(btn, pop);
  return wrap;
}
document.addEventListener('click', e => { if (!e.target.closest('.menu')) document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); });

function postponeMenu(task, refresh) {
  const go = async to => {
    try { const t = await Tasks.postpone(task.id, to); refresh(); toast(`Đã dời sang ${fmtDay(t.due_date).toLowerCase()}.`); }
    catch (e) { showError(e); }
  };
  const dateInput = el('input', { type: 'date', 'aria-label': 'Chọn ngày khác', min: TODAY || undefined });
  dateInput.addEventListener('change', () => { if (dateInput.value) { go(dateInput.value); dateInput.closest('.menu').classList.remove('open'); } });
  const items = [];
  if (task.status !== 'todo' || task.due_date !== TODAY) items.push(el('button', { type: 'button', role: 'menuitem', onclick: () => go('today') }, 'Hôm nay'));
  items.push(
    el('button', { type: 'button', role: 'menuitem', onclick: () => go('tomorrow') }, 'Ngày mai'),
    el('button', { type: 'button', role: 'menuitem', onclick: () => go('weekend') }, 'Cuối tuần'),
    el('span', { class: 'small muted', style: 'padding:4px 10px 0' }, 'Hoặc chọn ngày:'),
    dateInput);
  return makeMenu('Dời', [icon('cal', 14), 'Dời'], items, { ariaLabel: `Dời việc ${task.title}` });
}

// ---------- Thẻ công việc ----------
// opts: { refresh, onEdit, compact }
function renderTask(task, opts) {
  const { refresh, onEdit } = opts;
  const isTodo = task.status === 'todo';
  const node = el('article', {
    class: ['task', task.status === 'done' && 'is-done', task.running_since && 'is-running', task.lane === 'neu_con_suc' && 'lane-bonus'].filter(Boolean).join(' '),
    'aria-label': task.title
  });

  // Ô hoàn thành
  const check = el('input', { type: 'checkbox', class: 'check', 'aria-label': `Hoàn thành: ${task.title}` });
  check.checked = task.status === 'done';
  check.disabled = !['todo', 'done', 'unconfirmed'].includes(task.status);
  check.addEventListener('change', async () => {
    try {
      if (check.checked) {
        const r = await Tasks.complete(task.id);
        toast(r.next_id ? 'Xong! Lần kế tiếp đã được xếp lịch.' : pickCheer(), { actionText: 'Hoàn tác', onAction: async () => { await Tasks.reopen(task.id); refresh(); } });
      } else await Tasks.reopen(task.id);
      refresh();
    } catch (e) { check.checked = !check.checked; showError(e); }
  });

  // Nội dung chính
  const meta = el('div', { class: 't-meta' });
  if (task.due_date && task.due_date !== TODAY) meta.append(el('span', { class: 'chip' }, fmtDay(task.due_date)));
  if (task.due_time) meta.append(el('span', { class: 'chip' }, task.due_time));
  if (task.tag) meta.append(el('span', { class: 'chip tag' }, '#' + task.tag));
  if (task.priority !== 'vua') meta.append(el('span', { class: `chip prio-${task.priority}` }, PRIORITY_LABEL[task.priority]));
  if (task.estimate_min) {
    const t = task.ratio && Math.abs(task.ratio - 1) >= 0.1
      ? `~${fmtMin(task.realistic_min)} (bạn ước ${fmtMin(task.estimate_min)})`
      : `~${fmtMin(task.estimate_min)}`;
    meta.append(el('span', { class: 'chip', title: 'Thời lượng thực tế dự kiến = ước tính × hệ số trễ cá nhân của nhãn này' }, t));
  }
  if (task.energy === 'nhe') meta.append(el('span', { class: 'chip' }, 'Nhẹ đầu'));
  if (task.lane === 'neu_con_suc') meta.append(el('span', { class: 'chip lane' }, 'Nếu còn sức'));
  if (task.warning) meta.append(el('span', { class: `chip w-${task.warning.level}`, title: `Cần ~${fmtMin(task.warning.need)}, còn trống ~${fmtMin(task.warning.free)} trước hạn` }, task.warning.text));
  if (task.progress) meta.append(el('span', { class: 'chip progress' }, task.progress.label + (task.progress.reserve ? ` · ${task.progress.reserve} ngày dự phòng` : '')));
  if (!['todo', 'done'].includes(task.status)) meta.append(el('span', { class: 'chip status' }, STATUS_LABEL[task.status]));

  const body = el('div', {},
    el('div', { class: 't-title' }, task.title),
    meta);
  if (task.running_since) {
    const tm = el('div', { class: 'timer', 'aria-live': 'off' });
    const started = new Date(task.running_since.replace(' ', 'T') + '+07:00');
    const tick = () => { const m = Math.floor((Date.now() - started) / 60000); tm.textContent = `Đang làm · ${m} phút`; };
    tick(); const iv = setInterval(() => { if (!tm.isConnected) clearInterval(iv); else tick(); }, 15000);
    body.append(tm);
  }
  if (task.if_then_plan) body.append(el('div', { class: 't-plan' }, el('b', {}, 'Khi nào, ở đâu: '), task.if_then_plan));
  if (task.note && !opts.compact) body.append(el('div', { class: 't-plan' }, task.note));

  // Bước nhỏ
  if (task.subtasks.length) {
    body.append(el('ul', { class: 'subtasks' }, task.subtasks.map(s => {
      const cb = el('input', { type: 'checkbox', 'aria-label': s.title });
      cb.checked = s.done;
      cb.addEventListener('change', async () => { try { await Tasks.toggleSub(task.id, s.id, cb.checked); refresh(); } catch (e) { showError(e); } });
      return el('li', {}, cb, el('span', { class: s.done ? 'done' : '' }, s.title));
    })));
  }

  // Gợi ý theo tâm lý học: việc bị dời nhiều lần → hỏi lý do vướng
  if (isTodo && !opts.side && task.postpone_count >= 3 && !task.friction_reason) {
    const ask = async reason => {
      try {
        await Tasks.friction(task.id, reason);
        if (reason === 'qua_lon' || reason === 'chua_ro') { refresh(); toast(reason === 'qua_lon' ? 'Hãy chia thành vài bước nhỏ bên dưới.' : 'Ghi lại bước đầu tiên dù rất nhỏ nhé.'); }
        else { refresh(); toast('Đã buông việc này. Một quyết định rõ ràng cũng là tiến bộ.'); }
      } catch (e) { showError(e); }
    };
    body.append(el('div', { class: 'nudge' },
      `Việc này đã dời ${task.postpone_count} lần. Nó đang vướng ở đâu?`,
      el('div', { class: 'row' },
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => ask('qua_lon') }, 'Quá lớn'),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => ask('chua_ro') }, 'Chưa rõ cách làm'),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => ask('khong_quan_trong') }, 'Không còn quan trọng'))));
  }

  // Việc lớn chưa có bước nhỏ → gợi ý ghi "bước nhỏ đầu tiên"
  if (isTodo && !opts.side && !task.subtasks.length && ((task.estimate_min || 0) >= 60 || task.friction_reason === 'qua_lon' || task.friction_reason === 'chua_ro')) {
    const inp = el('input', { type: 'text', placeholder: 'Bước nhỏ đầu tiên là gì? (VD: mở file và viết dàn ý)', 'aria-label': 'Bước nhỏ đầu tiên' });
    const add = async () => {
      if (!inp.value.trim()) return;
      try { await Tasks.addSub(task.id, inp.value.trim()); refresh(); } catch (e) { showError(e); }
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    body.append(el('div', { class: 'nudge' }, 'Việc lớn dễ bị ngại bắt đầu. Chia ra giúp ước lượng sát hơn.',
      el('div', { class: 'row' }, inp, el('button', { class: 'btn btn-sm', type: 'button', onclick: add }, 'Thêm'))));
  }

  // Thao tác
  const actions = el('div', { class: 't-actions' });
  if (isTodo) {
    actions.append(task.running_since
      ? el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: async () => { try { const r = await Tasks.stop(task.id); toast(`Đã ghi ${fmtMin(r.session_minutes)} làm việc.`); refresh(); } catch (e) { showError(e); } } }, icon('stop', 12), 'Dừng')
      : el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': `Bắt đầu làm ${task.title}`, onclick: async () => { try { await Tasks.start(task.id); refresh(); } catch (e) { showError(e); } } }, icon('play', 12), 'Bắt đầu'));
    actions.append(postponeMenu(task, refresh));
  }
  if (task.status === 'unconfirmed') {
    actions.append(el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: async () => { try { await Tasks.complete(task.id, task.due_date); refresh(); toast('Đã ghi nhận là đã làm.'); } catch (e) { showError(e); } } }, 'Đã làm'));
    actions.append(postponeMenu(task, refresh));
  }
  if (['let_go', 'archived'].includes(task.status)) {
    actions.append(el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { await Tasks.restore(task.id); refresh(); toast('Đã đưa việc trở lại danh sách.'); } catch (e) { showError(e); } } }, 'Lấy lại'));
  }
  const more = [];
  if (onEdit) more.push(el('button', { type: 'button', role: 'menuitem', onclick: () => onEdit(task) }, 'Sửa chi tiết'));
  if (['todo', 'unconfirmed'].includes(task.status)) more.push(el('button', { type: 'button', role: 'menuitem', onclick: async () => {
    try { await Tasks.letGo(task.id); refresh(); toast('Đã buông việc này.', { actionText: 'Hoàn tác', onAction: async () => { await Tasks.restore(task.id); refresh(); } }); } catch (e) { showError(e); }
  } }, 'Buông (không làm nữa)'));
  more.push(el('button', { type: 'button', role: 'menuitem', onclick: () => deleteWithUndo(task, refresh).catch(showError) }, 'Xoá'));
  actions.append(makeMenu('Thêm', [icon('dots', 14)], more, { ariaLabel: `Thêm thao tác cho ${task.title}` }));

  node.append(check, body, actions);
  return node;
}

const CHEERS = ['Xong một việc! 👏', 'Tốt lắm, thêm một việc gọn gàng.', 'Đã xong. Nghỉ một chút cũng được.', 'Một bước nữa rồi đó.'];
function pickCheer() { return CHEERS[Math.floor(Math.random() * CHEERS.length)]; }

// ---------- Form thêm/sửa task (dùng chung) ----------
function openTaskForm(task, { defaults = {}, onSaved } = {}) {
  const t = task || {};
  const v = k => t[k] ?? defaults[k] ?? '';
  const f = (name, labelText, input, hint) => el('div', { class: 'field' }, el('label', { for: `f-${name}` }, labelText), input, hint ? el('div', { class: 'hint' }, hint) : null);
  const inp = (name, attrs = {}) => { const i = el('input', { id: `f-${name}`, name, ...attrs }); i.value = v(name); return i; };
  const sel = (name, options) => {
    const s = el('select', { id: `f-${name}`, name }, options.map(([val, txt]) => el('option', { value: val }, txt)));
    s.value = v(name) || options[0][0]; return s;
  };
  const err = el('div', { class: 'error', role: 'alert' });
  const title = inp('title', { type: 'text', maxlength: '200', required: true, autocomplete: 'off' });
  const note = el('textarea', { id: 'f-note', name: 'note', maxlength: '2000' }); note.value = v('note');
  const recurrence = sel('recurrence', [['none', 'Không lặp'], ['daily', 'Hằng ngày'], ['weekly', 'Hằng tuần'], ['after_n_days', 'Sau N ngày kể từ lần làm xong']]);
  const recurN = inp('recur_n', { type: 'number', min: '1', max: '365', placeholder: 'VD: 3' });
  const reserve = inp('reserve_days_per_week', { type: 'number', min: '0', max: '6' }); if (!reserve.value) reserve.value = 2;
  const recBox = el('div', { class: 'row2' }, f('recur_n', 'Số ngày N', recurN), f('reserve_days_per_week', 'Ngày nghỉ dự phòng/tuần', reserve, 'Bỏ lỡ trong giới hạn này vẫn tính là đạt.'));
  const syncRec = () => { recBox.style.display = recurrence.value === 'none' ? 'none' : ''; recurN.closest('.field').style.display = recurrence.value === 'after_n_days' ? '' : 'none'; reserve.closest('.field').style.display = recurrence.value === 'daily' ? '' : 'none'; };
  recurrence.addEventListener('change', syncRec);

  const subWrap = el('div', { class: 'stack', style: 'gap:6px' });
  const addSubRow = (s = { title: '', done: false }) => {
    const i = el('input', { type: 'text', value: s.title, placeholder: 'Bước nhỏ…', 'aria-label': 'Bước nhỏ' });
    i.value = s.title; i.dataset.done = s.done ? '1' : '';
    const row = el('div', { style: 'display:flex;gap:6px' }, i, el('button', { type: 'button', class: 'btn btn-ghost icon-btn', 'aria-label': 'Xoá bước này', onclick: () => row.remove() }, icon('x', 14)));
    subWrap.append(row);
  };
  (t.subtasks || []).forEach(addSubRow);

  const body = [
    err,
    f('title', 'Tên việc *', title),
    el('div', { class: 'row2' },
      f('due_date', 'Ngày', inp('due_date', { type: 'date' })),
      f('due_time', 'Giờ (nếu có)', inp('due_time', { type: 'time' }))),
    el('div', { class: 'row3' },
      f('estimate_min', 'Ước tính (phút)', inp('estimate_min', { type: 'number', min: '1', max: '1440', placeholder: 'VD: 45' })),
      f('priority', 'Ưu tiên', sel('priority', [['vua', 'Vừa'], ['cao', 'Cao'], ['thap', 'Thấp']])),
      f('energy', 'Loại việc', sel('energy', [['nang', 'Cần tập trung'], ['nhe', 'Nhẹ đầu']]))),
    el('div', { class: 'row2' },
      f('tag', 'Nhãn', inp('tag', { type: 'text', maxlength: '30', placeholder: 'học, việc, nhà…', list: 'tag-list' })),
      f('lane', 'Làn', sel('lane', [['chinh', 'Việc chính'], ['neu_con_suc', 'Nếu còn sức (không bắt buộc)']]))),
    f('if_then_plan', 'Khi nào, ở đâu tôi sẽ làm? (tuỳ chọn)', inp('if_then_plan', { type: 'text', maxlength: '300', placeholder: 'VD: Sau bữa trưa, ở thư viện tầng 3' }), 'Kế hoạch "khi… thì…" giúp chuyển ý định thành hành động.'),
    f('note', 'Ghi chú', note),
    f('recurrence', 'Lặp lại', recurrence),
    recBox,
    el('div', { class: 'field' }, el('label', {}, 'Các bước nhỏ'), subWrap,
      el('button', { type: 'button', class: 'btn btn-sm btn-ghost', style: 'margin-top:6px', onclick: () => addSubRow() }, icon('plus', 12), 'Thêm bước'))
  ];
  syncRec();

  const save = el('button', { class: 'btn btn-primary', type: 'button' }, task ? 'Lưu thay đổi' : 'Thêm việc');
  const dlg = openDialog(task ? 'Sửa việc' : 'Thêm việc mới', body, [
    el('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Huỷ'), save]);
  title.focus();

  // gợi ý nhãn đã dùng
  api('GET', '/api/tasks/tags').then(tags => {
    dlg.append(el('datalist', { id: 'tag-list' }, tags.map(x => el('option', { value: x.tag }))));
  }).catch(() => {});

  const submit = async () => {
    err.classList.remove('show');
    const g = id => dlg.querySelector(`#f-${id}`).value;
    if (!g('title').trim()) { err.textContent = 'Hãy nhập tên việc.'; err.classList.add('show'); title.focus(); return; }
    const payload = {
      title: g('title'), note: g('note'), due_date: g('due_date') || null, due_time: g('due_time') || null,
      estimate_min: g('estimate_min') ? Number(g('estimate_min')) : null, priority: g('priority'), energy: g('energy'),
      tag: g('tag'), lane: g('lane'), if_then_plan: g('if_then_plan'), recurrence: g('recurrence'),
      recur_n: g('recur_n') ? Number(g('recur_n')) : null, reserve_days_per_week: g('reserve_days_per_week') ? Number(g('reserve_days_per_week')) : 2,
      subtasks: [...subWrap.querySelectorAll('input')].filter(i => i.value.trim()).map(i => ({ title: i.value.trim(), done: !!i.dataset.done }))
    };
    save.disabled = true;
    try {
      const r = task ? await api('PUT', `/api/tasks/${task.id}`, payload) : await api('POST', '/api/tasks', payload);
      dlg.close(); toast(task ? 'Đã lưu.' : 'Đã thêm việc.'); onSaved && onSaved(r);
    } catch (e) { err.textContent = e.message; err.classList.add('show'); }
    finally { save.disabled = false; }
  };
  save.addEventListener('click', submit);
  title.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function skeleton(n = 3) { return Array.from({ length: n }, () => el('div', { class: 'skeleton', 'aria-hidden': 'true' })); }
function emptyState(emoji, text, extra) { return el('div', { class: 'empty' }, el('div', { class: 'big', 'aria-hidden': 'true' }, emoji), el('p', {}, text), extra || null); }
