/* company-docs.js — company verification form, INN validation, admin company panel */

// ── INN checksum validation (FNS algorithm) ────────────────────────────────

function validateINN(inn) {
  if (!inn) return false;
  inn = String(inn).replace(/\D/g, '');
  if (inn.length !== 10 && inn.length !== 12) return false;

  function checksum(digits, coeffs) {
    var sum = 0;
    for (var i = 0; i < coeffs.length; i++) sum += digits[i] * coeffs[i];
    return (sum % 11) % 10;
  }

  var d = inn.split('').map(Number);
  if (inn.length === 10) {
    return d[9] === checksum(d, [2,4,10,3,5,9,4,6,8]);
  }
  // 12-digit
  var c1 = d[10] === checksum(d, [7,2,4,10,3,5,9,4,6,8]);
  var c2 = d[11] === checksum(d, [3,7,2,4,10,3,5,9,4,6,8]);
  return c1 && c2;
}

// ── Company docs form ─────────────────────────────────────────────────────────

var companyDocsState = {
  ceoDocUrl: '',
  ceoDocName: '',
  regDocUrl: '',
  regDocName: '',
  authorityDocUrl: '',
  authorityDocName: '',
  verifyStatus: 'unverified',
  companyType: 'legal',
};

function loadCompanyDocs() {
  apiFetch('/company/docs')
    .then(function(data) {
      if (!data) return;
      companyDocsState.verifyStatus = data.company_verify_status || 'unverified';

      var fields = {
        companyINN:           data.inn,
        companyOGRN:          data.ogrn,
        companyOGRNIP:        data.ogrnip,
        companyKPP:           data.kpp,
        companyLegalName:     data.legal_name,
        companyLegalAddress:  data.legal_address,
        companyActualAddress: data.actual_address,
        companyCEOName:       data.ceo_name,
        companyRepresentativeName: data.representative_name,
        companyOfficialEmail: data.official_email,
        companyOfficialDomain: data.official_domain,
        companyOfficialWebsite: data.official_website,
      };
      Object.keys(fields).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && fields[id]) el.value = fields[id];
      });

      // Actual address checkbox
      var cbSame = document.getElementById('actualSameAsLegal');
      if (cbSame && data.legal_address && data.legal_address === data.actual_address) cbSame.checked = true;

      // Uploaded doc hints
      var docs = data.documents || {};
      if (docs.ceo_doc) {
        companyDocsState.ceoDocUrl  = docs.ceo_doc.file_url;
        companyDocsState.ceoDocName = docs.ceo_doc.file_name;
        setCompanyDocHint('ceoDocHint', docs.ceo_doc.file_name);
      }
      if (docs.registration_doc) {
        companyDocsState.regDocUrl  = docs.registration_doc.file_url;
        companyDocsState.regDocName = docs.registration_doc.file_name;
        setCompanyDocHint('regDocHint', docs.registration_doc.file_name);
      }
      if (docs.authority_doc) {
        companyDocsState.authorityDocUrl  = docs.authority_doc.file_url;
        companyDocsState.authorityDocName = docs.authority_doc.file_name;
        setCompanyDocHint('authorityDocHint', docs.authority_doc.file_name);
      }

      renderCompanyVerifyStatus(data.company_verify_status, data.company_reject_reason);

      // Detect company type: OGRNIP present (and no OGRN) → ИП
      var detectedType = (data.ogrnip && !data.ogrn) ? 'ip' : 'legal';
      updateCompanyType(detectedType);
      updateCompanyReadyChecklist();
    })
    .catch(function() {});
}

function setCompanyDocHint(hintId, name) {
  var el = document.getElementById(hintId);
  if (el) el.textContent = name ? 'Прикреплено: ' + name : 'Файл не выбран';
}

function renderCompanyVerifyStatus(status, rejectReason) {
  var banner = document.getElementById('companyVerifyBanner');
  if (!banner) return;

  var msgs = {
    unverified: { cls: '', text: '' },
    pending:    { cls: 'pending', text: '⏳ Документы на проверке — обычно 1–2 рабочих дня' },
    verified:   { cls: 'ok',     text: '✓ Компания верифицирована' },
    rejected:   { cls: 'bad',    text: '✗ Верификация отклонена' + (rejectReason ? ': ' + rejectReason : '') },
  };
  var m = msgs[status] || msgs.unverified;
  if (!m.text) { banner.classList.add('hidden'); return; }
  banner.className = 'companyVerifyBanner ' + m.cls;
  banner.textContent = m.text;
  banner.classList.remove('hidden');
}

function uploadCompanyDocFile(inputEl, urlKey, nameKey, hintId, cb) {
  var file = inputEl.files && inputEl.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append('file', file);
  setCompanyDocHint(hintId, 'Загрузка...');

  apiFetch('/upload', { method: 'POST', body: fd })
    .then(function(d) {
      companyDocsState[urlKey]  = d.fileUrl;
      companyDocsState[nameKey] = d.fileName;
      setCompanyDocHint(hintId, d.fileName);
      if (cb) cb();
    })
    .catch(function() {
      setCompanyDocHint(hintId, 'Ошибка загрузки');
    });
}

function companyDocsValue(id) {
  return (document.getElementById(id) || {}).value || '';
}

function normalizeCompanyDigits(id, length) {
  var el = document.getElementById(id);
  var value = String(companyDocsValue(id)).replace(/\D/g, '');
  if (length) value = value.slice(0, length);
  if (el) el.value = value;
  if (!value) return '';
  return value;
}

function clearCompanyDocsErrors() {
  [
    'companyINN',
    'companyOGRN',
    'companyOGRNIP',
    'companyKPP',
    'companyLegalName',
    'companyLegalAddress',
    'companyCEOName',
    'companyOfficialEmail',
    'companyOfficialDomain',
    'companyOfficialWebsite',
  ].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('inputError');
  });
}

function failCompanyDocsField(id, msg) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.add('inputError');
    if (typeof el.focus === 'function') el.focus();
  }
  showCompanyDocsToast(msg, 'error');
  return false;
}

function isValidCompanyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizeCompanyDomain(value) {
  var normalized = String(value || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return normalized;
}

function isValidCompanyDomain(value) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value);
}

function saveCompanyDocs() {
  clearCompanyDocsErrors();
  var isIP   = companyDocsState.companyType === 'ip';
  var inn    = normalizeCompanyDigits('companyINN');
  var ogrn   = isIP ? '' : normalizeCompanyDigits('companyOGRN', 13);
  var ogrnip = isIP ? normalizeCompanyDigits('companyOGRNIP', 15) : '';
  var kpp    = isIP ? '' : normalizeCompanyDigits('companyKPP', 9);
  var cbSame    = document.getElementById('actualSameAsLegal');
  var legalName = companyDocsValue('companyLegalName').trim();
  var legalAddr = companyDocsValue('companyLegalAddress').trim();
  var actualAddr = cbSame && cbSame.checked
    ? legalAddr
    : companyDocsValue('companyActualAddress').trim();
  var ceoName = companyDocsValue('companyCEOName').trim();
  var representativeName = companyDocsValue('companyRepresentativeName').trim();
  var officialEmail = companyDocsValue('companyOfficialEmail').trim();
  var officialDomain = normalizeCompanyDomain(companyDocsValue('companyOfficialDomain'));
  var officialWebsite = companyDocsValue('companyOfficialWebsite').trim();

  if (!inn) return failCompanyDocsField('companyINN', 'Укажите ИНН компании');
  if (!validateINN(inn)) return failCompanyDocsField('companyINN', 'Неверная контрольная сумма ИНН');
  if (!ogrn && !ogrnip) return failCompanyDocsField('companyOGRN', 'Укажите ОГРН для юрлица или ОГРНИП для ИП');
  if (ogrn && ogrn.length !== 13) return failCompanyDocsField('companyOGRN', 'ОГРН должен содержать 13 цифр');
  if (ogrnip && ogrnip.length !== 15) return failCompanyDocsField('companyOGRNIP', 'ОГРНИП должен содержать 15 цифр');
  if (ogrn && (!kpp || kpp.length !== 9)) return failCompanyDocsField('companyKPP', 'Для юрлица укажите КПП из 9 цифр');
  if (!legalName) return failCompanyDocsField('companyLegalName', 'Укажите полное юридическое название');
  if (!legalAddr) return failCompanyDocsField('companyLegalAddress', 'Укажите юридический адрес');
  if (!ceoName) return failCompanyDocsField('companyCEOName', 'Укажите ФИО руководителя');
  if (officialEmail && !isValidCompanyEmail(officialEmail)) return failCompanyDocsField('companyOfficialEmail', 'Укажите корректный официальный email');
  if (officialDomain && !isValidCompanyDomain(officialDomain)) return failCompanyDocsField('companyOfficialDomain', 'Домен должен быть вида company.ru');
  if (!officialEmail && !officialDomain && !officialWebsite) return failCompanyDocsField('companyOfficialEmail', 'Укажите официальный email, домен или сайт');
  if (document.getElementById('companyINN')) document.getElementById('companyINN').classList.remove('inputError');

  var payload = {
    inn:              inn || undefined,
    ogrn:             ogrn || undefined,
    ogrnip:           ogrnip || undefined,
    kpp:              kpp || undefined,
    legal_name:       legalName || undefined,
    legal_address:    legalAddr || undefined,
    actual_address:   actualAddr || undefined,
    ceo_name:         ceoName || undefined,
    representative_name: representativeName || undefined,
    official_email:   officialEmail || undefined,
    official_domain:  officialDomain || undefined,
    official_website: officialWebsite || undefined,
    ceo_doc:          companyDocsState.ceoDocUrl || undefined,
    ceo_doc_name:     companyDocsState.ceoDocName || undefined,
    registration_doc: companyDocsState.regDocUrl || undefined,
    registration_doc_name: companyDocsState.regDocName || undefined,
    authority_doc:    companyDocsState.authorityDocUrl || undefined,
    authority_doc_name: companyDocsState.authorityDocName || undefined,
  };

  // Remove undefined keys
  Object.keys(payload).forEach(function(k) { if (payload[k] === undefined) delete payload[k]; });

  apiFetch('/company/docs', { method: 'POST', body: JSON.stringify(payload) })
    .then(function(d) {
      if (d.ok) {
        showCompanyDocsToast('Документы отправлены на проверку', 'success');
        loadCompanyDocs();
      } else {
        showCompanyDocsToast(d.error || 'Ошибка', 'error');
      }
    })
    .catch(function() { showCompanyDocsToast('Ошибка сети', 'error'); });
}

function showCompanyDocsToast(msg, type) {
  if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + (type || 'info');
}

function updateCompanyType(type) {
  companyDocsState.companyType = type || 'legal';
  document.querySelectorAll('[data-company-type]').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-company-type') === companyDocsState.companyType);
  });
  var ogrnRow   = document.getElementById('companyOgrnRow');
  var ogrnipRow = document.getElementById('companyOgrnipRow');
  if (ogrnRow)   ogrnRow.classList.toggle('hidden', companyDocsState.companyType === 'ip');
  if (ogrnipRow) ogrnipRow.classList.toggle('hidden', companyDocsState.companyType === 'legal');
  updateCompanyReadyChecklist();
}

function updateCompanyReadyChecklist() {
  var el = document.getElementById('companyReadyChecklist');
  if (!el) return;
  var type = companyDocsState.companyType || 'legal';

  function fval(id) { return ((document.getElementById(id) || {}).value || '').trim(); }

  var innOk = validateINN(fval('companyINN').replace(/\D/g, ''));
  var items = [
    { ok: innOk, label: 'ИНН заполнен и корректен' },
    type === 'legal'
      ? { ok: fval('companyOGRN').replace(/\D/g,'').length === 13, label: 'ОГРН (13 цифр)' }
      : { ok: fval('companyOGRNIP').replace(/\D/g,'').length === 15, label: 'ОГРНИП (15 цифр)' },
  ];
  if (type === 'legal') items.push({ ok: fval('companyKPP').replace(/\D/g,'').length === 9, label: 'КПП (9 цифр)' });
  items.push(
    { ok: !!fval('companyLegalName'), label: 'Юридическое наименование' },
    { ok: !!fval('companyLegalAddress'), label: 'Юридический адрес' },
    { ok: !!fval('companyCEOName'), label: 'ФИО руководителя' },
    { ok: !!(fval('companyOfficialEmail') || fval('companyOfficialDomain') || fval('companyOfficialWebsite')), label: 'Официальный контакт (email, домен или сайт)' },
    { ok: !!companyDocsState.ceoDocUrl, label: 'Документ руководителя загружен' },
    { ok: !!companyDocsState.regDocUrl, label: 'Выписка из ЕГРЮЛ / ЕГРИП загружена' }
  );

  el.innerHTML = items.map(function(item) {
    return '<div class="checklistItem ' + (item.ok ? 'ok' : 'miss') + '">'
      + '<span class="ciIcon">' + (item.ok ? '✓' : '○') + '</span>'
      + '<span class="ciLabel">' + escAdm(item.label) + '</span>'
      + '</div>';
  }).join('');
}

function initCompanyDocsForm() {
  var ceoInput = document.getElementById('fileCEODoc');
  var regInput = document.getElementById('fileRegDoc');
  var authorityInput = document.getElementById('fileAuthorityDoc');
  var saveBtn  = document.getElementById('btnSaveCompanyDocs');
  var cbSame   = document.getElementById('actualSameAsLegal');

  if (ceoInput) ceoInput.addEventListener('change', function() {
    uploadCompanyDocFile(ceoInput, 'ceoDocUrl', 'ceoDocName', 'ceoDocHint');
  });
  if (regInput) regInput.addEventListener('change', function() {
    uploadCompanyDocFile(regInput, 'regDocUrl', 'regDocName', 'regDocHint');
  });
  if (authorityInput) authorityInput.addEventListener('change', function() {
    uploadCompanyDocFile(authorityInput, 'authorityDocUrl', 'authorityDocName', 'authorityDocHint');
  });
  bindCompanyDocDropZone('dropZoneCEODoc', ceoInput);
  bindCompanyDocDropZone('dropZoneRegDoc', regInput);
  bindCompanyDocDropZone('dropZoneAuthorityDoc', authorityInput);
  if (saveBtn) saveBtn.addEventListener('click', saveCompanyDocs);

  if (cbSame) {
    cbSame.addEventListener('change', function() {
      var actualWrap = document.getElementById('actualAddressWrap');
      if (actualWrap) actualWrap.classList.toggle('hidden', cbSame.checked);
    });
  }

  // INN real-time validation hint
  var innEl = document.getElementById('companyINN');
  if (innEl) {
    innEl.addEventListener('input', function() {
      var v = innEl.value.replace(/\D/g, '');
      innEl.value = v;
      var hint = document.getElementById('innValidHint');
      if (!hint) return;
      if (!v) { hint.textContent = ''; innEl.classList.remove('inputError','inputOk'); return; }
      if (v.length !== 10 && v.length !== 12) { hint.textContent = ''; innEl.classList.remove('inputError','inputOk'); return; }
      if (validateINN(v)) {
        hint.textContent = '✓ ИНН корректен'; hint.className = 'innHint ok';
        innEl.classList.remove('inputError'); innEl.classList.add('inputOk');
      } else {
        hint.textContent = '✗ Неверная контрольная сумма'; hint.className = 'innHint bad';
        innEl.classList.remove('inputOk'); innEl.classList.add('inputError');
      }
    });
  }
  bindCompanyDigitsOnly('companyOGRN', 13);
  bindCompanyDigitsOnly('companyOGRNIP', 15);
  bindCompanyDigitsOnly('companyKPP', 9);

  // Company type toggle
  document.querySelectorAll('[data-company-type]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      updateCompanyType(btn.getAttribute('data-company-type'));
    });
  });

  // Live checklist updates on field input
  ['companyINN','companyOGRN','companyOGRNIP','companyKPP','companyLegalName',
   'companyLegalAddress','companyCEOName','companyOfficialEmail',
   'companyOfficialDomain','companyOfficialWebsite'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCompanyReadyChecklist);
  });

  updateCompanyType('legal');
}

function bindCompanyDigitsOnly(id, maxLen) {
  var el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', function() {
    el.value = String(el.value || '').replace(/\D/g, '').slice(0, maxLen);
    el.classList.remove('inputError');
  });
}

function bindCompanyDocDropZone(zoneId, inputEl) {
  var zone = document.getElementById(zoneId);
  if (!zone || !inputEl) return;
  zone.addEventListener('click', function() { inputEl.click(); });
  zone.addEventListener('dragover', function(event) {
    event.preventDefault();
    zone.classList.add('dropZone--over');
  });
  zone.addEventListener('dragleave', function() {
    zone.classList.remove('dropZone--over');
  });
  zone.addEventListener('drop', function(event) {
    event.preventDefault();
    zone.classList.remove('dropZone--over');
    if (event.dataTransfer.files && event.dataTransfer.files.length) {
      inputEl.files = event.dataTransfer.files;
      inputEl.dispatchEvent(new Event('change'));
    }
  });
}

// ── Admin: companies panel ────────────────────────────────────────────────────

var adminCompaniesState = { items: [], filterStatus: '' };

function loadAdminCompanies() {
  var list = document.getElementById('adminCompaniesList');
  if (!list) return;
  list.innerHTML = '<div class="adminListLoading">Загрузка...</div>';

  var params = adminCompaniesState.filterStatus ? '?status=' + adminCompaniesState.filterStatus : '';

  apiFetch('/company/admin/companies' + params)
    .then(function(data) {
      adminCompaniesState.items = data.items || [];
      renderAdminCompanies(data.items || []);
      // Badge count
      var badge = document.getElementById('adminCompaniesPendingBadge');
      if (badge) {
        badge.textContent = data.pendingCount || '';
        badge.classList.toggle('hidden', !data.pendingCount);
      }
    })
    .catch(function() {
      list.innerHTML = '<div class="feedEmpty">Ошибка загрузки</div>';
    });
}

function renderAdminCompanies(items) {
  var list = document.getElementById('adminCompaniesList');
  if (!list) return;
  if (!items.length) { list.innerHTML = '<div class="feedEmpty">Компаний нет</div>'; return; }

  list.innerHTML = items.map(function(c) {
    var statusMap = { unverified:'ghost', pending:'warn', verified:'ok', rejected:'bad' };
    var statusLbl = { unverified:'Не проверена', pending:'На проверке', verified:'Верифицирована', rejected:'Отклонена' };
    var cls = statusMap[c.company_verify_status] || 'ghost';
    var lbl = statusLbl[c.company_verify_status] || c.company_verify_status;
    var logo = c.avatar_url
      ? '<img src="' + escAdm(c.avatar_url) + '" class="adminCompanyLogo" alt="">'
      : '<div class="adminCompanyLogoFb">' + escAdm((c.company||'?').charAt(0)) + '</div>';

    return '<div class="adminCompanyRow">'
      + '<div class="adminCompanyLogoWrap">' + logo + '</div>'
      + '<div class="adminCompanyInfo">'
        + '<div class="adminCompanyName">' + escAdm(c.company || c.email) + '</div>'
        + '<div class="adminCompanyMeta">'
          + (c.inn ? 'ИНН ' + escAdm(c.inn) + ' · ' : '')
          + escAdm(c.industry || '—')
          + ' · ' + c.active_jobs + ' вак.'
        + '</div>'
      + '</div>'
      + '<span class="statusTag ' + cls + '">' + lbl + '</span>'
      + '<div class="adminCompanyActions">'
        + '<button class="miniLink" data-admin-company-review="' + escAdm(c.id) + '">Проверить</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function escAdm(s) {
  return String(s||'').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function openAdminCompanyReview(companyId) {
  apiFetch('/company/admin/companies/' + companyId + '/docs')
    .then(function(data) {
      renderAdminCompanyModal(data);
    })
    .catch(function() { showCompanyDocsToast('Ошибка загрузки данных компании', 'error'); });
}

function buildAdminCompanyWarnings(data) {
  var warnings = [];
  var docs = data.documents || {};
  if (data.ogrn && !data.kpp) {
    warnings.push('Нет КПП при наличии ОГРН — ожидается для юрлица');
  }
  var officialEmail = data.official_email || data.corp_email || '';
  var emailDomain = officialEmail.includes('@') ? officialEmail.split('@')[1] : '';
  if (emailDomain && data.official_domain && emailDomain !== data.official_domain) {
    warnings.push('Домен email (' + escAdm(emailDomain) + ') не совпадает с официальным доменом (' + escAdm(data.official_domain) + ')');
  }
  if (data.representative_name && !docs.authority_doc) {
    warnings.push('Указан представитель, но документ полномочий не загружен');
  }
  return warnings;
}

function renderAdminCompanyModal(data) {
  var modal = document.getElementById('adminCompanyModal');
  var body  = document.getElementById('adminCompanyModalBody');
  if (!modal || !body) return;

  var docs = data.documents || {};
  var ceoDoc = docs.ceo_doc;
  var regDoc = docs.registration_doc;
  var authorityDoc = docs.authority_doc;
  var warnings = buildAdminCompanyWarnings(data);

  var officialEmailVal = data.official_email || data.corp_email || data.email || '';
  var officialEmailHtml = officialEmailVal
    ? '<a href="mailto:' + escAdm(officialEmailVal) + '" class="miniLink">' + escAdm(officialEmailVal) + '</a>'
    : '—';
  var domainVal = data.official_domain || '';
  var domainHtml = domainVal
    ? '<a href="https://' + escAdm(domainVal) + '" target="_blank" rel="noopener noreferrer" class="miniLink">' + escAdm(domainVal) + '</a>'
    : '—';
  var websiteVal = data.official_website || data.website || '';
  var websiteHtml = websiteVal
    ? '<a href="' + escAdm(websiteVal) + '" target="_blank" rel="noopener noreferrer" class="miniLink">' + escAdm(websiteVal) + '</a>'
    : '—';

  body.innerHTML = ''
    + (warnings.length
        ? '<div class="adminCompanyWarnings">'
          + '<div class="adminCompanyWarningsHead">⚠ Потенциальные проблемы</div>'
          + warnings.map(function(w) { return '<div class="adminCompanyWarning">' + w + '</div>'; }).join('')
          + '</div>'
        : '')
    + '<div class="adminCompanyModalCols">'
      + '<div class="adminCompanyModalCol">'
        + '<div class="adminCompanyModalHead">Реквизиты</div>'
        + adminModalRow('Компания', data.company || '—')
        + adminModalRow('ИНН',
            data.inn
              ? data.inn + ' <a href="https://egrul.nalog.ru/?query=' + escAdm(data.inn) + '" target="_blank" rel="noopener noreferrer" class="miniLink">→ ЕГРЮЛ</a>'
              : '—',
            true)
        + (data.ogrn ? adminModalRow('ОГРН', data.ogrn) : '')
        + (data.ogrnip ? adminModalRow('ОГРНИП', data.ogrnip) : '')
        + (data.kpp ? adminModalRow('КПП', data.kpp) : '')
        + adminModalRow('Юр. наименование', data.legal_name || '—')
        + adminModalRow('Юр. адрес', data.legal_address || '—')
        + (data.actual_address && data.actual_address !== data.legal_address
            ? adminModalRow('Факт. адрес', data.actual_address)
            : '')
        + adminModalRow('ФИО директора', data.ceo_name || '—')
        + (data.representative_name ? adminModalRow('ФИО представителя', data.representative_name) : '')
        + adminModalRow('Email', officialEmailHtml, true)
        + (data.corp_email_verified ? adminModalRow('Корп. почта', 'подтверждена ✓') : '')
        + (domainVal ? adminModalRow('Домен', domainHtml, true) : '')
        + (websiteVal ? adminModalRow('Сайт', websiteHtml, true) : '')
        + adminModalRow('Зарегистрирован', data.created_at ? new Date(data.created_at).toLocaleDateString('ru') : '—')
      + '</div>'
      + '<div class="adminCompanyModalCol">'
        + '<div class="adminCompanyModalHead">Документы</div>'
        + (ceoDoc
            ? '<div class="adminDocRow"><span>Документ директора</span>'
              + '<button class="miniLink" data-open-doc="' + escAdm(ceoDoc.id) + '" data-file-name="' + escAdm(ceoDoc.file_name) + '">Открыть</button></div>'
            : '<div class="adminDocRow emptyDoc">⚠ Документ директора не загружен</div>')
        + (regDoc
            ? '<div class="adminDocRow"><span>Выписка ЕГРЮЛ / ЕГРИП</span>'
              + '<button class="miniLink" data-open-doc="' + escAdm(regDoc.id) + '" data-file-name="' + escAdm(regDoc.file_name) + '">Открыть</button></div>'
            : '<div class="adminDocRow emptyDoc">⚠ Выписка не загружена</div>')
        + (authorityDoc
            ? '<div class="adminDocRow"><span>Полномочия представителя</span>'
              + '<button class="miniLink" data-open-doc="' + escAdm(authorityDoc.id) + '" data-file-name="' + escAdm(authorityDoc.file_name) + '">Открыть</button></div>'
            : '<div class="adminDocRow emptyDoc">Документ полномочий не загружен</div>')
      + '</div>'
    + '</div>'
    + '<div class="adminCompanyModalActions">'
      + '<button class="accentBtn ok" id="adminBtnVerifyCompany" data-company-id="' + escAdm(data.id) + '">✓ Верифицировать</button>'
      + '<div class="adminRejectForm">'
        + '<textarea id="adminCompanyRejectReason" class="sqInput" placeholder="Причина отклонения..." rows="2"></textarea>'
        + '<button class="accentBtn bad" id="adminBtnRejectCompany" data-company-id="' + escAdm(data.id) + '">✗ Отклонить</button>'
      + '</div>'
    + '</div>';

  modal.classList.remove('hidden');
}

function adminModalRow(label, val, raw) {
  return '<div class="adminModalRow"><span class="adminModalLabel">' + escAdm(label) + '</span><span class="adminModalVal">' + (raw ? val : escAdm(val)) + '</span></div>';
}

function initAdminCompaniesPanel() {
  var panel = document.getElementById('adminTabPanelEmployers');
  if (!panel) return;

  // Status filter chips
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#adminTabPanelEmployers') && !e.target.closest('#adminCompanyModal')) return;

    var chip = e.target.closest('[data-company-filter]');
    if (chip) {
      panel.querySelectorAll('[data-company-filter]').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      adminCompaniesState.filterStatus = chip.getAttribute('data-company-filter');
      loadAdminCompanies();
      return;
    }

    var reviewBtn = e.target.closest('[data-admin-company-review]');
    if (reviewBtn) { openAdminCompanyReview(reviewBtn.getAttribute('data-admin-company-review')); return; }

    var verifyBtn = e.target.closest('#adminBtnVerifyCompany');
    if (verifyBtn) { adminVerifyCompany(verifyBtn.getAttribute('data-company-id')); return; }

    var rejectBtn = e.target.closest('#adminBtnRejectCompany');
    if (rejectBtn) { adminRejectCompany(rejectBtn.getAttribute('data-company-id')); return; }

    if (e.target.closest('#adminCompanyModalClose') || (e.target.closest('#adminCompanyModal') && !e.target.closest('.adminCompanyModalInner'))) {
      document.getElementById('adminCompanyModal').classList.add('hidden');
    }
  });
}

function adminVerifyCompany(companyId) {
  apiFetch('/company/admin/companies/' + companyId + '/verify', { method: 'POST' })
    .then(function(d) {
      if (d.ok) {
        document.getElementById('adminCompanyModal').classList.add('hidden');
        loadAdminCompanies();
        showCompanyDocsToast('Компания верифицирована', 'success');
      } else { showCompanyDocsToast(d.error || 'Ошибка', 'error'); }
    })
    .catch(function() { showCompanyDocsToast('Ошибка сети', 'error'); });
}

function adminRejectCompany(companyId) {
  var reason = (document.getElementById('adminCompanyRejectReason') || {}).value || '';
  if (!reason.trim()) { showCompanyDocsToast('Укажите причину', 'info'); return; }
  apiFetch('/company/admin/companies/' + companyId + '/reject', {
    method: 'POST',
    body: JSON.stringify({ reason: reason }),
  })
    .then(function(d) {
      if (d.ok) {
        document.getElementById('adminCompanyModal').classList.add('hidden');
        loadAdminCompanies();
        showCompanyDocsToast('Компания отклонена', 'success');
      } else { showCompanyDocsToast(d.error || 'Ошибка', 'error'); }
    })
    .catch(function() { showCompanyDocsToast('Ошибка сети', 'error'); });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  initCompanyDocsForm();
  initAdminCompaniesPanel();

  // Load company docs when employer opens the Docs tab
  document.addEventListener('click', function(e) {
    var tabBtn = e.target.closest('[data-tab="tabEDocs"]');
    if (tabBtn) {
      loadCompanyDocs();
    }
    // Admin companies tab
    var adminTab = e.target.closest('[data-admin-tab="employers"]');
    if (adminTab) {
      loadAdminCompanies();
    }
  });
});
