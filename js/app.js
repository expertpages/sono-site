/* ============================================================
   SONO — фронтенд квиза
   ------------------------------------------------------------
   ⚙️ ВСЕ НАСТРОЙКИ — В БЛОКЕ CONFIG НИЖЕ.
   Когда программист даст доступы к API:
     1. MOCK_MODE поставь false
     2. Проверь API_BASE (сейчас там тестовый сервер)
     3. Цены поправь в PRICES
   ============================================================ */

const CONFIG = {
  // true = демо-режим: всё работает на заглушках, API не дёргается.
  // false = рабочий режим: сайт ходит на бэкенд за текстом/музыкой/оплатой.
  MOCK_MODE: true,

  // Адрес бэкенда (из переписки — тестовый сервер, потом поменяем на боевой)
  API_BASE: 'https://song-test.aibottools.ru',

  // Пакеты — цены взяты из бота (скрин «Покупка полной версии»: 690/890/990/1390 ₽).
  // usd — примерная цена для Lava (зарубежные карты), можно скорректировать.
  PRICES: [
    { songs: 1,  rub: 690,  usd: 9,  best: false },
    { songs: 2,  rub: 890,  usd: 12, best: false },
    { songs: 3,  rub: 990,  usd: 13, best: false },
    { songs: 10, rub: 1390, usd: 18, best: true  },
  ],

  // Время генерации (для показа прогресса в демо-режиме)
  MOCK_LYRICS_DELAY: 2500,   // мс — «пишем текст»
  MOCK_MUSIC_DELAY: 3500,    // мс — «генерим демо»
};

/* ============ ВАРИАНТЫ ОТВЕТОВ (как в боте) ============ */

const OPTIONS = {
  country:  ['🇷🇺 Россия', '🇧🇾 Беларусь', '🇰🇿 Казахстан', '🇺🇿 Узбекистан', '🇪🇺 Европа', '🌐 Другая страна'],
  occasion: ['🎁 День рождения', '🎂 Юбилей', '❤️ Любовь', '💍 Свадьба', '🥂 Годовщина', '🙏 Благодарность', '🤝 Дружба', '👨‍👩‍👧 Семья', '🎓 Выпускной', '🎄 Новый год', '✍️ Свой повод'],
  genre:    ['Поп', 'Рок', 'Рэп', 'Джаз', 'Баллада', 'Акустика', 'Танцевальная', 'Электроника', 'R&B', 'Шансон', 'Фолк', 'Блюз', 'Кантри', 'Латино'],
  vocal:    ['👨‍🎤 Мужской вокал', '👩‍🎤 Женский вокал', '🕺 Дуэт', '🎶 Хор', '👶 Детский голос', '🐂 На усмотрение ИИ'],
};

/* ============ СОСТОЯНИЕ ============ */

const state = {
  country: null,    // страна (определяет способ оплаты)
  occasion: null,    // повод
  genre: null,       // жанр песни
  vocal: null,       // вокал
  name: '',          // имя героя
  details: '',       // привычки, истории, пожелания
  email: '',         // почта для оплаты и получения песни
  orderId: null,     // id заказа с бэкенда
  lyrics: '',        // текст песни
  pack: null,        // выбранный пакет (число генераций)
};

/* ============ УТИЛИТЫ ============ */

const card = () => document.getElementById('quiz-card');
const fill = () => document.getElementById('progress-fill');
const stepLabel = () => document.getElementById('progress-step');

function setProgress(step, total) {
  fill().style.width = Math.round((step / total) * 100) + '%';
  stepLabel().textContent = 'Шаг ' + step;
}

function render(html) {
  // Кнопки шага (Дальше/Назад) отделяем в закреплённый низ карточки,
  // а остальное кладём в скролл-область — наложений быть не может.
  const idx = html.indexOf('<div class="quiz__actions"');
  const scrollPart = idx === -1 ? html : html.slice(0, idx);
  const actionsPart = idx === -1 ? '' : html.slice(idx);
  card().innerHTML =
    '<div class="quiz__scroll">' + scrollPart + '</div>' +
    (actionsPart ? '<div class="quiz__footer">' + actionsPart + '</div>' : '');
  const sc = card().querySelector('.quiz__scroll');
  if (sc) sc.scrollTop = 0;
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few;
  return many;
}

function priceOf(songs) {
  return CONFIG.PRICES.find(p => p.songs === songs) || CONFIG.PRICES[0];
}

/* ============ РЕНДЕР ШАГОВ ============ */

// Универсальный шаг с чипсами (кнопками-вариантами) — как кнопки в боте
function renderChipStep({ step, total, question, hint, options, key, next, intro }) {
  const chips = options.map((opt) =>
    `<button class="chip ${state[key] === opt ? 'chip--selected' : ''}" data-v="${esc(opt)}">${esc(opt)}</button>`
  ).join('');
  render(`
    ${intro || ''}
    <div class="quiz__question">${question}</div>
    <div class="quiz__hint">${hint}</div>
    <div class="chips">${chips}</div>
    <div class="quiz__actions">
      ${step > 1 ? '<button class="btn btn--ghost btn--back" id="btn-back">← Назад</button>' : ''}
      <button class="btn btn--accent btn--wide" id="btn-next" ${state[key] ? '' : 'disabled'}>Дальше</button>
    </div>
  `);
  setProgress(step, total);
  card().querySelectorAll('.chip').forEach(el => {
    el.addEventListener('click', () => {
      state[key] = el.dataset.v;
      card().querySelectorAll('.chip').forEach(c => c.classList.remove('chip--selected'));
      el.classList.add('chip--selected');
      document.getElementById('btn-next').disabled = false;
    });
  });
  document.getElementById('btn-next').addEventListener('click', next);
  const back = document.getElementById('btn-back');
  if (back) back.addEventListener('click', () => backTo && backTo());
}

// Шаг «Финальный штрих» — имя героя + истории/пожелания (как в боте)
function stepFinal() {
  backTo = stepVocal;
  const ok = state.name.trim().length > 0;
  render(`
    <div class="quiz__question">Финальный штрих 🎯</div>
    <div class="quiz__hint">Имя героя, забавные привычки или истории, пожелания к тексту и язык песни</div>
    <div class="field">
      <label class="input__label" for="inp-name">Имя героя</label>
      <input class="input" id="inp-name" placeholder="Например: Даша" value="${esc(state.name)}">
    </div>
    <div class="field">
      <label class="input__label" for="inp-details">Привычки, истории, пожелания</label>
      <textarea class="textarea" id="inp-details" placeholder="Например: обожает кошек, всегда смеётся над моими шутками, язык песни — русский…">${esc(state.details)}</textarea>
    </div>
    <div class="quiz__actions">
      <button class="btn btn--ghost btn--back" id="btn-back">← Назад</button>
      <button class="btn btn--accent btn--wide" id="btn-next" ${ok ? '' : 'disabled'}>Дальше</button>
    </div>
  `);
  setProgress(5, TOTAL_STEPS);
  const nameInp = document.getElementById('inp-name');
  const detailsInp = document.getElementById('inp-details');
  const btn = document.getElementById('btn-next');
  nameInp.addEventListener('input', () => {
    state.name = nameInp.value.trim();
    btn.disabled = state.name.length === 0;
  });
  detailsInp.addEventListener('input', () => { state.details = detailsInp.value.trim(); });
  document.getElementById('btn-back').addEventListener('click', () => backTo && backTo());
  nameInp.focus();
}

/* ============ ШАГИ (как в боте) ============ */

const TOTAL_STEPS = 5;

let backTo = null; // куда возвращаться по кнопке «Назад»

function stepCountry() {
  backTo = null;
  renderChipStep({
    step: 1, total: TOTAL_STEPS,
    // короткая инфа только на первом шаге — дальше сразу вопросы
    intro: `
      <div class="intro">
        <div class="intro__title">Песня в подарок за 5 минут 🎵</div>
        <div class="intro__item">🎤 ИИ пишет текст с именем и вашей историей</div>
        <div class="intro__item">🎧 Демо слушаете бесплатно</div>
        <div class="intro__item">💳 Платите, когда понравится</div>
      </div>
    `,
    question: 'Из какой ты страны?',
    hint: 'Это поможет учесть пожелания к песне и подобрать оплату',
    options: OPTIONS.country, key: 'country', next: stepOccasion,
  });
}
function stepOccasion() { backTo = stepCountry; renderChipStep({ step: 2, total: TOTAL_STEPS, question: 'Для какого повода нужна песня?', hint: '', options: OPTIONS.occasion, key: 'occasion', next: stepGenre }); }
function stepGenre()    { backTo = stepOccasion; renderChipStep({ step: 3, total: TOTAL_STEPS, question: 'Выбери жанр песни:', hint: '', options: OPTIONS.genre, key: 'genre', next: stepVocal }); }
function stepVocal()    { backTo = stepGenre;   renderChipStep({ step: 4, total: TOTAL_STEPS, question: 'Какой вокал предпочитаешь?', hint: '', options: OPTIONS.vocal, key: 'vocal', next: stepFinal }); }

/* ============ ГЕНЕРАЦИЯ ТЕКСТА ============ */

async function startGeneration() {
  backTo = stepFinal;
  setProgress(5, TOTAL_STEPS);
  render(`
    <div class="loading">
      <div class="loading__spinner"></div>
      <div class="loading__title">Пишу персональный текст песни 🎵</div>
      <div class="loading__text">Обычно это занимает несколько минут</div>
    </div>
  `);

  if (CONFIG.MOCK_MODE) {
    await sleep(CONFIG.MOCK_LYRICS_DELAY);
    state.lyrics = mockLyrics();
    state.orderId = 'demo-' + Math.random().toString(36).slice(2, 10);
  } else {
    // РЕАЛЬНЫЙ ЗАПРОС — включится, когда MOCK_MODE = false
    // await apiCreateOrder(); await apiGenerateLyrics();
  }
  renderLyrics();
}

function renderLyrics() {
  render(`
    <div class="badge-demo">Текст — бесплатно, можно переделать</div>
    <div class="quiz__question">Вот текст вашей песни 🎤</div>
    <div class="quiz__hint">Прочитайте — если что-то не так, изменим бесплатно</div>
    <div class="lyrics">${esc(state.lyrics)}</div>
    ${CONFIG.MOCK_MODE ? '<div class="mock-note">Демо-режим: текст сгенерирован заглушкой. После подключения API здесь будет настоящий текст от нейросети.</div>' : ''}
    <div class="quiz__actions">
      <button class="btn btn--ghost" id="btn-redo">✏️ Изменить текст</button>
      <button class="btn btn--accent btn--wide" id="btn-like">✅ Продолжить</button>
    </div>
  `);
  document.getElementById('btn-redo').addEventListener('click', startGeneration);
  document.getElementById('btn-like').addEventListener('click', startDemo);
}

/* ============ ГЕНЕРАЦИЯ ДЕМО ============ */

async function startDemo() {
  render(`
    <div class="loading">
      <div class="loading__spinner"></div>
      <div class="loading__title">Создаю музыку и короткий демо-фрагмент 🎧</div>
      <div class="loading__text">Обычно до 5 минут, в часы пик до 20</div>
    </div>
  `);
  if (CONFIG.MOCK_MODE) {
    await sleep(CONFIG.MOCK_MUSIC_DELAY);
  } else {
    // await apiGenerateMusic();
  }
  renderDemo();
}

function renderDemo() {
  const bars = Array.from({ length: 24 }, (_, i) => `<span style="animation-delay:${(i * 0.07).toFixed(2)}s"></span>`).join('');
  render(`
    <div class="badge-demo">🎁 Фрагмент песни (demo) · 0:30</div>
    <div class="quiz__question">Послушайте, как это звучит</div>
    <div class="player">
      <button class="player__btn" id="btn-play">▶</button>
      <div class="player__info">
        <div class="player__name">${esc(state.occasion ? state.occasion.replace(/^\S+\s/, '') : '')} — ${esc(state.genre || '')}</div>
        <div class="player__time">0:30 · ${esc(state.genre || '')}</div>
        <div class="player__wave">${bars}</div>
      </div>
    </div>
    ${CONFIG.MOCK_MODE ? '<div class="mock-note">Демо-режим: аудио пока не подключено. Здесь будет настоящий 30-секундный фрагмент вашей песни.</div>' : ''}
    <div class="quiz__hint" style="margin-top:14px;">🔥 Понравилось? Забирай полную версию!</div>
    <div class="quiz__actions">
      <button class="btn btn--ghost" id="btn-lyrics-back">← Текст</button>
      <button class="btn btn--accent btn--wide" id="btn-pay">💎 Скачать полную версию</button>
    </div>
  `);
  document.getElementById('btn-play').addEventListener('click', function () {
    if (CONFIG.MOCK_MODE) {
      this.textContent = this.textContent === '▶' ? '⏸' : '▶';
    }
  });
  document.getElementById('btn-lyrics-back').addEventListener('click', renderLyrics);
  document.getElementById('btn-pay').addEventListener('click', stepPack);
}

/* ============ ВЫБОР ПАКЕТА (как в боте) ============ */

function stepPack() {
  const options = CONFIG.PRICES.map(p => `
    <button class="pay-option ${state.pack === p.songs ? 'pay-option--selected' : ''}" data-songs="${p.songs}">
      <div class="pay-option__songs">${p.songs} ${plural(p.songs, 'генерация', 'генерации', 'генераций')}</div>
      <div class="pay-option__price">${p.rub} ₽${p.best ? ' · 💎 выгоднее всего' : ''}</div>
    </button>
  `).join('');

  render(`
    <div class="quiz__question">💳 Покупка полной версии</div>
    <div class="quiz__hint">Выбери пакет:</div>
    <div class="pay-grid">${options}</div>
    <div class="quiz__actions">
      <button class="btn btn--ghost btn--back" id="btn-back">← Демо</button>
      <button class="btn btn--accent btn--wide" id="btn-next" ${state.pack ? '' : 'disabled'}>Дальше</button>
    </div>
  `);
  setProgress(5, TOTAL_STEPS);

  const packBtns = card().querySelectorAll('.pay-option');
  const nextBtn = document.getElementById('btn-next');
  packBtns.forEach(btn => btn.addEventListener('click', () => {
    packBtns.forEach(b => b.classList.remove('pay-option--selected'));
    btn.classList.add('pay-option--selected');
    state.pack = Number(btn.dataset.songs);
    nextBtn.disabled = false;
  }));
  nextBtn.addEventListener('click', stepEmail);
  document.getElementById('btn-back').addEventListener('click', renderDemo);
}

/* ============ ПОЧТА (как в боте — перед оплатой) ============ */

function stepEmail() {
  backTo = stepPack;
  render(`
    <div class="quiz__question">Почта для оплаты 📧</div>
    <div class="quiz__hint">Напиши адрес электронной почты для оформления оплаты — на него придёт полная версия песни</div>
    <div class="field">
      <input class="input" id="inp" type="email" placeholder="you@mail.ru" value="${esc(state.email)}" autocomplete="email">
      <div class="error-text" id="err">Проверьте адрес почты</div>
    </div>
    <div class="quiz__actions">
      <button class="btn btn--ghost btn--back" id="btn-back">← Назад</button>
      <button class="btn btn--accent btn--wide" id="btn-next" ${state.email ? '' : 'disabled'}>Дальше</button>
    </div>
  `);
  setProgress(5, TOTAL_STEPS);
  const inp = document.getElementById('inp');
  const btn = document.getElementById('btn-next');
  const valid = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  inp.addEventListener('input', () => {
    state.email = inp.value.trim();
    const ok = valid(state.email);
    btn.disabled = !ok;
    document.getElementById('err').style.display = (state.email && !ok) ? 'block' : 'none';
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && valid(state.email)) renderSummary(); });
  btn.addEventListener('click', renderSummary);
  document.getElementById('btn-back').addEventListener('click', () => backTo && backTo());
  inp.focus();
}

/* ============ ИТОГ И ОПЛАТА (как в боте) ============ */

function renderSummary() {
  const p = priceOf(state.pack);
  const rest = p.songs - 1;
  const fromRussia = state.country === '🇷🇺 Россия';
  const method = fromRussia
    ? '💳 Оплата картой РФ / СБП (ЮKassa)'
    : '🌍 Оплата зарубежной картой (Lava)';
  const amount = fromRussia ? p.rub + ' ₽' : '$' + p.usd;

  render(`
    <div class="quiz__question">💳 Покупка полной версии</div>
    <div class="summary">
      Пакет: ${p.songs} ${plural(p.songs, 'генерация', 'генерации', 'генераций')}<br>
      Сумма: <b>${amount}</b><br><br>
      После оплаты одна генерация пойдёт на эту песню, ещё ${rest} ${plural(rest, 'останется', 'останутся', 'останутся')} на балансе.
    </div>
    ${CONFIG.MOCK_MODE ? '<div class="mock-note">Демо-режим: кнопка не ведёт на реальную оплату. После подключения ключей здесь будет переход на ЮKassa (РФ) или Lava (другие страны).</div>' : ''}
    <div class="pay-methods" style="margin-top:18px;">
      <button class="btn btn--accent" id="btn-pay-go">💳 Перейти к оплате</button>
      <button class="btn" id="btn-check">✅ Проверить оплату</button>
      <button class="btn btn--ghost" id="btn-change">🔄 Изменить пакет</button>
    </div>
    <div class="quiz__hint" style="margin-top:12px;">${method}</div>
  `);
  document.getElementById('btn-pay-go').addEventListener('click', () => pay(fromRussia ? 'yookassa' : 'lava'));
  document.getElementById('btn-check').addEventListener('click', checkPayment);
  document.getElementById('btn-change').addEventListener('click', stepPack);
}

async function pay(provider) {
  render(`
    <div class="loading">
      <div class="loading__spinner"></div>
      <div class="loading__title">Создаём ссылку на оплату…</div>
      <div class="loading__text">${provider === 'yookassa' ? 'ЮKassa' : 'Lava'} · обычно пару секунд</div>
    </div>
  `);
  if (CONFIG.MOCK_MODE) {
    await sleep(1200);
    renderSuccess(true);
    return;
  }
  // РЕАЛЬНАЯ ОПЛАТА — включится после доступов:
  // const url = await apiCreatePayment(provider);
  // window.location.href = url;
}

async function checkPayment() {
  render(`
    <div class="loading">
      <div class="loading__spinner"></div>
      <div class="loading__title">Проверяем оплату…</div>
      <div class="loading__text">Если всё ок — сразу пришлём песню на почту</div>
    </div>
  `);
  if (CONFIG.MOCK_MODE) {
    await sleep(1500);
    renderSuccess(true);
    return;
  }
  // await apiConfirmPayment();
}

function renderSuccess(mock = false) {
  render(`
    <div class="success-check">✓</div>
    <div class="quiz__question" style="text-align:center;">Всё получилось!</div>
    <div class="quiz__hint" style="text-align:center;">
      ${mock
        ? 'Это демо: после подключения API здесь будет оплата, а полная версия песни придёт на <b>' + esc(state.email) + '</b>.'
        : 'Полная версия песни отправлена на <b>' + esc(state.email) + '</b>. Если письма нет — проверьте папку «Спам».'}
    </div>
    <div class="quiz__actions" style="justify-content:center;">
      <button class="btn btn--accent" id="btn-again">🎵 Создать ещё одну</button>
    </div>
  `);
  document.getElementById('btn-again').addEventListener('click', resetQuiz);
}

function resetQuiz() {
  Object.assign(state, { country: null, occasion: null, genre: null, vocal: null, name: '', details: '', email: '', orderId: null, lyrics: '', pack: null });
  stepCountry();
}

/* ============ ЗАГЛУШКА ТЕКСТА (только для MOCK_MODE) ============ */

function mockLyrics() {
  const n = state.name || 'дорогой человек';
  const d = state.details
    ? 'Вспомним, как ' + state.details.charAt(0).toLowerCase() + state.details.slice(1, 90).replace(/[.,;!?]$/, '') + '…'
    : 'Каждый миг с тобою — как подарок судьбы…';
  return (
`[Припев]
${n} крутая, и в этом нет сомнений,
Ты — душа из всех моих решений и стремлений.
${n} крутая, мой близкий человек,
Моя любовь к тебе — один огромный, мощный трек.

[Куплет]
${d}
Ты лучше всех, ты топ, ты класс, я прямо говорю,
Ценю твой вайб, ценю тебя, и искренне люблю.

[Припев]
${n} крутая, и в этом нет сомнений,
Ты — душа из всех моих решений и стремлений.`);
}

/* ============ БУДУЩИЕ API-ФУНКЦИИ (пока не активны) ============ */
/* Заполним, когда программист даст доступы и откроет CORS.
   Схема из переписки: POST /senler/songs → order.id → /lyrics → /music → /payment → /payment/confirm

async function apiCreateOrder() {
  const res = await fetch(CONFIG.API_BASE + '/senler/songs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Senler-Secret': '<секретный ключ — выдаст программист>',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      country: state.country,
      occasion: state.occasion,
      genre: state.genre,
      vocal: state.vocal,
      name: state.name,
      details: state.details,
    }),
  });
  const data = await res.json();
  state.orderId = data.id;
}

async function apiGenerateLyrics() {
  const res = await fetch(CONFIG.API_BASE + '/lyrics', { ... });
  state.lyrics = (await res.json()).lyrics;
}

async function apiGenerateMusic() {
  const res = await fetch(CONFIG.API_BASE + '/music', { ... });
  // затем достаём ссылку на демо-фрагмент и ставим в <audio>
}

async function apiCreatePayment(provider) {
  // provider: 'yookassa' (РФ) | 'lava' (другие страны)
  const res = await fetch(CONFIG.API_BASE + '/payment', { ... });
  return (await res.json()).payment_url;
}

async function apiConfirmPayment() {
  const res = await fetch(CONFIG.API_BASE + '/payment/confirm', { ... });
}
*/

/* ============ СТАРТ ============ */

stepCountry();
