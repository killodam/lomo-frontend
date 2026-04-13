
    // Consents
    function updateConsentRoleText(){
      const el = document.getElementById('consentRoleText');
      if(!el) return;
      const role = (state.roleReg || 'EMPLOYEE');
      el.textContent = (role === 'EMPLOYER')
        ? 'Я обязуюсь использовать данные кандидатов только для найма и не передавать третьим лицам'
        : 'Я даю согласие на верификацию достижений и обработку подтверждающих документов';
    }

    function clearConsentError(){
      const box = document.getElementById('consentBox');
      const err = document.getElementById('consentError');
      if(box) box.classList.remove('error');
      if(err) err.style.display = 'none';
    }

    function consentsOk(){
      const a = document.getElementById('consentTerms');
      const b = document.getElementById('consentPd');
      const c = document.getElementById('consentRole');
      return !!(a && b && c && a.checked && b.checked && c.checked);
    }

    function updateRegNextState(){
      const btn = document.getElementById('btnRegNext');
      if(!btn) return;
      const ok = consentsOk();
      btn.disabled = !ok;
      if(ok) clearConsentError();
    }

    function showConsentError(){
      const box = document.getElementById('consentBox');
      const err = document.getElementById('consentError');
      if(box) box.classList.add('error');
      if(err) err.style.display = 'block';
    }

    function resetConsents(){
      const a = document.getElementById('consentTerms');
      const b = document.getElementById('consentPd');
      const c = document.getElementById('consentRole');
      if(a) a.checked = false;
      if(b) b.checked = false;
      if(c) c.checked = false;
      clearConsentError();
      updateRegNextState();
    }

    function resetLogo(){ logoWrap.classList.remove('animUp'); }

    // Password strength
    const regPasswordEl = document.getElementById('regPassword');
    if(regPasswordEl){
      regPasswordEl.addEventListener('input', () => {
        const val = regPasswordEl.value;
        const fill = document.getElementById('strengthFill');
        const label = document.getElementById('strengthLabel');
        const confirmErr = document.getElementById('regPasswordConfirmError');
        if(confirmErr) confirmErr.classList.add('hidden');
        if(!fill || !label) return;
        if(!val){ fill.style.width='0'; fill.style.background=''; label.textContent=''; return; }
        let score = 0;
        if(val.length >= 8) score++;
        if(/\d/.test(val)) score++;
        if(/[^a-zA-Z0-9]/.test(val)) score++;
        if(score === 1){ fill.style.width='33%'; fill.style.background='#ef4444'; label.textContent='Слабый'; label.style.color='#ef4444'; }
        else if(score === 2){ fill.style.width='66%'; fill.style.background='#f59e0b'; label.textContent='Средний'; label.style.color='#f59e0b'; }
        else if(score === 3){ fill.style.width='100%'; fill.style.background='#22c55e'; label.textContent='Надёжный'; label.style.color='#22c55e'; }
      });
    }
    const regPasswordConfirmEl = document.getElementById('regPasswordConfirm');
    if(regPasswordConfirmEl){
      regPasswordConfirmEl.addEventListener('input', () => {
        const confirmErr = document.getElementById('regPasswordConfirmError');
        if(confirmErr) confirmErr.classList.add('hidden');
      });
    }

    function syncPasswordToggle(button, input){
      if(!button || !input) return;
      const visible = input.type === 'text';
      button.textContent = visible ? 'Скрыть' : 'Показать';
      button.setAttribute('aria-pressed', visible ? 'true' : 'false');
      button.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
    }

    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      const input = document.getElementById(button.getAttribute('data-password-toggle'));
      if(!input) return;
      syncPasswordToggle(button, input);
      button.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        syncPasswordToggle(button, input);
        try { input.focus({ preventScroll: true }); } catch(e) { input.focus(); }
        const len = input.value.length;
        try { input.setSelectionRange(len, len); } catch(e) {}
      });
    });

    // Inline validation
    function wireEmailValidation(inputId, wrapId, errorId, options = {}){
      const inp = document.getElementById(inputId);
      const wrap = document.getElementById(wrapId);
      const err = document.getElementById(errorId);
      if(!inp || !wrap || !err) return;
      const allowLogin = !!options.allowLogin;
      const emailRe = /.+@.+\..+/;
      const loginRe = /^[a-z0-9._-]{3,32}$/i;
      inp.addEventListener('blur', () => {
        const val = inp.value.trim();
        const isValid = !val || emailRe.test(val) || (allowLogin && loginRe.test(val));
        if(!isValid){
          wrap.classList.add('inputError');
          err.classList.remove('hidden');
        }
      });
      inp.addEventListener('focus', () => {
        wrap.classList.remove('inputError');
        err.classList.add('hidden');
      });
    }
    wireEmailValidation('regEmail', 'sqInputRegEmail', 'regEmailError');
    wireEmailValidation('loginEmail', 'sqInputLoginEmail', 'loginEmailError', {allowLogin: true});

    // Render public profiles
    function applyChip(elId, status){
      const el = document.getElementById(elId);
      if(!el) return;
      const s = (status || '').toLowerCase();
      el.classList.remove('warn','bad','ok','ghost');
      if(s.includes('подтверж')){ el.classList.add('ok'); el.textContent = 'подтверждено'; }
      else if(s.includes('рассмотр') || s.includes('провер')){ el.classList.add('warn'); el.textContent = 'на рассмотрении'; }
      else if(s.includes('отклон')){ el.classList.add('bad'); el.textContent = 'отклонено'; }
      else if(s.includes('не загруж')){ el.classList.add('ghost'); el.textContent = 'не загружено'; }
      else { el.classList.add('ghost'); el.textContent = status || '—'; }
    }

    function renderRecruiterPublic(){
      const p = state.employer;
      setText('rpCompanyName', p.company || 'Название компании');
      setText('rpName', (p.fullName || '—').trim());
      setText('rpTitle', (p.title || 'HR Manager').trim());
      setText('rpIndustry', p.industry || 'Сфера деятельности');
      setText('rpCorpEmail', p.corpEmail || p.email || state.email || '—');
      setText('rpAbout', p.about || '—');
      setText('rpFoundedYear', p.foundedYear || '—');
      setText('rpLocation', p.location || '—');
      setText('rpWebsite', p.website || '—');
      const productsEl = document.getElementById('rpProducts');
      const productsTitleEl = document.getElementById('rpProductsTitle');
      if(productsEl && productsTitleEl){
        if(p.products){ productsEl.textContent = p.products; productsEl.style.display=''; productsTitleEl.style.display=''; }
        else { productsEl.style.display='none'; productsTitleEl.style.display='none'; }
      }
      const projectsList = document.getElementById('rpProjectsList');
      const projectsTitle = document.getElementById('rpProjectsTitle');
      if(projectsList){
        projectsList.innerHTML = '';
        const projects = (p.activeProjects||'').split(';').map(s=>s.trim()).filter(Boolean);
        if(projects.length){
          if(projectsTitle) projectsTitle.style.display='';
          projects.forEach(proj => {
            const el = document.createElement('div');
            el.className = 'projectItem';
            el.innerHTML = '<div class="projectDot"></div>' + escapeHtml(proj);
            projectsList.appendChild(el);
          });
        } else { if(projectsTitle) projectsTitle.style.display='none'; }
      }
      const tagsEl = document.getElementById('rpNeededTags');
      const tagsTitle = document.getElementById('rpNeededTitle');
      if(tagsEl){
        tagsEl.innerHTML = '';
        const tags = (p.neededSpecialists||'').split(',').map(s=>s.trim()).filter(Boolean);
        if(tags.length){
          if(tagsTitle) tagsTitle.style.display='';
          tags.forEach(tag => {
            const el = document.createElement('span');
            el.className = 'tag';
            el.textContent = tag;
            tagsEl.appendChild(el);
          });
        } else { if(tagsTitle) tagsTitle.style.display='none'; }
      }
      applyChip('rpCompanyDocChip', p.proofs?.companyDoc?.status);
      setAvatar('rpAvatarImg', p.avatarDataUrl);
    }

    function renderEmployeePublic(){
      const p = state.employee;
      setText('epName', (p.fullName || 'Имя Фамилия').trim());
      setText('epCity', (p.city || '').trim());
      setText('epEduPlace', (p.eduPlace || '—').trim() || '—');
      setText('epEduYear', (p.eduYear || '—').trim() || '—');
      setText('epVacancies', (p.vacancies || '—').trim() || '—');
      setText('epEmail', (state.email || p.email || 'email@example.com').trim());
      setText('epTg', p.telegram ? (p.telegram.startsWith('@') ? p.telegram : '@' + p.telegram) : '—');
      const phoneEl = document.getElementById('epPhone');
      if(phoneEl){ if(p.phone){ phoneEl.textContent = p.phone; phoneEl.style.display=''; } else { phoneEl.style.display='none'; } }
      const aboutSec = document.getElementById('epAboutSection');
      if(aboutSec){ aboutSec.style.display = p.about ? '' : 'none'; }
      const aboutEl = document.getElementById('epAbout');
      if(aboutEl && p.about) aboutEl.textContent = p.about;
      applyChip('epEduStatusChip', p.proofs?.education?.status);
      applyChip('epWorkStatusChip', p.proofs?.work?.status);
      applyChip('epCourseStatusChip', p.proofs?.courses?.status);
      applyChip('epPassStatusChip', p.proofs?.passport?.status);
const list = document.getElementById('epPortfolioList');
      if(list){
        list.innerHTML = '';
        if(p.portfolio && p.portfolio.length){
          p.portfolio.forEach((it, idx) => {
            const row = document.createElement('div');
            row.className = 'achRow';
            row.innerHTML = `<div><div class="achTitle">${escapeHtml(it.name || ('Файл ' + (idx+1)))}</div><div class="achMeta">Публичный файл · можно скачать</div></div><button type="button" class="miniLink" data-download="employee:portfolio:${idx}">Скачать</button>`;
            list.appendChild(row);
          });
        } else {
          const hint = document.createElement('div');
          hint.className = 'miniHint';
          hint.textContent = '—';
          list.appendChild(hint);
        }
      }
      setText('epCvHint', p.proofs?.cv?.fileName ? ('Файл: ' + p.proofs.cv.fileName) : '—');
      setAvatar('epAvatarImg', p.avatarDataUrl);
      refreshEmployeeCVButton();

      // Show reject reasons
      const rejectMap = {edu:'education', work:'work', course:'courses', pass:'passport'};
      Object.entries(rejectMap).forEach(([prefix, key]) => {
        const el = document.getElementById('ep'+prefix.charAt(0).toUpperCase()+prefix.slice(1)+'Reject');
        if(!el) return;
        const proof = p.proofs?.[key];
        if(proof?.rejectReason && proof?.status === 'отклонено'){
          el.innerHTML = '<div class="rejectReasonLabel">Причина отказа</div>' + escapeHtml(proof.rejectReason);
          el.classList.remove('hidden');
        } else { el.classList.add('hidden'); }
      });

      // CV visibility based on privacy toggle
      const cvHintEl = document.getElementById('epCvHint');
      const cvDownBtn = document.getElementById('btnDownloadCV');
      if(!p.cvPublic){
        if(cvHintEl) cvHintEl.textContent = 'Скрыто · доступ по запросу';
        if(cvDownBtn) cvDownBtn.classList.add('hidden');
      } else if(cvDownBtn && (p.proofs?.cv?.docId || p.proofs?.cv?.url)) {
        cvDownBtn.classList.remove('hidden');
      }
    }

    function escapeHtml(s){
      return String(s||'').replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
    }
    function setText(id, value){
      const el = document.getElementById(id);
      if(el) el.textContent = value;
    }
    function setAvatar(imgId, dataUrl){
      const img = document.getElementById(imgId);
      if(!img) return;
      if(dataUrl){ img.src = dataUrl; img.style.display = 'block'; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    }

    function normalizeTg(tg){
      if(!tg) return '';
      let t = tg.trim();
      if(!t) return '';
      if(t.startsWith('@')) t = t.slice(1);
      t = t.replace(/^https?:\/\/(www\.)?t\.me\//i,'');
      return t;
    }

    function openEmployerContact(){
      const tg = normalizeTg(state.employer.telegram);
      if(tg){ window.open('https://t.me/' + encodeURIComponent(tg), '_blank'); return; }
      const email = (state.employer.corpEmail || state.employer.email || state.email || '').trim();
      if(email){ window.location.href = 'mailto:' + email; return; }
      const phone = (state.employer.phone || '').trim();
      if(phone){ window.location.href = 'tel:' + phone.replace(/\s/g,''); return; }
      showToast('Добавьте Telegram, корпоративную почту или телефон в профиле компании.');
    }

    function publicProfileUrl(){
      return publicProfileUrlForId(state.publicId || 'LOMO-00000000');
    }

    async function copyToClipboard(text){
      try{
        await navigator.clipboard.writeText(text);
        showToast('Ссылка скопирована');
      }catch(e){
        prompt('Скопируй ссылку:', text);
      }
    }

    function openMail(){
      const email = (state.email || '').trim();
      if(!email){ showToast('Почта не указана'); return; }
      window.location.href = 'mailto:' + email;
    }

    async function openSecureDocument(docId, fileName){
      if(!docId) throw new Error('Файл недоступен');
      const popup = window.open('', '_blank');
      try{
        const blob = await apiFetchBlob('/files/' + encodeURIComponent(docId));
        const url = URL.createObjectURL(blob);
        if(popup) popup.location = url;
        else window.open(url, '_blank');
        setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
      } catch(err){
        if(popup) popup.close();
        throw err;
      }
    }

    async function downloadSecureDocument(docId, fileName){
      if(!docId) throw new Error('Файл недоступен');
      const blob = await apiFetchBlob('/files/' + encodeURIComponent(docId));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 1000);
    }

    async function downloadProof(proof, fallbackName){
      if(proof?.url){
        const a = document.createElement('a');
        a.href = proof.url;
        a.download = proof.fileName || fallbackName || 'document';
        document.body.appendChild(a); a.click(); a.remove();
        return;
      }
      if(proof?.docId){
        return downloadSecureDocument(proof.docId, proof.fileName || fallbackName || 'document');
      }
      throw new Error('Файл не загружен');
    }

    async function downloadEmployeeCV(){
      try{
        await downloadProof(state.employee?.proofs?.cv, 'CV');
      } catch(err){
        showToast(err.message);
      }
    }

    function refreshEmployeeCVButton(){
      const btn = document.getElementById('btnDownloadCV');
      if(!btn) return;
      if(state.employee?.proofs?.cv?.url || state.employee?.proofs?.cv?.docId){ btn.classList.remove('hidden'); } else { btn.classList.add('hidden'); }
    }

    async function downloadRecruiterCV(){
      try{
        await downloadProof(state.employer?.proofs?.cv, 'CV');
      } catch(err){
        showToast(err.message);
      }
    }

    function refreshRecruiterCVButton(){ }

    // Hydrate forms
    function hydrateEmployerForm(){
      const p = state.employer;
      setVal('mpEFullName', p.fullName);
      setVal('mpETitle', p.title);
      setVal('mpECompany', p.company);
      setVal('mpEFoundedYear', p.foundedYear);
      setVal('mpELocation', p.location);
      setVal('mpEIndustry', p.industry);
      setVal('mpEProducts', p.products);
      setVal('mpEWebsite', p.website);
      setVal('mpEAbout', p.about);
      setVal('mpEProjects', p.activeProjects);
      setVal('mpENeeded', p.neededSpecialists);
      setVal('mpEEmail', state.email || p.email);
      setVal('mpECorpEmail', p.corpEmail);
      setVal('mpEPhone', p.phone);
      setVal('mpETelegram', p.telegram);
      setAvatar('mpEAvatarImg', p.avatarDataUrl);
      setText('mpEAvatarHint', p.avatarDataUrl ? 'Логотип выбран' : 'Логотип не выбран');
      setStatusTag('companyDocStatusE', p.proofs?.companyDoc?.status || 'не загружено');
      setText('companyDocHintE', p.proofs?.companyDoc?.fileName ? ('Прикреплено: ' + p.proofs.companyDoc.fileName) : 'Файл не выбран');
    }

    function hydrateEmployeeForm(){
      const p = state.employee;
      setVal('mpCFullName', p.fullName);
      setVal('mpCCity', p.city);
      setVal('mpCPhone', p.phone);
      setVal('mpCAbout', p.about);
      setVal('mpCEduPlace', p.eduPlace);
      setVal('mpCEduYear', p.eduYear);
      setVal('mpCVacancies', p.vacancies);
      setVal('mpCCurrentJob', p.current_job);
      setVal('mpCJobTitle', p.job_title);
      var workList = document.getElementById('workExpList');
      if(workList) workList.innerHTML = '';
      if(p.work_exp&&p.work_exp.length) setTimeout(function(){loadWorkExpData(p.work_exp);},50);
      setVal('mpCEmail', state.email || p.email);
      setVal('mpCTelegram', p.telegram);
      setAvatar('mpCAvatarImg', p.avatarDataUrl);
      setText('mpCAvatarHint', p.avatarDataUrl ? 'Фото выбрано' : 'Фото не выбрано');
      setStatusTag('cvStatusC',     p.proofs?.cv?.status        || 'не загружено');
      setText('cvHintC',            p.proofs?.cv?.fileName       ? ('Прикреплено: ' + p.proofs.cv.fileName)        : 'Файл не выбран');
      setStatusTag('eduStatusC',    p.proofs?.education?.status  || 'не загружено');
      setText('eduHintC',           p.proofs?.education?.fileName ? ('Прикреплено: ' + p.proofs.education.fileName) : 'Файл не выбран');
      setStatusTag('workStatusC',   p.proofs?.work?.status       || 'не загружено');
      setText('workHintC',          p.proofs?.work?.fileName      ? ('Прикреплено: ' + p.proofs.work.fileName)      : 'Файл не выбран');
      setStatusTag('courseStatusC', p.proofs?.courses?.status    || 'не загружено');
      setText('courseHintC',        p.proofs?.courses?.fileName   ? ('Прикреплено: ' + p.proofs.courses.fileName)   : 'Файл не выбран');
      setStatusTag('passStatusC',   p.proofs?.passport?.status   || 'не загружено');
      setText('passHintC',          p.proofs?.passport?.fileName  ? ('Прикреплено: ' + p.proofs.passport.fileName)  : 'Файл не выбран');
      const has = p.portfolio && p.portfolio.length;
      setText('portHintC', has ? ('Прикреплено: ' + p.portfolio.length + ' файл(ов)') : 'Файлы не выбраны');
      setStatusTag('portStatusC', has ? 'на рассмотрении' : 'не загружено');
    }

    function setVal(id, value){
      const el = document.getElementById(id);
      if(el) el.value = value || '';
    }

    function setStatusTag(id, status){
      const el = document.getElementById(id);
      if(!el) return;
      el.textContent = status;
      el.classList.remove('ok','warn','bad','ghost');
      const s = (status||'').toLowerCase();
      if(s.includes('подтверж')) el.classList.add('ok');
      else if(s.includes('рассмотр') || s.includes('провер')) el.classList.add('warn');
      else if(s.includes('отклон')) el.classList.add('bad');
      else el.classList.add('ghost');
    }

    // Wire proof uploads
    function wireProofs(){
      const bindings = [
        // Работодатель — только документы компании
        {role:'employer', key:'companyDoc', input:'fileCompanyDocE', hint:'companyDocHintE', status:'companyDocStatusE'},

        // Пользователь
        {role:'employee', key:'education', input:'fileEduC', hint:'eduHintC', status:'eduStatusC'},
        {role:'employee', key:'work',      input:'fileWorkC', hint:'workHintC', status:'workStatusC'},
        {role:'employee', key:'courses',   input:'fileCourseC', hint:'courseHintC', status:'courseStatusC'},
        {role:'employee', key:'passport',  input:'filePassC', hint:'passHintC', status:'passStatusC'},
        {role:'employee', key:'cv',        input:'fileCVC', hint:'cvHintC', status:'cvStatusC'},
      ];

      bindings.forEach(b => {
        const inp = document.getElementById(b.input);
        if(!inp) return;
        if(!inp.dataset.proofBound){
          inp.dataset.proofBound = '1';
          inp.addEventListener('change', () => {
          const file = inp.files && inp.files[0];
          const name = file ? file.name : '';
          const proof = state[b.role].proofs[b.key];
          if(!proof) return;

          if(proof.url){ try{ URL.revokeObjectURL(proof.url); }catch(e){} }
          proof.fileName = name;
          proof.status = name ? 'на рассмотрении' : 'не загружено';
          proof.url = name && file ? URL.createObjectURL(file) : '';
          proof.rejectReason = '';

          const hintEl = document.getElementById(b.hint);
          if(hintEl) hintEl.textContent = name ? ('Загрузка...' ) : 'Файл не выбран';
          setStatusTag(b.status, proof.status);

          if(b.role === 'employer') renderRecruiterPublic();
          if(b.role === 'employee') renderEmployeePublic();
          refreshEmployeeCVButton();
          saveToStorage();

          // Upload to backend if logged in
          if(name && file && getToken()) {
            (async () => {
              try {
                const { fileUrl, fileName } = await apiUploadFile(file);
                const apiType = proofKeyToApiType(b.key);
                // Ensure achievement exists
                let achId = proof.achievementId;
                if(!achId) {
                  const ach = await apiCreateAchievement(apiType, DOC_TYPE_LABELS[apiType] || apiType, '');
                  achId = ach.id;
                  proof.achievementId = achId;
                }
                const doc = await apiAttachDocument(achId, fileUrl, fileName);
                proof.docId = doc?.id || proof.docId;
                hintEl && (hintEl.textContent = 'Прикреплено: ' + fileName);
                showToast('Файл загружен ✓ — на рассмотрении');
                saveToStorage();
              } catch(err) {
                hintEl && (hintEl.textContent = 'Прикреплено: ' + name + ' (локально)');
                showToast('Файл загружен локально');
              }
            })();
          } else {
            if(hintEl && name) hintEl.textContent = 'Прикреплено: ' + name;
            if(name) showToast('Файл загружен ✓');
          }
          });
        }

        // первичная отрисовка
        const proof = state[b.role].proofs[b.key];
        const curName = proof && proof.fileName;
        const hintEl = document.getElementById(b.hint);
        if(hintEl) hintEl.textContent = curName ? ('Прикреплено: ' + curName) : 'Файл не выбран';
        if(proof) setStatusTag(b.status, proof.status);
      });
    }


    // Wire drop zones
    function wireDropZones(){
      const zones = [
        // Работодатель
        { zoneId: 'dropZoneCompanyDocE', inputId: 'fileCompanyDocE' },

        // Пользователь
        { zoneId: 'dropZoneEduC',     inputId: 'fileEduC' },
        { zoneId: 'dropZoneWorkC',    inputId: 'fileWorkC' },
        { zoneId: 'dropZoneCourseC',  inputId: 'fileCourseC' },
        { zoneId: 'dropZonePassC',    inputId: 'filePassC' },
        { zoneId: 'dropZoneCVC',      inputId: 'fileCVC' },

        // Портфолио
        { zoneId: 'dropZonePortfolio', inputId: 'filePortfolioC' },
      ];
      zones.forEach(({ zoneId, inputId }) => {
        const zone = document.getElementById(zoneId);
        const inp = document.getElementById(inputId);
        if(!zone || !inp) return;
        zone.addEventListener('click', () => inp.click());
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dropZone--over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dropZone--over'));
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          zone.classList.remove('dropZone--over');
          if(e.dataTransfer.files && e.dataTransfer.files.length){
            inp.files = e.dataTransfer.files;
            inp.dispatchEvent(new Event('change'));
          }
        });
      });
    }


    // Portfolio upload
    (function wirePortfolio(){
      const inp = document.getElementById('filePortfolioC');
      if(!inp) return;
      inp.addEventListener('change', () => {
        const files = inp.files ? Array.from(inp.files) : [];
        (state.employee.portfolio || []).forEach(it => { try{ if(it.url) URL.revokeObjectURL(it.url); }catch(e){} });
        state.employee.portfolio = files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
        const hint = document.getElementById('portHintC');
        if(hint) hint.textContent = files.length ? ('Прикреплено: ' + files.length + ' файл(ов)') : 'Файлы не выбраны';
        setStatusTag('portStatusC', files.length ? 'на рассмотрении' : 'не загружено');
        renderEmployeePublic();
        if(files.length) showToast('Файл загружен ✓');
      });
    })();

    // Avatar upload
    function wireAvatar(inputId, hintId, imgId, target){
      const input = document.getElementById(inputId);
      if(!input) return;
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          if(target === 'employer') state.employer.avatarDataUrl = dataUrl;
          if(target === 'employee') state.employee.avatarDataUrl = dataUrl;
          setAvatar(imgId, dataUrl);
          setText(hintId, 'Фото выбрано: ' + file.name);
          if(target === 'employer') renderRecruiterPublic();
          if(target === 'employee') renderEmployeePublic();
        };
        reader.readAsDataURL(file);
      });
    }

    // Helpers
    function pickInGroup(groupId, value){
      const wrap = document.getElementById(groupId);
      if(!wrap) return;
      wrap.querySelectorAll('.sqBtn').forEach(b => b.classList.remove('selected'));
      const chosen = [...wrap.querySelectorAll('.sqBtn')].find(b => b.dataset.value === value);
      if(chosen) chosen.classList.add('selected');
    }

    function debounce(fn, wait){
      let timer = null;
      return function(){
        const ctx = this;
        const args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function(){ fn.apply(ctx, args); }, wait);
      };
    }

    const _debouncedFilterFeed = debounce(filterFeed, 120);
    const _debouncedFilterEmployerSearch = debounce(filterEmployerSearch, 120);
    const _debouncedFilterAdminCandidates = debounce(filterAdminCandidates, 120);
    const _debouncedFilterAdminEmployers = debounce(filterAdminEmployers, 120);

    function debouncedFilterFeed(){ _debouncedFilterFeed(); }
    function debouncedFilterEmployerSearch(){ _debouncedFilterEmployerSearch(); }
    function debouncedFilterAdminCandidates(){ _debouncedFilterAdminCandidates(); }
    function debouncedFilterAdminEmployers(){ _debouncedFilterAdminEmployers(); }

    function openDrawer(){
      if(!drawer || !drawerOverlay) return;
      drawer.classList.add('open');
      drawerOverlay.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
      drawerOverlay.setAttribute('aria-hidden','false');
    }
    function closeDrawer(){
      if(!drawer || !drawerOverlay) return;
      drawer.classList.remove('open');
      drawerOverlay.classList.remove('open');
      drawer.setAttribute('aria-hidden','true');
      drawerOverlay.setAttribute('aria-hidden','true');
    }
    function toggleDrawer(){
      if(!drawer) return;
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    }

    function openModal(key){
      if(!infoModal) return;
      const content = getModalContent(key);
      modalTitle.textContent = content.title;
      modalBody.innerHTML = content.html;
      infoModal.classList.add('open');
      infoModal.setAttribute('aria-hidden','false');
    }
    function closeModal(){
      if(!infoModal) return;
      infoModal.classList.remove('open');
      infoModal.setAttribute('aria-hidden','true');
    }

    function getModalContent(key){
  const panels={
    how:{title:'Как работает LOMO',html:'<p style="margin:0 0 10px">LOMO — платформа верификации карьерных данных.</p><ol style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Зарегистрируйтесь как кандидат или работодатель.</li><li style="margin-bottom:8px">Загрузите документы: диплом, трудовую книжку, сертификаты.</li><li style="margin-bottom:8px">Администратор проверяет и ставит отметку ✓ на профиле.</li><li>Работодатели видят верифицированные профили.</li></ol>'},
    security:{title:'Безопасность и приватность',html:'<ul style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Документы хранятся на защищённых серверах.</li><li style="margin-bottom:8px">Данные не передаются третьим лицам.</li><li style="margin-bottom:8px">Доступ к файлам только у верификатора.</li><li style="margin-bottom:8px">Соединение защищено HTTPS.</li><li>Удаление аккаунта доступно в личном профиле после подтверждения паролем.</li></ul>'},
    terms:{title:'Условия использования',html:'<ul style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Предоставляйте только достоверные данные.</li><li style="margin-bottom:8px">Запрещено загружать чужие или поддельные документы.</li><li>Нарушение — блокировка аккаунта.</li></ul>'},
    privacy:{title:'Политика конфиденциальности',html:'<p style="margin:0 0 10px">Собираем минимум данных: имя, email, документы.</p><p style="margin:0 0 10px">Телефон и email не публикуются публично.</p><p style="margin:0">Удаление аккаунта доступно в личном профиле после подтверждения паролем.</p>'},
    contacts:{title:'Контакты',html:'<p style="margin:0 0 10px">Email: <b>support@lomo.website</b></p><p style="margin:0 0 10px">Telegram: <b>@lomo_support</b></p><p style="margin:0 0 16px">Пн–Пт, 9:00–18:00 МСК</p>'},
    about:{title:'О проекте LOMO',html:'<p style="margin:0 0 10px">LOMO — платформа верификации карьерных данных для рынка труда СНГ.</p><p style="margin:0 0 10px">Кандидаты подтверждают образование и опыт документами, работодатели находят проверенных специалистов.</p><p style="margin:0;color:#888;font-size:13px">Запущен в 2024 году. Верификация — 1–2 рабочих дня.</p>'},
    faq:{title:'Частые вопросы',html:'<div class="faqItem"><div class="faqQ">Сколько стоит?</div><div class="faqA">Для кандидатов — бесплатно.</div></div><div class="faqItem"><div class="faqQ">Как долго верификация?</div><div class="faqA">1–2 рабочих дня.</div></div><div class="faqItem"><div class="faqQ">Какие форматы?</div><div class="faqA">PDF, JPG, PNG, DOCX — до 50 МБ.</div></div><div class="faqItem"><div class="faqQ">Видят ли работодатели мои документы?</div><div class="faqA">Нет — только статус ✓ или ✗.</div></div>'}
  };
  return panels[key]||{title:'—',html:''};
}

    function openLegalModal(type){
      const el = document.getElementById('legalModal');
      const title = document.getElementById('legalModalTitle');
      const body = document.getElementById('legalModalBody');
      if(!el) return;
      if(type === 'terms'){
        title.textContent = 'Условия использования';
        body.innerHTML = `
          <h3>1. Общие положения</h3>
          <p>Использование платформы LOMO означает согласие с настоящими условиями. LOMO — сервис верификации карьерных данных для рынка найма.</p>
          <h3>2. Пользователь (кандидат)</h3>
          <p>Пользователь обязуется загружать только подлинные документы. Загрузка поддельных материалов влечёт блокировку аккаунта и может быть передана правоохранительным органам.</p>
          <h3>3. Работодатель</h3>
          <p>Работодатель обязуется использовать данные кандидатов исключительно для целей найма. Передача данных третьим лицам без согласия кандидата запрещена.</p>
          <h3>4. Верификация</h3>
          <p>LOMO подтверждает факт предоставленных документов, но не несёт ответственности за достоверность самих сведений в случае предоставления поддельных материалов.</p>
          <h3>5. Изменение условий</h3>
          <p>LOMO вправе изменять данные условия, уведомив пользователей за 14 дней до вступления в силу.</p>
          <p style="font-size:11px;color:#999;margin-top:16px;">Актуальная версия: апрель 2026.</p>
        `;
      } else {
        title.textContent = 'Политика конфиденциальности';
        body.innerHTML = `
          <h3>1. Сбор данных</h3>
          <p>LOMO собирает: имя, email, загруженные документы, историю верификаций. Данные необходимы исключительно для работы платформы.</p>
          <h3>2. Хранение</h3>
          <p>Документы хранятся в зашифрованном виде. Доступ к файлам — только у модераторов при проверке и у работодателя после явного согласия кандидата.</p>
          <h3>3. Приватность по умолчанию</h3>
          <p>Все загруженные файлы — приватны. Работодатель видит только статусы. Доступ к файлам выдаётся кандидатом явно, через систему запросов.</p>
          <h3>4. Удаление данных</h3>
          <p>Пользователь вправе удалить свой аккаунт и связанные данные в личном профиле после подтверждения паролем. Отдельные резервные копии могут храниться ограниченное время в рамках инфраструктурной политики.</p>
          <h3>5. Cookies</h3>
          <p>LOMO использует только функциональные cookies. Рекламные и аналитические трекеры не используются без явного согласия.</p>
          <p style="font-size:11px;color:#999;margin-top:16px;">Актуальная версия: апрель 2026.</p>
        `;
      }
      el.classList.add('open');
      el.setAttribute('aria-hidden','false');
    }

    function openVerifyLevelModal(){
      const el = document.getElementById('verifyLevelModal');
      if(!el) return;
      el.classList.add('open');
      el.setAttribute('aria-hidden','false');
    }

    function bindUiAction(id, eventName, handler){
      const el = document.getElementById(id);
      if(el) el.addEventListener(eventName, handler);
    }

    function bindStaticUiActions(){
      bindUiAction('authSearchBtn', 'click', function(){ goToSearch(); });
      bindUiAction('authLogoutAllBtn', 'click', function(){ logoutAllSessions(); show('auth'); });
      bindUiAction('authLogoutBtn', 'click', function(){ logout(); show('auth'); });
      bindUiAction('employerLogoutAllBtn', 'click', function(){ logoutAllSessions(); show('auth'); });
      bindUiAction('employeeLogoutAllBtn', 'click', function(){ logoutAllSessions(); show('auth'); });
      bindUiAction('adminLogoutBtn', 'click', function(){ logout(); show('auth'); });
      bindUiAction('addWorkExpBtn', 'click', function(){ addWorkExp(); });
      bindUiAction('cvPublicToggle', 'change', function(){ updateCvPrivacy(); });
      bindUiAction('epOnboardDismiss', 'click', function(){
        const banner = document.getElementById('epOnboardBanner');
        if(banner) banner.style.display = 'none';
      });
      bindUiAction('verifyLevelInfoBtn', 'click', function(){ openVerifyLevelModal(); });
      bindUiAction('refreshAdminQueueBtn', 'click', function(){ loadAdminQueue(); });
      bindUiAction('pubProfileBackBtn', 'click', function(){ closePublicProfile(); });
      bindUiAction('userProfileCloseBtn', 'click', function(){ closeUserProfile(); });

      const eduInput = document.getElementById('mpCEduPlace');
      if(eduInput){ eduInput.addEventListener('input', function(){ filterUniList(eduInput.value); }); }

      const currentJobInput = document.getElementById('mpCCurrentJob');
      if(currentJobInput){ currentJobInput.addEventListener('input', function(){ filterJobList(currentJobInput.value); }); }

      const feedSearchInput = document.getElementById('feedSearchInput');
      if(feedSearchInput){ feedSearchInput.addEventListener('input', function(){ debouncedFilterFeed(); }); }

      const employerSearchInput = document.getElementById('empSearchName');
      if(employerSearchInput){ employerSearchInput.addEventListener('input', function(){ debouncedFilterEmployerSearch(); }); }

      const employerVerified = document.getElementById('empSearchVerified');
      if(employerVerified){ employerVerified.addEventListener('change', function(){ filterEmployerSearch(); }); }

      const adminCandSearch = document.getElementById('adminCandSearch');
      if(adminCandSearch){ adminCandSearch.addEventListener('input', function(){ debouncedFilterAdminCandidates(); }); }

      const adminEmpSearch = document.getElementById('adminEmpSearch');
      if(adminEmpSearch){ adminEmpSearch.addEventListener('input', function(){ debouncedFilterAdminEmployers(); }); }

      const adminUserSearch = document.getElementById('adminUserSearch');
      if(adminUserSearch){ adminUserSearch.addEventListener('input', function(){ loadAdminUsers(1); }); }

      document.querySelectorAll('[data-legal-link]').forEach(function(link){
        link.addEventListener('click', function(){
          openLegalModal(link.getAttribute('data-legal-link'));
        });
      });

      document.querySelectorAll('.js-toggle-drawer').forEach(function(button){
        button.addEventListener('click', function(){ toggleDrawer(); });
      });

      document.querySelectorAll('[data-admin-tab]').forEach(function(button){
        button.addEventListener('click', function(){
          switchAdminTab(button.getAttribute('data-admin-tab'));
        });
      });

      const userProfileModal = document.getElementById('userProfileModal');
      if(userProfileModal){
        userProfileModal.addEventListener('click', function(e){
          if(e.target === userProfileModal) closeUserProfile();
        });
      }
    }

    // ====== REAL ADMIN PANEL ======
    function showEmployerDashboard(){
      loadEmployerSearch();
      show('employerSearch');
    }
    function showEmployeeDashboard(){
      loadCandidateFeed();
      show('candidateFeed');
    }

    // Initialize hash routing
    initHashRouting();
    window.addEventListener('hashchange', initHashRouting);

    if(authBurger) authBurger.addEventListener('click', toggleDrawer);
    if(drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
    if(drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    if(drawer){
      drawer.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-drawer-open]');
        if(!btn) return;
        const key = btn.getAttribute('data-drawer-open');
        closeDrawer();
        if(key === 'about'){ openModal('about'); return; }
        openModal(key);
      });
    }

    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if(infoModal) infoModal.addEventListener('click', (e)=>{ if(e.target === infoModal) closeModal(); });

    const legalModalEl = document.getElementById('legalModal');
    const legalModalCloseEl = document.getElementById('legalModalClose');
    if(legalModalCloseEl) legalModalCloseEl.addEventListener('click', ()=>{ legalModalEl.classList.remove('open'); legalModalEl.setAttribute('aria-hidden','true'); });
    if(legalModalEl) legalModalEl.addEventListener('click', (e)=>{ if(e.target===legalModalEl){ legalModalEl.classList.remove('open'); legalModalEl.setAttribute('aria-hidden','true'); } });

    const verifyLevelModalEl = document.getElementById('verifyLevelModal');
    const verifyLevelCloseEl = document.getElementById('verifyLevelClose');
    if(verifyLevelCloseEl) verifyLevelCloseEl.addEventListener('click', ()=>{ verifyLevelModalEl.classList.remove('open'); verifyLevelModalEl.setAttribute('aria-hidden','true'); });
    if(verifyLevelModalEl) verifyLevelModalEl.addEventListener('click', (e)=>{ if(e.target===verifyLevelModalEl){ verifyLevelModalEl.classList.remove('open'); verifyLevelModalEl.setAttribute('aria-hidden','true'); } });

    bindStaticUiActions();
