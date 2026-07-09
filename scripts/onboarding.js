/* Candidate onboarding: 3-step wizard on screenDone + return checklist on own profile. */

var ONB_MAX_FILE_BYTES = 10 * 1024 * 1024;

var _onb = {
  jobWarned: false,
  docType: 'education',
  file: null,
  uploading: false,
};

function onbEl(id) {
  return document.getElementById(id);
}

/* Plain message view on screenDone (password reset success etc.). */
function showDoneMessage(text, backTo) {
  var candidateView = onbEl('doneViewCandidate');
  var employerView = onbEl('doneViewEmployer');
  var messageView = onbEl('doneViewMessage');
  var doneTextEl = onbEl('doneText');
  if (candidateView) candidateView.classList.add('hidden');
  if (employerView) employerView.classList.add('hidden');
  if (messageView) messageView.classList.remove('hidden');
  if (doneTextEl) doneTextEl.textContent = text || 'Готово';
  state.prevFromDone = backTo || 'landing';
  show('done');
}

function onbShowStep(step) {
  var steps = { 1: 'onbStep1', 2: 'onbStep2', 3: 'onbStep3', success: 'onbStepSuccess' };
  Object.keys(steps).forEach(function (key) {
    var el = onbEl(steps[key]);
    if (el) el.classList.toggle('hidden', String(key) !== String(step));
  });

  var dotStep = step === 'success' ? 3 : Number(step) || 1;
  var dots = document.querySelectorAll('#onbProgress .onbDot');
  for (var i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('active', Number(dots[i].getAttribute('data-onb-dot')) <= dotStep);
  }
  var label = onbEl('onbStepLabel');
  if (label) label.textContent = 'Шаг ' + dotStep + ' из 3';
  var progress = onbEl('onbProgress');
  if (progress) progress.classList.toggle('hidden', step === 'success');
}

function onbPrefillStep2() {
  var p = state.employee || {};
  var jobInput = onbEl('onbJobInput');
  if (jobInput) jobInput.value = p.vacancies || '';

  var grade = String(p.grade || '').toLowerCase();
  var gradeChips = document.querySelectorAll('#onbGradeChips .onbChip');
  for (var i = 0; i < gradeChips.length; i++) {
    gradeChips[i].classList.toggle('selected', gradeChips[i].getAttribute('data-onb-grade') === grade);
  }

  var formats = String(p.workFormat || '').toLowerCase().split(',');
  var formatChips = document.querySelectorAll('#onbFormatChips .onbChip');
  for (var j = 0; j < formatChips.length; j++) {
    formatChips[j].classList.toggle('selected', formats.indexOf(formatChips[j].getAttribute('data-onb-format')) !== -1);
  }

  var looking = onbEl('onbLookingToggle');
  if (looking) looking.checked = !!p.lookingForWork;

  var jobError = onbEl('onbJobError');
  if (jobError) jobError.classList.add('hidden');
  _onb.jobWarned = false;
}

function onbResetStep3() {
  _onb.file = null;
  _onb.uploading = false;
  var input = onbEl('onbFileInput');
  if (input) { try { input.value = ''; } catch (e) {} }
  var uploading = onbEl('onbUploading');
  var uploadError = onbEl('onbUploadError');
  var retryBtn = onbEl('onbRetryBtn');
  if (uploading) uploading.classList.add('hidden');
  if (uploadError) uploadError.classList.add('hidden');
  if (retryBtn) retryBtn.classList.add('hidden');
}

function startCandidateOnboarding(options) {
  var opts = options || {};
  var candidateView = onbEl('doneViewCandidate');
  var employerView = onbEl('doneViewEmployer');
  var messageView = onbEl('doneViewMessage');
  if (candidateView) candidateView.classList.remove('hidden');
  if (employerView) employerView.classList.add('hidden');
  if (messageView) messageView.classList.add('hidden');

  var title = onbEl('onbWelcomeTitle');
  if (title) {
    var firstName = String(state.employee && state.employee.fullName || '').trim().split(/\s+/)[0] || '';
    title.textContent = firstName ? firstName + ', добро пожаловать в LOMO' : 'Добро пожаловать в LOMO';
  }

  onbPrefillStep2();
  onbResetStep3();
  state.prevFromDone = 'candidateFeed';
  show('done');
  onbShowStep(opts.step || 1);
}

function onbGoDashboard() {
  if (typeof showEmployeeDashboard === 'function') showEmployeeDashboard();
  else show('candidateFeed');
}

function onbSyncStep(step) {
  if (state.onboarding && state.onboarding.step < step) state.onboarding.step = step;
  if (typeof getToken === 'function' && getToken()) {
    apiSetOnboardingStep(step).catch(function () {});
  }
}

function onbSubmitStep2() {
  var jobInput = onbEl('onbJobInput');
  var jobError = onbEl('onbJobError');
  var job = (jobInput && jobInput.value || '').trim();

  if (!job && !_onb.jobWarned) {
    _onb.jobWarned = true;
    if (jobError) jobError.classList.remove('hidden');
    return;
  }
  if (jobError) jobError.classList.add('hidden');

  var gradeChip = document.querySelector('#onbGradeChips .onbChip.selected');
  var grade = gradeChip ? gradeChip.getAttribute('data-onb-grade') : '';
  var formatChips = document.querySelectorAll('#onbFormatChips .onbChip.selected');
  var formats = [];
  for (var i = 0; i < formatChips.length; i++) formats.push(formatChips[i].getAttribute('data-onb-format'));
  var lookingToggle = onbEl('onbLookingToggle');
  var looking = !!(lookingToggle && lookingToggle.checked);

  var p = state.employee;
  if (job) p.vacancies = job;
  p.grade = grade || '';
  p.workFormat = formats.join(',');
  p.lookingForWork = looking;
  if (typeof saveToStorage === 'function') saveToStorage();

  if (typeof getToken === 'function' && getToken()) {
    var payload = {
      grade: p.grade,
      work_format: p.workFormat,
      looking_for_work: looking,
    };
    if (job) payload.vacancies = job;
    apiSaveProfile(payload).catch(function () {});
  }

  onbSyncStep(2);
  onbResetStep3();
  onbShowStep(3);
}

function onbProofKeyForDocType(docType) {
  return docType === 'work' ? 'work' : docType === 'courses' ? 'courses' : 'education';
}

function onbHandleFile(file) {
  if (!file || _onb.uploading) return;
  var uploadError = onbEl('onbUploadError');
  var retryBtn = onbEl('onbRetryBtn');
  if (file.size > ONB_MAX_FILE_BYTES) {
    _onb.file = null;
    if (uploadError) uploadError.classList.remove('hidden');
    if (retryBtn) retryBtn.classList.add('hidden');
    return;
  }
  _onb.file = file;
  onbUploadFile();
}

function onbUploadFile() {
  var file = _onb.file;
  if (!file || _onb.uploading) return;

  var uploading = onbEl('onbUploading');
  var uploadError = onbEl('onbUploadError');
  var retryBtn = onbEl('onbRetryBtn');
  _onb.uploading = true;
  if (uploading) uploading.classList.remove('hidden');
  if (uploadError) uploadError.classList.add('hidden');
  if (retryBtn) retryBtn.classList.add('hidden');

  var docType = _onb.docType || 'education';
  var proofKey = onbProofKeyForDocType(docType);
  var proof = state.employee.proofs[proofKey];

  apiUploadFile(file)
    .then(function (uploaded) {
      var achievementPromise;
      if (proof && proof.achievementId) {
        achievementPromise = Promise.resolve({ id: proof.achievementId });
      } else {
        achievementPromise = apiCreateAchievement(docType, DOC_TYPE_LABELS[docType] || docType, '');
      }
      return achievementPromise.then(function (achievement) {
        return apiAttachDocument(achievement.id, uploaded.fileUrl, uploaded.fileName).then(function (doc) {
          if (proof) {
            proof.achievementId = achievement.id;
            proof.docId = (doc && doc.id) || proof.docId;
            proof.fileName = uploaded.fileName;
            proof.status = 'на рассмотрении';
            proof.rejectReason = '';
          }
          if (typeof saveToStorage === 'function') saveToStorage();
        });
      });
    })
    .then(function () {
      _onb.uploading = false;
      if (uploading) uploading.classList.add('hidden');
      onbSyncStep(3);
      onbShowStep('success');
    })
    .catch(function () {
      // File is kept in _onb.file so «Повторить» can resend it without re-picking.
      _onb.uploading = false;
      if (uploading) uploading.classList.add('hidden');
      if (uploadError) uploadError.classList.remove('hidden');
      if (retryBtn) retryBtn.classList.remove('hidden');
    });
}

/* ── Return checklist on the candidate's own profile ─────────────────── */

function onbChecklistShouldHide() {
  var onb = state.onboarding || emptyOnboarding();
  if (onb.checklistDismissCount >= 2) return true;
  if (onb.checklistDismissCount === 1 && onb.checklistHiddenUntil) {
    var hiddenUntil = new Date(onb.checklistHiddenUntil).getTime();
    if (isFinite(hiddenUntil) && Date.now() < hiddenUntil) return true;
  }
  return false;
}

function onbHasUploadedDocument() {
  var proofs = state.employee && state.employee.proofs || {};
  return Object.keys(proofs).some(function (key) {
    var proof = proofs[key];
    return !!(proof && (proof.docId || proof.fileName) && proof.status !== 'не загружено');
  });
}

function renderOnboardingChecklist() {
  var box = onbEl('onbChecklist');
  if (!box) return;

  var onb = state.onboarding || emptyOnboarding();
  var isCandidate = state.roleReg === 'EMPLOYEE' && !!state.userId;
  if (!isCandidate || onb.step >= 3) {
    box.classList.add('hidden');
    return;
  }

  var formDone = onb.step >= 2;
  var docDone = onbHasUploadedDocument();
  if (formDone && docDone) {
    onbSyncStep(3);
    box.classList.add('hidden');
    return;
  }
  if (onbChecklistShouldHide()) {
    box.classList.add('hidden');
    return;
  }

  box.innerHTML =
    '<div class="onbChecklistHead">' +
      '<span class="onbChecklistTitle">Профиль почти готов</span>' +
      '<button type="button" class="onbChecklistClose" id="onbChecklistClose" aria-label="Скрыть">×</button>' +
    '</div>' +
    '<div class="onbChecklistItem done">☑ Аккаунт создан</div>' +
    '<div class="onbChecklistItem' + (formDone ? ' done' : '') + '">' +
      (formDone ? '☑' : '☐') + ' Заполнена анкета' +
      (formDone ? '' : ' — <button type="button" class="onbChecklistLink" id="onbChecklistFill">Заполнить</button>') +
    '</div>' +
    '<div class="onbChecklistItem' + (docDone ? ' done' : '') + '">' +
      (docDone ? '☑' : '☐') + ' Загружен документ' +
      (docDone ? '' : ' — <button type="button" class="onbChecklistLink" id="onbChecklistUpload">Загрузить</button>') +
    '</div>';
  box.classList.remove('hidden');
}

function onbDismissChecklist() {
  var box = onbEl('onbChecklist');
  if (box) box.classList.add('hidden');
  var onb = state.onboarding || emptyOnboarding();
  onb.checklistDismissCount += 1;
  apiDismissOnboardingChecklist().then(function (result) {
    onb.checklistDismissCount = Number(result.dismissCount) || onb.checklistDismissCount;
    onb.checklistHiddenUntil = result.hiddenUntil || onb.checklistHiddenUntil;
  }).catch(function () {});
}

/* ── Employer onboarding: welcome cards → prefilled AI matching ──────── */

var ONB_EMPLOYER_EXAMPLE = 'Ищем мидл frontend-разработчика: React, TypeScript, опыт от 2 лет, удалённо, до 250 000 ₽';

function showEmployerOnboardingStep2() {
  var step1 = onbEl('doneViewEmployer');
  var step2 = onbEl('doneViewEmployerStep2');
  var input = onbEl('onbEmployerJobInput');
  if (step1) step1.classList.add('hidden');
  if (step2) step2.classList.remove('hidden');
  // Prefill as a real value (editable, kept on focus) — only when empty, so a
  // returning user's own text is never overwritten. One click then yields results.
  if (input && !input.value.trim()) input.value = ONB_EMPLOYER_EXAMPLE;
}

function onbEmployerGoDashboard() {
  if (typeof showEmployerDashboard === 'function') showEmployerDashboard();
  else show('employerSearch');
}

function onbEmployerRunMatch() {
  var input = onbEl('onbEmployerJobInput');
  var text = input ? input.value.trim() : '';

  onbEmployerGoDashboard();

  // Reuse the shared AI-match modal + engine (no duplicated result rendering):
  // open it, hand over the text, and trigger the existing run in one click.
  var openBtn = document.getElementById('btnOpenAiMatch');
  if (openBtn) openBtn.click();

  var ta = document.getElementById('aiMatchTextarea');
  if (ta && text) {
    ta.value = text;
    ta.dispatchEvent(new Event('input'));
  }
  if (text) {
    var runBtn = document.getElementById('btnRunAiMatch');
    if (runBtn) runBtn.click();
  }
}

/* ── Wiring ──────────────────────────────────────────────────────────── */

(function initOnboardingUi() {
  function bind(id, handler) {
    var el = onbEl(id);
    if (el) el.addEventListener('click', handler);
  }

  bind('doneCtaEmployer', function () { showEmployerOnboardingStep2(); });
  bind('onbEmployerMatchBtn', function () { onbEmployerRunMatch(); });
  bind('onbEmployerSkip', function () { onbEmployerGoDashboard(); });

  bind('onbStep1Next', function () { onbShowStep(2); });
  bind('onbSkipAll', function () { onbGoDashboard(); });
  bind('onbStep2Next', function () { onbSubmitStep2(); });
  bind('onbSkipDoc', function () {
    onbSyncStep(2);
    onbGoDashboard();
  });
  bind('onbRetryBtn', function () { onbUploadFile(); });
  bind('onbGoProfile', function () {
    if (typeof goToMyProfile === 'function') goToMyProfile();
    else onbGoDashboard();
  });
  bind('doneMsgCta', function () {
    show(state.prevFromDone || 'landing');
  });

  var gradeChips = onbEl('onbGradeChips');
  if (gradeChips) {
    gradeChips.addEventListener('click', function (event) {
      var chip = event.target && event.target.closest ? event.target.closest('.onbChip') : null;
      if (!chip) return;
      var wasSelected = chip.classList.contains('selected');
      var chips = gradeChips.querySelectorAll('.onbChip');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('selected');
      if (!wasSelected) chip.classList.add('selected');
    });
  }

  var formatChips = onbEl('onbFormatChips');
  if (formatChips) {
    formatChips.addEventListener('click', function (event) {
      var chip = event.target && event.target.closest ? event.target.closest('.onbChip') : null;
      if (chip) chip.classList.toggle('selected');
    });
  }

  var docTypeChips = onbEl('onbDocTypeChips');
  if (docTypeChips) {
    docTypeChips.addEventListener('click', function (event) {
      var chip = event.target && event.target.closest ? event.target.closest('.onbChip') : null;
      if (!chip) return;
      var chips = docTypeChips.querySelectorAll('.onbChip');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('selected');
      chip.classList.add('selected');
      _onb.docType = chip.getAttribute('data-onb-doctype') || 'education';
    });
  }

  var fileInput = onbEl('onbFileInput');
  var dropZone = onbEl('onbDropZone');
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      onbHandleFile(fileInput.files && fileInput.files[0] ? fileInput.files[0] : null);
      try { fileInput.value = ''; } catch (e) {}
    });
    fileInput._lomoHandleFiles = function (files) {
      onbHandleFile(files && files[0] ? files[0] : null);
    };
    if (typeof bindNativeInputPicker === 'function') {
      bindNativeInputPicker(fileInput, fileInput._lomoHandleFiles);
    }
  }
  bind('onbPickFileBtn', function () {
    if (!fileInput) return;
    if (typeof openPickerForInput === 'function' && typeof getPickerOptionsFromInput === 'function') {
      openPickerForInput(fileInput, getPickerOptionsFromInput(fileInput), fileInput._lomoHandleFiles);
    } else {
      fileInput.click();
    }
  });
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () {
      if (typeof openPickerForInput === 'function' && typeof getPickerOptionsFromInput === 'function') {
        openPickerForInput(fileInput, getPickerOptionsFromInput(fileInput), fileInput._lomoHandleFiles);
      } else {
        fileInput.click();
      }
    });
    dropZone.addEventListener('dragover', function (event) {
      event.preventDefault();
      dropZone.classList.add('dropZone--over');
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('dropZone--over');
    });
    dropZone.addEventListener('drop', function (event) {
      event.preventDefault();
      dropZone.classList.remove('dropZone--over');
      var files = event.dataTransfer && event.dataTransfer.files;
      onbHandleFile(files && files[0] ? files[0] : null);
    });
  }

  var checklistBox = onbEl('onbChecklist');
  if (checklistBox) {
    checklistBox.addEventListener('click', function (event) {
      var target = event.target;
      if (!target) return;
      if (target.id === 'onbChecklistClose') { onbDismissChecklist(); return; }
      if (target.id === 'onbChecklistFill') { startCandidateOnboarding({ step: 2 }); return; }
      if (target.id === 'onbChecklistUpload') { startCandidateOnboarding({ step: 3 }); return; }
    });
  }
})();
