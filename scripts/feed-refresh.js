(function (window) {
  var FEED_AUTO_REFRESH_MS = Math.max(10000, Number(window.LOMO_CONFIG && window.LOMO_CONFIG.FEED_AUTO_REFRESH_MS || 30000) || 30000);
  var FEED_PULL_REFRESH_TRIGGER_PX = 78;
  var FEED_PULL_REFRESH_MAX_PX = 132;
  var feedAutoRefreshState = { timer: null, inFlight: false };
  var feedPullRefreshState = { screenKey: '', screenEl: null, startY: 0, distance: 0, dragging: false, armed: false, hideTimer: null };

  function getFeedRefreshTask(screenKey, options) {
    var opts = options || {};
    var silent = opts.silent !== false;

    if (screenKey === 'candidateFeed' && !isBookmarkFavoritesFilter(feedState.view)) {
      return function () { return loadCandidateFeed(feedState.page, { silent: silent }); };
    }

    if (screenKey === 'employerSearch' && !isBookmarkFolderFilter(employerSearchState.verified)) {
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

    if (isScreenActive('candidateFeed') && !isBookmarkFavoritesFilter(feedState.view)) {
      return refreshFeedScreen('candidateFeed', options);
    }

    if (isScreenActive('employerSearch') && !isBookmarkFolderFilter(employerSearchState.verified)) {
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

  window.refreshActiveFeed = refreshActiveFeed;
})(window);
