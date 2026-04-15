(function initChatUi() {
  var FALLBACK_POLL_INTERVAL_MS = 12000;
  var SOCKET_RECONNECT_BASE_MS = 1500;
  var SOCKET_RECONNECT_MAX_MS = 10000;
  var NEW_MESSAGE_THRESHOLD_PX = 96;

  var chatState = {
    previousScreen: 'auth',
    pollingTimer: null,
    pollingInFlight: false,
    conversationPager: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    socket: null,
    socketMode: 'idle',
    reconnectTimer: null,
    reconnectAttempts: 0,
    syncTimer: null,
    renderedMetaByConversation: {},
    lastRenderedConversationId: '',
    newestWhileAwayCount: 0,
  };

  var elements = {
    shell: document.getElementById('chatShell'),
    sidebarMeta: document.getElementById('chatSidebarMeta'),
    autoBadge: document.getElementById('chatAutoBadge'),
    list: document.getElementById('chatConversationList'),
    empty: document.getElementById('chatEmptyState'),
    messages: document.getElementById('chatMessageList'),
    newMessagesBtn: document.getElementById('chatNewMessagesBtn'),
    composer: document.getElementById('chatComposer'),
    composerHint: document.getElementById('chatComposerHint'),
    input: document.getElementById('chatMessageInput'),
    send: document.getElementById('chatSendBtn'),
    title: document.getElementById('chatThreadTitle'),
    meta: document.getElementById('chatThreadMeta'),
    returnBtn: document.getElementById('chatReturnBtn'),
    refreshBtn: document.getElementById('chatRefreshBtn'),
    backToListBtn: document.getElementById('chatBackToListBtn'),
    openProfileBtn: document.getElementById('chatOpenProfileBtn'),
  };

  function shouldEnableChat() {
    return !!getToken() && state.roleReg !== 'ADMIN';
  }

  function isChatActive() {
    return !!(screens.chat && screens.chat.classList.contains('active'));
  }

  function rememberReturnScreen() {
    var activeKey = Object.keys(screens || {}).find(function (key) {
      return screens[key] && screens[key].classList.contains('active') && key !== 'chat';
    });
    if (activeKey) chatState.previousScreen = activeKey;
  }

  function participantName(conversation) {
    return String(
      conversation && (
        conversation.full_name ||
        conversation.company ||
        'Диалог LOMO'
      )
    );
  }

  function participantMeta(conversation) {
    if (!conversation) return '';
    if (conversation.participant_role === 'employer') {
      return conversation.company || conversation.industry || conversation.location || 'Работодатель';
    }
    return conversation.current_job || conversation.job_title || conversation.location || 'Кандидат';
  }

  function participantInitials(conversation) {
    return participantName(conversation)
      .split(' ')
      .map(function (segment) { return segment[0] || ''; })
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'LO';
  }

  function normalizeConversation(raw) {
    if (!raw) return null;
    var participant = raw.participant || {};
    var normalized = {
      id: raw.id,
      kind: raw.kind || 'direct',
      created_at: raw.created_at || '',
      last_message_at: raw.last_message_at || raw.last_message_created_at || '',
      last_read_at: raw.last_read_at || '',
      participant_user_id: raw.participant_user_id || participant.id || '',
      participant_role: raw.participant_role || participant.role || '',
      public_id: raw.public_id || participant.public_id || '',
      full_name: raw.full_name || participant.full_name || '',
      company: raw.company || participant.company || '',
      avatar_url: raw.avatar_url || participant.avatar_url || '',
      location: raw.location || participant.location || '',
      industry: raw.industry || participant.industry || '',
      current_job: raw.current_job || participant.current_job || '',
      job_title: raw.job_title || participant.job_title || '',
      last_message_body: raw.last_message_body || '',
      last_message_created_at: raw.last_message_created_at || raw.last_message_at || '',
      last_message_author_id: raw.last_message_author_id || '',
      unread_count: Number(raw.unread_count || 0),
    };

    if (normalized.participant_user_id) {
      _userCache[String(normalized.participant_user_id)] = Object.assign({}, _userCache[String(normalized.participant_user_id)] || {}, {
        id: normalized.participant_user_id,
        role: normalized.participant_role,
        public_id: normalized.public_id,
        full_name: normalized.full_name,
        company: normalized.company,
        avatar_url: normalized.avatar_url,
        location: normalized.location,
        industry: normalized.industry,
        current_job: normalized.current_job,
        job_title: normalized.job_title,
      });
    }

    return normalized;
  }

  function normalizeMessage(message) {
    if (!message) return null;
    return {
      id: message.id,
      body: String(message.body || ''),
      created_at: message.created_at || '',
      edited_at: message.edited_at || '',
      author_user_id: String(message.author_user_id || ''),
    };
  }

  function formatChatTime(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    var now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }

  function findConversation(conversationId) {
    return (state.chat.conversations || []).find(function (conversation) {
      return String(conversation.id) === String(conversationId || '');
    }) || null;
  }

  function computeUnreadTotal() {
    return (state.chat.conversations || []).reduce(function (sum, conversation) {
      return sum + Number(conversation.unread_count || 0);
    }, 0);
  }

  function ensureHeaderChatBadge(button) {
    if (!button) return null;
    var badge = button.querySelector('.chatNavUnreadBadge');
    if (badge) return badge;
    badge = document.createElement('span');
    badge.className = 'chatNavUnreadBadge hidden';
    button.appendChild(badge);
    return badge;
  }

  function renderHeaderUnreadBadges() {
    var unreadTotal = computeUnreadTotal();
    document.querySelectorAll('[data-next="toChatHub"]').forEach(function (button) {
      var badge = ensureHeaderChatBadge(button);
      if (!badge) return;
      if (unreadTotal > 0) {
        badge.textContent = unreadTotal > 99 ? '99+' : String(unreadTotal);
        badge.classList.remove('hidden');
        button.classList.add('hasChatUnread');
      } else {
        badge.textContent = '';
        badge.classList.add('hidden');
        button.classList.remove('hasChatUnread');
      }
    });
  }

  function setThreadVisibility(isVisible) {
    if (!elements.shell) return;
    elements.shell.classList.toggle('chatThreadVisible', !!isVisible);
  }

  function updateAutoBadge(text, tone) {
    if (!elements.autoBadge) return;
    var palette = {
      error: { bg: '#fef2f2', color: '#b91c1c', border: 'rgba(185,28,28,.16)' },
      busy: { bg: '#fff8eb', color: '#b45309', border: 'rgba(180,83,9,.16)' },
      live: { bg: '#ecfdf5', color: '#047857', border: 'rgba(4,120,87,.18)' },
      fallback: { bg: '#eff6ff', color: '#1d4ed8', border: 'rgba(29,78,216,.14)' },
      ok: { bg: '#eef8fa', color: '#1f6a75', border: 'rgba(42,122,138,.18)' },
    };
    var style = palette[tone] || palette.ok;
    elements.autoBadge.textContent = text || 'Авто';
    elements.autoBadge.style.background = style.bg;
    elements.autoBadge.style.color = style.color;
    elements.autoBadge.style.borderColor = style.border;
  }

  function resetNewMessagesIndicator() {
    chatState.newestWhileAwayCount = 0;
    if (elements.newMessagesBtn) {
      elements.newMessagesBtn.classList.add('hidden');
      elements.newMessagesBtn.textContent = 'Новые сообщения ↓';
    }
  }

  function showNewMessagesIndicator(count) {
    if (!elements.newMessagesBtn) return;
    chatState.newestWhileAwayCount = Math.max(chatState.newestWhileAwayCount, Number(count || 1));
    elements.newMessagesBtn.textContent = chatState.newestWhileAwayCount > 1
      ? 'Новых сообщений: ' + chatState.newestWhileAwayCount + ' ↓'
      : 'Новое сообщение ↓';
    elements.newMessagesBtn.classList.remove('hidden');
  }

  function scrollMessagesToBottom(behavior) {
    if (!elements.messages) return;
    elements.messages.scrollTo({
      top: elements.messages.scrollHeight,
      behavior: behavior || 'auto',
    });
    resetNewMessagesIndicator();
  }

  function isNearBottom() {
    if (!elements.messages) return true;
    var delta = elements.messages.scrollHeight - elements.messages.scrollTop - elements.messages.clientHeight;
    return delta <= NEW_MESSAGE_THRESHOLD_PX;
  }

  function preserveScroll(previousOffsetFromBottom) {
    if (!elements.messages) return;
    var nextTop = Math.max(0, elements.messages.scrollHeight - previousOffsetFromBottom);
    elements.messages.scrollTop = nextTop;
  }

  function renderConversationList() {
    if (!elements.list) return;
    var conversations = Array.isArray(state.chat.conversations) ? state.chat.conversations : [];
    var unreadTotal = computeUnreadTotal();

    if (!conversations.length) {
      elements.list.innerHTML = '<div class="chatConversationEmpty">Контакты появятся здесь, как только вы начнёте первый диалог.</div>';
      if (elements.sidebarMeta) {
        elements.sidebarMeta.textContent = 'Пока без диалогов. Напишите контакту из профиля или после одобренного доступа.';
      }
      renderHeaderUnreadBadges();
      return;
    }

    if (elements.sidebarMeta) {
      elements.sidebarMeta.textContent = 'Диалогов: ' + conversations.length + (unreadTotal ? ' • новых: ' + unreadTotal : '');
    }

    elements.list.innerHTML = conversations.map(function (conversation) {
      var isActive = String(conversation.id) === String(state.chat.activeConversationId || '');
      var avatarSrc = typeof safeImageUrl === 'function' ? safeImageUrl(conversation.avatar_url) : '';
      var unreadCount = Number(conversation.unread_count || 0);
      var preview = conversation.last_message_body || 'Диалог готов к старту';
      return (
        '<button type="button" class="chatConversationItem' + (isActive ? ' active' : '') + '" data-chat-conversation-id="' + escapeHtml(conversation.id) + '">' +
          '<div class="chatConversationAvatar">' +
            (avatarSrc
              ? '<img src="' + escapeHtml(avatarSrc) + '" alt="avatar">'
              : '<span>' + escapeHtml(participantInitials(conversation)) + '</span>') +
          '</div>' +
          '<div class="chatConversationBody">' +
            '<div class="chatConversationTop">' +
              '<span class="chatConversationName">' + escapeHtml(participantName(conversation)) + '</span>' +
              '<span class="chatConversationTime">' + escapeHtml(formatChatTime(conversation.last_message_created_at || conversation.last_message_at || conversation.created_at)) + '</span>' +
            '</div>' +
            '<div class="chatConversationMeta">' + escapeHtml(participantMeta(conversation)) + '</div>' +
            '<div class="chatConversationPreview">' + escapeHtml(preview) + '</div>' +
          '</div>' +
          (unreadCount ? '<span class="chatUnreadBadge">' + escapeHtml(String(unreadCount)) + '</span>' : '') +
        '</button>'
      );
    }).join('');

    renderHeaderUnreadBadges();
  }

  function renderThread(options) {
    options = options || {};
    if (!elements.empty || !elements.messages || !elements.composer || !elements.title || !elements.meta || !elements.openProfileBtn) return;
    var activeConversation = findConversation(state.chat.activeConversationId);
    if (!activeConversation) {
      chatState.lastRenderedConversationId = '';
      resetNewMessagesIndicator();
      elements.title.textContent = 'Выберите диалог';
      elements.meta.textContent = 'После подключения или одобренного доступа здесь можно продолжить разговор.';
      elements.empty.classList.remove('hidden');
      elements.messages.classList.add('hidden');
      elements.composer.classList.add('hidden');
      elements.openProfileBtn.classList.add('hidden');
      setThreadVisibility(false);
      return;
    }

    var conversationId = String(activeConversation.id || '');
    var messages = Array.isArray(state.chat.messagesByConversation[conversationId])
      ? state.chat.messagesByConversation[conversationId]
      : [];
    var conversationChanged = chatState.lastRenderedConversationId !== conversationId;
    var renderedMeta = chatState.renderedMetaByConversation[conversationId] || { count: 0, lastId: '' };
    var previousOffsetFromBottom = elements.messages.scrollHeight - elements.messages.scrollTop;
    var shouldStickToBottom = options.forceScrollBottom || conversationChanged || !renderedMeta.count || isNearBottom();

    elements.title.textContent = participantName(activeConversation);
    elements.meta.textContent = participantMeta(activeConversation) || 'Диалог внутри платформы LOMO';
    elements.openProfileBtn.classList.toggle('hidden', !activeConversation.participant_user_id);
    elements.openProfileBtn.dataset.userId = activeConversation.participant_user_id || '';

    elements.empty.classList.add('hidden');
    elements.messages.classList.remove('hidden');
    elements.composer.classList.remove('hidden');
    if (elements.composerHint) {
      elements.composerHint.textContent = messages.length
        ? 'Сообщения видны только участникам диалога.'
        : 'Начните разговор первым сообщением.';
    }

    if (!messages.length) {
      resetNewMessagesIndicator();
      elements.messages.innerHTML = '<div class="chatThreadPlaceholder">Диалог создан. Напишите первое сообщение.</div>';
      setThreadVisibility(true);
      chatState.lastRenderedConversationId = conversationId;
      chatState.renderedMetaByConversation[conversationId] = { count: 0, lastId: '' };
      return;
    }

    elements.messages.innerHTML = messages.map(function (message) {
      var mine = String(message.author_user_id) === String(state.userId || '');
      return (
        '<div class="chatBubbleRow' + (mine ? ' mine' : '') + '">' +
          '<div class="chatBubble' + (mine ? ' mine' : '') + '">' +
            '<div class="chatBubbleText">' + escapeHtml(message.body) + '</div>' +
            '<div class="chatBubbleMeta">' + escapeHtml(formatChatTime(message.created_at)) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    if (shouldStickToBottom) {
      scrollMessagesToBottom(options.smooth ? 'smooth' : 'auto');
    } else {
      preserveScroll(previousOffsetFromBottom);
      var nextCount = messages.length;
      var delta = Math.max(0, nextCount - renderedMeta.count);
      if (delta > 0) showNewMessagesIndicator(delta);
    }

    setThreadVisibility(true);
    chatState.lastRenderedConversationId = conversationId;
    chatState.renderedMetaByConversation[conversationId] = {
      count: messages.length,
      lastId: messages[messages.length - 1] ? String(messages[messages.length - 1].id || '') : '',
    };
  }

  function mergeConversation(conversation) {
    if (!conversation) return;
    var current = Array.isArray(state.chat.conversations) ? state.chat.conversations.slice() : [];
    var existingIndex = current.findIndex(function (item) { return String(item.id) === String(conversation.id); });
    if (existingIndex >= 0) current[existingIndex] = Object.assign({}, current[existingIndex], conversation);
    else current.unshift(conversation);

    current.sort(function (left, right) {
      var leftStamp = new Date(left.last_message_at || left.last_message_created_at || left.created_at || 0).getTime();
      var rightStamp = new Date(right.last_message_at || right.last_message_created_at || right.created_at || 0).getTime();
      return rightStamp - leftStamp;
    });

    state.chat.conversations = current;
  }

  function handleProtectedError(err) {
    return typeof recoverAuthFlowOnProtectedError === 'function'
      && recoverAuthFlowOnProtectedError(err, { listId: 'chatConversationList', pagerId: 'chatConversationPager', label: 'чатов' });
  }

  async function loadConversations(options) {
    if (!shouldEnableChat()) {
      state.chat.conversations = [];
      renderConversationList();
      renderThread();
      return [];
    }

    options = options || {};
    if (!options.silent && isChatActive() && elements.list) {
      elements.list.innerHTML = '<div class="miniHint">Загрузка диалогов...</div>';
    }

    try {
      var result = await apiGetChatConversations({
        page: options.page || chatState.conversationPager.page || 1,
        pageSize: chatState.conversationPager.pageSize || 20,
      });
      var data = normalizePaginatedResponse(result);
      chatState.conversationPager.page = data.page || 1;
      chatState.conversationPager.pageSize = data.pageSize || chatState.conversationPager.pageSize;
      chatState.conversationPager.total = data.total || 0;
      chatState.conversationPager.totalPages = data.totalPages || 0;
      state.chat.conversations = (data.items || []).map(normalizeConversation).filter(Boolean);

      if (state.chat.activeConversationId && !findConversation(state.chat.activeConversationId)) {
        state.chat.activeConversationId = '';
        chatState.lastRenderedConversationId = '';
      }

      renderConversationList();
      if ((chatState.conversationPager.totalPages || 0) > 1) {
        renderPager('chatConversationPager', chatState.conversationPager, function (page) {
          loadConversations({ page: page, silent: false });
        }, { label: 'чатов' });
      } else {
        var pagerEl = document.getElementById('chatConversationPager');
        if (pagerEl) pagerEl.innerHTML = '';
      }

      if (state.chat.activeConversationId && isChatActive()) {
        await loadMessages(state.chat.activeConversationId, {
          silent: true,
          reason: options.reason,
          smooth: options.reason === 'message-created',
        });
      } else if (isChatActive()) {
        renderThread();
      }

      if (chatState.socket && chatState.socket.readyState === window.WebSocket.OPEN) {
        updateAutoBadge('Live', 'live');
      } else if (chatState.socketMode === 'fallback') {
        updateAutoBadge('Авто', 'fallback');
      } else {
        updateAutoBadge('Авто', 'ok');
      }
      return state.chat.conversations;
    } catch (err) {
      if (handleProtectedError(err)) return [];
      if (!options.silent && elements.list && isChatActive()) {
        elements.list.innerHTML = '<div class="miniHint" style="color:#991b1b;">Ошибка: ' + escapeHtml(safeErrorText(err)) + '</div>';
      }
      renderPager('chatConversationPager', { total: 0 }, function () {}, { label: 'чатов' });
      updateAutoBadge('Ошибка', 'error');
      throw err;
    }
  }

  async function loadMessages(conversationId, options) {
    if (!conversationId) {
      renderThread();
      return [];
    }

    options = options || {};
    if (!options.silent && isChatActive() && elements.messages) {
      elements.empty.classList.add('hidden');
      elements.messages.classList.remove('hidden');
      elements.messages.innerHTML = '<div class="chatThreadPlaceholder">Загрузка сообщений...</div>';
      elements.composer.classList.remove('hidden');
    }

    try {
      var result = await apiGetChatMessages(conversationId, { page: 1, pageSize: 50 });
      var data = normalizePaginatedResponse(result);
      state.chat.messagesByConversation[String(conversationId)] = (data.items || []).map(normalizeMessage).filter(Boolean);
      var activeConversation = findConversation(conversationId);
      if (activeConversation) activeConversation.unread_count = 0;
      renderConversationList();
      if (isChatActive() && String(state.chat.activeConversationId || '') === String(conversationId || '')) {
        renderThread({
          forceScrollBottom: !!options.forceScrollBottom,
          smooth: !!options.smooth || options.reason === 'message-created',
        });
      }
      return state.chat.messagesByConversation[String(conversationId)];
    } catch (err) {
      if (handleProtectedError(err)) return [];
      if (elements.messages && isChatActive()) {
        elements.messages.innerHTML = '<div class="chatThreadPlaceholder" style="color:#991b1b;">Ошибка загрузки: ' + escapeHtml(safeErrorText(err)) + '</div>';
      }
      throw err;
    }
  }

  async function selectConversation(conversationId) {
    if (!conversationId) return;
    state.chat.activeConversationId = conversationId;
    resetNewMessagesIndicator();
    renderConversationList();
    await loadMessages(conversationId, { silent: false, forceScrollBottom: true });
  }

  function clearReconnectTimer() {
    if (!chatState.reconnectTimer) return;
    window.clearTimeout(chatState.reconnectTimer);
    chatState.reconnectTimer = null;
  }

  function stopFallbackPolling() {
    if (!chatState.pollingTimer) return;
    window.clearInterval(chatState.pollingTimer);
    chatState.pollingTimer = null;
  }

  function startFallbackPolling() {
    if (chatState.pollingTimer || !shouldEnableChat()) return;
    chatState.socketMode = 'fallback';
    updateAutoBadge('Авто', 'fallback');
    chatState.pollingTimer = window.setInterval(function () {
      if (chatState.pollingInFlight || !shouldEnableChat() || document.hidden) return;
      chatState.pollingInFlight = true;
      loadConversations({ silent: !isChatActive(), reason: 'fallback-poll' }).catch(function () {}).finally(function () {
        chatState.pollingInFlight = false;
      });
    }, FALLBACK_POLL_INTERVAL_MS);
  }

  function disconnectRealtime() {
    clearReconnectTimer();
    stopFallbackPolling();
    if (chatState.syncTimer) {
      window.clearTimeout(chatState.syncTimer);
      chatState.syncTimer = null;
    }
    if (chatState.socket) {
      try {
        chatState.socket.close();
      } catch (error) {}
      chatState.socket = null;
    }
    chatState.socketMode = 'idle';
    updateAutoBadge('Авто', 'ok');
  }

  function scheduleSocketReconnect() {
    if (!shouldEnableChat() || chatState.reconnectTimer) return;
    var delay = Math.min(SOCKET_RECONNECT_MAX_MS, SOCKET_RECONNECT_BASE_MS * Math.max(1, chatState.reconnectAttempts || 1));
    chatState.reconnectTimer = window.setTimeout(function () {
      chatState.reconnectTimer = null;
      ensureRealtimeConnection(true).catch(function () {});
    }, delay);
  }

  function scheduleConversationSync(payload) {
    if (!shouldEnableChat()) return;
    if (chatState.syncTimer) window.clearTimeout(chatState.syncTimer);
    chatState.syncTimer = window.setTimeout(function () {
      chatState.syncTimer = null;
      if (chatState.pollingInFlight) return;
      chatState.pollingInFlight = true;
      loadConversations({ silent: !isChatActive(), reason: payload && payload.reason }).catch(function () {}).finally(function () {
        chatState.pollingInFlight = false;
      });
    }, 150);
  }

  function handleSocketPayload(raw) {
    try {
      var payload = JSON.parse(String(raw || '{}'));
      if (payload.type === 'chat.ready') {
        chatState.socketMode = 'realtime';
        updateAutoBadge('Live', 'live');
        stopFallbackPolling();
        return;
      }
      if (payload.type === 'chat.pong') return;
      if (payload.type === 'chat.sync') {
        scheduleConversationSync(payload);
      }
    } catch (error) {
      updateAutoBadge('Ошибка', 'error');
    }
  }

  async function ensureRealtimeConnection(force) {
    if (!shouldEnableChat()) {
      disconnectRealtime();
      renderHeaderUnreadBadges();
      return;
    }

    if (chatState.socket && !force) {
      if (chatState.socket.readyState === window.WebSocket.OPEN || chatState.socket.readyState === window.WebSocket.CONNECTING) {
        return;
      }
    }

    clearReconnectTimer();

    try {
      updateAutoBadge('Подключаем', 'busy');
      var ticketPayload = await apiGetChatWsTicket();
      if (!ticketPayload || !ticketPayload.ticket) {
        throw new Error('Missing realtime ticket');
      }
      var socketUrl = getChatWebSocketUrl(ticketPayload.ticket, ticketPayload.ws_path);
      var socket = new window.WebSocket(socketUrl);
      chatState.socket = socket;
      chatState.socketMode = 'connecting';

      socket.addEventListener('open', function () {
        if (chatState.socket !== socket) return;
        chatState.socketMode = 'realtime';
        chatState.reconnectAttempts = 0;
        stopFallbackPolling();
        updateAutoBadge('Live', 'live');
      });

      socket.addEventListener('message', function (event) {
        if (chatState.socket !== socket) return;
        handleSocketPayload(event.data);
      });

      socket.addEventListener('close', function () {
        if (chatState.socket === socket) {
          chatState.socket = null;
        }
        chatState.socketMode = 'fallback';
        chatState.reconnectAttempts += 1;
        startFallbackPolling();
        scheduleSocketReconnect();
      });

      socket.addEventListener('error', function () {
        if (chatState.socket !== socket) return;
        chatState.socketMode = 'fallback';
        updateAutoBadge('Авто', 'fallback');
      });
    } catch (error) {
      chatState.socketMode = 'fallback';
      chatState.reconnectAttempts += 1;
      updateAutoBadge('Авто', 'fallback');
      startFallbackPolling();
      if (!String(error && error.message || '').includes('Missing realtime ticket')) {
        scheduleSocketReconnect();
      }
    }
  }

  async function openHub() {
    if (!getToken()) {
      showToast('Войдите, чтобы открыть чаты');
      showEntryScreen();
      return;
    }
    if (state.roleReg === 'ADMIN') {
      showToast('Чаты недоступны для администратора');
      return;
    }

    rememberReturnScreen();
    state.chat.activeConversationId = '';
    chatState.lastRenderedConversationId = '';
    resetNewMessagesIndicator();
    setThreadVisibility(false);
    show('chat');
    if (!state.chat.conversations.length) {
      await loadConversations({ silent: false });
      return;
    }
    renderConversationList();
    renderThread();
  }

  async function openWithUser(userId) {
    if (!userId) return;
    if (!getToken()) {
      showToast('Войдите, чтобы написать пользователю');
      showEntryScreen();
      return;
    }
    if (state.roleReg === 'ADMIN') {
      showToast('Чаты недоступны для администратора');
      return;
    }

    rememberReturnScreen();
    show('chat');
    if (elements.messages) {
      elements.empty.classList.add('hidden');
      elements.messages.classList.remove('hidden');
      elements.messages.innerHTML = '<div class="chatThreadPlaceholder">Открываем диалог...</div>';
      elements.composer.classList.remove('hidden');
    }

    try {
      var result = await apiStartChatConversation(userId);
      var conversation = normalizeConversation(result && result.conversation);
      mergeConversation(conversation);
      state.chat.activeConversationId = conversation.id;
      renderConversationList();
      await loadMessages(conversation.id, { silent: false, forceScrollBottom: true });
      await loadConversations({ silent: true, reason: 'conversation-open' });
    } catch (err) {
      if (handleProtectedError(err)) return;
      showToast('Чат недоступен: ' + safeErrorText(err));
      await loadConversations({ silent: false }).catch(function () {});
    }
  }

  async function sendMessage() {
    var conversationId = state.chat.activeConversationId;
    var body = (elements.input && elements.input.value || '').trim();
    if (!conversationId || !body) return;

    elements.send.disabled = true;
    try {
      var message = normalizeMessage(await apiSendChatMessage(conversationId, body));
      var bucket = Array.isArray(state.chat.messagesByConversation[String(conversationId)])
        ? state.chat.messagesByConversation[String(conversationId)].slice()
        : [];
      bucket.push(message);
      state.chat.messagesByConversation[String(conversationId)] = bucket;
      var activeConversation = findConversation(conversationId);
      if (activeConversation) {
        activeConversation.last_message_body = message.body;
        activeConversation.last_message_at = message.created_at;
        activeConversation.last_message_created_at = message.created_at;
        activeConversation.last_message_author_id = message.author_user_id;
        activeConversation.unread_count = 0;
      }
      if (elements.input) elements.input.value = '';
      renderConversationList();
      renderThread({ forceScrollBottom: true, smooth: true });
    } catch (err) {
      if (!handleProtectedError(err)) {
        showToast('Не удалось отправить сообщение: ' + safeErrorText(err));
      }
    } finally {
      elements.send.disabled = false;
    }
  }

  function goBack() {
    var destination = chatState.previousScreen || (state.roleReg === 'EMPLOYER' ? 'employerSearch' : 'candidateFeed');
    show(destination);
  }

  function handleScreenChange(screenKey) {
    if (!shouldEnableChat()) {
      disconnectRealtime();
      renderHeaderUnreadBadges();
      if (screenKey !== 'chat') setThreadVisibility(false);
      return;
    }

    ensureRealtimeConnection(false).catch(function () {});

    if (screenKey === 'chat') {
      renderConversationList();
      renderThread({ forceScrollBottom: !chatState.lastRenderedConversationId });
      if (!state.chat.conversations.length) {
        loadConversations({ silent: false, reason: 'chat-open' }).catch(function () {});
      } else if (state.chat.activeConversationId && !state.chat.messagesByConversation[String(state.chat.activeConversationId)]) {
        loadMessages(state.chat.activeConversationId, { silent: false, forceScrollBottom: true }).catch(function () {});
      }
      return;
    }

    setThreadVisibility(false);
    if (!state.chat.conversations.length) {
      loadConversations({ silent: true, reason: 'header-sync' }).catch(function () {});
    } else {
      renderHeaderUnreadBadges();
    }
  }

  window.addEventListener('focus', function () {
    if (!shouldEnableChat()) return;
    ensureRealtimeConnection(false).catch(function () {});
    if (!chatState.pollingInFlight) {
      chatState.pollingInFlight = true;
      loadConversations({ silent: !isChatActive(), reason: 'focus-sync' }).catch(function () {}).finally(function () {
        chatState.pollingInFlight = false;
      });
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !shouldEnableChat()) return;
    ensureRealtimeConnection(false).catch(function () {});
    if (!chatState.pollingInFlight) {
      chatState.pollingInFlight = true;
      loadConversations({ silent: !isChatActive(), reason: 'visibility-sync' }).catch(function () {}).finally(function () {
        chatState.pollingInFlight = false;
      });
    }
  });

  if (elements.messages) {
    elements.messages.addEventListener('scroll', function () {
      if (isNearBottom()) resetNewMessagesIndicator();
    });
  }

  if (elements.newMessagesBtn) {
    elements.newMessagesBtn.addEventListener('click', function () {
      scrollMessagesToBottom('smooth');
    });
  }

  if (elements.list) {
    elements.list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-chat-conversation-id]');
      if (!button) return;
      selectConversation(button.dataset.chatConversationId);
    });
  }

  if (elements.composer) {
    elements.composer.addEventListener('submit', function (event) {
      event.preventDefault();
      sendMessage();
    });
  }

  if (elements.returnBtn) {
    elements.returnBtn.addEventListener('click', function () {
      goBack();
    });
  }

  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', function () {
      updateAutoBadge(chatState.socketMode === 'realtime' ? 'Live' : 'Синхр.', chatState.socketMode === 'realtime' ? 'live' : 'busy');
      loadConversations({ silent: false, reason: 'manual-refresh' }).catch(function () {});
    });
  }

  if (elements.backToListBtn) {
    elements.backToListBtn.addEventListener('click', function () {
      state.chat.activeConversationId = '';
      chatState.lastRenderedConversationId = '';
      setThreadVisibility(false);
      resetNewMessagesIndicator();
      renderConversationList();
      renderThread();
    });
  }

  if (elements.openProfileBtn) {
    elements.openProfileBtn.addEventListener('click', function () {
      var userId = elements.openProfileBtn.dataset.userId || '';
      if (!userId) return;
      if (typeof _openProfileById === 'function') _openProfileById(userId);
    });
  }

  window.LOMO_CHAT = {
    listConversations: function (params) {
      return apiGetChatConversations(params || {});
    },
    startConversation: function (participantUserId) {
      return apiStartChatConversation(participantUserId);
    },
    listMessages: function (conversationId, params) {
      return apiGetChatMessages(conversationId, params || {});
    },
    sendMessage: function (conversationId, body) {
      return apiSendChatMessage(conversationId, body);
    },
  };

  window.LOMO_CHAT_UI = {
    openHub: openHub,
    openWithUser: openWithUser,
    goBack: goBack,
    handleScreenChange: handleScreenChange,
  };

  renderHeaderUnreadBadges();
  updateAutoBadge('Авто', 'ok');
})();
