/* feed-extra.js — Feed tabs, verification banners, landing animations */
/* ES5, no const/let/arrow functions */

/* ── Feed main tabs (People / Vacancies) ────────────────────────── */
function initFeedMainTabs() {
  var tabsBar = document.getElementById('feedMainTabs');
  if (!tabsBar) return;
  var peoplePane = document.getElementById('feedTabPeople');
  var vacPane = document.getElementById('feedTabVacancies');

  tabsBar.addEventListener('click', function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute('data-main-tab')) return;
    var tab = btn.getAttribute('data-main-tab');
    var btns = tabsBar.querySelectorAll('.feedMainTab');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');
    if (tab === 'people') {
      if (peoplePane) peoplePane.classList.remove('hidden');
      if (vacPane) vacPane.classList.add('hidden');
    } else {
      if (peoplePane) peoplePane.classList.add('hidden');
      if (vacPane) vacPane.classList.remove('hidden');
    }
  });
}

/* ── Role filter chips ──────────────────────────────────────────── */
function initRoleFilterChips() {
  var container = document.getElementById('feedRoleChips');
  if (!container) return;
  container.addEventListener('click', function (e) {
    var btn = e.target;
    if (!btn || !btn.hasAttribute('data-role-filter')) return;
    var chips = container.querySelectorAll('.feedRoleChip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
    btn.classList.add('active');
    var val = btn.getAttribute('data-role-filter');
    if (typeof feedState !== 'undefined') {
      feedState.roleFilter = val;
      feedState.page = 1;
      if (typeof loadCandidateFeed === 'function') loadCandidateFeed(1);
    }
  });
}

/* ── Verification banners ───────────────────────────────────────── */
function initVerifBanner(bannerId, closeId) {
  var banner = document.getElementById(bannerId);
  var closeBtn = document.getElementById(closeId);
  if (!banner || !closeBtn) return;

  closeBtn.addEventListener('click', function () {
    banner.classList.add('hidden');
    try { sessionStorage.setItem('lomo_verif_banner_closed_' + bannerId, '1'); } catch (e) {}
  });

  var deepLink = banner.querySelector('[data-goto-tab]');
  if (deepLink) {
    deepLink.addEventListener('click', function () {
      var targetScreen = deepLink.getAttribute('data-next');
      var tab = deepLink.getAttribute('data-goto-tab');
      if (targetScreen && typeof show === 'function') {
        show(targetScreen === 'toEmployeeProfile' ? 'myEmployeeProfile' : 'myEmployerProfile');
      }
      if (tab) {
        var tabEl = document.getElementById(tab);
        if (tabEl) tabEl.click();
      }
    });
  }
}

function showVerifBannerIfNeeded(bannerId, hasVerification) {
  var banner = document.getElementById(bannerId);
  if (!banner) return;
  try {
    if (sessionStorage.getItem('lomo_verif_banner_closed_' + bannerId) === '1') return;
  } catch (e) {}
  if (!hasVerification) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ── Landing: animated counter ──────────────────────────────────── */
function animateCounter(el, target, duration) {
  var start = 0;
  if (target === 0) { el.textContent = '0'; return; }
  var step = Math.ceil(target / (duration / 16));
  var timer = setInterval(function () {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    el.textContent = start;
  }, 16);
}

function initLandingCounter() {
  var profilesEl = document.getElementById('ldCountProfiles');
  var companiesEl = document.getElementById('ldCountCompanies');
  if (!profilesEl || !companiesEl) return;

  var triggered = false;
  function runCounters(profiles, companies) {
    if (triggered) return;
    triggered = true;
    animateCounter(profilesEl, profiles, 900);
    animateCounter(companiesEl, companies, 600);
  }

  function fetchAndRun() {
    var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
    fetch(base + '/public/stats')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        runCounters(data.verifiedProfiles || 0, data.companies || 0);
      })
      .catch(function () {
        runCounters(0, 0);
      });
  }

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        fetchAndRun();
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(profilesEl);
  } else {
    fetchAndRun();
  }
}

/* ── Landing: scroll-triggered step animation ───────────────────── */
function initLandingStepObserver() {
  var steps = document.querySelectorAll('.ldStepAnim');
  if (!steps.length) return;
  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < steps.length; i++) steps[i].classList.add('visible');
    return;
  }
  var obs = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        entries[i].target.classList.add('visible');
        obs.unobserve(entries[i].target);
      }
    }
  }, { threshold: 0.2 });
  for (var j = 0; j < steps.length; j++) obs.observe(steps[j]);
}

/* ── Init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  initFeedMainTabs();
  initRoleFilterChips();
  initVerifBanner('epVerifBanner', 'epVerifBannerClose');
  initVerifBanner('rpVerifBanner', 'rpVerifBannerClose');
  initLandingCounter();
  initLandingStepObserver();
});
