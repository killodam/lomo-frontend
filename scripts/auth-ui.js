// Consents
function updateConsentRoleText() {
  const el = document.getElementById('consentRoleText');
  if (!el) return;
  const role = state.roleReg || 'EMPLOYEE';
  el.textContent = role === 'EMPLOYER'
    ? 'Я обязуюсь использовать данные кандидатов только для найма и не передавать третьим лицам'
    : 'Я даю согласие на верификацию достижений и обработку подтверждающих документов';
}

function clearConsentError() {
  const box = document.getElementById('consentBox');
  const err = document.getElementById('consentError');
  if (box) box.classList.remove('error');
  if (err) err.style.display = 'none';
}

function consentsOk() {
  const a = document.getElementById('consentTerms');
  const b = document.getElementById('consentPd');
  const c = document.getElementById('consentRole');
  return !!(a && b && c && a.checked && b.checked && c.checked);
}

function updateRegNextState() {
  const btn = document.getElementById('btnRegNext');
  if (!btn) return;
  const ok = consentsOk();
  btn.disabled = !ok;
  if (ok) clearConsentError();
}

function showConsentError() {
  const box = document.getElementById('consentBox');
  const err = document.getElementById('consentError');
  if (box) box.classList.add('error');
  if (err) err.style.display = 'block';
}

function resetConsents() {
  const a = document.getElementById('consentTerms');
  const b = document.getElementById('consentPd');
  const c = document.getElementById('consentRole');
  if (a) a.checked = false;
  if (b) b.checked = false;
  if (c) c.checked = false;
  clearConsentError();
  updateRegNextState();
}

const regPasswordEl = document.getElementById('regPassword');
if (regPasswordEl) {
  regPasswordEl.addEventListener('input', function () {
    const val = regPasswordEl.value;
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    const confirmErr = document.getElementById('regPasswordConfirmError');
    if (confirmErr) confirmErr.classList.add('hidden');
    if (!fill || !label) return;
    if (!val) {
      fill.style.width = '0';
      fill.style.background = '';
      label.textContent = '';
      return;
    }
    let score = 0;
    if (val.length >= 8) score += 1;
    if (/\d/.test(val)) score += 1;
    if (/[^a-zA-Z0-9]/.test(val)) score += 1;
    if (score === 1) {
      fill.style.width = '33%';
      fill.style.background = '#ef4444';
      label.textContent = 'Слабый';
      label.style.color = '#ef4444';
    } else if (score === 2) {
      fill.style.width = '66%';
      fill.style.background = '#f59e0b';
      label.textContent = 'Средний';
      label.style.color = '#f59e0b';
    } else if (score === 3) {
      fill.style.width = '100%';
      fill.style.background = '#22c55e';
      label.textContent = 'Надёжный';
      label.style.color = '#22c55e';
    }
  });
}

const regPasswordConfirmEl = document.getElementById('regPasswordConfirm');
if (regPasswordConfirmEl) {
  regPasswordConfirmEl.addEventListener('input', function () {
    const confirmErr = document.getElementById('regPasswordConfirmError');
    if (confirmErr) confirmErr.classList.add('hidden');
  });
}

function syncPasswordToggle(button, input) {
  if (!button || !input) return;
  const visible = input.type === 'text';
  button.textContent = visible ? 'Скрыть' : 'Показать';
  button.setAttribute('aria-pressed', visible ? 'true' : 'false');
  button.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
}

document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
  const input = document.getElementById(button.getAttribute('data-password-toggle'));
  if (!input) return;
  syncPasswordToggle(button, input);
  button.addEventListener('click', function () {
    input.type = input.type === 'password' ? 'text' : 'password';
    syncPasswordToggle(button, input);
    try {
      input.focus({ preventScroll: true });
    } catch (error) {
      input.focus();
    }
    const len = input.value.length;
    try {
      input.setSelectionRange(len, len);
    } catch (error) {}
  });
});

function wireEmailValidation(inputId, wrapId, errorId, options = {}) {
  const inp = document.getElementById(inputId);
  const wrap = document.getElementById(wrapId);
  const err = document.getElementById(errorId);
  if (!inp || !wrap || !err) return;
  const allowLogin = !!options.allowLogin;
  const emailRe = /.+@.+\..+/;
  const loginRe = /^[a-z0-9._-]{3,32}$/i;

  inp.addEventListener('blur', function () {
    const val = inp.value.trim();
    const isValid = !val || emailRe.test(val) || (allowLogin && loginRe.test(val));
    if (!isValid) {
      wrap.classList.add('inputError');
      err.classList.remove('hidden');
    }
  });

  inp.addEventListener('focus', function () {
    wrap.classList.remove('inputError');
    err.classList.add('hidden');
  });
}

wireEmailValidation('regEmail', 'sqInputRegEmail', 'regEmailError');
wireEmailValidation('loginEmail', 'sqInputLoginEmail', 'loginEmailError', { allowLogin: true });
