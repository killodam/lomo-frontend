const legalModalEl = document.getElementById('legalModal');
const legalModalCloseEl = document.getElementById('legalModalClose');
const verifyLevelModalEl = document.getElementById('verifyLevelModal');
const verifyLevelCloseEl = document.getElementById('verifyLevelClose');

function openDrawer() {
  if (!drawer || !drawerOverlay) return;
  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  drawerOverlay.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  if (!drawer || !drawerOverlay) return;
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  drawerOverlay.setAttribute('aria-hidden', 'true');
}

function toggleDrawer() {
  if (!drawer) return;
  drawer.classList.contains('open') ? closeDrawer() : openDrawer();
}

function openModal(key) {
  if (!infoModal) return;
  const content = getModalContent(key);
  modalTitle.textContent = content.title;
  modalBody.innerHTML = content.html;
  infoModal.classList.add('open');
  infoModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  if (!infoModal) return;
  infoModal.classList.remove('open');
  infoModal.setAttribute('aria-hidden', 'true');
}

function renderModalParagraphs(items, extraClass) {
  return (items || []).map(function (item) {
    return '<p class="modalParagraph' + (extraClass ? ' ' + extraClass : '') + '">' + item + '</p>';
  }).join('');
}

function renderModalList(items, ordered) {
  var tag = ordered ? 'ol' : 'ul';
  return '<' + tag + ' class="modalList">' + (items || []).map(function (item) {
    return '<li class="modalListItem">' + item + '</li>';
  }).join('') + '</' + tag + '>';
}

function renderModalContacts(items, metaText) {
  return (items || []).map(function (item) {
    return '<p class="modalParagraph"><span class="modalContactLabel">' + item.label + ':</span> <span class="modalContactValue">' + item.value + '</span></p>';
  }).join('') + (metaText ? '<p class="modalMeta">' + metaText + '</p>' : '');
}

function renderFaqItems(items) {
  return (items || []).map(function (item) {
    return '<div class="faqItem"><div class="faqQ">' + item.question + '</div><div class="faqA">' + item.answer + '</div></div>';
  }).join('');
}

function renderLegalSections(sections, versionText) {
  return (sections || []).map(function (section) {
    return '<h3>' + section.title + '</h3><p>' + section.text + '</p>';
  }).join('') + (versionText ? '<p class="legalVersion">' + versionText + '</p>' : '');
}

function getModalContent(key) {
  const panels = {
    how: {
      title: 'Как работает LOMO',
      html: renderModalParagraphs([
        'LOMO — платформа верификации карьерных данных.',
      ]) + renderModalList([
        'Зарегистрируйтесь как кандидат или работодатель.',
        'Загрузите документы: диплом, трудовую книжку, сертификаты.',
        'Администратор проверяет и ставит отметку ✓ на профиле.',
        'Работодатели видят верифицированные профили.',
      ], true),
    },
    security: {
      title: 'Безопасность и приватность',
      html: renderModalList([
        'Документы хранятся на защищённых серверах.',
        'Данные не передаются третьим лицам.',
        'Доступ к файлам только у верификатора.',
        'Соединение защищено HTTPS.',
      ]),
    },
    terms: {
      title: 'Условия использования',
      html: renderModalList([
        'Предоставляйте только достоверные данные.',
        'Запрещено загружать чужие или поддельные документы.',
        'Нарушение — блокировка аккаунта.',
      ]),
    },
    privacy: {
      title: 'Политика конфиденциальности',
      html: renderModalParagraphs([
        'Собираем минимум данных: имя, email, документы.',
        'Телефон и email не публикуются публично.',
        'Удаление аккаунта доступно в личном профиле после подтверждения паролем.',
      ]),
    },
    contacts: {
      title: 'Контакты',
      html: renderModalContacts([
        { label: 'Email', value: 'support@lomo.website' },
        { label: 'Telegram', value: '@lomo_support' },
      ], 'Пн–Пт, 9:00–18:00 МСК'),
    },
    about: {
      title: 'О проекте LOMO',
      html: renderModalParagraphs([
        'LOMO — платформа верификации карьерных данных для рынка найма.',
        'Кандидаты подтверждают образование и опыт документами, работодатели находят проверенных специалистов.',
      ]) + '<p class="modalMeta">Запущен в 2024 году. Верификация — 1–2 рабочих дня.</p>',
    },
    faq: {
      title: 'Частые вопросы',
      html: renderFaqItems([
        { question: 'Сколько стоит?', answer: 'Для кандидатов — бесплатно.' },
        { question: 'Как долго верификация?', answer: '1–2 рабочих дня.' },
        { question: 'Какие форматы?', answer: 'PDF, JPG, PNG, DOCX — до 50 МБ.' },
        { question: 'Видят ли работодатели мои документы?', answer: 'Нет — только статус ✓ или ✗.' },
      ]),
    },
  };

  return panels[key] || { title: '—', html: '' };
}

function openLegalModal(type) {
  const el = document.getElementById('legalModal');
  const title = document.getElementById('legalModalTitle');
  const body = document.getElementById('legalModalBody');
  const legalPanels = {
    terms: {
      title: 'Условия использования',
      sections: [
        { title: '1. Общие положения', text: 'Использование платформы LOMO означает согласие с настоящими условиями. LOMO — сервис верификации карьерных данных для рынка найма.' },
        { title: '2. Пользователь (кандидат)', text: 'Пользователь обязуется загружать только подлинные документы. Загрузка поддельных материалов влечёт блокировку аккаунта и может быть передана правоохранительным органам.' },
        { title: '3. Работодатель', text: 'Работодатель обязуется использовать данные кандидатов исключительно для целей найма. Передача данных третьим лицам без согласия кандидата запрещена.' },
        { title: '4. Верификация', text: 'LOMO подтверждает факт предоставленных документов, но не несёт ответственности за достоверность самих сведений в случае предоставления поддельных материалов.' },
        { title: '5. Изменение условий', text: 'LOMO вправе изменять данные условия, уведомив пользователей за 14 дней до вступления в силу.' },
      ],
    },
    privacy: {
      title: 'Политика конфиденциальности',
      sections: [
        { title: '1. Сбор данных', text: 'LOMO собирает: имя, email, загруженные документы, историю верификаций. Данные необходимы исключительно для работы платформы.' },
        { title: '2. Хранение', text: 'Документы хранятся в зашифрованном виде. Доступ к файлам — только у модераторов при проверке и у работодателя после явного согласия кандидата.' },
        { title: '3. Приватность по умолчанию', text: 'Все загруженные файлы — приватны. Работодатель видит только статусы. Доступ к файлам выдаётся кандидатом явно, через систему запросов.' },
        { title: '4. Удаление данных', text: 'Пользователь вправе удалить свой аккаунт и связанные данные в личном профиле после подтверждения паролем. Отдельные резервные копии могут храниться ограниченное время в рамках инфраструктурной политики.' },
        { title: '5. Cookies', text: 'LOMO использует только функциональные cookies. Рекламные и аналитические трекеры не используются без явного согласия.' },
      ],
    },
  };
  const panel = type === 'terms' ? legalPanels.terms : legalPanels.privacy;

  if (!el) return;
  title.textContent = panel.title;
  body.innerHTML = renderLegalSections(panel.sections, 'Актуальная версия: апрель 2026.');
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
}

function openVerifyLevelModal() {
  const el = document.getElementById('verifyLevelModal');
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
}

function bindUiAction(id, eventName, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(eventName, handler);
}

function handleLogoutToLanding(action) {
  action();
  showEntryScreen();
}

function bindChipFilter(chipSelector, selectId, attributeName, handler) {
  var select = document.getElementById(selectId);

  if (select) {
    select.addEventListener('change', function () {
      handler();
    });
  }

  document.querySelectorAll(chipSelector).forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll(chipSelector).forEach(function (currentChip) {
        currentChip.classList.remove('active');
      });
      chip.classList.add('active');
      if (select) select.value = chip.getAttribute(attributeName) || '';
      handler();
    });
  });
}

function bindStaticUiActions() {
  bindUiAction('feedMyProfileBtn', 'click', function () { goToMyProfile(); });
  bindUiAction('searchCompanyProfileBtn', 'click', function () { goToMyProfile(); });
  bindUiAction('employerLogoutAllBtn', 'click', function () { handleLogoutToLanding(logoutAllSessions); });
  bindUiAction('employeeLogoutAllBtn', 'click', function () { handleLogoutToLanding(logoutAllSessions); });
  bindUiAction('adminLogoutBtn', 'click', function () { handleLogoutToLanding(logout); });
  bindUiAction('addWorkExpBtn', 'click', function () { addWorkExp(); });
  bindUiAction('cvPublicToggle', 'change', function () { updateCvPrivacy(); });
  bindUiAction('epOnboardDismiss', 'click', function () {
    const banner = document.getElementById('epOnboardBanner');
    if (banner) banner.classList.add('hidden');
  });
  bindUiAction('verifyLevelInfoBtn', 'click', function () { openVerifyLevelModal(); });
  bindUiAction('refreshAdminQueueBtn', 'click', function () { loadAdminQueue(); });
  bindUiAction('adminPreviewCandidateBtn', 'click', function () {
    show('employerSearch');
    var btn = document.getElementById('empAdminBackBtn');
    if (btn) btn.classList.remove('hidden');
  });
  bindUiAction('adminPreviewEmployerBtn', 'click', function () {
    show('candidateFeed');
    var btn = document.getElementById('feedAdminBackBtn');
    if (btn) btn.classList.remove('hidden');
  });
  bindUiAction('feedAdminBackBtn', 'click', function () {
    var btn = document.getElementById('feedAdminBackBtn');
    if (btn) btn.classList.add('hidden');
    show('adminQueue');
  });
  bindUiAction('empAdminBackBtn', 'click', function () {
    var btn = document.getElementById('empAdminBackBtn');
    if (btn) btn.classList.add('hidden');
    show('adminQueue');
  });
  if (typeof bindAdminRoleChips === 'function') bindAdminRoleChips();
  if (typeof bindEmpExtraFilters === 'function') bindEmpExtraFilters();
  bindUiAction('pubProfileBackBtn', 'click', function () { closePublicProfile(); });
  bindUiAction('userProfileCloseBtn', 'click', function () { closeUserProfile(); });

  const eduInput = document.getElementById('mpCEduPlace');
  if (eduInput) eduInput.addEventListener('input', function () { filterUniList(eduInput.value); });

  const currentJobInput = document.getElementById('mpCCurrentJob');
  if (currentJobInput) currentJobInput.addEventListener('input', function () { filterJobList(currentJobInput.value); });

  const feedSearchInput = document.getElementById('feedSearchInput');
  if (feedSearchInput) feedSearchInput.addEventListener('input', function () { debouncedFilterFeed(); });

  bindChipFilter('.feedFilterChip', 'feedViewFilter', 'data-feed-view', filterFeed);
  bindChipFilter('.feedVerifiedChip', 'feedVerifiedFilter', 'data-feed-verified', filterFeed);

  const employerSearchInput = document.getElementById('empSearchName');
  if (employerSearchInput) employerSearchInput.addEventListener('input', function () { debouncedFilterEmployerSearch(); });
  bindUiAction('empClearSearchBtn', 'click', function () {
    var inp = document.getElementById('empSearchName');
    if (inp) { inp.value = ''; }
    if (typeof filterEmployerSearch === 'function') filterEmployerSearch();
  });

  bindChipFilter('.empFilterChip', 'empSearchVerified', 'data-verified', filterEmployerSearch);

  const adminCandSearch = document.getElementById('adminCandSearch');
  if (adminCandSearch) adminCandSearch.addEventListener('input', function () { debouncedFilterAdminCandidates(); });

  const adminEmpSearch = document.getElementById('adminEmpSearch');
  if (adminEmpSearch) adminEmpSearch.addEventListener('input', function () { debouncedFilterAdminEmployers(); });

  const adminUserSearch = document.getElementById('adminUserSearch');
  if (adminUserSearch) adminUserSearch.addEventListener('input', function () { loadAdminUsers(1); });

  document.querySelectorAll('[data-legal-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (typeof showInfoScreen === 'function') {
        showInfoScreen(link.getAttribute('data-legal-link'));
      } else {
        openLegalModal(link.getAttribute('data-legal-link'));
      }
    });
  });

  document.querySelectorAll('.js-toggle-drawer').forEach(function (button) {
    button.addEventListener('click', function () { toggleDrawer(); });
  });

  // Landing page buttons
  bindUiAction('landingLoginBtn', 'click', function () { show('loginForm'); });
  bindUiAction('landingRegBtn', 'click', function () { show('roleReg'); });
  bindUiAction('ldAiRegBtn', 'click', function () { state.roleReg = 'EMPLOYER'; show('regForm'); });
  bindUiAction('landingRegBtn2', 'click', function () { show('roleReg'); });
  bindUiAction('landingRegCandidate', 'click', function () { state.roleReg = 'EMPLOYEE'; show('regForm'); });
  bindUiAction('landingRegEmployer', 'click', function () { state.roleReg = 'EMPLOYER'; show('regForm'); });

  // Landing footer info modals → fullscreen info screens
  document.querySelectorAll('.js-ld-modal').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-modal-key');
      if (typeof showInfoScreen === 'function') {
        showInfoScreen(key);
      } else {
        openModal(key);
      }
    });
  });

  document.querySelectorAll('[data-admin-tab]').forEach(function (button) {
    button.addEventListener('click', function () {
      switchAdminTab(button.getAttribute('data-admin-tab'));
    });
  });

  const userProfileModal = document.getElementById('userProfileModal');
  if (userProfileModal) {
    userProfileModal.addEventListener('click', function (event) {
      if (event.target === userProfileModal) closeUserProfile();
    });
  }
}

function showEmployerDashboard() {
  show('employerSearch');
}

function showEmployeeDashboard() {
  show('candidateFeed');
}

initHashRouting();
window.addEventListener('hashchange', initHashRouting);
if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

if (drawer) {
  drawer.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-drawer-open]');
    if (!btn) return;
    var key = btn.getAttribute('data-drawer-open');
    closeDrawer();
    if (typeof showInfoScreen === 'function') {
      showInfoScreen(key);
    } else {
      openModal(key);
    }
  });
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (infoModal) infoModal.addEventListener('click', function (event) {
  if (event.target === infoModal) closeModal();
});

if (legalModalCloseEl) {
  legalModalCloseEl.addEventListener('click', function () {
    legalModalEl.classList.remove('open');
    legalModalEl.setAttribute('aria-hidden', 'true');
  });
}
if (legalModalEl) {
  legalModalEl.addEventListener('click', function (event) {
    if (event.target === legalModalEl) {
      legalModalEl.classList.remove('open');
      legalModalEl.setAttribute('aria-hidden', 'true');
    }
  });
}

if (verifyLevelCloseEl) {
  verifyLevelCloseEl.addEventListener('click', function () {
    verifyLevelModalEl.classList.remove('open');
    verifyLevelModalEl.setAttribute('aria-hidden', 'true');
  });
}
if (verifyLevelModalEl) {
  verifyLevelModalEl.addEventListener('click', function (event) {
    if (event.target === verifyLevelModalEl) {
      verifyLevelModalEl.classList.remove('open');
      verifyLevelModalEl.setAttribute('aria-hidden', 'true');
    }
  });
}

bindStaticUiActions();
