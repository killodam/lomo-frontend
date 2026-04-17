(function () {
  var PUSH_TOKEN_STORAGE_PREFIX = 'lomo_push_token:';
  var listenersReady = false;
  var appListenersReady = false;
  var registerInFlight = false;
  var lastHandledUrl = '';

  function getCapacitor() {
    return window.Capacitor || null;
  }

  function isNativePlatform() {
    var capacitor = getCapacitor();
    var platform;

    if (!capacitor) return false;
    if (typeof capacitor.isNativePlatform === 'function') {
      return !!capacitor.isNativePlatform();
    }

    platform = typeof capacitor.getPlatform === 'function'
      ? String(capacitor.getPlatform() || '')
      : 'web';

    return platform && platform !== 'web';
  }

  function getPlatform() {
    var capacitor = getCapacitor();
    var platform = capacitor && typeof capacitor.getPlatform === 'function'
      ? String(capacitor.getPlatform() || '')
      : 'web';

    if (platform === 'ios' || platform === 'android') return platform;
    return 'web';
  }

  function getPlugins() {
    var capacitor = getCapacitor();
    return capacitor && capacitor.Plugins ? capacitor.Plugins : {};
  }

  function getPlugin(name) {
    var plugins = getPlugins();
    return plugins[name] || window[name] || null;
  }

  function getPushNotificationsPlugin() {
    return getPlugin('PushNotifications');
  }

  function getAppPlugin() {
    return getPlugin('App');
  }

  function hasAuthenticatedUser() {
    return !!(window.state && window.state.userId && typeof window.getToken === 'function' && window.getToken());
  }

  function getStoredPushTokenKey() {
    var userId = window.state && window.state.userId ? String(window.state.userId) : '';
    return PUSH_TOKEN_STORAGE_PREFIX + getPlatform() + ':' + userId;
  }

  function rememberStoredPushToken(token) {
    try {
      window.localStorage.setItem(getStoredPushTokenKey(), String(token || ''));
    } catch (error) {}
  }

  function readStoredPushToken() {
    try {
      return window.localStorage.getItem(getStoredPushTokenKey()) || '';
    } catch (error) {
      return '';
    }
  }

  function clearSessionState() {
    registerInFlight = false;
  }

  function toObject(payload) {
    if (!payload || typeof payload !== 'object') return {};
    if (payload.notification && payload.notification.data && typeof payload.notification.data === 'object') {
      return payload.notification.data;
    }
    if (payload.data && typeof payload.data === 'object') {
      return payload.data;
    }
    return payload;
  }

  function openProfileFromPayload(data) {
    var publicId = data && (data.publicId || data.profile || data.profileId);
    if (!publicId) return false;
    if (typeof window.openPublicProfileByPublicId !== 'function') return false;
    window.openPublicProfileByPublicId(String(publicId));
    return true;
  }

  function openChatFromPayload(data) {
    if (window.LOMO_CHAT_UI && data && data.participantUserId && typeof window.LOMO_CHAT_UI.openWithUser === 'function') {
      window.LOMO_CHAT_UI.openWithUser(String(data.participantUserId));
      return true;
    }

    if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.openHub === 'function') {
      window.LOMO_CHAT_UI.openHub();
      return true;
    }

    if (typeof window.show === 'function') {
      window.show('chat');
      return true;
    }

    return false;
  }

  function routeToScreen(screenName, data) {
    if (openProfileFromPayload(data)) return true;

    if (screenName === 'chat') {
      return openChatFromPayload(data || {});
    }

    if (!screenName || typeof window.show !== 'function') return false;

    try {
      window.show(String(screenName));
      return true;
    } catch (error) {
      return false;
    }
  }

  function parseUrl(url) {
    var anchor;

    if (typeof URL === 'function') {
      try {
        return new URL(url);
      } catch (error) {}
    }

    anchor = document.createElement('a');
    anchor.href = String(url || '');

    return {
      protocol: anchor.protocol || '',
      hostname: anchor.hostname || '',
      pathname: anchor.pathname || '',
      search: anchor.search || '',
      hash: anchor.hash || '',
    };
  }

  function buildDataFromQuery(params) {
    var data = {};

    if (!params || typeof params.forEach !== 'function') return data;

    params.forEach(function (value, key) {
      data[key] = value;
    });

    return data;
  }

  function handleDeepLinkUrl(url) {
    var parsed;
    var scheme;
    var host;
    var path;
    var params;
    var data;

    if (!url) return false;
    if (url === lastHandledUrl) return false;

    parsed = parseUrl(url);
    scheme = String(parsed.protocol || '').replace(/:$/, '');
    if (scheme !== 'lomo' && scheme !== 'http' && scheme !== 'https') return false;

    lastHandledUrl = String(url);
    host = String(parsed.hostname || '').replace(/:.*$/, '');
    path = String(parsed.pathname || '').replace(/^\/+|\/+$/g, '');
    params = typeof URLSearchParams === 'function'
      ? new URLSearchParams(String(parsed.search || '').replace(/^\?/, ''))
      : null;
    data = buildDataFromQuery(params);

    if (host === 'profile' && path && !data.publicId) data.publicId = path;
    if (host === 'chat' && path && !data.conversationId) data.conversationId = path;
    if (!data.screenName && host && host !== 'localhost') data.screenName = host;
    if (!data.screenName && path) data.screenName = path.split('/')[0];

    return handleNavigationPayload({ data: data });
  }

  function handleNavigationPayload(payload) {
    var data = toObject(payload);
    var screenName = data.screenName || data.screen || data.targetScreen || data.route || '';
    var link = payload && (payload.link || payload.url || data.link || data.url);

    if (link) return handleDeepLinkUrl(link) || routeToScreen(screenName, data);
    return routeToScreen(screenName, data);
  }

  function syncPushToken(token) {
    var safeToken = String(token || '');
    var platform = getPlatform();

    if (!safeToken || !hasAuthenticatedUser()) return Promise.resolve(false);
    if (readStoredPushToken() === safeToken) return Promise.resolve(true);
    if (typeof window.apiSavePushToken !== 'function') return Promise.resolve(false);

    return window.apiSavePushToken(safeToken, platform)
      .then(function () {
        rememberStoredPushToken(safeToken);
        return true;
      })
      .catch(function (error) {
        if (window.console && typeof window.console.warn === 'function') {
          window.console.warn('LOMO push token sync failed', error);
        }
        return false;
      });
  }

  function ensurePushListeners() {
    var push = getPushNotificationsPlugin();

    if (listenersReady || !push || typeof push.addListener !== 'function') return;
    listenersReady = true;

    push.addListener('registration', function (token) {
      if (!token || !token.value) return;
      syncPushToken(token.value);
    });

    push.addListener('registrationError', function (error) {
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('LOMO push registration error', error);
      }
    });

    push.addListener('pushNotificationReceived', function (notification) {
      handleNavigationPayload(notification);
    });

    push.addListener('pushNotificationActionPerformed', function (action) {
      if (!action) return;
      handleNavigationPayload(action.notification || action);
    });
  }

  function ensureAppListeners() {
    var app = getAppPlugin();

    if (appListenersReady || !isNativePlatform() || !app) return;
    appListenersReady = true;

    if (typeof app.addListener === 'function') {
      app.addListener('appUrlOpen', function (event) {
        if (!event || !event.url) return;
        handleDeepLinkUrl(event.url);
      });
    }

    if (typeof app.getLaunchUrl === 'function') {
      app.getLaunchUrl()
        .then(function (result) {
          if (!result || !result.url) return;
          handleDeepLinkUrl(result.url);
        })
        .catch(function () {});
    }
  }

  function runPushRegistration(permissionMode) {
    var push = getPushNotificationsPlugin();
    var permissionCall;

    if (!isNativePlatform() || !push) return Promise.resolve(false);
    if (!hasAuthenticatedUser()) return Promise.resolve(false);

    ensurePushListeners();

    permissionCall = permissionMode === 'prompt' && typeof push.requestPermissions === 'function'
      ? push.requestPermissions()
      : typeof push.checkPermissions === 'function'
        ? push.checkPermissions()
        : Promise.resolve({ receive: 'granted' });

    return permissionCall.then(function (permission) {
      if (!permission || permission.receive !== 'granted') return false;
      if (typeof push.register !== 'function') return false;
      return push.register().then(function () {
        return true;
      });
    });
  }

  function registerAfterLogin(options) {
    var mode = options && options.prompt === false ? 'silent' : 'prompt';

    if (registerInFlight) return Promise.resolve(false);
    registerInFlight = true;

    return runPushRegistration(mode)
      .catch(function () {
        return false;
      })
      .then(function (result) {
        registerInFlight = false;
        return result;
      }, function () {
        registerInFlight = false;
        return false;
      });
  }

  ensurePushListeners();
  ensureAppListeners();

  window.LOMO_PUSH = {
    isNativePlatform: isNativePlatform,
    getPlatform: getPlatform,
    registerAfterLogin: registerAfterLogin,
    handleDeepLinkUrl: handleDeepLinkUrl,
    handleNavigationPayload: handleNavigationPayload,
    clearSession: clearSessionState,
  };
})();
