const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const authBurger = document.getElementById('authBurger');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const infoModal = document.getElementById('infoModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCloseBtn = document.getElementById('modalCloseBtn');

const screens = {
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

const logoWrap = document.getElementById('logoWrap');
const mainLogoImg = document.querySelector('#screenLogo .logo');
const authLogoImg = document.getElementById('authLogoImg');
const BRAND_LOGO_SRC = './icons/lomo-wordmark.png';

if (mainLogoImg) mainLogoImg.src = BRAND_LOGO_SRC;
if (authLogoImg) authLogoImg.src = BRAND_LOGO_SRC;

function clearScreenInputs(key) {
  if (!screens[key]) return;
  screens[key].querySelectorAll('input, textarea').forEach((element) => {
    if (element.type === 'checkbox') element.checked = false;
    else element.value = '';
  });
}

function show(key) {
  Object.values(screens).forEach((screen) => screen && screen.classList.remove('active'));
  if (!screens[key]) return;
  screens[key].classList.add('active');
  try { screens[key].scrollTop = 0; } catch (error) {}
  if (typeof closeDrawer === 'function') closeDrawer();
  if (typeof closeModal === 'function') closeModal();
  if (key === 'regForm') {
    clearScreenInputs('regForm');
    updateConsentRoleText();
    resetConsents();
  }
  if (key === 'loginForm') clearScreenInputs('loginForm');
  if (key === 'auth') updateAuthButtons();
  if (key === 'employeePublic') { updateProfileProgress(); loadIncomingRequests(); loadOwnConnections(); }
  if (key === 'recruiterPublic') loadOwnConnections();
  if (key === 'adminQueue') { loadAdminQueue(); loadAdminUsers(); switchAdminTab('docs'); }
  if (key === 'candidateFeed') loadCandidateFeed();
  if (key === 'employerSearch') loadEmployerSearch();
  if (key === 'myEmployeeProfile') hydrateCvPrivacy();
  if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.handleScreenChange === 'function') {
    window.LOMO_CHAT_UI.handleScreenChange(key);
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
