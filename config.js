(function initLomoConfig() {
  var host = window.location.hostname || '';
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  var defaultApiBase = isLocal ? 'http://localhost:3000/api' : '/api';
  var defaultChatWsBase = isLocal ? 'http://localhost:3000' : window.location.origin;

  window.LOMO_CONFIG = Object.assign(
    {
      API_BASE: defaultApiBase,
      CHAT_WS_BASE: defaultChatWsBase,
      CHAT_FALLBACK_POLL_INTERVAL_MS: 6000,
      FEED_AUTO_REFRESH_MS: 30000,
    },
    window.LOMO_CONFIG || {}
  );
})();
