/* jobs.js — vacancies feed, create/edit job, my jobs list */

var jobsState = {
  feedPage: 1,
  feedTotal: 0,
  feedFilters: { direction: '', format: '', experience: '', grade: '' },
  myJobs: [],
  editingJobId: null,
  skillTags: [],
};

var JOB_DIRECTIONS_IT = ['Frontend','Backend','Fullstack','DevOps','Data','Mobile','QA','Product','Design'];
var JOB_DIRECTIONS_FIN = ['Бухгалтерия','Аудит','Финансовый анализ','Банкинг','Инвестиции','Fintech'];
var JOB_EXPERIENCES = ['Опыт не нужен','От 1 года','От 2 лет','От 3 лет','От 5 лет'];
var JOB_FORMATS = ['Удалённо','Офис','Гибрид'];
var JOB_GRADES = ['Junior','Middle','Senior','Lead'];

function jobEsc(s) {
  return String(s||'').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function jobSalary(from, to) {
  if (from && to) return jobFmt(from) + ' — ' + jobFmt(to) + ' ₽';
  if (from) return 'от ' + jobFmt(from) + ' ₽';
  if (to)   return 'до ' + jobFmt(to) + ' ₽';
  return '';
}
function jobFmt(n) { return Number(n).toLocaleString('ru'); }

function jobVerifiedBadge(status) {
  return status === 'verified' ? '<span class="jobVerifiedBadge">✓ Верифицирована</span>' : '';
}

function jobStatusLabel(status) {
  var map = { draft: 'Черновик', active: 'Активна', closed: 'Закрыта' };
  var cls  = { draft: 'ghost',   active: 'ok',      closed: 'bad' };
  return '<span class="statusTag ' + (cls[status]||'ghost') + '">' + (map[status]||status) + '</span>';
}

// ── Feed ─────────────────────────────────────────────────────────────────────

function loadJobsFeed(page) {
  jobsState.feedPage = page || 1;
  var list  = document.getElementById('jobFeedList');
  var pager = document.getElementById('jobFeedPager');
  if (!list) return;

  list.innerHTML = '<div class="feedLoading">Загрузка...</div>';
  if (pager) pager.innerHTML = '';

  var params = new URLSearchParams({ page: jobsState.feedPage, pageSize: 12 });
  var f = jobsState.feedFilters;
  if (f.direction)  params.set('direction', f.direction);
  if (f.format)     params.set('format', f.format);
  if (f.experience) params.set('experience', f.experience);
  if (f.grade)      params.set('grade', f.grade);

  var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  fetch(base + '/jobs?' + params.toString(), {
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lomo_token') || '') }
  })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(data) {
      renderJobFeed(data, list, pager);
    })
    .catch(function() {
      list.innerHTML = '<div class="feedEmpty">Не удалось загрузить вакансии</div>';
    });
}

function renderJobFeed(data, list, pager) {
  var items = data.items || [];
  if (!items.length) {
    list.innerHTML = '<div class="feedEmpty">Вакансий пока нет — попробуйте изменить фильтры</div>';
    return;
  }

  list.innerHTML = items.map(function(j) {
    var sal = jobSalary(j.salary_from, j.salary_to);
    var skills = (j.skills || []).slice(0, 5).map(function(s) {
      return '<span class="skillPill">' + jobEsc(s) + '</span>';
    }).join('');
    var avatar = j.avatar_url
      ? '<img src="' + jobEsc(j.avatar_url) + '" class="jobCardLogo" alt="logo">'
      : '<div class="jobCardLogoFallback">' + jobEsc((j.company||'?').charAt(0).toUpperCase()) + '</div>';

    return '<div class="jobCard" data-job-id="' + jobEsc(j.id) + '">'
      + '<div class="jobCardHead">'
        + '<div class="jobCardCompanyRow">'
          + '<div class="jobCardAvatarWrap">' + avatar + '</div>'
          + '<div class="jobCardCompanyInfo">'
            + '<div class="jobCardCompany">' + jobEsc(j.company || 'Компания') + '</div>'
            + jobVerifiedBadge(j.company_verify_status)
          + '</div>'
        + '</div>'
        + '<div class="jobCardTitle">' + jobEsc(j.title) + '</div>'
      + '</div>'
      + '<div class="jobCardMeta">'
        + (sal ? '<span class="jobMetaPill salary">💰 ' + sal + '</span>' : '')
        + '<span class="jobMetaPill">' + jobEsc(j.format) + '</span>'
        + '<span class="jobMetaPill">' + jobEsc(j.experience) + '</span>'
        + (j.grade ? '<span class="jobMetaPill">' + jobEsc(j.grade) + '</span>' : '')
        + '<span class="jobMetaPill dir">' + jobEsc(j.direction) + '</span>'
        + (j.city ? '<span class="jobMetaPill">📍 ' + jobEsc(j.city) + '</span>' : '')
      + '</div>'
      + (skills ? '<div class="jobCardSkills">' + skills + '</div>' : '')
      + '<div class="jobCardFooter">'
        + '<button type="button" class="accentBtn jobApplyBtn" data-job-id="' + jobEsc(j.id) + '" data-company-status="' + jobEsc(j.company_verify_status) + '">Откликнуться</button>'
      + '</div>'
    + '</div>';
  }).join('');

  // Pager
  if (pager && data.totalPages > 1) {
    var html = '';
    for (var p = 1; p <= data.totalPages; p++) {
      html += '<button class="pagerBtn' + (p === data.page ? ' active' : '') + '" data-jobs-page="' + p + '">' + p + '</button>';
    }
    pager.innerHTML = html;
  }
}

function initJobFeedFilters() {
  var container = document.getElementById('jobFeedFilters');
  if (!container) return;

  container.addEventListener('change', function(e) {
    var sel = e.target;
    if (sel.id === 'jobFilterDirection')  jobsState.feedFilters.direction = sel.value;
    if (sel.id === 'jobFilterFormat')     jobsState.feedFilters.format = sel.value;
    if (sel.id === 'jobFilterExperience') jobsState.feedFilters.experience = sel.value;
    if (sel.id === 'jobFilterGrade')      jobsState.feedFilters.grade = sel.value;
    loadJobsFeed(1);
  });

  var pager = document.getElementById('jobFeedPager');
  if (pager) {
    pager.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-jobs-page]');
      if (btn) loadJobsFeed(parseInt(btn.getAttribute('data-jobs-page')));
    });
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function handleJobApply(jobId, companyStatus) {
  if (companyStatus !== 'verified') {
    showToast('Компания ещё не прошла верификацию — отклики временно недоступны', 'warn');
    return;
  }
  var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  var token = localStorage.getItem('lomo_token') || '';
  if (!token) { showToast('Войдите, чтобы откликнуться', 'warn'); return; }

  fetch(base + '/jobs/' + jobId + '/apply', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) showToast('Отклик отправлен!', 'ok');
      else showToast(d.error || 'Ошибка', 'error');
    })
    .catch(function() { showToast('Ошибка сети', 'error'); });
}

// ── My Jobs ───────────────────────────────────────────────────────────────────

function loadMyJobs() {
  var list = document.getElementById('myJobsList');
  if (!list) return;
  list.innerHTML = '<div class="feedLoading">Загрузка...</div>';

  var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  fetch(base + '/jobs/my', {
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lomo_token') || '') }
  })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(jobs) {
      jobsState.myJobs = jobs;
      renderMyJobs(jobs, list);
      var counter = document.getElementById('myJobsCount');
      if (counter) counter.textContent = jobs.filter(function(j) { return j.status === 'active'; }).length;
    })
    .catch(function() {
      list.innerHTML = '<div class="feedEmpty">Не удалось загрузить вакансии</div>';
    });
}

function renderMyJobs(jobs, list) {
  if (!jobs.length) {
    list.innerHTML = '<div class="feedEmpty">Вакансий нет — создайте первую</div>';
    return;
  }
  list.innerHTML = jobs.map(function(j) {
    var sal = jobSalary(j.salary_from, j.salary_to);
    return '<div class="myJobRow">'
      + '<div class="myJobInfo">'
        + '<div class="myJobTitle">' + jobEsc(j.title) + '</div>'
        + '<div class="myJobMeta">'
          + jobStatusLabel(j.status) + ' '
          + '<span>' + jobEsc(j.direction) + '</span> · '
          + '<span>' + jobEsc(j.format) + '</span>'
          + (sal ? ' · <span>' + sal + '</span>' : '')
          + ' · <span>' + j.applications_count + ' откл.</span>'
        + '</div>'
      + '</div>'
      + '<div class="myJobActions">'
        + '<button type="button" class="miniLink" data-edit-job="' + jobEsc(j.id) + '">Редакт.</button>'
        + (j.status !== 'active'
            ? '<button type="button" class="miniLink ok" data-job-status="' + jobEsc(j.id) + '" data-status-val="active">Опубл.</button>'
            : '<button type="button" class="miniLink warn" data-job-status="' + jobEsc(j.id) + '" data-status-val="closed">Закрыть</button>')
        + '<button type="button" class="miniLink bad" data-del-job="' + jobEsc(j.id) + '">Удалить</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function handleMyJobActions(e) {
  var editBtn   = e.target.closest('[data-edit-job]');
  var statusBtn = e.target.closest('[data-job-status]');
  var delBtn    = e.target.closest('[data-del-job]');

  if (editBtn) {
    var jobId = editBtn.getAttribute('data-edit-job');
    var job = jobsState.myJobs.find(function(j) { return j.id === jobId; });
    if (job) openJobForm(job);
    return;
  }
  if (statusBtn) {
    var jId  = statusBtn.getAttribute('data-job-status');
    var val  = statusBtn.getAttribute('data-status-val');
    changeJobStatus(jId, val);
    return;
  }
  if (delBtn) {
    var dId = delBtn.getAttribute('data-del-job');
    if (confirm('Удалить вакансию?')) deleteJob(dId);
  }
}

function changeJobStatus(jobId, status) {
  var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  fetch(base + '/jobs/' + jobId + '/status', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lomo_token') || ''), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status }),
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.id) { showToast('Статус обновлён', 'ok'); loadMyJobs(); }
      else showToast(d.error || 'Ошибка', 'error');
    })
    .catch(function() { showToast('Ошибка сети', 'error'); });
}

function deleteJob(jobId) {
  var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  fetch(base + '/jobs/' + jobId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lomo_token') || '') },
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) { showToast('Вакансия удалена', 'ok'); loadMyJobs(); }
      else showToast(d.error || 'Ошибка', 'error');
    })
    .catch(function() { showToast('Ошибка сети', 'error'); });
}

// ── Create / Edit Form ────────────────────────────────────────────────────────

function openJobForm(job) {
  jobsState.editingJobId = job ? job.id : null;
  jobsState.skillTags = job ? (job.skills || []) : [];

  var titleEl = document.getElementById('jobFormTitle');
  if (titleEl) titleEl.textContent = job ? 'Редактировать вакансию' : 'Новая вакансия';

  setJobFormVal('jobInputTitle', job ? job.title : '');
  setJobFormSel('jobSelectDirection', job ? job.direction : '');
  setJobFormSel('jobSelectExperience', job ? job.experience : '');
  setJobFormVal('jobInputSalaryFrom', job ? (job.salary_from || '') : '');
  setJobFormVal('jobInputSalaryTo', job ? (job.salary_to || '') : '');
  setJobFormSel('jobSelectFormat', job ? job.format : '');
  setJobFormSel('jobSelectGrade', job ? (job.grade || '') : '');
  setJobFormVal('jobInputCity', job ? (job.city || '') : '');
  setJobFormVal('jobInputDescription', job ? (job.description || '') : '');

  renderSkillTags();
  if (typeof show === 'function') show('postJob');
}

function setJobFormVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}
function setJobFormSel(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function renderSkillTags() {
  var wrap = document.getElementById('jobSkillTagsWrap');
  if (!wrap) return;
  wrap.innerHTML = jobsState.skillTags.map(function(s, i) {
    return '<span class="skillTag">' + jobEsc(s)
      + '<button type="button" class="skillTagDel" data-skill-idx="' + i + '">×</button></span>';
  }).join('');
}

function addSkillTag(val) {
  var s = val.trim();
  if (!s || jobsState.skillTags.indexOf(s) !== -1 || jobsState.skillTags.length >= 20) return;
  jobsState.skillTags.push(s);
  renderSkillTags();
}

function initJobForm() {
  var skillInput = document.getElementById('jobSkillInput');
  var skillWrap  = document.getElementById('jobSkillTagsWrap');

  if (skillInput) {
    skillInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addSkillTag(skillInput.value);
        skillInput.value = '';
      }
    });
  }
  if (skillWrap) {
    skillWrap.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-skill-idx]');
      if (btn) {
        var idx = parseInt(btn.getAttribute('data-skill-idx'));
        jobsState.skillTags.splice(idx, 1);
        renderSkillTags();
      }
    });
  }

  var saveBtn    = document.getElementById('jobBtnPublish');
  var draftBtn   = document.getElementById('jobBtnDraft');
  var cancelBtn  = document.getElementById('jobBtnCancel');

  if (saveBtn)   saveBtn.addEventListener('click', function() { submitJobForm('active'); });
  if (draftBtn)  draftBtn.addEventListener('click', function() { submitJobForm('draft'); });
  if (cancelBtn) cancelBtn.addEventListener('click', function() {
    if (typeof show === 'function') show('myJobs');
  });
}

function getJobFormData() {
  return {
    title:       (document.getElementById('jobInputTitle') || {}).value || '',
    direction:   (document.getElementById('jobSelectDirection') || {}).value || '',
    experience:  (document.getElementById('jobSelectExperience') || {}).value || '',
    salary_from: parseInt((document.getElementById('jobInputSalaryFrom') || {}).value) || null,
    salary_to:   parseInt((document.getElementById('jobInputSalaryTo') || {}).value) || null,
    format:      (document.getElementById('jobSelectFormat') || {}).value || '',
    grade:       (document.getElementById('jobSelectGrade') || {}).value || '',
    city:        (document.getElementById('jobInputCity') || {}).value || '',
    description: (document.getElementById('jobInputDescription') || {}).value || '',
    skills:      jobsState.skillTags,
  };
}

function validateJobForm(data) {
  var errors = [];
  if (!data.title.trim())    errors.push('Укажите название вакансии');
  if (!data.direction)       errors.push('Выберите направление');
  if (!data.experience)      errors.push('Выберите требуемый опыт');
  if (!data.format)          errors.push('Выберите формат работы');
  if (!data.salary_from && !data.salary_to) errors.push('Укажите зарплату');
  return errors;
}

function submitJobForm(statusVal) {
  var data = getJobFormData();
  data.status = statusVal;
  var errors = validateJobForm(data);
  if (errors.length) { showToast(errors[0], 'error'); return; }

  var base   = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  var token  = localStorage.getItem('lomo_token') || '';
  var isEdit = !!jobsState.editingJobId;
  var url    = isEdit ? base + '/jobs/' + jobsState.editingJobId : base + '/jobs';
  var method = isEdit ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.id) {
        showToast(statusVal === 'active' ? 'Вакансия опубликована!' : 'Черновик сохранён', 'ok');
        if (typeof show === 'function') show('myJobs');
        loadMyJobs();
      } else {
        showToast(d.error || 'Ошибка сохранения', 'error');
      }
    })
    .catch(function() { showToast('Ошибка сети', 'error'); });
}

// ── Recruiter public profile jobs ─────────────────────────────────────────────

function loadRecruiterProfileJobs() {
  var list = document.getElementById('rpJobsList');
  if (!list) return;
  list.innerHTML = '<div class="feedLoading">Загрузка...</div>';

  var base = (typeof API_BASE !== 'undefined') ? API_BASE : '/api';
  fetch(base + '/jobs/my', {
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lomo_token') || '') }
  })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(jobs) {
      var active = (jobs || []).filter(function(j) { return j.status === 'active'; });
      var section = document.getElementById('rpJobsSection');
      if (section) section.classList.toggle('hidden', active.length === 0);
      if (!active.length) { list.innerHTML = ''; return; }
      list.innerHTML = active.map(function(j) {
        var sal = jobSalary(j.salary_from, j.salary_to);
        return '<div class="myJobRow">'
          + '<div class="myJobInfo">'
            + '<div class="myJobTitle">' + jobEsc(j.title) + '</div>'
            + '<div class="myJobMeta">'
              + '<span>' + jobEsc(j.direction) + '</span> · '
              + '<span>' + jobEsc(j.format) + '</span>'
              + (sal ? ' · <span>' + sal + '</span>' : '')
            + '</div>'
          + '</div>'
        + '</div>';
      }).join('');
    })
    .catch(function() {
      var list2 = document.getElementById('rpJobsList');
      if (list2) list2.innerHTML = '';
      var section = document.getElementById('rpJobsSection');
      if (section) section.classList.add('hidden');
    });
}

// ── Toast helper (fallback if not defined globally) ───────────────────────────

function showToast(msg, type) {
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    window.showToast(msg, type);
    return;
  }
  var t = document.createElement('div');
  t.className = 'toastMsg ' + (type || '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.classList.add('visible'); }, 10);
  setTimeout(function() { t.classList.remove('visible'); setTimeout(function() { t.remove(); }, 300); }, 3000);
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  initJobFeedFilters();
  initJobForm();

  // Feed tab click
  document.addEventListener('click', function(e) {
    var applyBtn = e.target.closest('.jobApplyBtn');
    if (applyBtn) {
      handleJobApply(applyBtn.getAttribute('data-job-id'), applyBtn.getAttribute('data-company-status'));
      return;
    }
    var myActions = e.target.closest('#myJobsList');
    if (myActions) handleMyJobActions(e);

    // "Создать вакансию" button
    if (e.target.closest('#btnNewJob')) openJobForm(null);

    // navigate to My Jobs
    if (e.target.closest('[data-next="toMyJobs"]')) {
      if (typeof show === 'function') show('myJobs');
      loadMyJobs();
    }
  });

  // Load feed when vacancies tab becomes visible
  var vacTab = document.querySelector('[data-main-tab="vacancies"]');
  if (vacTab) {
    vacTab.addEventListener('click', function() {
      if (!jobsState._feedLoaded) {
        jobsState._feedLoaded = true;
        loadJobsFeed(1);
      }
    });
  }

  // Load screens when they become active
  window.addEventListener('lomo:screen-change', function(e) {
    if (!e.detail) return;
    if (e.detail.current === 'myJobs') loadMyJobs();
    if (e.detail.current === 'recruiterPublic') loadRecruiterProfileJobs();
  });
});
