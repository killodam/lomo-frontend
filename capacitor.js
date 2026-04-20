(function () {
  if (window.Capacitor) return;

  window.Capacitor = {
    Plugins: {},
    getPlatform: function () {
      return 'web';
    },
    isNativePlatform: function () {
      return false;
    },
  };
})();
