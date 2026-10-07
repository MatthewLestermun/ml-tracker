// =====================================================
// tasks.js — экран «Задачи»
// =====================================================

const PRIORITIES = {
  urgent: { name: 'Срочно', color: '#FF4D4D', order: 0 },
  high: { name: 'Высокий', color: '#FF8A3D', order: 1 },
  mid: { name: 'Средний', color: '#FFD23F', order: 2 },
  low: { name: 'Низкий', color: '#9A9DA6', order: 3 }
};

let taskFilter = 'active';

// ================= Логика =================

function isOverdue(task) {
  return !task.done && task.due && task.due < todayKey;
}

function isForToday(task) {
  return !task.done && task.due && task.due <= todayKey;
}

function addTask(fields) {
  data.tasks.push({
    id: uid(),
    title: fields.title,
    due: fields.due,
    priority: fields.priority,
    category: fields.category,
    done: false,
    doneAt: null,
    created: todayKey
  });
  vibrate(15);
  commit();
}

function toggleTask(id, card) {
  const task = data.tasks.find(function (t) { return t.id === id; });
  task.done = !task.done;
  task.doneAt = task.done ? todayKey : null;
  floatText(card, (task.done ? '+' : '−') + XP.task + ' XP', !task.done);
  vibrate(task.done ? 15 : 8);
  commit();
}

function deleteTask(id) {
  if (!confirm('Удалить задачу?')) return;
  data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
  commit();
}

// Сортировка: сначала просроченные и ближайшие, при равном сроке — важнее выше
function sortTasks(list) {
  return list.slice().sort(function (a, b) {
    if (a.done && b.done) return (b.doneAt || '').localeCompare(a.doneAt || '');
    const dueA = a.due || '9999-99-99';
    const dueB = b.due || '9999-99-99';
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return PRIORITIES[a.priority].order - PRIORITIES[b.priority].order;
  });
}

// Подпись срока: «сегодня», «завтра», «до 9 окт», «просрочено · 5 окт»
function dueLabel(task) {
  if (task.done) return '✓ ' + fmtDate(task.doneAt);
  if (!task.due) return '';
  if (task.due < todayKey) return 'просрочено · ' + fmtDate(task.due);
  if (task.due === todayKey) return 'сегодня';
  if (task.due === tomorrowKey) return 'завтра';
  return 'до ' + fmtDate(task.due);
}

// ================= Отрисовка =================

function renderTasks() {
  const active = data.tasks.filter(function (t) { return !t.done; });
  const overdue = data.tasks.filter(isOverdue);
  const forToday = data.tasks.filter(isForToday);
  const done = data.tasks.filter(function (t) { return t.done; });

  // Чипы сверху
  const chips = document.getElementById('task-chips');
  chips.innerHTML = '';
  chips.append(h('span', 'chip', active.length + ' активных'));
  if (overdue.length) chips.append(h('span', 'chip warn', overdue.length + ' просрочено'));
  chips.append(h('span', 'chip', '✓ ' + done.length + ' сделано'));

  // Счётчики на кнопках фильтра
  const counts = { active: active.length, today: forToday.length, done: done.length };
  const names = { active: 'Активные', today: 'Сегодня', done: 'Готово' };
  document.querySelectorAll('#task-filter button').forEach(function (button) {
    const f = button.dataset.filter;
    button.textContent = names[f] + ' · ' + counts[f];
    button.classList.toggle('active', f === taskFilter);
  });

  const shown = taskFilter === 'done' ? done : taskFilter === 'today' ? forToday : active;
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  if (shown.length === 0) {
    const texts = {
      active: 'Задач нет. Добавь первую — например «Найти 5 барбершопов для рассылки»',
      today: 'На сегодня всё чисто ✓',
      done: 'Пока ничего не сделано. Первая задача = +20 XP'
    };
    list.append(emptyState(texts[taskFilter]));
    return;
  }

  sortTasks(shown).forEach(function (task) {
    const prio = PRIORITIES[task.priority] || PRIORITIES.mid;
    const item = h('li', 'task' + (task.done ? ' done' : '') + (isOverdue(task) ? ' overdue' : ''));
    item.style.setProperty('--prio', prio.color);

    const check = h('button', 'task-check', task.done ? '✓' : '');
    check.type = 'button';
    check.setAttribute('aria-label', 'Выполнено');
    check.addEventListener('click', function () { toggleTask(task.id, item); });

    const body = h('div', 'task-body');
    body.append(h('div', 'task-title', task.title));

    const meta = h('div', 'task-meta');
    const prioLabel = h('span', 'prio', prio.name);
    prioLabel.style.color = prio.color;
    meta.append(prioLabel, h('span', '', '#' + task.category));
    const due = dueLabel(task);
    if (due) meta.append(h('span', isOverdue(task) ? 'meta-warn' : '', due));
    body.append(meta);

    const del = h('button', 'del', '×');
    del.type = 'button';
    del.setAttribute('aria-label', 'Удалить задачу');
    del.addEventListener('click', function () { deleteTask(task.id); });

    item.append(check, body, del);
    list.append(item);
  });
}

// ================= Кнопки и форма =================

document.getElementById('task-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const f = this.elements;
  const title = f.title.value.trim();
  if (!title) return;
  addTask({ title: title, due: f.due.value, priority: f.priority.value, category: f.category.value });
  closeAdder(this);
});

document.querySelectorAll('#task-filter button').forEach(function (button) {
  button.addEventListener('click', function () {
    taskFilter = button.dataset.filter;
    vibrate(5);
    renderTasks();
  });
});

document.getElementById('tasks-csv').addEventListener('click', function () {
  const rows = [['Задача', 'Срок', 'Приоритет', 'Категория', 'Статус', 'Выполнена']];
  sortTasks(data.tasks).forEach(function (t) {
    rows.push([t.title, t.due, (PRIORITIES[t.priority] || PRIORITIES.mid).name, t.category, t.done ? 'Готово' : 'Активна', t.doneAt || '']);
  });
  downloadCSV('lestermun-tasks-' + todayKey + '.csv', rows);
});
