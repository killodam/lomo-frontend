(function initLomoConfig() {
  var defaultApiBase = '/api';
  var defaultChatWsBase = window.location.origin;

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
