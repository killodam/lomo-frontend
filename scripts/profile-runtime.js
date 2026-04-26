function applyChip(elId, status) {
  const el = document.getElementById(elId);
  if (!el) return;
  const safeStatus = (status || '').toLowerCase();
  el.classList.remove('warn', 'bad', 'ok', 'ghost');
  if (safeStatus.includes('подтверж')) {
    el.classList.add('ok');
    el.textContent = 'подтверждено';
  } else if (safeStatus.includes('рассмотр') || safeStatus.includes('провер')) {
    el.classList.add('warn');
    el.textContent = 'на рассмотрении';
  } else if (safeStatus.includes('отклон')) {
    el.classList.add('bad');
    el.textContent = 'отклонено';
  } else if (safeStatus.includes('не загруж')) {
    el.classList.add('ghost');
    el.textContent = 'не загружено';
  } else {
    el.classList.add('ghost');
    el.textContent = status || '—';
  }
}

function setHidden(target, isHidden) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return null;
  el.classList.toggle('hidden', !!isHidden);
  return el;
}

function setPairHidden(first, second, isHidden) {
  setHidden(first, isHidden);
  setHidden(second, isHidden);
}

function setProgressWidth(target, value) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  if (!el) return safeValue;
  el.style.setProperty('--progress-width', safeValue + '%');
  return safeValue;
}

function renderRecruiterPublic() {
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
  if (productsEl && productsTitleEl) {
    productsEl.textContent = p.products || '';
    setPairHidden(productsEl, productsTitleEl, !p.products);
  }

  const projectsList = document.getElementById('rpProjectsList');
  const projectsTitle = document.getElementById('rpProjectsTitle');
  if (projectsList) {
    projectsList.innerHTML = '';
    const projects = (p.activeProjects || '').split(';').map(function (value) { return value.trim(); }).filter(Boolean);
    if (projects.length) {
      setHidden(projectsTitle, false);
      projects.forEach(function (project) {
        const el = document.createElement('div');
        el.className = 'projectItem';
        el.innerHTML = '<div class="projectDot"></div>' + escapeHtml(project);
        projectsList.appendChild(el);
      });
    } else {
      setHidden(projectsTitle, true);
    }
  }

  const tagsEl = document.getElementById('rpNeededTags');
  const tagsTitle = document.getElementById('rpNeededTitle');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    const tags = (p.neededSpecialists || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean);
    if (tags.length) {
      setHidden(tagsTitle, false);
      tags.forEach(function (tag) {
        const el = document.createElement('span');
        el.className = 'tag';
        el.textContent = tag;
        tagsEl.appendChild(el);
      });
    } else {
      setHidden(tagsTitle, true);
    }
  }

  var salaryOfferSec = document.getElementById('rpSalaryOfferSection');
  var salaryOfferVal = (p.salaryOffer || '').trim();
  if (salaryOfferSec) salaryOfferSec.style.display = salaryOfferVal ? '' : 'none';
  setText('rpSalaryOffer', salaryOfferVal);

  applyChip('rpCompanyDocChip', p.proofs?.companyDoc?.status);
  setAvatar('rpAvatarImg', p.avatarDataUrl);

  // Corp email verified badge
  const badgeRow = document.getElementById('rpCorpEmailBadgeRow');
  if (badgeRow) setHidden(badgeRow, !p.corpEmailVerified);

  var rpIsVerified = p.proofs?.companyDoc?.status === 'одобрено';
  if (typeof showVerifBannerIfNeeded === 'function') showVerifBannerIfNeeded('rpVerifBanner', rpIsVerified);
}

function renderEmployeePublic() {
  const p = state.employee;
  setText('epName', (p.fullName || 'Имя Фамилия').trim());
  setText('epCity', (p.city || '').trim());
  setText('epEduPlace', (p.eduPlace || '—').trim() || '—');
  setText('epEduYear', (p.eduYear || '—').trim() || '—');
  setText('epVacancies', (p.vacancies || '—').trim() || '—');
  setText('epEmail', (state.email || p.email || 'email@example.com').trim());
  setText('epTg', p.telegram ? (p.telegram.startsWith('@') ? p.telegram : '@' + p.telegram) : '—');

  const phoneEl = document.getElementById('epPhone');
  if (phoneEl) {
    phoneEl.textContent = p.phone || '';
    setHidden(phoneEl, !p.phone);
  }

  var salarySec = document.getElementById('epSalarySection');
  var salaryVal = (p.salaryExpectations || '').trim();
  if (salarySec) salarySec.style.display = salaryVal ? '' : 'none';
  setText('epSalary', salaryVal || '—');

  var lookingBadge = document.getElementById('epLookingBadge');
  if (lookingBadge) lookingBadge.classList.toggle('hidden', !p.lookingForWork);

  const aboutSec = document.getElementById('epAboutSection');
  setHidden(aboutSec, !p.about);
  const aboutEl = document.getElementById('epAbout');
  if (aboutEl) aboutEl.textContent = p.about || '—';

  applyChip('epEduStatusChip', p.proofs?.education?.status);
  applyChip('epWorkStatusChip', p.proofs?.work?.status);
  applyChip('epCourseStatusChip', p.proofs?.courses?.status);
  applyChip('epPassStatusChip', p.proofs?.passport?.status);

  const list = document.getElementById('epPortfolioList');
  if (list) {
    list.innerHTML = '';
    if (p.portfolio && p.portfolio.length) {
      p.portfolio.forEach(function (item, idx) {
        const row = document.createElement('div');
        row.className = 'achRow';
        row.innerHTML = '<div><div class="achTitle">' + escapeHtml(item.name || ('Файл ' + (idx + 1))) + '</div><div class="achMeta">Публичный файл · можно скачать</div></div><button type="button" class="miniLink" data-download="employee:portfolio:' + idx + '">Скачать</button>';
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

  const rejectMap = { edu: 'education', work: 'work', course: 'courses', pass: 'passport' };
  Object.entries(rejectMap).forEach(function ([prefix, key]) {
    const el = document.getElementById('ep' + prefix.charAt(0).toUpperCase() + prefix.slice(1) + 'Reject');
    if (!el) return;
    const proof = p.proofs?.[key];
    if (proof?.rejectReason && proof?.status === 'отклонено') {
      el.innerHTML = '<div class="rejectReasonLabel">Причина отказа</div>' + escapeHtml(proof.rejectReason);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  const cvHintEl = document.getElementById('epCvHint');
  const cvDownBtn = document.getElementById('btnDownloadCV');
  if (!p.cvPublic) {
    if (cvHintEl) cvHintEl.textContent = 'Скрыто · доступ по запросу';
    if (cvDownBtn) cvDownBtn.classList.add('hidden');
  } else if (cvDownBtn && (p.proofs?.cv?.docId || p.proofs?.cv?.url)) {
    cvDownBtn.classList.remove('hidden');
  }

  var epProofs = p.proofs || {};
  var epIsVerified = ['education','work','courses','passport'].some(function (k) {
    return epProofs[k] && epProofs[k].status === 'одобрено';
  });
  if (typeof showVerifBannerIfNeeded === 'function') showVerifBannerIfNeeded('epVerifBanner', epIsVerified);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>\"']/g, function (char) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char];
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setAvatar(imgId, dataUrl) {
  const img = document.getElementById(imgId);
  if (!img) return;
  if (dataUrl) {
    img.src = dataUrl;
    setHidden(img, false);
  } else {
    img.removeAttribute('src');
    setHidden(img, true);
  }
}

function normalizeTg(tg) {
  if (!tg) return '';
  let value = tg.trim();
  if (!value) return '';
  if (value.startsWith('@')) value = value.slice(1);
  value = value.replace(/^https?:\/\/(www\.)?t\.me\//i, '');
  return value;
}

function openEmployerContact() {
  const tg = normalizeTg(state.employer.telegram);
  if (tg) {
    window.open('https://t.me/' + encodeURIComponent(tg), '_blank');
    return;
  }
  const email = (state.employer.corpEmail || state.employer.email || state.email || '').trim();
  if (email) {
    window.location.href = 'mailto:' + email;
    return;
  }
  const phone = (state.employer.phone || '').trim();
  if (phone) {
    window.location.href = 'tel:' + phone.replace(/\s/g, '');
    return;
  }
  showToast('Добавьте Telegram, корпоративную почту или телефон в профиле компании.');
}

function publicProfileUrl() {
  return publicProfileUrlForId(state.publicId || 'LOMO-00000000');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Ссылка скопирована');
  } catch (error) {
    prompt('Скопируй ссылку:', text);
  }
}

function openMail() {
  const email = (state.email || '').trim();
  if (!email) {
    showToast('Почта не указана');
    return;
  }
  window.location.href = 'mailto:' + email;
}

async function openSecureDocument(docId, fileName) {
  if (!docId) throw new Error('Файл недоступен');
  const popup = window.open('', '_blank');
  try {
    const blob = await apiFetchBlob('/files/' + encodeURIComponent(docId));
    const url = URL.createObjectURL(blob);
    if (popup) popup.location = url;
    else window.open(url, '_blank');
    setTimeout(function () {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {}
    }, 60000);
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
}

async function downloadSecureDocument(docId, fileName) {
  if (!docId) throw new Error('Файл недоступен');
  const blob = await apiFetchBlob('/files/' + encodeURIComponent(docId));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {}
  }, 1000);
}

async function downloadProof(proof, fallbackName) {
  if (proof?.url) {
    const a = document.createElement('a');
    a.href = proof.url;
    a.download = proof.fileName || fallbackName || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  if (proof?.docId) {
    return downloadSecureDocument(proof.docId, proof.fileName || fallbackName || 'document');
  }
  throw new Error('Файл не загружен');
}

async function downloadEmployeeCV() {
  try {
    await downloadProof(state.employee?.proofs?.cv, 'CV');
  } catch (error) {
    showToast(error.message);
  }
}

function refreshEmployeeCVButton() {
  const btn = document.getElementById('btnDownloadCV');
  if (!btn) return;
  if (state.employee?.proofs?.cv?.url || state.employee?.proofs?.cv?.docId) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

async function downloadRecruiterCV() {
  try {
    await downloadProof(state.employer?.proofs?.cv, 'CV');
  } catch (error) {
    showToast(error.message);
  }
}

function hydrateEmployerForm() {
  resetProfileTabs('screenMyEmployerProfile');
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
  setVal('mpESalaryOffer', p.salaryOffer);
  setVal('mpEEmail', state.email || p.email);
  setVal('mpECorpEmail', p.corpEmail);
  setVal('mpEPhone', p.phone);
  setVal('mpETelegram', p.telegram);
  setAvatar('mpEAvatarImg', p.avatarDataUrl);
  setText('mpEAvatarHint', p.avatarDataUrl ? 'Логотип выбран' : 'Логотип не выбран');
  setStatusTag('companyDocStatusE', p.proofs?.companyDoc?.status || 'не загружено');
  setText('companyDocHintE', p.proofs?.companyDoc?.fileName ? ('Прикреплено: ' + p.proofs.companyDoc.fileName) : 'Файл не выбран');

  // Corp email verification status
  const corpVerifyRow = document.getElementById('corpVerifyRow');
  const corpStatusEl = document.getElementById('corpEmailVerifiedStatus');
  const corpVerifyBtn = document.getElementById('btnSendCorpVerify');
  if (corpVerifyRow) setHidden(corpVerifyRow, !p.corpEmail);
  if (corpStatusEl) {
    corpStatusEl.textContent = p.corpEmailVerified ? 'подтверждена ✓' : 'не подтверждена';
    corpStatusEl.className = 'statusTag' + (p.corpEmailVerified ? ' ok' : '');
  }
  if (corpVerifyBtn) setHidden(corpVerifyBtn, !!p.corpEmailVerified);
}

function hydrateEmployeeForm() {
  resetProfileTabs('screenMyEmployeeProfile');
  const p = state.employee;
  setVal('mpCFullName', p.fullName);
  setVal('mpCCity', p.city);
  setVal('mpCPhone', p.phone);
  setVal('mpCAbout', p.about);
  setVal('mpCEduPlace', p.eduPlace);
  setVal('mpCEduYear', p.eduYear);
  setVal('mpCVacancies', p.vacancies);
  setVal('mpCSalary', p.salaryExpectations);
  var lookingCb = document.getElementById('mpCLookingForWork');
  if (lookingCb) lookingCb.checked = !!p.lookingForWork;
  setVal('mpCCurrentJob', p.current_job);
  setVal('mpCJobTitle', p.job_title);
  var epJobSection = document.getElementById('epJobSection');
  var epJobLine = document.getElementById('epJobLine');
  if (epJobLine) {
    var jobComp = (p.current_job && p.current_job !== 'Не работаю') ? p.current_job : '';
    var jobRole = p.job_title || '';
    var jobText = [jobComp, jobRole].filter(Boolean).join(' · ');
    epJobLine.textContent = jobText || '—';
    if (epJobSection) epJobSection.style.display = jobText ? '' : 'none';
  }
  setVal('mpCCorpEmail', p.corpEmail);
  var workList = document.getElementById('workExpList');
  if (workList) workList.innerHTML = '';
  if (p.work_exp && p.work_exp.length) setTimeout(function () { loadWorkExpData(p.work_exp); }, 50);
  setVal('mpCEmail', state.email || p.email);
  setVal('mpCTelegram', p.telegram);
  setAvatar('mpCAvatarImg', p.avatarDataUrl);
  setText('mpCAvatarHint', p.avatarDataUrl ? 'Фото выбрано' : 'Фото не выбрано');
  setStatusTag('cvStatusC', p.proofs?.cv?.status || 'не загружено');
  setText('cvHintC', p.proofs?.cv?.fileName ? ('Прикреплено: ' + p.proofs.cv.fileName) : 'Файл не выбран');
  setStatusTag('eduStatusC', p.proofs?.education?.status || 'не загружено');
  setText('eduHintC', p.proofs?.education?.fileName ? ('Прикреплено: ' + p.proofs.education.fileName) : 'Файл не выбран');
  setStatusTag('workStatusC', p.proofs?.work?.status || 'не загружено');
  setText('workHintC', p.proofs?.work?.fileName ? ('Прикреплено: ' + p.proofs.work.fileName) : 'Файл не выбран');
  setStatusTag('courseStatusC', p.proofs?.courses?.status || 'не загружено');
  setText('courseHintC', p.proofs?.courses?.fileName ? ('Прикреплено: ' + p.proofs.courses.fileName) : 'Файл не выбран');
  setStatusTag('passStatusC', p.proofs?.passport?.status || 'не загружено');
  setText('passHintC', p.proofs?.passport?.fileName ? ('Прикреплено: ' + p.proofs.passport.fileName) : 'Файл не выбран');
  const has = p.portfolio && p.portfolio.length;
  setText('portHintC', has ? ('Прикреплено: ' + p.portfolio.length + ' файл(ов)') : 'Файлы не выбраны');
  setStatusTag('portStatusC', has ? 'на рассмотрении' : 'не загружено');

  const corpStatusEl = document.getElementById('corpEmailVerifiedStatusC');
  const corpVerifyBtn = document.getElementById('btnSendCorpVerifyC');
  if (corpStatusEl) {
    corpStatusEl.textContent = p.corpEmailVerified ? 'подтверждена ✓' : 'не подтверждена';
    corpStatusEl.className = 'statusTag' + (p.corpEmailVerified ? ' ok' : '');
  }
  if (corpVerifyBtn) setHidden(corpVerifyBtn, !!p.corpEmailVerified);
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function setStatusTag(id, status) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = status;
  el.classList.remove('ok', 'warn', 'bad', 'ghost');
  const safeStatus = (status || '').toLowerCase();
  if (safeStatus.includes('подтверж')) el.classList.add('ok');
  else if (safeStatus.includes('рассмотр') || safeStatus.includes('провер')) el.classList.add('warn');
  else if (safeStatus.includes('отклон')) el.classList.add('bad');
  else el.classList.add('ghost');
}

function isNativeCapacitorRuntime() {
  if (window.LOMO_PUSH && typeof window.LOMO_PUSH.isNativePlatform === 'function') {
    return !!window.LOMO_PUSH.isNativePlatform();
  }
  if (!window.Capacitor) return false;
  if (typeof window.Capacitor.isNativePlatform === 'function') {
    return !!window.Capacitor.isNativePlatform();
  }
  if (typeof window.Capacitor.getPlatform === 'function') {
    return window.Capacitor.getPlatform() !== 'web';
  }
  return false;
}

function getCapacitorPlugin(name) {
  var capacitor = window.Capacitor || {};
  var plugins = capacitor.Plugins || {};
  return plugins[name] || null;
}

function hasNativeFilePicker() {
  var picker = getCapacitorPlugin('FilePicker');
  return !!(isNativeCapacitorRuntime() && picker && typeof picker.pickFiles === 'function');
}

function getPickerOptionsFromInput(input) {
  return {
    multiple: !!(input && input.multiple),
    accept: String(input && input.accept || '')
      .split(',')
      .map(function (value) { return value.trim(); })
      .filter(Boolean),
  };
}

function decodeBase64ToBlob(base64, mimeType) {
  var raw = String(base64 || '');
  var binary;
  var bytes;
  var index;

  if (raw.indexOf(',') >= 0) {
    raw = raw.split(',').pop();
  }

  binary = window.atob(raw);
  bytes = new Uint8Array(binary.length);

  for (index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

function createNativeFile(blob, fileName, mimeType) {
  var safeType = mimeType || blob.type || 'application/octet-stream';
  var safeName = fileName || 'file';

  try {
    return new File([blob], safeName, { type: safeType });
  } catch (error) {
    blob.name = safeName;
    blob.lastModified = Date.now();
    return blob;
  }
}

function readNativeFileData(path, mimeType) {
  var filesystem = getCapacitorPlugin('Filesystem');
  if (!filesystem || typeof filesystem.readFile !== 'function' || !path) {
    return Promise.resolve(null);
  }

  return filesystem.readFile({ path: path }).then(function (result) {
    if (!result || !result.data) return null;
    return createNativeFile(decodeBase64ToBlob(result.data, mimeType), String(path).split('/').pop() || 'file', mimeType);
  }).catch(function () {
    return null;
  });
}

function normalizeNativePickedFile(entry, index) {
  var safeEntry = entry || {};
  var fileName = safeEntry.name || ('file-' + (index + 1));
  var mimeType = safeEntry.mimeType || safeEntry.contentType || 'application/octet-stream';
  var directBlob = safeEntry.blob;

  if (directBlob && typeof Blob !== 'undefined' && directBlob instanceof Blob) {
    return Promise.resolve(createNativeFile(directBlob, fileName, mimeType));
  }

  if (safeEntry.data) {
    return Promise.resolve(createNativeFile(decodeBase64ToBlob(safeEntry.data, mimeType), fileName, mimeType));
  }

  return readNativeFileData(safeEntry.path || safeEntry.uri, mimeType).then(function (file) {
    if (!file) return null;
    if (!file.name) file.name = fileName;
    return file;
  });
}

function pickFilesWithNativePicker(options) {
  var picker = getCapacitorPlugin('FilePicker');
  var pickOptions;

  if (!hasNativeFilePicker()) return Promise.resolve(null);

  pickOptions = {
    multiple: !!(options && options.multiple),
    readData: true,
  };

  if (options && options.accept && options.accept.length) {
    pickOptions.types = options.accept.slice();
  }

  return picker.pickFiles(pickOptions).then(function (result) {
    var entries = result && Array.isArray(result.files) ? result.files : [];
    return Promise.all(entries.map(function (entry, index) {
      return normalizeNativePickedFile(entry, index);
    })).then(function (files) {
      return files.filter(Boolean);
    });
  });
}

function openPickerForInput(input, options, onFiles) {
  if (!input) return;
  if (!hasNativeFilePicker()) {
    input.click();
    return;
  }

  pickFilesWithNativePicker(options || getPickerOptionsFromInput(input))
    .then(function (files) {
      if (!files || !files.length) return;
      if (typeof onFiles === 'function') onFiles(files);
    })
    .catch(function () {
      input.click();
    });
}

function bindNativeInputPicker(input, onFiles) {
  if (!input || input.dataset.nativePickerBound) return;
  input.dataset.nativePickerBound = '1';
  input.addEventListener('click', function (event) {
    if (!hasNativeFilePicker()) return;
    event.preventDefault();
    openPickerForInput(input, getPickerOptionsFromInput(input), onFiles);
  });
}

function handleProofSelection(binding, file) {
  const name = file ? file.name : '';
  const proof = state[binding.role].proofs[binding.key];
  const hintEl = document.getElementById(binding.hint);

  if (!proof) return;

  if (proof.url) {
    try {
      URL.revokeObjectURL(proof.url);
    } catch (error) {}
  }
  proof.fileName = name;
  proof.status = name ? 'на рассмотрении' : 'не загружено';
  proof.url = name && file ? URL.createObjectURL(file) : '';
  proof.rejectReason = '';

  if (hintEl) hintEl.textContent = name ? 'Загрузка...' : 'Файл не выбран';
  setStatusTag(binding.status, proof.status);

  if (binding.role === 'employer') renderRecruiterPublic();
  if (binding.role === 'employee') renderEmployeePublic();
  refreshEmployeeCVButton();
  saveToStorage();

  if (name && file && getToken()) {
    (async function () {
      try {
        const uploaded = await apiUploadFile(file);
        const apiType = proofKeyToApiType(binding.key);
        let achId = proof.achievementId;
        if (!achId) {
          const ach = await apiCreateAchievement(apiType, DOC_TYPE_LABELS[apiType] || apiType, '');
          achId = ach.id;
          proof.achievementId = achId;
        }
        const doc = await apiAttachDocument(achId, uploaded.fileUrl, uploaded.fileName);
        proof.docId = doc?.id || proof.docId;
        if (hintEl) hintEl.textContent = 'Прикреплено: ' + uploaded.fileName;
        showToast('Файл загружен ✓ — на рассмотрении');
        saveToStorage();
      } catch (error) {
        if (hintEl) hintEl.textContent = 'Прикреплено: ' + name + ' (локально)';
        showToast('Файл загружен локально');
      }
    })();
  } else {
    if (hintEl && name) hintEl.textContent = 'Прикреплено: ' + name;
    if (name) showToast('Файл загружен ✓');
  }
}

function handlePortfolioSelection(files) {
  const safeFiles = Array.isArray(files) ? files : [];
  const hint = document.getElementById('portHintC');

  (state.employee.portfolio || []).forEach(function (item) {
    try {
      if (item.url) URL.revokeObjectURL(item.url);
    } catch (error) {}
  });

  state.employee.portfolio = safeFiles.map(function (file) {
    return { name: file.name, url: URL.createObjectURL(file) };
  });

  if (hint) {
    hint.textContent = safeFiles.length
      ? ('Прикреплено: ' + safeFiles.length + ' файл(ов)')
      : 'Файлы не выбраны';
  }

  setStatusTag('portStatusC', safeFiles.length ? 'на рассмотрении' : 'не загружено');
  renderEmployeePublic();
  if (safeFiles.length) showToast('Файл загружен ✓');
}

function handleAvatarSelection(file, input, hintId, imgId, target) {
  if (!file) return;
  if (!/^image\//i.test(file.type || '')) {
    showToast('Выберите файл изображения', 'error');
    if (input) input.value = '';
    return;
  }

  buildAvatarDataUrl(file, function (error, result) {
    const dataUrl = String(result && result.dataUrl || '');
    if (error || !dataUrl) {
      showToast((error && error.message) || 'Не удалось обработать изображение', 'error');
      if (input) input.value = '';
      return;
    }

    if (target === 'employer') state.employer.avatarDataUrl = dataUrl;
    if (target === 'employee') state.employee.avatarDataUrl = dataUrl;
    setAvatar(imgId, dataUrl);
    setText(hintId, 'Фото выбрано: ' + file.name);
    if (target === 'employer') renderRecruiterPublic();
    if (target === 'employee') renderEmployeePublic();
    saveToStorage();
    if (result.compressed) showToast('Аватар оптимизирован для сохранения', 'info');
  });
}

function wireProofs() {
  const bindings = [
    { role: 'employer', key: 'companyDoc', input: 'fileCompanyDocE', hint: 'companyDocHintE', status: 'companyDocStatusE' },
    { role: 'employee', key: 'education', input: 'fileEduC', hint: 'eduHintC', status: 'eduStatusC' },
    { role: 'employee', key: 'work', input: 'fileWorkC', hint: 'workHintC', status: 'workStatusC' },
    { role: 'employee', key: 'courses', input: 'fileCourseC', hint: 'courseHintC', status: 'courseStatusC' },
    { role: 'employee', key: 'passport', input: 'filePassC', hint: 'passHintC', status: 'passStatusC' },
    { role: 'employee', key: 'cv', input: 'fileCVC', hint: 'cvHintC', status: 'cvStatusC' },
  ];

  bindings.forEach(function (binding) {
    const inp = document.getElementById(binding.input);
    if (!inp) return;
    inp._lomoHandleFiles = function (files) {
      handleProofSelection(binding, files && files[0] ? files[0] : null);
    };

    if (!inp.dataset.proofBound) {
      inp.dataset.proofBound = '1';
      inp.addEventListener('change', function () {
        handleProofSelection(binding, inp.files && inp.files[0] ? inp.files[0] : null);
      });
    }

    bindNativeInputPicker(inp, inp._lomoHandleFiles);

    const proof = state[binding.role].proofs[binding.key];
    const curName = proof && proof.fileName;
    const hintEl = document.getElementById(binding.hint);
    if (hintEl) hintEl.textContent = curName ? ('Прикреплено: ' + curName) : 'Файл не выбран';
    if (proof) setStatusTag(binding.status, proof.status);
  });
}

function wireDropZones() {
  const zones = [
    { zoneId: 'dropZoneCompanyDocE', inputId: 'fileCompanyDocE' },
    { zoneId: 'dropZoneEduC', inputId: 'fileEduC' },
    { zoneId: 'dropZoneWorkC', inputId: 'fileWorkC' },
    { zoneId: 'dropZoneCourseC', inputId: 'fileCourseC' },
    { zoneId: 'dropZonePassC', inputId: 'filePassC' },
    { zoneId: 'dropZoneCVC', inputId: 'fileCVC' },
    { zoneId: 'dropZonePortfolio', inputId: 'filePortfolioC' },
  ];

  zones.forEach(function ({ zoneId, inputId }) {
    const zone = document.getElementById(zoneId);
    const inp = document.getElementById(inputId);
    if (!zone || !inp) return;
    zone.addEventListener('click', function () {
      openPickerForInput(inp, getPickerOptionsFromInput(inp), inp._lomoHandleFiles);
    });
    zone.addEventListener('dragover', function (event) {
      event.preventDefault();
      zone.classList.add('dropZone--over');
    });
    zone.addEventListener('dragleave', function () {
      zone.classList.remove('dropZone--over');
    });
    zone.addEventListener('drop', function (event) {
      event.preventDefault();
      zone.classList.remove('dropZone--over');
      if (event.dataTransfer.files && event.dataTransfer.files.length) {
        inp.files = event.dataTransfer.files;
        inp.dispatchEvent(new Event('change'));
      }
    });
  });
}

(function wirePortfolio() {
  const inp = document.getElementById('filePortfolioC');
  if (!inp) return;
  inp._lomoHandleFiles = handlePortfolioSelection;
  bindNativeInputPicker(inp, inp._lomoHandleFiles);
  inp.addEventListener('change', function () {
    handlePortfolioSelection(inp.files ? Array.from(inp.files) : []);
  });
})();

function wireAvatar(inputId, hintId, imgId, target) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input._lomoHandleFiles = function (files) {
    handleAvatarSelection(files && files[0] ? files[0] : null, input, hintId, imgId, target);
  };
  bindNativeInputPicker(input, input._lomoHandleFiles);
  input.addEventListener('change', function () {
    handleAvatarSelection(input.files && input.files[0] ? input.files[0] : null, input, hintId, imgId, target);
  });
}

function buildAvatarDataUrl(file, done) {
  const MAX_DATA_URL_LENGTH = 3 * 1024 * 1024 - 1024;
  const reader = new FileReader();
  reader.onerror = function () {
    done(new Error('Не удалось прочитать изображение'));
  };
  reader.onload = function () {
    const originalDataUrl = String(reader.result || '');
    if (!originalDataUrl) {
      done(new Error('Не удалось прочитать изображение'));
      return;
    }
    if (originalDataUrl.length <= MAX_DATA_URL_LENGTH) {
      done(null, { dataUrl: originalDataUrl, compressed: false });
      return;
    }

    const image = new Image();
    image.onerror = function () {
      done(new Error('Изображение слишком большое. Попробуйте файл поменьше'));
    };
    image.onload = function () {
      const maxSide = 768;
      let width = image.naturalWidth || image.width || maxSide;
      let height = image.naturalHeight || image.height || maxSide;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        done(new Error('Не удалось обработать изображение'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const preferredType = /image\/(?:png|webp)/i.test(file.type || '') ? file.type : 'image/jpeg';
      let compressedDataUrl = '';

      try {
        compressedDataUrl = canvas.toDataURL(preferredType);
      } catch (error) {}

      if (compressedDataUrl && compressedDataUrl.length <= MAX_DATA_URL_LENGTH) {
        done(null, { dataUrl: compressedDataUrl, compressed: true });
        return;
      }

      let quality = 0.86;
      while (quality >= 0.46) {
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        if (compressedDataUrl.length <= MAX_DATA_URL_LENGTH) {
          done(null, { dataUrl: compressedDataUrl, compressed: true });
          return;
        }
        quality -= 0.08;
      }

      done(new Error('Изображение слишком большое. Попробуйте файл поменьше'));
    };
    image.src = originalDataUrl;
  };
  reader.readAsDataURL(file);
}

function pickInGroup(groupId, value) {
  const wrap = document.getElementById(groupId);
  if (!wrap) return;
  wrap.querySelectorAll('.sqBtn').forEach(function (button) {
    button.classList.remove('selected');
  });
  const chosen = Array.from(wrap.querySelectorAll('.sqBtn')).find(function (button) {
    return button.dataset.value === value;
  });
  if (chosen) chosen.classList.add('selected');
}

function debounce(fn, wait) {
  let timer = null;
  return function () {
    const ctx = this;
    const args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, wait);
  };
}

const _debouncedFilterFeed = debounce(filterFeed, 120);
const _debouncedFilterEmployerSearch = debounce(filterEmployerSearch, 120);
const _debouncedFilterAdminCandidates = debounce(filterAdminCandidates, 120);
const _debouncedFilterAdminEmployers = debounce(filterAdminEmployers, 120);

function debouncedFilterFeed() { _debouncedFilterFeed(); }
function debouncedFilterEmployerSearch() { _debouncedFilterEmployerSearch(); }
function debouncedFilterAdminCandidates() { _debouncedFilterAdminCandidates(); }
function debouncedFilterAdminEmployers() { _debouncedFilterAdminEmployers(); }

// ── Profile edit tabs ─────────────────────────────────────────────────────
function initProfileTabs(screenId) {
  var screen = document.getElementById(screenId);
  if (!screen) return;
  screen.addEventListener('click', function(e) {
    var tab = e.target && e.target.closest ? e.target.closest('.profileTab') : null;
    if (!tab || !screen.contains(tab)) return;
    var targetId = tab.getAttribute('data-tab');
    var allTabs = screen.querySelectorAll('.profileTab');
    var allPanes = screen.querySelectorAll('.profileTabPane');
    for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.remove('active');
    for (var i = 0; i < allPanes.length; i++) allPanes[i].hidden = true;
    tab.classList.add('active');
    var pane = document.getElementById(targetId);
    if (pane) pane.hidden = false;
    var bar = screen.querySelector('.profileEditStickyBar');
    if (bar) bar.scrollIntoView({ block: 'nearest' });
  });
}

function resetProfileTabs(screenId) {
  var screen = document.getElementById(screenId);
  if (!screen) return;
  var allTabs = screen.querySelectorAll('.profileTab');
  var allPanes = screen.querySelectorAll('.profileTabPane');
  for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.toggle('active', i === 0);
  for (var i = 0; i < allPanes.length; i++) allPanes[i].hidden = i !== 0;
}

initProfileTabs('screenMyEmployeeProfile');
initProfileTabs('screenMyEmployerProfile');
