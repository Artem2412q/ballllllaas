(() => {
  'use strict';

  // --------- Utils ---------
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => (s || '').toString().replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const norm = (v) => (v == null ? '' : String(v)).trim();
  const filled = (v) => norm(v).length > 0;

  // --------- Storage ---------
  const STORAGE_KEY = 'ballas_rp_sheet_v1';
  const ENDPOINT_KEY = 'ballas_rp_sheets_endpoint_v1';

  // Default endpoint can be configured once in sheet_config.js
  const DEFAULT_ENDPOINT = (() => {
    try {
      return (window.BALLAS_SHEETS_ENDPOINT || '').toString().trim();
    } catch (_) {
      return '';
    }
  })();

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) {
      return {};
    }
  };

  const save = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      // ignore
    }
  };

  const clearAll = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  };

  const getEndpoint = () => {
    try { return localStorage.getItem(ENDPOINT_KEY) || ''; } catch (_) { return ''; }
  };

  const setEndpoint = (url) => {
    try { localStorage.setItem(ENDPOINT_KEY, url || ''); } catch (_) {}
  };

  const getEffectiveEndpoint = () => {
    const saved = norm(getEndpoint());
    return saved || DEFAULT_ENDPOINT;
  };

  // --------- Steps ---------
  const STEPS = [
    { id: 'profile', href: 'sheet_profile.html', fields: ['name', 'alias', 'dob', 'role', 'set', 'tags'] },
    { id: 'backstory', href: 'sheet_backstory.html', fields: ['backstory'] },
    { id: 'traits', href: 'sheet_traits.html', fields: ['traits', 'limits'] },
    { id: 'connections', href: 'sheet_connections.html', fields: ['connections'] },
    { id: 'goals', href: 'sheet_goals.html', fields: ['goals', 'secret'] },
    { id: 'scenes', href: 'sheet_scenes.html', fields: ['wishes'] },
  ];

  const stepIndexById = new Map(STEPS.map((s, i) => [s.id, i]));

  const isStepDone = (data, stepId) => {
    const s = STEPS.find((x) => x.id === stepId);
    if (!s) return false;

    // Profile is "done" when minimum useful fields are present.
    if (stepId === 'profile') {
      return filled(data.name) && filled(data.role) && filled(data.set);
    }

    // Other steps: done if at least one field has content.
    return s.fields.some((f) => filled(data[f]));
  };

  const minReadyToSubmit = (data) => {
    return filled(data.name) && filled(data.role) && filled(data.set);
  };

  // --------- Scene library (100+ prompts) ---------
  const CATEGORIES = [
    { id: 'negotiation', title: 'Переговоры', keywords: ['перег', 'договор', 'deal', 'negoti', 'диплом', 'медиатор'] },
    { id: 'investigation', title: 'Расследование', keywords: ['расслед', 'улики', 'след', 'intel', 'инфо', 'наблю'] },
    { id: 'border', title: 'Граница и давление', keywords: ['границ', 'border', 'heat', 'давлен', 'провокац', 'тег'] },
    { id: 'family', title: 'Семья и прошлое', keywords: ['сем', 'родн', 'прошл', 'дет', 'дом', 'стар'] },
    { id: 'community', title: 'Комьюнити', keywords: ['community', 'район', 'сосед', 'ивент', 'помощ', 'школ'] },
    { id: 'code', title: 'Кодекс и дисциплина', keywords: ['код', 'правил', 'дисцип', 'уваж', 'respect', 'огранич'] },
    { id: 'cops', title: 'Давление системы', keywords: ['коп', 'police', 'lspd', 'протокол', 'опрос', 'штраф'] },
    { id: 'money', title: 'Деньги и фасады', keywords: ['день', 'касс', 'front', 'бизнес', 'долг', 'бумаг'] },
    { id: 'loyalty', title: 'Лояльность', keywords: ['лоял', 'утеч', 'предат', 'trust', 'провер', 'верн'] },
    { id: 'mentor', title: 'Наставничество', keywords: ['нович', 'учить', 'трен', 'mentor', 'пут', 'put-on'] },
    { id: 'romance', title: 'Личная линия', keywords: ['роман', 'отнош', 'люб', 'ревн', 'секрет', 'встреч'] },
  ];

  const LOCATIONS = [
    'магазин на углу', 'гараж у блоков', 'двор у подъезда', 'кафе в Strawberry', 'парковка у мотеля',
    'подъезд с граффити', 'крыша с видом на Davis', 'прачечная (как нейтральная зона)', 'автозаправка на границе',
    'общественный центр', 'склад на окраине', 'задний двор бара', 'футбольное поле школы', 'остановка поздним вечером',
    'мостик через канал', 'палатка с уличной едой', 'аллея за аптекой', 'тихая улица с закрытыми магазинами',
    'комната для собраний в «витрине»', 'корт, где обычно решают словами'
  ];

  const HOOKS = [
    'кто-то назначил встречу и не пришёл',
    'в районе пошёл слух, который звучит слишком точно',
    'появилась чужая метка поверх знакомого цвета',
    'человек из списка «связей» пропал на сутки',
    'на стол легло предложение, от которого пахнет ловушкой',
    'новичок сделал ошибку, и теперь это надо разрулить',
    'кто-то просит «тихий разговор» вместо громкой сцены',
    'пришла бумага/уведомление, которое не должно было прийти',
    'кто-то хочет вернуть долг, но не деньгами',
    'видеозапись всплыла не вовремя'
  ];

  const STAKES = [
    'репутация сета',
    'доверие внутри команды',
    'безопасность конкретного человека',
    'контроль Heat на границе',
    'сохранение фасада/витрины',
    'молчание свидетеля',
    'возможность перемирия',
    'долг, который пора закрыть',
    'влияние на районное событие',
    'сохранение лица без эскалации'
  ];

  const TWISTS = [
    'в разговор вмешивается третья сторона',
    'оказывается, что у одной детали есть второй смысл',
    'кто-то записывает происходящее',
    'всплывает старое обещание, о котором никто не хотел помнить',
    'приходит неожиданный звонок, меняющий ставки',
    'выясняется, что «утечка» — не утечка, а приманка',
    'на месте появляется человек из прошлого',
    'возникает проверка/наблюдение, из-за которого надо менять тон',
    'кто-то предлагает «компромисс», который режет по морали'
  ];

  const ENDINGS = [
    'Ты закрываешь сцену словом или действием?',
    'Кому ты доверишь следующий шаг?',
    'Ты выбираешь мир или принцип — и почему?',
    'Что ты берёшь с собой как трофей: факт, долг или вину?',
    'Где ты поставишь границу прямо сейчас?',
  ];

  const NPCS = [
    'Monica', 'Vince', 'Lex', 'Dani', 'Sofi', 'Rico', 'Gabe', 'Ike', 'Cami', 'Mace',
    'старый посредник', 'соседка, которая всё видит', 'парень из автомастерской', 'учитель из школы',
    'юрист по мелким делам', 'бариста, который слышит разговоры', 'охранник с «нейтральной» точки',
    'репортёр, ищущий историю', 'двоюродный брат', 'бывший напарник'
  ];

  const buildSceneLibrary = () => {
    const scenes = [];
    let n = 1;
    const want = 120;

    for (let i = 0; i < want; i++) {
      const cat = CATEGORIES[i % CATEGORIES.length];
      const location = LOCATIONS[i % LOCATIONS.length];
      const hook = HOOKS[(i * 3) % HOOKS.length];
      const stake = STAKES[(i * 5) % STAKES.length];
      const twist = TWISTS[(i * 7) % TWISTS.length];
      const ending = ENDINGS[(i * 11) % ENDINGS.length];
      const npc = NPCS[(i * 13) % NPCS.length];

      const id = 'S' + String(n).padStart(3, '0');
      const title = `${cat.title}: ${hook.charAt(0).toUpperCase()}${hook.slice(1)}`;
      const prompt = [
        `Локация: ${location}.`,
        `Завязка: ${hook}.`,
        `Ставки: ${stake}.`,
        `Фокус игрока: {wishes_short}.`,
        `Участники: {name}{alias_part} ({role}, {set}) и ${npc}.`,
        `Ход сцены:`,
        `1) Открытие: ты фиксируешь, что именно нужно получить/сохранить.`,
        `2) Давление: кто-то проверяет твою позицию (словами, паузой, вопросом).`,
        `3) Выбор: ты предлагаешь ход, который сохраняет лицо, но требует цены.`,
        `4) Поворот: ${twist}.`,
        `5) Финал: ${ending}`
      ].join('\n');

      scenes.push({ id, category: cat.id, title, prompt, meta: { location, hook, stake, twist, npc } });
      n++;
    }

    return scenes;
  };

  const SCENE_LIBRARY = buildSceneLibrary();

  // Simple FNV-1a for deterministic picks
  const hashString = (str) => {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const pickScenes = (data, count = 2, salt = '') => {
    const text = `${norm(data.role)} ${norm(data.tags)} ${norm(data.wishes)} ${norm(data.backstory)} ${norm(data.secret)}`.toLowerCase();

    const scores = CATEGORIES.map((c) => {
      let score = 0;
      for (const kw of c.keywords) {
        if (kw && text.includes(kw)) score++;
      }
      return { id: c.id, score };
    }).sort((a, b) => b.score - a.score);

    const top = scores.filter((s) => s.score > 0).slice(0, 2).map((s) => s.id);
    const pool = top.length
      ? SCENE_LIBRARY.filter((s) => top.includes(s.category))
      : SCENE_LIBRARY;

    const seed = hashString(`${norm(data.name)}|${norm(data.role)}|${norm(data.set)}|${salt}`);

    const picks = [];
    const used = new Set();
    for (let i = 0; i < 999 && picks.length < count; i++) {
      const idx = (seed + i * 2654435761) >>> 0;
      const j = idx % pool.length;
      const cand = pool[j];
      if (!cand || used.has(cand.id)) continue;
      used.add(cand.id);
      picks.push(cand);
    }

    // Fallback
    while (picks.length < count && SCENE_LIBRARY.length) {
      const cand = SCENE_LIBRARY[(seed + picks.length) % SCENE_LIBRARY.length];
      if (cand && !used.has(cand.id)) {
        used.add(cand.id);
        picks.push(cand);
      }
    }

    return picks;
  };

  const fillPrompt = (prompt, data) => {
    const alias = norm(data.alias);
    const aliasPart = alias ? ` (${alias})` : '';
    const wishes = norm(data.wishes);
    const wishesShort = wishes ? wishes.replace(/\s+/g, ' ').slice(0, 120) : 'свободный сюжет (выбери тон и ставки)';
    const map = {
      '{name}': norm(data.name) || 'твой персонаж',
      '{alias_part}': aliasPart,
      '{role}': norm(data.role) || 'роль',
      '{set}': norm(data.set) || 'сет',
      '{wishes_short}': wishesShort,
    };

    let out = String(prompt || '');
    for (const [k, v] of Object.entries(map)) {
      out = out.split(k).join(v);
    }
    return out;
  };

  // --------- UI helpers ---------
  const setStatus = (el, text, type = 'info') => {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.classList.remove('is-ok', 'is-warn', 'is-err');
    if (type === 'ok') el.classList.add('is-ok');
    if (type === 'warn') el.classList.add('is-warn');
    if (type === 'err') el.classList.add('is-err');
  };

  const ageAt = (dobIso, refIso = '2026-01-01') => {
    const dob = new Date(dobIso + 'T00:00:00');
    const ref = new Date(refIso + 'T00:00:00');
    if (Number.isNaN(+dob) || Number.isNaN(+ref)) return null;
    let age = ref.getFullYear() - dob.getFullYear();
    const m = ref.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age -= 1;
    return age;
  };

  const copyText = async (text) => {
    const t = String(text || '');
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (_) {
        return false;
      }
    }
  };

  // --------- Init only on sheet pages ---------
  if (!document.body.classList.contains('sheetPage')) return;

  const form = qs('#sheetForm');
  if (!form) return;

  const currentStep = form.getAttribute('data-step') || '';
  // Insert small progress indicator (step X/6) on every page
  try {
    const idx = stepIndexById.get(currentStep);
    if (idx != null) {
      const total = STEPS.length;
      const stepNum = idx + 1;
      const pct = Math.round((stepNum / total) * 100);
      const prog = document.createElement('div');
      prog.className = 'sheetProgress';
      prog.innerHTML = `
        <div class="sheetProgress__row">
          <div class="sheetProgress__pill">Шаг ${stepNum} из ${total}</div>
          <div class="sheetProgress__pct">${pct}%</div>
        </div>
        <div class="sheetProgress__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
      `;
      form.prepend(prog);
    }
  } catch (_) {}
  let data = load();

  // Mark active + done in nav
  const navLinks = qsa('.sheetNav__link');
  navLinks.forEach((a) => {
    const step = a.getAttribute('data-step') || '';
    const isActive = step === currentStep;
    a.classList.toggle('is-active', isActive);

    const badge = qs('.sheetNav__badge', a);
    const done = isStepDone(data, step);
    // Done state is shown via the badge checkmark
    if (badge) badge.classList.toggle('is-done', done);
    a.classList.toggle('is-done', done);
  });

  // Bind fields
  const fields = qsa('[data-field]', form);

  // Auto-grow textarea helper
  const autogrow = (ta) => {
    if (!ta) return;
    ta.classList.add('is-autogrow');
    const grow = () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 560) + 'px';
    };
    ta.addEventListener('input', grow);
    // run once after paint
    requestAnimationFrame(grow);
  };

  fields.forEach((el) => {
    const key = el.getAttribute('data-field');
    if (!key) return;

    const v = data[key];
    if (v != null) {
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = String(v);
    }

    if (el.tagName === 'TEXTAREA' || el.classList.contains('textarea')) {
      autogrow(el);
    }

    const handler = () => {
      if (el.type === 'checkbox') data[key] = el.checked ? '1' : '';
      else data[key] = el.value;

      data.updated_at = new Date().toISOString();
      save(data);
      onSaved();

      if (key === 'dob') updateDobWarning();
      if (currentStep === 'scenes') renderReview();
    };

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // Status message
  const saveStatus = qs('#saveStatus');
  let saveTimer = null;
  const onSaved = () => {
    if (!saveStatus) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveStatus.textContent = 'Сохранено.';
    saveTimer = setTimeout(() => {
      saveStatus.textContent = 'Автосохранение включено.';
    }, 1400);
  };

  const updateDobWarning = () => {
    const dob = norm(data.dob);
    if (!dob || !saveStatus) return;
    const age = ageAt(dob, '2026-01-01');
    if (age != null && age < 18) {
      saveStatus.textContent = `⚠️ По дате рождения персонажу ${age} (меньше 18). Проверь DOB.`;
      saveStatus.classList.add('is-warn');
      return;
    }
    saveStatus.classList.remove('is-warn');
  };
  updateDobWarning();

  // Nav next/prev
  const goRel = (dir) => {
    const idx = stepIndexById.get(currentStep);
    if (idx == null) return;
    const next = STEPS[clamp(idx + dir, 0, STEPS.length - 1)];
    if (next && next.href) window.location.href = next.href;
  };

  qsa('[data-go="next"]').forEach((b) => b.addEventListener('click', () => goRel(+1)));
  qsa('[data-go="prev"]').forEach((b) => b.addEventListener('click', () => goRel(-1)));

  // Clear
  const clearBtn = qs('#clearSheetBtn');
  clearBtn?.addEventListener('click', () => {
    const ok = confirm('Очистить анкету? Данные удалятся только из этого браузера.');
    if (!ok) return;
    clearAll();
    data = {};
    // Reset inputs on current page
    fields.forEach((el) => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    onSaved();
    // Update nav indicators
    navLinks.forEach((a) => {
      const badge = qs('.sheetNav__badge', a);
      badge?.classList.remove('is-done');
      a.classList.remove('is-done');
    });
    // Scenes page extras
    if (currentStep === 'scenes') {
      qs('#generatedScenes')?.replaceChildren();
      const st = qs('#submitStatus');
      if (st) st.hidden = true;
    }
  });

  // --------- Final step (scenes + submit) ---------
  const isScenesPage = currentStep === 'scenes';
  const endpointInput = isScenesPage ? qs('#endpointInput') : null;
  const guideWrap = isScenesPage ? qs('#guide') : null;
  const generateBtn = isScenesPage ? qs('#generateBtn') : null;
  const submitBtn = isScenesPage ? qs('#submitBtn') : null;
  const submitStatus = isScenesPage ? qs('#submitStatus') : null;
  const scenesWrap = isScenesPage ? qs('#generatedScenes') : null;
  const scenePlaceholder = isScenesPage ? qs('#scenePlaceholder') : null;
  const reviewBlock = isScenesPage ? qs('#reviewBlock') : null;
  const libraryDetails = isScenesPage ? qs('#libraryDetails') : null;
  const sceneLibraryWrap = isScenesPage ? qs('#sceneLibrary') : null;

  const renderReview = () => {
    if (!reviewBlock) return;

    const rows = [
      ['Имя', data.name],
      ['Alias', data.alias],
      ['DOB', data.dob],
      ['Роль', data.role],
      ['Set', data.set],
      ['Теги', data.tags],
      ['Предыстория', data.backstory],
      ['Характер', data.traits],
      ['Ограничения', data.limits],
      ['Связи', data.connections],
      ['Цели', data.goals],
      ['Секрет', data.secret],
      ['Запрос сцен', data.wishes],
    ];

    reviewBlock.innerHTML = rows
      .map(([k, v]) => {
        const value = norm(v);
        return `
          <div class="review__row">
            <div class="review__k">${esc(k)}</div>
            <div class="review__v">${value ? esc(value) : '<span class="small">—</span>'}</div>
          </div>
        `;
      })
      .join('');
  };

  const renderScenes = (scenes) => {
    if (!scenesWrap) return;

    if (scenePlaceholder) scenePlaceholder.hidden = true;

    scenesWrap.innerHTML = scenes
      .map((s, idx) => {
        const txt = fillPrompt(s.prompt, data);
        const safeTxt = esc(txt).replace(/\n/g, '<br>');
        const catTitle = (CATEGORIES.find((c) => c.id === s.category)?.title) || s.category;
        return `
          <article class="panel reveal sceneCard" data-scene-id="${esc(s.id)}">
            <div class="panel__head">
              <div>
                <div class="panel__title">${esc(s.id)} — ${esc(s.title)}</div>
                <div class="panel__sub">категория: ${esc(catTitle)} • можно копировать и сразу играть</div>
              </div>
              <button class="btn btn--ghost" type="button" data-copy-scene="${esc(s.id)}">Копировать</button>
            </div>
            <div class="p" style="white-space:normal; line-height:1.7">${safeTxt}</div>
          </article>
        `;
      })
      .join('');

    // Dynamic cards are injected after initial page load.
    // Our global reveal observer attaches only once on load, so make
    // these cards visible immediately.
    qsa('.reveal', scenesWrap).forEach((el) => {
      el.setAttribute('data-reveal', '1');
      el.classList.add('is-in');
    });

    // Attach copy handlers
    qsa('[data-copy-scene]', scenesWrap).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-copy-scene');
        const scene = scenes.find((x) => x.id === id);
        if (!scene) return;
        const ok = await copyText(fillPrompt(scene.prompt, data));
        setStatus(submitStatus, ok ? 'Сцена скопирована в буфер обмена.' : 'Не получилось скопировать автоматически. Выдели текст и скопируй вручную.', ok ? 'ok' : 'warn');
      });
    });
  };

  const ensureScenes = (salt = '') => {
    const scenes = pickScenes(data, 2, salt || String(Date.now()));
    data.scene_1 = fillPrompt(scenes[0]?.prompt || '', data);
    data.scene_2 = fillPrompt(scenes[1]?.prompt || '', data);
    data.scene_ids = scenes.map((s) => s.id).join(',');
    save(data);
    renderScenes(scenes);
    return scenes;
  };

  const buildPayload = () => {
    const now = new Date().toISOString();
    return {
      created_at: now,
      name: norm(data.name),
      alias: norm(data.alias),
      dob: norm(data.dob),
      role: norm(data.role),
      set: norm(data.set),
      tags: norm(data.tags),
      backstory: norm(data.backstory),
      traits: norm(data.traits),
      limits: norm(data.limits),
      connections: norm(data.connections),
      goals: norm(data.goals),
      secret: norm(data.secret),
      wishes: norm(data.wishes),
      // В таблицу отправляем только инфу о персонаже.
      // RP-сцены генерируются и остаются на сайте (для копирования/игры).
    };
  };

  const postToSheets = async (endpoint, payload) => {
    const url = norm(endpoint);
    if (!url) return { ok: false, error: 'ENDPOINT_EMPTY' };

    // Google Apps Script Web App often does not return CORS headers.
    // Send as application/x-www-form-urlencoded in no-cors mode.
    // Apps Script reads these values from e.parameter.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      params.set(k, v == null ? '' : String(v));
    }

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString(),
        keepalive: true,
      });
      return { ok: true, mode: 'no-cors', status: 0 };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  const renderLibrary = () => {
    if (!sceneLibraryWrap) return;

    // Render only once
    if (sceneLibraryWrap.getAttribute('data-rendered') === '1') return;
    sceneLibraryWrap.setAttribute('data-rendered', '1');

    // Show first 110 (enough for "100+")
    const list = SCENE_LIBRARY.slice(0, 110);

    sceneLibraryWrap.innerHTML = list
      .map((s) => {
        const catTitle = (CATEGORIES.find((c) => c.id === s.category)?.title) || s.category;
        return `
          <div class="sceneMini" data-scene-mini="${esc(s.id)}">
            <div class="sceneMini__top">
              <div class="sceneMini__title">${esc(s.id)} — ${esc(s.title)}</div>
              <button class="btn btn--ghost" type="button" data-copy-mini="${esc(s.id)}">Копировать</button>
            </div>
            <div class="small">${esc(catTitle)} • ${esc(s.meta.location)}</div>
          </div>
        `;
      })
      .join('');

    qsa('[data-copy-mini]', sceneLibraryWrap).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-copy-mini') || '';
        const scene = SCENE_LIBRARY.find((x) => x.id === id);
        if (!scene) return;
        const ok = await copyText(fillPrompt(scene.prompt, data));
        setStatus(submitStatus, ok ? 'Сцена из библиотеки скопирована.' : 'Не получилось скопировать автоматически.', ok ? 'ok' : 'warn');
      });
    });
  };

  const initScenesPage = () => {
    renderReview();

    const params = new URLSearchParams(location.search);
    const setupMode = params.has('setup');
    const hasEndpoint = filled(getEffectiveEndpoint());

    // Скрываем технические настройки от обычного пользователя.
    if (guideWrap) {
      guideWrap.hidden = hasEndpoint && !setupMode;
      if (hasEndpoint && !setupMode) {
        setStatus(submitStatus, 'Отправка в Google Sheets настроена — пользователю ничего вводить не нужно.', 'info');
      }
    }

    if (endpointInput) {
      // Поле видно только в режиме настройки (?setup=1)
      if (!setupMode) {
        endpointInput.closest('.field')?.setAttribute('hidden', '');
      } else {
        endpointInput.value = getEffectiveEndpoint();
        endpointInput.addEventListener('change', () => {
          setEndpoint(endpointInput.value);
          setStatus(submitStatus, 'URL сохранён (в этом браузере).', 'ok');
        });
      }
    }

    // If scenes already generated earlier, show them
    if (filled(data.scene_1) && filled(data.scene_2) && scenesWrap) {
      if (scenePlaceholder) scenePlaceholder.hidden = true;
      // Find objects to render the same text (or just render plain)
      scenesWrap.innerHTML = `
        <article class="panel reveal sceneCard">
          <div class="panel__head">
            <div><div class="panel__title">Сцена 1 (сохранена)</div><div class="panel__sub">взято из последней генерации</div></div>
            <button class="btn btn--ghost" type="button" id="copySaved1">Копировать</button>
          </div>
          <div class="p" style="white-space:normal; line-height:1.7">${esc(data.scene_1).replace(/\n/g,'<br>')}</div>
        </article>
        <article class="panel reveal sceneCard">
          <div class="panel__head">
            <div><div class="panel__title">Сцена 2 (сохранена)</div><div class="panel__sub">взято из последней генерации</div></div>
            <button class="btn btn--ghost" type="button" id="copySaved2">Копировать</button>
          </div>
          <div class="p" style="white-space:normal; line-height:1.7">${esc(data.scene_2).replace(/\n/g,'<br>')}</div>
        </article>
      `;

      // Ensure saved scene cards are visible (they are injected dynamically).
      qsa('.reveal', scenesWrap).forEach((el) => {
        el.setAttribute('data-reveal', '1');
        el.classList.add('is-in');
      });

      qs('#copySaved1')?.addEventListener('click', async () => {
        const ok = await copyText(data.scene_1);
        setStatus(submitStatus, ok ? 'Сцена 1 скопирована.' : 'Не получилось скопировать автоматически.', ok ? 'ok' : 'warn');
      });
      qs('#copySaved2')?.addEventListener('click', async () => {
        const ok = await copyText(data.scene_2);
        setStatus(submitStatus, ok ? 'Сцена 2 скопирована.' : 'Не получилось скопировать автоматически.', ok ? 'ok' : 'warn');
      });
    }

    generateBtn?.addEventListener('click', () => {
      if (!minReadyToSubmit(data)) {
        setStatus(submitStatus, 'Заполни минимум: имя, роль и set (шаг 1). Тогда сцены будут точнее.', 'warn');
      }
      ensureScenes(String(Date.now()));
      setStatus(submitStatus, 'Готово: сгенерировано 2 сцены. Можно копировать или отправлять.', 'ok');
    });

    submitBtn?.addEventListener('click', async () => {
      renderReview();

      // If admin is in setup mode, allow changing endpoint from the UI.
      const setupMode = new URLSearchParams(location.search).has('setup');
      if (setupMode && endpointInput) {
        const v = norm(endpointInput.value);
        if (v && v !== norm(getEndpoint())) setEndpoint(v);
      }

      if (!minReadyToSubmit(data)) {
        setStatus(submitStatus, 'Не хватает минимума для отправки: имя, роль, set (шаг 1).', 'err');
        return;
      }

      // Ensure scenes are generated on submit (per requirement)
      if (!filled(data.scene_1) || !filled(data.scene_2)) {
        ensureScenes(String(Date.now()));
      }

      const endpoint = getEffectiveEndpoint();

      if (!filled(endpoint)) {
        setStatus(submitStatus, 'Сцены готовы, но отправка в Google Sheets не настроена (endpoint пустой). Админ: добавь URL в sheet_config.js или открой ?setup=1.', 'warn');
        return;
      }

      setStatus(submitStatus, 'Отправляем в Google Sheets…', 'info');
      const payload = buildPayload();
      const res = await postToSheets(endpoint, payload);

      if (!res.ok) {
        setStatus(submitStatus, 'Не удалось отправить. Проверь URL Web App и доступ "Anyone" при деплое. Ошибка: ' + res.error, 'err');
        return;
      }

      setStatus(
        submitStatus,
        'Готово! Анкета отправлена ✅',
        'ok'
      );
    });

    libraryDetails?.addEventListener('toggle', () => {
      if (libraryDetails.open) renderLibrary();
    });
  };

  if (isScenesPage) initScenesPage();
})();
