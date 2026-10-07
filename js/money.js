// =====================================================
// money.js — экран «Деньги»
// =====================================================

let moneyType = 'in'; // что сейчас выбрано в форме: доход или расход

// ================= Логика =================

function moneyTotals() {
  let income = 0;
  let expense = 0;
  data.money.forEach(function (m) {
    const amount = Number(m.amount) || 0;
    if (m.type === 'in') income += amount;
    else expense += amount;
  });
  return { income: income, expense: expense, net: income - expense };
}

function addMoney(fields) {
  data.money.push({
    id: uid(),
    type: fields.type,
    amount: fields.amount,
    note: fields.note,
    date: fields.date || todayKey
  });
  vibrate(fields.type === 'in' ? [20, 40, 20] : 10);
  commit();
  if (fields.type === 'in' && moneyTotals().income < GOAL) {
    showToast('+' + money(fields.amount) + ' 💵');
  }
}

function deleteMoney(id) {
  const entry = data.money.find(function (m) { return m.id === id; });
  const text = entry.clientId
    ? 'Это оплата клиента. Удалить запись? (этап клиента не изменится)'
    : 'Удалить запись?';
  if (!confirm(text)) return;
  data.money = data.money.filter(function (m) { return m.id !== id; });
  commit();
}

// Прогноз: в каком темпе идём и успеваем ли к 90-му дню
function forecastText(income) {
  const day = challengeDay();
  const daysLeft = Math.max(1, TOTAL_DAYS - day + 1);

  if (income >= GOAL) return 'Цель взята! 🏆 Теперь ставь следующую: ' + money(GOAL * 2) + '?';
  if (income === 0) {
    return 'Чтобы успеть, нужно в среднем ' + money(GOAL / daysLeft) +
      ' в день. Один хороший заказ — и цифра сразу станет приятнее.';
  }
  const pace = income / day;
  return 'Темп: ' + money(pace) + ' в день → к ' + TOTAL_DAYS + '-му дню выйдет ~' + money(pace * TOTAL_DAYS) +
    '. Чтобы успеть, нужно ' + money((GOAL - income) / daysLeft) + ' в день.';
}

// ================= Отрисовка =================

function renderMoney() {
  const t = moneyTotals();
  const percent = Math.min(100, Math.round(t.income / GOAL * 100));

  document.getElementById('money-earned').textContent = money(t.income);
  document.getElementById('money-fill').style.width = percent + '%';
  document.getElementById('money-percent').textContent = percent + '% цели';
  document.getElementById('money-left').textContent =
    t.income >= GOAL ? 'цель достигнута 🏆' : 'осталось ' + money(GOAL - t.income);
  document.getElementById('money-spent').textContent = money(t.expense);

  const net = document.getElementById('money-net');
  net.textContent = (t.net < 0 ? '−' : '') + money(Math.abs(t.net));
  net.classList.toggle('negative', t.net < 0);

  document.getElementById('money-forecast').textContent = forecastText(t.income);

  // Таблица операций: новые сверху
  const wrap = document.getElementById('money-table');
  wrap.innerHTML = '';

  if (data.money.length === 0) {
    const empty = h('div', 'empty', 'Пока пусто. Первая запись здесь будет самой приятной');
    wrap.append(empty);
    return;
  }

  const table = h('table', 'table');
  const head = h('tr');
  ['Дата', 'За что', 'Сумма', ''].forEach(function (title) { head.append(h('th', '', title)); });
  table.append(head);

  data.money.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date);
  }).forEach(function (m) {
    const row = h('tr');
    row.append(h('td', 'td-date', fmtDate(m.date)));
    row.append(h('td', '', (m.clientId ? '👤 ' : '') + (m.note || (m.type === 'in' ? 'Доход' : 'Расход'))));
    row.append(h('td', m.type === 'in' ? 'amount-in' : 'amount-out', (m.type === 'in' ? '+' : '−') + money(m.amount)));

    const cell = h('td', 'td-del');
    const del = h('button', 'del static', '×');
    del.type = 'button';
    del.setAttribute('aria-label', 'Удалить запись');
    del.addEventListener('click', function () { deleteMoney(m.id); });
    cell.append(del);
    row.append(cell);

    table.append(row);
  });

  const box = h('div', 'table-wrap');
  box.append(table);
  wrap.append(box);
}

// ================= Кнопки и форма =================

// Переключатель «Доход / Расход»
document.querySelectorAll('#money-type button').forEach(function (button) {
  button.addEventListener('click', function () {
    moneyType = button.dataset.type;
    document.querySelectorAll('#money-type button').forEach(function (b) {
      b.classList.toggle('active', b === button);
    });
    vibrate(5);
  });
});

document.getElementById('money-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const f = this.elements;
  const amount = Math.round(Number(f.amount.value) * 100) / 100;
  if (!(amount > 0)) return;
  addMoney({ type: moneyType, amount: amount, note: f.note.value.trim(), date: f.date.value });
  closeAdder(this);
});

document.getElementById('money-csv').addEventListener('click', function () {
  const rows = [['Дата', 'Тип', 'Сумма $', 'За что']];
  data.money.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (m) {
    rows.push([m.date, m.type === 'in' ? 'Доход' : 'Расход', m.type === 'in' ? m.amount : -m.amount, m.note]);
  });
  downloadCSV('lestermun-money-' + todayKey + '.csv', rows);
});
