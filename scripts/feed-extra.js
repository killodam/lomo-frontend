/* feed-extra.js — Feed tabs, vacancy cards, verification banners, landing animations */
/* ES5, no const/let/arrow functions */

/* ── Mock vacancy data ──────────────────────────────────────────── */
var MOCK_VACANCIES = [
  {
    id: 1, title: 'Frontend-разработчик', company: 'FinTech Almaty', city: 'Алматы',
    format: 'hybrid', grade: 'middle', salary: '400 000 – 600 000 ₸',
    desc: 'React/TypeScript, GraphQL, работа в продуктовой команде. Гибридный формат, офис в центре.'
  },
  {
    id: 2, title: 'Product Manager', company: 'LOMO', city: 'Астана',
    format: 'remote', grade: 'senior', salary: '800 000 – 1 200 000 ₸',
    desc: 'Ищем опытного PM для развития платформы верификации карьерных данных.'
  },
  {
    id: 3, title: 'Data Analyst', company: 'Kaspi Bank', city: 'Алматы',
    format: 'office', grade: 'junior', salary: '250 000 – 350 000 ₸',
    desc: 'SQL, Python, Power BI. Анализ транзакционных данных, построение дашбордов.'
  },
  {
    id: 4, title: 'Backend Developer (Go)', company: 'Kolesa Group', city: 'Алматы',
    format: 'hybrid', grade: 'senior', salary: '700 000 – 1 000 000 ₸',
    desc: 'Golang, PostgreSQL, Kafka. Развитие высоконагруженного сервиса объявлений.'
  },
  {
    id: 5, title: 'UX/UI Designer', company: 'Chocofamily', city: 'Алматы',
    format: 'remote', grade: 'middle', salary: '350 000 – 500 000 ₸',
    desc: 'Figma, пользовательские исследования, дизайн-система для e-commerce продуктов.'
  },
  {
    id: 6, title: 'DevOps Engineer', company: 'Jusan Bank', city: 'Астана',
    format: 'office', grade: 'lead', salary: '1 000 000 – 1 500 000 ₸',
    desc: 'Kubernetes, Terraform, CI/CD, построение облачной инфраструктуры с нуля.'
  }
];

var _vacancyFormatFilter = '';
var _vacancyGradeFilter = '';

/* ── Vacancy rendering ──────────────────────────────────────────── */
function renderVacancyCards() {
  var list = document.getElementById('vacancyFeedList');
  if (!list) return;
  var filtered = MOCK_VACANCIES.filter(function (v) {
    if (_vacancyFormatFilter && v.format !== _vacancyFormatFilter) return false;
    if (_vacancyGradeFilter && v.grade !== _vacancyGradeFilter) return false;
    return true;
  });
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:14px;">Вакансий не найдено</div>';
    return;
  }
  list.innerHTML = filtered.map(function (v) {
    var formatLabel = { remote: 'Удалённо', office: 'Офис', hybrid: 'Гибрид' }[v.format] || v.format;
    var gradeLabel = { junior: 'Junior', middle: 'Middle', senior: 'Senior', lead: 'Lead' }[v.grade] || v.grade;
    return '<div class="vacancyCard">' +
      '<div class="vacancyCardTitle">' + v.title + '</div>' +
      '<div class="vacancyCardCompany">' + v.company + '</div>' +
      '<div class="vacancyCardMeta">' +
        '<span class="vacancyCardTag format-' + v.format + '">' + formatLabel + '</span>' +
        '<span class="vacancyCardTag">' + gradeLabel + '</span>' +
      '</div>' +
      '<div class="vacancyCardSalary">' + v.salary + '</div>' +
      '<div class="vacancyCardDesc">' + v.desc + '</div>' +
      '<div class="vacancyCardFooter">' +
        '<span class="vacancyCardCity">📍 ' + v.city + '</span>' +
        '<button class="vacancyCardApply" type="button">Откликнуться</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

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
      renderVacancyCards();
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
      if (typeof loadFeedPage === 'function') loadFeedPage();
    }
  });
}

/* ── Vacancy format + grade filter chips ────────────────────────── */
function initVacancyFilterChips() {
  var formatBar = document.getElementById('vacFormatChips');
  var gradeBar = document.getElementById('vacGradeChips');

  if (formatBar) {
    formatBar.addEventListener('click', function (e) {
      var btn = e.target;
      if (!btn || !btn.hasAttribute('data-vac-format')) return;
      var chips = formatBar.querySelectorAll('.feedRoleChip');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
      btn.classList.add('active');
      _vacancyFormatFilter = btn.getAttribute('data-vac-format');
      renderVacancyCards();
    });
  }

  if (gradeBar) {
    gradeBar.addEventListener('click', function (e) {
      var btn = e.target;
      if (!btn || !btn.hasAttribute('data-vac-grade')) return;
      var chips = gradeBar.querySelectorAll('.feedRoleChip');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
      btn.classList.add('active');
      _vacancyGradeFilter = btn.getAttribute('data-vac-grade');
      renderVacancyCards();
    });
  }
}

/* ── Verification banners ───────────────────────────────────────── */
function initVerifBanner(bannerId, closeId, countFn) {
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
      if (targetScreen && typeof show === 'function') show(targetScreen === 'toEmployeeProfile' ? 'myEmployeeProfile' : 'myEmployerProfile');
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
  function trigger() {
    if (triggered) return;
    triggered = true;
    animateCounter(profilesEl, 47, 900);
    animateCounter(companiesEl, 3, 600);
  }

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        trigger();
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(profilesEl);
  } else {
    trigger();
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
  initVacancyFilterChips();
  initVerifBanner('epVerifBanner', 'epVerifBannerClose');
  initVerifBanner('rpVerifBanner', 'rpVerifBannerClose');
  initLandingCounter();
  initLandingStepObserver();
});
