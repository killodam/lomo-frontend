/* «Значок LOMO»: three copy-paste formats of the verified-profile badge,
   shown in the candidate's own profile once they have LOMO ≥ 1. */

/* Кумулятивные уровни: LOMO 1 — email, LOMO 2 — личность, LOMO 3 — опыт/образование.
   Категории документов по ключам proofs. */
var LOMO_IDENTITY_PROOFS = ['passport', 'passportRegistration', 'passportSelfie'];
var LOMO_EXP_EDU_PROOFS = ['work', 'workSfr', 'workReference', 'currentWork', 'education', 'educationSupplement', 'educationTranscript', 'courses'];

function lomoProofVerified(key) {
  var proofs = state.employee && state.employee.proofs || {};
  var proof = proofs[key];
  if (!proof) return false;
  var status = String(proof.status || '').toLowerCase();
  return status === 'verified' || status.indexOf('подтверж') !== -1;
}

function lomoHasVerifiedIdentity() {
  return LOMO_IDENTITY_PROOFS.some(lomoProofVerified);
}

function lomoHasVerifiedExpEdu() {
  return LOMO_EXP_EDU_PROOFS.some(lomoProofVerified);
}

function lomoOwnVerificationLevel() {
  if (!state.emailVerified) return 0;
  if (!lomoHasVerifiedIdentity()) return 1;
  if (!lomoHasVerifiedExpEdu()) return 2;
  return 3;
}

/* Подсказка «что сделать для следующего уровня» — показывается в баннере
   прогресса собственного профиля. */
function lomoNextStepHint() {
  var hasAnyDoc = lomoHasVerifiedIdentity() || lomoHasVerifiedExpEdu();
  if (!state.emailVerified) {
    return hasAnyDoc
      ? 'Документ принят. Для получения уровня подтвердите электронную почту.'
      : 'Подтвердите электронную почту, чтобы получить LOMO 1.';
  }
  if (!lomoHasVerifiedIdentity()) {
    return lomoHasVerifiedExpEdu()
      ? 'Документ принят. Для повышения уровня подтвердите личность — загрузите паспорт'
      : 'Подтвердите личность — загрузите паспорт, чтобы получить LOMO 2.';
  }
  if (!lomoHasVerifiedExpEdu()) {
    return 'Загрузите документ об опыте работы или образовании, чтобы получить LOMO 3.';
  }
  return '';
}

function lomoBadgeProfileUrl() {
  return location.origin + '/p/' + encodeURIComponent(state.publicId || '') + '?src=badge';
}

function lomoBadgeDisplayUrl() {
  return location.host + '/p/' + (state.publicId || '') + '?src=badge';
}

function lomoBadgeSvgSnippet(level) {
  var url = lomoBadgeProfileUrl();
  return '<a href="' + url + '" target="_blank" rel="noopener">'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48" viewBox="0 0 200 48" role="img" aria-label="Верифицировано LOMO ' + level + '">'
    + '<rect width="200" height="48" rx="10" fill="#0f3f4a"/>'
    + '<circle cx="24" cy="24" r="12" fill="#2a7a8a"/>'
    + '<path d="M18 24l4 4 8-8" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<text x="44" y="21" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">LOMO</text>'
    + '<text x="44" y="37" font-family="Arial, sans-serif" font-size="11" fill="#9ee8e0">Верифицировано · LOMO ' + level + '</text>'
    + '</svg></a>';
}

function renderLomoBadgeSection() {
  var section = document.getElementById('epBadgeSection');
  var box = document.getElementById('epBadgeFormats');
  if (!section || !box) return;

  var level = lomoOwnVerificationLevel();
  if (!level || !state.publicId) {
    section.classList.add('hidden');
    return;
  }

  var p = state.employee || {};
  var displayUrl = lomoBadgeDisplayUrl();
  var resumeLine = '✓ Опыт подтверждён LOMO: ' + displayUrl;
  var signatureRole = (p.job_title || p.vacancies || '').trim();
  var signatureLines = [
    ((p.fullName || '').trim() || 'Имя Фамилия') + (signatureRole ? ' — ' + signatureRole : ''),
    '✓ Профиль верифицирован LOMO ' + level + ': ' + displayUrl,
  ];
  var svgSnippet = lomoBadgeSvgSnippet(level);

  box.innerHTML =
    '<div class="epBadgeFormat">' +
      '<div class="epBadgeFormatLabel">Для резюме / hh.ru</div>' +
      '<div class="epBadgePreview">' + escapeHtml(resumeLine) + '</div>' +
      '<button type="button" class="pillBtn soft" data-badge-copy="resume">Скопировать</button>' +
    '</div>' +
    '<div class="epBadgeFormat">' +
      '<div class="epBadgeFormatLabel">Подпись в почте</div>' +
      '<div class="epBadgePreview">' + escapeHtml(signatureLines[0]) + '<br>' + escapeHtml(signatureLines[1]) + '</div>' +
      '<button type="button" class="pillBtn soft" data-badge-copy="signature">Скопировать</button>' +
    '</div>' +
    '<div class="epBadgeFormat">' +
      '<div class="epBadgeFormatLabel">HTML-бейдж для сайта / портфолио</div>' +
      '<div class="epBadgePreview epBadgePreviewSvg">' + svgSnippet + '</div>' +
      '<button type="button" class="pillBtn soft" data-badge-copy="html">Скопировать код</button>' +
    '</div>';

  section.classList.remove('hidden');

  box.onclick = function (event) {
    var btn = event.target && event.target.closest ? event.target.closest('[data-badge-copy]') : null;
    if (!btn) return;
    var kind = btn.getAttribute('data-badge-copy');
    var text = kind === 'resume' ? resumeLine
      : kind === 'signature' ? signatureLines.join('\n')
      : svgSnippet;
    if (typeof copyToClipboard === 'function') copyToClipboard(text);
  };
}

/* «Подтвердить email» из собственного профиля (кандидат и работодатель):
   переиспользует экран ввода кода из регистрационного флоу. */
(function initVerifyEmailButtons() {
  function startVerify() {
    if (!state.email) {
      if (typeof showToast === 'function') showToast('Почта не указана', 'error');
      return;
    }
    if (typeof window.lomoStartEmailVerify === 'function') {
      window.lomoStartEmailVerify(state.email);
    }
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
    if (target.id === 'epVerifyEmailBtn' || target.id === 'rpVerifyEmailBtn') startVerify();
  });
})();
