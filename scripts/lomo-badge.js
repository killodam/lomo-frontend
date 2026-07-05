/* «Значок LOMO»: three copy-paste formats of the verified-profile badge,
   shown in the candidate's own profile once they have LOMO ≥ 1. */

var LOMO_BADGE_TIERS = {
  passport: 3, passportRegistration: 3, passportSelfie: 3,
  work: 2, workSfr: 2, workReference: 2, currentWork: 2,
  education: 1, educationSupplement: 1, educationTranscript: 1, courses: 1,
};

function lomoOwnVerificationLevel() {
  var proofs = state.employee && state.employee.proofs || {};
  var level = 0;
  Object.keys(proofs).forEach(function (key) {
    var proof = proofs[key];
    if (!proof || !LOMO_BADGE_TIERS[key]) return;
    var status = String(proof.status || '').toLowerCase();
    var verified = status === 'verified' || status.indexOf('подтверж') !== -1;
    if (verified && LOMO_BADGE_TIERS[key] > level) level = LOMO_BADGE_TIERS[key];
  });
  return level;
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
