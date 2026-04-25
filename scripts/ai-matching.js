/* ai-matching.js — LOMO AI Matching Engine v3
   Standalone. No external API calls. Exports window.lomoAI.

   v3 improvements:
   - Skill-weighted TF (tech terms 2.5× generic words)
   - Fixed scoring: cosine×grade → 0-100 base, bonuses capped at 25 pts
   - Score normalization (top result = 90-99, rest relative)
   - Grade auto-detection from job description text
   - Salary budget extraction + over-budget penalty
   - looking_for_work filter
   - 5-minute candidate cache TTL
   - Extended synonym table (C++, .NET, QA, remote, etc.)
   - Readable overlap labels (stems → display names)
*/
(function () {
  'use strict';

  var CACHE_TTL_MS = 5 * 60 * 1000;

  // ── SYNONYMS ────────────────────────────────────────────────────────────
  var SYNONYMS = {
    // language aliases
    'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'rb': 'ruby',
    'c++': 'cpp', 'c#': 'csharp', '.net': 'dotnet', 'net': 'dotnet',
    'golang': 'go', 'rs': 'rust',
    // Russian tech transliterations
    'реакт': 'react', 'ангуляр': 'angular', 'вью': 'vue', 'вуе': 'vue',
    'питон': 'python', 'джаваскрипт': 'javascript', 'тайпскрипт': 'typescript',
    'свифт': 'swift', 'котлин': 'kotlin', 'флаттер': 'flutter',
    'гит': 'git', 'гитхаб': 'github', 'гитлаб': 'gitlab',
    'линукс': 'linux', 'убунту': 'linux',
    'докер': 'docker', 'постгрес': 'postgresql', 'postgres': 'postgresql',
    'монга': 'mongodb', 'mongo': 'mongodb',
    'нода': 'nodejs', 'node.js': 'nodejs', 'next.js': 'nextjs',
    'к8с': 'kubernetes', 'k8s': 'kubernetes',
    // grades
    'джун': 'junior', 'джуниор': 'junior', 'мидл': 'middle',
    'синьор': 'senior', 'сеньор': 'senior', 'сениор': 'senior',
    'тимлид': 'lead', 'стажер': 'intern', 'стажёр': 'intern',
    // stack aliases
    'бэкенд': 'backend', 'фронтенд': 'frontend', 'фулл': 'fullstack',
    'фуллстек': 'fullstack', 'фулл-стек': 'fullstack', 'full-stack': 'fullstack',
    // domains
    'ml': 'machine_learning', 'аи': 'ai', 'нейросет': 'ai',
    'дизайнер': 'designer', 'верстка': 'html', 'верстальщик': 'html',
    'qa': 'testing', 'тестировщик': 'testing', 'тестирование': 'testing',
    'qe': 'testing', 'sdet': 'testing',
    'продакт': 'product', 'продукт': 'product',
    'аналитик': 'analyst', 'менеджер': 'manager',
    // formats
    'удаленно': 'remote', 'удалённо': 'remote', 'удаленка': 'remote',
    'офис': 'office', 'гибрид': 'hybrid',
    // misc
    'апи': 'api', 'скрам': 'scrum', 'канбан': 'kanban',
    'агайл': 'agile', 'ci': 'cicd', 'cd': 'cicd', 'ci/cd': 'cicd',
    // ── Finance & Economics ──
    '1с': '1c', 'мсфо': 'ifrs', 'рсбу': 'gaap', 'ifrs': 'ifrs',
    'финансист': 'финансы', 'финансовый': 'финансы', 'финансовая': 'финансы',
    'бухгалтер': 'бухгалтерия', 'бухгалтерский': 'бухгалтерия', 'бухучет': 'бухгалтерия',
    'налоговый': 'налоги', 'налогообложение': 'налоги', 'ндс': 'налоги', 'ндфл': 'налоги',
    'экономист': 'экономика', 'экономический': 'экономика',
    'казначей': 'казначейство', 'pl': 'p&l', 'ebitda': 'ebitda', 'dcf': 'dcf',
    'бюджетирование': 'бюджет', 'бюджетный': 'бюджет',
    'аудитор': 'аудит', 'аудиторский': 'аудит',
    'отчетность': 'отчётность', 'отчёт': 'отчётность',
    'себестоимост': 'себестоимость', 'ценообразование': 'ценообразование',
    'дебиторка': 'дебиторская', 'кредиторка': 'кредиторская',
    // ── HR ──
    'рекрутер': 'рекрутинг', 'рекрутмент': 'рекрутинг', 'подбор': 'рекрутинг',
    'кадровик': 'кадры', 'кадровый': 'кадры', 'кадровое': 'кадры',
    'онбординг': 'адаптация', 'hrbp': 'hr', 'hrd': 'hr',
    // ── Marketing ──
    'маркетолог': 'маркетинг', 'маркетинговый': 'маркетинг',
    'таргетолог': 'таргет', 'таргетированный': 'таргет',
    'контентщик': 'контент', 'копирайтер': 'контент',
    'smm-менеджер': 'smm', 'seo-специалист': 'seo',
    // ── Legal ──
    'юрист': 'право', 'юридический': 'право', 'правовой': 'право',
    'договорной': 'договор', 'договорная': 'договор',
  };

  // ── IMPLIED SKILLS ──────────────────────────────────────────────────────
  var IMPLIED = {
    'react':      ['javascript', 'html', 'css'],
    'vue':        ['javascript', 'html', 'css'],
    'angular':    ['javascript', 'typescript', 'html', 'css'],
    'nextjs':     ['react', 'javascript', 'nodejs'],
    'nuxtjs':     ['vue', 'javascript', 'nodejs'],
    'django':     ['python'],    'flask':  ['python'],
    'fastapi':    ['python'],   'spring': ['java'],
    'rails':      ['ruby'],     'laravel':['php'],
    'nestjs':     ['nodejs', 'typescript'],
    'express':    ['nodejs', 'javascript'],
    'kubernetes': ['docker'],   'terraform': ['devops'],
    'ansible':    ['devops'],
    'reactnative':['javascript', 'react', 'mobile'],
    'flutter':    ['mobile'],
  };

  // ── DOMAIN CLUSTERS ─────────────────────────────────────────────────────
  var CLUSTERS = {
    frontend:   ['react','vue','angular','javascript','typescript','html','css',
                 'nextjs','nuxtjs','webpack','vite','sass','tailwind','svelte'],
    backend:    ['nodejs','python','java','go','ruby','php','rust','csharp','dotnet',
                 'django','flask','fastapi','spring','rails','laravel','nestjs',
                 'express','graphql','rest','grpc'],
    data:       ['python','sql','machine_learning','tensorflow','pytorch','pandas',
                 'numpy','spark','airflow','tableau','powerbi','sklearn','jupyter',
                 'hadoop','databricks','dbt','ai'],
    devops:     ['docker','kubernetes','terraform','ansible','aws','gcp','azure',
                 'cicd','jenkins','linux','bash','nginx','helm','monitoring'],
    mobile:     ['swift','kotlin','flutter','reactnative','android','ios','xcode'],
    database:   ['postgresql','mysql','mongodb','redis','elasticsearch',
                 'cassandra','sqlite','oracle','clickhouse'],
    design:     ['figma','sketch','photoshop','illustrator','ux','ui',
                 'wireframe','prototype','designer'],
    management: ['agile','scrum','kanban','jira','confluence','roadmap',
                 'okr','product','analyst','management'],
    testing:    ['testing','selenium','cypress','jest','pytest','playwright',
                 'postman','qa'],
    // ── Non-IT clusters ──────────────────────────────────────────────────
    finance:    ['финансы','бухгалтерия','налоги','аудит','ifrs','gaap','1c',
                 'бюджет','казначейство','p&l','ebitda','dcf','отчётность',
                 'excel','powerpoint','управленческий','себестоимость','capex','opex'],
    economics:  ['экономика','статистика','эконометрика','планирование','прогнозирование',
                 'ценообразование','kpi','моделирование','анализ','показатель'],
    hr:         ['hr','рекрутинг','кадры','адаптация','обучение','мотивация',
                 'оценка','персонал','трудовой','кадровое'],
    marketing:  ['маркетинг','реклама','seo','smm','контент','бренд','digital',
                 'таргет','контекст','cpa','ctr','roi','crm','email'],
    legal:      ['право','договор','суд','арбитраж','корпоративный','претензия',
                 'гражданский','трудовой','юридический','нормативный'],
  };

  // Build flat set of all known skills once
  var ALL_SKILLS = (function () {
    var s = new Set();
    Object.values(CLUSTERS).forEach(function (arr) { arr.forEach(function (t) { s.add(t); }); });
    return s;
  })();

  // ── STOP WORDS ──────────────────────────────────────────────────────────
  var STOP = new Set([
    'и','в','на','с','по','к','для','от','что','как','при','это','также',
    'будет','ищем','опыт','работы','лет','знание','умение','команде','плюсом',
    'задачи','требования','обязанности','требуется','ожидаем','хотим',
    'мы','вы','вас','нас','они','он','она','или','но','а','то','за','из',
    'об','со','под','над','без','через','между','перед','после','во','до',
    'год','года','желательно','приветствуется','готовность','наш','наши',
    'будете','будем','должен','должна','нужно','нужен','работать','компании',
    'компания','проект','проекты','разработки','разработка','разработчик',
  ]);

  var GRADES = ['intern', 'junior', 'middle', 'senior', 'lead'];

  // Friendly display name for a token
  var DISPLAY_NAMES = {
    'javascript': 'JavaScript', 'typescript': 'TypeScript', 'python': 'Python',
    'java': 'Java', 'go': 'Go', 'ruby': 'Ruby', 'php': 'PHP', 'rust': 'Rust',
    'cpp': 'C++', 'csharp': 'C#', 'dotnet': '.NET',
    'nodejs': 'Node.js', 'react': 'React', 'vue': 'Vue', 'angular': 'Angular',
    'nextjs': 'Next.js', 'nuxtjs': 'Nuxt.js', 'svelte': 'Svelte',
    'html': 'HTML', 'css': 'CSS', 'sass': 'Sass', 'tailwind': 'Tailwind',
    'postgresql': 'PostgreSQL', 'mysql': 'MySQL', 'mongodb': 'MongoDB',
    'redis': 'Redis', 'elasticsearch': 'Elasticsearch',
    'docker': 'Docker', 'kubernetes': 'Kubernetes', 'terraform': 'Terraform',
    'aws': 'AWS', 'gcp': 'GCP', 'azure': 'Azure', 'linux': 'Linux',
    'git': 'Git', 'graphql': 'GraphQL', 'rest': 'REST',
    'machine_learning': 'ML', 'ai': 'AI', 'tensorflow': 'TensorFlow',
    'pytorch': 'PyTorch', 'pandas': 'Pandas', 'spark': 'Spark',
    'figma': 'Figma', 'ux': 'UX', 'ui': 'UI',
    'agile': 'Agile', 'scrum': 'Scrum', 'kanban': 'Kanban', 'jira': 'Jira',
    'testing': 'QA/Testing', 'cicd': 'CI/CD', 'devops': 'DevOps',
    'swift': 'Swift', 'kotlin': 'Kotlin', 'flutter': 'Flutter',
    'reactnative': 'React Native', 'product': 'Product', 'analyst': 'Аналитика',
    // Finance & Economics
    'финансы': 'Финансы', 'бухгалтерия': 'Бухгалтерия', 'налоги': 'Налоги',
    'аудит': 'Аудит', 'ifrs': 'МСФО', 'gaap': 'РСБУ', '1c': '1С',
    'бюджет': 'Бюджетирование', 'казначейство': 'Казначейство',
    'отчётность': 'Отчётность', 'экономика': 'Экономика',
    'себестоимость': 'Себестоимость', 'ebitda': 'EBITDA', 'p&l': 'P&L',
    // HR
    'hr': 'HR', 'рекрутинг': 'Рекрутинг', 'кадры': 'Кадры', 'адаптация': 'Адаптация',
    // Marketing
    'маркетинг': 'Маркетинг', 'seo': 'SEO', 'smm': 'SMM', 'таргет': 'Таргет',
    'контент': 'Контент', 'реклама': 'Реклама',
    // Legal
    'право': 'Право', 'договор': 'Договорная работа',
  };

  function displayToken(t) {
    return DISPLAY_NAMES[t] || (t.charAt(0).toUpperCase() + t.slice(1));
  }

  // ── TOKENISER ───────────────────────────────────────────────────────────

  function stemRu(word) {
    var sfx = [
      'ирование','ирования','ировании','ирователь',
      'ность','ности','ющий','ющего','ющему','ющих',
      'ный','ного','ному','ных','ный','ной',
      'ений','ения','ение','ении',
      'ать','ять','ить','еть','уть',
      'ами','ему','его','ого','ией',
      'ые','ый','ая','ое','ую','ей','их','ых',
      'ам','ом','ем','им','ах','ях',
      'ию','ия','ие','ий','ью','ья','ье','ьи',
      'ю','я','е','и','у','а',
    ];
    var w = word.toLowerCase();
    if (w.length < 5) return w;
    for (var i = 0; i < sfx.length; i++) {
      var s = sfx[i];
      if (w.length > s.length + 3 && w.endsWith(s)) return w.slice(0, w.length - s.length);
    }
    return w;
  }

  function normalizeToken(raw) {
    // Keep C++, C#, .NET whole before lowercasing
    var w = raw.toLowerCase()
      .replace(/c\+\+/g, 'cpp')
      .replace(/c#/g, 'csharp')
      .replace(/\.net\b/g, 'dotnet')
      .replace(/[^a-zа-яёa-z0-9#.+_]/g, '');
    return SYNONYMS[w] || w;
  }

  function tokenize(text) {
    if (!text) return [];
    var tokens = [];
    // Split on whitespace + common punctuation, but keep C++, C#, .NET
    text.replace(/[.,\/#!$%^&*;:{}=`~()\n\r]/g, ' ')
      .replace(/\s+/g, ' ').trim().split(' ')
      .forEach(function (w) {
        if (!w || w.length < 2) return;
        var norm = normalizeToken(w);
        if (!norm || norm.length < 2 || STOP.has(norm)) return;
        var stem = /[а-яё]/.test(norm) ? stemRu(norm) : norm;
        if (stem.length >= 2) tokens.push(stem);
      });
    return tokens;
  }

  function expandImplied(tokens) {
    var set = {};
    tokens.forEach(function (t) { set[t] = 1.0; });
    tokens.forEach(function (t) {
      var imp = IMPLIED[t];
      if (imp) imp.forEach(function (x) {
        var s = tokenize(x)[0];
        if (s && !set[s]) set[s] = 0.6; // implied = 60% weight
      });
    });
    return set; // returns {token: weight} map
  }

  // ── WEIGHTED TF ─────────────────────────────────────────────────────────
  // Tech skills from CLUSTERS get 2.5× weight over generic words

  function buildWeightedTF(tokens) {
    var tf = {}, total = 0;
    tokens.forEach(function (t) {
      var w = ALL_SKILLS.has(t) ? 2.5 : 1.0;
      tf[t] = (tf[t] || 0) + w;
      total += w;
    });
    if (total > 0) Object.keys(tf).forEach(function (t) { tf[t] /= total; });
    return tf;
  }

  // Weighted TF for candidate: respect implied weights
  function buildWeightedTFFromMap(weightMap) {
    var tf = {}, total = 0;
    Object.keys(weightMap).forEach(function (t) {
      var iw = weightMap[t];          // 1.0 direct, 0.6 implied
      var sw = ALL_SKILLS.has(t) ? 2.5 : 1.0; // skill boost
      var w = iw * sw;
      tf[t] = (tf[t] || 0) + w;
      total += w;
    });
    if (total > 0) Object.keys(tf).forEach(function (t) { tf[t] /= total; });
    return tf;
  }

  function cosineSim(a, b) {
    var dot = 0, na = 0, nb = 0;
    var all = {};
    Object.keys(a).forEach(function (k) { all[k] = true; });
    Object.keys(b).forEach(function (k) { all[k] = true; });
    Object.keys(all).forEach(function (k) {
      var av = a[k] || 0, bv = b[k] || 0;
      dot += av * bv; na += av * av; nb += bv * bv;
    });
    return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }

  // ── GRADE ────────────────────────────────────────────────────────────────

  function detectGradeFromText(text) {
    var lc = text.toLowerCase();
    // Note: \b doesn't work with Cyrillic in JS — use plain contains checks
    if (/тимлид|team[\s-]?lead|tech[\s-]?lead|lead\b/.test(lc)) return 'lead';
    if (/senior|сеньор|сениор|синьор/.test(lc)) return 'senior';
    if (/middle|мидл/.test(lc)) return 'middle';
    if (/junior|джуниор|джун/.test(lc)) return 'junior';
    if (/\bintern\b|стажер|стажёр|практикант/.test(lc)) return 'intern';
    return '';
  }

  function gradeBoost(jobGrade, candGrade) {
    if (!jobGrade || !candGrade) return 1.0;
    var ji = GRADES.indexOf(jobGrade.toLowerCase());
    var ci = GRADES.indexOf(candGrade.toLowerCase());
    if (ji < 0 || ci < 0) return 1.0;
    var d = Math.abs(ji - ci);
    return d === 0 ? 1.25 : d === 1 ? 1.05 : d === 2 ? 0.85 : 0.65;
  }

  // ── SALARY ───────────────────────────────────────────────────────────────

  function extractMaxSalary(text) {
    if (!text) return 0;
    var lc = text.toLowerCase().replace(/[\s,]/g, '');
    var patterns = [
      /до(\d{2,3})[кk]/,         // до 150к
      /до(\d{4,7})/,              // до 150000
      /бюджет(\d{2,3})[кk]/,
      /бюджет(\d{4,7})/,
      /зп[^\d]*до[^\d]*(\d{2,3})[кk]/,
      /зарплат[^\d]*(\d{4,7})/,
      /salary[^\d]*(\d{4,7})/,
      /(\d{2,3})[кk](?:руб|₽|$|\s)/,
      /₽(\d{4,7})/,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = lc.match(patterns[i]);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > 0 && n < 2000) n *= 1000;
        if (n >= 10000 && n <= 10000000) return n;
      }
    }
    return 0;
  }

  // ── DOMAIN ───────────────────────────────────────────────────────────────

  function detectDomains(tokens) {
    var scores = {};
    Object.keys(CLUSTERS).forEach(function (d) {
      var n = 0;
      tokens.forEach(function (t) { if (CLUSTERS[d].indexOf(t) >= 0) n++; });
      if (n > 0) scores[d] = n;
    });
    return scores; // returns {domain: hitCount}
  }

  // ── CANDIDATE NORMALISATION ──────────────────────────────────────────────
  // Maps API field names to what the engine expects, computes is_verified.

  function parseSkillsField(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string' && raw) {
      if (raw.charAt(0) === '{') {
        return raw.slice(1, -1).split(',').map(function(s){ return s.trim().replace(/^"|"$/g,''); }).filter(Boolean);
      }
      return raw.split(/[,;]+/).map(function(s){ return s.trim(); }).filter(Boolean);
    }
    return [];
  }

  function normalizeCandidate(c) {
    var statuses = [c.edu_status, c.work_status, c.course_status, c.pass_status, c.cv_status];
    var verCount = statuses.filter(function(s){ return s === 'verified'; }).length;
    var workExpText = '';
    if (Array.isArray(c.work_exp)) {
      workExpText = c.work_exp.map(function(e){
        return [e.role, e.company, e.desc].filter(Boolean).join(' ');
      }).join(' ');
    }
    return Object.assign({}, c, {
      skills:             parseSkillsField(c.skills),
      is_verified:        verCount > 0,
      verification_level: verCount,
      user_id:            c.id,
      // field name aliases for buildCandidateText
      _work_exp_text:     workExpText,
    });
  }

  // ── SCORING ──────────────────────────────────────────────────────────────

  function buildCandidateText(c) {
    var skills = Array.isArray(c.skills) ? c.skills.join(' ') : '';
    return [
      c.full_name,
      c.job_title, c.current_job,       // API field names (profile.js)
      c.title,                           // fallback legacy
      skills,
      c.about, c.bio,                    // bio = legacy fallback
      c.vacancies,                       // what the candidate is looking for
      c.location, c.city,
      c.grade, c.work_format,
      c.edu_place,
      c._work_exp_text,
    ].filter(Boolean).join(' ');
  }

  function scoreOne(jobTok, jobTF, jobGrade, jobFormat, jobDomains, salaryBudget, opts, c) {
    // Hard filters
    if (opts.verifiedOnly && !c.is_verified) return null;
    if (opts.activeOnly && !c.looking_for_work) return null;
    if (jobFormat && c.work_format && c.work_format.toLowerCase() !== jobFormat) return null;

    // Salary hard-filter: candidate wants ≥20% more than budget
    if (salaryBudget > 0 && c.salary_expectations > 0) {
      if (c.salary_expectations > salaryBudget * 1.2) return null;
    }

    var candWeightMap = expandImplied(tokenize(buildCandidateText(c)));
    var candTF = buildWeightedTFFromMap(candWeightMap);
    var candTok = Object.keys(candWeightMap);

    // Base score: cosine × grade multiplier → 0–100
    var sim = cosineSim(jobTF, candTF);
    var baseScore = sim * gradeBoost(jobGrade, c.grade) * 100;

    // Salary soft penalty (5–15 pts if over budget)
    if (salaryBudget > 0 && c.salary_expectations > 0 && c.salary_expectations > salaryBudget) {
      var overPct = (c.salary_expectations - salaryBudget) / salaryBudget;
      baseScore -= Math.min(overPct * 20, 15);
    }

    // Domain bonus: reward deep domain overlap (max 12 pts)
    var domBonus = 0;
    Object.keys(jobDomains).forEach(function (d) {
      var clusterArr = CLUSTERS[d];
      var hits = 0;
      candTok.forEach(function (t) { if (clusterArr.indexOf(t) >= 0) hits++; });
      var domScore = (hits / Math.max(clusterArr.length * 0.25, 3)) * 8;
      domBonus = Math.max(domBonus, Math.min(domScore, 12));
    });

    // Flat bonuses, capped at 25 total
    var verPts = c.is_verified
      ? (c.verification_level >= 3 ? 12 : c.verification_level === 2 ? 8 : 4) : 0;
    var uniPts = c.university ? 4 : 0;
    var flatBonus = Math.min(verPts + uniPts + domBonus, 25);

    var rawScore = Math.max(0, baseScore + flatBonus);

    // Overlap: tokens in BOTH job and candidate (direct only, not implied)
    var directJobTok = tokenize(/* re-tokenize job without expansion */ buildCandidateText({ skills: '' }));
    var overlap = [];
    jobTok.forEach(function (t) {
      if (candWeightMap[t] && candWeightMap[t] >= 1.0 && ALL_SKILLS.has(t)) overlap.push(t);
    });

    return { candidate: c, rawScore: rawScore, score: 0, overlap: overlap.slice(0, 6) };
  }

  function normalizeScores(results) {
    if (!results.length) return results;
    var maxRaw = results[0].rawScore;
    var minRaw = results[results.length - 1].rawScore;
    if (maxRaw <= 0) { results.forEach(function (r) { r.score = 0; }); return results; }

    // Top result always gets 90-99 depending on how good the raw match is
    var topTarget = maxRaw >= 60 ? 99 : maxRaw >= 40 ? 92 : maxRaw >= 20 ? 84 : 74;
    var scale = topTarget / maxRaw;

    results.forEach(function (r) {
      r.score = Math.max(1, Math.min(99, Math.round(r.rawScore * scale)));
    });
    return results;
  }

  function match(jobText, opts, candidates) {
    opts = opts || {};
    var grade = opts.grade || detectGradeFromText(jobText);
    var format = opts.format || '';
    var verifiedOnly = opts.verifiedOnly !== false;
    var activeOnly = !!opts.activeOnly;
    var max = opts.maxResults || 20;
    var salaryBudget = extractMaxSalary(jobText);

    var jobTokens = tokenize(jobText);
    var jobTF = buildWeightedTF(jobTokens);
    var jobDomains = detectDomains(jobTokens);

    var results = [];
    (candidates || []).forEach(function (c) {
      var r = scoreOne(jobTokens, jobTF, grade, format, jobDomains, salaryBudget, {
        verifiedOnly: verifiedOnly, activeOnly: activeOnly,
      }, c);
      if (r) results.push(r);
    });

    results.sort(function (a, b) { return b.rawScore - a.rawScore; });
    results = results.slice(0, max);
    normalizeScores(results);

    // Remove zero-score results only if we have better ones
    var nonZero = results.filter(function (r) { return r.score > 5; });
    return nonZero.length ? nonZero : results;
  }

  // ── RENDER ───────────────────────────────────────────────────────────────

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderCard(r) {
    var c = r.candidate;
    var scoreClass = r.score >= 75 ? 'aiScore--high' : r.score >= 45 ? 'aiScore--mid' : 'aiScore--low';
    var skills = Array.isArray(c.skills) ? c.skills
      : (typeof c.skills === 'string' ? c.skills.split(/[,;]+/).map(function (s) { return s.trim(); }) : []);
    var uid = esc(c.user_id || c.id || '');
    var avatar = c.avatar_url
      ? '<img class="aiResultAvatar" src="' + esc(c.avatar_url) + '" alt="" loading="lazy">'
      : '<div class="aiResultAvatarFallback">' + esc((c.full_name || 'U').charAt(0).toUpperCase()) + '</div>';
    var verified = c.is_verified ? '<span class="aiResultVerifiedBadge">✓</span>' : '';
    var tags = [
      c.grade ? '<span class="aiResultTag">' + esc(c.grade) + '</span>' : '',
      c.work_format ? '<span class="aiResultTag">' + esc(c.work_format) + '</span>' : '',
      c.looking_for_work ? '<span class="aiResultTagActive">В поиске</span>' : '',
    ].filter(Boolean).join('');
    var skillTags = skills.slice(0, 5).map(function (s) {
      return '<span class="aiResultSkillTag">' + esc(s) + '</span>';
    }).join('');
    var overlapHtml = r.overlap.length
      ? '<div class="aiResultOverlap">' + r.overlap.map(function (t) {
          return '<span class="aiResultOverlapTag">' + esc(displayToken(t)) + '</span>';
        }).join('') + '</div>'
      : '';
    var salaryHtml = c.salary_expectations
      ? '<div class="aiResultSalary">от ' + Number(c.salary_expectations).toLocaleString('ru-RU') + ' ₽</div>'
      : '';

    return '<div class="aiResultCard" data-user-id="' + uid + '">' +
      '<div class="aiResultScore ' + scoreClass + '">' + r.score + '</div>' +
      '<div class="aiResultAvatarWrap">' + avatar + verified + '</div>' +
      '<div class="aiResultInfo">' +
        '<div class="aiResultName">' + esc(c.full_name || 'Кандидат') + '</div>' +
        '<div class="aiResultMeta">' + esc(c.title || '') + salaryHtml + '</div>' +
        (tags ? '<div class="aiResultTags">' + tags + '</div>' : '') +
        (skillTags ? '<div class="aiResultSkills">' + skillTags + '</div>' : '') +
        overlapHtml +
      '</div>' +
    '</div>';
  }

  // ── LOADING ANIMATION ────────────────────────────────────────────────────

  function setStep(n, msg) {
    ['aiStep1', 'aiStep2', 'aiStep3'].forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('active', i === n - 1);
      el.classList.toggle('done', i < n - 1);
    });
    var s = document.getElementById('aiMatchStatusText');
    if (s) s.textContent = msg;
  }

  // ── FETCH CANDIDATES ─────────────────────────────────────────────────────

  function fetchCandidates() {
    var now = Date.now();
    var entry = window.__lomoCache && window.__lomoCache.candidatesEntry;
    if (entry && (now - entry.ts) < CACHE_TTL_MS) return Promise.resolve(entry.data);

    return fetch('/api/profile/candidates?pageSize=150', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : (data.candidates || data.data || data.items || []);
        var normalized = list.map(normalizeCandidate);
        window.__lomoCache = window.__lomoCache || {};
        window.__lomoCache.candidatesEntry = { data: normalized, ts: Date.now() };
        return normalized;
      });
  }

  // ── RUN ──────────────────────────────────────────────────────────────────

  function runMatch() {
    var text = (document.getElementById('aiMatchTextarea') || {}).value;
    text = (text || '').trim();
    if (!text) {
      if (typeof showToast === 'function') showToast('Опишите кого вы ищете', 'error');
      return;
    }

    var gradeEl   = document.querySelector('[data-grade].active');
    var formatEl  = document.querySelector('[data-format].active');
    var grade     = gradeEl   ? gradeEl.getAttribute('data-grade')   : '';
    var format    = formatEl  ? formatEl.getAttribute('data-format') : '';
    var verifiedOnly = (document.getElementById('aiMatchVerifiedOnly') || {}).checked !== false;
    var activeOnly   = !!(document.getElementById('aiMatchActiveOnly') || {}).checked;

    var inputState   = document.getElementById('aiMatchInputState');
    var loadState    = document.getElementById('aiMatchLoadingState');
    var resultsState = document.getElementById('aiMatchResultsState');

    if (inputState)   inputState.classList.add('hidden');
    if (resultsState) resultsState.classList.add('hidden');
    if (loadState)    loadState.classList.remove('hidden');

    setStep(1, 'Анализ текста вакансии...');

    var t1 = setTimeout(function () { setStep(2, 'Извлечение ключевых навыков...'); }, 400);
    var t2 = setTimeout(function () { setStep(3, 'Ранжирование кандидатов...'); }, 800);

    fetchCandidates().then(function (candidates) {
      setTimeout(function () {
        clearTimeout(t1); clearTimeout(t2);
        var results = match(text, { grade: grade, format: format, verifiedOnly: verifiedOnly, activeOnly: activeOnly }, candidates);

        if (loadState)    loadState.classList.add('hidden');
        if (resultsState) resultsState.classList.remove('hidden');

        var countEl = document.getElementById('aiMatchResultCount');
        if (countEl) countEl.textContent = results.length + ' кандидатов';

        var container = document.getElementById('aiMatchResults');
        if (!container) return;

        if (!results.length) {
          container.innerHTML = '<div class="aiMatchEmpty">Нет подходящих кандидатов.<br>Попробуйте снять фильтры или расширить описание вакансии.</div>';
          return;
        }

        container.innerHTML = results.map(renderCard).join('');
        container.querySelectorAll('.aiResultCard[data-user-id]').forEach(function (card) {
          card.addEventListener('click', function () {
            var uid = card.getAttribute('data-user-id');
            if (uid && typeof openPublicProfile === 'function') openPublicProfile(uid);
          });
        });

      }, 1100);
    }).catch(function (err) {
      clearTimeout(t1); clearTimeout(t2);
      if (loadState)  loadState.classList.add('hidden');
      if (inputState) inputState.classList.remove('hidden');
      if (typeof showToast === 'function') showToast('Ошибка загрузки кандидатов', 'error');
      console.error('[lomoAI] fetch error', err);
    });
  }

  // ── INIT ─────────────────────────────────────────────────────────────────

  function init() {
    var runBtn = document.getElementById('btnRunAiMatch');
    if (runBtn) runBtn.addEventListener('click', runMatch);

    var backBtn = document.getElementById('btnAiMatchBack');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        var rs = document.getElementById('aiMatchResultsState');
        var is = document.getElementById('aiMatchInputState');
        if (rs) rs.classList.add('hidden');
        if (is) is.classList.remove('hidden');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  window.lomoAI = { match: match, tokenize: tokenize, detectGradeFromText: detectGradeFromText, extractMaxSalary: extractMaxSalary };

})();
