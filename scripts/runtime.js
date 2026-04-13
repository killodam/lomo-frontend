(function initRuntime() {
  const reportedErrors = new Set();
  const maxReportedErrors = 20;
  const runtime = {
    installPrompt: null,
    swRegistered: false,
  };

  function trimStack(stack) {
    return String(stack || '')
      .split('\n')
      .slice(0, 8)
      .join('\n');
  }

  function normalizeErrorPayload(type, payload) {
    const safePayload = payload && typeof payload === 'object' ? payload : { message: String(payload || 'Unknown error') };
    return {
      type,
      message: String(safePayload.message || safePayload.reason || 'Unknown error').slice(0, 500),
      stack: trimStack(safePayload.stack || ''),
      source: String(safePayload.source || '').slice(0, 300),
      page: location.pathname + location.hash,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  function sendClientError(type, payload) {
    const body = normalizeErrorPayload(type, payload);
    const fingerprint = [body.type, body.message, body.source, body.page].join('|');
    if (reportedErrors.has(fingerprint)) return;
    reportedErrors.add(fingerprint);
    if (reportedErrors.size > maxReportedErrors) {
      const first = reportedErrors.values().next();
      if (!first.done) reportedErrors.delete(first.value);
    }

    const json = JSON.stringify(body);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([json], { type: 'application/json' });
        navigator.sendBeacon('/api/monitoring/client-error', blob);
        return;
      }
    } catch (error) {}

    fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: json,
      keepalive: true,
    }).catch(function () {});
  }

  window.addEventListener('error', function (event) {
    sendClientError('window.error', {
      message: event.message,
      stack: event.error && event.error.stack,
      source: event.filename ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}` : '',
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    sendClientError('window.unhandledrejection', {
      message: reason && reason.message ? reason.message : String(reason || 'Unhandled rejection'),
      stack: reason && reason.stack ? reason.stack : '',
      source: 'promise',
    });
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    runtime.installPrompt = event;
    window.dispatchEvent(new CustomEvent('lomo:pwa-install-ready'));
  });

  window.addEventListener('appinstalled', function () {
    runtime.installPrompt = null;
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(function () {
          runtime.swRegistered = true;
        })
        .catch(function (error) {
          sendClientError('service-worker.register', {
            message: error && error.message ? error.message : 'Service worker registration failed',
            stack: error && error.stack ? error.stack : '',
            source: 'sw.js',
          });
        });
    });
  }

  window.LOMO_RUNTIME = {
    canPromptInstall: function () {
      return Boolean(runtime.installPrompt);
    },
    promptInstall: async function () {
      if (!runtime.installPrompt) return false;
      const prompt = runtime.installPrompt;
      prompt.prompt();
      try {
        const result = await prompt.userChoice;
        runtime.installPrompt = null;
        return result && result.outcome === 'accepted';
      } catch (error) {
        sendClientError('pwa.install-prompt', {
          message: error && error.message ? error.message : 'Install prompt failed',
          stack: error && error.stack ? error.stack : '',
          source: 'beforeinstallprompt',
        });
        runtime.installPrompt = null;
        return false;
      }
    },
    isServiceWorkerRegistered: function () {
      return runtime.swRegistered;
    },
    reportClientError: sendClientError,
  };
})();
