/* Employer saved searches: "Сохранить этот поиск" after AI results + a panel
   listing saved searches on the employer search screen. */

function ssEl(id) { return document.getElementById(id); }

// Reads the current AI-match query context from the modal DOM (same fields
// runMatch uses) so a saved search reproduces the exact query + filters.
function currentSearchContext() {
  var ta = ssEl('aiMatchTextarea');
  var jobText = ta ? String(ta.value || '').trim() : '';
  var gradeEl = document.querySelector('[data-grade].active');
  var formatEl = document.querySelector('[data-format].active');
  var verifiedEl = ssEl('aiMatchVerifiedOnly');
  var activeEl = ssEl('aiMatchActiveOnly');
  return {
    jobText: jobText,
    grade: gradeEl ? gradeEl.getAttribute('data-grade') : '',
    format: formatEl ? formatEl.getAttribute('data-format') : '',
    verifiedOnly: verifiedEl ? verifiedEl.checked !== false : true,
    activeOnly: !!(activeEl && activeEl.checked),
  };
}

function defaultSearchName(jobText) {
  return String(jobText || '').split(/\s+/).slice(0, 4).join(' ').slice(0, 60) || 'Мой поиск';
}

function openSaveSearchModal() {
  var ctx = currentSearchContext();
  if (!ctx.jobText) {
    if (typeof showToast === 'function') showToast('Сначала опишите вакансию и запустите подбор', 'error');
    return;
  }
  var modal = ssEl('saveSearchModal');
  var nameInput = ssEl('saveSearchName');
  var notify = ssEl('saveSearchNotify');
  var error = ssEl('saveSearchError');
  if (nameInput) nameInput.value = defaultSearchName(ctx.jobText);
  if (notify) notify.checked = true;
  if (error) error.classList.add('hidden');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  modal._ctx = ctx;
}

function closeSaveSearchModal() {
  var modal = ssEl('saveSearchModal');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

function submitSaveSearch() {
  var modal = ssEl('saveSearchModal');
  var ctx = (modal && modal._ctx) || currentSearchContext();
  var nameInput = ssEl('saveSearchName');
  var notify = ssEl('saveSearchNotify');
  var error = ssEl('saveSearchError');
  var name = nameInput ? nameInput.value.trim() : '';
  if (!name) { if (error) { error.textContent = 'Укажите название'; error.classList.remove('hidden'); } return; }

  apiCreateSavedSearch({
    name: name,
    jobText: ctx.jobText,
    grade: ctx.grade,
    format: ctx.format,
    verifiedOnly: ctx.verifiedOnly,
    activeOnly: ctx.activeOnly,
    notifyEmail: notify ? notify.checked : true,
  }).then(function () {
    closeSaveSearchModal();
    if (typeof showToast === 'function') showToast('Поиск сохранён ✓', 'success');
    renderSavedSearches();
  }).catch(function (err) {
    if (error) {
      error.textContent = safeErrorText(err);
      error.classList.remove('hidden');
    }
  });
}

function savedSearchCriteria(s) {
  var parts = [];
  if (s.grade) parts.push(s.grade);
  if (s.format) parts.push(s.format);
  if (s.verifiedOnly) parts.push('✓ верифиц.');
  if (s.activeOnly) parts.push('в поиске');
  return parts.join(' · ') || 'без фильтров';
}

function renderSavedSearches() {
  var panel = ssEl('savedSearchPanel');
  var list = ssEl('savedSearchList');
  if (!panel || !list) return;
  if (state.roleReg !== 'EMPLOYER') { panel.classList.add('hidden'); return; }

  apiGetSavedSearches().then(function (data) {
    var items = (data && data.items) || [];
    if (!items.length) { panel.classList.add('hidden'); list.innerHTML = ''; return; }
    panel.classList.remove('hidden');
    list.innerHTML = items.map(function (s) {
      var date = '';
      try { date = new Date(s.createdAt).toLocaleDateString('ru-RU'); } catch (e) {}
      var bell = s.notifyEmail ? '🔔' : '🔕';
      return '<div class="savedSearchItem" data-ss-id="' + escHtml(s.id) + '">' +
        '<div class="savedSearchInfo">' +
          '<div class="savedSearchName">' + escHtml(s.name) + '</div>' +
          '<div class="savedSearchMeta">' + escHtml(savedSearchCriteria(s)) + ' · ' + escHtml(date) + '</div>' +
        '</div>' +
        '<div class="savedSearchActions">' +
          '<button type="button" class="miniLink" data-ss-run="' + escHtml(s.id) + '">Запустить</button>' +
          '<button type="button" class="miniLink" data-ss-bell="' + escHtml(s.id) + '" data-ss-notify="' + (s.notifyEmail ? '1' : '0') + '" title="Уведомления на email">' + bell + '</button>' +
          '<button type="button" class="miniLink" data-ss-del="' + escHtml(s.id) + '">Удалить</button>' +
        '</div>' +
      '</div>';
    }).join('');
    list._items = items;
  }).catch(function () {
    panel.classList.add('hidden');
  });
}

function runSavedSearch(item) {
  if (!item) return;
  // Open the AI-match modal, populate the saved query + filters, and run it.
  var openBtn = ssEl('btnOpenAiMatch');
  if (openBtn) openBtn.click();

  var ta = ssEl('aiMatchTextarea');
  if (ta) { ta.value = item.jobText || ''; ta.dispatchEvent(new Event('input')); }

  document.querySelectorAll('[data-grade]').forEach(function (c) {
    c.classList.toggle('active', (c.getAttribute('data-grade') || '') === (item.grade || ''));
  });
  document.querySelectorAll('[data-format]').forEach(function (c) {
    c.classList.toggle('active', (c.getAttribute('data-format') || '') === (item.format || ''));
  });
  var verifiedEl = ssEl('aiMatchVerifiedOnly');
  if (verifiedEl) verifiedEl.checked = item.verifiedOnly !== false;
  var activeEl = ssEl('aiMatchActiveOnly');
  if (activeEl) activeEl.checked = !!item.activeOnly;

  var runBtn = ssEl('btnRunAiMatch');
  if (runBtn && item.jobText) runBtn.click();
}

(function initSavedSearches() {
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;

    if (target.id === 'btnSaveSearch') { openSaveSearchModal(); return; }
    if (target.id === 'saveSearchClose') { closeSaveSearchModal(); return; }
    if (target.id === 'saveSearchSubmit') { submitSaveSearch(); return; }
    if (target.id === 'saveSearchModal') { closeSaveSearchModal(); return; }

    var runBtn = target.closest ? target.closest('[data-ss-run]') : null;
    if (runBtn) {
      var list = ssEl('savedSearchList');
      var items = (list && list._items) || [];
      var item = items.filter(function (s) { return s.id === runBtn.getAttribute('data-ss-run'); })[0];
      runSavedSearch(item);
      return;
    }

    var bellBtn = target.closest ? target.closest('[data-ss-bell]') : null;
    if (bellBtn) {
      var id = bellBtn.getAttribute('data-ss-bell');
      var next = bellBtn.getAttribute('data-ss-notify') !== '1';
      apiToggleSavedSearchNotify(id, next).then(function () { renderSavedSearches(); }).catch(function () {});
      return;
    }

    var delBtn = target.closest ? target.closest('[data-ss-del]') : null;
    if (delBtn) {
      apiDeleteSavedSearch(delBtn.getAttribute('data-ss-del')).then(function () {
        renderSavedSearches();
      }).catch(function () {});
      return;
    }
  });
})();
