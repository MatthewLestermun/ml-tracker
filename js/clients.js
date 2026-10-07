// =====================================================
// clients.js — экран «Клиенты» (мини-CRM)
// =====================================================

// Этапы работы с клиентом. Порядок важен: от «нашёл» до «оплачено»
const STAGES = [
  { id: 'found', name: 'Нашёл', color: '#9A9DA6' },
  { id: 'pitched', name: 'Написал', color: '#6FA8FF' },
  { id: 'replied', name: 'Ответил', color: '#B98CFF' },
  { id: 'talks', name: 'Переговоры', color: '#FFD23F' },
  { id: 'work', name: 'В работе', color: '#FF8A3D' },
  { id: 'paid', name: 'Оплачено', color: '#C6FF4A' },
  { id: 'lost', name: 'Отказ', color: '#5A5D66' }
];
const PAID_INDEX = 5;

let clientFilter = 'active';

// ================= Логика =================

function stageIndex(id) {
  return STAGES.findIndex(function (s) { return s.id === id; });
}

function stageOf(client) {
  return STAGES[stageIndex(client.stage)] || STAGES[0];
}

function isClosed(client) {
  return client.stage === 'paid' || client.stage === 'lost';
}

// Пора написать клиенту (дата напоминания сегодня или раньше)
function isFollowUpDue(client) {
  return !isClosed(client) && client.nextDate && client.nextDate <= todayKey;
}

function addClient(fields) {
  data.clients.push({
    id: uid(),
    name: fields.name,
    offer: fields.offer,
    price: Number(fields.price) || 0,
    contact: fields.contact,
    nextDate: fields.nextDate,
    stage: 'found',
    maxStage: 0, // самый дальний этап, до которого дошли (нужно для воронки)
    created: todayKey
  });
  vibrate(15);
  commit();
}

function setStage(id, stageId, card) {
  const client = data.clients.find(function (c) { return c.id === id; });
  const was = client.stage;
  if (was === stageId) return;

  client.stage = stageId;
  const index = stageIndex(stageId);
  if (stageId !== 'lost' && index > (client.maxStage || 0)) client.maxStage = index;
  if (isClosed(client)) client.nextDate = '';

  // Оплатили → доход автоматически попадает в «Деньги»
  if (stageId === 'paid' && client.price > 0) {
    data.money.push({
      id: uid(),
      type: 'in',
      amount: client.price,
      note: 'Клиент: ' + client.name,
      date: todayKey,
      clientId: client.id
    });
  }
  // Передумали «оплачено» → убираем этот доход
  if (was === 'paid') {
    data.money = data.money.filter(function (m) { return m.clientId !== client.id; });
  }

  vibrate(stageId === 'paid' ? [30, 50, 30, 50, 120] : 10);
  commit();

  if (stageId === 'paid') {
    confetti();
    showToast('ОПЛАЧЕНО +' + money(client.price));
  } else if (card && index > stageIndex(was) && stageId !== 'lost') {
    floatText(card, '→ ' + STAGES[index].name);
  }
}

function setNextDate(id, value) {
  const client = data.clients.find(function (c) { return c.id === id; });
  client.nextDate = value;
  commit();
}

function deleteClient(id) {
  if (!confirm('Удалить клиента? Его оплата в «Деньгах» тоже удалится.')) return;
  data.clients = data.clients.filter(function (c) { return c.id !== id; });
  data.money = data.money.filter(function (m) { return m.clientId !== id; });
  commit();
}

// Сначала те, кому пора написать, потом те, кто ближе к оплате
function sortClients(list) {
  return list.slice().sort(function (a, b) {
    const dueA = isFollowUpDue(a) ? 0 : 1;
    const dueB = isFollowUpDue(b) ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    const stageDiff = stageIndex(b.stage) - stageIndex(a.stage);
    if (stageDiff !== 0) return stageDiff;
    return (b.created || '').localeCompare(a.created || '');
  });
}

// ================= Отрисовка =================

function renderFunnel() {
  const total = data.clients.length;
  const pitched = data.clients.filter(function (c) { return (c.maxStage || 0) >= 1; }).length;
  const replied = data.clients.filter(function (c) { return (c.maxStage || 0) >= 2; }).length;
  const paid = data.clients.filter(function (c) { return c.stage === 'paid'; }).length;

  // Конверсия — какой процент от тех, кому написал
  function pct(n) {
    return pitched ? ' · ' + Math.round(n / pitched * 100) + '%' : '';
  }

  const steps = [
    { value: total, label: 'в базе' },
    { value: pitched, label: 'написал' },
    { value: replied, label: 'ответили' + pct(replied) },
    { value: paid, label: 'купили' + pct(paid), accent: true }
  ];

  const funnel = document.getElementById('funnel');
  funnel.innerHTML = '';
  steps.forEach(function (step) {
    const box = h('div', 'funnel-step' + (step.accent ? ' accent' : ''));
    box.append(h('b', '', step.value), h('span', '', step.label));
    const bar = h('i', 'funnel-bar');
    bar.style.width = (total ? step.value / total * 100 : 0) + '%';
    box.append(bar);
    funnel.append(box);
  });
}

function renderClients() {
  renderFunnel();

  const due = data.clients.filter(isFollowUpDue);
  const inProgress = data.clients.filter(function (c) { return c.stage === 'talks' || c.stage === 'work'; });
  const pipeline = inProgress.reduce(function (sum, c) { return sum + (Number(c.price) || 0); }, 0);

  const chips = document.getElementById('client-chips');
  chips.innerHTML = '';
  if (due.length) chips.append(h('span', 'chip warn', '⏰ ' + due.length + ' написать сегодня'));
  chips.append(h('span', 'chip', '💼 на подходе ' + money(pipeline)));

  const active = data.clients.filter(function (c) { return !isClosed(c); });
  const paid = data.clients.filter(function (c) { return c.stage === 'paid'; });
  const counts = { active: active.length, paid: paid.length, all: data.clients.length };
  const names = { active: 'В работе', paid: 'Оплатили', all: 'Все' };
  document.querySelectorAll('#client-filter button').forEach(function (button) {
    const f = button.dataset.filter;
    button.textContent = names[f] + ' · ' + counts[f];
    button.classList.toggle('active', f === clientFilter);
  });

  const shown = clientFilter === 'paid' ? paid : clientFilter === 'all' ? data.clients : active;
  const list = document.getElementById('client-list');
  list.innerHTML = '';

  if (shown.length === 0) {
    const texts = {
      active: 'Пока никого. Найди 5 местных бизнесов без нормального сайта и запиши сюда',
      paid: 'Первая оплата будет здесь. Ты ближе, чем кажется 💵',
      all: 'Клиентов пока нет'
    };
    list.append(emptyState(texts[clientFilter]));
    return;
  }

  sortClients(shown).forEach(function (client) {
    const stage = stageOf(client);
    const index = stageIndex(client.stage);
    const item = h('li', 'client' + (client.stage === 'lost' ? ' lost' : ''));
    item.style.setProperty('--stage', stage.color);

    // Имя и цена
    const top = h('div', 'client-top');
    top.append(h('span', 'client-name', client.name));
    if (client.price) top.append(h('span', 'client-price', money(client.price)));
    item.append(top);

    // Что продаю · контакт
    const sub = [client.offer, client.contact].filter(Boolean).join(' · ');
    if (sub) item.append(h('div', 'client-sub', sub));

    const actions = h('div', 'client-actions');

    // Выпадающий список этапов
    const select = h('select', 'stage-select');
    STAGES.forEach(function (s) {
      const option = h('option', '', s.name);
      option.value = s.id;
      option.selected = s.id === client.stage;
      select.append(option);
    });
    select.style.color = stage.color;
    select.style.borderColor = stage.color;
    select.setAttribute('aria-label', 'Этап');
    select.addEventListener('change', function () { setStage(client.id, select.value, item); });
    actions.append(select);

    // Кнопка «→ следующий этап»
    if (index < PAID_INDEX) {
      const next = h('button', 'next-btn', '→ ' + STAGES[index + 1].name);
      next.type = 'button';
      next.addEventListener('click', function () { setStage(client.id, STAGES[index + 1].id, item); });
      actions.append(next);
    }
    item.append(actions);

    // Напоминание «когда написать»
    if (!isClosed(client)) {
      const follow = h('label', 'followup' + (isFollowUpDue(client) ? ' due' : ''));
      let label = '⏰ написать: ';
      if (isFollowUpDue(client)) label = client.nextDate < todayKey ? '⏰ пора написать (с ' + fmtDate(client.nextDate) + ') ' : '⏰ написать сегодня ';
      follow.append(label);
      const date = h('input', 'date-mini');
      date.type = 'date';
      date.value = client.nextDate || '';
      date.addEventListener('change', function () { setNextDate(client.id, date.value); });
      follow.append(date);
      item.append(follow);
    }

    const del = h('button', 'del', '×');
    del.type = 'button';
    del.setAttribute('aria-label', 'Удалить клиента');
    del.addEventListener('click', function () { deleteClient(client.id); });
    item.append(del);

    list.append(item);
  });
}

// ================= Кнопки и форма =================

document.getElementById('client-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const f = this.elements;
  const name = f.name.value.trim();
  if (!name) return;
  addClient({
    name: name,
    offer: f.offer.value.trim(),
    price: f.price.value,
    contact: f.contact.value.trim(),
    nextDate: f.nextDate.value
  });
  closeAdder(this);
});

document.querySelectorAll('#client-filter button').forEach(function (button) {
  button.addEventListener('click', function () {
    clientFilter = button.dataset.filter;
    vibrate(5);
    renderClients();
  });
});

document.getElementById('clients-csv').addEventListener('click', function () {
  const rows = [['Клиент', 'Что продаю', 'Цена $', 'Контакт', 'Этап', 'Написать', 'Добавлен']];
  sortClients(data.clients).forEach(function (c) {
    rows.push([c.name, c.offer, c.price, c.contact, stageOf(c).name, c.nextDate, c.created]);
  });
  downloadCSV('lestermun-clients-' + todayKey + '.csv', rows);
});
