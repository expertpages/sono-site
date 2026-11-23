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
  editNote: '',      // что человек просил исправить в тексте
  pack: null,        // выбранный пакет (число генераций)
  fullSongUrl: null, // ссылка на полную версию (придёт с бэкенда после оплаты)
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
  if (sc) {
    sc.scrollTop = 0;
    // шаги без вариантов — центрируем по вертикали, чтобы не было пустоты
    sc.style.justifyContent = scrollPart.indexOf('chips') === -1 ? 'center' : 'flex-start';
  }
}

/* Подгоняем кнопки-варианты так, чтобы ВСЕ были видны сразу без листания:
   пробуем раскладки от самой крупной к самой плотной и берём первую,
   которая влезает на экран. */
function sizeChips() {
  const sc = card().querySelector('.quiz__scroll');
  const wrap = card().querySelector('.chips');
  const chips = card().querySelectorAll('.chip');
  const n = chips.length;
  if (!sc || !wrap || !n) return;
  chips.forEach(c => { c.style.height = ''; c.style.fontSize = ''; });

  // высота всего, что выше кнопок (заголовок, подсказка и т.д.)
  let otherH = 0;
  [...sc.children].forEach(el => {
    if (el === wrap) return;
    const cs = getComputedStyle(el);
    otherH += el.offsetHeight + parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
  });
  const scs = getComputedStyle(sc);
  const padV = parseFloat(scs.paddingTop || 0) + parseFloat(scs.paddingBottom || 0);
  const avail = sc.clientHeight - padV - otherH;

  // раскладки: крупный один столбик → два столбца → три столбца
  const configs = [
    { cols: 1, minH: 52, gap: 10, fs: 16 },
    { cols: 2, minH: 40, gap: 8,  fs: 15 },
    { cols: 3, minH: 34, gap: 6,  fs: 13.5 },
  ];

  let chosen = null;
  for (const cfg of configs) {
    const rows = Math.ceil(n / cfg.cols);
    const h = Math.floor((avail - (rows - 1) * cfg.gap) / rows);
    if (h >= cfg.minH) { chosen = { ...cfg, rows, h: Math.min(h, 120) }; break; }
  }
  if (!chosen) {
    // совсем маленький экран: самая плотная раскладка, кнопки минимальные
    const cfg = configs[configs.length - 1];
    chosen = { ...cfg, rows: Math.ceil(n / cfg.cols), h: cfg.minH };
  }

  wrap.style.gridTemplateColumns = 'repeat(' + chosen.cols + ', 1fr)';
  wrap.style.gap = chosen.gap + 'px';
  chips.forEach(c => {
    c.style.height = chosen.h + 'px';
    c.style.fontSize = chosen.fs + 'px';
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Экран загрузки: пульсирующая нота + живой статус + полоска прогресса */
let loadingTimer = null;
function renderLoading({ icon, title, steps }) {
  stopLoading();
  render(`
    <div class="loading loading--big">
      <div class="loading__icon">${icon}</div>
      <div class="loading__title">${title}</div>
      <div class="loading__status" id="loading-status">${steps[0]}</div>
      <div class="loading__bar"><div class="loading__bar-fill" id="loading-bar"></div></div>
    </div>
  `);
  let i = 0;
  let progress = 8;
  loadingTimer = setInterval(() => {
    i = (i + 1) % steps.length;
    progress = Math.min(92, progress + 12);
    const s = document.getElementById('loading-status');
    const b = document.getElementById('loading-bar');
    if (s) s.textContent = steps[i];
    if (b) b.style.width = progress + '%';
  }, 2200);
}
function stopLoading() {
  if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
}

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
    ${hint ? '<div class="quiz__hint">' + hint + '</div>' : ''}
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
  requestAnimationFrame(sizeChips); // подгоняем кнопки после отрисовки
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
  // нажатие «Дальше» → запускаем генерацию текста
  btn.addEventListener('click', () => { if (!btn.disabled) startGeneration(); });
  nameInp.addEventListener('keydown', e => { if (e.key === 'Enter' && state.name) { e.preventDefault(); startGeneration(); } });
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
  const editing = !!state.editNote;
  renderLoading({
    icon: editing ? '✏️' : '🎵',
    title: editing ? 'Правлю текст с учётом пожеланий' : 'Пишу персональный текст песни',
    steps: editing
      ? ['Читаю, что поправить…', 'Переписываю строки…', 'Сохраняю вайб песни…']
      : ['Читаю вашу историю…', 'Придумываю рифмы…', 'Вплетаю имя в припев…', 'Полирую строки…'],
  });

  if (CONFIG.MOCK_MODE) {
    await sleep(CONFIG.MOCK_LYRICS_DELAY);
    state.lyrics = mockLyrics();
    state.orderId = 'demo-' + Math.random().toString(36).slice(2, 10);
  } else {
    // РЕАЛЬНЫЙ ЗАПРОС — включится, когда MOCK_MODE = false
    // await apiCreateOrder(); await apiGenerateLyrics();
  }
  stopLoading();
  renderLyrics();
}

function renderLyrics() {
  render(`
    <div class="badge-demo">Текст — бесплатно, можно переделать</div>
    <div class="quiz__question">Вот текст вашей песни 🎤</div>
    <div class="quiz__hint">Прочитайте — если что-то не так, напишите что исправить, и ИИ перепишет бесплатно</div>
    <div class="lyrics">${esc(state.lyrics)}</div>
    ${CONFIG.MOCK_MODE ? '<div class="mock-note">Демо-режим: текст сгенерирован заглушкой. После подключения API здесь будет настоящий текст от нейросети.</div>' : ''}
    <div class="quiz__actions">
      <button class="btn btn--ghost" id="btn-redo">✏️ Изменить текст</button>
      <button class="btn btn--accent btn--wide" id="btn-like">✅ Продолжить</button>
    </div>
  `);
  document.getElementById('btn-redo').addEventListener('click', renderEditNote);
  document.getElementById('btn-like').addEventListener('click', startDemo);
}

/* Экран правок: человек пишет своими словами, что исправить в тексте */
function renderEditNote() {
  render(`
    <div class="quiz__question">Что исправить? ✏️</div>
    <div class="quiz__hint">Напиши своими словами — ИИ перепишет текст с учётом пожеланий</div>
    <div class="field">
      <textarea class="textarea" id="inp-edit" placeholder="Например: добавь куплет про её кота, сделай припев веселее, убери про зиму…">${esc(state.editNote)}</textarea>
      <div class="error-text" id="err">Напиши хотя бы пару слов, что поправить</div>
    </div>
    <div class="quiz__hint" style="margin-bottom:0;">Правки бесплатные — до оплаты можно переделывать сколько нужно</div>
    <div class="quiz__actions">
      <button class="btn btn--ghost" id="btn-back">← К тексту</button>
      <button class="btn btn--accent btn--wide" id="btn-fix" ${state.editNote ? '' : 'disabled'}>Исправить</button>
    </div>
  `);
  const inp = document.getElementById('inp-edit');
  const btn = document.getElementById('btn-fix');
  inp.addEventListener('input', () => {
    state.editNote = inp.value.trim();
    btn.disabled = state.editNote.length === 0;
    document.getElementById('err').style.display = 'none';
  });
  document.getElementById('btn-back').addEventListener('click', renderLyrics);
  btn.addEventListener('click', () => { if (!btn.disabled) startGeneration(); });
  inp.focus();
}

/* ============ ГЕНЕРАЦИЯ ДЕМО ============ */

async function startDemo() {
  renderLoading({
    icon: '🎧',
    title: 'Создаю музыку и демо-фрагмент',
    steps: ['Подбираю инструменты…', 'Записываю вокал…', 'Свожу трек…', 'Вырезаю демо 30 секунд…'],
  });
  if (CONFIG.MOCK_MODE) {
    await sleep(CONFIG.MOCK_MUSIC_DELAY);
  } else {
    // await apiGenerateMusic();
  }
  stopLoading();
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
        <div class="player__time" id="demo-time">0:00 · 0:30 · ${esc(state.genre || '')}</div>
        <div class="player__wave">${bars}</div>
      </div>
    </div>
    ${CONFIG.MOCK_MODE ? '<div class="mock-note">Демо-режим: пока играет демонстрационная мелодия. После подключения API здесь будет настоящий 30-секундный фрагмент вашей песни.</div>' : ''}
    <div class="quiz__hint" style="margin-top:14px;">🔥 Понравилось? Забирай полную версию!</div>
    <div class="quiz__actions">
      <button class="btn btn--ghost" id="btn-lyrics-back">← Текст</button>
      <button class="btn btn--accent btn--wide" id="btn-pay">💎 Скачать полную версию</button>
    </div>
  `);

  // плеер: играет демо-мелодию (в рабочем режиме — фрагмент настоящей песни)
  const playBtn = document.getElementById('btn-play');
  const timeEl = document.getElementById('demo-time');
  const url = state.demoUrl || 'demo-song.wav';
  const audio = new Audio(url);
  stopDemoAudio();
  demoAudio = audio;
  audio.addEventListener('timeupdate', () => {
    timeEl.textContent = fmtTime(audio.currentTime) + ' · 0:30 · ' + (state.genre || '');
  });
  audio.addEventListener('ended', () => { playBtn.textContent = '▶'; });
  playBtn.addEventListener('click', () => {
    if (audio.paused) { audio.play(); playBtn.textContent = '⏸'; }
    else { audio.pause(); playBtn.textContent = '▶'; }
  });

  document.getElementById('btn-lyrics-back').addEventListener('click', () => { stopDemoAudio(); renderLyrics(); });
  document.getElementById('btn-pay').addEventListener('click', () => { stopDemoAudio(); stepPack(); });
}

let demoAudio = null;
function stopDemoAudio() {
  if (demoAudio) { demoAudio.pause(); demoAudio.src = ''; demoAudio = null; }
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
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
  // ЛОГИКА ОПЛАТЫ: выбрали Россию → ЮKassa, любую другую страну → Lava.top
  const fromRussia = state.country === '🇷🇺 Россия';
  const provider = fromRussia ? 'yookassa' : 'lava';
  const method = fromRussia
    ? '💳 Способ: карта РФ / СБП — ЮKassa'
    : '🌍 Способ: зарубежная карта — Lava';
  const amount = fromRussia ? p.rub + ' ₽' : '$' + p.usd;
  const note = fromRussia
    ? ''
    : '<div class="quiz__hint" style="margin-top:12px;">Сумма в долларах — пересчёт по курсу Банка России на момент оплаты</div>';
  const payName = fromRussia ? 'ЮKassa' : 'Lava.top';
  const mockNote = CONFIG.MOCK_MODE
    ? '<div class="mock-note">Демо-режим: кнопка не ведёт на реальную оплату. После подключения ключей «Перейти к оплате» откроет ' + payName + '.</div>'
    : '';

  render(`
    <div class="quiz__question">💳 Покупка полной версии</div>
    <div class="summary">
      Пакет: ${p.songs} ${plural(p.songs, 'генерация', 'генерации', 'генераций')}<br>
      Сумма: <b>${amount}</b><br>
      ${method}<br><br>
      После оплаты одна генерация пойдёт на эту песню, ещё ${rest} ${plural(rest, 'останется', 'останутся', 'останутся')} на балансе.
    </div>
    ${mockNote}
    <div class="pay-methods" style="margin-top:18px;">
      <button class="btn btn--accent" id="btn-pay-go">💳 Перейти к оплате</button>
      <button class="btn" id="btn-check">✅ Проверить оплату</button>
      <button class="btn btn--ghost" id="btn-change">🔄 Изменить пакет</button>
    </div>
    ${note}
  `);
  document.getElementById('btn-pay-go').addEventListener('click', () => pay(provider));
  document.getElementById('btn-check').addEventListener('click', checkPayment);
  document.getElementById('btn-change').addEventListener('click', stepPack);
}

async function pay(provider) {
  renderLoading({
    icon: '💳',
    title: 'Открываю ' + (provider === 'yookassa' ? 'ЮKassa' : 'Lava'),
    steps: ['Формирую счёт на оплату…', 'Чек придёт на ' + state.email, 'Готовлю ссылку…'],
  });
  if (CONFIG.MOCK_MODE) {
    await sleep(2200);
    stopLoading();
    renderSuccess(true);
    return;
  }
  // РЕАЛЬНАЯ ОПЛАТА — включится после доступов:
  // provider = 'yookassa' (Россия) или 'lava' (другие страны)
  // const url = await apiCreatePayment(provider);
  // window.location.href = url;
}

async function checkPayment() {
  renderLoading({
    icon: '⏳',
    title: 'Проверяю оплату',
    steps: ['Запрашиваю статус счёта…', 'Сверяю платежи…'],
  });
  if (CONFIG.MOCK_MODE) {
    await sleep(1800);
    stopLoading();
    renderSuccess(true);
    return;
  }
  // await apiConfirmPayment();
}

function renderSuccess(mock = false) {
  // ссылка на полную версию: в рабочем режиме приходит с бэкенда после оплаты,
  // в демо — пример мелодии
  const songUrl = state.fullSongUrl || 'demo-song.wav';
  const fileName = 'Sono — песня для ' + (state.name || 'вас') + '.wav';
  render(`
    <div class="success-check">✓</div>
    <div class="quiz__question" style="text-align:center;">Всё получилось! 🎉</div>
    <div class="quiz__hint" style="text-align:center;">
      ${mock
        ? 'Демо-режим: по кнопке скачается пример песни (заглушка). В рабочем режиме здесь будет ваша настоящая песня.'
        : 'Мы отправили песню и на почту <b>' + esc(state.email) + '</b>. Если письма нет — проверьте папку «Спам».'}
    </div>
    <div class="success-actions">
      <a class="btn btn--accent btn--wide" href="${songUrl}" download="${esc(fileName)}">⬇️ Скачать полную версию</a>
      <button class="btn btn--ghost btn--wide" id="btn-again">🎵 Создать ещё одну</button>
    </div>
  `);
  document.getElementById('btn-again').addEventListener('click', resetQuiz);
}

function resetQuiz() {
  stopDemoAudio();
  Object.assign(state, { country: null, occasion: null, genre: null, vocal: null, name: '', details: '', email: '', orderId: null, lyrics: '', editNote: '', pack: null, fullSongUrl: null });
  stepCountry();
}

/* ============ ЗАГЛУШКА ТЕКСТА (только для MOCK_MODE) ============ */

function mockLyrics() {
  const n = state.name || 'дорогой человек';
  // варианты, чтобы при каждой генерации/правке текст визуально менялся
  const hooks = [
    'крутая, и в этом нет сомнений',
    'лучше всех на свете, без сомнений',
    'самая любимая, без сомнений',
  ];
  const ends = [
    'Моя любовь к тебе — один огромный, мощный трек.',
    'С тобой любой мой день — как хит на весь мир.',
    'И это лишь начало нашей большой истории.',
  ];
  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  const end = ends[Math.floor(Math.random() * ends.length)];
  const d = state.details
    ? 'Вспомним, как ' + state.details.charAt(0).toLowerCase() + state.details.slice(1, 90).replace(/[.,;!?]$/, '') + '…'
    : 'Каждый миг с тобою — как подарок судьбы…';
  // если человек просил что-то исправить — показываем, что пожелание учтено (только для демо)
  const fix = state.editNote
    ? `\n\n(Демо-заглушка учла пожелание: «${state.editNote}». В рабочем режиме ИИ перепишет текст по-настоящему.)`
    : '';
  return (
`[Припев]
${n} ${hook},
Ты — душа из всех моих решений и стремлений.
${n} ${hook}, мой близкий человек,
${end}

[Куплет]
${d}
Ты лучше всех, ты топ, ты класс, я прямо говорю,
Ценю твой вайб, ценю тебя, и искренне люблю.

[Припев]
${n} ${hook},
Ты — душа из всех моих решений и стремлений.${fix}`);
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
      edit_note: state.editNote,   // пожелания по правке текста
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

// при повороте экрана / изменении размеров — пересчитываем кнопки
window.addEventListener('resize', () => sizeChips());
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sizeChips());

stepCountry();
