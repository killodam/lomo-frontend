const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const infoModal = document.getElementById('infoModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCloseBtn = document.getElementById('modalCloseBtn');

const screens = {
  landing: document.getElementById('screenLanding'),
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
  // Info screens (burger menu)
  how: document.getElementById('screenHow'),
  security: document.getElementById('screenSecurity'),
  terms: document.getElementById('screenTerms'),
  privacy: document.getElementById('screenPrivacy'),
  contacts: document.getElementById('screenContacts'),
  about: document.getElementById('screenAbout'),
  faq: document.getElementById('screenFaq'),
};
var activeScreenKey = '';

var _RESTORABLE_SCREENS = ['candidateFeed','employerSearch','adminQueue','myEmployeeProfile','myEmployerProfile','chat','recruiterPublic','employeePublic'];

function saveLastScreen(key) {
  if (_RESTORABLE_SCREENS.indexOf(key) === -1) return;
  try { sessionStorage.setItem('lomo_screen', key); } catch(e) {}
}

function getLastScreen() {
  try { return sessionStorage.getItem('lomo_screen') || ''; } catch(e) { return ''; }
}

function clearLastScreen() {
  try { sessionStorage.removeItem('lomo_screen'); } catch(e) {}
}

function emitScreenChange(nextKey, previousKey) {
  var event;
  try {
    if (typeof window.CustomEvent === 'function') {
      event = new CustomEvent('lomo:screen-change', {
        detail: {
          current: nextKey,
          previous: previousKey || '',
        },
      });
    } else {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('lomo:screen-change', false, false, {
        current: nextKey,
        previous: previousKey || '',
      });
    }
    window.dispatchEvent(event);
  } catch (error) {}
}


function clearScreenInputs(key) {
  if (!screens[key]) return;
  screens[key].querySelectorAll('input, textarea').forEach((element) => {
    if (element.type === 'checkbox') element.checked = false;
    else element.value = '';
  });
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
  show('landing');
}

function show(key) {
  var targetKey = key;
  var previousKey = activeScreenKey;
  Object.entries(screens).forEach(function (entry) {
    var screenKey = entry[0];
    var screen = entry[1];
    setScreenActiveState(screen, screenKey === targetKey);
  });
  if (!screens[targetKey]) return;
  activeScreenKey = targetKey;
  saveLastScreen(targetKey);
  try { screens[targetKey].scrollTop = 0; } catch (error) {}
  if (typeof closeDrawer === 'function') closeDrawer();
  if (typeof closeModal === 'function') closeModal();
  if (targetKey === 'regForm') {
    clearScreenInputs('regForm');
    updateConsentRoleText();
    resetConsents();
  }
  if (targetKey === 'loginForm') clearScreenInputs('loginForm');
  if (targetKey === 'employeePublic') { updateProfileProgress(); loadIncomingRequests(); loadOwnConnections(); }
  if (targetKey === 'recruiterPublic') loadOwnConnections();
  if (targetKey === 'adminQueue') { loadAdminQueue(); loadAdminUsers(); switchAdminTab('docs'); }
  if (targetKey === 'candidateFeed') loadCandidateFeed();
  if (targetKey === 'employerSearch') loadEmployerSearch();
  if (targetKey === 'myEmployeeProfile') hydrateCvPrivacy();
  if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.handleScreenChange === 'function') {
    window.LOMO_CHAT_UI.handleScreenChange(targetKey);
  }
  emitScreenChange(targetKey, previousKey);
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
