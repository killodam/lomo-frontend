/* ── Dark / Light theme ── */
(function () {
  var THEME_KEY = 'lomo_theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('[data-theme-icon]').forEach(function (icon) {
      if (typeof lomoIcon === 'function') icon.innerHTML = lomoIcon(t === 'dark' ? 'sun' : 'moon');
      else icon.textContent = t === 'dark' ? '☀️' : '🌙';
    });
    document.querySelectorAll('[data-theme-label]').forEach(function (label) {
      label.textContent = t === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    });
  }
  var saved = '';
  try { saved = localStorage.getItem(THEME_KEY) || ''; } catch (e) {}
  applyTheme(saved || 'light');

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        applyTheme(next);
      });
    });
  });
})();

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
  bindUiAction('adminQueueSort', 'change', function () { updateAdminQueueSort(); });
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
  bindUiAction('pubProfileBackBtn', 'click', function () {
    if (typeof closeUserProfile === 'function') closeUserProfile();
    else closePublicProfile();
  });

  const eduInput = document.getElementById('mpCEduPlace');
  if (eduInput) eduInput.addEventListener('input', function () { filterUniList(eduInput.value); });

  const currentJobInput = document.getElementById('mpCCurrentJob');
  if (currentJobInput) currentJobInput.addEventListener('input', function () { filterJobList(currentJobInput.value); });

  document.querySelectorAll('[data-legal-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (typeof showInfoScreen === 'function') {
        showInfoScreen(link.getAttribute('data-legal-link'));
      }
    });
  });

  document.querySelectorAll('.js-toggle-drawer').forEach(function (button) {
    button.addEventListener('click', function () { toggleDrawer(); });
  });

  // Landing page buttons
  bindUiAction('landingLoginBtn', 'click', function () { show('loginForm'); });
  bindUiAction('landingRegBtn', 'click', function () { show('roleReg'); });
  bindUiAction('landingRegBtn2', 'click', function () { show('roleReg'); });
  bindUiAction('landingRegCandidate', 'click', function () { state.roleReg = 'EMPLOYEE'; show('regForm'); });
  bindUiAction('landingRegEmployer', 'click', function () { state.roleReg = 'EMPLOYER'; show('regForm'); });
  bindUiAction('ctaRegCandidate', 'click', function () { state.roleReg = 'EMPLOYEE'; show('regForm'); });
  bindUiAction('ctaRegEmployer', 'click', function () { state.roleReg = 'EMPLOYER'; show('regForm'); });

  // Landing footer info modals → fullscreen info screens
  document.querySelectorAll('.js-ld-modal').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-modal-key');
      if (typeof showInfoScreen === 'function') {
        showInfoScreen(key);
      }
    });
  });

}

function showEmployerDashboard(options) {
  if (typeof consumePublicProfileRedirect === 'function' && consumePublicProfileRedirect()) return;
  show('employerSearch', options || {});
}

function showEmployeeDashboard(options) {
  show('candidateFeed', options || {});
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

// Startup sweep is intentionally gone: an unconditional prune here wiped the
// theme and the favourites of the user about to log in. Stale keys of other
// users are removed on logout (pruneStaleLocalStorage) and after login below.
