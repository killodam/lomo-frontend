const startBtn = document.getElementById('startBtn');
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

function getModalContent(key) {
  const panels = {
    how: { title: 'Как работает LOMO', html: '<p style="margin:0 0 10px">LOMO — платформа верификации карьерных данных.</p><ol style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Зарегистрируйтесь как кандидат или работодатель.</li><li style="margin-bottom:8px">Загрузите документы: диплом, трудовую книжку, сертификаты.</li><li style="margin-bottom:8px">Администратор проверяет и ставит отметку ✓ на профиле.</li><li>Работодатели видят верифицированные профили.</li></ol>' },
    security: { title: 'Безопасность и приватность', html: '<ul style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Документы хранятся на защищённых серверах.</li><li style="margin-bottom:8px">Данные не передаются третьим лицам.</li><li style="margin-bottom:8px">Доступ к файлам только у верификатора.</li><li>Соединение защищено HTTPS.</li></ul>' },
    terms: { title: 'Условия использования', html: '<ul style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Предоставляйте только достоверные данные.</li><li style="margin-bottom:8px">Запрещено загружать чужие или поддельные документы.</li><li>Нарушение — блокировка аккаунта.</li></ul>' },
    privacy: { title: 'Политика конфиденциальности', html: '<p style="margin:0 0 10px">Собираем минимум данных: имя, email, документы.</p><p style="margin:0 0 10px">Телефон и email не публикуются публично.</p><p style="margin:0">Удаление аккаунта доступно в личном профиле после подтверждения паролем.</p>' },
    contacts: { title: 'Контакты', html: '<p style="margin:0 0 10px">Email: <b>support@lomo.website</b></p><p style="margin:0 0 10px">Telegram: <b>@lomo_support</b></p><p style="margin:0 0 16px">Пн–Пт, 9:00–18:00 МСК</p>' },
    about: { title: 'О проекте LOMO', html: '<p style="margin:0 0 10px">LOMO — платформа верификации карьерных данных для рынка труда СНГ.</p><p style="margin:0 0 10px">Кандидаты подтверждают образование и опыт документами, работодатели находят проверенных специалистов.</p><p style="margin:0;color:#888;font-size:13px">Запущен в 2024 году. Верификация — 1–2 рабочих дня.</p>' },
    faq: { title: 'Частые вопросы', html: '<div class="faqItem"><div class="faqQ">Сколько стоит?</div><div class="faqA">Для кандидатов — бесплатно.</div></div><div class="faqItem"><div class="faqQ">Как долго верификация?</div><div class="faqA">1–2 рабочих дня.</div></div><div class="faqItem"><div class="faqQ">Какие форматы?</div><div class="faqA">PDF, JPG, PNG, DOCX — до 50 МБ.</div></div><div class="faqItem"><div class="faqQ">Видят ли работодатели мои документы?</div><div class="faqA">Нет — только статус ✓ или ✗.</div></div>' },
  };

  return panels[key] || { title: '—', html: '' };
}

function openLegalModal(type) {
  const el = document.getElementById('legalModal');
  const title = document.getElementById('legalModalTitle');
  const body = document.getElementById('legalModalBody');
  if (!el) return;
  if (type === 'terms') {
    title.textContent = 'Условия использования';
    body.innerHTML = `
      <h3>1. Общие положения</h3>
      <p>Использование платформы LOMO означает согласие с настоящими условиями. LOMO — сервис верификации карьерных данных для рынка найма.</p>
      <h3>2. Пользователь (кандидат)</h3>
      <p>Пользователь обязуется загружать только подлинные документы. Загрузка поддельных материалов влечёт блокировку аккаунта и может быть передана правоохранительным органам.</p>
      <h3>3. Работодатель</h3>
      <p>Работодатель обязуется использовать данные кандидатов исключительно для целей найма. Передача данных третьим лицам без согласия кандидата запрещена.</p>
      <h3>4. Верификация</h3>
      <p>LOMO подтверждает факт предоставленных документов, но не несёт ответственности за достоверность самих сведений в случае предоставления поддельных материалов.</p>
      <h3>5. Изменение условий</h3>
      <p>LOMO вправе изменять данные условия, уведомив пользователей за 14 дней до вступления в силу.</p>
      <p style="font-size:11px;color:#999;margin-top:16px;">Актуальная версия: апрель 2026.</p>
    `;
  } else {
    title.textContent = 'Политика конфиденциальности';
    body.innerHTML = `
      <h3>1. Сбор данных</h3>
      <p>LOMO собирает: имя, email, загруженные документы, историю верификаций. Данные необходимы исключительно для работы платформы.</p>
      <h3>2. Хранение</h3>
      <p>Документы хранятся в зашифрованном виде. Доступ к файлам — только у модераторов при проверке и у работодателя после явного согласия кандидата.</p>
      <h3>3. Приватность по умолчанию</h3>
      <p>Все загруженные файлы — приватны. Работодатель видит только статусы. Доступ к файлам выдаётся кандидатом явно, через систему запросов.</p>
      <h3>4. Удаление данных</h3>
      <p>Пользователь вправе удалить свой аккаунт и связанные данные в личном профиле после подтверждения паролем. Отдельные резервные копии могут храниться ограниченное время в рамках инфраструктурной политики.</p>
      <h3>5. Cookies</h3>
      <p>LOMO использует только функциональные cookies. Рекламные и аналитические трекеры не используются без явного согласия.</p>
      <p style="font-size:11px;color:#999;margin-top:16px;">Актуальная версия: апрель 2026.</p>
    `;
  }
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

function bindStaticUiActions() {
  bindUiAction('authSearchBtn', 'click', function () { goToSearch(); });
  bindUiAction('feedMyProfileBtn', 'click', function () { goToMyProfile(); });
  bindUiAction('searchCompanyProfileBtn', 'click', function () { goToMyProfile(); });
  bindUiAction('authLogoutAllBtn', 'click', function () { logoutAllSessions(); show('auth'); });
  bindUiAction('authLogoutBtn', 'click', function () { logout(); show('auth'); });
  bindUiAction('employerLogoutAllBtn', 'click', function () { logoutAllSessions(); show('auth'); });
  bindUiAction('employeeLogoutAllBtn', 'click', function () { logoutAllSessions(); show('auth'); });
  bindUiAction('adminLogoutBtn', 'click', function () { logout(); show('auth'); });
  bindUiAction('addWorkExpBtn', 'click', function () { addWorkExp(); });
  bindUiAction('cvPublicToggle', 'change', function () { updateCvPrivacy(); });
  bindUiAction('epOnboardDismiss', 'click', function () {
    const banner = document.getElementById('epOnboardBanner');
    if (banner) banner.style.display = 'none';
  });
  bindUiAction('verifyLevelInfoBtn', 'click', function () { openVerifyLevelModal(); });
  bindUiAction('refreshAdminQueueBtn', 'click', function () { loadAdminQueue(); });
  bindUiAction('pubProfileBackBtn', 'click', function () { closePublicProfile(); });
  bindUiAction('userProfileCloseBtn', 'click', function () { closeUserProfile(); });

  const eduInput = document.getElementById('mpCEduPlace');
  if (eduInput) eduInput.addEventListener('input', function () { filterUniList(eduInput.value); });

  const currentJobInput = document.getElementById('mpCCurrentJob');
  if (currentJobInput) currentJobInput.addEventListener('input', function () { filterJobList(currentJobInput.value); });

  const feedSearchInput = document.getElementById('feedSearchInput');
  if (feedSearchInput) feedSearchInput.addEventListener('input', function () { debouncedFilterFeed(); });

  const employerSearchInput = document.getElementById('empSearchName');
  if (employerSearchInput) employerSearchInput.addEventListener('input', function () { debouncedFilterEmployerSearch(); });

  const employerVerified = document.getElementById('empSearchVerified');
  if (employerVerified) employerVerified.addEventListener('change', function () { filterEmployerSearch(); });

  const adminCandSearch = document.getElementById('adminCandSearch');
  if (adminCandSearch) adminCandSearch.addEventListener('input', function () { debouncedFilterAdminCandidates(); });

  const adminEmpSearch = document.getElementById('adminEmpSearch');
  if (adminEmpSearch) adminEmpSearch.addEventListener('input', function () { debouncedFilterAdminEmployers(); });

  const adminUserSearch = document.getElementById('adminUserSearch');
  if (adminUserSearch) adminUserSearch.addEventListener('input', function () { loadAdminUsers(1); });

  document.querySelectorAll('[data-legal-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      openLegalModal(link.getAttribute('data-legal-link'));
    });
  });

  document.querySelectorAll('.js-toggle-drawer').forEach(function (button) {
    button.addEventListener('click', function () { toggleDrawer(); });
  });

  // Landing page buttons
  bindUiAction('landingLoginBtn', 'click', function () { show('loginForm'); });
  bindUiAction('landingLoginBtn2', 'click', function () { show('loginForm'); }); // kept for safety
  bindUiAction('landingRegBtn', 'click', function () { show('roleReg'); });
  bindUiAction('landingRegBtn2', 'click', function () { show('roleReg'); });
  bindUiAction('landingRegCandidate', 'click', function () { state.roleReg = 'EMPLOYEE'; show('regForm'); });
  bindUiAction('landingRegEmployer', 'click', function () { state.roleReg = 'EMPLOYER'; show('regForm'); });

  // Landing footer info modals
  document.querySelectorAll('.js-ld-modal').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-modal-key');
      openModal(key);
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
  loadEmployerSearch();
  show('employerSearch');
}

function showEmployeeDashboard() {
  loadCandidateFeed();
  show('candidateFeed');
}

initHashRouting();
window.addEventListener('hashchange', initHashRouting);

if (startBtn) {
  startBtn.addEventListener('click', function () {
    logoWrap.classList.add('animUp');
    setTimeout(function () { show('auth'); }, 720);
  });
}

if (authBurger) authBurger.addEventListener('click', toggleDrawer);
if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

if (drawer) {
  drawer.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-drawer-open]');
    if (!btn) return;
    const key = btn.getAttribute('data-drawer-open');
    closeDrawer();
    if (key === 'about') {
      openModal('about');
      return;
    }
    openModal(key);
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
