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
    var _profileFromScreen = 'auth';
    var _activePublicProfileUserId = '';

    function _openProfileById(uid){
      var u = _userCache[uid];
      if(u) openUserProfile(u);
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
      var avatarBg = isEmployer ? 'background:linear-gradient(135deg,#0f4c5c,#2a7a8a)' : 'background:linear-gradient(135deg,#2a7a8a,#38b2ac)';
      var avatarRadius = isEmployer ? '14px' : '50%';
      var profileAvatarSrc = safeImageUrl(u.avatar_url);
      var avatarHtml = profileAvatarSrc
        ? '<img src="'+escHtml(profileAvatarSrc)+'" style="width:72px;height:72px;border-radius:'+avatarRadius+';object-fit:cover;box-shadow:0 2px 10px rgba(0,0,0,.15);">'
        : '<div style="width:72px;height:72px;border-radius:'+avatarRadius+';'+avatarBg+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.15);">'+initials+'</div>';
      var verLabels = {edu_status:'Образование',work_status:'Опыт работы',course_status:'Курсы',pass_status:'Паспорт',cv_status:'CV'};
      var verifiedChips = Object.keys(verLabels).filter(function(k){return u[k]==='verified';}).map(function(k){return '<span style="font-size:12px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:3px 10px;border-radius:20px;">✓ '+verLabels[k]+'</span>';}).join('');
      var pendingChips = Object.keys(verLabels).filter(function(k){return u[k]==='pending';}).map(function(k){return '<span style="font-size:12px;background:#fffbeb;color:#d97706;border:1px solid #fde68a;padding:3px 10px;border-radius:20px;">⏳ '+verLabels[k]+'</span>';}).join('');
      var infoRows = '';
      if(!isEmployer){
        if(u.edu_place) infoRows += '<div style="font-size:13px;color:#555;margin-bottom:4px;">🎓 '+escHtml(u.edu_place+(u.edu_year?' · '+u.edu_year:''))+'</div>';
        if(u.vacancies) infoRows += '<div style="font-size:13px;color:#2a7a8a;margin-bottom:4px;">🔍 Ищу: '+escHtml(u.vacancies)+'</div>';
      } else {
        if(u.industry) infoRows += '<div style="font-size:13px;color:#555;margin-bottom:4px;">🏭 '+escHtml(u.industry)+'</div>';
        var publicWebsite = safeHttpUrl(u.website);
        if(publicWebsite) infoRows += '<div style="font-size:13px;margin-bottom:4px;">🌐 <a href="'+escHtml(publicWebsite)+'" target="_blank" rel="noopener noreferrer" style="color:#2a7a8a;">'+escHtml(u.website)+'</a></div>';
        if(u.needed) infoRows += '<div style="font-size:13px;color:#3b82f6;margin-bottom:4px;">👥 Ищем: '+escHtml(u.needed)+'</div>';
        if(u.active_projects) infoRows += '<div style="font-size:13px;color:#555;margin-bottom:4px;">📌 Проекты: '+escHtml(u.active_projects.replace(/;/g,', '))+'</div>';
      }
      if(u.location) infoRows += '<div style="font-size:13px;color:#888;margin-bottom:4px;">📍 '+escHtml(u.location)+'</div>';
      // Admin sees files
      var verCount = [u.edu_status,u.work_status,u.course_status,u.pass_status,u.cv_status].filter(function(s){return s==='verified';}).length;
      var content = document.getElementById('pubProfileContent');
      if(!content){ return; }
      var canEmployerRequest = state.roleReg === 'EMPLOYER' && !isEmployer && String(u.id) !== String(state.userId);
      var publicCvHtml = (!isEmployer && u.public_cv_doc_id)
        ? '<div class="pubProfileSection"><div class="pubProfileSTitle">Публичный CV</div><button type="button" class="pillBtn" data-open-doc="' + escHtml(u.public_cv_doc_id) + '" data-file-name="' + escHtml(u.public_cv_file_name || 'CV') + '">Открыть CV</button></div>'
        : '';
      var employerAccessHtml = canEmployerRequest
        ? '<div id="pubAccessPanel" class="pubProfileSection"><div class="miniHint">Загрузка доступа...</div></div>'
        : '';

      var adminFilesHtml = '';
      if(state.roleReg === 'ADMIN'){
        adminFilesHtml = '<div class="pubProfileSection">'
          + '<div class="pubProfileSTitle">Файлы пользователя</div>'
          + '<button class="js-load-files" data-uid="'+u.id+'" style="padding:8px 16px;border-radius:12px;border:1.5px solid #2a7a8a;color:#2a7a8a;background:#f0fdfa;cursor:pointer;font-size:13px;font-weight:600;position:relative;z-index:10;">📂 Просмотреть файлы</button>'
          + '<div id="userFileslist" style="margin-top:10px;"></div>'
          + '</div>';
      }

      content.innerHTML =
        '<div class="pubProfileCard">'
          + '<div class="pubProfileHead">'
            + avatarHtml
            + '<div style="flex:1;min-width:0;">'
              + '<div style="font-size:22px;font-weight:800;color:#1a1a1a;margin-bottom:4px;">'+name+'</div>'
              + '<span style="font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;'+(isEmployer?'background:#f0fdfa;color:#2a7a8a;border:1px solid #d1fae5;':'background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;')+'">'+(isEmployer?'🏢 Работодатель':'👤 Кандидат')+'</span>'
              + (verCount > 0 ? ' <span class="scVerBadge">✓ LOMO '+verCount+'</span>' : '')
            + '</div>'
          + '</div>'
          + '<div class="pubProfileBody">'
            + (infoRows ? '<div style="margin-bottom:14px;">'+infoRows+'</div>' : '')
            + (u.about ? '<div class="pubProfileSection"><div class="pubProfileSTitle">О себе</div><div style="font-size:14px;color:#444;line-height:1.6;">'+escHtml(u.about)+'</div></div>' : '')
            + ((verifiedChips||pendingChips) ? '<div class="pubProfileSection"><div class="pubProfileSTitle">Верификация документов</div><div>'+verifiedChips+pendingChips+'</div></div>' : '')
            + publicCvHtml
            + employerAccessHtml
            + adminFilesHtml
          + '</div>'
        + '</div>';

      show('publicProfile');
      if(canEmployerRequest) loadEmployerAccessPanel(u.id);
    }

    function closeUserProfile(){
      closePublicProfile();
    }

    function loadUserFiles(userId){
      var el = document.getElementById('userFileslist');
      if(!el) return;
      el.innerHTML = '<div style="font-size:12px;color:#888;">Загрузка...</div>';
      apiFetch('/admin/users/'+userId+'/files').then(function(files){
        if(!files||!files.length){ el.innerHTML='<div style="font-size:12px;color:#aaa;">Файлов нет</div>'; return; }
        el.innerHTML = files.map(function(f){
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
            + '<span style="font-size:12px;color:#555;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHtml(f.file_name||'файл')+'</span>'
            + '<button type="button" class="miniLink" data-open-doc="'+escHtml(f.id)+'" data-file-name="'+escHtml(f.file_name||'файл')+'">Открыть</button>'
            + '</div>';
        }).join('');
      }).catch(function(e){ el.innerHTML='<div style="font-size:12px;color:#991b1b;">'+escHtml(safeErrorText(e))+'</div>'; });
    }

