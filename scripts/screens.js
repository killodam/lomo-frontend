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
  myJobs: document.getElementById('screenMyJobs'),
  postJob: document.getElementById('screenPostJob'),
  // Info screens (burger menu)
  how: document.getElementById('screenHow'),
  security: document.getElementById('screenSecurity'),
  terms: document.getElementById('screenTerms'),
  privacy: document.getElementById('screenPrivacy'),
  contacts: document.getElementById('screenContacts'),
  about: document.getElementById('screenAbout'),
  faq: document.getElementById('screenFaq'),
  subscriptions: document.getElementById('screenSubscriptions'),
};
var activeScreenKey = '';
var _screenHistoryApplying = false;

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

function getScreenHistoryState(key) {
  var current = {};
  var existing = window.history && history.state && typeof history.state === 'object' ? history.state : {};
  Object.keys(existing).forEach(function (name) {
    current[name] = existing[name];
  });
  current.lomo = true;
  current.lomoScreen = key;
  return current;
}

function writeScreenHistory(key, options) {
  var opts = options || {};
  var currentState;
  if (_screenHistoryApplying || !window.history || !history.pushState || !history.replaceState) return;
  if (!screens[key]) return;

  currentState = history.state && typeof history.state === 'object' ? history.state : {};
  if (opts.replaceHistory || opts.initialHistory || !currentState.lomoScreen) {
    history.replaceState(getScreenHistoryState(key), document.title, location.href);
    return;
  }

  if (currentState.lomoScreen === key) {
    history.replaceState(getScreenHistoryState(key), document.title, location.href);
    return;
  }

  history.pushState(getScreenHistoryState(key), document.title, location.href);
}

function getAuthenticatedHistoryScreen(key) {
  var authScreens = ['landing','loginForm','roleReg','regForm','forgot','resetPassword'];
  if (typeof state === 'undefined' || !state.userId || authScreens.indexOf(key) === -1) return key;
  if (state.roleReg === 'ADMIN') return 'adminQueue';
  if (state.roleReg === 'EMPLOYER') return 'employerSearch';
  return 'candidateFeed';
}

function restoreScreenFromHistory(event) {
  var state = event && event.state && typeof event.state === 'object' ? event.state : {};
  var key = getAuthenticatedHistoryScreen(state.lomoScreen || '');
  if (!key || !screens[key]) return;

  _screenHistoryApplying = true;
  try {
    show(key);
  } finally {
    _screenHistoryApplying = false;
  }
}

if (window.history && history.pushState) {
  window.addEventListener('popstate', restoreScreenFromHistory);
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
  screen.style.display = isActive ? '' : 'none';
  screen.classList.toggle('active', isActive);
  screen.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  if (isActive) screen.removeAttribute('inert');
  else screen.setAttribute('inert', '');
}

function showEntryScreen(options) {
  var opts = options || {};
  if (opts.clearAuth !== false && typeof clearAuthInputs === 'function') clearAuthInputs();
  clearLastScreen();
  show('landing', { replaceHistory: true });
}

function show(key, options) {
  var targetKey = key;
  var previousKey = activeScreenKey;
  var historyOptions = options || {};
  if (!screens[targetKey]) return;

  if (targetKey === activeScreenKey) {
    writeScreenHistory(targetKey, historyOptions);
    if (typeof closeDrawer === 'function') closeDrawer();
    if (typeof closeModal === 'function') closeModal();
    return;
  }

  Object.entries(screens).forEach(function (entry) {
    var screenKey = entry[0];
    var screen = entry[1];
    setScreenActiveState(screen, screenKey === targetKey);
  });
  activeScreenKey = targetKey;
  saveLastScreen(targetKey);
  writeScreenHistory(targetKey, Object.assign({}, historyOptions, { initialHistory: !previousKey }));
  try { screens[targetKey].scrollTop = 0; } catch (error) {}
  if (typeof closeDrawer === 'function') closeDrawer();
  if (typeof closeModal === 'function') closeModal();
  if (targetKey === 'regForm') {
    clearScreenInputs('regForm');
    updateConsentRoleText();
    resetConsents();
  }
  if (targetKey === 'loginForm') {
    clearScreenInputs('loginForm');
    var loginPasswordError = document.getElementById('loginPasswordError');
    var loginPasswordInputWrap = document.getElementById('sqInputLoginPassword');
    if (loginPasswordError) loginPasswordError.classList.add('hidden');
    if (loginPasswordInputWrap) loginPasswordInputWrap.classList.remove('inputError');
  }
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
