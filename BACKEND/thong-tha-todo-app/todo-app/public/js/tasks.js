// Trang Tất cả việc: tìm kiếm, lọc, nhóm theo ngày
renderTopbar('tasks');
const $ = s => document.querySelector(s);
let view = 'all';

async function init() {
  try {
    const plan = await api('GET', '/api/today-plan');
    TODAY = plan.date;
    const tags = await api('GET', '/api/tasks/tags');
    $('#f-tag-filter').append(...tags.map(t => el('option', { value: t.tag }, `#${t.tag} (${t.n})`)));
  } catch (e) { showError(e); }
  load();
}

function buildQuery() {
  const p = new URLSearchParams();
  if (['all', 'upcoming', 'nodate', 'unconfirmed', 'archived'].includes(view)) p.set('view', view);
  if (view === 'done') p.set('status', 'done');
  if (view === 'let_go') p.set('status', 'let_go');
  const q = $('#q').value.trim(); if (q) p.set('q', q);
  const pr = $('#f-priority-filter').value; if (pr) p.set('priority', pr);
  const tag = $('#f-tag-filter').value; if (tag) p.set('tag', tag);
  const from = $('#f-from').value; if (from) p.set('from', from);
  const to = $('#f-to').value; if (to) p.set('to', to);
  return p.toString();
}

async function load() {
  const list = $('#list');
  list.replaceChildren(...skeleton(4));
  try {
    let tasks = await api('GET', `/api/tasks?${buildQuery()}`);
    // Việc đã xong/đã buông: mới nhất lên đầu
    if (view === 'done' || view === 'let_go') tasks = tasks.reverse();
    // Xem tất cả: hôm nay và sắp tới lên trước, rồi việc chưa xếp ngày, rồi quá khứ (mới → cũ)
    if (view === 'all') {
      const rank = t => !t.due_date ? 1 : t.due_date >= TODAY ? 0 : 2;
      tasks = [...tasks].sort((a, b) => rank(a) - rank(b) ||
        (rank(a) === 2 ? (b.due_date).localeCompare(a.due_date) : 0));
    }
    $('#result-count').textContent = `${tasks.length} việc`;
    if (!tasks.length) {
      list.replaceChildren(emptyState('🔍', $('#q').value ? 'Không tìm thấy việc nào khớp.' : 'Chưa có việc nào ở mục này.'));
      return;
    }
    // Nhóm theo ngày (giới hạn hiển thị để trang nhẹ)
    const shown = tasks.slice(0, 80);
    const groups = new Map();
    for (const t of shown) {
      const key = view === 'done' ? (t.done_date || t.due_date || '') : (t.due_date || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    const opts = { refresh: load, onEdit: t => openTaskForm(t, { onSaved: load }) };
    const nodes = [];
    for (const [day, items] of groups) {
      nodes.push(el('h2', { class: 'group-title' }, day ? fmtDay(day, { long: true }) : 'Chưa xếp ngày'));
      nodes.push(el('div', { class: 'task-list' }, items.map(t => renderTask(t, opts))));
    }
    if (tasks.length > shown.length) nodes.push(el('p', { class: 'muted small' }, `Đang hiện 80/${tasks.length} việc. Dùng bộ lọc để thu hẹp.`));
    list.replaceChildren(...nodes);
  } catch (e) {
    list.replaceChildren(emptyState('🔌', e.message));
  }
}

let t;
$('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
['#f-priority-filter', '#f-tag-filter', '#f-from', '#f-to'].forEach(s => $(s).addEventListener('change', load));
document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => {
  view = b.dataset.view;
  document.querySelectorAll('#views button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  load();
}));
$('#add-btn').addEventListener('click', () => openTaskForm(null, { defaults: { due_date: TODAY }, onSaved: load }));

init();
