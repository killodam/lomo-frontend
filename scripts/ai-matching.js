/* ai-matching.js — LOMO AI Matching Engine v2
   Standalone TF-IDF + cosine similarity, no external API calls.
   Exports window.lomoAI and binds UI on DOMContentLoaded.
*/
(function () {
  'use strict';

  // ── SYNONYMS ────────────────────────────────────────────────────────────
  var SYNONYMS = {
    'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'rb': 'ruby',
    'реакт': 'react', 'ангуляр': 'angular', 'вью': 'vue', 'вуе': 'vue',
    'джун': 'junior', 'джуниор': 'junior', 'мидл': 'middle',
    'синьор': 'senior', 'сеньор': 'senior', 'сениор': 'senior',
    'питон': 'python', 'джаваскрипт': 'javascript',
    'бэкенд': 'backend', 'фронтенд': 'frontend',
    'фуллстек': 'fullstack', 'фулл-стек': 'fullstack', 'full-stack': 'fullstack',
    'ml': 'machine_learning', 'аналитик': 'analyst', 'менеджер': 'manager',
    'дизайнер': 'designer', 'верстка': 'html', 'верстальщик': 'html',
    'к8с': 'kubernetes', 'k8s': 'kubernetes',
    'докер': 'docker', 'постгрес': 'postgresql', 'postgres': 'postgresql',
    'монга': 'mongodb', 'mongo': 'mongodb',
    'нода': 'nodejs', 'node.js': 'nodejs', 'next.js': 'nextjs',
  };

  // ── IMPLIED SKILLS ──────────────────────────────────────────────────────
  var IMPLIED = {
    'react':      ['javascript', 'html', 'css'],
    'vue':        ['javascript', 'html', 'css'],
    'angular':    ['javascript', 'typescript', 'html', 'css'],
    'nextjs':     ['react', 'javascript', 'nodejs'],
    'nuxtjs':     ['vue', 'javascript', 'nodejs'],
    'django':     ['python'],
    'flask':      ['python'],
    'fastapi':    ['python'],
    'spring':     ['java'],
    'rails':      ['ruby'],
    'laravel':    ['php'],
    'nestjs':     ['nodejs', 'typescript'],
    'express':    ['nodejs', 'javascript'],
    'kubernetes': ['docker'],
  };

  // ── DOMAIN CLUSTERS ─────────────────────────────────────────────────────
  var CLUSTERS = {
    frontend:   ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'nextjs', 'nuxtjs', 'webpack', 'vite', 'sass', 'tailwind'],
    backend:    ['nodejs', 'python', 'java', 'go', 'ruby', 'php', 'rust', 'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel', 'nestjs', 'express', 'graphql', 'rest'],
    data:       ['python', 'sql', 'machine_learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'spark', 'airflow', 'tableau', 'powerbi', 'sklearn'],
    devops:     ['docker', 'kubernetes', 'terraform', 'ansible', 'aws', 'gcp', 'azure', 'jenkins', 'linux', 'bash'],
    mobile:     ['swift', 'kotlin', 'flutter', 'android', 'ios'],
    database:   ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra'],
    design:     ['figma', 'sketch', 'photoshop', 'illustrator', 'ux', 'ui', 'wireframe', 'prototype'],
    management: ['agile', 'scrum', 'kanban', 'jira', 'confluence', 'roadmap', 'okr'],
  };

  // ── STOP WORDS ──────────────────────────────────────────────────────────
  var STOP = new Set([
    'и','в','на','с','по','к','для','от','что','как','при','это','также',
    'будет','ищем','опыт','работы','лет','знание','умение','команде','плюсом',
    'задачи','требования','обязанности','требуется','ожидаем','хотим',
    'мы','вы','вас','нас','они','он','она','или','но','а','то','за','из',
    'об','со','под','над','без','через','между','перед','после','во','до',
    'год','года','желательно','приветствуется','готовность',
  ]);

  var GRADES = ['intern', 'junior', 'middle', 'senior', 'lead'];

  // ── TOKENISER ───────────────────────────────────────────────────────────

  function stemRu(word) {
    var sfx = ['ирование','ирования','ировании','ость','ости','ющий','ющего',
      'ный','ного','ному','ных','ный','ений','ения','ение',
      'ать','ять','ить','еть','ами','ему','его','ого','ией',
      'ые','ая','ое','ую','ей','их','ых','ам','ом','ем','им','ах','ях',
      'ию','ия','ие','ий','ью','ья','ье','ьи','ю','я','е','и','у','а'];
    var w = word.toLowerCase();
    if (w.length < 5) return w;
    for (var i = 0; i < sfx.length; i++) {
      var s = sfx[i];
      if (w.length > s.length + 3 && w.endsWith(s)) return w.slice(0, w.length - s.length);
    }
    return w;
  }

  function normalize(w) {
    var clean = w.toLowerCase().replace(/[^a-zа-яёa-z0-9#.+]/g, '');
    return SYNONYMS[clean] || clean;
  }

  function tokenize(text) {
    if (!text) return [];
    var tokens = [];
    text.toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()\n\r]/g, ' ')
      .replace(/\s+/g, ' ').trim().split(' ')
      .forEach(function (w) {
        if (!w || w.length < 2) return;
        var norm = normalize(w);
        if (STOP.has(norm) || norm.length < 2) return;
        var stem = /[а-яё]/.test(norm) ? stemRu(norm) : norm;
        if (stem.length >= 2) tokens.push(stem);
      });
    return tokens;
  }

  function expandImplied(tokens) {
    var set = {};
    tokens.forEach(function (t) { set[t] = true; });
    tokens.forEach(function (t) {
      var imp = IMPLIED[t];
      if (imp) imp.forEach(function (x) { var s = tokenize(x)[0]; if (s) set[s] = true; });
    });
    return Object.keys(set);
  }

  function buildTF(tokens) {
    var tf = {}, total = tokens.length || 1;
    tokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
    Object.keys(tf).forEach(function (t) { tf[t] /= total; });
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

  function detectDomain(tokens) {
    var best = null, bestN = 0;
    Object.keys(CLUSTERS).forEach(function (d) {
      var n = 0;
      tokens.forEach(function (t) { if (CLUSTERS[d].indexOf(t) >= 0) n++; });
      if (n > bestN) { bestN = n; best = d; }
    });
    return best;
  }

  function gradeBoost(jobGrade, candGrade) {
    if (!jobGrade || !candGrade) return 1.0;
    var ji = GRADES.indexOf(jobGrade.toLowerCase());
    var ci = GRADES.indexOf(candGrade.toLowerCase());
    if (ji < 0 || ci < 0) return 1.0;
    var d = Math.abs(ji - ci);
    return d === 0 ? 1.2 : d === 1 ? 1.05 : d === 2 ? 0.9 : 0.75;
  }

  // ── MATCHING ─────────────────────────────────────────────────────────────

  function buildCandidateText(c) {
    var skills = Array.isArray(c.skills) ? c.skills.join(' ')
      : (typeof c.skills === 'string' ? c.skills : '');
    return [c.full_name, c.title, skills, c.bio, c.city, c.grade, c.work_format]
      .filter(Boolean).join(' ');
  }

  function scoreOne(jobTok, jobTF, jobGrade, jobFormat, c, verifiedOnly) {
    if (verifiedOnly && !c.is_verified) return null;
    if (jobFormat && c.work_format && c.work_format.toLowerCase() !== jobFormat) return null;

    var candTok = expandImplied(tokenize(buildCandidateText(c)));
    var candTF = buildTF(candTok);
    var sim = cosineSim(jobTF, candTF) * gradeBoost(jobGrade, c.grade);

    var verBonus = c.is_verified
      ? (c.verification_level >= 3 ? 0.20 : c.verification_level === 2 ? 0.12 : 0.06)
      : 0;
    var uniBonus = c.university ? 0.08 : 0;

    var domain = detectDomain(jobTok);
    var domBonus = 0;
    if (domain) {
      var hits = 0;
      candTok.forEach(function (t) { if (CLUSTERS[domain].indexOf(t) >= 0) hits++; });
      domBonus = Math.min(hits * 0.03, 0.15);
    }

    var score = Math.min(Math.round((sim + verBonus + uniBonus + domBonus) * 100), 100);

    var overlap = [];
    jobTok.forEach(function (t) { if (candTok.indexOf(t) >= 0 && !STOP.has(t)) overlap.push(t); });

    return { candidate: c, score: score, overlap: overlap.slice(0, 6) };
  }

  function match(jobText, opts, candidates) {
    opts = opts || {};
    var grade = opts.grade || '';
    var format = opts.format || '';
    var verifiedOnly = opts.verifiedOnly !== false;
    var max = opts.maxResults || 20;

    var jobTok = expandImplied(tokenize(jobText));
    var jobTF = buildTF(jobTok);

    var results = [];
    (candidates || []).forEach(function (c) {
      var r = scoreOne(jobTok, jobTF, grade, format, c, verifiedOnly);
      if (r && r.score >= 1) results.push(r);
    });
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, max);
  }

  // ── RENDER ───────────────────────────────────────────────────────────────

  function renderCard(r) {
    var c = r.candidate;
    var scoreClass = r.score >= 70 ? 'aiScore--high' : r.score >= 40 ? 'aiScore--mid' : 'aiScore--low';
    var skills = Array.isArray(c.skills) ? c.skills
      : (typeof c.skills === 'string' ? c.skills.split(/[,;]+/).map(function (s) { return s.trim(); }) : []);
    var avatar = c.avatar_url
      ? '<img class="aiResultAvatar" src="' + c.avatar_url + '" alt="" loading="lazy">'
      : '<div class="aiResultAvatarFallback">' + (c.full_name || 'U').charAt(0).toUpperCase() + '</div>';
    var verified = c.is_verified ? '<span class="aiResultVerifiedBadge">✓</span>' : '';
    var tags = [
      c.grade ? '<span class="aiResultTag">' + c.grade + '</span>' : '',
      c.work_format ? '<span class="aiResultTag">' + c.work_format + '</span>' : '',
    ].filter(Boolean).join('');
    var skillTags = skills.slice(0, 4).map(function (s) {
      return '<span class="aiResultSkillTag">' + s + '</span>';
    }).join('');
    var overlapHtml = r.overlap.length
      ? '<div class="aiResultOverlap">' + r.overlap.map(function (t) {
          return '<span class="aiResultOverlapTag">' + t + '</span>';
        }).join('') + '</div>'
      : '';

    return '<div class="aiResultCard" data-user-id="' + (c.user_id || c.id || '') + '">' +
      '<div class="aiResultScore ' + scoreClass + '">' + r.score + '</div>' +
      '<div class="aiResultAvatarWrap">' + avatar + verified + '</div>' +
      '<div class="aiResultInfo">' +
        '<div class="aiResultName">' + (c.full_name || 'Кандидат') + '</div>' +
        '<div class="aiResultMeta">' + (c.title || '') + '</div>' +
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

  // ── RUN ──────────────────────────────────────────────────────────────────

  function runMatch() {
    var text = (document.getElementById('aiMatchTextarea') || {}).value;
    text = (text || '').trim();
    if (!text) {
      if (typeof showToast === 'function') showToast('Опишите кого вы ищете', 'error');
      return;
    }

    var gradeEl  = document.querySelector('[data-grade].active');
    var formatEl = document.querySelector('[data-format].active');
    var grade  = gradeEl  ? gradeEl.getAttribute('data-grade')   : '';
    var format = formatEl ? formatEl.getAttribute('data-format') : '';
    var verifiedOnly = (document.getElementById('aiMatchVerifiedOnly') || {}).checked !== false;

    var inputState   = document.getElementById('aiMatchInputState');
    var loadState    = document.getElementById('aiMatchLoadingState');
    var resultsState = document.getElementById('aiMatchResultsState');

    if (inputState)   inputState.classList.add('hidden');
    if (resultsState) resultsState.classList.add('hidden');
    if (loadState)    loadState.classList.remove('hidden');

    setStep(1, 'Анализ текста вакансии...');

    var cached = window.__lomoCache && window.__lomoCache.candidates;
    var fetchP = cached
      ? Promise.resolve(cached)
      : fetch('/api/profile/candidates?pageSize=100', { credentials: 'include' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var list = Array.isArray(data) ? data : (data.candidates || data.data || []);
            window.__lomoCache = window.__lomoCache || {};
            window.__lomoCache.candidates = list;
            return list;
          });

    var t1 = setTimeout(function () { setStep(2, 'Извлечение ключевых навыков...'); }, 400);
    var t2 = setTimeout(function () { setStep(3, 'Ранжирование кандидатов...'); }, 800);

    fetchP.then(function (candidates) {
      setTimeout(function () {
        clearTimeout(t1); clearTimeout(t2);
        var results = match(text, { grade: grade, format: format, verifiedOnly: verifiedOnly }, candidates);

        if (loadState)    loadState.classList.add('hidden');
        if (resultsState) resultsState.classList.remove('hidden');

        var countEl = document.getElementById('aiMatchResultCount');
        if (countEl) countEl.textContent = results.length + ' кандидатов';

        var container = document.getElementById('aiMatchResults');
        if (!container) return;

        if (!results.length) {
          container.innerHTML = '<div class="aiMatchEmpty">Нет подходящих кандидатов. Попробуйте снять фильтры или расширить описание вакансии.</div>';
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

  window.lomoAI = { match: match, tokenize: tokenize };

})();
