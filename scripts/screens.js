const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const authBurger = document.getElementById('authBurger');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const infoModal = document.getElementById('infoModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCloseBtn = document.getElementById('modalCloseBtn');

const screens = {
  landing: document.getElementById('screenLanding'),
  logo: document.getElementById('screenLogo'),
  auth: document.getElementById('screenAuth'),
  roleReg: document.getElementById('screenRoleReg'),
  regForm: document.getElementById('screenRegForm'),
  loginForm: document.getElementById('screenLoginForm'),
  forgot: document.getElementById('screenForgot'),
  verifyCode: document.getElementById('screenVerifyCode'),
  resetPassword: document.getElementById('screenResetPassword'),
  recruiterPublic: document.getElementById('screenRecruiterPublic'),
  employeePublic: document.getElementById('screenEmployeePublic'),
  myEmployerProfile: document.getElementById('screenMyEmployerProfile'),
  myEmployeeProfile: document.getElementById('screenMyEmployeeProfile'),
  done: document.getElementById('screenDone'),
  adminQueue: document.getElementById('screenAdminQueue'),
  candidateFeed: document.getElementById('screenCandidateFeed'),
  employerSearch: document.getElementById('screenEmployerSearch'),
  chat: document.getElementById('screenChat'),
  publicProfile: document.getElementById('screenPublicProfile'),
};

const legacyEntryScreens = {
  auth: 'landing',
  logo: 'landing',
};

const logoWrap = document.getElementById('logoWrap');
const mainLogoImg = document.querySelector('#screenLogo .logo');
const authLogoImg = document.getElementById('authLogoImg');

if (authLogoImg && mainLogoImg && !authLogoImg.getAttribute('src')) {
  authLogoImg.src = mainLogoImg.src;
}

const ldNavLogoImg = document.getElementById('ldNavLogoImg');
if (ldNavLogoImg && mainLogoImg) {
  ldNavLogoImg.src = mainLogoImg.src;
}

const feedHeaderLogoImg = document.getElementById('feedHeaderLogoImg');
if (feedHeaderLogoImg && mainLogoImg) {
  feedHeaderLogoImg.src = mainLogoImg.src;
}

const empSearchLogoImg = document.getElementById('empSearchLogoImg');
if (empSearchLogoImg && mainLogoImg) {
  empSearchLogoImg.src = mainLogoImg.src;
}

function clearScreenInputs(key) {
  if (!screens[key]) return;
  screens[key].querySelectorAll('input, textarea').forEach((element) => {
    if (element.type === 'checkbox') element.checked = false;
    else element.value = '';
  });
}

function resolveScreenKey(key) {
  return legacyEntryScreens[key] || key;
}

function setScreenActiveState(screen, isActive) {
  if (!screen) return;
  screen.classList.toggle('active', isActive);
  screen.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  if (isActive) screen.removeAttribute('inert');
  else screen.setAttribute('inert', '');
}

function showEntryScreen(options) {
  var opts = options || {};
  if (opts.clearAuth !== false && typeof clearAuthInputs === 'function') clearAuthInputs();
  if (opts.resetSplash !== false && typeof resetLogo === 'function') resetLogo();
  show('landing');
}

function show(key) {
  var targetKey = resolveScreenKey(key);
  Object.entries(screens).forEach(function (entry) {
    var screenKey = entry[0];
    var screen = entry[1];
    setScreenActiveState(screen, screenKey === targetKey);
  });
  if (!screens[targetKey]) return;
  try { screens[targetKey].scrollTop = 0; } catch (error) {}
  if (typeof closeDrawer === 'function') closeDrawer();
  if (typeof closeModal === 'function') closeModal();
  if (targetKey === 'regForm') {
    clearScreenInputs('regForm');
    updateConsentRoleText();
    resetConsents();
  }
  if (targetKey === 'loginForm') clearScreenInputs('loginForm');
  if (targetKey === 'auth') updateAuthButtons();
  if (targetKey === 'employeePublic') { updateProfileProgress(); loadIncomingRequests(); loadOwnConnections(); }
  if (targetKey === 'recruiterPublic') loadOwnConnections();
  if (targetKey === 'adminQueue') { loadAdminQueue(); loadAdminUsers(); switchAdminTab('docs'); }
  if (targetKey === 'candidateFeed') loadCandidateFeed();
  if (targetKey === 'employerSearch') loadEmployerSearch();
  if (targetKey === 'myEmployeeProfile') hydrateCvPrivacy();
  if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.handleScreenChange === 'function') {
    window.LOMO_CHAT_UI.handleScreenChange(targetKey);
  }
}

function updateAuthButtons() {
  var loggedIn = !!getToken();
  var choices = document.getElementById('authChoices');
  var loggedDiv = document.getElementById('authLoggedIn');
  if (choices) choices.style.display = '';
  if (loggedDiv) {
    loggedDiv.style.display = loggedIn ? 'flex' : 'none';
    if (loggedIn) {
      var btn = document.getElementById('authSearchBtn');
      if (btn) {
        if (state.roleReg) {
          btn.querySelector('.sqText').textContent = state.roleReg === 'EMPLOYER' ? 'Поиск кандидатов' : 'Открыть ленту';
        } else {
          tryAutoLogin().then(function (user) {
            if (user && btn) {
              btn.querySelector('.sqText').textContent = state.roleReg === 'EMPLOYER' ? 'Поиск кандидатов' : 'Открыть ленту';
            }
          }).catch(function () {});
        }
      }
    }
  }
}

function goToSearch() {
  var role = state.roleReg || 'EMPLOYEE';
  if (role === 'EMPLOYER') showEmployerDashboard();
  else showEmployeeDashboard();
}

function goToMyProfile() {
  var role = state.roleReg || 'EMPLOYEE';
  if (role === 'EMPLOYER') {
    renderRecruiterPublic();
    show('recruiterPublic');
  } else {
    renderEmployeePublic();
    show('employeePublic');
  }
}
