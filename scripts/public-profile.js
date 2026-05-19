    // Track where we came from to go back
    var _profileFromScreen = 'landing';
    var _activePublicProfileUserId = '';

    function escHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function _openProfileById(uid){
      var u = _userCache[uid];
      if(!u) return;
      if(u.public_id){
        apiGetPublicProfile(u.public_id).then(function(profile){
          _userCache[uid] = Object.assign({}, u, profile || {});
          openUserProfile(_userCache[uid]);
        }).catch(function(){
          openUserProfile(u);
        });
        return;
      }
      openUserProfile(u);
    }

    function _getActiveScreenKey() {
      if (typeof activeScreenKey === 'string' && activeScreenKey && screens[activeScreenKey]) {
        return activeScreenKey;
      }
      var keys = Object.keys(screens);
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (screens[key] && screens[key].classList.contains('active')) return key;
      }
      return '';
    }

    function _rememberProfileFromScreen(nextKey) {
      var sourceKey = nextKey || _getActiveScreenKey();
      if (!sourceKey || sourceKey === 'publicProfile' || !screens[sourceKey]) return;
      _profileFromScreen = sourceKey;
    }

    function _getProfileReturnScreen() {
      if (_profileFromScreen && _profileFromScreen !== 'publicProfile' && screens[_profileFromScreen]) {
        return _profileFromScreen;
      }
      return 'landing';
    }

    function closePublicProfile(){
      show(_getProfileReturnScreen());
    }

    function _parseSkills(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean);
      if (typeof raw === 'string') {
        // PostgreSQL array literal: {React,TypeScript,CSS}
        if (raw.startsWith('{')) {
          return raw.slice(1, -1).split(',').map(function(s){ return s.trim().replace(/^"|"$/g,''); }).filter(Boolean);
        }
        return raw.split(/[,;]+/).map(function(s){ return s.trim(); }).filter(Boolean);
      }
      return [];
    }

    var GRADE_LABELS = { intern:'Стажёр', junior:'Junior', middle:'Middle', senior:'Senior', lead:'Lead' };
    var FORMAT_LABELS = { remote:'Удалённо', office:'Офис', hybrid:'Гибрид' };

    function openUserProfile(u, fromScreenKey){
      _rememberProfileFromScreen(fromScreenKey);
      _activePublicProfileUserId = u.id || '';

      var isEmployer = u.role === 'employer';
      var displayName = u.full_name || (isEmployer ? u.company : '') || u.email || 'Пользователь LOMO';
      var name = escHtml(displayName);
      var initials = displayName.replace(/[^\wа-яёa-z\s]/gi,'').split(/\s+/).map(function(s){return s[0]||'';}).join('').slice(0,2).toUpperCase() || '?';
      var avatarRoleClass = isEmployer ? ' employer' : ' candidate';
      var profileAvatarSrc = safeImageUrl(u.avatar_url);

      var avatarHtml = profileAvatarSrc
        ? '<img src="'+escHtml(profileAvatarSrc)+'" class="pubProfileAvatarImg'+avatarRoleClass+'" alt="'+name+'">'
        : '<div class="pubProfileAvatarFallback'+avatarRoleClass+'">'+escHtml(initials)+'</div>';

      // ── SUBTITLE (under name) ──────────────────────────────────────────
      var subtitle = '';
      if (isEmployer) {
        subtitle = escHtml(u.company || u.industry || '');
      } else {
        subtitle = escHtml(u.job_title || u.current_job || '');
      }

      // ── BADGES ROW ────────────────────────────────────────────────────
      var badges = '';
      badges += '<span class="pubBadgeRole '+(isEmployer?'employer':'candidate')+'">'+(isEmployer?'🏢 Работодатель':'👤 Кандидат')+'</span>';
      if (!isEmployer && u.grade && GRADE_LABELS[u.grade.toLowerCase()]) {
        badges += '<span class="pubBadge grade">'+escHtml(GRADE_LABELS[u.grade.toLowerCase()] || u.grade)+'</span>';
      }
      if (u.work_format && FORMAT_LABELS[u.work_format.toLowerCase()]) {
        badges += '<span class="pubBadge format">'+escHtml(FORMAT_LABELS[u.work_format.toLowerCase()] || u.work_format)+'</span>';
      }
      if (!isEmployer && u.looking_for_work) {
        badges += '<span class="pubBadge active">🟢 В поиске работы</span>';
      }
      // Verification
      var verCount = [u.edu_status,u.work_status,u.course_status,u.pass_status,u.cv_status].filter(function(s){return s==='verified';}).length;
      if (verCount > 0) {
        badges += '<span class="pubBadge verified">✓ LOMO Верификация</span>';
      }

      // ── META PILLS (location, education, connections) ─────────────────
      var metaPills = '';
      if (u.location) metaPills += '<span class="pubMetaPill">📍 '+escHtml(u.location)+'</span>';
      if (!isEmployer && u.edu_place) metaPills += '<span class="pubMetaPill">🎓 '+escHtml(u.edu_place+(u.edu_year?' · '+u.edu_year:''))+'</span>';
      if (u.industry && isEmployer) metaPills += '<span class="pubMetaPill">🏭 '+escHtml(u.industry)+'</span>';
      if (Number(u.connections_count || 0) > 0) metaPills += '<span class="pubMetaPill">🤝 '+escHtml(String(u.connections_count))+' контактов</span>';

      // ── SKILLS ────────────────────────────────────────────────────────
      var skills = _parseSkills(u.skills);
      var skillsHtml = '';
      var profileExperienceItems = (!isEmployer && Array.isArray(u.experience) && u.experience.length)
        ? u.experience
        : (!isEmployer ? _adaptWorkExp(u.work_exp || []) : []);
      if (skills.length) {
        skillsHtml = '<div class="pubProfileSection">'
          + '<div class="pubProfileSTitle">Навыки</div>'
          + '<div class="pubSkillsList">'
          + skills.map(function(s){ return '<span class="pubSkillChip">'+escHtml(s)+'</span>'; }).join('')
          + '</div>'
          + '</div>';
      }

      // ── ABOUT / BIO ───────────────────────────────────────────────────
      var aboutHtml = u.about
        ? '<div class="pubProfileSection"><div class="pubProfileSTitle">О себе</div><div class="pubProfileText">'+escHtml(u.about)+'</div></div>'
        : '';

      // ── CANDIDATE SECTIONS ────────────────────────────────────────────
      var candidateSections = '';
      if (!isEmployer) {
        if (u.vacancies) {
          candidateSections += '<div class="pubProfileSection"><div class="pubProfileSTitle">Ищет работу</div><div class="pubProfileText pubProfileTextAccent">'+escHtml(u.vacancies)+'</div></div>';
        }
        candidateSections += '<div id="profileExperience" class="profile-experience-section" style="display:none"></div>';
      }

      // ── EMPLOYER SECTIONS ─────────────────────────────────────────────
      var employerSections = '';
      if (isEmployer) {
        var publicWebsite = safeHttpUrl(u.website);
        if (publicWebsite) {
          employerSections += '<div class="pubProfileSection"><div class="pubProfileSTitle">Сайт</div><div class="pubProfileText"><a href="'+escHtml(publicWebsite)+'" target="_blank" rel="noopener noreferrer" class="pubInfoLink">'+escHtml(u.website)+'</a></div></div>';
        }
        if (u.needed) {
          employerSections += '<div class="pubProfileSection"><div class="pubProfileSTitle">Ищем в команду</div><div class="pubProfileText pubProfileTextAccent">'+escHtml(u.needed)+'</div></div>';
        }
        if (u.active_projects) {
          employerSections += '<div class="pubProfileSection"><div class="pubProfileSTitle">Активные проекты</div><div class="pubProfileText">'+escHtml(u.active_projects.replace(/;/g,', '))+'</div></div>';
        }
        // Jobs placeholder — populated after render
        employerSections += '<div id="pubEmployerJobsSection" class="pubProfileSection" style="display:none"><div class="pubProfileSTitle">Открытые вакансии</div><div id="pubEmployerJobsList"></div></div>';
      }

      // ── VERIFICATION CHIPS ────────────────────────────────────────────
      var verLabels = {edu_status:'Образование',work_status:'Опыт работы',course_status:'Курсы',pass_status:'Паспорт',cv_status:'CV'};
      var verifiedChips = Object.keys(verLabels).filter(function(k){return u[k]==='verified';}).map(function(k){return '<span class="pubVerChip">✓ '+verLabels[k]+'</span>';}).join('');
      var pendingChips = Object.keys(verLabels).filter(function(k){return u[k]==='pending';}).map(function(k){return '<span class="pubVerChip pending">⏳ '+verLabels[k]+'</span>';}).join('');
      var verSection = (verifiedChips || pendingChips)
        ? '<div class="pubProfileSection"><div class="pubProfileSTitle">Проверено LOMO</div><div class="pubVerChips">'+verifiedChips+pendingChips+'</div></div>'
        : '';

      // ── PUBLIC CV ─────────────────────────────────────────────────────
      var publicCvHtml = (!isEmployer && u.public_cv_doc_id)
        ? '<div class="pubProfileSection"><div class="pubProfileSTitle">Резюме (CV)</div><button type="button" class="pubCvBtn" data-open-doc="'+escHtml(u.public_cv_doc_id)+'" data-file-name="'+escHtml(u.public_cv_file_name||'CV')+'">📄 Открыть резюме</button></div>'
        : '';

      // ── CONTACT / ACCESS PANELS ───────────────────────────────────────
      var canConnect = !!getToken() && state.roleReg !== 'ADMIN' && String(u.id) !== String(state.userId);
      var canEmployerRequest = state.roleReg === 'EMPLOYER' && !isEmployer && String(u.id) !== String(state.userId);
      var connectionPanelHtml = canConnect
        ? '<div id="pubConnectionPanel" class="pubProfileSection"><div class="miniHint">Загрузка…</div></div>'
        : '';
      var employerAccessHtml = canEmployerRequest
        ? '<div id="pubAccessPanel" class="pubProfileSection"><div class="miniHint">Загрузка…</div></div>'
        : '';

      // ── ADMIN FILES ───────────────────────────────────────────────────
      var adminFilesHtml = '';
      if (state.roleReg === 'ADMIN') {
        adminFilesHtml = '<div class="pubProfileSection">'
          + '<div class="pubProfileSTitle">Файлы пользователя</div>'
          + '<button class="js-load-files pubProfileAdminLoadBtn" data-uid="'+u.id+'">📂 Просмотреть файлы</button>'
          + '<div id="userFileslist" class="pubProfileFiles"></div>'
          + '</div>';
      }

      // ── EMPTY STATE HINT ──────────────────────────────────────────────
      var hasContent = subtitle || skills.length || u.about || u.vacancies || profileExperienceItems.length || u.needed || u.active_projects;
      var emptyHint = !hasContent
        ? '<div class="pubProfileEmptyHint">Пользователь пока не заполнил профиль полностью</div>'
        : '';

      // ── ASSEMBLE ──────────────────────────────────────────────────────
      var content = document.getElementById('pubProfileContent');
      if (!content) return;

      content.innerHTML =
        '<div class="pubProfileCard">'
          + '<div class="pubProfileBanner '+(isEmployer?'employer':'candidate')+'"></div>'
          + '<div class="pubProfileHeroRow">'
            + '<div class="pubProfileAvatarArea">'+avatarHtml+'</div>'
          + '</div>'
          + '<div class="pubProfileBody">'
            + '<div class="pubProfileIdent">'
              + '<div class="pubProfileName">'+name+'</div>'
              + (subtitle ? '<div class="pubProfileSubtitle">'+subtitle+'</div>' : '')
              + '<div class="pubProfileBadges">'+badges+'</div>'
            + '</div>'
            + (metaPills ? '<div class="pubProfileMetaRow">'+metaPills+'</div>' : '')
            + emptyHint
            + skillsHtml
            + aboutHtml
            + candidateSections
            + employerSections
            + verSection
            + publicCvHtml
            + connectionPanelHtml
            + employerAccessHtml
            + adminFilesHtml
          + '</div>'
        + '</div>';

      if (!isEmployer) {
        renderExperience(profileExperienceItems);
      }

      _userCache[String(u.id)] = Object.assign({}, _userCache[String(u.id)] || {}, {
        id: u.id, role: u.role, public_id: u.public_id,
        full_name: u.full_name, company: u.company, avatar_url: u.avatar_url,
        location: u.location, industry: u.industry,
        current_job: u.current_job, job_title: u.job_title,
      });

      if (typeof updatePageSeoForProfile === 'function') updatePageSeoForProfile(u);

      show('publicProfile');
      if (canConnect) loadPublicConnectionPanel(u.id);
      if (canEmployerRequest) loadEmployerAccessPanel(u.id);
      if (isEmployer) loadPublicEmployerJobs(u.id);
    }

    function closeUserProfile(){
      if (typeof resetPageSeo === 'function') resetPageSeo();
      closePublicProfile();
    }

    function loadPublicEmployerJobs(userId) {
      var section = document.getElementById('pubEmployerJobsSection');
      var list    = document.getElementById('pubEmployerJobsList');
      if (!section || !list) return;

      apiFetch('/jobs?company_id=' + encodeURIComponent(userId) + '&pageSize=10')
        .then(function(data) {
          var items = (data.items || []);
          if (!items.length) return;
          section.style.display = '';
          list.innerHTML = items.map(function(j) {
            var sal = '';
            if (j.salary_from && j.salary_to) sal = Number(j.salary_from).toLocaleString('ru') + ' — ' + Number(j.salary_to).toLocaleString('ru') + ' ₽';
            else if (j.salary_from) sal = 'от ' + Number(j.salary_from).toLocaleString('ru') + ' ₽';
            else if (j.salary_to)  sal = 'до ' + Number(j.salary_to).toLocaleString('ru') + ' ₽';
            return '<div class="pubJobItem">'
              + '<div class="pubJobTitle">' + escHtml(j.title) + '</div>'
              + '<div class="pubJobMeta">'
                + escHtml(j.direction)
                + ' · ' + escHtml(j.format)
                + (j.grade ? ' · ' + escHtml(j.grade) : '')
                + (sal ? ' · ' + sal : '')
                + (j.city ? ' · 📍 ' + escHtml(j.city) : '')
              + '</div>'
            + '</div>';
          }).join('');
        })
        .catch(function() {});
    }

    function loadUserFiles(userId){
      var el = document.getElementById('userFileslist');
      if(!el) return;
      el.innerHTML = '<div class="pubProfileFilesState">Загрузка...</div>';
      apiFetch('/admin/users/'+userId+'/files').then(function(files){
        var active = (files||[]).filter(function(f){ return f.status !== 'rejected'; });
        if(!active.length){ el.innerHTML='<div class="pubProfileFilesState empty">Файлов нет</div>'; return; }
        el.innerHTML = active.map(function(f){
          return '<div class="pubProfileFileRow">'
            + '<span class="pubProfileFileName">'+escHtml(f.file_name||'файл')+'</span>'
            + '<button type="button" class="miniLink" data-open-doc="'+escHtml(f.id)+'" data-file-name="'+escHtml(f.file_name||'файл')+'">Открыть</button>'
            + '</div>';
        }).join('');
      }).catch(function(e){ el.innerHTML='<div class="pubProfileFilesState error">'+escHtml(safeErrorText(e))+'</div>'; });
    }

// ── Work experience: LinkedIn-style rendering ─────────────────────────────

function formatExperienceDates(start_date, end_date) {
  var monthNames = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  var startLabel = '', endLabel = '', duration = '';
  var startYear = 0, startMonth = 0;
  if (start_date) {
    var sp = start_date.split('-');
    startYear = parseInt(sp[0], 10);
    startMonth = parseInt(sp[1], 10) - 1;
    startLabel = monthNames[startMonth] + ' ' + startYear;
  }
  var endYear = 0, endMonth = 0;
  if (end_date) {
    var ep = end_date.split('-');
    endYear = parseInt(ep[0], 10);
    endMonth = parseInt(ep[1], 10) - 1;
    endLabel = monthNames[endMonth] + ' ' + endYear;
  } else {
    endLabel = 'по наст. вр.';
    var now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth();
  }
  if (startYear > 0) {
    var totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
    if (totalMonths > 0) {
      var years = Math.floor(totalMonths / 12);
      var rem = totalMonths % 12;
      var parts = [];
      if (years > 0) parts.push(years + ' л.');
      if (rem > 0) parts.push(rem + ' мес.');
      duration = parts.join(' ');
    }
  }
  return { startLabel: startLabel, endLabel: endLabel, duration: duration };
}

function renderCompanyLogo(company, logo_url) {
  if (logo_url) {
    return '<img src="' + escHtml(logo_url) + '" alt="' + escHtml(company || '') + '">';
  }
  var initials = String(company || '').slice(0, 2).toUpperCase() || '??';
  return '<div class="exp-logo-initials">' + escHtml(initials) + '</div>';
}

function _buildExpDescHtml(description) {
  if (!description) return '';
  if (description.length <= 160) {
    return '<div class="exp-desc">' + escHtml(description) + '</div>';
  }
  return '<div class="exp-desc">'
    + escHtml(description.slice(0, 160))
    + '<span class="exp-desc-hidden" style="display:none">' + escHtml(description.slice(160)) + '</span>'
    + '<a class="exp-desc-toggle" href="#">...ещё</a>'
    + '</div>';
}

function _adaptWorkExp(workExp) {
  if (!Array.isArray(workExp)) return [];
  return workExp.filter(function(e) { return e.company || e.role; }).map(function(e) {
    return {
      company: e.company || '',
      logo_url: null,
      position: e.role || '',
      employment_type: null,
      start_date: null,
      end_date: null,
      location: null,
      format: null,
      description: e.desc || '',
      skills: [],
      _period: e.period || ''
    };
  });
}

function _groupExpItems(items) {
  var groups = [];
  var current = null;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var co = item.company || '';
    if (current && current.company === co) {
      current.items.push(item);
    } else {
      current = { company: co, items: [item] };
      groups.push(current);
    }
  }
  return groups;
}

function _renderExpSkills(skills) {
  if (!Array.isArray(skills) || !skills.length) return '';
  return '<div class="exp-skills">' + skills.map(function(s) {
    return '<span class="exp-skill-chip">' + escHtml(String(s)) + '</span>';
  }).join('') + '</div>';
}

function _renderSingleExpBlock(item) {
  var datesStr = '';
  if (item.start_date) {
    var d = formatExperienceDates(item.start_date, item.end_date);
    datesStr = d.startLabel + ' — ' + d.endLabel + (d.duration ? ' \xb7 ' + d.duration : '');
  } else if (item._period) {
    datesStr = escHtml(item._period);
  }
  var metaParts = [];
  if (item.company) metaParts.push(escHtml(item.company));
  if (item.employment_type) metaParts.push(escHtml(item.employment_type));
  var locParts = [];
  if (item.location) locParts.push(escHtml(item.location));
  if (item.format) locParts.push(escHtml(item.format));
  return '<div class="exp-block">'
    + '<div class="exp-logo">' + renderCompanyLogo(item.company, item.logo_url) + '</div>'
    + '<div class="exp-content">'
    + (item.position ? '<div class="exp-position">' + escHtml(item.position) + '</div>' : '')
    + (metaParts.length ? '<div class="exp-meta">' + metaParts.join(' \xb7 ') + '</div>' : '')
    + (datesStr ? '<div class="exp-dates">' + datesStr + '</div>' : '')
    + (locParts.length ? '<div class="exp-location">' + locParts.join(' \xb7 ') + '</div>' : '')
    + _buildExpDescHtml(item.description)
    + _renderExpSkills(item.skills)
    + '</div>'
    + '</div>';
}

function _renderGroupedExpBlock(company, items) {
  var firstItem = items[0];
  var groupItemsHtml = items.map(function(item) {
    var datesStr = '';
    if (item.start_date) {
      var d = formatExperienceDates(item.start_date, item.end_date);
      datesStr = d.startLabel + ' — ' + d.endLabel + (d.duration ? ' \xb7 ' + d.duration : '');
    } else if (item._period) {
      datesStr = escHtml(item._period);
    }
    var locParts = [];
    if (item.location) locParts.push(escHtml(item.location));
    if (item.format) locParts.push(escHtml(item.format));
    return '<div class="exp-group-item">'
      + (item.position ? '<div class="exp-position">' + escHtml(item.position) + '</div>' : '')
      + (item.employment_type ? '<div class="exp-meta">' + escHtml(item.employment_type) + '</div>' : '')
      + (datesStr ? '<div class="exp-dates">' + datesStr + '</div>' : '')
      + (locParts.length ? '<div class="exp-location">' + locParts.join(' \xb7 ') + '</div>' : '')
      + _buildExpDescHtml(item.description)
      + _renderExpSkills(item.skills)
      + '</div>';
  }).join('');
  return '<div class="exp-block exp-block-grouped">'
    + '<div class="exp-logo">' + renderCompanyLogo(company, firstItem.logo_url) + '</div>'
    + '<div class="exp-content">'
    + '<div class="exp-company-header">' + escHtml(company) + '</div>'
    + '<div class="exp-group-items">' + groupItemsHtml + '</div>'
    + '</div>'
    + '</div>';
}

function renderExperience(experience) {
  var el = document.getElementById('profileExperience');
  if (!el) return;
  var items = Array.isArray(experience)
    ? experience.filter(function(e) { return e.company || e.position; })
    : [];
  if (!items.length) {
    el.style.display = 'none';
    return;
  }
  var html = '<h3>Опыт работы</h3>';
  var groups = _groupExpItems(items);
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    html += g.items.length === 1
      ? _renderSingleExpBlock(g.items[0])
      : _renderGroupedExpBlock(g.company, g.items);
  }
  el.innerHTML = html;
  el.style.display = 'block';
  var toggles = el.querySelectorAll('.exp-desc-toggle');
  for (var j = 0; j < toggles.length; j++) {
    (function(toggle) {
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        var hidden = toggle.parentNode.querySelector('.exp-desc-hidden');
        if (hidden) hidden.style.display = '';
        toggle.style.display = 'none';
      });
    })(toggles[j]);
  }
}

function openPublicProfileByPublicId(publicId) {
  var fromScreenKey = _getActiveScreenKey();
  apiGetPublicProfile(publicId).then(function(profile){
    if (!profile) throw new Error('Not found');
    var u = Object.assign({}, profile, { id: profile.id || publicId, role: profile.role || 'candidate' });
    _userCache[String(u.id)] = u;
    openUserProfile(u, fromScreenKey);
  }).catch(function(){
    showToast('Профиль не найден', 'error');
    show(_getProfileReturnScreen());
  });
}

function getPublicProfileIdFromLocation() {
  var hashParams;
  var queryParams;
  var pathMatch;
  try {
    hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    queryParams = new URLSearchParams(window.location.search);
    pathMatch = window.location.pathname.match(/^\/p\/(LOMO-[A-Z0-9]{8})\/?$/i);
    return hashParams.get('profile') || queryParams.get('profile') || (pathMatch ? pathMatch[1].toUpperCase() : '');
  } catch (error) {
    pathMatch = window.location.pathname.match(/^\/p\/(LOMO-[A-Z0-9]{8})\/?$/i);
    return pathMatch ? pathMatch[1].toUpperCase() : '';
  }
}

function initPublicProfileLocationRoute() {
  var publicProfileId = getPublicProfileIdFromLocation();
  if (!publicProfileId || window.LOMO_PUBLIC_PROFILE_ROUTE_OPENED) return;
  window.LOMO_PUBLIC_PROFILE_ROUTE_OPENED = true;
  openPublicProfileByPublicId(publicProfileId);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicProfileLocationRoute);
} else {
  initPublicProfileLocationRoute();
}
