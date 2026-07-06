/* In-app notifications: bell icon with unread badge + dropdown (last 30).
   Opening the dropdown marks everything read. */

var _bellState = {
  items: [],
  unreadCount: 0,
  open: false,
  pollTimer: null,
};

function bellIsAuthenticated() {
  return !!(state.userId && typeof getToken === 'function' && getToken());
}

function updateBellBadges() {
  var badges = document.querySelectorAll('.js-bell .bellBadge');
  for (var i = 0; i < badges.length; i++) {
    if (_bellState.unreadCount > 0) {
      badges[i].textContent = _bellState.unreadCount > 30 ? '30+' : String(_bellState.unreadCount);
      badges[i].classList.remove('hidden');
    } else {
      badges[i].classList.add('hidden');
    }
  }
}

function refreshNotificationsBell() {
  if (!bellIsAuthenticated()) {
    _bellState.items = [];
    _bellState.unreadCount = 0;
    updateBellBadges();
    return;
  }
  apiFetch('/notifications').then(function (data) {
    _bellState.items = (data && data.items) || [];
    _bellState.unreadCount = Number(data && data.unreadCount) || 0;
    updateBellBadges();
    if (_bellState.open) renderBellDropdown();
  }).catch(function () {});
}

function bellFormatTime(iso) {
  var date = new Date(iso);
  if (!isFinite(date.getTime())) return '';
  var now = new Date();
  var isToday = date.toDateString() === now.toDateString();
  var hh = ('0' + date.getHours()).slice(-2);
  var mm = ('0' + date.getMinutes()).slice(-2);
  if (isToday) return hh + ':' + mm;
  return date.getDate() + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + ' ' + hh + ':' + mm;
}

function bellItemHtml(item) {
  var payload = item.payload || {};
  var time = '<span class="bellItemTime">' + escapeHtml(bellFormatTime(item.created_at)) + '</span>';
  var unreadClass = item.read_at ? '' : ' unread';

  if (item.type === 'access_request') {
    return '<div class="bellItem' + unreadClass + '" data-bell-type="access_request">' +
      '<div class="bellItemText">' + escapeHtml(payload.employerName || 'Работодатель') + ' запрашивает доступ к вашим документам</div>' +
      '<div class="bellItemActions">' +
        '<button type="button" class="bellItemBtn ok" data-bell-approve="' + escapeHtml(payload.requestId || '') + '">Разрешить</button>' +
        '<button type="button" class="bellItemBtn" data-bell-reject="' + escapeHtml(payload.requestId || '') + '">Отклонить</button>' +
      '</div>' + time +
    '</div>';
  }
  if (item.type === 'doc_verified') {
    var levelText = Number(payload.level) > 0
      ? ' Ваш уровень: LOMO ' + escapeHtml(String(payload.level))
      : (payload.hint ? ' ' + escapeHtml(payload.hint) : '');
    return '<div class="bellItem' + unreadClass + ' bellItemLink" data-bell-goto="profile">' +
      '<div class="bellItemText">Документ „' + escapeHtml(payload.label || 'документ') + '“ проверен ✓' + levelText + '</div>' + time +
    '</div>';
  }
  if (item.type === 'doc_rejected') {
    return '<div class="bellItem' + unreadClass + '" data-bell-type="doc_rejected">' +
      '<div class="bellItemText">Документ „' + escapeHtml(payload.label || 'документ') + '“ не прошёл проверку. Причина: ' + escapeHtml(payload.reason || '—') + '</div>' +
      '<div class="bellItemActions">' +
        '<button type="button" class="bellItemBtn" data-bell-goto="docs">Загрузить заново</button>' +
      '</div>' + time +
    '</div>';
  }
  if (String(item.type).indexOf('completeness_') === 0) {
    return '<div class="bellItem' + unreadClass + ' bellItemLink" data-bell-goto="edit">' +
      '<div class="bellItemText">' + escapeHtml(payload.message || 'Профиль обновлён') + '</div>' + time +
    '</div>';
  }
  return '<div class="bellItem' + unreadClass + '">' +
    '<div class="bellItemText">' + escapeHtml(payload.message || item.type) + '</div>' + time +
  '</div>';
}

function renderBellDropdown() {
  var list = document.getElementById('bellDropdownList');
  if (!list) return;
  if (!_bellState.items.length) {
    list.innerHTML = '<div class="bellEmpty">Пока нет уведомлений</div>';
    return;
  }
  list.innerHTML = _bellState.items.map(bellItemHtml).join('');
}

function positionBellDropdown(anchor) {
  var dropdown = document.getElementById('bellDropdown');
  if (!dropdown || !anchor) return;
  var rect = anchor.getBoundingClientRect();
  var width = Math.min(360, window.innerWidth - 16);
  dropdown.style.width = width + 'px';
  dropdown.style.top = (rect.bottom + 8) + 'px';
  var left = Math.min(rect.left, window.innerWidth - width - 8);
  dropdown.style.left = Math.max(8, left) + 'px';
}

function openBellDropdown(anchor) {
  var dropdown = document.getElementById('bellDropdown');
  if (!dropdown) return;
  _bellState.open = true;
  renderBellDropdown();
  positionBellDropdown(anchor);
  dropdown.classList.remove('hidden');

  if (_bellState.unreadCount > 0) {
    _bellState.unreadCount = 0;
    updateBellBadges();
    apiFetch('/notifications/read-all', { method: 'POST' }).catch(function () {});
  }
}

function closeBellDropdown() {
  var dropdown = document.getElementById('bellDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  _bellState.open = false;
}

function bellGoto(target) {
  closeBellDropdown();
  if (target === 'profile') {
    if (typeof goToMyProfile === 'function') goToMyProfile();
    return;
  }
  if (target === 'docs') {
    if (typeof hydrateEmployeeForm === 'function') hydrateEmployeeForm();
    show('myEmployeeProfile');
    if (typeof activateProfileTab === 'function') activateProfileTab('screenMyEmployeeProfile', 'tabCDocs');
    return;
  }
  if (target === 'edit') {
    if (typeof hydrateEmployeeForm === 'function') hydrateEmployeeForm();
    show('myEmployeeProfile');
  }
}

function bellHandleRequestAction(requestId, approve) {
  var request = approve ? apiApproveRequest(requestId) : apiRejectRequest(requestId);
  request.then(function () {
    showToast(approve ? 'Доступ разрешён' : 'Запрос отклонён', approve ? 'success' : 'info');
    if (typeof loadIncomingRequests === 'function') loadIncomingRequests();
    refreshNotificationsBell();
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
  });
}

(function initNotificationsBell() {
  document.addEventListener('click', function (event) {
    var bell = event.target && event.target.closest ? event.target.closest('.js-bell') : null;
    if (bell) {
      if (_bellState.open) closeBellDropdown();
      else openBellDropdown(bell);
      return;
    }

    var dropdown = document.getElementById('bellDropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    var approveBtn = event.target.closest ? event.target.closest('[data-bell-approve]') : null;
    if (approveBtn) { bellHandleRequestAction(approveBtn.getAttribute('data-bell-approve'), true); return; }
    var rejectBtn = event.target.closest ? event.target.closest('[data-bell-reject]') : null;
    if (rejectBtn) { bellHandleRequestAction(rejectBtn.getAttribute('data-bell-reject'), false); return; }
    var gotoEl = event.target.closest ? event.target.closest('[data-bell-goto]') : null;
    if (gotoEl && dropdown.contains(gotoEl)) { bellGoto(gotoEl.getAttribute('data-bell-goto')); return; }

    if (!dropdown.contains(event.target)) closeBellDropdown();
  });

  window.addEventListener('lomo:screen-change', function () {
    closeBellDropdown();
    refreshNotificationsBell();
  });

  _bellState.pollTimer = setInterval(function () {
    if (bellIsAuthenticated() && !document.hidden) refreshNotificationsBell();
  }, 60000);
})();
