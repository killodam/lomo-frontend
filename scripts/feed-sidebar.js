/* Desktop-only left column on the people feed: own-profile summary rendered
   from existing state/helpers (no duplicated logic). Hidden below 1024px by
   CSS; hidden entirely when logged out. */

var _fsConnectionsCount = null;

function fsInitial(name) {
  return String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
}

function fsProfileSource() {
  if (state.roleReg === 'EMPLOYER') {
    var emp = state.employer || {};
    return {
      name: emp.fullName || emp.company || 'Профиль',
      title: [emp.title, emp.company].filter(Boolean).join(' · '),
      avatar: emp.avatarDataUrl || '',
      isCandidate: false,
    };
  }
  var p = state.employee || {};
  return {
    name: p.fullName || 'Профиль',
    title: p.job_title || p.vacancies || '',
    avatar: p.avatarDataUrl || '',
    isCandidate: state.roleReg === 'EMPLOYEE',
  };
}

function renderFeedSidebar() {
  var aside = document.getElementById('feedSidebar');
  if (!aside) return;
  if (!state.userId || state.roleReg === 'ADMIN') { aside.classList.add('hidden'); return; }

  var src = fsProfileSource();
  var lomoLevel = src.isCandidate && typeof lomoOwnVerificationLevel === 'function' ? lomoOwnVerificationLevel() : 0;
  var percent = null;
  if (src.isCandidate && typeof computeProfileCompletenessFromState === 'function') {
    percent = computeProfileCompletenessFromState().percent;
  }

  var avatarHtml = src.avatar
    ? '<img class="fsAvatar" src="' + escHtml(src.avatar) + '" alt="">'
    : '<div class="fsAvatarFallback">' + escHtml(fsInitial(src.name)) + '</div>';

  var html =
    '<div class="fsHead">' +
      avatarHtml +
      '<div class="fsWho">' +
        '<div class="fsName">' + escHtml(src.name) + '</div>' +
        (src.title ? '<div class="fsTitle">' + escHtml(src.title) + '</div>' : '') +
      '</div>' +
    '</div>';

  if (src.isCandidate) {
    html += '<div class="fsLomoRow">' +
      (lomoLevel > 0
        ? '<span class="fsLomoBadge">✓ LOMO ' + lomoLevel + '</span>'
        : '<span class="fsLomoBadge none">LOMO 0 — не верифицирован</span>') +
    '</div>';
    if (percent !== null) {
      html += '<div class="fsProgress">' +
        '<div class="fsProgressTop"><span>Профиль заполнен</span><b>' + percent + '%</b></div>' +
        '<div class="fsProgressBar"><div class="fsProgressFill" style="width:' + percent + '%"></div></div>' +
      '</div>';
    }
  }

  html += '<div class="fsStats" id="fsStatsRow">' +
    '<span class="fsStatLabel">Коннекты</span>' +
    '<b id="fsConnectionsCount">' + (_fsConnectionsCount === null ? '—' : _fsConnectionsCount) + '</b>' +
  '</div>';

  html += '<button type="button" class="fsProfileBtn" id="fsProfileBtn">Мой профиль</button>';

  if (src.isCandidate) {
    html += '<button type="button" class="fsReferralLink" id="fsReferralBtn">' + (typeof lomoIcon === 'function' ? lomoIcon('users') + ' ' : '') + 'Пригласить коллегу</button>';
  }

  aside.innerHTML = html;
  aside.classList.remove('hidden');

  apiGetConnections().then(function (data) {
    var counts = (data && data.counts) || {};
    var accepted = typeof counts.accepted === 'number'
      ? counts.accepted
      : ((data && data.accepted) || []).length;
    _fsConnectionsCount = accepted;
    var el = document.getElementById('fsConnectionsCount');
    if (el) el.textContent = String(accepted);
  }).catch(function () {});
}

(function initFeedSidebar() {
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
    if (target.id === 'fsProfileBtn') {
      if (typeof goToMyProfile === 'function') goToMyProfile();
      return;
    }
    if (target.id === 'fsReferralBtn') {
      // Reuse the referral summary endpoint; copy the invite link directly.
      apiGetReferralSummary().then(function (summary) {
        var link = summary.link || (location.origin + '/r/' + (summary.code || ''));
        var done = function () { if (typeof showToast === 'function') showToast('Ссылка-приглашение скопирована ✓', 'success'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(done).catch(function () { window.prompt('Скопируйте ссылку:', link); });
        } else {
          window.prompt('Скопируйте ссылку:', link);
        }
      }).catch(function () {
        if (typeof showToast === 'function') showToast('Не удалось получить ссылку', 'error');
      });
    }
  });
})();
