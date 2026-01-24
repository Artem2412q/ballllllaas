(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Mark JS presence for progressive enhancements
  document.documentElement.classList.add('js');

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.documentElement.getAttribute('data-root') || '.';
  const rjoin = (p) => {
    // join relative to root without introducing double slashes
    const a = (root || '.').replace(/\/$/, '');
    const b = (p || '').replace(/^\//, '');
    return `${a}/${b}`.replace(/\/\.(?=\/)/g, '/.');
  };

  // ---------- Theme ----------
  const THEME_KEY = 'ballas_theme';
  const html = document.documentElement;

  const getPreferredTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };

  const setTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeBtn();
  };

  const themeIcon = (theme) => {
    // Minimal inline icons, no external deps
    if (theme === 'light') {
      return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM2 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm18 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1ZM4.22 4.22a1 1 0 0 1 1.42 0l.7.7A1 1 0 1 1 4.93 6.34l-.7-.7a1 1 0 0 1 0-1.42Zm12.73 12.73a1 1 0 0 1 1.42 0l.7.7a1 1 0 1 1-1.41 1.41l-.71-.7a1 1 0 0 1 0-1.41ZM19.78 4.22a1 1 0 0 1 0 1.42l-.7.7a1 1 0 1 1-1.42-1.41l.7-.71a1 1 0 0 1 1.42 0ZM7.05 16.95a1 1 0 0 1 0 1.41l-.7.71a1 1 0 1 1-1.41-1.41l.7-.71a1 1 0 0 1 1.41 0Z"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M21 14.5A7.5 7.5 0 0 1 9.5 3a1 1 0 0 1 1.16 1.2A5.5 5.5 0 0 0 19.8 13.34 1 1 0 0 1 21 14.5Z"/>
    </svg>`;
  };

  const updateThemeBtn = () => {
    const t = html.getAttribute('data-theme') || 'dark';
    const isLight = t === 'light';
    const label = isLight ? 'Включить тёмную тему' : 'Включить светлую тему';
    ['themeBtn', 'themeBtn2'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.innerHTML = themeIcon(t);
      btn.setAttribute('aria-label', label);
      btn.title = 'Тема';
    });
  };

  try {
    setTheme(getPreferredTheme());
  } catch (_) {
    // ignore
  }

  const switchThemeAnimated = (e) => {
    const cur = html.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';

    const btn = e?.currentTarget;
    const r = btn?.getBoundingClientRect?.();
    const x = (e?.clientX ?? (r ? r.left + r.width / 2 : innerWidth / 2));
    const y = (e?.clientY ?? (r ? r.top + r.height / 2 : 64));

    // Store origin for CSS (View Transitions)
    html.style.setProperty('--vt-x', `${x}px`);
    html.style.setProperty('--vt-y', `${y}px`);

    if (prefersReduced) {
      setTheme(next);
      return;
    }

    // Best option: native View Transitions (clean + no overlay hacks)
    if (document.startViewTransition) {
      document.startViewTransition(() => setTheme(next));
      return;
    }

    // Fallback: overlay wipe
    const oldBg = getComputedStyle(document.body).backgroundColor || 'rgb(0,0,0)';
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 24;

    const overlay = document.createElement('div');
    overlay.className = 'themeWipe';
    overlay.style.background = oldBg;
    overlay.style.setProperty('--wipe-x', `${x}px`);
    overlay.style.setProperty('--wipe-y', `${y}px`);
    overlay.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
    document.body.appendChild(overlay);

    setTheme(next);

    const anim = overlay.animate(
      [
        { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        { clipPath: `circle(0px at ${x}px ${y}px)` },
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
    anim.onfinish = () => overlay.remove();
  };

  $('#themeBtn')?.addEventListener('click', switchThemeAnimated);
  $('#themeBtn2')?.addEventListener('click', switchThemeAnimated);

  // ---------- Reveal (works for dynamically inserted blocks) ----------
  let revealObserver = null;

  const observeReveals = () => {
    const els = $$('.reveal:not([data-reveal])');
    if (!els.length) return;

    if (prefersReduced) {
      els.forEach((el) => {
        el.setAttribute('data-reveal', '1');
        el.classList.add('is-in');
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add('is-in');
            revealObserver?.unobserve(e.target);
          }
        },
        { threshold: 0.16, rootMargin: '0px 0px -10% 0px' }
      );
    }

    els.forEach((el) => {
      el.setAttribute('data-reveal', '1');
      revealObserver.observe(el);
    });
  };

  observeReveals();

  // ---------- Page loader (pleasant open; respects reduced motion) ----------
  const pageLoader = $('#pageLoader');

  const finishLoader = () => {
    if (!pageLoader) return;
    pageLoader.classList.add('is-done');
    // remove after transition
    setTimeout(() => pageLoader.remove(), 520);
  };

  // If page is restored from bfcache (back/forward), ensure loader is gone.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) finishLoader();
  });

  // Start nice enter animation on every page
  document.body.classList.add('pageEnter');
  if (prefersReduced) {
    finishLoader();
  } else {
    // Wait a frame so CSS can apply
    requestAnimationFrame(() => {
      setTimeout(finishLoader, 260);
    });
  }

  // ---------- Smooth page transitions (internal links) ----------
  // Keeps navigation feeling snappy while avoiding the "hard cut".
  // Skips new-tab / modified clicks.
  const main = $('#main');
  const isSameOrigin = (href) => {
    try {
      const u = new URL(href, location.href);
      return u.origin === location.origin;
    } catch (_) {
      return false;
    }
  };

  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    if (a.hasAttribute('download')) return;
    if (a.getAttribute('target') === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    if (!isSameOrigin(href)) return;

    if (!main) return;
    e.preventDefault();

    // If supported, use View Transitions API for an extra-smooth cross-page feel.
    // Falls back to a short exit animation.
    document.body.classList.add('is-leaving');
    const go = () => { location.href = href; };

    if (document.startViewTransition && !prefersReduced) {
      try {
        document.startViewTransition(() => {
          // We still navigate normally; this mainly improves the perceived transition.
          go();
        });
        return;
      } catch (_) {
        // fallback below
      }
    }

    main.style.animation = 'pageExit .22s cubic-bezier(.21,.61,.35,1) both';
    setTimeout(go, 180);
  }, true);

  // ---------- Nav spy (index only, if anchors exist) ----------
  const spyLinks = $$('[data-spy]').map((a) => ({ id: a.getAttribute('data-spy'), el: a }));
  const spyIds = spyLinks.map((x) => x.id).filter(Boolean);

  if (spyIds.length) {
    const sectionEls = spyIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (sectionEls.length) {
      const map = new Map(spyLinks.map((x) => [x.id, x.el]));
      const so = new IntersectionObserver(
        (entries) => {
          const v = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
          if (!v) return;
          spyLinks.forEach((x) => x.el?.classList.remove('is-active'));
          map.get(v.target.id)?.classList.add('is-active');
        },
        { threshold: [0.25, 0.35, 0.5], rootMargin: '-20% 0px -65% 0px' }
      );
      sectionEls.forEach((el) => so.observe(el));
    }
  }

  // ---------- Mobile menu ----------
  const menuBtn = $('#menuBtn');
  const mobileMenu = $('#mobileMenu');

  const openMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.hidden = false;
    menuBtn?.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.hidden = true;
    menuBtn?.setAttribute('aria-expanded', 'false');
  };
  const toggleMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.hidden ? openMenu() : closeMenu();
  };

  menuBtn?.addEventListener('click', toggleMenu);
  $$('.mobileMenu__link').forEach((a) => a.addEventListener('click', closeMenu));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      closeModal();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1020) closeMenu();
  });

  // ---------- Scroll progress + toTop ----------
  const progress = $('#scrollProgress');
  const toTop = $('#toTop');
  const topbar = $('#topbar');

  const onScroll = () => {
    const h = document.documentElement;
    const max = Math.max(1, h.scrollHeight - h.clientHeight);
    const p = Math.min(1, Math.max(0, h.scrollTop / max));
    if (progress) progress.style.width = (p * 100).toFixed(2) + '%';

    // Sticky header state (subtle elevation + tighter spacing)
    if (topbar) {
      topbar.classList.toggle('topbar--scrolled', h.scrollTop > 10);
    }

    if (toTop) {
      const on = h.scrollTop > 700;
      toTop.classList.toggle('is-on', on);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------- Modal (generic) ----------
  const modal = $('#modal');
  const modalTitle = $('#modalTitle');
  const modalBody = $('#modalBody');
  let lastFocus = null;

  function openModal(title, htmlBody) {
    if (!modal || !modalTitle || !modalBody) return;

    lastFocus = document.activeElement;
    modalTitle.textContent = title;
    modalBody.innerHTML = htmlBody;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first focusable
    setTimeout(() => {
      const focusable = getFocusable(modal);
      (focusable[0] || $('[data-close="1"]', modal) || modal).focus?.();
    }, 0);
  }

  function closeModal() {
    if (!modal) return;
    if (!modal.classList.contains('is-open')) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    try { lastFocus?.focus?.(); } catch (_) {}
  }

  const getFocusable = (rootEl) => {
    const sel = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return $$(sel, rootEl).filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  };

  modal?.addEventListener('click', (e) => {
    const t = e.target;
    if (t?.getAttribute && t.getAttribute('data-close') === '1') closeModal();
  });

  // Focus trap
  modal?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(modal);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ---------- Data (фикшн-подача) ----------
  const GLOSSARY = [
    { term: 'Ballas', pron: '[баллас]', desc: 'Фиолетовый код и узнаваемая уличная идентичность в мире GTA V.' },
    { term: 'Hood', pron: '[худ]', desc: 'Район/окружение: улицы, люди, правила двора и локальные привычки.' },
    { term: 'Turf', pron: '[тёрф]', desc: 'Зона влияния. Не «карта», а ощущение: где тебя знают и где тебя проверяют.' },
    { term: 'Set', pron: '[сет]', desc: 'Внутренняя группа (по улице/кварталу/связям). Сеты — ритм и порядок.' },
    { term: 'O.G.', pron: '[оу‑джи]', desc: 'Original Gangster. Ветеран с авторитетом. Не только возраст — вклад и репутация.' },
    { term: 'Put‑on', pron: '[пут‑он]', desc: 'Ввод в состав. Для RP — испытание на дисциплину и доверие (без конкретики).' },
    { term: 'Shot‑caller', pron: '[шот‑коллер]', desc: 'Тот, кто принимает решения на уровне улицы/сета. Голос в моменте.' },
    { term: 'Heat', pron: '[хит]', desc: 'Уровень внимания и напряжения вокруг района: слухи, давление, чужие взгляды.' },
    { term: 'Fixer', pron: '[фиксер]', desc: 'Посредник между заказом и исполнением. Контакты, договорённости, входы/выходы.' },
    { term: 'Crew', pron: '[кру]', desc: 'Состав и роли: кто за что отвечает, кто кому докладывает.' },
    { term: 'Case', pron: '[кейс]', desc: 'Эпизод/инцидент в хронике. В RP — сцена, которая двигает сюжет.' },
    { term: 'Davis', pron: '[дэйвис]', desc: 'Район South LS. В нашем лоре — «дом», где главное: связи и репутация.' },
    { term: 'Strawberry', pron: '[стробэри]', desc: 'Соседняя зона и частый «стык» интересов. Место для встреч и напряжения.' },
    { term: 'Boundary', pron: '[баунда́ри]', desc: 'Граница влияния. Чаще всего конфликт начинается именно тут.' },
    { term: 'Pressure', pron: '[прэшер]', desc: 'Давление: ожидание, слежка, слухи. Иногда тяжелее, чем прямой конфликт.' },
    { term: 'Tag', pron: '[тэг]', desc: 'Метка/надпись. В RP — маркер присутствия и провокации.' },
    { term: 'Ceasefire', pron: '[сисфайр]', desc: 'Перемирие. В RP это тонкий договор, который легко сорвать искрой.' },
    { term: 'Respect', pron: '[риспект]', desc: 'Уважение. Зарабатывается последовательностью, а не громкостью.' },
    { term: 'Homie', pron: '[хоуми]', desc: 'Свой человек. Важно, кто для тебя homie и кто уже нет.' },
    { term: 'Debrief', pron: '[дибриф]', desc: 'Разбор после сцены: что узнали, что испортили, что исправляем.' },
    { term: 'Alibi', pron: '[элибай]', desc: 'Версия событий. В RP‑подаче — часть социальной игры и доверия.' },
    { term: 'Front', pron: '[фронт]', desc: 'Фасад/легальная витрина. В лоре — источник проблем, проверок и сюжетов.' },
    { term: 'Mediator', pron: '[мидиэйтор]', desc: 'Посредник. Тот, кто удерживает разговор, когда стороны готовы сорваться.' },
    { term: 'Lineup', pron: '[лайн‑ап]', desc: 'Состав на сцену: кто идёт, кто остаётся, кто отвечает за тон.' },
    { term: 'Fallback', pron: '[фоллбэк]', desc: 'План отхода в RP‑смысле: что делаем, если разговор рушится.' },
    { term: 'House rule', pron: '[хаус‑рул]', desc: 'Внутреннее правило: «у нас так не делают». Кодекс в одной фразе.' },
    { term: 'Neighborhood watch', pron: '[нейбэрхуд уотч]', desc: '«Наблюдение района»: люди, которые всё видят и всё обсуждают.' },
  ];

  const CHARACTERS = [
    {
      id: 'vincent-carter',
      name: 'Vincent Carter',
      alias: '"Vince"',
      dob: '1994-08-17',
      role: 'O.G. on the Streets',
      set: 'Davis / Mainline',
      tags: ['leadership', 'diplomacy', 'davis', 'code'],
      bio: 'Умеет удерживать спокойный тон даже в перегретой ситуации. Его сила — слово, порядок и память улицы.'
    },
    {
      id: 'alejandro-reyes',
      name: 'Alejandro Reyes',
      alias: '"Lex"',
      dob: '1992-02-03',
      role: 'Underboss',
      set: 'Davis / Operations',
      tags: ['operations', 'discipline', 'planning'],
      bio: 'Собирает хаос в схемы: распределяет людей и время, делает так, чтобы район не кипел зря.'
    },
    {
      id: 'monica-alvarez',
      name: 'Monica Alvarez',
      alias: '"Mona"',
      dob: '1997-01-30',
      role: 'Consigliere (посредник)',
      set: 'Davis / Liaison',
      tags: ['diplomacy', 'community', 'intel'],
      bio: 'Разговоры, договорённости, мосты. В её блокноте больше спасённых ситуаций, чем видимых побед.'
    },
    {
      id: 'marcus-holloway',
      name: 'Marcus Holloway',
      alias: '"Mace"',
      dob: '1998-11-29',
      role: 'Street Head',
      set: 'Chamberlain / Edge',
      tags: ['street', 'coordination', 'heat'],
      bio: 'Отвечает за «температуру» на границе: где лучше сделать шаг назад, а где — встать стеной.'
    },
    {
      id: 'javier-morales',
      name: 'Javier Morales',
      alias: '"Jax"',
      dob: '2001-06-22',
      role: 'Logistics',
      set: 'Davis / Transit',
      tags: ['logistics', 'wheels', 'routes'],
      bio: 'Знает город как карту памяти: кто куда ездит, где пробки, где пусто. Его конёк — спокойная доставка.'
    },
    {
      id: 'sofia-delgado',
      name: 'Sofia Delgado',
      alias: '"Sofi"',
      dob: '1997-12-14',
      role: 'Finance (front)',
      set: 'Strawberry / Fronts',
      tags: ['finance', 'business', 'paperwork'],
      bio: 'Сводит цифры так, чтобы район выглядел как район, а не как сводка. Любит чистые отчёты и тихие решения.'
    },
    {
      id: 'danielle-price',
      name: 'Danielle Price',
      alias: '"Dani"',
      dob: '2003-03-18',
      role: 'Intel / Runner',
      set: 'Davis / Eyes',
      tags: ['intel', 'social', 'signals'],
      bio: 'Собирает намёки из шумов: кто нервничает, кто врёт, кто решил «проверить» район.'
    },
    {
      id: 'gabriel-navarro',
      name: 'Gabriel Navarro',
      alias: '"Gabe"',
      dob: '1999-09-05',
      role: 'Wheels',
      set: 'Davis / Garage',
      tags: ['wheels', 'mechanic', 'support'],
      bio: 'Гараж — его язык. Он не ищет драки, но умеет подготовить людей к долгой дороге.'
    },
    {
      id: 'isaiah-brooks',
      name: 'Isaiah Brooks',
      alias: '"Ike"',
      dob: '2002-04-10',
      role: 'Street Soldier',
      set: 'Davis / Blocks',
      tags: ['street', 'presence', 'discipline'],
      bio: 'Тихий солдат улицы. Не геройствует, но всегда на месте, когда требуется присутствие.'
    },
    {
      id: 'ricardo-salazar',
      name: 'Ricardo Salazar',
      alias: '"Rico"',
      dob: '1995-10-02',
      role: 'Fixer',
      set: 'Citywide',
      tags: ['fixer', 'contacts', 'broker'],
      bio: 'Его работа — связи и чужие обещания. Он продаёт не «силу», а возможность разговора.'
    },
    {
      id: 'ethan-king',
      name: 'Ethan King',
      alias: '"E"',
      dob: '2000-07-07',
      role: 'Trainer',
      set: 'Davis / Recruitment',
      tags: ['training', 'code', 'discipline'],
      bio: 'Держит новичков в рамке: учит правилам, а не понтам. Считает, что уважение дороже показухи.'
    },
    {
      id: 'camila-santos',
      name: 'Camila Santos',
      alias: '"Cami"',
      dob: '1999-02-21',
      role: 'Community',
      set: 'Davis / Outreach',
      tags: ['community', 'events', 'cover'],
      bio: 'Связь с районом: помощь своим, мероприятия, договорённости с местными. Меньше шума — больше влияния.'
    },
  ];

  const CASES = [
    {
      id: '001',
      // Flat build: cases live on a single page with anchors
      slug: 'cases.html#case-001',
      title: 'Violet Wake',
      date: '2020-11-03',
      place: 'Davis — south edge',
      heat: 4,
      tags: ['border', 'pressure', 'signals'],
      summary: 'Ночь, когда район услышал чужой шаг: серия провокаций на границе и исчезновение посредника.'
    },
    {
      id: '002',
      slug: 'cases.html#case-002',
      title: 'Mirror Deal',
      date: '2024-08-19',
      place: 'Strawberry — backlot',
      heat: 3,
      tags: ['negotiation', 'leak', 'trust'],
      summary: 'Сделка, где каждая улыбка была зеркалом. Кто-то слил время и место — и разговор стал холоднее.'
    },
    {
      id: '003',
      slug: 'cases.html#case-003',
      title: 'Quiet Claim',
      date: '2026-01-12',
      place: 'Davis — mainline',
      heat: 2,
      tags: ['control', 'community', 'response'],
      summary: 'Спокойное возвращение контроля: без шума, без показухи — но с чётким «это наше».'
    },
  ];

  // Extra details for case modal / deep-links (flat build)
  const CASE_DETAILS = {
    '001': {
      headline: 'Серия провокаций на границе и исчезновение посредника',
      synopsis: [
        'В Davis накапливаются «локальные искры»: чужие метки поверх фиолетового, сорванные договорённости, странные слухи.',
        'В одну ночь посредник, который должен был закрыть спор без шума, пропадает. Район просыпается в режиме ожидания.',
        'Ballas держат спокойный тон: сначала — сбор фактов, потом — ответы по ситуации (без показухи).'
      ],
      outcome:
        'Кейс закрыт частично: конфликт не разгорелся, но утечка осталась. В хронике — как точка, с которой начинается новая осторожность.',
      sparks: ['перекрашенные теги', 'сорванная встреча', 'посторонние машины у блоков', 'нервные разговоры в магазине на углу'],
      cast: ['Vincent Carter', 'Monica Alvarez', 'Danielle Price']
    },
    '002': {
      headline: 'Сделка, где каждый слышал не слова, а паузы',
      synopsis: [
        'В Strawberry готовилась тихая договорённость. Но кто-то знал слишком много — место и время стали известны третьей стороне.',
        'Сделка не превращается в сцену: стороны отступают, оставляя за собой холодную вежливость и вопросы.',
        'Главный итог — поиск источника утечки и восстановление доверия внутри сета.'
      ],
      outcome: 'Кейс закрыт как «зеркало»: не было громкого инцидента, но остался осадок. В 2026 это всплывёт снова.',
      sparks: ['чужая информация', 'недосказанность', 'двойные обещания', 'проверки на лояльность'],
      cast: ['Alejandro Reyes', 'Ricardo Salazar', 'Sofia Delgado']
    },
    '003': {
      headline: 'Спокойное возвращение контроля без шума',
      synopsis: [
        'В начале 2026 район выбирает порядок вместо эскалации: Ballas действуют как структура, а не как шумная толпа.',
        'Когда другая сторона проверяет границы агрессивно, ответ следует быстро — но точечно, без «праздника насилия».',
        'Ключевой инструмент — дисциплина: присутствие, договорённости и уважение к своим.'
      ],
      outcome: 'Кейс закрыт: граница стабилизирована. Heat низкий, но «искра» остаётся в архиве как предупреждение.',
      sparks: ['проверка границы', 'слухи о «чужих людях»', 'случайная встреча двух патрулей', 'попытка сорвать местное мероприятие'],
      cast: ['Marcus Holloway', 'Isaiah Brooks', 'Camila Santos']
    }
  };

  // Quick index for search across key lore blocks (static pages)
  const DOCS = [
    {
      type: 'RP‑досье',
      title: 'Сюжет 2026: как действует группировка',
      href: 'rp.html#start2026',
      text: 'начало сюжета 2026 как действуем группировка спокойной без агрессии ответ на агрессию границы дисциплина'
    },
    {
      type: 'RP‑досье',
      title: 'Финансирование: фасады, касса, поручения',
      href: 'rp.html#finance',
      text: 'финансирование подробно фасады легальные серые доходы общая касса заказные поручения посредник фиксер долг'
    },
    {
      type: 'RP‑досье',
      title: 'Мораль и кодекс',
      href: 'rp.html#code',
      text: 'мораль группировки кодекс правила посыл порядок важнее показухи heat общий враг'
    },
    {
      type: 'RP‑досье',
      title: 'Отношение с копами',
      href: 'rp.html#cops',
      text: 'отношение с копами спокойное нейтралитет давление протоколы вопросы heat'
    },
    {
      type: 'RP‑досье',
      title: 'Анкета персонажа',
      href: 'sheet_profile.html',
      text: 'rp анкета персонажа имя фамилия латиницей дата рождения 18 плюс роль теги предыстория связи цели секрет'
    },
    {
      type: 'Лор‑хаб',
      title: 'Паспорт района Davis + Heat',
      href: 'index.html#hood',
      text: 'паспорт района davis heat индикатор локальные искры границы ядро'
    },
    {
      type: 'Лор‑хаб',
      title: 'Crew: структура и роли',
      href: 'index.html#crew',
      text: 'crew структура роли иерархия peewee put-on soldier street head og original gangster shot caller'
    },
    {
      type: 'Лор‑хаб',
      title: 'Конфликтная динамика',
      href: 'index.html#conflict',
      text: 'конфликтная динамика rp фазы шум проверка ответ деэскалация'
    },
    {
      type: 'Лор‑хаб',
      title: 'Хроника и контекст',
      href: 'index.html#timeline',
      text: 'хроника контекст 2020 сирены криминальные новости los santos 2021 2025 2026'
    },
    {
      type: 'Лор‑хаб',
      title: 'Крючки для лора',
      href: 'index.html#hooks',
      text: 'крючки лора утечка граница сделка зеркало сюжетные зацепки'
    }
  ];

  // ---------- Rendering helpers ----------
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const fmtDate = (iso) => {
    // YYYY-MM-DD -> DD.MM.YYYY
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso || '');
    if (!m) return iso;
    const [, y, mo, d] = m;
    return `${d}.${mo}.${y}`;
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

  const heatDots = (n) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      dots.push(`<span class="meter__dot ${i <= n ? 'is-on' : ''}" aria-hidden="true"></span>`);
    }
    return `<div class="meter" role="img" aria-label="Heat: ${n} из 5">${dots.join('')}</div>`;
  };

  function renderGlossary() {
    const list = $('#glossaryList');
    if (!list) return;

    list.innerHTML = GLOSSARY.map((g) => {
      return `
        <article class="panel reveal">
          <div class="panel__head">
            <div>
              <div class="panel__title">${esc(g.term)} <span class="small">${esc(g.pron)}</span></div>
              <div class="panel__sub">Термин / произношение</div>
            </div>
            <span class="badge">gloss</span>
          </div>
          <p class="p">${esc(g.desc)}</p>
        </article>
      `;
    }).join('');

    observeReveals();
  }

  function renderCharacters(containerId, opts = {}) {
    const grid = $(containerId);
    if (!grid) return;

    const limit = opts.limit || null;
    const list = (limit ? CHARACTERS.slice(0, limit) : CHARACTERS);

    grid.innerHTML = list.map((c) => {
      const tags = c.tags.map((t) => `<span class="metaPill">#${esc(t)}</span>`).join('');
      const age = ageAt(c.dob, '2026-01-01');
      return `
        <article id="char-${esc(c.id)}" class="card reveal" data-role="${esc(c.role)}" data-tags="${esc(c.tags.join(' '))}">
          <div class="cardTop">
            <div>
              <div class="h3">${esc(c.name)} <span class="small">${esc(c.alias)}</span></div>
              <div class="small">${esc(c.role)} • ${esc(c.set)}</div>
            </div>
            <span class="badge">${esc(age != null ? age + '+' : '18+') }</span>
          </div>
          <div class="kv">
            <div>
              <div class="kv__k">DOB</div>
              <div class="kv__v">${esc(fmtDate(c.dob))}</div>
            </div>
            <div>
              <div class="kv__k">Set</div>
              <div class="kv__v">${esc(c.set)}</div>
            </div>
            <div>
              <div class="kv__k">Tags</div>
              <div class="kv__v">${esc(c.tags.slice(0, 3).join(', '))}${c.tags.length > 3 ? '…' : ''}</div>
            </div>
          </div>
          <p class="p">${esc(c.bio)}</p>
          <div class="metaRow">${tags}</div>
        </article>
      `;
    }).join('');

    observeReveals();
  }

  function renderCases(containerId, opts = {}) {
    const grid = $(containerId);
    if (!grid) return;

    const limit = opts.limit || null;
    const list = (limit ? CASES.slice(0, limit) : CASES);

    const onCasesPage = /\/cases\.html$/i.test(location.pathname);

    grid.innerHTML = list.map((k) => {
      const anchorId = `case-${k.id}`;
      // On the cases page, use hash-only links; elsewhere, deep-link into cases.html
      const href = onCasesPage ? `#${anchorId}` : rjoin(`cases.html#${anchorId}`);
      const tags = k.tags.map((t) => `<span class="metaPill">#${esc(t)}</span>`).join('');
      return `
        <article id="${esc(anchorId)}" class="card reveal" data-tags="${esc(k.tags.join(' '))}">
          <div class="cardTop">
            <div>
              <div class="h3">Case ${esc(k.id)} — ${esc(k.title)}</div>
              <div class="small">${esc(fmtDate(k.date))} • ${esc(k.place)}</div>
            </div>
            <span class="badge">Heat ${esc(String(k.heat))}/5</span>
          </div>
          <p class="p">${esc(k.summary)}</p>
          <div class="metaRow">${tags}</div>
          <div style="margin-top:auto; padding-top:14px">
            <a class="btn btn--ghost" data-case-open="${esc(k.id)}" href="${href}">Открыть кейс</a>
          </div>
        </article>
      `;
    }).join('');

    observeReveals();
  }

  // ---------- Character filters page ----------
  function setupCharactersPage() {
    const grid = $('#charactersGrid');
    if (!grid) return;

    const search = $('#charSearch');
    const roleSel = $('#roleFilter');
    const tagBtns = $$('.tagBtn');

    const activeTags = new Set();

    const apply = () => {
      const q = (search?.value || '').trim().toLowerCase();
      const role = (roleSel?.value || '').trim();

      $$('.card', grid).forEach((card) => {
        const text = (card.textContent || '').toLowerCase();
        const tags = (card.getAttribute('data-tags') || '').toLowerCase();
        const r = (card.getAttribute('data-role') || '').trim();

        const okQ = !q || text.includes(q) || tags.includes(q);
        const okRole = !role || r === role;
        const okTags = !activeTags.size || Array.from(activeTags).every((t) => tags.includes(t));

        card.style.display = okQ && okRole && okTags ? '' : 'none';
      });
    };

    search?.addEventListener('input', apply);
    roleSel?.addEventListener('change', apply);

    tagBtns.forEach((b) => {
      b.addEventListener('click', () => {
        const tag = (b.getAttribute('data-tag') || '').toLowerCase();
        if (!tag) return;
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
          b.classList.remove('is-on');
        } else {
          activeTags.add(tag);
          b.classList.add('is-on');
        }
        apply();
      });
    });

    renderCharacters('#charactersGrid');
    // wait for render then apply initial
    setTimeout(apply, 0);
  }

  // ---------- Cases page filters ----------
  function setupCasesPage() {
    const grid = $('#casesGrid');
    if (!grid) return;

    const search = $('#caseSearch');
    const heatSel = $('#heatFilter');

    const apply = () => {
      const q = (search?.value || '').trim().toLowerCase();
      const heat = (heatSel?.value || '').trim();

      $$('.card', grid).forEach((card) => {
        const text = (card.textContent || '').toLowerCase();
        const tags = (card.getAttribute('data-tags') || '').toLowerCase();

        let okHeat = true;
        if (heat) {
          okHeat = text.includes(`heat ${heat}/5`) || text.includes(`heat ${heat} /5`) || text.includes(`heat ${heat}`);
        }
        const okQ = !q || text.includes(q) || tags.includes(q);

        card.style.display = okQ && okHeat ? '' : 'none';
      });
    };

    search?.addEventListener('input', apply);
    heatSel?.addEventListener('change', apply);

    renderCases('#casesGrid');
    setTimeout(apply, 0);

    const openCase = (caseId, { pushHash = true } = {}) => {
      const k = CASES.find((x) => x.id === caseId);
      if (!k) return;
      const d = CASE_DETAILS[caseId] || {};

      const tags = (k.tags || []).map((t) => `<span class="metaPill">#${esc(t)}</span>`).join('');
      const cast = (d.cast || []).map((n) => `<span class="metaPill">${esc(n)}</span>`).join('');
      const syn = (d.synopsis || []).map((p) => `<p class="p">${esc(p)}</p>`).join('');
      const sparks = (d.sparks || []).map((s) => `<li>${esc(s)}</li>`).join('');

      const body = `
        <div class="panel" style="margin-top:10px">
          <div class="panel__head">
            <div>
              <div class="panel__title">Case ${esc(k.id)} — ${esc(k.title)}</div>
              <div class="panel__sub">${esc(fmtDate(k.date))} • ${esc(k.place)}</div>
            </div>
            <span class="badge">Heat ${esc(String(k.heat))}/5</span>
          </div>
          <p class="p"><strong>${esc(d.headline || k.summary || '')}</strong></p>
          ${heatDots(k.heat)}
          <div class="metaRow" style="margin-top:10px">${tags}</div>
        </div>

        <div class="grid2" style="margin-top:12px">
          <div class="panel">
            <div class="panel__head"><div><div class="panel__title">Синопсис</div><div class="panel__sub">сцена / напряжение / решение</div></div><span class="badge">story</span></div>
            ${syn || `<p class="p">${esc(k.summary || '')}</p>`}
          </div>
          <div class="panel">
            <div class="panel__head"><div><div class="panel__title">Локальные искры</div><div class="panel__sub">что поднимает Heat</div></div><span class="badge">sparks</span></div>
            <p class="p">Триггеры для RP‑сцен (не инструкция).</p>
            <ul class="p" style="margin:10px 0 0 18px">${sparks}</ul>
          </div>
        </div>

        <div class="panel" style="margin-top:12px">
          <div class="panel__head"><div><div class="panel__title">Участники</div><div class="panel__sub">ключевые лица эпизода</div></div><span class="badge">cast</span></div>
          <div class="metaRow">${cast || '<span class="note">Пока без списка.</span>'}</div>
          <p class="p" style="margin-top:12px">${esc(d.outcome || '')}</p>
        </div>
      `;

      openModal(`Case ${k.id}`, body);

      if (pushHash) {
        try { history.replaceState(null, '', `#case-${k.id}`); } catch (_) {}
      }
    };

    // Open from card button
    grid.addEventListener('click', (ev) => {
      const a = ev.target?.closest?.('[data-case-open]');
      if (!a) return;
      ev.preventDefault();
      const id = a.getAttribute('data-case-open') || '';
      openCase(id);
    });

    // Deep-link: /cases.html#case-001
    const hash = (location.hash || '').replace('#', '').trim();
    if (hash.startsWith('case-')) {
      const id = hash.replace('case-', '');
      // wait for layout
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        openCase(id, { pushHash: false });
      }, 60);
    }
  }

  // ---------- Case page ----------
  function renderCasePage() {
    const wrap = $('#caseView');
    if (!wrap) return;

    const id = document.body.getAttribute('data-case-id') || '';
    const k = CASES.find((x) => x.id === id);

    if (!k) {
      wrap.innerHTML = `<div class="note">Кейс не найден.</div>`;
      return;
    }

    const d = CASE_DETAILS[id] || {};

    const castLinks = (d.cast || []).map((n) => `<span class="metaPill">${esc(n)}</span>`).join('');
    const sparks = (d.sparks || []).map((s) => `<li>${esc(s)}</li>`).join('');
    const syn = (d.synopsis || []).map((p) => `<p class="p">${esc(p)}</p>`).join('');

    wrap.innerHTML = `
      <div class="panel reveal">
        <div class="panel__head">
          <div>
            <div class="panel__title">Case ${esc(k.id)} — ${esc(k.title)}</div>
            <div class="panel__sub">${esc(fmtDate(k.date))} • ${esc(k.place)}</div>
          </div>
          <span class="badge">Heat ${esc(String(k.heat))}/5</span>
        </div>
        <p class="p"><strong>${esc(d.headline || '')}</strong></p>
        ${heatDots(k.heat)}
      </div>

      <div class="grid2" style="margin-top:14px">
        <div class="panel reveal">
          <div class="panel__head"><div><div class="panel__title">Синопсис</div><div class="panel__sub">сцена / напряжение / решение</div></div><span class="badge">story</span></div>
          ${syn}
        </div>
        <div class="panel reveal">
          <div class="panel__head"><div><div class="panel__title">Локальные искры</div><div class="panel__sub">что поднимает Heat</div></div><span class="badge">sparks</span></div>
          <p class="p">Это не инструкция — это художественные триггеры для RP‑сцен.</p>
          <ul class="p" style="margin:10px 0 0 18px">${sparks}</ul>
        </div>
      </div>

      <div class="panel reveal" style="margin-top:14px">
        <div class="panel__head"><div><div class="panel__title">Участники</div><div class="panel__sub">ключевые лица эпизода</div></div><span class="badge">cast</span></div>
        <div class="metaRow">${castLinks}</div>
        <p class="p" style="margin-top:12px">${esc(d.outcome || '')}</p>
      </div>
    `;

    observeReveals();
  }

  // ---------- Search modal ----------
  const searchBtn = $('#searchBtn');

  const makeResults = (q) => {
    const query = (q || '').trim().toLowerCase();
    if (!query) return [];

    const hits = [];

    // pages / sections
    for (const d of DOCS) {
      if ((d.title + ' ' + d.text).toLowerCase().includes(query)) {
        hits.push({
          type: d.type,
          title: d.title,
          href: rjoin(d.href),
          snippet: d.text.split(' ').slice(0, 18).join(' ') + '…'
        });
      }
    }

    // glossary
    for (const g of GLOSSARY) {
      const text = `${g.term} ${g.pron} ${g.desc}`.toLowerCase();
      if (text.includes(query)) {
        hits.push({
          type: 'Глоссарий',
          title: g.term,
          href: rjoin('index.html#glossary'),
          snippet: g.desc
        });
      }
    }

    // cases
    for (const k of CASES) {
      const text = `${k.id} ${k.title} ${k.date} ${k.place} ${k.summary} ${k.tags.join(' ')}`.toLowerCase();
      if (text.includes(query)) {
        hits.push({
          type: 'Кейсы',
          title: `Case ${k.id} — ${k.title}`,
          href: rjoin(k.slug),
          snippet: k.summary
        });
      }
    }

    // characters
    for (const c of CHARACTERS) {
      const text = `${c.name} ${c.alias} ${c.dob} ${c.role} ${c.set} ${c.tags.join(' ')} ${c.bio}`.toLowerCase();
      if (text.includes(query)) {
        hits.push({
          type: 'Персонажи',
          title: `${c.name} ${c.alias}`,
          href: rjoin(`characters.html#char-${c.id}`),
          snippet: `${c.role} • ${c.set}`
        });
      }
    }

    return hits.slice(0, 20);
  };

  const openSearch = () => {
    const body = `
      <div class="formRow" style="margin-top:10px">
        <input class="input" id="modalSearchInput" type="search" placeholder="Поиск по лору, кейсам, персонажам, терминам…" autocomplete="off" />
        <button class="btn btn--primary" id="modalSearchGo" type="button">Найти</button>
      </div>
      <hr class="hr" />
      <div id="modalSearchResults" aria-live="polite"></div>
    `;

    openModal('Поиск по хабу', body);

    const input = $('#modalSearchInput');
    const go = $('#modalSearchGo');
    const out = $('#modalSearchResults');

    const render = () => {
      const q = input?.value || '';
      const hits = makeResults(q);
      if (!out) return;

      if (!q.trim()) {
        out.innerHTML = '<div class="note">Начни вводить запрос — результаты появятся здесь.</div>';
        return;
      }

      if (!hits.length) {
        out.innerHTML = '<div class="note">Ничего не найдено. Попробуй другой запрос или более короткое слово.</div>';
        return;
      }

      out.innerHTML = hits
        .map(
          (h) => `
          <div class="panel" style="margin-top:12px">
            <div class="panel__head">
              <div>
                <div class="panel__title">${esc(h.title)}</div>
                <div class="panel__sub">${esc(h.type)}</div>
              </div>
              <a class="btn btn--ghost" href="${esc(h.href)}">Открыть</a>
            </div>
            <p class="p">${esc(h.snippet)}</p>
          </div>
        `
        )
        .join('');
    };

    input?.addEventListener('input', render);
    go?.addEventListener('click', render);

    // initial
    if (out) out.innerHTML = '<div class="note">Начни вводить запрос — результаты появятся здесь.</div>';
  };

  searchBtn?.addEventListener('click', openSearch);

  // ---------- Page-specific init ----------
  renderGlossary();
  renderCharacters('#charactersPreviewGrid', { limit: 6 });
  renderCases('#casesPreviewGrid', { limit: 3 });

  setupCharactersPage();
  setupCasesPage();
  renderCasePage();

  // Heat meter on index
  const heatMeter = $('#heatMeter');
  if (heatMeter) {
    const level = Number(heatMeter.getAttribute('data-heat') || '3');
    heatMeter.insertAdjacentHTML('beforeend', heatDots(Math.max(1, Math.min(5, level || 3))));
  }

  // ---------- Smooth cross-page transitions (minimal) ----------
  // Add a light enter animation on non-sheet pages (sheet pages handle it in their own CSS)
  try {
    if (!document.body.classList.contains('sheetPage')) {
      document.body.classList.add('pageEnter');
      setTimeout(() => document.body.classList.remove('pageEnter'), 450);
    }
  } catch (_) {}

  const isInternalLink = (a) => {
    try {
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin;
    } catch (_) {
      return false;
    }
  };

  const intercept = (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.hasAttribute('download')) return;
    if (a.getAttribute('target') === '_blank') return;
    if (!isInternalLink(a)) return;

    const url = new URL(a.getAttribute('href'), window.location.href);
    // same-page hash navigation should not animate
    if (url.pathname === window.location.pathname && url.hash) return;

    // Avoid double handling
    if (document.body.classList.contains('is-leaving')) return;

    e.preventDefault();
    try { closeMenu(); closeModal(); } catch (_) {}
    document.body.classList.add('is-leaving');
    setTimeout(() => {
      window.location.href = url.href;
    }, 170);
  };

  document.addEventListener('click', intercept);


  // ---------- Card spotlight (subtle) ----------
  // Drives CSS radial highlight with --mx/--my variables.
  const spotlightCards = $$('.card');
  spotlightCards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / Math.max(1, r.width)) * 100;
      const y = ((e.clientY - r.top) / Math.max(1, r.height)) * 100;
      card.style.setProperty('--mx', x.toFixed(2) + '%');
      card.style.setProperty('--my', y.toFixed(2) + '%');
    }, { passive: true });
  });

  // ---------- Ripple on buttons ----------
  // Small, tasteful ripple that respects reduced motion.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    const rippleTargets = $$('.btn, .iconBtn');
    rippleTargets.forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        // Only left-click / primary touch
        if (e.button !== undefined && e.button !== 0) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const s = document.createElement('span');
        s.className = 'ripple';
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        el.appendChild(s);
        setTimeout(() => s.remove(), 650);
      }, { passive: true });
    });
  }

})();
