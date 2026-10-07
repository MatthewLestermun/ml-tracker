// =====================================================
// level.js — экран «Уровень»: XP, достижения, резервная копия
// =====================================================

// ================= XP и уровни =================

function xpBreakdown() {
  let habitCount = 0;
  Object.keys(data.log).forEach(function (key) {
    habitCount += (data.log[key] || []).length;
  });
  const tasksDone = data.tasks.filter(function (t) { return t.done; }).length;
  const clientsPaid = data.clients.filter(function (c) { return c.stage === 'paid'; }).length;

  return {
    habitCount: habitCount,
    tasksDone: tasksDone,
    clientsPaid: clientsPaid,
    habits: habitCount * XP.habit,
    tasks: tasksDone * XP.task,
    clients: clientsPaid * XP.client
  };
}

function levelInfo() {
  const b = xpBreakdown();
  const total = b.habits + b.tasks + b.clients;
  return {
    total: total,
    level: Math.floor(total / XP_PER_LEVEL) + 1,
    into: total % XP_PER_LEVEL, // сколько XP набрано внутри текущего уровня
    breakdown: b
  };
}

function rankTitle(level) {
  if (level >= 12) return 'Легенда';
  if (level >= 8) return 'Сеньор';
  if (level >= 5) return 'Мидл';
  if (level >= 3) return 'Джун';
  if (level >= 2) return 'Стажёр';
  return 'Новичок';
}

// ================= Достижения =================

function achievements() {
  const t = moneyTotals();
  const b = xpBreakdown();
  const best = bestStreak();
  const keys = Object.keys(data.log);
  const pitched = data.clients.filter(function (c) { return (c.maxStage || 0) >= 1; }).length;

  return [
    { icon: '✓', name: 'Первая галочка', ok: b.habitCount > 0 },
    { icon: '🎉', name: 'День закрыт', ok: keys.some(isAllDone) },
    { icon: '🔥', name: '7 дней подряд', ok: best >= 7 },
    { icon: '⚡', name: '30 дней подряд', ok: best >= 30 },
    { icon: '📋', name: 'Первая задача', ok: b.tasksDone >= 1 },
    { icon: '🛠️', name: '25 задач', ok: b.tasksDone >= 25 },
    { icon: '✉️', name: 'Первое предложение', ok: pitched >= 1 },
    { icon: '📨', name: '20 предложений', ok: pitched >= 20 },
    { icon: '💵', name: 'Первый доллар', ok: t.income > 0 },
    { icon: '💰', name: '$100', ok: t.income >= 100 },
    { icon: '🚀', name: '$500', ok: t.income >= 500 },
    { icon: '🏆', name: 'Цель ' + money(GOAL), ok: t.income >= GOAL }
  ];
}

// ================= Резервная копия =================

function saveBackup() {
  data.meta.lastBackup = todayKey;
  saveData();
  downloadFile('ml-tracker-backup-' + todayKey + '.json', JSON.stringify(data, null, 2), 'application/json');
  showToast('КОПИЯ СОХРАНЕНА ✓');
  renderLevel();
}

function loadBackup(file) {
  const reader = new FileReader();
  reader.onload = function () {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (error) {
      parsed = null;
    }
    if (!parsed || !parsed.log || !parsed.habits) {
      showToast('ЭТО НЕ ТА КОПИЯ ✗', true);
      return;
    }
    if (!confirm('Заменить текущие данные данными из копии?')) return;
    data = normalize(parsed);
    applySettings();
    lastLevel = null; // чтобы не было ложного «Level up»
    lastIncome = null;
    commit();
    showToast('КОПИЯ ЗАГРУЖЕНА ✓');
  };
  reader.readAsText(file);
}

// ================= Отрисовка =================

function renderLevel() {
  const info = levelInfo();
  const b = info.breakdown;

  document.getElementById('lvl-number').textContent = info.level;
  document.getElementById('lvl-title').textContent = rankTitle(info.level);
  document.getElementById('xp-fill').style.width = (info.into / XP_PER_LEVEL * 100) + '%';
  document.getElementById('xp-text').textContent =
    info.into + ' / ' + XP_PER_LEVEL + ' XP · всего ' + info.total;

  // Плитки со статистикой
  const fullDays = Object.keys(data.log).filter(isAllDone).length;
  const stats = [
    { label: 'Серия сейчас', value: '🔥 ' + streak() },
    { label: 'Лучшая серия', value: '⚡ ' + bestStreak() },
    { label: 'Дней закрыто', value: fullDays + '/' + TOTAL_DAYS },
    { label: 'Задач сделано', value: b.tasksDone }
  ];

  const grid = document.getElementById('level-stats');
  grid.innerHTML = '';
  stats.forEach(function (s) {
    const tile = h('div', 'stat');
    tile.append(h('span', '', s.label), h('b', '', s.value));
    grid.append(tile);
  });

  // Откуда XP
  const rows = [
    { label: 'Привычки', detail: b.habitCount + ' × ' + XP.habit, xp: b.habits },
    { label: 'Задачи', detail: b.tasksDone + ' × ' + XP.task, xp: b.tasks },
    { label: 'Оплаченные клиенты', detail: b.clientsPaid + ' × ' + XP.client, xp: b.clients }
  ];
  const breakdown = document.getElementById('xp-breakdown');
  breakdown.innerHTML = '';
  rows.forEach(function (r) {
    const row = h('div', 'breakdown-row');
    const left = h('span', '', r.label);
    left.append(h('small', 'muted', '  ' + r.detail));
    row.append(left, h('b', '', r.xp + ' XP'));
    breakdown.append(row);
  });

  // Достижения
  const badges = document.getElementById('badges');
  badges.innerHTML = '';
  achievements().forEach(function (a) {
    const badge = h('div', 'badge' + (a.ok ? ' ok' : ''));
    badge.append(h('i', '', a.icon), a.name);
    badges.append(badge);
  });

  // Когда последний раз сохраняли копию
  const status = document.getElementById('backup-status');
  const last = data.meta.lastBackup;
  if (!last) {
    status.textContent = '⚠ Копию ещё ни разу не сохраняли';
    status.classList.add('warn');
  } else {
    const ago = daysBetween(last, todayKey);
    status.textContent = 'Последняя копия: ' + (ago === 0 ? 'сегодня' : ago + ' дн. назад');
    status.classList.toggle('warn', ago >= 7);
  }
}

// ================= Кнопки =================

document.getElementById('backup-save').addEventListener('click', saveBackup);

document.getElementById('backup-load').addEventListener('click', function () {
  document.getElementById('backup-file').click();
});

document.getElementById('backup-file').addEventListener('change', function () {
  if (this.files[0]) loadBackup(this.files[0]);
  this.value = ''; // чтобы можно было выбрать тот же файл ещё раз
});
