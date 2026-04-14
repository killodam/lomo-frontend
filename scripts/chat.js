(function initChatUi() {
  var POLL_INTERVAL_MS = 12000;
  var chatState = {
    previousScreen: 'auth',
    pollingTimer: null,
    pollingInFlight: false,
    conversationPager: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  };

  var elements = {
    shell: document.getElementById('chatShell'),
    sidebarMeta: document.getElementById('chatSidebarMeta'),
    list: document.getElementById('chatConversationList'),
    empty: document.getElementById('chatEmptyState'),
    messages: document.getElementById('chatMessageList'),
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

  function rememberReturnScreen() {
    var activeKey = Object.keys(screens || {}).find(function (key) {
      return screens[key] && screens[key].classList.contains('active') && key !== 'chat';
    });
    if (activeKey) chatState.previousScreen = activeKey;
  }

  function isChatActive() {
    return !!(screens.chat && screens.chat.classList.contains('active'));
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

  function setThreadVisibility(isVisible) {
    if (!elements.shell) return;
    elements.shell.classList.toggle('chatThreadVisible', !!isVisible);
  }

  function renderConversationList() {
    if (!elements.list) return;
    var conversations = Array.isArray(state.chat.conversations) ? state.chat.conversations : [];
    if (!conversations.length) {
      elements.list.innerHTML = '<div class="chatConversationEmpty">Контакты появятся здесь, как только вы начнёте первый диалог.</div>';
      if (elements.sidebarMeta) {
        elements.sidebarMeta.textContent = 'Пока без диалогов. Напишите контакту из профиля или после одобренного доступа.';
      }
      return;
    }

    if (elements.sidebarMeta) {
      elements.sidebarMeta.textContent = 'Всего диалогов: ' + conversations.length;
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
  }

  function renderThread() {
    if (!elements.empty || !elements.messages || !elements.composer || !elements.title || !elements.meta || !elements.openProfileBtn) return;
    var activeConversation = findConversation(state.chat.activeConversationId);
    if (!activeConversation) {
      elements.title.textContent = 'Выберите диалог';
      elements.meta.textContent = 'После подключения или одобренного доступа здесь можно продолжить разговор.';
      elements.empty.classList.remove('hidden');
      elements.messages.classList.add('hidden');
      elements.composer.classList.add('hidden');
      elements.openProfileBtn.classList.add('hidden');
      setThreadVisibility(false);
      return;
    }

    var messages = Array.isArray(state.chat.messagesByConversation[String(activeConversation.id)])
      ? state.chat.messagesByConversation[String(activeConversation.id)]
      : [];

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
      elements.messages.innerHTML = '<div class="chatThreadPlaceholder">Диалог создан. Напишите первое сообщение.</div>';
      setThreadVisibility(true);
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
    elements.messages.scrollTop = elements.messages.scrollHeight;
    setThreadVisibility(true);
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
    if (!getToken() || state.roleReg === 'ADMIN') return [];

    options = options || {};
    if (!options.silent && elements.list) {
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

      if (!state.chat.activeConversationId && state.chat.conversations[0]) {
        state.chat.activeConversationId = state.chat.conversations[0].id;
      }

      if (state.chat.activeConversationId && !findConversation(state.chat.activeConversationId)) {
        state.chat.activeConversationId = state.chat.conversations[0] ? state.chat.conversations[0].id : '';
      }

      renderConversationList();
      renderPager('chatConversationPager', chatState.conversationPager, function (page) {
        loadConversations({ page: page, silent: false });
      }, { label: 'чатов' });

      if (state.chat.activeConversationId) await loadMessages(state.chat.activeConversationId, { silent: true });
      else renderThread();
      return state.chat.conversations;
    } catch (err) {
      if (handleProtectedError(err)) return [];
      if (elements.list) {
        elements.list.innerHTML = '<div class="miniHint" style="color:#991b1b;">Ошибка: ' + escapeHtml(safeErrorText(err)) + '</div>';
      }
      renderPager('chatConversationPager', { total: 0 }, function () {}, { label: 'чатов' });
      throw err;
    }
  }

  async function loadMessages(conversationId, options) {
    if (!conversationId) {
      renderThread();
      return [];
    }

    options = options || {};
    if (!options.silent && elements.messages) {
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
      renderThread();
      return state.chat.messagesByConversation[String(conversationId)];
    } catch (err) {
      if (handleProtectedError(err)) return [];
      if (elements.messages) {
        elements.messages.innerHTML = '<div class="chatThreadPlaceholder" style="color:#991b1b;">Ошибка загрузки: ' + escapeHtml(safeErrorText(err)) + '</div>';
      }
      throw err;
    }
  }

  async function selectConversation(conversationId) {
    if (!conversationId) return;
    state.chat.activeConversationId = conversationId;
    renderConversationList();
    await loadMessages(conversationId, { silent: false });
  }

  async function openHub() {
    if (!getToken()) {
      showToast('Войдите, чтобы открыть чаты');
      show('auth');
      return;
    }
    if (state.roleReg === 'ADMIN') {
      showToast('Чаты недоступны для администратора');
      return;
    }

    rememberReturnScreen();
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
      show('auth');
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
      await loadMessages(conversation.id, { silent: false });
      await loadConversations({ silent: true });
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
      renderThread();
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

  function startPolling() {
    if (chatState.pollingTimer || !isChatActive()) return;
    chatState.pollingTimer = window.setInterval(function () {
      if (chatState.pollingInFlight || !isChatActive() || document.hidden) return;
      chatState.pollingInFlight = true;
      loadConversations({ silent: true }).catch(function () {}).finally(function () {
        chatState.pollingInFlight = false;
      });
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!chatState.pollingTimer) return;
    window.clearInterval(chatState.pollingTimer);
    chatState.pollingTimer = null;
  }

  function handleScreenChange(screenKey) {
    if (screenKey === 'chat') {
      startPolling();
      renderConversationList();
      renderThread();
      if (!state.chat.conversations.length) {
        loadConversations({ silent: false }).catch(function () {});
      } else {
        loadConversations({ silent: true }).catch(function () {});
      }
      return;
    }
    stopPolling();
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
      loadConversations({ silent: false }).catch(function () {});
    });
  }

  if (elements.backToListBtn) {
    elements.backToListBtn.addEventListener('click', function () {
      setThreadVisibility(false);
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
})();
