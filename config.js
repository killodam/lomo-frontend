(function initLomoConfig() {
  var host = window.location.hostname || '';
  var isLocalHost = host === 'localhost' || host === '127.0.0.1';
  var isLocalFile = window.location.protocol === 'file:';
  var defaultApiBase = (isLocalHost || isLocalFile)
    ? 'https://lomo-backend-hergg.amvera.io/api'
    : '/api';
  var defaultChatWsBase = 'https://lomo-backend-hergg.amvera.io';

  window.LOMO_CONFIG = Object.assign(
    {
      API_BASE: defaultApiBase,
      CHAT_WS_BASE: defaultChatWsBase,
    },
    window.LOMO_CONFIG || {}
  );
})();
