    function escHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function safeErrorText(err){ return (err && err.message) ? String(err.message) : String(err || 'Неизвестная ошибка'); }
    function safeHttpUrl(value){
      var src = String(value || '').trim();
      if(!src) return '';
      try{
        var parsed = new URL(src, location.origin);
        var isLocal = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
        if(parsed.protocol === 'https:' || isLocal) return parsed.href;
      }catch(e){}
      return '';
    }
    function safeImageUrl(value){
      var src = String(value || '').trim();
      if(!src) return '';
      if(/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(src)) return src;
      return safeHttpUrl(src);
    }

    // Track where we came from to go back
    var _profileFromScreen = 'landing';
    var _activePublicProfileUserId = '';

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

    function openUserProfile(u){
      // Remember which screen we came from
      var activeKey = Object.keys(screens).find(function(k){ return screens[k] && screens[k].classList.contains('active'); });
      if(activeKey) _profileFromScreen = activeKey;
      _activePublicProfileUserId = u.id || '';

      var isEmployer = u.role === 'employer';
      var name = escHtml(u.full_name || (isEmployer ? u.company : '') || u.email || '—');
      var initials = name.replace(/&[^;]+;/g,'').split(' ').map(function(s){return s[0]||'';}).join('').slice(0,2).toUpperCase()||'?';
      var avatarRoleClass = isEmployer ? ' employer' : ' candidate';
      var profileAvatarSrc = safeImageUrl(u.avatar_url);
      var avatarHtml = profileAvatarSrc
        ? '<img src="'+escHtml(profileAvatarSrc)+'" class="pubProfileAvatarImg'+avatarRoleClass+'">'
        : '<div class="pubProfileAvatarFallback'+avatarRoleClass+'">'+initials+'</div>';
      var verLabels = {edu_status:'Образование',work_status:'Опыт работы',course_status:'Курсы',pass_status:'Паспорт',cv_status:'CV'};
      var verifiedChips = Object.keys(verLabels).filter(function(k){return u[k]==='verified';}).map(function(k){return '<span class="pubVerChip">✓ '+verLabels[k]+'</span>';}).join('');
      var pendingChips = Object.keys(verLabels).filter(function(k){return u[k]==='pending';}).map(function(k){return '<span class="pubVerChip pending">⏳ '+verLabels[k]+'</span>';}).join('');
      var infoRows = '';
      if(!isEmployer){
        if(u.edu_place) infoRows += '<div class="pubInfoRow">🎓 '+escHtml(u.edu_place+(u.edu_year?' · '+u.edu_year:''))+'</div>';
        if(u.vacancies) infoRows += '<div class="pubInfoRow teal">🔍 Ищу: '+escHtml(u.vacancies)+'</div>';
      } else {
        if(u.industry) infoRows += '<div class="pubInfoRow">🏭 '+escHtml(u.industry)+'</div>';
        var publicWebsite = safeHttpUrl(u.website);
        if(publicWebsite) infoRows += '<div class="pubInfoRow">🌐 <a href="'+escHtml(publicWebsite)+'" target="_blank" rel="noopener noreferrer" class="pubInfoLink">'+escHtml(u.website)+'</a></div>';
        if(u.needed) infoRows += '<div class="pubInfoRow blue">👥 Ищем: '+escHtml(u.needed)+'</div>';
        if(u.active_projects) infoRows += '<div class="pubInfoRow">📌 Проекты: '+escHtml(u.active_projects.replace(/;/g,', '))+'</div>';
      }
      if(u.location) infoRows += '<div class="pubInfoRow muted">📍 '+escHtml(u.location)+'</div>';
      if(Number(u.connections_count || 0) > 0) infoRows += '<div class="pubInfoRow muted">🤝 Контактов в LOMO: '+escHtml(u.connections_count)+'</div>';
      // Admin sees files
      var verCount = [u.edu_status,u.work_status,u.course_status,u.pass_status,u.cv_status].filter(function(s){return s==='verified';}).length;
      var content = document.getElementById('pubProfileContent');
      if(!content){ return; }
      var canEmployerRequest = state.roleReg === 'EMPLOYER' && !isEmployer && String(u.id) !== String(state.userId);
      var canConnect = !!getToken() && state.roleReg !== 'ADMIN' && String(u.id) !== String(state.userId);
      var publicCvHtml = (!isEmployer && u.public_cv_doc_id)
        ? '<div class="pubProfileSection"><div class="pubProfileSTitle">Публичный CV</div><button type="button" class="pillBtn" data-open-doc="' + escHtml(u.public_cv_doc_id) + '" data-file-name="' + escHtml(u.public_cv_file_name || 'CV') + '">Открыть CV</button></div>'
        : '';
      var connectionPanelHtml = canConnect
        ? '<div id="pubConnectionPanel" class="pubProfileSection"><div class="miniHint">Загрузка контактов...</div></div>'
        : '';
      var employerAccessHtml = canEmployerRequest
        ? '<div id="pubAccessPanel" class="pubProfileSection"><div class="miniHint">Загрузка доступа...</div></div>'
        : '';

      var adminFilesHtml = '';
      if(state.roleReg === 'ADMIN'){
        adminFilesHtml = '<div class="pubProfileSection">'
          + '<div class="pubProfileSTitle">Файлы пользователя</div>'
          + '<button class="js-load-files pubProfileAdminLoadBtn" data-uid="'+u.id+'">📂 Просмотреть файлы</button>'
          + '<div id="userFileslist" class="pubProfileFiles"></div>'
          + '</div>';
      }

      content.innerHTML =
        '<div class="pubProfileCard">'
          + '<div class="pubProfileHead">'
            + avatarHtml
            + '<div class="pubProfileHeadInfo">'
              + '<div class="pubProfileName">'+name+'</div>'
              + '<span class="pubProfileRoleTag '+(isEmployer?'employer':'candidate')+'">'+(isEmployer?'🏢 Работодатель':'👤 Кандидат')+'</span>'
              + (verCount > 0 ? ' <span class="scVerBadge">✓ LOMO '+verCount+'</span>' : '')
            + '</div>'
          + '</div>'
          + '<div class="pubProfileBody">'
            + (infoRows ? '<div class="pubProfileIntro">'+infoRows+'</div>' : '')
            + (u.about ? '<div class="pubProfileSection"><div class="pubProfileSTitle">О себе</div><div class="pubProfileText">'+escHtml(u.about)+'</div></div>' : '')
            + ((verifiedChips||pendingChips) ? '<div class="pubProfileSection"><div class="pubProfileSTitle">Верификация документов</div><div>'+verifiedChips+pendingChips+'</div></div>' : '')
            + publicCvHtml
            + connectionPanelHtml
            + employerAccessHtml
            + adminFilesHtml
          + '</div>'
        + '</div>';

      _userCache[String(u.id)] = Object.assign({}, _userCache[String(u.id)] || {}, {
        id: u.id,
        role: u.role,
        public_id: u.public_id,
        full_name: u.full_name,
        company: u.company,
        avatar_url: u.avatar_url,
        location: u.location,
        industry: u.industry,
        current_job: u.current_job,
        job_title: u.job_title,
      });

      show('publicProfile');
      if(canConnect) loadPublicConnectionPanel(u.id);
      if(canEmployerRequest) loadEmployerAccessPanel(u.id);
    }

    function closeUserProfile(){
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
