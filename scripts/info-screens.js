// info-screens.js — логика информационных экранов LOMO
// ES5: var, function declaration, no arrow functions

var infoScreenPrev = 'landing';

var faqData = [
  // ─── Кандидатам ──────────────────────────────────────────
  {
    cat: 'candidate',
    q: 'Сколько стоит верификация для кандидата?',
    a: 'Для кандидатов LOMO абсолютно бесплатен. Вы создаёте профиль, загружаете документы и получаете верификацию без каких-либо платежей. Платформа зарабатывает на подписке работодателей, а не на кандидатах.'
  },
  {
    cat: 'candidate',
    q: 'Как долго проходит проверка документов?',
    a: 'Модератор LOMO проверяет документы в течение 1–2 рабочих дней. В периоды высокой нагрузки срок может составить до 3 дней. После проверки вы получите уведомление по email с результатом.'
  },
  {
    cat: 'candidate',
    q: 'Какие форматы документов принимаются?',
    a: 'PDF, JPG, PNG, DOCX — до 50 МБ на файл. Документ должен быть читаемым: чёткое фото или скан без засветов, мятых краёв и срезанных углов. Плохое качество изображения является причиной отклонения.'
  },
  {
    cat: 'candidate',
    q: 'Видят ли работодатели мои документы напрямую?',
    a: 'Нет. Работодатель видит только статус верификации: «подтверждено» или «не загружено». Доступ к самим файлам предоставляется исключительно с вашего явного согласия — через систему запросов в вашем профиле.'
  },
  {
    cat: 'candidate',
    q: 'Можно ли обновить документы после верификации?',
    a: 'Да. Вы можете загрузить новый документ взамен старого в любое время. После повторной загрузки статус временно переходит в «на проверке» — пока модератор не рассмотрит новый файл.'
  },
  {
    cat: 'candidate',
    q: 'Что происходит с данными при удалении аккаунта?',
    a: 'При удалении аккаунта все данные и документы удаляются в течение 30 дней. Работодатели теряют доступ к профилю мгновенно. Резервные копии могут храниться до 90 дней в инфраструктурных целях согласно политике конфиденциальности.'
  },
  // ─── Работодателям ───────────────────────────────────────
  {
    cat: 'employer',
    q: 'Как получить доступ к документам кандидата?',
    a: 'Перейдите в профиль кандидата и нажмите «Запросить доступ». Кандидат получит уведомление и сможет одобрить или отклонить запрос. Доступ предоставляется только при явном согласии кандидата — автоматически ничего не открывается.'
  },
  {
    cat: 'employer',
    q: 'Что означают уровни верификации L1, L2, L3?',
    a: 'L1 — Базовый: документ проверен модератором вручную. L2 — Стандартный: дополнительная проверка через открытые источники (реестры, сайт ВУЗа). L3 — Строгий: подтверждение от организации-источника. Чем выше уровень — тем надёжнее данные.'
  },
  {
    cat: 'employer',
    q: 'Можно ли искать кандидатов по конкретным навыкам?',
    a: 'Да. В поисковой строке можно вводить навыки, должности, названия ВУЗов и компаний. Дополнительно можно фильтровать только верифицированных кандидатов и добавлять понравившихся в избранное.'
  },
  {
    cat: 'employer',
    q: 'Как работает AI-мэтчинг?',
    a: 'Нажмите кнопку «✨ AI-Мэтчинг» в строке поиска и вставьте текст вакансии или описание требований. Алгоритм анализирует ключевые компетенции, грейд и контекст, затем ранжирует верифицированных кандидатов по степени соответствия.'
  },
  {
    cat: 'employer',
    q: 'Можно ли сохранять кандидатов в папки?',
    a: 'Да. Нажмите иконку папки на карточке кандидата и выберите существующую папку или создайте новую. Это удобно для организации воронки подбора — все избранные кандидаты всегда под рукой.'
  },
  {
    cat: 'employer',
    q: 'Как написать кандидату напрямую?',
    a: 'Добавьте кандидата в контакты или запросите доступ к документам. После одобрения запроса откроется чат. Все сообщения видны только участникам диалога — LOMO не читает переписку.'
  }
];

function showInfoScreen(key) {
  if (typeof activeScreenKey !== 'undefined' && activeScreenKey) {
    infoScreenPrev = activeScreenKey;
  } else {
    infoScreenPrev = 'landing';
  }
  show(key);
}

function initInfoScreens() {
  initBackButtons();
  initAccordions();
  initFaq();
  initHowCta();
  initTermsAccept();
  initContactForm();

  window.addEventListener('lomo:screen-change', function (e) {
    var key = e.detail && e.detail.current;
    if (key === 'how') triggerHowSteps();
    if (key === 'about') triggerCounters();
  });
}

// ── Back buttons ─────────────────────────────────────────────

function initBackButtons() {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-info-back]');
    if (!btn) return;
    show(infoScreenPrev || 'landing');
  });
}

// ── Accordion (shared for Terms and any static accordions) ───

function initAccordions() {
  document.addEventListener('click', function (e) {
    var head = e.target.closest('.accordionHead');
    if (!head) return;
    var item = head.closest('.accordionItem');
    if (!item) return;
    var isOpen = item.classList.contains('open');

    // Close siblings in same container
    var container = item.parentNode;
    var siblings = container.querySelectorAll('.accordionItem.open');
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i] !== item) {
        siblings[i].classList.remove('open');
        siblings[i].querySelector('.accordionBody').style.maxHeight = '0';
      }
    }

    if (isOpen) {
      item.classList.remove('open');
      item.querySelector('.accordionBody').style.maxHeight = '0';
    } else {
      item.classList.add('open');
      var body = item.querySelector('.accordionBody');
      body.style.maxHeight = body.scrollHeight + 'px';
    }
  });
}

// ── FAQ ──────────────────────────────────────────────────────

function initFaq() {
  var list = document.getElementById('faqList');
  var empty = document.getElementById('faqEmpty');
  var searchInput = document.getElementById('faqSearchInput');
  if (!list) return;

  // Render FAQ items
  for (var i = 0; i < faqData.length; i++) {
    var item = faqData[i];
    var div = document.createElement('div');
    div.className = 'accordionItem';
    div.setAttribute('data-faq-cat', item.cat);
    div.innerHTML =
      '<button class="accordionHead" type="button">' +
        '<span>' + item.q + '</span>' +
        '<span class="accordionArrow">▾</span>' +
      '</button>' +
      '<div class="accordionBody">' +
        '<div class="accordionBodyInner">' + item.a + '</div>' +
      '</div>';
    list.appendChild(div);
  }

  // Category filter chips
  var chips = document.querySelectorAll('[data-faq-filter]');
  for (var j = 0; j < chips.length; j++) {
    (function (chip) {
      chip.addEventListener('click', function () {
        for (var k = 0; k < chips.length; k++) chips[k].classList.remove('active');
        chip.classList.add('active');
        applyFaqFilter();
      });
    })(chips[j]);
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', function () { applyFaqFilter(); });
  }

  function applyFaqFilter() {
    var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    var activeChip = document.querySelector('[data-faq-filter].active');
    var activeCat = activeChip ? (activeChip.getAttribute('data-faq-filter') || 'all') : 'all';

    var items = list.querySelectorAll('.accordionItem');
    var visibleCount = 0;
    for (var n = 0; n < items.length; n++) {
      var el = items[n];
      var cat = el.getAttribute('data-faq-cat') || '';
      var text = el.textContent.toLowerCase();
      var catOk = activeCat === 'all' || cat === activeCat;
      var searchOk = !query || text.indexOf(query) !== -1;
      if (catOk && searchOk) {
        el.classList.remove('faqHidden');
        visibleCount++;
      } else {
        el.classList.add('faqHidden');
        if (el.classList.contains('open')) {
          el.classList.remove('open');
          var b = el.querySelector('.accordionBody');
          if (b) b.style.maxHeight = '0';
        }
      }
    }
    if (empty) empty.classList.toggle('hidden', visibleCount > 0);
  }
}

// ── How screen — step animations ────────────────────────────

function triggerHowSteps() {
  var steps = document.querySelectorAll('#howSteps .infoStep');
  // Reset first so re-entering the screen re-animates
  for (var i = 0; i < steps.length; i++) {
    steps[i].classList.remove('visible');
  }
  for (var j = 0; j < steps.length; j++) {
    (function (step, idx) {
      setTimeout(function () { step.classList.add('visible'); }, 120 + idx * 160);
    })(steps[j], j);
  }
}

// ── About screen — counter animation ────────────────────────

function triggerCounters() {
  var counters = document.querySelectorAll('[data-count-to]');
  for (var i = 0; i < counters.length; i++) {
    (function (el) {
      var target = parseInt(el.getAttribute('data-count-to'), 10);
      el.textContent = target === 0 ? '0' : '0';
      setTimeout(function () { animateCounter(el, target); }, 350);
    })(counters[i]);
  }
}

function animateCounter(el, target) {
  if (target === 0) { el.textContent = '0'; return; }
  var duration = 1100;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  }
  requestAnimationFrame(step);
}

// ── How screen CTA ───────────────────────────────────────────

function initHowCta() {
  var btn = document.getElementById('howCtaBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    show('landing');
    setTimeout(function () {
      var reg = document.getElementById('landingRegBtn2');
      if (reg) reg.click();
    }, 120);
  });
}

// ── Terms accept button (visual only) ───────────────────────

function initTermsAccept() {
  var btn = document.getElementById('termsAcceptBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    btn.textContent = '✓ Условия приняты';
    btn.style.background = '#27ae60';
    btn.disabled = true;
  });
}

// ── Contact form (visual only) ───────────────────────────────

function initContactForm() {
  var btn = document.getElementById('contactFormSendBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    btn.textContent = '✓ Сообщение отправлено';
    btn.style.background = '#27ae60';
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = 'Отправить сообщение';
      btn.style.background = '';
      btn.disabled = false;
    }, 4000);
  });
}

// ── Bootstrap ────────────────────────────────────────────────

initInfoScreens();
