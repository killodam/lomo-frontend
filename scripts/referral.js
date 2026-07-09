/* Referral program UI: capture /r/{code} at load, show the "invited by X"
   banner on registration, and render the "Пригласить коллегу" block in the
   candidate profile. Pure client wiring — all rules live on the backend. */

var REFERRAL_STORAGE_KEY = 'lomo_ref_code';

function getStoredReferralCode() {
  try { return sessionStorage.getItem(REFERRAL_STORAGE_KEY) || ''; } catch (e) { return ''; }
}

function clearStoredReferralCode() {
  try { sessionStorage.removeItem(REFERRAL_STORAGE_KEY); } catch (e) {}
}

function referralCodeFromLocation() {
  try {
    var pathMatch = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{4,16})\/?$/);
    if (pathMatch) return pathMatch[1].toUpperCase();
    var q = new URLSearchParams(window.location.search).get('ref');
    if (q && /^[A-Za-z0-9]{4,16}$/.test(q)) return q.toUpperCase();
  } catch (e) {}
  return '';
}

function renderReferralBanner() {
  var banner = document.getElementById('regReferralBanner');
  var code = getStoredReferralCode();
  if (!banner || !code) { if (banner) banner.classList.add('hidden'); return; }

  apiGetReferralInfo(code).then(function (info) {
    var name = (info && info.name) || 'Пользователь LOMO';
    banner.textContent = 'Вас пригласил(а) ' + name + '. Ваш первый документ проверят в приоритетном порядке — в течение 24 часов.';
    banner.classList.remove('hidden');
  }).catch(function () {
    // Unknown/expired code — drop it silently, no banner.
    clearStoredReferralCode();
    banner.classList.add('hidden');
  });
}

function initReferralCapture() {
  var code = referralCodeFromLocation();
  if (code) {
    try { sessionStorage.setItem(REFERRAL_STORAGE_KEY, code); } catch (e) {}
    // Clean the URL so a refresh doesn't re-trigger and the SPA routes normally.
    if (window.history && history.replaceState) {
      try { history.replaceState(history.state, document.title, location.origin + '/'); } catch (e) {}
    }
  }
  renderReferralBanner();
}

function referralShareText(link) {
  return 'Я подтверждаю свой опыт работы в LOMO — платформе, где работодатели видят только проверенных кандидатов. Регистрация по моей ссылке даёт приоритетную проверку документов: ' + link;
}

function renderReferralBlock() {
  var section = document.getElementById('epReferralSection');
  if (!section) return;
  if (state.roleReg !== 'EMPLOYEE' || !state.userId) { section.style.display = 'none'; return; }
  section.style.display = '';

  apiGetReferralSummary().then(function (summary) {
    var linkInput = document.getElementById('referralLinkInput');
    var progress = document.getElementById('referralProgress');
    var badge = document.getElementById('referralBadge');
    var link = summary.link || (location.origin + '/r/' + (summary.code || ''));
    if (linkInput) linkInput.value = link;
    if (progress) progress.textContent = 'Приглашено с загруженным документом: ' + (summary.creditedCount || 0) + ' из ' + (summary.target || 3);
    if (badge) badge.classList.toggle('hidden', !summary.badge);
    section._referralLink = link;
  }).catch(function () {
    section.style.display = 'none';
  });
}

(function initReferralUi() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReferralCapture);
  } else {
    initReferralCapture();
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;

    if (target.id === 'referralCopyBtn') {
      var input = document.getElementById('referralLinkInput');
      var link = input ? input.value : '';
      if (link && typeof copyToClipboard === 'function') copyToClipboard(link);
      return;
    }

    if (target.id === 'referralShareBtn') {
      var section = document.getElementById('epReferralSection');
      var shareLink = (section && section._referralLink) || (document.getElementById('referralLinkInput') || {}).value || '';
      var text = referralShareText(shareLink);
      if (navigator.share) {
        navigator.share({ text: text }).catch(function () {});
      } else if (typeof copyToClipboard === 'function') {
        copyToClipboard(text);
      }
      return;
    }
  });
})();
