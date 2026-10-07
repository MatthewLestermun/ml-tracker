// =====================================================
// core.js — общие настройки и функции для всех экранов
// =====================================================

// ================= Настройки =================

const STORAGE_KEY = 'lestermun-tracker';

// Личные настройки — каждый вводит свои на приветственном экране.
// Здесь только значения по умолчанию, настоящие берутся из data.settings (см. applySettings)
let START_DATE = '2026-10-05'; // дата старта челленджа: год-месяц-день
let TOTAL_DAYS = 90;           // сколько дней длится челлендж
let GOAL = 1000;               // цель в долларах
let NICK = 'player';           // ник в строке терминала

// Сколько XP за что даём
const XP = { habit: 10, task: 20, client: 100 };
const XP_PER_LEVEL = 500;

// Привычки по умолчанию (custom: false — стандартные, со своими иконками)
const DEFAULT_HABITS = [
  { id: 'workout', name: 'Тренировка', custom: false },
  { id: 'english', name: 'Английский', custom: false },
  { id: 'vibecode', name: 'Вайбкодинг', custom: false },
  { id: 'post', name: 'Пост в TikTok/Telegram', custom: false },
  { id: 'sleep', name: 'Лёг спать до 00:00', custom: false }
];

// ================= Даты =================

// Дата в виде строки "2026-10-07" — по местному времени, а не по Гринвичу
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

// Превращаем строку "2026-10-05" обратно в дату
function parseDate(key) {
  const parts = key.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// Сдвинуть дату на N дней (N может быть отрицательным)
function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// Сколько дней между двумя датами-строками
function daysBetween(fromKey, toKey) {
  return Math.round((parseDate(toKey) - parseDate(fromKey)) / 86400000); // 86400000 мс = 1 сутки
}

// Какой это день челленджа (1, 2, 3 ...)
function dayNumber(date) {
  return daysBetween(START_DATE, dateKey(date)) + 1;
}

// День челленджа, но не меньше 1 и не больше 90
function challengeDay() {
  return Math.min(Math.max(dayNumber(new Date()), 1), TOTAL_DAYS);
}

// "9 окт."
function fmtDate(key) {
  return parseDate(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const today = new Date();
const todayKey = dateKey(today);
const tomorrowKey = dateKey(addDays(today, 1));

// ================= Хранение данных =================

// Все данные лежат в одном объекте и сохраняются в браузере (localStorage)
function emptyData() {
  return {
    habits: DEFAULT_HABITS.map(function (habit) { return Object.assign({}, habit); }),
    log: {},      // отметки привычек: { "2026-10-07": ["workout", "english"] }
    tasks: [],    // задачи
    clients: [],  // клиенты
    money: [],    // доходы и расходы
    settings: {}, // имя, дата старта, цель, сколько дней
    meta: {}      // служебное: дата последней копии и т. п.
  };
}

// Достраиваем недостающие части — на случай старых или чужих данных
function normalize(d) {
  const base = emptyData();
  if (!d || typeof d !== 'object') return base;
  return {
    habits: Array.isArray(d.habits) ? d.habits : base.habits,
    log: d.log && typeof d.log === 'object' ? d.log : {},
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    clients: Array.isArray(d.clients) ? d.clients : [],
    money: Array.isArray(d.money) ? d.money : [],
    settings: d.settings && typeof d.settings === 'object' ? d.settings : {},
    meta: d.meta && typeof d.meta === 'object' ? d.meta : {}
  };
}

// Переносим личные настройки из данных в переменные, которыми пользуются все экраны
function applySettings() {
  const s = data.settings;
  START_DATE = /^\d{4}-\d{2}-\d{2}$/.test(s.start || '') ? s.start : todayKey;
  TOTAL_DAYS = Number(s.days) > 0 ? Math.round(Number(s.days)) : 90;
  GOAL = Number(s.goal) > 0 ? Number(s.goal) : 1000;

  // Ник для терминала: маленькими буквами, пробелы → «_»
  const nick = (s.name || '').trim().toLowerCase().replace(/\s+/g, '_');
  NICK = nick || 'player';
}

// Человек ещё не прошёл приветственный экран
function needsOnboarding() {
  return !data.settings.name;
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalize(JSON.parse(saved));
  } catch (error) {
    // если хранилище недоступно — просто начинаем с чистого листа
  }
  return emptyData();
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast('НЕ СОХРАНИЛОСЬ ✗', true);
  }
}

let data = loadData();
applySettings();

// Любое изменение данных заканчивается вызовом commit():
// сохранить → проверить новый уровень / цель → перерисовать экраны
let lastLevel = null;
let lastIncome = null;

function commit() {
  saveData();

  const level = levelInfo().level;
  const income = moneyTotals().income;

  if (lastIncome !== null && lastIncome < GOAL && income >= GOAL) {
    confetti();
    showToast(money(GOAL) + ' ДОСТИГНУТО 🏆');
    vibrate([60, 60, 60, 60, 200]);
  } else if (lastLevel !== null && level > lastLevel) {
    confetti();
    showToast('LEVEL UP ↗ ' + level);
    vibrate([40, 40, 80]);
  }

  lastLevel = level;
  lastIncome = income;
  renderAll(false);
}

// ================= Мелкие помощники =================

// Уникальный id для задачи/клиента/записи
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Создать элемент: h('div', 'card', 'текст')
function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text; // textContent — безопасно для любого текста
  return el;
}

// $1,250 или $12.5 — центы показываем, только если они есть
function money(n) {
  const value = Number(n) || 0;
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Пустой список: «Пока пусто»
function emptyState(text) {
  return h('li', 'empty', text);
}

// ================= Эффекты =================

// Вибрация (работает на Android, iPhone её молча игнорирует)
function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// Вылетающий текст над элементом: «+10 XP»
function floatText(target, text, minus) {
  const rect = target.getBoundingClientRect();
  const el = h('div', 'xp-float' + (minus ? ' minus' : ''), text);
  el.style.left = (rect.right - 60) + 'px';
  el.style.top = (rect.top + 8) + 'px';
  document.body.append(el);
  setTimeout(function () { el.remove(); }, 900);
}

// Большая плашка по центру экрана
function showToast(text, warn) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.toggle('warn', Boolean(warn));
  toast.classList.remove('show');
  void toast.offsetWidth; // перезапуск анимации
  toast.classList.add('show');
}

// Конфетти
function confetti() {
  const colors = ['#C6FF4A', '#F4F5F7', '#FF8A3D'];
  for (let i = 0; i < 60; i++) {
    const piece = h('div', 'confetti');
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
    piece.style.setProperty('--spin', (Math.random() * 720) + 'deg');
    piece.style.animationDuration = (1.2 + Math.random() * 1.3) + 's';
    piece.style.animationDelay = (Math.random() * 0.3) + 's';
    document.body.append(piece);
    setTimeout(function () { piece.remove(); }, 3000);
  }
}

// ================= Скачивание файлов =================

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// Таблица для Excel: разделитель «;» и метка BOM, чтобы русские буквы открылись правильно
function downloadCSV(name, rows) {
  const csv = rows.map(function (row) {
    return row.map(function (cell) {
      const text = cell === undefined || cell === null ? '' : String(cell);
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(';');
  }).join('\r\n');
  downloadFile(name, '﻿' + csv, 'text/csv;charset=utf-8');
}
