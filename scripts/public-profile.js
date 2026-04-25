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

    function closePublicProfile(){
      show(_profileFromScreen);
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

    function openUserProfile(u){
      var activeKey = Object.keys(screens).find(function(k){ return screens[k] && screens[k].classList.contains('active'); });
      if(activeKey) _profileFromScreen = activeKey;
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
        var workExpArr = Array.isArray(u.work_exp) ? u.work_exp : [];
        if (workExpArr.length) {
          var workExpLines = workExpArr.map(function(e) {
            return [e.company, e.role, e.period].filter(Boolean).join(' · ');
          }).filter(Boolean).join('\n');
          if (workExpLines) {
            candidateSections += '<div class="pubProfileSection"><div class="pubProfileSTitle">Опыт работы</div><div class="pubProfileText" style="white-space:pre-line">'+escHtml(workExpLines)+'</div></div>';
          }
        } else if (typeof u.work_exp === 'string' && u.work_exp) {
          candidateSections += '<div class="pubProfileSection"><div class="pubProfileSTitle">Опыт работы</div><div class="pubProfileText">'+escHtml(u.work_exp)+'</div></div>';
        }
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
      var hasContent = subtitle || skills.length || u.about || u.vacancies || u.work_exp || u.needed || u.active_projects;
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
    }

    function closeUserProfile(){
      if (typeof resetPageSeo === 'function') resetPageSeo();
      closePublicProfile();
    }

    function loadUserFiles(userId){
      var el = document.getElementById('userFileslist');
      if(!el) return;
      el.innerHTML = '<div class="pubProfileFilesState">Загрузка...</div>';
      apiFetch('/admin/users/'+userId+'/files').then(function(files){
        if(!files||!files.length){ el.innerHTML='<div class="pubProfileFilesState empty">Файлов нет</div>'; return; }
        el.innerHTML = files.map(function(f){
          return '<div class="pubProfileFileRow">'
            + '<span class="pubProfileFileName">'+escHtml(f.file_name||'файл')+'</span>'
            + '<button type="button" class="miniLink" data-open-doc="'+escHtml(f.id)+'" data-file-name="'+escHtml(f.file_name||'файл')+'">Открыть</button>'
            + '</div>';
        }).join('');
      }).catch(function(e){ el.innerHTML='<div class="pubProfileFilesState error">'+escHtml(safeErrorText(e))+'</div>'; });
    }

function openPublicProfileByPublicId(publicId) {
  apiGetPublicProfile(publicId).then(function(profile){
    if (!profile) throw new Error('Not found');
    var u = Object.assign({}, profile, { id: profile.id || publicId, role: profile.role || 'candidate' });
    _userCache[String(u.id)] = u;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    openUserProfile(u);
  }).catch(function(){
    showToast('Профиль не найден', 'error');
    show('landing');
  });
}
