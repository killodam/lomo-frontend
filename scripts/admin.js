var _userCache = {};
var _connectionsData = { accepted: [], incoming: [], outgoing: [], counts: { accepted: 0, incoming: 0, outgoing: 0 } };

var feedState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '', view: '' };
var employerSearchState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '', verified: '' };
var FEED_AUTO_REFRESH_MS = Math.max(10000, Number(window.LOMO_CONFIG && window.LOMO_CONFIG.FEED_AUTO_REFRESH_MS || 30000) || 30000);
var FEED_PULL_REFRESH_TRIGGER_PX = 78;
var FEED_PULL_REFRESH_MAX_PX = 132;
var feedAutoRefreshState = { timer: null, inFlight: false };
var feedPullRefreshState = { screenKey: '', screenEl: null, startY: 0, distance: 0, dragging: false, armed: false, hideTimer: null };
var adminQueueState = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
var adminCandidateState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var adminEmployerState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var adminUsersState = { page: 1, pageSize: 20, total: 0, totalPages: 0, search: '' };

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
  button.className = 'pagerBtn pagerNum';
  button.textContent = String(pageNumber);

  if (pageNumber === currentPage) {
    button.disabled = true;
    button.style.opacity = '1';
    button.style.cursor = 'default';
    button.style.background = '#0e0f0f';
    button.style.color = '#fff';
    button.style.borderColor = '#0e0f0f';
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
  dots.className = 'pagerMeta';
  dots.textContent = '…';
  dots.style.padding = '0 2px';
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
    var users = data.items || [];
    syncPagerState(adminUsersState, data);

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
        '<th class="adminUsersHeadCell">Email</th>' +
        '<th class="adminUsersHeadCell">Имя / Компания</th>' +
        '<th class="adminUsersHeadCell">Роль</th>' +
        '<th class="adminUsersHeadCell">Действия</th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    users.forEach(function (user) {
      var tr = document.createElement('tr');
      tr.className = 'adminUsersRow';
      tr.innerHTML =
        '<td class="adminUsersCell">' + escapeHtml(user.email || '—') + '</td>' +
        '<td class="adminUsersCell">' + escapeHtml(user.full_name || user.company || '—') + '</td>' +
        '<td class="adminUsersCell"><span class="adminUsersRoleTag">' + escapeHtml(user.role || '—') + '</span></td>' +
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
      return '<button type="button" class="pillBtn" data-open-doc="' + file.id + '" data-file-name="' + escapeHtml(file.file_name || DOC_TYPE_LABELS[type]) + '">Открыть: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }

    var req = requestMap[type];
    if (req && req.status === 'pending') {
      return '<button type="button" class="pillBtn" disabled>Запрос отправлен: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }
    if (req && req.status === 'approved') {
      return '<button type="button" class="pillBtn" disabled>Доступ одобрен: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }

    return '<button type="button" class="pillBtn" data-request-doc="' + type + '" data-candidate-id="' + candidateId + '">Запросить: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
  }).join('');

  var filesHtml = (files && files.length)
    ? files.map(function (file) {
        return '<div class="achRow">' +
          '<div><div class="achTitle">' + escapeHtml(DOC_TYPE_LABELS[file.type] || file.type) + '</div><div class="achMeta">' + escapeHtml(file.file_name || '') + '</div></div>' +
          '<button type="button" class="miniLink" data-open-doc="' + file.id + '" data-file-name="' + escapeHtml(file.file_name || 'document') + '">Открыть</button>' +
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

function buildFeedTags(user) {
  var tags = [];
  var statuses = {
    education: user.edu_status,
    work: user.work_status,
    courses: user.course_status,
    passport: user.pass_status,
    cv: user.cv_status,
  };
  var labels = {
    education: 'Образование',
    work: 'Опыт',
    courses: 'Курсы',
    passport: 'Паспорт',
    cv: 'CV',
  };

  Object.keys(statuses).forEach(function (key) {
    var status = statuses[key];
    if (status === 'verified') tags.push('<span class="feedTag verified">' + labels[key] + '</span>');
    else if (status === 'pending') tags.push('<span class="feedTag pending">' + labels[key] + '</span>');
  });

  if (!tags.length) tags.push('<span class="feedTag placeholder">Заполняется</span>');
  return tags.join('');
}

// ── BOOKMARKS LOGIC ───────────────────────────────────────
function getBookmarksStorageKey() {
  return 'lomo_favs_' + String(state.userId || 'anon');
}

function readBookmarks() {
  try {
    var raw = window.localStorage.getItem(getBookmarksStorageKey());
    var parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeBookmarks(bookmarks) {
  try {
    window.localStorage.setItem(getBookmarksStorageKey(), JSON.stringify(bookmarks || {}));
    return true;
  } catch (error) {
    showToast('Не удалось сохранить избранное', 'error');
    return false;
  }
}

function getBookmarkedUsersList() {
  var bookmarks = readBookmarks();
  return Object.keys(bookmarks).map(function (uid) {
    return bookmarks[uid];
  }).filter(Boolean);
}

function buildBookmarkSearchText(user) {
  var parts = [
    user && user.full_name,
    user && user.email,
    user && user.location,
    user && user.edu_place,
    user && user.edu_year,
    user && user.vacancies,
    user && user.about,
    user && user.current_job,
    user && user.job_title,
    user && user.company,
    user && user.industry,
  ];

  if (Array.isArray(user && user.work_exp)) {
    user.work_exp.forEach(function (item) {
      if (!item) return;
      parts.push(item.company, item.role, item.period, item.desc);
    });
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
}

function filterBookmarkedUsers(list, query) {
  var normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return list.slice();

  return list.filter(function (user) {
    return buildBookmarkSearchText(user).indexOf(normalizedQuery) !== -1;
  });
}

function paginateLocalItems(items, pagerState) {
  var total = items.length;
  var totalPages = total ? Math.ceil(total / pagerState.pageSize) : 0;
  var safePage = pagerState.page || 1;
  var start;

  if (totalPages && safePage > totalPages) safePage = totalPages;
  if (!totalPages) safePage = 1;

  pagerState.page = safePage;
  start = (safePage - 1) * pagerState.pageSize;
  syncPagerState(pagerState, {
    total: total,
    page: safePage,
    pageSize: pagerState.pageSize,
    totalPages: totalPages,
  });
  return items.slice(start, start + pagerState.pageSize);
}

function getVisibleBookmarkedUsers(query) {
  return filterBookmarkedUsers(getBookmarkedUsersList(), query).filter(function (user) {
    return String(user && user.id || user && user.email || '') !== String(state.userId || '');
  });
}

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
}

function syncEmployerFilterChips() {
  var selectedView = '';
  var select = document.getElementById('empSearchVerified');

  if (select) selectedView = String(select.value || '');
  syncChipSelection('.empFilterChip', 'data-verified', selectedView);
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
  return !!bookmarks[String(uid || '')];
}

function toggleBookmark(uid, sourceButton, event) {
  var targetUid = String(uid || '');
  var button = sourceButton && sourceButton.nodeType === 1 ? sourceButton : null;
  var evt = event || (button ? null : sourceButton);
  var bookmarks;
  var user;
  var isActive;

  if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
  if (!state.userId) {
    showToast('Войдите в аккаунт, чтобы добавлять избранное', 'error');
    return false;
  }

  bookmarks = readBookmarks();

  if (bookmarks[targetUid]) {
    delete bookmarks[targetUid];
    showToast('Удалено из избранного', 'info');
  } else {
    user = _userCache[targetUid];
    if (user) {
      bookmarks[targetUid] = user;
      showToast('Добавлено в избранное', 'success');
    } else {
      showToast('Не удалось добавить профиль в избранное', 'error');
      return false;
    }
  }

  if (!writeBookmarks(bookmarks)) return false;

  isActive = !!bookmarks[targetUid];
  if (button) {
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('title', isActive ? 'Убрать из избранного' : 'Добавить в избранное');
  }
  syncBookmarkButtons(targetUid, isActive);

  if (employerSearchState.verified === 'favorites') {
    loadEmployerSearch();
  }
  if (feedState.view === 'favorites') {
    loadCandidateFeed(feedState.page);
  }

  return isActive;
}


function buildSocialCard(user) {
  var isEmployer = user.role === 'employer';
  var name = escHtml(user.full_name || (isEmployer ? user.company : '') || user.email || '?');
  var rawName = name.replace(/&[^;]+;/g, '');
  var initials = rawName.split(' ').map(function (segment) { return segment[0] || ''; }).join('').slice(0, 2).toUpperCase() || '?';
  var avatarRoleClass = isEmployer ? ' employer' : ' candidate';

  var verificationStatuses = [user.edu_status, user.work_status, user.course_status, user.pass_status, user.cv_status];
  var verifiedCount = verificationStatuses.filter(function (status) { return status === 'verified'; }).length;
  var pendingCount = verificationStatuses.filter(function (status) { return status === 'pending'; }).length;
  var verificationBadge = verifiedCount > 0
    ? '<span class="scVerBadge">✓ LOMO ' + verifiedCount + '</span>'
    : (pendingCount > 0 ? '<span class="scVerBadge pending">Проверяется</span>' : '');

  var roleTag = isEmployer
    ? '<span class="scRoleTag employer">Работодатель</span>'
    : '<span class="scRoleTag candidate">Кандидат</span>';

  var subParts = isEmployer
    ? [user.industry, user.location].filter(Boolean)
    : [user.edu_place, user.edu_year, user.location].filter(Boolean);
  var subLine = subParts.length ? '<div class="scSub">' + escHtml(subParts.join(' · ')) + '</div>' : '';

  var jobLine = '';
  if (!isEmployer && user.current_job && user.current_job !== 'Не работаю') {
    jobLine = '<div class="scJobLine">' + escHtml(user.current_job + (user.job_title ? ' · ' + user.job_title : '')) + '</div>';
  } else if (!isEmployer && user.current_job === 'Не работаю') {
    jobLine = '<div class="scJobLine muted">В поиске работы</div>';
  }

  var workExpLine = '';
  if (!isEmployer && user.work_exp && user.work_exp.length) {
    workExpLine = '<div class="scWorkExp">' + user.work_exp.slice(0, 2).map(function (item) {
      return '<div class="scExpItem"><span class="scExpCo">' + escHtml(item.company || '') + '</span>' +
        (item.role ? ' <span class="scExpRole">· ' + escHtml(item.role) + '</span>' : '') +
        (item.period ? ' <span class="scExpPeriod">' + escHtml(item.period) + '</span>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  var aboutSnippet = user.about
    ? '<div class="scAbout">' + escHtml(user.about.slice(0, 120)) + (user.about.length > 120 ? '…' : '') + '</div>'
    : '';

  var extraLines = '';
  if (isEmployer) {
    var safeWebsite = safeHttpUrl(user.website);
    if (safeWebsite) {
      extraLines += '<div class="scSub compact"><a href="' + escHtml(safeWebsite) + '" target="_blank" rel="noopener noreferrer" class="scSubLink">' + escHtml(user.website) + '</a></div>';
    }
    if (user.needed) {
      var needed = user.needed.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 4);
      if (needed.length) {
        extraLines += '<div class="scChipRow spacious"><span class="scChipLabel">Ищем:</span>' +
          needed.map(function (item) { return '<span class="scProject hiring">' + escHtml(item) + '</span>'; }).join('') +
        '</div>';
      }
    }
  }

  var detailLines = '';
  if (!isEmployer) {
    var verifiedData = [];
    if (user.edu_status === 'verified') verifiedData.push({ label: 'Образование', tool: [user.edu_place, user.edu_year].filter(Boolean).join(', ') || 'Диплом проверен' });
    if (user.work_status === 'verified') verifiedData.push({ label: 'Опыт', tool: user.work_exp && user.work_exp[0] ? [user.work_exp[0].company, user.work_exp[0].role].filter(Boolean).join(' · ') : 'Стаж подтвержден' });
    if (user.course_status === 'verified') verifiedData.push({ label: 'Курсы', tool: 'Сертификаты доп. образования проверены' });
    if (user.pass_status === 'verified') verifiedData.push({ label: 'Паспорт', tool: 'Личность пользователя подтверждена' });
    if (user.cv_status === 'verified') verifiedData.push({ label: 'CV', tool: 'Резюме соответствует документам' });

    if (verifiedData.length) {
      detailLines += '<div class="scChipRow regular">' +
        verifiedData.map(function (item) {
          var safeTool = escHtml(item.tool).replace(/"/g, '&quot;');
          return '<span class="scVerItem has-tooltip" data-tooltip="' + safeTool + '">✓ ' + item.label + '</span>'; 
        }).join('') +
      '</div>';
    }
    if (user.vacancies) {
      var vacancies = user.vacancies.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3);
      if (vacancies.length) {
        detailLines += '<div class="scChipRow compact"><span class="scChipLabel">Ищу:</span>' +
          vacancies.map(function (value) { return '<span class="scProject">' + escHtml(value) + '</span>'; }).join('') +
        '</div>';
      }
    }
  }

  var projectsLine = '';
  if (isEmployer && user.active_projects) {
    var projects = user.active_projects.split(';').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3);
    if (projects.length) {
      projectsLine = '<div class="scChipRow compact"><span class="scChipLabel">Проекты:</span>' +
        projects.map(function (value) { return '<span class="scProject">' + escHtml(value) + '</span>'; }).join('') +
      '</div>';
    }
  }

  var hasBody = aboutSnippet || jobLine || workExpLine || extraLines || detailLines || projectsLine;
  var avatarHtml;
  var avatarSrc = safeImageUrl(user.avatar_url);
  if (avatarSrc) {
    avatarHtml = '<div class="scAvatar' + avatarRoleClass + '">' +
      '<img src="' + escHtml(avatarSrc) + '" class="scAvatarImage" onerror="this.style.display=\'none\'">' +
    '</div>';
  } else {
    avatarHtml = '<div class="scAvatar' + avatarRoleClass + '"><div class="scAvatarFallback' + avatarRoleClass + '">' + initials + '</div></div>';
  }

  var uid = String(user.id || user.email || '?');
  _userCache[uid] = user;

  // Bookmarking button for signed-in users
  var bookmarkBtn = '';
  if (state.userId) {
    var isBookmarked = _isBookmarked(uid);
    bookmarkBtn = '<button class="scBookmarkBtn' + (isBookmarked ? ' active' : '') + '" type="button" data-bookmark-uid="' + escHtml(uid) + '" aria-pressed="' + (isBookmarked ? 'true' : 'false') + '" title="' + (isBookmarked ? 'Убрать из избранного' : 'Добавить в избранное') + '" aria-label="' + (isBookmarked ? 'Убрать из избранного' : 'Добавить в избранное') + '">★</button>';
  }

  return '<div class="socialCard clickable" data-uid="' + uid + '">' +
    bookmarkBtn +
    '<div class="scHead">' +
      avatarHtml +
      '<div class="scInfo">' +
        '<div class="scNameRow"><span class="scName">' + name + '</span>' + verificationBadge + '</div>' +
        subLine +
        '<div class="scRoleRow">' + roleTag + '</div>' +
      '</div>' +
    '</div>' +
    (hasBody ? '<div class="scBody">' + (aboutSnippet || '') + jobLine + workExpLine + extraLines + detailLines + projectsLine + '</div>' : '') +
    '</div>';
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

function loadCandidateFeed(page, options) {
  var opts = options || {};
  var isSilent = !!opts.silent;
  if (page) feedState.page = page;
  feedState.search = (document.getElementById('feedSearchInput')?.value || '').trim();
  feedState.view = (document.getElementById('feedViewFilter')?.value || '').trim();

  syncFeedFilterChips();

  var listId = 'candidateFeedList';
  if (!document.getElementById(listId)) return Promise.resolve();

  if (feedState.view === 'favorites') {
    var bookmarkedUsers = getVisibleBookmarkedUsers(feedState.search);
    renderFeedList(paginateLocalItems(bookmarkedUsers, feedState));
    renderPager('candidateFeedPager', feedState, loadCandidateFeed, { label: 'избранных профилей' });
    return Promise.resolve(bookmarkedUsers);
  }

  if (!isSilent) renderFeedLoadingState(listId, 3);

  return apiGetFeed({
    page: feedState.page,
    pageSize: feedState.pageSize,
    search: feedState.search,
  }).then(function (result) {
    var scrollTop = isSilent ? getScreenScrollTop('candidateFeed') : 0;
    var data = normalizePaginatedResponse(result);
    syncPagerState(feedState, data);
    renderFeedList(data.items || []);
    renderPager('candidateFeedPager', feedState, loadCandidateFeed, { label: 'профилей' });
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
  feedState.page = 1;
  loadCandidateFeed(1);
}

function renderFeedList(list) {
  var el = document.getElementById('candidateFeedList');
  if (!el) return;

  var filtered = list.filter(function (user) {
    return String(user.id) !== String(state.userId);
  });

  if (!filtered.length) {
    if (feedState.view === 'favorites') {
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

  el.innerHTML = filtered.map(function (user) {
    return buildSocialCard(user);
  }).join('');
}

function loadEmployerSearch(page, options) {
  var opts = options || {};
  var isSilent = !!opts.silent;
  if (page) employerSearchState.page = page;
  employerSearchState.search = (document.getElementById('empSearchName')?.value || '').trim();
  employerSearchState.verified = (document.getElementById('empSearchVerified')?.value || '').trim();

  syncEmployerFilterChips();

  var listId = 'employerCandidateList';
  if (!document.getElementById(listId)) return Promise.resolve();

  if (employerSearchState.verified === 'favorites') {
    var bookmarkedUsers = filterBookmarkedUsers(getBookmarkedUsersList(), employerSearchState.search);
    renderEmployerSearch(paginateLocalItems(bookmarkedUsers, employerSearchState));
    renderPager('employerCandidatePager', employerSearchState, loadEmployerSearch, { label: 'избранных' });
    return Promise.resolve(bookmarkedUsers);
  }

  if (!isSilent) renderFeedLoadingState(listId, 4);

  return apiGetCandidates({
    page: employerSearchState.page,
    pageSize: employerSearchState.pageSize,
    search: employerSearchState.search,
    verified: employerSearchState.verified === 'verified' ? 'true' : '',
  }).then(function (result) {
    var scrollTop = isSilent ? getScreenScrollTop('employerSearch') : 0;
    var data = normalizePaginatedResponse(result);
    syncPagerState(employerSearchState, data);
    renderEmployerSearch(data.items || []);
    renderPager('employerCandidatePager', employerSearchState, loadEmployerSearch, { label: 'кандидатов' });
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
  employerSearchState.page = 1;
  loadEmployerSearch(1);
}

function renderEmployerSearch(list) {
  var el = document.getElementById('employerCandidateList');
  if (!el) return;
  if (!list.length) {
    if (employerSearchState.verified === 'favorites') {
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
  el.innerHTML = list.map(function (candidate) {
    return buildSocialCard(candidate);
  }).join('');
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

function loadAdminFeedTab(tab) {
  if (tab === 'candidates') loadAdminCandidates();
  if (tab === 'employers') loadAdminEmployers();
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
  el.innerHTML = list.map(function (candidate) {
    candidate.role = candidate.role || 'candidate';
    return buildSocialCard(candidate);
  }).join('');
}

function renderAdminEmployers(list, emptyText) {
  var el = document.getElementById('adminEmployerList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="adminEmptyState">' + escapeHtml(emptyText || 'Нет работодателей') + '</div>';
    return;
  }
  el.innerHTML = list.map(function (user) {
    return buildSocialCard(user);
  }).join('');
}

function getFeedRefreshTask(screenKey, options) {
  var opts = options || {};
  var silent = opts.silent !== false;

  if (screenKey === 'candidateFeed' && feedState.view !== 'favorites') {
    return function () { return loadCandidateFeed(feedState.page, { silent: silent }); };
  }

  if (screenKey === 'employerSearch' && employerSearchState.verified !== 'favorites') {
    return function () { return loadEmployerSearch(employerSearchState.page, { silent: silent }); };
  }

  return null;
}

function refreshFeedScreen(screenKey, options) {
  var task = getFeedRefreshTask(screenKey, options);
  if (!state.userId || !task || feedAutoRefreshState.inFlight) return Promise.resolve(false);

  feedAutoRefreshState.inFlight = true;
  return Promise.resolve(task()).then(function () {
    return true;
  }).catch(function () {
    return false;
  }).finally(function () {
    feedAutoRefreshState.inFlight = false;
  });
}

function refreshActiveFeed(options) {
  if (!state.userId) return Promise.resolve(false);

  if (isScreenActive('candidateFeed') && feedState.view !== 'favorites') {
    return refreshFeedScreen('candidateFeed', options);
  }

  if (isScreenActive('employerSearch') && employerSearchState.verified !== 'favorites') {
    return refreshFeedScreen('employerSearch', options);
  }

  return Promise.resolve(false);
}

function clearFeedAutoRefreshTimer() {
  if (!feedAutoRefreshState.timer) return;
  window.clearTimeout(feedAutoRefreshState.timer);
  feedAutoRefreshState.timer = null;
}

function hasRefreshableActiveFeed() {
  if (isScreenActive('candidateFeed')) {
    return !!getFeedRefreshTask('candidateFeed', { silent: true });
  }
  if (isScreenActive('employerSearch')) {
    return !!getFeedRefreshTask('employerSearch', { silent: true });
  }
  return false;
}

function canRunFeedAutoRefresh() {
  return !!state.userId && !document.hidden && hasRefreshableActiveFeed();
}

function scheduleFeedAutoRefresh(delayMs) {
  var delay = Number(delayMs);
  clearFeedAutoRefreshTimer();
  if (!canRunFeedAutoRefresh() || feedAutoRefreshState.inFlight) return;

  feedAutoRefreshState.timer = window.setTimeout(function () {
    feedAutoRefreshState.timer = null;
    refreshActiveFeed({ silent: true }).finally(function () {
      scheduleFeedAutoRefresh(FEED_AUTO_REFRESH_MS);
    });
  }, window.isFinite(delay) && delay >= 0 ? delay : FEED_AUTO_REFRESH_MS);
}

function syncFeedAutoRefresh(forceRefresh) {
  if (!canRunFeedAutoRefresh()) {
    clearFeedAutoRefreshTimer();
    return;
  }

  if (forceRefresh && !feedAutoRefreshState.inFlight) {
    clearFeedAutoRefreshTimer();
    refreshActiveFeed({ silent: true }).finally(function () {
      scheduleFeedAutoRefresh(FEED_AUTO_REFRESH_MS);
    });
    return;
  }

  if (!feedAutoRefreshState.timer && !feedAutoRefreshState.inFlight) {
    scheduleFeedAutoRefresh(FEED_AUTO_REFRESH_MS);
  }
}

function getPullRefreshPoint(event) {
  if (event.touches && event.touches[0]) return event.touches[0];
  if (event.changedTouches && event.changedTouches[0]) return event.changedTouches[0];
  return null;
}

function isPullRefreshBlockedTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest('input, textarea, select, button, a, label');
}

function ensureFeedPullRefreshIndicator(screenEl) {
  if (!screenEl) return null;
  var existing = screenEl.querySelector('.feedPullRefresh');
  if (existing) return existing;

  var indicator = document.createElement('div');
  indicator.className = 'feedPullRefresh';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML = '<span class="feedPullRefreshLabel">Потяните вниз, чтобы обновить</span>';
  screenEl.appendChild(indicator);
  return indicator;
}

function updateFeedPullRefreshIndicator(screenEl, mode, distance) {
  var indicator = ensureFeedPullRefreshIndicator(screenEl);
  if (!indicator) return;

  var label = indicator.querySelector('.feedPullRefreshLabel');
  var offset = mode === 'loading'
    ? 14
    : Math.max(-14, Math.min(24, Math.round(Number(distance || 0) / 3) - 10));

  indicator.className = 'feedPullRefresh' + (mode === 'hidden' ? '' : ' visible') + (mode === 'ready' ? ' ready' : '') + (mode === 'loading' ? ' loading' : '');
  indicator.style.transform = 'translate(-50%, ' + offset + 'px)';

  if (label) {
    if (mode === 'ready') label.textContent = 'Отпустите, чтобы обновить';
    else if (mode === 'loading') label.textContent = 'Обновляем ленту…';
    else label.textContent = 'Потяните вниз, чтобы обновить';
  }
}

function resetFeedPullRefreshIndicator(screenEl) {
  window.clearTimeout(feedPullRefreshState.hideTimer);
  updateFeedPullRefreshIndicator(screenEl, 'hidden', 0);
}

function releaseFeedPullRefresh() {
  var screenEl = feedPullRefreshState.screenEl;
  var screenKey = feedPullRefreshState.screenKey;
  var shouldRefresh = !!(screenEl && feedPullRefreshState.dragging && feedPullRefreshState.armed);

  feedPullRefreshState.screenKey = '';
  feedPullRefreshState.screenEl = null;
  feedPullRefreshState.startY = 0;
  feedPullRefreshState.distance = 0;
  feedPullRefreshState.dragging = false;
  feedPullRefreshState.armed = false;

  if (!screenEl) return;
  if (!shouldRefresh) {
    resetFeedPullRefreshIndicator(screenEl);
    return;
  }

  updateFeedPullRefreshIndicator(screenEl, 'loading', FEED_PULL_REFRESH_TRIGGER_PX);
  refreshFeedScreen(screenKey, { silent: true }).finally(function () {
    window.clearTimeout(feedPullRefreshState.hideTimer);
    feedPullRefreshState.hideTimer = window.setTimeout(function () {
      resetFeedPullRefreshIndicator(screenEl);
    }, 180);
    scheduleFeedAutoRefresh(FEED_AUTO_REFRESH_MS);
  });
}

function bindFeedPullRefresh(screenKey) {
  var screenEl = screens && screens[screenKey];
  if (!screenEl || screenEl.dataset.pullRefreshBound === '1') return;

  ensureFeedPullRefreshIndicator(screenEl);

  screenEl.addEventListener('touchstart', function (event) {
    var point;
    if (!isScreenActive(screenKey) || screenEl.scrollTop > 0 || feedAutoRefreshState.inFlight) return;
    if (isPullRefreshBlockedTarget(event.target) || !getFeedRefreshTask(screenKey, { silent: true })) return;

    point = getPullRefreshPoint(event);
    if (!point) return;

    window.clearTimeout(feedPullRefreshState.hideTimer);
    feedPullRefreshState.screenKey = screenKey;
    feedPullRefreshState.screenEl = screenEl;
    feedPullRefreshState.startY = point.clientY;
    feedPullRefreshState.distance = 0;
    feedPullRefreshState.dragging = true;
    feedPullRefreshState.armed = false;
    updateFeedPullRefreshIndicator(screenEl, 'pull', 0);
  }, { passive: true });

  screenEl.addEventListener('touchmove', function (event) {
    var point;
    var deltaY;
    var distance;
    if (!feedPullRefreshState.dragging || feedPullRefreshState.screenEl !== screenEl) return;
    if (screenEl.scrollTop > 0) {
      releaseFeedPullRefresh();
      return;
    }

    point = getPullRefreshPoint(event);
    if (!point) return;

    deltaY = point.clientY - feedPullRefreshState.startY;
    if (deltaY <= 0) {
      resetFeedPullRefreshIndicator(screenEl);
      return;
    }

    if (event.cancelable) event.preventDefault();
    distance = Math.min(FEED_PULL_REFRESH_MAX_PX, Math.round(deltaY * 0.65));
    feedPullRefreshState.distance = distance;
    feedPullRefreshState.armed = distance >= FEED_PULL_REFRESH_TRIGGER_PX;
    updateFeedPullRefreshIndicator(screenEl, feedPullRefreshState.armed ? 'ready' : 'pull', distance);
  }, { passive: false });

  screenEl.addEventListener('touchend', function () {
    releaseFeedPullRefresh();
  });

  screenEl.addEventListener('touchcancel', function () {
    releaseFeedPullRefresh();
  });

  screenEl.dataset.pullRefreshBound = '1';
}

(function initFeedAutoRefresh() {
  bindFeedPullRefresh('candidateFeed');
  bindFeedPullRefresh('employerSearch');
  syncFeedAutoRefresh(false);

  window.addEventListener('focus', function () {
    syncFeedAutoRefresh(true);
  });
  document.addEventListener('visibilitychange', function () {
    syncFeedAutoRefresh(!document.hidden);
  });
  window.addEventListener('lomo:screen-change', function () {
    syncFeedAutoRefresh(false);
  });
})();
