/* Landing AI-match demo (4c). The dataset below is FULLY FICTIONAL and
   hardcoded here — the demo never touches the API or real candidates.
   Scoring runs through the real engine (window.lomoAI.match), so anonymous
   visitors see the true matching behaviour on fake data. */

var LD_DEMO_CANDIDATES = [
  { id: 'd1', full_name: 'Анна Ковалёва', job_title: 'Frontend-разработчик', grade: 'middle',
    skills: ['React', 'TypeScript', 'Redux', 'Jest'], vacancies: 'Frontend-разработчик',
    location: 'Москва', work_format: 'remote', edu_place: 'МИСиС',
    is_verified: true, looking_for_work: true, lomo_level: 2, _grad: 'linear-gradient(135deg,#1a5c68,#0e3a42)' },
  { id: 'd2', full_name: 'Дмитрий Соколов', job_title: 'Backend-разработчик', grade: 'senior',
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker'], vacancies: 'Backend-разработчик',
    location: 'Санкт-Петербург', work_format: 'hybrid', edu_place: 'ИТМО',
    is_verified: true, looking_for_work: true, lomo_level: 3, _grad: 'linear-gradient(135deg,#7c3aed,#4c1d95)' },
  { id: 'd3', full_name: 'Мария Ефимова', job_title: 'Финансовый аналитик', grade: 'middle',
    skills: ['МСФО', 'Excel', 'Power BI', 'DCF-модели'], vacancies: 'Финансовый аналитик',
    location: 'Москва', work_format: 'office', edu_place: 'ВШЭ',
    is_verified: true, looking_for_work: true, lomo_level: 2, _grad: 'linear-gradient(135deg,#0e7490,#155e75)' },
  { id: 'd4', full_name: 'Игорь Литвинов', job_title: 'Data-аналитик', grade: 'junior',
    skills: ['SQL', 'Python', 'Tableau'], vacancies: 'Аналитик данных',
    location: 'Казань', work_format: 'remote', edu_place: 'КФУ',
    is_verified: true, looking_for_work: true, lomo_level: 1, _grad: 'linear-gradient(135deg,#f59e0b,#92400e)' },
  { id: 'd5', full_name: 'Полина Черкасова', job_title: 'Аудитор', grade: 'senior',
    skills: ['МСФО', 'аудит', '1С', 'налоговый учёт'], vacancies: 'Аудитор, финансовый контролёр',
    location: 'Екатеринбург', work_format: 'office', edu_place: 'УрФУ',
    is_verified: true, looking_for_work: true, lomo_level: 3, _grad: 'linear-gradient(135deg,#be185d,#831843)' },
  { id: 'd6', full_name: 'Артём Гусев', job_title: 'DevOps-инженер', grade: 'middle',
    skills: ['Kubernetes', 'CI/CD', 'AWS', 'Terraform'], vacancies: 'DevOps-инженер',
    location: 'Новосибирск', work_format: 'remote', edu_place: 'НГУ',
    is_verified: true, looking_for_work: true, lomo_level: 2, _grad: 'linear-gradient(135deg,#15803d,#14532d)' },
];

function ldDemoInitials(name) {
  var parts = String(name || '').split(/\s+/);
  return ((parts[0] || '').charAt(0) + (parts[1] || '').charAt(0)).toUpperCase() || '•';
}

function ldDemoMeta(c) {
  var skills = (Array.isArray(c.skills) ? c.skills : String(c.skills || '').split(',')).slice(0, 2).map(function (x) { return String(x).trim(); });
  if (c.edu_place) skills.push(c.edu_place);
  return skills.join(' · ');
}

function ldDemoRenderRows(results) {
  return results.map(function (r) {
    var c = r.candidate;
    return '<div class="ldAiDemoResult">' +
      '<div class="ldAiDemoAv" style="background:' + c._grad + '">' + escHtml(ldDemoInitials(c.full_name)) + '</div>' +
      '<div class="ldAiDemoInfo">' +
        '<div class="ldAiDemoName">' + escHtml(c.full_name) + ' <span class="ldAiVerBadge">✓ LOMO ' + c.lomo_level + '</span></div>' +
        '<div class="ldAiDemoMeta">' + escHtml(ldDemoMeta(c)) + '</div>' +
      '</div>' +
      '<div class="ldAiDemoScore" style="--pct:' + r.score + '">' + r.score + '%</div>' +
    '</div>';
  }).join('');
}

function runLandingDemo() {
  var input = document.getElementById('ldDemoInput');
  var box = document.getElementById('ldDemoResults');
  if (!input || !box || !window.lomoAI) return;

  var query = String(input.value || '').trim();
  if (!query) { input.focus(); return; }

  // «React-разработчик» токенизируется одним токеном и не пересекается с
  // «react» — для демо разбиваем дефисные слова (C++/C#/.NET не содержат дефис).
  var normalized = query.replace(/-/g, ' ');
  var results = window.lomoAI.match(normalized, { verifiedOnly: false, maxResults: 3 }, LD_DEMO_CANDIDATES);
  // score нормализован относительно батча (топ всегда ~74-99), поэтому мусорные
  // запросы отсекаем по rawScore: без реального пересечения токенов он равен
  // одному лишь бонусу верификации (~4), осмысленный матч даёт 30+.
  var good = (results || []).filter(function (r) { return (r.rawScore || 0) >= 12 && r.score >= 30; }).slice(0, 3);

  if (!good.length) {
    box.innerHTML = '<div class="ldAiDemoEmpty">Опишите роль и навыки подробнее — например «ищем React-разработчика» или «нужен аудитор с МСФО».</div>';
    return;
  }
  box.innerHTML = ldDemoRenderRows(good);
}

(function initLandingDemo() {
  document.addEventListener('click', function (event) {
    var t = event.target;
    if (!t) return;
    if (t.id === 'ldDemoRun') { runLandingDemo(); return; }
    if (t.id === 'ldDemoCta') { if (typeof show === 'function') show('roleReg'); return; }
  });
  document.addEventListener('keydown', function (event) {
    if (event.target && event.target.id === 'ldDemoInput' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      runLandingDemo();
    }
  });
})();
