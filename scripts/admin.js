var _userCache = {};
var _connectionsData = { accepted: [], incoming: [], outgoing: [], counts: { accepted: 0, incoming: 0, outgoing: 0 } };

var feedState = { page: 1, pageSize: 15, total: 0, totalPages: 0, search: '', view: '', verified: '' };
var employerSearchState = { page: 1, pageSize: 15, total: 0, totalPages: 0, search: '', verified: '', lookingFilter: '', salaryMaxFilter: '' };
var _feedScrollObserver = null;
var _employerScrollObserver = null;
var employerFilterUiState = { signature: '' };
var adminQueueState = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
var adminCandidateState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var adminEmployerState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var adminUsersState = { page: 1, pageSize: 20, total: 0, totalPages: 0, search: '', roleFilter: '' };

function recoverAuthFlowOnProtectedError(err, options) {
  var message = safeErrorText(err);
  if (!/Authentication required/i.test(message)) return false;

  clearToken();
  resetState();
  resetDisplay();

  if (options && options.listId) {
    renderListFallbackState(options.listId, 'Сессия завершилась. Войдите снова.');
  }

  if (options && options.pagerId) {
    renderPager(options.pagerId, { total: 0 }, function () {}, { label: options.label || 'элементов' });
  }

  showToast('Сессия завершилась. Войдите снова.', 'error');
  showEntryScreen();
  return true;
}

function normalizePaginatedResponse(result) {
  if (Array.isArray(result)) {
    return {
      items: result,
      page: 1,
      pageSize: result.length || 0,
      total: result.length,
      totalPages: result.length ? 1 : 0,
    };
  }

  return {
    items: Array.isArray(result && result.items) ? result.items : [],
    page: Number(result && result.page) || 1,
    pageSize: Number(result && result.pageSize) || 0,
    total: Number(result && result.total) || 0,
    totalPages: Number(result && result.totalPages) || 0,
  };
}

function syncPagerState(targetState, response) {
  targetState.page = response.page || 1;
  targetState.pageSize = response.pageSize || targetState.pageSize;
  targetState.total = response.total || 0;
  targetState.totalPages = response.totalPages || (response.total ? 1 : 0);
}

function renderFeedLoadingState(targetId, cardsCount) {
  var el = document.getElementById(targetId);
  if (!el) return;

  var count = Number(cardsCount) || 3;
  el.innerHTML = '<div class="feedSkeleton">' + Array.from({ length: count }, function () {
    return '<div class="feedSkeletonCard"><div class="feedSkeletonHead">' +
      '<div class="skPulse feedSkAv"></div>' +
      '<div class="feedSkLines"><div class="skPulse feedSkL1"></div><div class="skPulse feedSkL2"></div></div>' +
    '</div></div>';
  }).join('') + '</div>';
}

function renderFeedEmptyState(targetId, icon, text) {
  var el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '<div class="feedEmptyState"><span class="feedEmptyIco">' + escHtml(icon || '•') + '</span><div class="feedEmptyText">' + escHtml(text || 'Пока ничего нет') + '</div></div>';
}

function renderAdminNoticeState(targetId, text) {
  var el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = queueEmptyState(text);
}

function renderListFallbackState(targetId, text) {
  if (!targetId) return;

  if (targetId === 'candidateFeedList' || targetId === 'employerCandidateList') {
    renderFeedEmptyState(targetId, '⚠', text || 'Не удалось загрузить данные');
    return;
  }

  if (targetId === 'adminCandidateList') {
    renderAdminCandidates([], text);
    return;
  }

  if (targetId === 'adminEmployerList') {
    renderAdminEmployers([], text);
    return;
  }

  if (targetId === 'adminUsersList' || targetId === 'adminQueueList') {
    renderAdminNoticeState(targetId, text || 'Не удалось загрузить данные');
    return;
  }

  var el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '<div class="miniHint">' + escapeHtml(text || 'Не удалось загрузить данные') + '</div>';
}

function renderFeedErrorState(targetId, err, emptyText) {
  showToast(safeErrorText(err), 'error');
  renderFeedEmptyState(targetId, '⚠', emptyText || 'Не удалось загрузить данные');
}

function appendPagerPageButton(container, pageNumber, currentPage, onNavigate) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'pagerBtn pagerNum' + (pageNumber === currentPage ? ' current' : '');
  button.textContent = String(pageNumber);

  if (pageNumber === currentPage) {
    button.disabled = true;
    button.setAttribute('aria-current', 'page');
  } else {
    button.addEventListener('click', function () {
      onNavigate(pageNumber);
    });
  }

  container.appendChild(button);
}

function appendPagerEllipsis(container) {
  var dots = document.createElement('span');
  dots.className = 'pagerMeta pagerEllipsis';
  dots.textContent = '…';
  container.appendChild(dots);
}

function renderPager(targetId, pagerState, onNavigate, options) {
  var el = document.getElementById(targetId);
  if (!el) return;

  var total = Number(pagerState.total || 0);
  if (!total) {
    el.innerHTML = '';
    return;
  }

  var page = Number(pagerState.page || 1);
  var totalPages = Number(pagerState.totalPages || 1) || 1;
  var label = (options && options.label) || 'элементов';

  el.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'pagerBar';

  var meta = document.createElement('div');
  meta.className = 'pagerMeta';
  meta.textContent = totalPages > 1
    ? 'Страница ' + page + ' из ' + totalPages + ' · ' + total + ' ' + label
    : total + ' ' + label;

  var actions = document.createElement('div');
  actions.className = 'pagerActions';

  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'pagerBtn';
  prev.textContent = 'Назад';
  prev.disabled = page <= 1;
  prev.addEventListener('click', function () {
    if (page > 1) onNavigate(page - 1);
  });

  actions.appendChild(prev);

  if (totalPages > 1) {
    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, page + 2);

    if (totalPages > 5) {
      if (page <= 3) {
        start = 1;
        end = 5;
      } else if (page >= totalPages - 2) {
        start = totalPages - 4;
        end = totalPages;
      }
    }

    if (start > 1) appendPagerEllipsis(actions);

    for (var pageNumber = start; pageNumber <= end; pageNumber += 1) {
      appendPagerPageButton(actions, pageNumber, page, onNavigate);
    }

    if (end < totalPages) appendPagerEllipsis(actions);
  }

  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'pagerBtn';
  next.textContent = 'Далее';
  next.disabled = page >= totalPages;
  next.addEventListener('click', function () {
    if (page < totalPages) onNavigate(page + 1);
  });

  actions.appendChild(next);
  wrap.appendChild(meta);
  wrap.appendChild(actions);
  el.appendChild(wrap);
}

function queueEmptyState(text) {
  return '<div class="adminEmptyState">' + escapeHtml(text) + '</div>';
}

// ── INFINITE SCROLL ENGINE ────────────────────────────────────────────────
function setupInfiniteScroll(listId, observerRef, screenKey, loadNextPage) {
  // Disconnect any previous observer stored in observerRef
  if (observerRef && observerRef.current) {
    observerRef.current.disconnect();
    observerRef.current = null;
  }

  var el = document.getElementById(listId);
  if (!el) return;

  // Remove old sentinel if present
  var old = el.querySelector('.feedScrollSentinel');
  if (old) old.remove();

  if (!window.IntersectionObserver) return; // safe fallback: old pager still works

  var sentinel = document.createElement('div');
  sentinel.className = 'feedScrollSentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  el.appendChild(sentinel);

  var observer = new IntersectionObserver(function(entries) {
    if (!entries[0].isIntersecting) return;
    if (screenKey && getScreenScrollTop(screenKey) <= 0) return;
    loadNextPage();
  }, { rootMargin: '200px' });

  observer.observe(sentinel);
  observerRef.current = observer;
}

function teardownInfiniteScroll(observerRef, listId) {
  if (observerRef && observerRef.current) {
    observerRef.current.disconnect();
    observerRef.current = null;
  }
  if (listId) {
    var el = document.getElementById(listId);
    if (el) { var s = el.querySelector('.feedScrollSentinel'); if (s) s.remove(); }
  }
}
// ─────────────────────────────────────────────────────────────────────────

function upsertConnectionUser(item) {
  if (!item || !item.user_id) return;
  _userCache[String(item.user_id)] = {
    id: item.user_id,
    role: item.role,
    public_id: item.public_id,
    full_name: item.full_name,
    company: item.company,
    avatar_url: item.avatar_url,
    location: item.location,
    industry: item.industry,
    current_job: item.current_job,
    job_title: item.job_title,
  };
}

function connectionDisplayName(item) {
  return escapeHtml(item.full_name || item.company || 'Пользователь LOMO');
}

function connectionRoleLabel(item) {
  return item.role === 'employer'
    ? (item.company || item.industry || 'Работодатель')
    : (item.current_job || item.job_title || item.location || 'Кандидат');
}

function renderConnectionsInto(prefix, data) {
  var accepted = Array.isArray(data?.accepted) ? data.accepted : [];
  var incoming = Array.isArray(data?.incoming) ? data.incoming : [];
  var outgoing = Array.isArray(data?.outgoing) ? data.outgoing : [];
  var counts = data?.counts || { accepted: accepted.length, incoming: incoming.length, outgoing: outgoing.length };

  setText(prefix + 'ConnectionsCount', String(counts.accepted || 0));
  setText(prefix + 'ConnectionsIncoming', String(counts.incoming || 0));
  setText(prefix + 'ConnectionsOutgoing', String(counts.outgoing || 0));

  var listEl = document.getElementById(prefix + 'ConnectionsList');
  if (!listEl) return;

  accepted.forEach(upsertConnectionUser);
  incoming.forEach(upsertConnectionUser);
  outgoing.forEach(upsertConnectionUser);

  var sections = [];
  if (incoming.length) {
    sections.push(
      '<div class="networkGroup">' +
        '<div class="networkGroupTitle">Входящие запросы</div>' +
        incoming.map(function (item) {
          return '<div class="networkRow">' +
            '<div class="networkInfo">' +
              '<div class="networkName">' + connectionDisplayName(item) + '</div>' +
              '<div class="networkMeta">' + escapeHtml(connectionRoleLabel(item)) + '</div>' +
            '</div>' +
            '<div class="networkActions">' +
              '<button type="button" class="miniLink" data-open-connection-profile="' + escapeHtml(item.user_id) + '">Профиль</button>' +
              '<button type="button" class="miniLink" data-connection-action="accept" data-connection-id="' + escapeHtml(item.id) + '" data-target-user-id="' + escapeHtml(item.user_id) + '">Принять</button>' +
              '<button type="button" class="miniLink" data-connection-action="reject" data-connection-id="' + escapeHtml(item.id) + '" data-target-user-id="' + escapeHtml(item.user_id) + '">Отклонить</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>'
    );
  }

  if (accepted.length) {
    sections.push(
      '<div class="networkGroup">' +
        '<div class="networkGroupTitle">Мои контакты</div>' +
        accepted.slice(0, 8).map(function (item) {
          return '<div class="networkRow">' +
            '<div class="networkInfo">' +
              '<div class="networkName">' + connectionDisplayName(item) + '</div>' +
              '<div class="networkMeta">' + escapeHtml(connectionRoleLabel(item)) + '</div>' +
            '</div>' +
            '<div class="networkActions">' +
              '<button type="button" class="miniLink" data-open-connection-profile="' + escapeHtml(item.user_id) + '">Профиль</button>' +
              '<button type="button" class="miniLink" data-open-chat-user="' + escapeHtml(item.user_id) + '">Чат</button>' +
              '<button type="button" class="miniLink" data-connection-action="remove" data-connection-id="' + escapeHtml(item.id) + '" data-target-user-id="' + escapeHtml(item.user_id) + '">Удалить</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>'
    );
  }

  if (outgoing.length) {
    sections.push(
      '<div class="networkGroup">' +
        '<div class="networkGroupTitle">Ожидают подтверждения</div>' +
        outgoing.map(function (item) {
          return '<div class="networkRow">' +
            '<div class="networkInfo">' +
              '<div class="networkName">' + connectionDisplayName(item) + '</div>' +
              '<div class="networkMeta">' + escapeHtml(connectionRoleLabel(item)) + '</div>' +
            '</div>' +
            '<div class="networkActions">' +
              '<button type="button" class="miniLink" data-open-connection-profile="' + escapeHtml(item.user_id) + '">Профиль</button>' +
              '<button type="button" class="miniLink" data-connection-action="remove" data-connection-id="' + escapeHtml(item.id) + '" data-target-user-id="' + escapeHtml(item.user_id) + '">Отменить</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>'
    );
  }

  listEl.innerHTML = sections.length ? sections.join('') : '<div class="miniHint">Контактов и запросов пока нет</div>';
}

function loadOwnConnections() {
  if (!getToken() || state.roleReg === 'ADMIN') return;
  apiGetConnections().then(function (data) {
    _connectionsData = data || _connectionsData;
    if (state.roleReg === 'EMPLOYER') renderConnectionsInto('rp', _connectionsData);
    else renderConnectionsInto('ep', _connectionsData);
  }).catch(function (err) {
    var targetId = state.roleReg === 'EMPLOYER' ? 'rpConnectionsList' : 'epConnectionsList';
    var listEl = document.getElementById(targetId);
    showToast(safeErrorText(err), 'error');
    if (listEl) listEl.innerHTML = '<div class="miniHint">Не удалось загрузить контакты</div>';
  });
}

function renderPublicConnectionPanel(targetUserId, statusData) {
  var box = document.getElementById('pubConnectionPanel');
  if (!box) return;

  var relation = statusData?.relation || 'none';
  var count = Number(statusData?.connections_count || 0);
  var buttonsHtml = '';
  var hint = count ? 'В сети LOMO: ' + count + ' контакт(ов)' : 'Это может стать полезным профессиональным контактом в LOMO.';

  if (relation === 'connected') {
    buttonsHtml =
      '<button type="button" class="pillBtn" disabled>Уже в контактах</button>' +
      '<button type="button" class="pillBtn" data-open-chat-user="' + escapeHtml(targetUserId) + '">Написать</button>';
  } else if (relation === 'incoming') {
    hint = 'Новый запрос в контакты ждёт решения в разделе чатов.';
    buttonsHtml = '<button type="button" class="pillBtn" data-next="toChatHub">Открыть чаты</button>';
  } else if (relation === 'outgoing') {
    hint = 'Запрос отправлен. Ответ появится в разделе чатов.';
    buttonsHtml = '<button type="button" class="pillBtn" data-next="toChatHub">Открыть чаты</button>';
  } else if (relation === 'unavailable') {
    buttonsHtml = '<button type="button" class="pillBtn" disabled>Контакты недоступны</button>';
  } else {
    buttonsHtml = '<button type="button" class="pillBtn" data-connection-action="send" data-target-user-id="' + escapeHtml(targetUserId) + '">Добавить в контакты</button>';
  }

  box.innerHTML =
    '<div class="pubProfileSTitle">Контакты LOMO</div>' +
    '<div class="networkHint">' + escapeHtml(hint) + '</div>' +
    '<div class="networkInlineActions">' + buttonsHtml + '</div>';
}

function loadPublicConnectionPanel(targetUserId) {
  var box = document.getElementById('pubConnectionPanel');
  if (!box || !targetUserId || !getToken() || state.roleReg === 'ADMIN') return;
  box.innerHTML = '<div class="miniHint">Загрузка контактов...</div>';
  apiGetConnectionStatus(targetUserId).then(function (statusData) {
    renderPublicConnectionPanel(targetUserId, statusData);
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
    box.innerHTML = '<div class="miniHint">Не удалось загрузить контакты LOMO</div>';
  });
}

function refreshConnectionViews(targetUserId) {
  loadOwnConnections();
  if (targetUserId && String(targetUserId) === String(_activePublicProfileUserId)) {
    loadPublicConnectionPanel(targetUserId);
  }
  if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.refreshConnectionInbox === 'function') {
    window.LOMO_CHAT_UI.refreshConnectionInbox();
  }
}

function handleConnectionAction(action, connectionId, targetUserId) {
  var request;
  if (action === 'send') request = apiSendConnectionRequest(targetUserId);
  if (action === 'accept') request = apiAcceptConnection(connectionId);
  if (action === 'reject') request = apiRejectConnection(connectionId);
  if (action === 'remove') request = apiRemoveConnection(connectionId);
  if (!request) return Promise.resolve();

  return request.then(function (result) {
    if (action === 'send' && result?.autoAccepted) showToast('Контакт подтверждён', 'success');
    else if (action === 'send') showToast('Запрос в контакты отправлен', 'success');
    else if (action === 'accept') showToast('Контакт добавлен', 'success');
    else if (action === 'reject') showToast('Запрос отклонён', 'info');
    else if (action === 'remove') showToast('Контакт обновлён', 'success');
    refreshConnectionViews(targetUserId);
    return result;
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
    throw err;
  });
}

function loadAdminQueue(page) {
  if (!getToken()) return;
  if (page) adminQueueState.page = page;

  var el = document.getElementById('adminQueueList');
  if (el) el.innerHTML = queueEmptyState('Загрузка...');

  apiAdminQueue({
    page: adminQueueState.page,
    pageSize: adminQueueState.pageSize,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminQueueState, data);

    var listEl = document.getElementById('adminQueueList');
    if (!listEl) return;

    if (!data.items.length) {
      listEl.innerHTML = queueEmptyState('Очередь пуста — все заявки обработаны');
      renderPager('adminQueuePager', { total: 0 }, function () {}, { label: 'документов' });
      return;
    }

    listEl.innerHTML = '';
    data.items.forEach(function (item) {
      var initials = (item.full_name || item.user_email || '?')
        .split(' ')
        .map(function (segment) { return segment[0] || ''; })
        .join('')
        .slice(0, 2)
        .toUpperCase();

      var card = document.createElement('div');
      card.className = 'adminCard';
      card.id = 'acard_' + item.id;
      card.innerHTML =
        '<div class="adminCardHead">' +
          '<div class="adminAvatar">' + escapeHtml(initials || '?') + '</div>' +
          '<div class="adminCardInfo">' +
            '<div class="adminCardName">' + escapeHtml(item.full_name || item.user_email || '—') + '</div>' +
            '<div class="adminCardDoc">' +
              escapeHtml(DOC_TYPE_LABELS[item.ach_type] || item.ach_type || 'Документ') +
              ' · ' +
              escapeHtml(item.ach_title || item.org || '') +
              (item.file_name ? ' · ' + escapeHtml(item.file_name) : '') +
            '</div>' +
          '</div>' +
          '<span class="statusBadge warn">На рассмотрении</span>' +
        '</div>' +
        '<div class="adminActions">' +
          '<input class="rejectInput" id="rInput_' + item.id + '" placeholder="Причина отказа"/>' +
        '</div>';

      var actions = card.querySelector('.adminActions');
      if (item.id) {
        var btnView = document.createElement('button');
        btnView.className = 'adminBtn';
        btnView.textContent = 'Просмотреть';
        btnView.style.cssText = 'background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;';
        btnView.addEventListener('click', function () {
          openSecureDocument(item.id, item.file_name).catch(function (err) {
            showToast(safeErrorText(err), 'error');
          });
        });
        actions.appendChild(btnView);
      }

      var btnApprove = document.createElement('button');
      btnApprove.className = 'adminBtn ok';
      btnApprove.textContent = 'Подтвердить';
      btnApprove.addEventListener('click', function () {
        apiAdminApprove(item.id).then(function () {
          showToast('Документ подтверждён', 'success');
          loadAdminQueue(adminQueueState.page);
        }).catch(function (err) {
          showToast(safeErrorText(err), 'error');
        });
      });

      var btnReject = document.createElement('button');
      btnReject.className = 'adminBtn danger';
      btnReject.textContent = 'Отклонить';
      btnReject.addEventListener('click', function () {
        var reason = document.getElementById('rInput_' + item.id);
        var value = reason ? reason.value.trim() : '';
        if (!value) {
          showToast('Укажите причину отказа', 'info');
          return;
        }
        apiAdminReject(item.id, value).then(function () {
          showToast('Документ отклонён', 'success');
          loadAdminQueue(adminQueueState.page);
        }).catch(function (err) {
          showToast(safeErrorText(err), 'error');
        });
      });

      actions.insertBefore(btnApprove, actions.firstChild);
      actions.appendChild(btnReject);
      listEl.appendChild(card);
    });

    renderPager('adminQueuePager', adminQueueState, loadAdminQueue, { label: 'документов' });
  }).catch(function (err) {
    var listEl = document.getElementById('adminQueueList');
    showToast(safeErrorText(err), 'error');
    if (listEl) listEl.innerHTML = queueEmptyState('Не удалось загрузить очередь');
    renderPager('adminQueuePager', { total: 0 }, function () {}, { label: 'документов' });
  });
}

function bindAdminRoleChips() {
  var chips = document.querySelectorAll('[data-admin-role-filter]');
  chips.forEach(function (chip) {
    if (chip.dataset.bound === '1') return;
    chip.dataset.bound = '1';
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      adminUsersState.roleFilter = chip.getAttribute('data-admin-role-filter') || '';
      loadAdminUsers(1);
    });
  });
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return null;
  var ts = new Date(lastSeen).getTime();
  if (isNaN(ts)) return null;
  var diffMin = (Date.now() - ts) / 60000;
  if (diffMin < 5) return 'online';
  if (diffMin < 60) return Math.floor(diffMin) + ' мин назад';
  if (diffMin < 1440) return Math.floor(diffMin / 60) + ' ч назад';
  return Math.floor(diffMin / 1440) + ' дн назад';
}

function loadAdminUsers(page) {
  if (!getToken()) return;
  if (page) adminUsersState.page = page;
  adminUsersState.search = (document.getElementById('adminUserSearch')?.value || '').trim();

  var el = document.getElementById('adminUsersList');
  if (el) el.innerHTML = '<div class="adminEmptyState compact">Загрузка...</div>';

  apiAdminUsers({
    page: adminUsersState.page,
    pageSize: adminUsersState.pageSize,
    search: adminUsersState.search,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    var allUsers = data.items || [];
    syncPagerState(adminUsersState, data);

    var roleFilter = adminUsersState.roleFilter;
    var users = roleFilter
      ? allUsers.filter(function (u) { return (u.role || '').toLowerCase() === roleFilter; })
      : allUsers;

    var listEl = document.getElementById('adminUsersList');
    if (!listEl) return;

    if (!users.length) {
      listEl.innerHTML = '<div class="adminEmptyState compact">Нет пользователей</div>';
      renderPager('adminUsersPager', { total: 0 }, function () {}, { label: 'пользователей' });
      return;
    }

    listEl.innerHTML = '';
    var table = document.createElement('table');
    table.className = 'adminUsersTable';
    table.innerHTML =
      '<thead><tr class="adminUsersHeadRow">' +
        '<th class="adminUsersHeadCell">Пользователь</th>' +
        '<th class="adminUsersHeadCell">Роль</th>' +
        '<th class="adminUsersHeadCell">Активность</th>' +
        '<th class="adminUsersHeadCell">Действия</th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    users.forEach(function (user) {
      var tr = document.createElement('tr');
      tr.className = 'adminUsersRow';

      var roleLabel = user.role === 'employer' ? 'Работодатель' : user.role === 'employee' ? 'Кандидат' : user.role === 'admin' ? 'Админ' : (user.role || '—');
      var roleClass = user.role === 'employer' ? 'employer' : user.role === 'employee' ? 'employee' : user.role === 'admin' ? 'admin' : '';
      var displayName = escapeHtml(user.full_name || user.company || '');
      var displayEmail = escapeHtml(user.email || '—');
      var lastSeenText = formatLastSeen(user.last_seen);
      var isOnline = lastSeenText === 'online';
      var onlineDot = '<span class="adminOnlineDot ' + (isOnline ? 'online' : 'offline') + '"></span>';
      var activityText = isOnline ? 'Онлайн' : (lastSeenText || 'Нет данных');

      tr.innerHTML =
        '<td class="adminUsersCell">' +
          '<div class="adminUserNameCell">' +
            '<div class="adminUserEmail">' + displayEmail + '</div>' +
            (displayName ? '<div class="adminUserName">' + displayName + '</div>' : '') +
          '</div>' +
        '</td>' +
        '<td class="adminUsersCell"><span class="adminUsersRoleTag ' + roleClass + '">' + roleLabel + '</span></td>' +
        '<td class="adminUsersCell"><div class="adminUserActivity">' + onlineDot + '<span class="adminActivityText ' + (isOnline ? 'online' : '') + '">' + escapeHtml(activityText) + '</span></div></td>' +
        '<td class="adminUsersCell" id="uactions_' + user.id + '"></td>';

      var actionsCell = tr.querySelector('#uactions_' + user.id);
      if (user.role !== 'admin') {
        var delBtn = document.createElement('button');
        delBtn.className = 'adminBtn danger compact';
        delBtn.textContent = 'Удалить';
        delBtn.addEventListener('click', function () {
          if (!confirm('Удалить пользователя ' + user.email + '?')) return;
          apiFetch('/admin/users/' + user.id, { method: 'DELETE' }).then(function () {
            showToast('Пользователь удалён', 'success');
            loadAdminUsers(adminUsersState.page);
          }).catch(function (err) {
            showToast(safeErrorText(err), 'error');
          });
        });
        actionsCell.appendChild(delBtn);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    listEl.appendChild(table);
    renderPager('adminUsersPager', adminUsersState, loadAdminUsers, { label: 'пользователей' });
  }).catch(function (err) {
    var listEl = document.getElementById('adminUsersList');
    showToast(safeErrorText(err), 'error');
    if (listEl) listEl.innerHTML = queueEmptyState('Не удалось загрузить пользователей');
    renderPager('adminUsersPager', { total: 0 }, function () {}, { label: 'пользователей' });
  });
}

function loadIncomingRequests() {
  var el = document.getElementById('epRequestsList');
  if (!el || state.roleReg !== 'EMPLOYEE' || !getToken()) return;
  el.innerHTML = '<div class="miniHint">Загрузка запросов...</div>';
  apiGetRequests().then(function (requests) {
    if (!requests.length) {
      el.innerHTML = '<div class="miniHint">Запросов пока нет</div>';
      return;
    }

    el.innerHTML = requests.map(function (req) {
      var who = escapeHtml(req.company || req.employer_name || 'Работодатель');
      var docLabel = escapeHtml(DOC_TYPE_LABELS[req.document_type] || req.document_type || 'Документ');
      var status = req.status === 'approved'
        ? '<span class="chip ok">одобрено</span>'
        : req.status === 'rejected'
          ? '<span class="chip bad">отклонено</span>'
          : '<span class="chip warn">ожидает решения</span>';
      var actions = req.status === 'pending'
        ? '<div class="actionsRow spaced">' +
            '<button type="button" class="pillBtn" data-approve-request="' + req.id + '">Разрешить доступ</button>' +
            '<button type="button" class="pillBtn" data-reject-request="' + req.id + '">Отклонить</button>' +
          '</div>'
        : '';

      return '<div class="achRow alignTop">' +
        '<div class="achMain">' +
          '<div class="achTitle">' + docLabel + '</div>' +
          '<div class="achMeta">' + who + ' запрашивает доступ к файлу</div>' +
          actions +
        '</div>' +
        status +
      '</div>';
    }).join('');
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
    el.innerHTML = '<div class="miniHint">Не удалось загрузить запросы</div>';
  });
}

function handleRequestDecision(requestId, action) {
  var fn = action === 'approve' ? apiApproveRequest : apiRejectRequest;
  fn(requestId).then(function () {
    showToast(action === 'approve' ? 'Доступ разрешён' : 'Запрос отклонён', action === 'approve' ? 'success' : 'info');
    loadIncomingRequests();
    if (_activePublicProfileUserId) loadEmployerAccessPanel(_activePublicProfileUserId);
    if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.refreshConnectionInbox === 'function') {
      window.LOMO_CHAT_UI.refreshConnectionInbox();
    }
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
  });
}

function requestDocumentAccess(candidateId, documentType) {
  apiSendRequest(candidateId, documentType).then(function () {
    showToast('Запрос отправлен', 'success');
    loadEmployerAccessPanel(candidateId);
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
  });
}

function renderEmployerAccessPanel(candidateId, requests, files) {
  var box = document.getElementById('pubAccessPanel');
  if (!box) return;

  var requestMap = {};
  (requests || []).forEach(function (req) {
    requestMap[req.document_type] = req;
  });

  var fileMap = {};
  (files || []).forEach(function (file) {
    fileMap[file.type] = file;
  });

  var buttons = ['education', 'work', 'courses', 'passport', 'cv'].map(function (type) {
    var file = fileMap[type];
    if (file) {
      return '<button type="button" class="pillBtn" data-open-doc="' + escapeHtml(file.id) + '" data-file-name="' + escapeHtml(file.file_name || DOC_TYPE_LABELS[type]) + '">Открыть: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }

    var req = requestMap[type];
    if (req && req.status === 'pending') {
      return '<button type="button" class="pillBtn" disabled>Запрос отправлен: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }
    if (req && req.status === 'approved') {
      return '<button type="button" class="pillBtn" disabled>Доступ одобрен: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }

    return '<button type="button" class="pillBtn" data-request-doc="' + escapeHtml(type) + '" data-candidate-id="' + escapeHtml(candidateId) + '">Запросить: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
  }).join('');

  var filesHtml = (files && files.length)
    ? files.map(function (file) {
        return '<div class="achRow">' +
          '<div><div class="achTitle">' + escapeHtml(DOC_TYPE_LABELS[file.type] || file.type) + '</div><div class="achMeta">' + escapeHtml(file.file_name || '') + '</div></div>' +
          '<button type="button" class="miniLink" data-open-doc="' + escapeHtml(file.id) + '" data-file-name="' + escapeHtml(file.file_name || 'document') + '">Открыть</button>' +
        '</div>';
      }).join('')
    : '<div class="miniHint">Пока нет файлов с одобренным доступом</div>';
  var canChat = (files && files.length) || (requests || []).some(function (req) { return req.status === 'approved'; });
  var chatActionHtml = canChat
    ? '<div class="pubAccessChatRow"><button type="button" class="pillBtn" data-open-chat-user="' + escapeHtml(candidateId) + '">Написать кандидату</button></div>'
    : '';

  box.innerHTML =
    '<div class="pubProfileSection">' +
      '<div class="pubProfileSTitle">Доступ к документам</div>' +
      chatActionHtml +
      '<div class="pubAccessButtons">' + buttons + '</div>' +
      filesHtml +
    '</div>';
}

function loadEmployerAccessPanel(candidateId) {
  if (state.roleReg !== 'EMPLOYER' || !getToken()) return;
  var box = document.getElementById('pubAccessPanel');
  if (!box) return;
  box.innerHTML = '<div class="miniHint">Загрузка доступа...</div>';

  Promise.all([
    apiGetRequests(),
    apiGetAccessibleFiles(candidateId).catch(function () { return []; }),
  ]).then(function (result) {
    var requests = (result[0] || []).filter(function (req) { return req.candidate_id === candidateId; });
    renderEmployerAccessPanel(candidateId, requests, result[1] || []);
  }).catch(function (err) {
    showToast(safeErrorText(err), 'error');
    box.innerHTML = '<div class="miniHint">Не удалось загрузить доступ к документам</div>';
  });
}

function updateProfileProgress() {
  var p = state.employee;
  var score = 0;
  var total = 6;
  var hints = [];

  if (p.fullName) score += 1; else hints.push({ text: 'Добавьте имя' });
  if (p.eduPlace) score += 1; else hints.push({ text: 'Укажите место обучения' });
  if (p.vacancies) score += 1; else hints.push({ text: 'Укажите желаемые вакансии' });

  var anyProof = Object.values(p.proofs).some(function (proof) { return proof.fileName; });
  if (anyProof) score += 1; else hints.push({ text: 'Загрузите хотя бы один документ' });

  var anyVerified = Object.values(p.proofs).some(function (proof) { return proof.status === 'подтверждено'; });
  if (anyVerified) score += 1; else hints.push({ text: 'Получите первое подтверждение' });

  if (p.proofs.cv.fileName) score += 1; else hints.push({ text: 'Загрузите резюме (CV)' });

  var pct = Math.round((score / total) * 100);
  var fill = document.getElementById('epProgressFill');
  var label = document.getElementById('epProgressLabel');
  var hintsEl = document.getElementById('epProgressHints');
  var banner = document.getElementById('epOnboardBanner');
  var bannerText = document.getElementById('epOnboardText');

  if (fill) {
    if (typeof setProgressWidth === 'function') setProgressWidth(fill, pct);
    else fill.style.setProperty('--progress-width', pct + '%');
  }
  if (label) label.textContent = 'Профиль ' + pct + '%' + (pct < 50 ? ' — заполните для видимости' : pct < 100 ? ' — почти готово!' : ' — профиль полный');
  if (hintsEl) {
    hintsEl.innerHTML = hints.slice(0, 3).map(function (hint) {
      return '<div class="progressHint">' + escapeHtml(hint.text) + '</div>';
    }).join('');
  }

  if (banner) banner.classList.toggle('hidden', pct >= 100);
  if (pct > 0 && pct < 100 && bannerText && hints[0]) {
    bannerText.textContent = 'Следующий шаг: ' + hints[0].text;
  }
}

function hydrateCvPrivacy() {
  var toggle = document.getElementById('cvPublicToggle');
  var label = document.getElementById('cvPrivacyLabel');
  if (toggle) toggle.checked = !!state.employee.cvPublic;
  if (label) label.textContent = state.employee.cvPublic ? 'CV видно публично' : 'CV скрыто (по умолчанию)';
}

function updateCvPrivacy() {
  var toggle = document.getElementById('cvPublicToggle');
  var label = document.getElementById('cvPrivacyLabel');
  state.employee.cvPublic = toggle ? toggle.checked : false;
  if (label) label.textContent = state.employee.cvPublic ? 'CV видно публично' : 'CV скрыто (по умолчанию)';
}

function initHashRouting() {
  var hash = location.hash;
  if (hash && hash.startsWith('#profile=')) {
    var id = decodeURIComponent(hash.slice(9));
    if (!id) return;
    apiGetPublicProfile(id).then(function (profile) {
      openUserProfile(profile);
    }).catch(function () {
      showToast('Профиль не найден');
      if (getToken()) show(_profileFromScreen || 'landing');
      else showEntryScreen();
    });
  }
}

var CIS_UNIVERSITIES = [
  'МГУ им. М.В. Ломоносова', 'СПбГУ (Санкт-Петербургский государственный университет)',
  'МГТУ им. Н.Э. Баумана', 'НИУ ВШЭ (Высшая школа экономики)', 'МИФИ (Национальный ядерный университет)',
  'МФТИ (Московский физико-технический институт)', 'РАНХиГС',
  'МГИМО (Московский государственный институт международных отношений)',
  'Финансовый университет при Правительстве РФ', 'РЭУ им. Г.В. Плеханова',
  'РУДН (Российский университет дружбы народов)', 'УрФУ (Уральский федеральный университет)',
  'НГУ (Новосибирский государственный университет)', 'КФУ (Казанский федеральный университет)',
  'ТГУ (Томский государственный университет)', 'СФУ (Сибирский федеральный университет)',
  'ЮФУ (Южный федеральный университет)', 'ДВФУ (Дальневосточный федеральный университет)',
  'БФУ им. И. Канта (Балтийский федеральный университет)', 'РГГУ (Российский государственный гуманитарный университет)',
  'РГУНГ им. Губкина', 'МГТУ «СТАНКИН»', 'МАИ (Московский авиационный институт)',
  'МИИТ (РУТ — Российский университет транспорта)', 'МГСУ (НИУ Московский государственный строительный университет)',
  'ИТМО (Университет ИТМО, Санкт-Петербург)', 'Политех СПб (СПбПУ Петра Великого)',
  'ЛЭТИ (Санкт-Петербургский государственный электротехнический университет)',
  'СПбГАСУ (Санкт-Петербургский государственный архитектурно-строительный университет)',
  'НУ (Назарбаев Университет, Астана)', 'КазНУ им. аль-Фараби (Алматы)',
  'КНУ им. Тараса Шевченко (Киев)', 'КПИ им. Игоря Сикорского (Киев)',
  'БГУ (Белорусский государственный университет, Минск)',
  'НУУз (Национальный университет Узбекистана, Ташкент)',
  'БГУ (Бакинский государственный университет)',
  'ЕГУ (Ереванский государственный университет)',
  'ТГУ (Тбилисский государственный университет им. Джавахишвили)',
  'КНУ им. Жусупа Баласагына (Бишкек)',
  'ТНУ (Таджикский национальный университет, Душанбе)',
  'МГУ (Молдавский государственный университет, Кишинёв)',
  'Иннополис (Университет Иннополис, Татарстан)',
  'Сколтех (Сколковский институт науки и технологий)',
];

function filterUniList(query) {
  var dropdown = document.getElementById('uniDropdown');
  if (!dropdown) return;

  var q = String(query || '').trim().toLowerCase();
  if (q.length < 1) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    return;
  }

  var matches = CIS_UNIVERSITIES.filter(function (university) {
    return university.toLowerCase().includes(q);
  }).slice(0, 12);

  dropdown.innerHTML = '';
  matches.forEach(function (name) {
    var option = document.createElement('div');
    option.className = 'uniOption';
    option.textContent = name;
    option.addEventListener('click', function () { selectUni(name); });
    dropdown.appendChild(option);
  });

  var custom = document.createElement('div');
  custom.className = 'uniOption add-custom';
  custom.textContent = 'Добавить: «' + query + '»';
  custom.addEventListener('click', function () { selectUni(query); });
  dropdown.appendChild(custom);
  dropdown.classList.add('open');
}

function selectUni(name) {
  var input = document.getElementById('mpCEduPlace');
  var dropdown = document.getElementById('uniDropdown');
  if (input) input.value = name;
  if (dropdown) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }
}

document.addEventListener('click', function (event) {
  if (!event.target.closest('.uniWrap')) {
    var dropdown = document.getElementById('uniDropdown');
    if (dropdown) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
    }
  }
});

function syncChipSelection(chipSelector, attributeName, selectedValue) {
  var normalizedValue = String(selectedValue || '');
  document.querySelectorAll(chipSelector).forEach(function (chip) {
    chip.classList.toggle('active', String(chip.getAttribute(attributeName) || '') === normalizedValue);
  });
}

function syncFeedFilterChips() {
  var selectedView = '';
  var select = document.getElementById('feedViewFilter');
  if (select) selectedView = String(select.value || '');
  syncChipSelection('.feedFilterChip', 'data-feed-view', selectedView);

  var selectedVerified = '';
  var verSelect = document.getElementById('feedVerifiedFilter');
  if (verSelect) selectedVerified = String(verSelect.value || '');
  syncChipSelection('.feedVerifiedChip', 'data-feed-verified', selectedVerified);
}

function syncChipSelectionInside(container, chipSelector, attributeName, selectedValue) {
  var normalizedValue = String(selectedValue || '');
  if (!container) return;

  container.querySelectorAll(chipSelector).forEach(function (chip) {
    chip.classList.toggle('active', String(chip.getAttribute(attributeName) || '') === normalizedValue);
  });
}

function buildEmployerFilterSignature(lists) {
  return Object.keys(lists || {}).map(function (listId) {
    var list = lists[listId] || {};
    return [listId, list.name || ''].join(':');
  }).join('|');
}

function buildEmployerFilterChipsHtml(listIds, lists) {
  var html =
    '<button class="empFilterChip" data-verified="" type="button">Все кандидаты</button>' +
    '<button class="empFilterChip" data-verified="verified" type="button">✓ Верифицированные</button>';

  listIds.forEach(function (listId) {
    var list = lists[listId] || {};
    var filterValue = getBookmarkFilterValueForListId(listId);
    var icon = listId === 'default' ? '★ ' : '📁 ';
    html += '<button class="empFilterChip" data-verified="' + escHtml(filterValue) + '" type="button">' + icon + escHtml(list.name) + '</button>';
  });

  return html;
}

function buildEmployerFilterOptionsHtml(listIds, lists) {
  var html = '<option value="">Все кандидаты</option><option value="verified">Верифицированные</option>';

  listIds.forEach(function (listId) {
    var list = lists[listId] || {};
    var filterValue = getBookmarkFilterValueForListId(listId);
    html += '<option value="' + escHtml(filterValue) + '">' + escHtml(list.name) + '</option>';
  });

  return html;
}

function bindEmployerFilterChipEvents(chipContainer) {
  if (!chipContainer || chipContainer.dataset.bound === '1') return;

  chipContainer.dataset.bound = '1';
  chipContainer.addEventListener('click', function (event) {
    var button = event.target.closest('.empFilterChip');
    var select;
    var value;
    if (!button || !chipContainer.contains(button)) return;

    select = document.getElementById('empSearchVerified');
    value = button.getAttribute('data-verified') || '';
    syncChipSelectionInside(chipContainer, '.empFilterChip', 'data-verified', value);

    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change'));
    }
  });
}

function syncEmployerFilterChips() {
  var select = document.getElementById('empSearchVerified');
  var selectedView = normalizeBookmarkFilterValue(select ? String(select.value || '') : '');
  var chipContainer = document.querySelector('.empFilterChips');
  if (chipContainer) {
    var bookmarks = readBookmarks();
    var lists = bookmarks.lists || {};
    var listIds = Object.keys(lists);
    var signature = buildEmployerFilterSignature(lists);

    bindEmployerFilterChipEvents(chipContainer);

    if (signature !== employerFilterUiState.signature) {
      chipContainer.innerHTML = buildEmployerFilterChipsHtml(listIds, lists);
      if (select) select.innerHTML = buildEmployerFilterOptionsHtml(listIds, lists);
      employerFilterUiState.signature = signature;
    }

    if (select && select.value !== selectedView) select.value = selectedView;
    syncChipSelectionInside(chipContainer, '.empFilterChip', 'data-verified', selectedView);
  }
}

function syncBookmarkButtons(uid, isActive) {
  var targetUid = String(uid || '');
  document.querySelectorAll('.scBookmarkBtn[data-bookmark-uid]').forEach(function (button) {
    var matches = String(button.getAttribute('data-bookmark-uid') || '') === targetUid;
    if (!matches) return;
    button.classList.toggle('active', !!isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('title', isActive ? 'Убрать из избранного' : 'Добавить в избранное');
  });
}

function _isBookmarked(uid) {
  var bookmarks = readBookmarks();
  var lists = bookmarks.lists || {};
  var targetUid = String(uid || '');
  for (var key in lists) {
    if (lists[key].items && lists[key].items[targetUid]) return true;
  }
  return false;
}

var _currentBookmarkUid = null;

function addBookmarkToDefault(uid, user) {
  var bookmarks = readBookmarks();
  var targetUid = String(uid || '');
  var defaultList = ensureBookmarksDefaultList(bookmarks);

  defaultList.items[targetUid] = user;
  if (!writeBookmarks(bookmarks)) return false;

  syncEmployerFilterChips();
  syncBookmarkButtons(targetUid, true);
  return true;
}

function removeBookmarkFromAllLists(uid) {
  var bookmarks = readBookmarks();
  var lists = bookmarks.lists || {};
  var targetUid = String(uid || '');
  var changed = false;

  Object.keys(lists).forEach(function (listId) {
    var items = lists[listId] && lists[listId].items;
    if (!items || !Object.prototype.hasOwnProperty.call(items, targetUid)) return;
    delete items[targetUid];
    changed = true;
  });

  if (!changed) return false;
  if (!writeBookmarks(bookmarks)) return false;

  syncEmployerFilterChips();
  syncBookmarkButtons(targetUid, false);
  return true;
}

function openBookmarkFolderModal(uid) {
  var targetUid = String(uid || '');
  var modal = document.getElementById('atsFolderModal');
  if (!modal) return false;

  _currentBookmarkUid = targetUid;

  var user = _userCache[targetUid];
  var titleEl = document.getElementById('atsFolderModalTitle');
  if (titleEl && user) titleEl.textContent = 'Сохранить: ' + (user.full_name || user.company || user.email);
  modal.classList.add('open');
  renderFolderModalLists();
  return true;
}

function refreshActiveBookmarkViewAfterToggle() {
  if (isScreenActive('candidateFeed') && isBookmarkFavoritesFilter(feedState.view)) {
    loadCandidateFeed(feedState.page || 1);
    return;
  }

  if (isScreenActive('employerSearch') && isBookmarkFavoritesFilter(employerSearchState.verified)) {
    loadEmployerSearch(employerSearchState.page || 1);
  }
}

function toggleBookmark(uid, sourceButton, event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  else if (sourceButton && sourceButton.stopPropagation) sourceButton.stopPropagation();
  
  if (!state.userId) {
    showToast('Войдите в аккаунт, чтобы сохранять профили', 'error');
    return false;
  }
  
  var targetUid = String(uid || '');
  var user = _userCache[targetUid];
  if (!user) return false;

  if (!_isBookmarked(targetUid)) {
    if (addBookmarkToDefault(targetUid, user)) {
      showToast('Добавлено в избранное', 'success');
    }
    return false;
  }

  if (isBookmarkFavoritesFilter(feedState.view) || isBookmarkFavoritesFilter(employerSearchState.verified)) {
    if (removeBookmarkFromAllLists(targetUid)) {
      showToast('Удалено из избранного', 'info');
      refreshActiveBookmarkViewAfterToggle();
    }
    return false;
  }

  openBookmarkFolderModal(targetUid);
  return false;
}

function closeAtsFolderModal() {
  var modal = document.getElementById('atsFolderModal');
  if (modal) modal.classList.remove('open');
}

function bindAtsFolderModalEvents() {
  var listEl = document.getElementById('atsFolderModalLists');
  var createBtn = document.getElementById('createAtsFolderBtn');
  var input = document.getElementById('newAtsFolderName');

  if (listEl && listEl.dataset.bound !== '1') {
    listEl.dataset.bound = '1';

    listEl.addEventListener('click', function (event) {
      var button = event.target.closest('[data-ats-folder-action]');
      var listId;
      if (!button || !listEl.contains(button)) return;

      listId = button.getAttribute('data-list-id') || '';
      if (button.getAttribute('data-ats-folder-action') === 'rename') renameAtsFolder(listId);
      if (button.getAttribute('data-ats-folder-action') === 'delete') deleteAtsFolder(listId);
    });

    listEl.addEventListener('change', function (event) {
      var toggle = event.target.closest('input[data-ats-folder-toggle]');
      if (!toggle || !listEl.contains(toggle)) return;
      toggleUserInAtsFolder(toggle.getAttribute('data-ats-folder-toggle') || '', !!toggle.checked);
    });
  }

  if (createBtn && createBtn.dataset.bound !== '1') {
    createBtn.dataset.bound = '1';
    createBtn.addEventListener('click', createNewAtsFolder);
  }

  if (input && input.dataset.bound !== '1') {
    input.dataset.bound = '1';
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      createNewAtsFolder();
    });
  }

  document.querySelectorAll('.js-close-ats-modal').forEach(function (btn) {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', closeAtsFolderModal);
  });
}

function initAdminUiBindings() {
  bindEmployerFilterChipEvents(document.querySelector('.empFilterChips'));
  bindAtsFolderModalEvents();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAdminUiBindings);
else initAdminUiBindings();

// ── FOLDER MANAGEMENT (ATS) ──

function renderFolderModalLists() {
  var listEl = document.getElementById('atsFolderModalLists');
  if (!listEl) return;
  var bookmarks = readBookmarks();
  var lists = bookmarks.lists || {};
  var uid = _currentBookmarkUid;
  
  bindAtsFolderModalEvents();

  var html = Object.keys(lists).map(function(lId) {
    var list = lists[lId];
    var isChecked = !!(list.items && list.items[uid]);
    var isDefault = lId === 'default';
    var controls = isDefault ? '' : '<div class="atsFolderActions"><button type="button" class="faBtn edit" data-ats-folder-action="rename" data-list-id="' + escHtml(lId) + '" title="Переименовать">✎</button><button type="button" class="faBtn del" data-ats-folder-action="delete" data-list-id="' + escHtml(lId) + '" title="Удалить">✕</button></div>';
    
    return '<div class="atsFolderRow">' +
      '<label class="atsFolderLabel">' +
      '<input type="checkbox" data-ats-folder-toggle="' + escHtml(lId) + '"' + (isChecked ? ' checked' : '') + ' tabindex="0">' +
      '<span class="atsFolderTitle">📁 ' + escHtml(list.name) + ' <span class="atsFolderCount">(' + Object.keys(list.items || {}).length + ')</span></span>' +
      '</label>' + controls + '</div>';
  }).join('');
  
  listEl.innerHTML = html;
}

function toggleUserInAtsFolder(listId, isChecked) {
  var uid = _currentBookmarkUid;
  if (!uid) return;
  var user = _userCache[uid];
  if (!user) return;
  
  var bookmarks = readBookmarks();
  if (!bookmarks.lists[listId]) return;
  if (!bookmarks.lists[listId].items) bookmarks.lists[listId].items = {};
  
  if (isChecked) {
    bookmarks.lists[listId].items[uid] = user;
  } else {
    delete bookmarks.lists[listId].items[uid];
  }
  if (!writeBookmarks(bookmarks)) return;
  renderFolderModalLists();
  syncEmployerFilterChips();
  
  var isActive = _isBookmarked(uid);
  syncBookmarkButtons(uid, isActive);
  
  if (normalizeBookmarkFilterValue(employerSearchState.verified) === normalizeBookmarkFilterValue(listId) || isBookmarkFavoritesFilter(employerSearchState.verified)) {
    loadEmployerSearch();
  }
}

function createNewAtsFolder() {
  var input = document.getElementById('newAtsFolderName');
  if (!input) return;
  var name = input.value.trim();
  if (!name) { showToast('Введите название папки', 'error'); return; }
  
  var bookmarks = readBookmarks();
  var listId = 'list_' + Math.random().toString(36).substr(2, 9);
  bookmarks.lists[listId] = { id: listId, name: name, items: {} };
  if (!writeBookmarks(bookmarks)) return;
  
  input.value = '';
  renderFolderModalLists();
  syncEmployerFilterChips();
  showToast('Папка создана', 'success');
}

function renameAtsFolder(listId) {
  var bookmarks = readBookmarks();
  if (!bookmarks.lists[listId]) return;
  var newName = prompt('Новое название папки:', bookmarks.lists[listId].name);
  if (newName && newName.trim()) {
    bookmarks.lists[listId].name = newName.trim();
    if (!writeBookmarks(bookmarks)) return;
    renderFolderModalLists();
    syncEmployerFilterChips();
  }
}

function deleteAtsFolder(listId) {
  var bookmarks = readBookmarks();
  if (!bookmarks.lists[listId]) return;
  var count = Object.keys(bookmarks.lists[listId].items || {}).length;
  var msg = count > 0 
    ? 'Папка "' + bookmarks.lists[listId].name + '" содержит профили (' + count + '). Удалить папку вместе с профилями?' 
    : 'Удалить пустую папку "' + bookmarks.lists[listId].name + '"?';
    
  if (confirm(msg)) {
    delete bookmarks.lists[listId];
    if (!writeBookmarks(bookmarks)) return;
    renderFolderModalLists();
    syncEmployerFilterChips();
    
    var sel = document.getElementById('empSearchVerified');
    if (sel && sel.value === listId) {
      sel.value = '';
      filterEmployerSearch();
    } else {
      if (isBookmarkFolderFilter(employerSearchState.verified)) {
        loadEmployerSearch();
      }
    }
  }
}



function getScreenScrollTop(key) {
  if (!screens || !screens[key]) return 0;
  return Number(screens[key].scrollTop || 0);
}

function restoreScreenScrollTop(key, scrollTop) {
  if (!screens || !screens[key]) return;
  screens[key].scrollTop = Number(scrollTop || 0);
}

function isScreenActive(key) {
  return !!(screens && screens[key] && screens[key].classList.contains('active'));
}

function appendSocialCard(fragment, user) {
  var card = typeof createSocialCardElement === 'function' ? createSocialCardElement(user) : null;

  if (!card && typeof buildSocialCard === 'function') {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildSocialCard(user);
    card = wrapper.firstElementChild;
  }

  if (card) fragment.appendChild(card);
}

function loadCandidateFeed(page, options) {
  var opts = options || {};
  var isSilent = !!opts.silent;
  var isNextPage = !!opts.nextPage; // true when triggered by infinite scroll
  if (page) feedState.page = page;
  feedState.search = (document.getElementById('feedSearchInput')?.value || '').trim();
  feedState.view = (document.getElementById('feedViewFilter')?.value || '').trim();
  feedState.verified = (document.getElementById('feedVerifiedFilter')?.value || '').trim();

  syncFeedFilterChips();

  var listId = 'candidateFeedList';
  if (!document.getElementById(listId)) return Promise.resolve();

  if (isBookmarkFavoritesFilter(feedState.view)) {
    teardownInfiniteScroll({ current: _feedScrollObserver }, listId);
    _feedScrollObserver = null;
    var bookmarkedUsers = getVisibleBookmarkedUsers(feedState.search);
    renderFeedList(paginateLocalItems(bookmarkedUsers, feedState), false);
    renderPager('candidateFeedPager', feedState, loadCandidateFeed, { label: 'избранных профилей' });
    return Promise.resolve(bookmarkedUsers);
  }

  if (!isSilent && !isNextPage) renderFeedLoadingState(listId, 3);

  return apiGetFeed({
    page: feedState.page,
    pageSize: feedState.pageSize,
    search: feedState.search,
    verified: feedState.verified || undefined,
  }).then(function (result) {
    var scrollTop = isSilent ? getScreenScrollTop('candidateFeed') : 0;
    var data = normalizePaginatedResponse(result);
    syncPagerState(feedState, data);
    renderFeedList(data.items || [], isNextPage);
    renderPager('candidateFeedPager', feedState, loadCandidateFeed, { label: 'профилей' });
    if (feedState.page < feedState.totalPages) {
      var ref = { current: _feedScrollObserver };
      setupInfiniteScroll(listId, ref, 'candidateFeed', function () {
        if (feedState.page >= feedState.totalPages) return;
        feedState.page++;
        loadCandidateFeed(feedState.page, { nextPage: true });
      });
      _feedScrollObserver = ref.current;
    } else {
      // All pages loaded — remove sentinel
      teardownInfiniteScroll({ current: _feedScrollObserver }, listId);
      _feedScrollObserver = null;
    }
    if (isSilent) restoreScreenScrollTop('candidateFeed', scrollTop);
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: listId,
      pagerId: 'candidateFeedPager',
      label: 'профилей',
    })) return;
    if (isSilent) return;
    renderFeedErrorState(listId, err, 'Не удалось загрузить ленту');
    renderPager('candidateFeedPager', { total: 0 }, function () {}, { label: 'профилей' });
  });
}

function filterFeed() {
  // Reset infinite scroll when filter changes
  teardownInfiniteScroll({ current: _feedScrollObserver }, 'candidateFeedList');
  _feedScrollObserver = null;
  feedState.page = 1;
  loadCandidateFeed(1);
}

function renderFeedList(list, appendMode) {
  var el = document.getElementById('candidateFeedList');
  if (!el) return;

  var filtered = list.filter(function (user) {
    return String(user.id) !== String(state.userId);
  });

  if (!filtered.length && !appendMode) {
    if (isBookmarkFavoritesFilter(feedState.view)) {
      renderFeedEmptyState(
        'candidateFeedList',
        '★',
        feedState.search ? 'По этому запросу в избранном никого нет' : 'В избранном пока нет профилей'
      );
      return;
    }
    renderFeedEmptyState('candidateFeedList', '🔍', 'По текущему запросу профили не найдены');
    return;
  }

  var fragment = document.createDocumentFragment();
  filtered.forEach(function (user) {
    appendSocialCard(fragment, user);
  });

  if (appendMode) {
    // Remove old sentinel before appending (setupInfiniteScroll will add a new one)
    var old = el.querySelector('.feedScrollSentinel');
    if (old) old.remove();
    el.appendChild(fragment);
  } else {
    el.innerHTML = '';
    el.appendChild(fragment);
  }
}

function bindEmpExtraFilters() {
  document.querySelectorAll('[data-looking]').forEach(function(chip) {
    if (chip.dataset.bound === '1') return;
    chip.dataset.bound = '1';
    chip.addEventListener('click', function() {
      document.querySelectorAll('[data-looking]').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      employerSearchState.lookingFilter = chip.getAttribute('data-looking') || '';
      filterEmployerSearch();
    });
  });

  var salaryInput = document.getElementById('empSalaryMaxInput');
  var salaryClear = document.getElementById('empSalaryMaxClear');
  if (salaryInput && salaryInput.dataset.bound !== '1') {
    salaryInput.dataset.bound = '1';
    salaryInput.addEventListener('input', function() {
      employerSearchState.salaryMaxFilter = (salaryInput.value || '').trim();
      if (salaryClear) salaryClear.classList.toggle('hidden', !salaryInput.value);
      filterEmployerSearch();
    });
  }
  if (salaryClear && salaryClear.dataset.bound !== '1') {
    salaryClear.dataset.bound = '1';
    salaryClear.addEventListener('click', function() {
      if (salaryInput) salaryInput.value = '';
      employerSearchState.salaryMaxFilter = '';
      salaryClear.classList.add('hidden');
      filterEmployerSearch();
    });
  }
}

function applyEmpExtraFilters(users) {
  var lf = employerSearchState.lookingFilter;
  var rawSm = (document.getElementById('empSalaryMaxInput')?.value || employerSearchState.salaryMaxFilter || '').trim();
  var sm = rawSm ? parseInt(rawSm, 10) : 0;
  return users.filter(function(u) {
    if (lf === 'yes' && !u.looking_for_work) return false;
    if (sm > 0 && u.salary_expectations) {
      var match = String(u.salary_expectations).replace(/\s/g, '').match(/(\d+)/);
      if (match && parseInt(match[1], 10) > sm) return false;
    }
    return true;
  });
}

function updateEmpSearchMeta(total) {
  var badge = document.getElementById('empSearchCountBadge');
  var clearBtn = document.getElementById('empClearSearchBtn');
  var searchVal = (document.getElementById('empSearchName')?.value || '').trim();
  if (badge) {
    badge.textContent = total > 0 ? total + ' кандидатов' : '';
    badge.style.display = total > 0 ? '' : 'none';
  }
  if (clearBtn) clearBtn.classList.toggle('hidden', !searchVal);
}

function loadEmployerSearch(page, options) {
  var opts = options || {};
  var isSilent = !!opts.silent;
  var isNextPage = !!opts.nextPage;
  if (page) employerSearchState.page = page;
  employerSearchState.search = (document.getElementById('empSearchName')?.value || '').trim();
  employerSearchState.verified = (document.getElementById('empSearchVerified')?.value || '').trim();

  syncEmployerFilterChips();

  var listId = 'employerCandidateList';
  if (!document.getElementById(listId)) return Promise.resolve();

  if (employerSearchState.verified && employerSearchState.verified !== 'verified') {
    teardownInfiniteScroll({ current: _employerScrollObserver }, listId);
    _employerScrollObserver = null;
    var bookmarkListId = getBookmarkListIdFromFilter(employerSearchState.verified);
    var bookmarkedUsers = filterBookmarkedUsers(getBookmarkedUsersList(bookmarkListId), employerSearchState.search);
    renderEmployerSearch(paginateLocalItems(bookmarkedUsers, employerSearchState), false);
    renderPager('employerCandidatePager', employerSearchState, loadEmployerSearch, { label: 'сохраненных' });
    return Promise.resolve(bookmarkedUsers);
  }

  if (!isSilent && !isNextPage) renderFeedLoadingState(listId, 4);

  return apiGetCandidates({
    page: employerSearchState.page,
    pageSize: employerSearchState.pageSize,
    search: employerSearchState.search,
    verified: employerSearchState.verified === 'verified' ? 'true' : '',
  }).then(function (result) {
    var scrollTop = isSilent ? getScreenScrollTop('employerSearch') : 0;
    var data = normalizePaginatedResponse(result);
    syncPagerState(employerSearchState, data);
    var filteredItems = applyEmpExtraFilters(data.items || []);
    renderEmployerSearch(filteredItems, isNextPage);
    updateEmpSearchMeta(data.total || 0);
    renderPager('employerCandidatePager', employerSearchState, loadEmployerSearch, { label: 'кандидатов' });
    if (employerSearchState.page < employerSearchState.totalPages) {
      var ref = { current: _employerScrollObserver };
      setupInfiniteScroll(listId, ref, 'employerSearch', function () {
        if (employerSearchState.page >= employerSearchState.totalPages) return;
        employerSearchState.page++;
        loadEmployerSearch(employerSearchState.page, { nextPage: true });
      });
      _employerScrollObserver = ref.current;
    } else {
      teardownInfiniteScroll({ current: _employerScrollObserver }, listId);
      _employerScrollObserver = null;
    }
    if (isSilent) restoreScreenScrollTop('employerSearch', scrollTop);
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: listId,
      pagerId: 'employerCandidatePager',
      label: 'кандидатов',
    })) return;
    if (isSilent) return;
    renderFeedErrorState(listId, err, 'Не удалось загрузить кандидатов');
    renderPager('employerCandidatePager', { total: 0 }, function () {}, { label: 'кандидатов' });
  });
}

function filterEmployerSearch() {
  teardownInfiniteScroll({ current: _employerScrollObserver }, 'employerCandidateList');
  _employerScrollObserver = null;
  employerSearchState.page = 1;
  loadEmployerSearch(1);
}

function renderEmployerSearch(list, appendMode) {
  var el = document.getElementById('employerCandidateList');
  if (!el) return;
  if (!list.length && !appendMode) {
    if (isBookmarkFavoritesFilter(employerSearchState.verified)) {
      renderFeedEmptyState(
        'employerCandidateList',
        '★',
        employerSearchState.search ? 'По этому запросу в избранном никого нет' : 'В избранном пока нет кандидатов'
      );
      return;
    }
    renderFeedEmptyState('employerCandidateList', '👤', 'Нет кандидатов по текущему фильтру');
    return;
  }

  var fragment = document.createDocumentFragment();
  list.forEach(function (candidate) {
    appendSocialCard(fragment, candidate);
  });

  if (appendMode) {
    var old = el.querySelector('.feedScrollSentinel');
    if (old) old.remove();
    el.appendChild(fragment);
  } else {
    el.innerHTML = '';
    el.appendChild(fragment);
  }
}

function loadAdminCandidates(page) {
  if (!getToken()) return;
  if (page) adminCandidateState.page = page;
  adminCandidateState.search = (document.getElementById('adminCandSearch')?.value || '').trim();

  var el = document.getElementById('adminCandidateList');
  if (!el) return;
  el.innerHTML = '<div class="adminListLoading">Загрузка...</div>';

  apiGetCandidates({
    page: adminCandidateState.page,
    pageSize: adminCandidateState.pageSize,
    search: adminCandidateState.search,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminCandidateState, data);
    renderAdminCandidates(data.items || []);
    renderPager('adminCandidatePager', adminCandidateState, loadAdminCandidates, { label: 'кандидатов' });
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: 'adminCandidateList',
      pagerId: 'adminCandidatePager',
      label: 'кандидатов',
    })) return;
    showToast(safeErrorText(err), 'error');
    renderAdminCandidates([], 'Не удалось загрузить кандидатов');
    renderPager('adminCandidatePager', { total: 0 }, function () {}, { label: 'кандидатов' });
  });
}

function loadAdminEmployers(page) {
  if (!getToken()) return;
  if (page) adminEmployerState.page = page;
  adminEmployerState.search = (document.getElementById('adminEmpSearch')?.value || '').trim();

  var el = document.getElementById('adminEmployerList');
  if (!el) return;
  el.innerHTML = '<div class="adminListLoading">Загрузка...</div>';

  apiAdminUsers({
    page: adminEmployerState.page,
    pageSize: adminEmployerState.pageSize,
    search: adminEmployerState.search,
    role: 'employer',
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminEmployerState, data);
    renderAdminEmployers(data.items || []);
    renderPager('adminEmployerPager', adminEmployerState, loadAdminEmployers, { label: 'компаний' });
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: 'adminEmployerList',
      pagerId: 'adminEmployerPager',
      label: 'компаний',
    })) return;
    showToast(safeErrorText(err), 'error');
    renderAdminEmployers([], 'Не удалось загрузить компании');
    renderPager('adminEmployerPager', { total: 0 }, function () {}, { label: 'компаний' });
  });
}

function switchAdminTab(tab) {
  ['docs', 'candidates', 'employers', 'users'].forEach(function (key) {
    var panel = document.getElementById('adminTabPanel' + key.charAt(0).toUpperCase() + key.slice(1));
    var button = document.getElementById('adminTab' + key.charAt(0).toUpperCase() + key.slice(1));
    if (panel) panel.classList.toggle('hidden', key !== tab);
    if (button) button.classList.toggle('active', key === tab);
  });

  if (tab === 'docs') loadAdminQueue();
  if (tab === 'candidates') loadAdminCandidates();
  if (tab === 'employers') loadAdminEmployers();
  if (tab === 'users') loadAdminUsers();
}

function filterAdminCandidates() {
  adminCandidateState.page = 1;
  loadAdminCandidates(1);
}

function filterAdminEmployers() {
  adminEmployerState.page = 1;
  loadAdminEmployers(1);
}

function renderAdminCandidates(list, emptyText) {
  var el = document.getElementById('adminCandidateList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="adminEmptyState">' + escapeHtml(emptyText || 'Нет кандидатов') + '</div>';
    return;
  }
  el.innerHTML = '';
  var fragment = document.createDocumentFragment();
  list.forEach(function (candidate) {
    candidate.role = candidate.role || 'candidate';
    appendSocialCard(fragment, candidate);
  });
  el.appendChild(fragment);
}

function renderAdminEmployers(list, emptyText) {
  var el = document.getElementById('adminEmployerList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="adminEmptyState">' + escapeHtml(emptyText || 'Нет работодателей') + '</div>';
    return;
  }
  el.innerHTML = '';
  var fragment = document.createDocumentFragment();
  list.forEach(function (user) {
    appendSocialCard(fragment, user);
  });
  el.appendChild(fragment);
}
