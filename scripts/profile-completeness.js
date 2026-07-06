/* Profile completeness: pure formula (portable to backend for ranking) +
   candidate-facing UI: progress bar in own profile, feed banner, milestone
   notifications (40/70/100). */

/* ── Pure formula. No DOM, no globals — input is a plain object. ────────
   input = {
     hasPhoto: bool,
     vacancies: string,        // желаемая должность
     aboutLength: number,
     skillsCount: number,
     workExpCount: number,
     currentJob: string,       // включая «Не работаю»
     eduPlace: string,
     grade: string,
     workFormat: string,
     salary: string,
     city: string,
     hasUploadedDoc: bool,     // ≥1 документ в любом статусе
     hasPendingDoc: bool,
     hasVerifiedDoc: bool      // бейдж LOMO ≥ 1
   }
   Возвращает { percent, items: [{ key, points, earned, done, pending, hint, short, tab }] } */
function computeProfileCompleteness(input) {
  var src = input || {};
  var items = [];

  function add(key, points, earned, hint, short, tab, pending) {
    items.push({
      key: key,
      points: points,
      earned: earned,
      done: earned >= points,
      pending: !!pending,
      hint: hint,
      short: short,
      tab: tab,
    });
  }

  add('photo', 5, src.hasPhoto ? 5 : 0,
    '+5% — загрузите фото профиля', 'загрузите фото профиля', 'tabCMain');

  add('job', 10, String(src.vacancies || '').trim() ? 10 : 0,
    '+10% — укажите желаемую должность', 'укажите желаемую должность', 'tabCMain');

  var aboutLength = Number(src.aboutLength) || 0;
  var aboutEarned = aboutLength >= 200 ? 10 : aboutLength > 0 ? 5 : 0;
  add('about', 10, aboutEarned,
    aboutEarned === 5
      ? '+5% — дополните «О себе» до 200 символов'
      : '+10% — расскажите о себе (от 200 символов)',
    'расскажите о себе', 'tabCMain');

  add('skills', 10, (Number(src.skillsCount) || 0) >= 3 ? 10 : 0,
    '+10% — добавьте навыки (минимум 3)', 'добавьте навыки (минимум 3)', 'tabCMain');

  add('exp', 10, (Number(src.workExpCount) || 0) >= 1 ? 10 : 0,
    '+10% — добавьте опыт работы', 'добавьте опыт работы', 'tabCExp');

  add('currentJob', 5, String(src.currentJob || '').trim() ? 5 : 0,
    '+5% — укажите текущее место работы (или «Не работаю»)', 'укажите текущее место работы', 'tabCExp');

  add('edu', 10, String(src.eduPlace || '').trim() ? 10 : 0,
    '+10% — добавьте образование', 'добавьте образование', 'tabCMain');

  var hasGradeFormat = !!(String(src.grade || '').trim() && String(src.workFormat || '').trim());
  add('gradeFormat', 5, hasGradeFormat ? 5 : 0,
    '+5% — выберите грейд и формат работы', 'выберите грейд и формат работы', 'tabCMain');

  add('salary', 5, String(src.salary || '').trim() ? 5 : 0,
    '+5% — укажите зарплатные ожидания', 'укажите зарплатные ожидания', 'tabCMain');

  add('city', 5, String(src.city || '').trim() ? 5 : 0,
    '+5% — укажите город', 'укажите город', 'tabCMain');

  add('doc', 10, src.hasUploadedDoc ? 10 : 0,
    '+10% — загрузите документ на верификацию', 'загрузите документ на верификацию', 'tabCDocs');

  var verifyPending = !src.hasVerifiedDoc && !!src.hasPendingDoc;
  add('verify', 15, src.hasVerifiedDoc ? 15 : 0,
    verifyPending
      ? '+15% — пройдите верификацию: документ уже на проверке'
      : '+15% — пройдите проверку: загрузите документ и дождитесь модерации',
    'пройдите проверку документа', 'tabCDocs', verifyPending);

  var total = 0;
  var earnedTotal = 0;
  items.forEach(function (item) {
    total += item.points;
    earnedTotal += item.earned;
  });

  // Округление вниз; 100% — только при полном наборе баллов.
  var percent = Math.floor((earnedTotal / total) * 100);
  if (earnedTotal === total) percent = 100;
  else if (percent >= 100) percent = 99;

  return { percent: percent, items: items };
}

/* ── Adapter: собирает input из клиентского state ─────────────────────── */
function computeProfileCompletenessFromState() {
  var p = state.employee || {};
  var proofs = p.proofs || {};
  var hasUploadedDoc = false;
  var hasPendingDoc = false;
  var hasVerifiedDoc = false;

  Object.keys(proofs).forEach(function (key) {
    var proof = proofs[key];
    if (!proof) return;
    var status = String(proof.status || '').toLowerCase();
    var uploaded = !!(proof.docId || proof.fileName) && status.indexOf('не загруж') === -1;
    if (uploaded) hasUploadedDoc = true;
    if (status.indexOf('рассмотр') !== -1 || status === 'pending') hasPendingDoc = true;
    if (status.indexOf('подтверж') !== -1 || status === 'verified') hasVerifiedDoc = true;
  });

  var skillsCount = String(p.skills || '').split(/[,;]+/).map(function (item) {
    return item.trim();
  }).filter(Boolean).length;

  return computeProfileCompleteness({
    hasPhoto: !!p.avatarDataUrl,
    vacancies: p.vacancies || '',
    aboutLength: String(p.about || '').trim().length,
    skillsCount: skillsCount,
    workExpCount: (p.work_exp || []).length,
    currentJob: p.current_job || '',
    eduPlace: p.eduPlace || '',
    grade: p.grade || '',
    workFormat: p.workFormat || '',
    salary: p.salaryExpectations || '',
    city: p.city || '',
    hasUploadedDoc: hasUploadedDoc,
    hasPendingDoc: hasPendingDoc,
    hasVerifiedDoc: hasVerifiedDoc,
  });
}

/* ── Milestone notifications (40/70/100) ──────────────────────────────── */
var _completenessThresholdsTried = {};

function maybeNotifyCompleteness(percent) {
  if (state.roleReg !== 'EMPLOYEE' || !state.userId) return;
  if (typeof getToken !== 'function' || !getToken()) return;

  var thresholds = [100, 70, 40];
  var reached = 0;
  for (var i = 0; i < thresholds.length; i++) {
    if (percent >= thresholds[i]) { reached = thresholds[i]; break; }
  }
  if (!reached || _completenessThresholdsTried[reached]) return;
  _completenessThresholdsTried[reached] = true;

  apiFetch('/notifications/completeness', {
    method: 'POST',
    body: JSON.stringify({ threshold: reached }),
  }).then(function (result) {
    // created=false → порог уже отмечался раньше (например, с другого устройства)
    if (result && result.created && result.message) {
      showToast(result.message, 'success');
      if (typeof refreshNotificationsBell === 'function') refreshNotificationsBell();
    }
  }).catch(function () {
    _completenessThresholdsTried[reached] = false;
  });
}

/* ── Feed banner: <70%, раз в сессию, крестик прячет на 3 дня ─────────── */
function renderFeedCompletenessBanner() {
  var banner = document.getElementById('feedCompletenessBanner');
  if (!banner) return;

  function hide() { banner.classList.add('hidden'); }

  if (state.roleReg !== 'EMPLOYEE' || !state.userId) { hide(); return; }

  var result = computeProfileCompletenessFromState();
  if (result.percent >= 70) { hide(); return; }

  var hiddenUntil = state.onboarding && state.onboarding.bannerHiddenUntil;
  if (hiddenUntil) {
    var ts = new Date(hiddenUntil).getTime();
    if (isFinite(ts) && Date.now() < ts) { hide(); return; }
  }

  var sessionKey = 'lomo_completeness_banner_shown';
  var alreadyShown = '';
  try { alreadyShown = sessionStorage.getItem(sessionKey) || ''; } catch (e) {}
  if (alreadyShown === String(state.userId) && banner.classList.contains('hidden')) return;

  var textEl = document.getElementById('feedCompletenessText');
  if (textEl) {
    textEl.textContent = 'Профиль заполнен на ' + result.percent + '%. Дозаполните до 70%, чтобы участвовать в AI-подборе на равных.';
  }
  banner.classList.remove('hidden');
  try { sessionStorage.setItem(sessionKey, String(state.userId)); } catch (e) {}
}

(function initCompletenessBanner() {
  var fillBtn = document.getElementById('feedCompletenessFill');
  var closeBtn = document.getElementById('feedCompletenessClose');
  var banner = document.getElementById('feedCompletenessBanner');

  if (fillBtn) {
    fillBtn.addEventListener('click', function () {
      if (typeof hydrateEmployeeForm === 'function') hydrateEmployeeForm();
      show('myEmployeeProfile');
    });
  }
  if (closeBtn && banner) {
    closeBtn.addEventListener('click', function () {
      banner.classList.add('hidden');
      if (state.onboarding) {
        state.onboarding.bannerHiddenUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      }
      apiDismissCompletenessBanner().then(function (result) {
        if (state.onboarding && result && result.hiddenUntil) {
          state.onboarding.bannerHiddenUntil = result.hiddenUntil;
        }
      }).catch(function () {});
    });
  }
})();
