function logout() {
  saveToStorage();
  apiLogout().catch(function () {});
  clearToken();
  resetState();
  resetDisplay();
  clearAuthInputs();
}

function logoutAllSessions() {
  saveToStorage();
  apiLogoutAll().catch(function () {});
  clearToken();
  resetState();
  resetDisplay();
  clearAuthInputs();
}

function deleteOwnAccount(password) {
  const userId = state.userId;
  return apiDeleteAccount(password).then(function (result) {
    clearUserStorage(userId);
    clearToken();
    resetState();
    resetDisplay();
    clearAuthInputs();
    return result;
  });
}

    function clearAuthInputs(){
      ['regFirstName','regLastName','regEmail','regLogin','regPassword','loginEmail','loginPassword','forgotEmail','newPassword','confirmPassword']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
      // clear code cells
      for(let i=0;i<6;i++){ const cc=document.getElementById('cc'+i); if(cc) cc.value=''; }
      document.querySelectorAll('.codeCell').forEach(c=>c.classList.remove('filled','active','error'));
    }

    // ── FORGOT PASSWORD FLOW ──────────────────────────────────
    (function initForgotFlow(){
      // State for the flow
      const flowState = { email: '' };
      function getForgotFlowErrorText(err){
        const msg = safeErrorText(err);
        if(msg === 'Not found' || /API error 404|404/.test(msg)){
          return 'Сервис восстановления пароля сейчас обновляется. Попробуйте через пару минут.';
        }
        if(/Too many reset requests|Too many requests/i.test(msg)){
          return 'Слишком много попыток. Попробуйте чуть позже.';
        }
        if(/valid email/i.test(msg)){
          return 'Введите корректный email';
        }
        return 'Не удалось отправить код. Попробуйте позже.';
      }
      function getResetFlowErrorText(err){
        const msg = safeErrorText(err);
        if(msg === 'Not found' || /API error 404|404/.test(msg)){
          return 'Сервис смены пароля сейчас обновляется. Попробуйте через пару минут.';
        }
        if(/Too many invalid code attempts/i.test(msg)){
          return 'Слишком много неверных попыток. Запросите новый код.';
        }
        if(/Too many reset attempts|Too many requests/i.test(msg)){
          return 'Слишком много попыток. Попробуйте чуть позже.';
        }
        if(/Code expired/i.test(msg)){
          return 'Срок действия кода истёк. Запросите новый код.';
        }
        if(/Invalid or expired code/i.test(msg)){
          return 'Неверный или устаревший код.';
        }
        return 'Не удалось изменить пароль. Попробуйте позже.';
      }

      // ── STEP 1: Send email ───────────────────────────────────
      const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
      forgotSubmitBtn && forgotSubmitBtn.addEventListener('click', async () => {
        const emailVal = (document.getElementById('forgotEmail')?.value || '').trim();
        const emailInput = document.getElementById('sqInputForgotEmail');
        const emailErr = document.getElementById('forgotEmailError');
        // Validate
        if(!emailVal || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailVal)){
          emailInput?.classList.add('inputError');
          emailErr?.classList.remove('hidden');
          return;
        }
        emailInput?.classList.remove('inputError');
        emailErr?.classList.add('hidden');
        // Disable button
        forgotSubmitBtn.disabled = true;
        forgotSubmitBtn.textContent = 'Отправляем…';
        try {
          await apiForgotPassword(emailVal);
          flowState.email = emailVal;
          // Update subtitle in verify screen
          const sub = document.getElementById('verifyCodeSub');
          if(sub) sub.textContent = `Мы отправили 6-значный код на ${emailVal}. Код действителен 15 минут.`;
          // Clear code cells
          for(let i=0;i<6;i++){ const cc=document.getElementById('cc'+i); if(cc) cc.value=''; }
          document.querySelectorAll('.codeCell').forEach(c=>c.classList.remove('filled','active','error'));
          document.getElementById('verifyCodeError')?.classList.add('hidden');
          show('verifyCode');
          setTimeout(()=>{ document.getElementById('cc0')?.focus(); }, 80);
        } catch(err) {
          emailErr.textContent = getForgotFlowErrorText(err);
          emailErr?.classList.remove('hidden');
          emailInput?.classList.add('inputError');
        } finally {
          forgotSubmitBtn.disabled = false;
          forgotSubmitBtn.textContent = 'Отправить код';
        }
      });

      // Allow resend
      document.getElementById('resendCodeBtn')?.addEventListener('click', async () => {
        if(!flowState.email) { show('forgot'); return; }
        const btn = document.getElementById('resendCodeBtn');
        btn.disabled = true;
        btn.textContent = 'Отправляем…';
        try {
          await apiForgotPassword(flowState.email);
          // Clear cells & error
          for(let i=0;i<6;i++){ const cc=document.getElementById('cc'+i); if(cc) cc.value=''; }
          document.querySelectorAll('.codeCell').forEach(c=>c.classList.remove('filled','active','error'));
          document.getElementById('verifyCodeError')?.classList.add('hidden');
          setTimeout(()=>{ document.getElementById('cc0')?.focus(); }, 50);
        } catch(e) {}
        finally {
          btn.disabled = false;
          btn.textContent = 'Отправить повторно';
        }
      });

      // ── STEP 2: Code input behaviour ────────────────────────
      const codeRow = document.getElementById('codeInputRow');
      if(codeRow){
        const cells = codeRow.querySelectorAll('.codeCell');
        const inputs = [...codeRow.querySelectorAll('input')];

        // Focus management
        inputs.forEach((inp, idx) => {
          // Click on cell focuses input
          cells[idx].addEventListener('click', () => inp.focus());

          inp.addEventListener('focus', () => {
            cells.forEach(c=>c.classList.remove('active'));
            cells[idx].classList.add('active');
          });
          inp.addEventListener('blur', () => {
            cells[idx].classList.remove('active');
          });

          inp.addEventListener('keydown', (e) => {
            if(e.key === 'Backspace'){
              if(inp.value === '' && idx > 0){ inputs[idx-1].focus(); inputs[idx-1].select(); }
              else { inp.value = ''; cells[idx].classList.remove('filled'); }
              e.preventDefault();
            } else if(e.key === 'ArrowLeft' && idx > 0){
              inputs[idx-1].focus(); e.preventDefault();
            } else if(e.key === 'ArrowRight' && idx < 5){
              inputs[idx+1].focus(); e.preventDefault();
            } else if(e.key === 'Enter'){
              document.getElementById('verifySubmitBtn')?.click();
            }
          });

          inp.addEventListener('input', (e) => {
            // Accept only digits
            let val = inp.value.replace(/\D/g,'');
            // Handle paste of full code
            if(val.length > 1){
              [...val.slice(0,6)].forEach((ch,i)=>{
                if(inputs[i]){ inputs[i].value=ch; cells[i].classList.add('filled'); }
              });
              const nextEmpty = inputs.findIndex(i=>!i.value);
              (nextEmpty >= 0 ? inputs[nextEmpty] : inputs[5]).focus();
              return;
            }
            inp.value = val;
            if(val){ cells[idx].classList.add('filled'); if(idx<5) inputs[idx+1].focus(); }
            else { cells[idx].classList.remove('filled'); }
          });
        });
      }

      // ── STEP 2: Verify code submit ───────────────────────────
      document.getElementById('verifySubmitBtn')?.addEventListener('click', async () => {
        const code = [...document.querySelectorAll('.codeCell input')].map(i=>i.value).join('');
        const errEl = document.getElementById('verifyCodeError');
        if(code.length < 6){
          document.querySelectorAll('.codeCell').forEach(c=>c.classList.add('error'));
          errEl?.classList.remove('hidden');
          errEl.textContent = 'Введите все 6 цифр кода.';
          return;
        }
        // Store validated code, go to reset screen
        flowState.code = code;
        errEl?.classList.add('hidden');
        document.querySelectorAll('.codeCell').forEach(c=>c.classList.remove('error'));
        // Pre-clear reset fields
        const np = document.getElementById('newPassword');
        const cp = document.getElementById('confirmPassword');
        if(np) np.value='';
        if(cp) cp.value='';
        document.getElementById('strengthFill') && (document.getElementById('strengthFill').style.width='0');
        show('resetPassword');
        setTimeout(()=>{ document.getElementById('newPassword')?.focus(); }, 80);
      });

      // ── STEP 3: Password strength indicator ─────────────────
      document.getElementById('newPassword')?.addEventListener('input', () => {
        const val = document.getElementById('newPassword').value;
        const fill = document.getElementById('strengthFill');
        if(!fill) return;
        let score = 0;
        if(val.length >= 8) score++;
        if(val.length >= 12) score++;
        if(/[A-Z]/.test(val)) score++;
        if(/[0-9]/.test(val)) score++;
        if(/[^a-zA-Z0-9]/.test(val)) score++;
        const pct = Math.min(100, score * 22);
        fill.style.width = pct + '%';
        fill.style.background = score <= 1 ? '#ef4444' : score <= 2 ? '#f59e0b' : score <= 3 ? '#84cc16' : '#22c55e';
      });

      // ── STEP 3: Save new password ────────────────────────────
      document.getElementById('resetSubmitBtn')?.addEventListener('click', async () => {
        const np = (document.getElementById('newPassword')?.value || '');
        const cp = (document.getElementById('confirmPassword')?.value || '');
        const npInput = document.getElementById('sqInputNewPassword');
        const cpInput = document.getElementById('sqInputConfirmPassword');
        const npErr = document.getElementById('newPasswordError');
        const cpErr = document.getElementById('confirmPasswordError');
        let ok = true;
        if(np.length < 8){
          npInput?.classList.add('inputError'); npErr?.classList.remove('hidden'); ok=false;
        } else { npInput?.classList.remove('inputError'); npErr?.classList.add('hidden'); }
        if(np !== cp){
          cpInput?.classList.add('inputError'); cpErr?.classList.remove('hidden'); ok=false;
        } else { cpInput?.classList.remove('inputError'); cpErr?.classList.add('hidden'); }
        if(!ok) return;
        const btn = document.getElementById('resetSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Сохраняем…';
        try {
          await apiResetPassword(flowState.email, flowState.code, np);
          // Success!
          doneTextEl.textContent = 'Пароль успешно изменён';
          state.prevFromDone = 'loginForm';
          show('done');
        } catch(err) {
          // Code was wrong after all — go back to verify
          const errEl = document.getElementById('verifyCodeError');
          if(errEl){ errEl.textContent = getResetFlowErrorText(err); errEl.classList.remove('hidden'); }
          document.querySelectorAll('.codeCell').forEach(c=>c.classList.add('error'));
          show('verifyCode');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Сохранить пароль';
        }
      });
    })();

    // Consent listeners
    ['consentTerms','consentPd','consentRole'].forEach(id => {
      const el = document.getElementById(id);
      if(el){ el.addEventListener('change', () => { updateRegNextState(); }); }
    });

    // Role next button enable/disable
    document.getElementById('roleChoices')?.addEventListener('click', () => {
      const btn = document.getElementById('btnRoleNext');
      if(btn && state.roleReg) btn.disabled = false;
    });

    function handlePickSelection(pick){
      if(!pick) return;
      const kind = pick.dataset.pick;
      const value = pick.dataset.value;
      if(kind === 'auth'){
        state.auth = value;
        pickInGroup('authChoices', value);
        setTimeout(() => {
          if(value === 'REGISTRATION') show('roleReg');
          else show('loginForm');
        }, 150);
      }
      if(kind === 'roleReg'){
        state.roleReg = value;
        pickInGroup('roleChoices', value);
        try{ updateConsentRoleText(); clearConsentError(); }catch(e){}
        const btn = document.getElementById('btnRoleNext');
        if(btn) btn.disabled = false;
      }
    }

    document.querySelectorAll('[data-pick]').forEach((pickEl) => {
      pickEl.addEventListener('click', (e) => {
        e.preventDefault();
        handlePickSelection(pickEl);
      });
      pickEl.addEventListener('touchend', (e) => {
        if(e.cancelable) e.preventDefault();
        handlePickSelection(pickEl);
      }, { passive: false });
    });

    // Start button
    startBtn.addEventListener('click', () => {
      logoWrap.classList.add('animUp');
      setTimeout(() => show('auth'), 720);
    });

    // Main click handler
    document.addEventListener('click', (e) => {

      // Social card click — open profile
      const card = e.target.closest('.socialCard[data-uid]');
      if(card){
        var uid = card.getAttribute('data-uid');
        _openProfileById(uid);
        return;
      }

      const dl = e.target.closest('[data-download]');
      if(dl){
        const parts = (dl.dataset.download || '').split(':');
        if(parts[0]==='employee' && parts[1]==='portfolio'){
          const idx = parseInt(parts[2]||'0',10);
          const it = state.employee.portfolio && state.employee.portfolio[idx];
          if(it && it.url){
            const a = document.createElement('a');
            a.href = it.url; a.download = it.name || 'file';
            document.body.appendChild(a); a.click(); a.remove();
          }
        }
        return;
      }

      const del = e.target.closest('[data-del]');
      if(del){
        const [role,key] = (del.dataset.del || '').split(':');
        if(role==='employee' && key==='portfolio'){
          (state.employee.portfolio || []).forEach(it => { try{ if(it.url) URL.revokeObjectURL(it.url); }catch(e){} });
          state.employee.portfolio = [];
          const inp = document.getElementById('filePortfolioC'); if(inp) inp.value='';
          setText('portHintC','Файлы не выбраны');
          setStatusTag('portStatusC','не загружено');
          renderEmployeePublic();
          showToast('Файл удалён');
          return;
        }
        const tgt = role==='employer' ? state.employer : state.employee;
        if(tgt && tgt.proofs && tgt.proofs[key]){
          // revoke old url (если был)
          if(tgt.proofs[key].url){ try{ URL.revokeObjectURL(tgt.proofs[key].url); }catch(e){} }

          tgt.proofs[key].fileName = '';
          tgt.proofs[key].status = 'не загружено';
          tgt.proofs[key].url = '';
          tgt.proofs[key].docId = '';
          tgt.proofs[key].achievementId = '';
          tgt.proofs[key].rejectReason = '';

          const inputMap = {
            employer: { companyDoc:'fileCompanyDocE' },
            employee: { education:'fileEduC', work:'fileWorkC', courses:'fileCourseC', passport:'filePassC', cv:'fileCVC' }
          };
          const hintMap = {
            employer: { companyDoc:'companyDocHintE' },
            employee: { education:'eduHintC', work:'workHintC', courses:'courseHintC', passport:'passHintC', cv:'cvHintC' }
          };
          const statusMap = {
            employer: { companyDoc:'companyDocStatusE' },
            employee: { education:'eduStatusC', work:'workStatusC', courses:'courseStatusC', passport:'passStatusC', cv:'cvStatusC' }
          };

          const inputId = inputMap[role]?.[key];
          if(inputId){ const inp = document.getElementById(inputId); if(inp) inp.value=''; }

          const hintId = hintMap[role]?.[key];
          const statusId = statusMap[role]?.[key];
          if(hintId) setText(hintId,'Файл не выбран');
          if(statusId) setStatusTag(statusId,'не загружено');

          if(role==='employer') renderRecruiterPublic();
          else renderEmployeePublic();

          refreshEmployeeCVButton();
          showToast('Файл удалён');
          saveToStorage();
        }
        return;
      }

      if(e.target && e.target.id === 'rpContactBtn'){ openEmployerContact(); return; }
      if(e.target && e.target.id === 'rpDownloadCV'){ downloadRecruiterCV(); return; }
      if(e.target && e.target.id === 'rpCVLink'){ downloadRecruiterCV(); return; }
      if(e.target && e.target.id === 'btnShareProfile'){ copyToClipboard(publicProfileUrl()); return; }
      if(e.target && e.target.id === 'btnContactData'){ openMail(); return; }
      if(e.target && e.target.id === 'btnDownloadCV'){ downloadEmployeeCV(); return; }
      const openDocBtn = e.target.closest('[data-open-doc]');
      if(openDocBtn){
        openSecureDocument(openDocBtn.dataset.openDoc, openDocBtn.dataset.fileName || 'document')
          .catch(function(err){ showToast('Ошибка: ' + err.message); });
        return;
      }
      const requestDocBtn = e.target.closest('[data-request-doc]');
      if(requestDocBtn){
        requestDocumentAccess(requestDocBtn.dataset.candidateId, requestDocBtn.dataset.requestDoc);
        return;
      }
      const connectionActionBtn = e.target.closest('[data-connection-action]');
      if(connectionActionBtn){
        handleConnectionAction(
          connectionActionBtn.dataset.connectionAction,
          connectionActionBtn.dataset.connectionId || '',
          connectionActionBtn.dataset.targetUserId || ''
        );
        return;
      }
      const openConnectionProfileBtn = e.target.closest('[data-open-connection-profile]');
      if(openConnectionProfileBtn){
        _openProfileById(openConnectionProfileBtn.dataset.openConnectionProfile);
        return;
      }
      const approveReqBtn = e.target.closest('[data-approve-request]');
      if(approveReqBtn){
        handleRequestDecision(approveReqBtn.dataset.approveRequest, 'approve');
        return;
      }
      const rejectReqBtn = e.target.closest('[data-reject-request]');
      if(rejectReqBtn){
        handleRequestDecision(rejectReqBtn.dataset.rejectRequest, 'reject');
        return;
      }
      if(e.target && e.target.id === 'btnRemoveEAvatar'){
        state.employer.avatarDataUrl = '';
        setAvatar('mpEAvatarImg','');
        setText('mpEAvatarHint','Фото не выбрано');
        renderRecruiterPublic();
        return;
      }
      if(e.target && e.target.id === 'btnRemoveCAvatar'){
        state.employee.avatarDataUrl = '';
        setAvatar('mpCAvatarImg','');
        setText('mpCAvatarHint','Фото не выбрано');
        renderEmployeePublic();
        refreshEmployeeCVButton();
        return;
      }

      const next = e.target.closest('[data-next]');
      if(next){
        const route = next.dataset.next;

        if(route === 'fromAuth'){
          const mode = state.auth || 'LOGIN';
          if(mode === 'REGISTRATION') show('roleReg');
          else show('loginForm');
          return;
        }

        if(route === 'fromRoleReg'){
          if(!state.roleReg) state.roleReg = 'EMPLOYEE';
          show('regForm');
          return;
        }

        if(route === 'fromRegForm'){
          if(!consentsOk()){ showConsentError(); return; }
          const firstName = (document.getElementById('regFirstName')?.value || '').trim();
          const lastName  = (document.getElementById('regLastName')?.value  || '').trim();
          const fullName  = [firstName, lastName].filter(Boolean).join(' ');
          const email    = (document.getElementById('regEmail')?.value    || '').trim();
          const login    = (document.getElementById('regLogin')?.value    || '').trim().toLowerCase();
          const password = (document.getElementById('regPassword')?.value || '').trim();
          const role     = (state.roleReg || 'EMPLOYEE') === 'EMPLOYER' ? 'employer' : 'candidate';
          const btn = document.getElementById('btnRegNext');
          if(btn) btn.disabled = true;
          (async () => {
            try {
              // --- Form validation ---
                if (!firstName && !lastName) { if(btn) btn.disabled = false; showToast('Введите имя'); return; }
                const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRe.test(email)) { if(btn) btn.disabled = false; showToast('Некорректный email'); return; }
                if (login && !/^[a-z0-9._-]{3,32}$/.test(login)) { if(btn) btn.disabled = false; showToast('Логин: 3-32 символа, только a-z, 0-9, точка, _ или -'); return; }
                if (!password || password.length < 8) { if(btn) btn.disabled = false; showToast('Пароль — минимум 8 символов'); return; }
                // --- End validation ---
                const { user, profile } = await apiRegister(email, password, role, fullName, login);
              state.email = user.email;
              state.login = user.login || login || '';
              state.roleReg = role === 'employer' ? 'EMPLOYER' : 'EMPLOYEE';
              applyProfileToState(user, profile, []);
              saveToStorage();
              if(role === 'employer'){
                state.employer.fullName = fullName || state.employer.fullName;
                showEmployerDashboard();
              } else {
                state.employee.fullName = fullName || state.employee.fullName;
                showEmployeeDashboard();
              }
            } catch(err) {
              showToast('Ошибка: ' + err.message);
              if(btn) btn.disabled = false;
            }
          })();
          return;
        }

        if(route === 'fromLoginForm'){
          const loginEmail = (document.getElementById('loginEmail')?.value    || '').trim();
          const loginPwd   = (document.getElementById('loginPassword')?.value || '').trim();
          const loginBtn   = document.querySelector('#screenLoginForm .accentBtn.nextBtn');
          if(loginBtn) loginBtn.disabled = true;
          (async () => {
            try {
              const { user, profile, achievements } = await apiLogin(loginEmail, loginPwd);
              applyProfileToState(user, profile, achievements || []);
              saveToStorage();
              if(user.role === 'employer'){ showEmployerDashboard(); }
              else if(user.role === 'admin'){ show('adminQueue'); }
              else { showEmployeeDashboard(); }
            } catch(err) {
              showToast('Ошибка входа: ' + err.message);
              if(loginBtn) loginBtn.disabled = false;
            }
          })();
          return;
        }

        if(route === 'toEmployerProfile'){
          hydrateEmployerForm();
          show('myEmployerProfile');
          setTimeout(() => {
            wireProofs();
            wireDropZones();
            wireAvatar('mpEAvatar', 'mpEAvatarHint', 'mpEAvatarImg', 'employer');
          }, 0);
          return;
        }

        if(route === 'toEmployeeProfile'){
          hydrateEmployeeForm();
          show('myEmployeeProfile');
          setTimeout(() => {
            wireProofs();
            wireDropZones();
            wireAvatar('mpCAvatar', 'mpCAvatarHint', 'mpCAvatarImg', 'employee');
          }, 0);
          return;
        }

        if(route === 'saveEmployerProfile'){
          const p = state.employer;
          p.fullName     = (document.getElementById('mpEFullName')?.value    || '').trim();
          p.title        = (document.getElementById('mpETitle')?.value       || '').trim() || 'HR Manager';
          p.company      = (document.getElementById('mpECompany')?.value     || '').trim();
          p.foundedYear  = (document.getElementById('mpEFoundedYear')?.value || '').trim();
          p.location     = (document.getElementById('mpELocation')?.value    || '').trim();
          p.industry     = (document.getElementById('mpEIndustry')?.value    || '').trim();
          p.products     = (document.getElementById('mpEProducts')?.value    || '').trim();
          p.website      = (document.getElementById('mpEWebsite')?.value     || '').trim();
          p.about        = (document.getElementById('mpEAbout')?.value       || '').trim();
          p.activeProjects    = (document.getElementById('mpEProjects')?.value  || '').trim();
          p.neededSpecialists = (document.getElementById('mpENeeded')?.value    || '').trim();
          p.telegram     = (document.getElementById('mpETelegram')?.value    || '').trim();
          p.corpEmail    = (document.getElementById('mpECorpEmail')?.value   || '').trim();
          p.phone        = (document.getElementById('mpEPhone')?.value       || '').trim();
          const emailValE = (document.getElementById('mpEEmail')?.value || '').trim();
          if(emailValE) state.email = emailValE;
          p.email = state.email;
          renderRecruiterPublic();
          saveToStorage();
          showToast('Профиль сохранён ✓');
          showEmployerDashboard();
          // API save (non-blocking)
          if(getToken()) apiSaveProfile({
            full_name: p.fullName, title: p.title, company: p.company,
            founded_year: p.foundedYear, location: p.location, industry: p.industry,
            products: p.products, website: p.website, about: p.about,
            active_projects: p.activeProjects, needed: p.neededSpecialists,
            telegram: p.telegram, corp_email: p.corpEmail, phone: p.phone, email: p.email,
            avatar_url: p.avatarDataUrl || ''
          }).then(()=>showToast('Профиль сохранён ✓')).catch(e=>showToast('Сохранено локально'));
          else showToast('Профиль сохранён ✓');
          return;
        }

        if(route === 'saveEmployeeProfile'){
          const p = state.employee;
          p.fullName  = (document.getElementById('mpCFullName')?.value  || '').trim();
          p.city      = (document.getElementById('mpCCity')?.value      || '').trim();
          p.phone     = (document.getElementById('mpCPhone')?.value     || '').trim();
          p.about     = (document.getElementById('mpCAbout')?.value     || '').trim();
          p.eduPlace  = (document.getElementById('mpCEduPlace')?.value  || '').trim();
          p.eduYear   = (document.getElementById('mpCEduYear')?.value   || '').trim();
          p.vacancies = (document.getElementById('mpCVacancies')?.value || '').trim();
          p.telegram  = (document.getElementById('mpCTelegram')?.value  || '').trim();
          p.current_job=(document.getElementById('mpCCurrentJob')?document.getElementById('mpCCurrentJob').value:'').trim();
          p.job_title=(document.getElementById('mpCJobTitle')?document.getElementById('mpCJobTitle').value:'').trim();
          p.work_exp=getWorkExpData();
          const emailValC = (document.getElementById('mpCEmail')?.value || '').trim();
          if(emailValC) state.email = emailValC;
          p.email = state.email;
          renderEmployeePublic();
          saveToStorage();
          showToast('Профиль сохранён ✓');
          showEmployeeDashboard();
          if(getToken()) apiSaveProfile({
            full_name: p.fullName, location: p.city, phone: p.phone,
            about: p.about, edu_place: p.eduPlace, edu_year: p.eduYear,
            vacancies: p.vacancies, telegram: p.telegram, email: p.email,
            current_job: p.current_job, job_title: p.job_title, work_exp: p.work_exp,
            cv_public: !!p.cvPublic,
            avatar_url: p.avatarDataUrl || ''
          }).then(()=>showToast('Профиль сохранён ✓')).catch(()=>showToast('Сохранено локально'));
          else showToast('Профиль сохранён ✓');
          return;
        }

        if(route === 'toAuthFromProfile'){
          logout();
          show('auth');
          return;
        }

        if(route === 'deleteOwnAccount'){
          var isEmployer = screens.myEmployerProfile?.classList.contains('active');
          var passwordInput = document.getElementById(isEmployer ? 'deleteAccountPasswordE' : 'deleteAccountPasswordC');
          var password = (passwordInput?.value || '').trim();
          if(!password){
            showToast('Введите пароль для подтверждения');
            passwordInput?.focus();
            return;
          }
          if(!confirm('Удалить аккаунт без возможности восстановления? Это действие необратимо.')) return;
          var deleteBtn = next;
          deleteBtn.disabled = true;
          var initialLabel = deleteBtn.textContent;
          deleteBtn.textContent = 'Удаляем...';
          deleteOwnAccount(password).then(function () {
            if(passwordInput) passwordInput.value = '';
            show('auth');
            showToast('Аккаунт удалён');
          }).catch(function (err) {
            if(passwordInput) passwordInput.value = '';
            if(/Invalid password/i.test(err.message || '')) showToast('Неверный пароль');
            else if(/Admin account self-delete is disabled/i.test(err.message || '')) showToast('Самоудаление аккаунта администратора отключено');
            else showToast('Ошибка: ' + err.message);
          }).finally(function () {
            deleteBtn.disabled = false;
            deleteBtn.textContent = initialLabel;
          });
          return;
        }


        if(route === 'toAuthHome'){
          show('auth');
          return;
        }

        if(route === 'toForgot'){
          // Clear forgot form
          const fe = document.getElementById('forgotEmail'); if(fe) fe.value='';
          document.getElementById('sqInputForgotEmail')?.classList.remove('inputError');
          document.getElementById('forgotEmailError')?.classList.add('hidden');
          show('forgot');
          return;
        }

        if(route === 'toCandidateFeed')    { showEmployeeDashboard(); return; }
        if(route === 'toEmployerSearch')   { showEmployerDashboard(); return; }
        if(route === 'toEmployerDashboard'){ showEmployerDashboard(); return; }
        if(route === 'toEmployeeDashboard'){ showEmployeeDashboard(); return; }

        if(route === 'toDashboard'){
          const role = state.roleReg || 'EMPLOYEE';
          if(role === 'ADMIN'){
            show('adminQueue');
          } else if(role === 'EMPLOYER'){
            renderRecruiterPublic();
            show('employerSearch');
          } else {
            renderEmployeePublic();
            show('candidateFeed');
          }
          return;
        }

        return;
      }

      const back = e.target.closest('[data-back]');
      if(back){
        const where = back.dataset.back;
        if(where === 'toLogo'){ clearAuthInputs(); show('logo'); setTimeout(resetLogo, 10); return; }
        if(where === 'toAuth'){ clearAuthInputs(); show('auth'); return; }
        if(where === 'toRoleReg'){ show('roleReg'); return; }
        if(where === 'toLoginForm'){ show('loginForm'); return; }
        if(where === 'toForgot'){ show('forgot'); return; }
        if(where === 'toVerifyCode'){ show('verifyCode'); return; }
        if(where === 'toPrevFromDone'){ show(state.prevFromDone || 'auth'); return; }
        if(where === 'toRecruiterPublic'){ renderRecruiterPublic(); show('recruiterPublic'); return; }
        if(where === 'toEmployeePublic'){ renderEmployeePublic(); show('employeePublic'); return; }
        if(where === 'toEmployerDashboard'){ showEmployerDashboard(); return; }
        if(where === 'toEmployeeDashboard'){ showEmployeeDashboard(); return; }
        if(where === 'toCandidateFeed')    { showEmployeeDashboard(); return; }
        if(where === 'toEmployerSearch')   { showEmployerDashboard(); return; }
        return;
      }
    });

    // ESC navigation
    window.addEventListener('keydown', (e) => {
      if(e.key !== 'Escape') return;
      if(screens.myEmployerProfile?.classList.contains('active')){ renderRecruiterPublic(); show('recruiterPublic'); return; }
      if(screens.myEmployeeProfile?.classList.contains('active')){ renderEmployeePublic(); show('employeePublic'); return; }
      if(screens.recruiterPublic?.classList.contains('active') || screens.employeePublic?.classList.contains('active')){ show('auth'); return; }
      if(screens.resetPassword?.classList.contains('active')){ show('verifyCode'); return; }
      if(screens.verifyCode?.classList.contains('active')){ show('forgot'); return; }
      if(screens.forgot?.classList.contains('active')){ show('loginForm'); return; }
      if(screens.regForm?.classList.contains('active')){ show('roleReg'); return; }
      if(screens.roleReg?.classList.contains('active')){ show('auth'); return; }
      if(screens.loginForm?.classList.contains('active')){ show('auth'); return; }
      if(screens.auth?.classList.contains('active')){ show('logo'); setTimeout(resetLogo, 10); return; }
    });

    // initial — always show logo, no auto-login ever
    show('logo');

    document.addEventListener('change', (e) => {
      const t = e.target;
      if(!t) return;
      if(t.id === 'consentTerms' || t.id === 'consentPd' || t.id === 'consentRole'){
        clearConsentError();
      }
    });

    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-doc]') : null;
      if(!el) return;
      const which = el.dataset.doc;
      if(which === 'terms') window.open('#terms', '_blank');
      if(which === 'privacy') window.open('#privacy', '_blank');
    });

    // Drawer + modal
