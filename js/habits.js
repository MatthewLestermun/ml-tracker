// =====================================================
// habits.js — экран «Привычки» и сетка 90 дней
// =====================================================

// Иконки привычек. У своих привычек — звёздочка
const HABIT_ICONS = {
  workout: '💪',
  english: '🗣️',
  vibecode: '💻',
  post: '📱',
  sleep: '🌙'
};

let justDoneHabit = null; // какую привычку только что отметили — для анимации галочки
let selectedKey = null;   // клетка сетки, на которую тапнули

// ================= Логика =================

// Какие привычки (из текущего списка) отмечены в этот день
function doneIds(key) {
  const habitIds = data.habits.map(function (habit) { return habit.id; });
  return (data.log[key] || []).filter(function (id) { return habitIds.includes(id); });
}

function isAllDone(key) {
  return data.habits.length > 0 && doneIds(key).length === data.habits.length;
}

// «Активный» день — отмечена хотя бы одна привычка
function isActiveDay(key) {
  return doneIds(key).length > 0;
}

// Серия: сколько дней подряд был активным.
// Если сегодня ещё ничего не отмечено — серия не сгорает, считаем со вчера.
function streak() {
  let day = isActiveDay(todayKey) ? today : addDays(today, -1);
  let count = 0;
  while (isActiveDay(dateKey(day))) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

// Самая длинная серия за весь челлендж
function bestStreak() {
  let best = 0;
  let run = 0;
  for (let day = parseDate(START_DATE); dateKey(day) <= todayKey; day = addDays(day, 1)) {
    if (isActiveDay(dateKey(day))) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

// Статус дня для сетки: full / partial / missed / future
function dayStatus(key) {
  if (key > todayKey) return 'future';
  if (isAllDone(key)) return 'full';
  if (isActiveDay(key)) return 'partial';
  if (key === todayKey) return ''; // сегодня ещё не вечер — не считаем пропуском
  return 'missed';
}

function toggleHabit(id, card) {
  const wasAllDone = isAllDone(todayKey);
  const done = data.log[todayKey] || [];
  const checking = !done.includes(id);

  data.log[todayKey] = checking
    ? done.concat(id)
    : done.filter(function (habitId) { return habitId !== id; });

  floatText(card, (checking ? '+' : '−') + XP.habit + ' XP', !checking);
  vibrate(checking ? 15 : 8);
  justDoneHabit = checking ? id : null;
  commit();

  // Только что закрыли все привычки — празднуем
  if (checking && !wasAllDone && isAllDone(todayKey)) {
    confetti();
    showToast('ДЕНЬ ЗАКРЫТ ✓');
    vibrate([30, 60, 30, 60, 80]);
  }
}

function addHabit(name) {
  data.habits.push({ id: 'h' + uid(), name: name, custom: true });
  vibrate(15);
  commit();
}

function deleteHabit(id) {
  if (!confirm('Удалить привычку?')) return;
  data.habits = data.habits.filter(function (habit) { return habit.id !== id; });
  commit();
}

// ================= Отрисовка =================

function renderHabitsHeader() {
  document.getElementById('day-number').textContent = challengeDay();
  document.getElementById('today-date').textContent =
    today.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const total = data.habits.length;
  const done = doneIds(todayKey).length;
  const percent = total ? Math.round(done / total * 100) : 0;

  document.getElementById('today-progress').textContent = done + '/' + total;
  document.getElementById('ring-percent').textContent = percent + '%';
  // 326.7 — длина окружности кольца; чем больше процент, тем меньше «пустого» хвоста
  document.getElementById('ring-fill').style.strokeDashoffset = 326.7 * (1 - percent / 100);
  document.querySelector('.hero').classList.toggle('complete', percent === 100);

  document.getElementById('streak').textContent = streak();
  document.getElementById('xp-today').textContent = done * XP.habit;
  document.getElementById('habit-level').textContent = levelInfo().level;
}

function renderHabitList(animateIn) {
  const list = document.getElementById('habit-list');
  list.innerHTML = '';
  const done = doneIds(todayKey);

  data.habits.forEach(function (habit, index) {
    const isDone = done.includes(habit.id);

    const item = h('li', 'habit' + (isDone ? ' done' : '') + (habit.id === justDoneHabit ? ' just-done' : ''));
    if (animateIn) {
      item.style.animationDelay = (index * 0.05) + 's'; // карточки выезжают по очереди
    } else {
      item.style.animation = 'none';
    }

    const name = h('span', 'habit-name', habit.name);
    name.append(h('span', 'habit-xp', '+' + XP.habit + ' XP'));

    item.append(
      h('span', 'habit-icon', HABIT_ICONS[habit.id] || '⭐'),
      name,
      h('span', 'habit-check', isDone ? '✓' : '')
    );

    // Любую привычку можно удалить крестиком — у каждого свой набор
    const del = h('button', 'del', '×');
    del.type = 'button';
    del.setAttribute('aria-label', 'Удалить привычку');
    del.addEventListener('click', function (event) {
      event.stopPropagation(); // чтобы клик по крестику не отмечал привычку
      deleteHabit(habit.id);
    });
    item.append(del);

    item.addEventListener('click', function () { toggleHabit(habit.id, item); });
    list.append(item);
  });

  justDoneHabit = null;
}

function renderGrid(animateIn) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const start = parseDate(START_DATE);

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const key = dateKey(addDays(start, i));

    const cell = h('div', 'cell ' + dayStatus(key));
    if (key === todayKey) cell.classList.add('today');
    if (key === selectedKey) cell.classList.add('selected');
    if (animateIn) {
      cell.style.animationDelay = (i * 0.008) + 's'; // клетки появляются волной
    } else if (key !== todayKey) {
      cell.style.animation = 'none';
    }

    cell.addEventListener('click', function () {
      selectedKey = key;
      showDayInfo(key, i + 1);
      renderGrid(false);
      vibrate(5);
    });
    grid.append(cell);
  }
}

// Подпись над сеткой: «День 5 · 9 окт · 3/5»
function showDayInfo(key, number) {
  const info = document.getElementById('grid-info');
  info.innerHTML = '';
  const state = key > todayKey ? 'впереди' : doneIds(key).length + '/' + data.habits.length;
  info.append(h('b', '', 'День ' + number), ' · ' + fmtDate(key) + ' · ' + state);
}

function renderHabits(animateIn) {
  renderHabitsHeader();
  renderHabitList(animateIn);
  renderGrid(animateIn);
}

// ================= Форма =================

document.getElementById('habit-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const name = this.elements.name.value.trim();
  if (name) addHabit(name);
  closeAdder(this);
});
