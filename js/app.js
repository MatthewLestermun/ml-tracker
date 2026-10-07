// =====================================================
// app.js — запуск: меню, формы, отрисовка всех экранов
// =====================================================

const TAB_KEY = 'lestermun-tab';

// Перерисовать все экраны. animateIn — красивое появление при первом запуске
function renderAll(animateIn) {
  renderPersonal();
  renderHabits(animateIn);
  renderTasks();
  renderClients();
  renderMoney();
  renderLevel();
}

// ================= Нижнее меню =================

function openTab(name) {
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.classList.toggle('active', screen.dataset.screen === name);
  });
  window.scrollTo(0, 0);
  try {
    localStorage.setItem(TAB_KEY, name); // запомнить вкладку до следующего раза
  } catch (error) {
    // не страшно, просто не запомним
  }
}

document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    openTab(tab.dataset.tab);
    vibrate(5);
  });
});

// ================= Раскрывающиеся формы «+ добавить» =================

document.querySelectorAll('.adder').forEach(function (adder) {
  adder.querySelector('.add-toggle').addEventListener('click', function () {
    adder.classList.add('open');
    // В полях с датой сразу ставим сегодняшнее число
    adder.querySelectorAll('[data-default-today]').forEach(function (input) {
      if (!input.value) input.value = todayKey;
    });
    const first = adder.querySelector('input');
    if (first) first.focus();
  });

  const cancel = adder.querySelector('[data-cancel]');
  if (cancel) {
    cancel.addEventListener('click', function () { closeAdder(cancel); });
  }
});

// Очистить форму и свернуть её обратно в кнопку
function closeAdder(insideElement) {
  const adder = insideElement.closest('.adder');
  adder.querySelector('form').reset();
  adder.classList.remove('open');
}

// ================= Личные настройки и приветствие =================

// Ник, число дней и цель в текстах на всех экранах
function renderPersonal() {
  document.querySelectorAll('.nick').forEach(function (el) { el.textContent = NICK; });
  document.querySelectorAll('.days-total').forEach(function (el) { el.textContent = TOTAL_DAYS; });
  document.getElementById('money-goal').textContent = '→ ' + money(GOAL);
}

const welcome = document.getElementById('welcome');
const settingsForm = document.getElementById('settings-form');

// first = true — первый запуск (приветствие), false — правка настроек
function openSettings(first) {
  const s = data.settings;
  const f = settingsForm.elements;
  f.name.value = s.name || '';
  f.start.value = s.start || todayKey;
  f.days.value = s.days || 90;
  f.goal.value = s.goal || 1000;

  document.getElementById('welcome-title').textContent = first ? 'Жизнь как игра' : 'Настройки';
  document.getElementById('welcome-text').hidden = !first;
  document.getElementById('settings-cancel').hidden = first;
  document.getElementById('settings-submit').textContent = first ? 'Поехали →' : 'Сохранить';

  welcome.classList.add('open');
  if (first) f.name.focus();
}

function closeSettings() {
  welcome.classList.remove('open');
}

settingsForm.addEventListener('submit', function (event) {
  event.preventDefault();
  const f = this.elements;
  const first = needsOnboarding();
  data.settings = {
    name: f.name.value.trim(),
    start: f.start.value || todayKey,
    days: Number(f.days.value) || 90,
    goal: Number(f.goal.value) || 1000
  };
  applySettings();
  closeSettings();
  commit();
  if (first) {
    showToast('ПОЕХАЛИ, ' + data.settings.name.toUpperCase() + '!');
    vibrate([20, 40, 20]);
  }
});

document.getElementById('settings-cancel').addEventListener('click', closeSettings);
document.getElementById('open-settings').addEventListener('click', function () { openSettings(false); });

// ================= Старт =================

lastLevel = levelInfo().level;
lastIncome = moneyTotals().income;

let startTab = 'habits';
try {
  startTab = localStorage.getItem(TAB_KEY) || 'habits';
} catch (error) {
  // остаёмся на «Привычках»
}
if (!document.querySelector('[data-screen="' + startTab + '"]')) startTab = 'habits';
openTab(startTab);
renderAll(true);
if (needsOnboarding()) openSettings(true);

// PWA: service worker позволяет приложению открываться даже без интернета.
// Работает только на https или localhost (не при открытии файла двойным кликом).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(function () {
    // не получилось — сайт всё равно работает, просто без офлайна
  });
}
