const { test, expect } = require('@playwright/test');

function paginated(items, page, pageSize, total) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: total ? Math.ceil(total / pageSize) : 0,
  };
}

async function openLogin(page) {
  await page.goto('/');
  await page.click('#landingLoginBtn');
}

test('pwa shell exposes manifest and registers service worker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
  await expect.poll(async () => page.evaluate(() => {
    return !!(window.LOMO_RUNTIME && window.LOMO_RUNTIME.isServiceWorkerRegistered && window.LOMO_RUNTIME.isServiceWorkerRegistered());
  })).toBe(true);
});

test('landing no longer renders legacy auth or logo screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#screenLogo')).toHaveCount(0);
  await expect(page.locator('#screenAuth')).toHaveCount(0);
  await expect(page.locator('#ldNavLogoImg')).toHaveAttribute('src', './icons/app-icon.svg');
});

test('service worker precaches landing and feed styles', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.evaluate(async () => {
    if (!('caches' in window)) return { hasLanding: false, hasFeed: false };

    var keys = await caches.keys();
    var paths = [];

    for (const key of keys) {
      var cache = await caches.open(key);
      var requests = await cache.keys();
      requests.forEach(function (request) {
        paths.push(new URL(request.url).pathname);
      });
    }

    return {
      hasLanding: paths.includes('/styles/landing.css'),
      hasFeed: paths.includes('/styles/feed.css'),
    };
  })).toEqual({ hasLanding: true, hasFeed: true });
});

test('manifest exposes png install icons for Android shells', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.evaluate(async () => {
    var response = await fetch('/manifest.webmanifest');
    var data = await response.json();
    var icons = Array.isArray(data && data.icons) ? data.icons : [];
    return icons.map(function (icon) {
      return {
        src: icon.src,
        type: icon.type,
        purpose: icon.purpose || '',
      };
    });
  })).toEqual([
    { src: '/icons/icon-192.png', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-192.png', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-maskable-512.png', type: 'image/png', purpose: 'maskable' },
  ]);
});

test('valid stored session bypasses landing and opens candidate feed', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 'cand-2', role: 'candidate', full_name: 'Анна Петрова', location: 'Москва', edu_place: 'МФТИ', vacancies: 'Designer', about: 'Опытный кандидат' },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.addInitScript(function () {
    document.cookie = 'lomo_csrf=test-suite; path=/';
  });
  await page.goto('/');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await expect(page.locator('#screenLanding')).not.toHaveClass(/active/);
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');
});

test('candidate login opens feed and paginates server-side', async ({ page }) => {
  let requestedPage = '1';

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'emp-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      requestedPage = url.searchParams.get('page') || '1';
      const pageNum = Number(requestedPage);
      const item = pageNum === 1
        ? { id: 'cand-2', role: 'candidate', full_name: 'Анна Петрова', location: 'Москва', edu_place: 'МФТИ', vacancies: 'Designer', about: 'Опытный кандидат' }
        : { id: 'cand-3', role: 'candidate', full_name: 'Павел Иванов', location: 'Казань', edu_place: 'КФУ', vacancies: 'Engineer', about: 'Вторая страница' };

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([item], pageNum, 12, 13)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');
  await expect(page.locator('#candidateFeedPager')).toContainText('Страница 1 из 2');
  await expect(page.locator('#candidateFeedPager .pagerNum')).toHaveCount(2);
  await expect(page.locator('#candidateFeedPager .pagerNum').nth(0)).toBeDisabled();
  await expect(page.locator('#candidateFeedPager .pagerNum').nth(0)).toHaveText('1');
  await expect(page.locator('#candidateFeedPager .pagerNum').nth(1)).toHaveText('2');

  await page.click('#candidateFeedPager .pagerBtn:text("Далее")');
  await expect(page.locator('#candidateFeedList')).toContainText('Павел Иванов');
  await expect.poll(() => requestedPage).toBe('2');
});

test('candidate feed refreshes silently without page reload', async ({ page }) => {
  let feedCallCount = 0;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      feedCallCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: feedCallCount > 1 ? 'cand-3' : 'cand-2',
            role: 'candidate',
            full_name: feedCallCount > 1 ? 'Павел Иванов' : 'Анна Петрова',
            location: 'Москва',
            edu_place: 'МФТИ',
            vacancies: 'Designer',
            about: 'Опытный кандидат',
          },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');
  await expect.poll(() => feedCallCount).toBe(1);

  await page.evaluate(() => {
    if (typeof refreshActiveFeed === 'function') {
      return refreshActiveFeed({ silent: true });
    }
    return Promise.resolve(false);
  });

  await expect.poll(() => feedCallCount).toBe(2);
  await expect(page.locator('#candidateFeedList')).toContainText('Павел Иванов', { timeout: 3000 });
});

test('chat badge updates on feed even when websocket falls back to polling', async ({ page }) => {
  let conversationCalls = 0;

  await page.addInitScript(function () {
    window.LOMO_CONFIG = Object.assign({}, window.LOMO_CONFIG || {}, { CHAT_FALLBACK_POLL_INTERVAL_MS: 120 });

    function FakeSocket() {
      this.readyState = FakeSocket.CONNECTING;
      this._listeners = {};
      var self = this;
      window.setTimeout(function () {
        self.dispatchEvent({ type: 'error' });
      }, 10);
    }

    FakeSocket.CONNECTING = 0;
    FakeSocket.OPEN = 1;
    FakeSocket.CLOSING = 2;
    FakeSocket.CLOSED = 3;

    FakeSocket.prototype.addEventListener = function (type, handler) {
      this._listeners[type] = this._listeners[type] || [];
      this._listeners[type].push(handler);
    };

    FakeSocket.prototype.dispatchEvent = function (event) {
      var handlers = this._listeners[event.type] || [];
      handlers.forEach(function (handler) { handler(event); });
    };

    FakeSocket.prototype.close = function () {
      this.readyState = FakeSocket.CLOSED;
      this.dispatchEvent({ type: 'close' });
    };

    window.WebSocket = FakeSocket;
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 'cand-2', role: 'candidate', full_name: 'Анна Петрова', location: 'Москва', edu_place: 'МФТИ', vacancies: 'Designer', about: 'Опытный кандидат' },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.endsWith('/chat/ws-ticket')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ticket: 'test-ticket', expires_in: 300, ws_path: '/ws/chat' }),
      });
    }

    if (url.pathname.endsWith('/chat/conversations')) {
      conversationCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'chat-1',
            kind: 'direct',
            participant_user_id: 'emp-44',
            participant_role: 'employer',
            public_id: 'LOMO-EMP00044',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            location: 'Москва',
            industry: 'Tech',
            last_message_body: conversationCalls > 1 ? 'Новое сообщение' : 'Привет!',
            last_message_created_at: '2026-04-16T12:00:00.000Z',
            unread_count: conversationCalls > 1 ? 1 : 0,
          },
        ], 1, 20, 1)),
      });
    }

    if (url.pathname.endsWith('/connections')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: [], incoming: [], outgoing: [], counts: { accepted: 0, incoming: 0, outgoing: 0 } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await page.evaluate(() => {
    if (window.LOMO_CHAT_UI && typeof window.LOMO_CHAT_UI.handleScreenChange === 'function') {
      window.LOMO_CHAT_UI.handleScreenChange('candidateFeed');
    }
  });
  await expect.poll(() => conversationCalls).toBeGreaterThan(1);
  await expect(page.locator('#screenCandidateFeed [data-next="toChatHub"] .chatNavUnreadBadge')).toHaveText('1');
});

test('mobile candidate feed supports pull to refresh', async ({ page }) => {
  let feedCallCount = 0;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(function () {
    window.LOMO_CONFIG = Object.assign({}, window.LOMO_CONFIG || {}, { FEED_AUTO_REFRESH_MS: 999999 });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      feedCallCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: feedCallCount > 1 ? 'cand-3' : 'cand-2',
            role: 'candidate',
            full_name: feedCallCount > 1 ? 'Павел Иванов' : 'Анна Петрова',
            location: 'Москва',
            edu_place: 'МФТИ',
            vacancies: 'Designer',
            about: 'Опытный кандидат',
          },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');
  await expect.poll(() => feedCallCount).toBe(1);

  await page.evaluate(() => {
    var el = document.getElementById('screenCandidateFeed');
    function fire(type, y) {
      var event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', {
        value: type === 'touchend' ? [] : [{ clientX: 120, clientY: y }],
      });
      Object.defineProperty(event, 'changedTouches', {
        value: [{ clientX: 120, clientY: y }],
      });
      el.dispatchEvent(event);
    }

    el.scrollTop = 0;
    fire('touchstart', 88);
    fire('touchmove', 228);
    fire('touchend', 228);
  });

  await expect.poll(() => feedCallCount).toBe(2);
  await expect(page.locator('#candidateFeedList')).toContainText('Павел Иванов');
});

test('candidate can bookmark another user from feed without opening profile', async ({ page }) => {
  let publicProfileOpened = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-2',
            role: 'candidate',
            public_id: 'LOMO-CAND00002',
            full_name: 'Анна Петрова',
            location: 'Казань',
            edu_place: 'КФУ',
            vacancies: 'Data Analyst',
            about: 'Опытный кандидат',
          },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.includes('/public/profile/')) {
      publicProfileOpened = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await expect(page.locator('#candidateFeedList .scBookmarkBtn')).toHaveCount(1);

  await page.click('#candidateFeedList .scBookmarkBtn');

  await expect(page.locator('#toast')).toContainText('Добавлено в избранное');
  await expect(page.locator('#candidateFeedList .scBookmarkBtn')).toHaveClass(/active/);
  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await expect.poll(() => publicProfileOpened).toBe(false);
  await expect.poll(async () => page.evaluate(() => {
    var raw = window.localStorage.getItem('lomo_favs_cand-1') || '{}';
    var data = JSON.parse(raw);
    return !!data['cand-2'];
  })).toBe(true);
});

test('candidate favorites filter shows bookmarked profiles and supports removal', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-2',
            role: 'candidate',
            public_id: 'LOMO-CAND00002',
            full_name: 'Анна Петрова',
            location: 'Казань',
            edu_place: 'КФУ',
            vacancies: 'Data Analyst',
            about: 'Опытный кандидат',
          },
          {
            id: 'emp-44',
            role: 'employer',
            public_id: 'LOMO-EMP00044',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            industry: 'Tech',
            location: 'Москва',
            about: 'Ищем аналитиков',
          },
        ], 1, 12, 2)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');
  await expect(page.locator('#candidateFeedList')).toContainText('Алина HR');

  await page.click('#candidateFeedList .socialCard:first-child .scBookmarkBtn');
  await expect(page.locator('#toast')).toContainText('Добавлено в избранное');

  await page.click('.feedFilterChip[data-feed-view="favorites"]');
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');
  await expect(page.locator('#candidateFeedList')).not.toContainText('Алина HR');

  await page.fill('#feedSearchInput', 'Казань');
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');

  await page.fill('#feedSearchInput', 'Москва');
  await expect(page.locator('#candidateFeedList')).toContainText('По этому запросу в избранном никого нет');

  await page.fill('#feedSearchInput', '');
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');

  await page.click('#candidateFeedList .scBookmarkBtn');
  await expect(page.locator('#toast')).toContainText('Удалено из избранного');
  await expect(page.locator('#candidateFeedList')).toContainText('В избранном пока нет профилей');
  await expect.poll(async () => page.evaluate(() => {
    var raw = window.localStorage.getItem('lomo_favs_cand-1') || '{}';
    var data = JSON.parse(raw);
    return !!data['cand-2'];
  })).toBe(false);
});

test('candidate logout from feed returns to landing', async ({ page }) => {
  let logoutCalled = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'emp-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/auth/logout')) {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 'cand-2', role: 'candidate', full_name: 'Анна Петрова', location: 'Москва', edu_place: 'МФТИ', vacancies: 'Designer', about: 'Опытный кандидат' },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await page.click('#screenCandidateFeed .feedHeaderNav [data-next="toAuthFromProfile"]');

  await expect.poll(() => logoutCalled).toBe(true);
  await expect(page.locator('#screenLanding')).toHaveClass(/active/);
  await expect(page.locator('#screenLanding')).toContainText('Подтверждённый.');
});

test('employer can request document access from public profile', async ({ page }) => {
  let requestSent = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'company-1', email: 'employer@example.com', login: 'employer', role: 'employer' },
          profile: { full_name: 'Алина HR', company: 'LOMO Labs', industry: 'Tech', location: 'Москва' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/candidates')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-77',
            role: 'candidate',
            full_name: 'Мария Тестова',
            location: 'Санкт-Петербург',
            edu_place: 'ИТМО',
            vacancies: 'Designer',
            about: 'Хочу в сильную команду',
          },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.endsWith('/requests') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(requestSent ? [{
          id: 'req-1',
          candidate_id: 'cand-77',
          document_type: 'education',
          status: 'pending',
          company: 'LOMO Labs',
        }] : []),
      });
    }

    if (url.pathname.endsWith('/requests') && request.method() === 'POST') {
      requestSent = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }

    if (url.pathname.endsWith('/files') || url.pathname.includes('/requests/candidate/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'employer@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenEmployerSearch')).toHaveClass(/active/);
  await expect(page.locator('#employerCandidateList')).toContainText('Мария Тестова');

  await page.click('#employerCandidateList .socialCard');
  await expect(page.locator('#screenPublicProfile')).toHaveClass(/active/);
  await expect(page.locator('#pubAccessPanel')).toContainText('Запросить: Образование');

  await page.click('[data-request-doc="education"]');
  await expect.poll(() => requestSent).toBe(true);
  await expect(page.locator('#pubAccessPanel')).toContainText('Запрос отправлен: Образование');
});

test('employer favorites filter keeps bookmarked candidates and searches locally', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'company-1', email: 'employer@example.com', login: 'employer', role: 'employer' },
          profile: { full_name: 'Алина HR', company: 'LOMO Labs', industry: 'Tech', location: 'Москва' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/candidates')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-77',
            role: 'candidate',
            public_id: 'LOMO-CAND00077',
            full_name: 'Мария Тестова',
            location: 'Казань',
            edu_place: 'ИТМО',
            vacancies: 'Data Analyst',
            current_job: 'Tinkoff',
            job_title: 'Analyst',
            about: 'Люблю аккуратные системы',
          },
          {
            id: 'cand-88',
            role: 'candidate',
            public_id: 'LOMO-CAND00088',
            full_name: 'Олег Смирнов',
            location: 'Москва',
            edu_place: 'МГУ',
            vacancies: 'Marketing',
            current_job: 'VK',
            job_title: 'Marketer',
            about: 'Растил B2C продукт',
          },
        ], 1, 12, 2)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'employer@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenEmployerSearch')).toHaveClass(/active/);
  await expect(page.locator('#employerCandidateList')).toContainText('Мария Тестова');
  await expect(page.locator('#employerCandidateList')).toContainText('Олег Смирнов');

  await page.click('#employerCandidateList .socialCard:first-child .scBookmarkBtn');
  await expect(page.locator('#toast')).toContainText('Добавлено в избранное');

  await page.click('.empFilterChip[data-verified="favorites"]');
  await expect(page.locator('#employerCandidateList')).toContainText('Мария Тестова');
  await expect(page.locator('#employerCandidateList')).not.toContainText('Олег Смирнов');

  await page.fill('#empSearchName', 'Казань');
  await expect(page.locator('#employerCandidateList')).toContainText('Мария Тестова');

  await page.fill('#empSearchName', 'Маркетинг');
  await expect(page.locator('#employerCandidateList')).toContainText('По этому запросу в избранном никого нет');
});

test('user can send connection request from public profile', async ({ page }) => {
  let connectionSent = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'emp-44',
            role: 'employer',
            public_id: 'LOMO-EMP00044',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            industry: 'Tech',
            location: 'Москва',
          },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.endsWith('/public/profile/LOMO-EMP00044')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'emp-44',
          role: 'employer',
          public_id: 'LOMO-EMP00044',
          full_name: 'Алина HR',
          company: 'LOMO Labs',
          industry: 'Tech',
          location: 'Москва',
          about: 'Нанимаем сильных специалистов',
          connections_count: 3,
        }),
      });
    }

    if (url.pathname.endsWith('/connections/status/emp-44')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(connectionSent
          ? { relation: 'outgoing', connectionId: 'conn-1', status: 'pending', connections_count: 3 }
          : { relation: 'none', connectionId: null, status: null, connections_count: 3 }),
      });
    }

    if (url.pathname.endsWith('/connections') && request.method() === 'POST') {
      connectionSent = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, relation: 'outgoing', connectionId: 'conn-1', status: 'pending' }),
      });
    }

    if (url.pathname.endsWith('/connections')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: [], incoming: [], outgoing: [], counts: { accepted: 0, incoming: 0, outgoing: 0 } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  const firstFeedCard = page.locator('#candidateFeedList .socialCard').first();
  await expect(firstFeedCard).toBeVisible();
  await expect(firstFeedCard).toContainText('Алина HR');
  await page.click('#candidateFeedList .socialCard');
  await expect(page.locator('#screenPublicProfile')).toHaveClass(/active/);
  await expect(page.locator('#pubConnectionPanel')).toContainText('Добавить в контакты');

  await page.click('[data-connection-action="send"]');
  await expect.poll(() => connectionSent).toBe(true);
  await expect(page.locator('#pubConnectionPanel')).toContainText('Запрос отправлен');
});

test('connected users can open chat from public profile and send a message', async ({ page }) => {
  let chatStarted = false;
  let sentMessage = '';

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'emp-44',
            role: 'employer',
            public_id: 'LOMO-EMP00044',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            industry: 'Tech',
            location: 'Москва',
          },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.endsWith('/public/profile/LOMO-EMP00044')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'emp-44',
          role: 'employer',
          public_id: 'LOMO-EMP00044',
          full_name: 'Алина HR',
          company: 'LOMO Labs',
          industry: 'Tech',
          location: 'Москва',
          about: 'Нанимаем сильных специалистов',
          connections_count: 12,
        }),
      });
    }

    if (url.pathname.endsWith('/connections/status/emp-44')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          relation: 'connected',
          connectionId: 'conn-44',
          status: 'accepted',
          connections_count: 12,
        }),
      });
    }

    if (url.pathname.endsWith('/connections')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: [], incoming: [], outgoing: [], counts: { accepted: 0, incoming: 0, outgoing: 0 } }),
      });
    }

    if (url.pathname.endsWith('/chat/conversations') && request.method() === 'POST') {
      chatStarted = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          created: true,
          conversation: {
            id: 'chat-1',
            kind: 'direct',
            created_at: '2026-04-14T10:00:00.000Z',
            last_message_at: '2026-04-14T10:00:00.000Z',
            participant: {
              id: 'emp-44',
              role: 'employer',
              public_id: 'LOMO-EMP00044',
              full_name: 'Алина HR',
              company: 'LOMO Labs',
              location: 'Москва',
              industry: 'Tech',
            },
          },
        }),
      });
    }

    if (url.pathname.endsWith('/chat/conversations') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'chat-1',
            kind: 'direct',
            participant_user_id: 'emp-44',
            participant_role: 'employer',
            public_id: 'LOMO-EMP00044',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            location: 'Москва',
            industry: 'Tech',
            last_message_body: sentMessage || '',
            last_message_created_at: '2026-04-14T10:01:00.000Z',
            unread_count: 0,
          },
        ], 1, 20, 1)),
      });
    }

    if (url.pathname.endsWith('/chat/conversations/chat-1/messages') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], 1, 30, 0)),
      });
    }

    if (url.pathname.endsWith('/chat/conversations/chat-1/messages') && request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      sentMessage = body.body;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-1',
          conversation_id: 'chat-1',
          author_user_id: 'cand-1',
          body: body.body,
          created_at: '2026-04-14T10:01:00.000Z',
          edited_at: null,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await page.click('#candidateFeedList .socialCard');
  await expect(page.locator('#screenPublicProfile')).toHaveClass(/active/);
  await expect(page.locator('#pubConnectionPanel')).toContainText('Написать');

  await page.click('[data-open-chat-user="emp-44"]');
  await expect.poll(() => chatStarted).toBe(true);
  await expect(page.locator('#screenChat')).toHaveClass(/active/);
  await expect(page.locator('#chatThreadTitle')).toContainText('Алина HR');
  await expect(page.locator('#chatAttachBtn')).toHaveCount(0);
  await expect(page.locator('#chatFileInput')).toHaveCount(0);

  await page.fill('#chatMessageInput', 'Добрый день!');
  await page.click('#chatSendBtn');
  await expect.poll(() => sentMessage).toBe('Добрый день!');
  await expect(page.locator('#chatMessageList')).toContainText('Добрый день!');
});

test('incoming connection request is visible in chat inbox and can be accepted there', async ({ page }) => {
  let acceptCalled = false;
  let connectionState = 'incoming';

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 'cand-2', role: 'candidate', full_name: 'Анна Петрова', location: 'Москва', edu_place: 'МФТИ', vacancies: 'Designer' },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.endsWith('/chat/conversations') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], 1, 20, 0)),
      });
    }

    if (url.pathname.endsWith('/connections') && request.method() === 'GET') {
      const incoming = connectionState === 'incoming'
        ? [{
            id: 'conn-77',
            status: 'pending',
            initiator_id: 'emp-44',
            user_id: 'emp-44',
            role: 'employer',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            location: 'Москва',
            industry: 'Tech',
          }]
        : [];
      const accepted = connectionState === 'accepted'
        ? [{
            id: 'conn-77',
            status: 'accepted',
            initiator_id: 'emp-44',
            user_id: 'emp-44',
            role: 'employer',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            location: 'Москва',
            industry: 'Tech',
          }]
        : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted,
          incoming,
          outgoing: [],
          counts: { accepted: accepted.length, incoming: incoming.length, outgoing: 0 },
        }),
      });
    }

    if (url.pathname.endsWith('/connections/conn-77/accept')) {
      acceptCalled = true;
      connectionState = 'accepted';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, relation: 'connected', connectionId: 'conn-77', status: 'accepted' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await page.click('#screenCandidateFeed [data-next="toChatHub"]');
  await expect(page.locator('#screenChat')).toHaveClass(/active/);
  await expect(page.locator('#chatConnectionInbox')).toContainText('Алина HR');
  await expect(page.locator('#chatConnectionInbox')).toContainText('хочет добавить вас в контакты');

  await page.click('#chatConnectionInbox [data-connection-action="accept"]');
  await expect.poll(() => acceptCalled).toBe(true);
  await expect(page.locator('#chatConnectionInbox')).not.toContainText('Алина HR');
});

test('chat hub opens on conversation list without auto-selecting a thread', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-1', email: 'candidate@example.com', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-2',
            role: 'candidate',
            public_id: 'LOMO-CAND00002',
            full_name: 'Анна Петрова',
            location: 'Москва',
            edu_place: 'МФТИ',
            vacancies: 'Designer',
          },
        ], 1, 12, 1)),
      });
    }

    if (url.pathname.endsWith('/chat/conversations') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'chat-1',
            kind: 'direct',
            participant_user_id: 'emp-44',
            participant_role: 'employer',
            public_id: 'LOMO-EMP00044',
            full_name: 'Алина HR',
            company: 'LOMO Labs',
            location: 'Москва',
            industry: 'Tech',
            last_message_body: 'Добрый день!',
            last_message_created_at: '2026-04-14T10:01:00.000Z',
            unread_count: 0,
          },
        ], 1, 20, 1)),
      });
    }

    if (url.pathname.endsWith('/chat/conversations/chat-1/messages') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'msg-1',
            conversation_id: 'chat-1',
            author_user_id: 'emp-44',
            body: 'Добрый день!',
            created_at: '2026-04-14T10:01:00.000Z',
            edited_at: null,
          },
        ], 1, 30, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await page.click('#screenCandidateFeed [data-next="toChatHub"]');
  await expect(page.locator('#screenChat')).toHaveClass(/active/);
  await expect(page.locator('#chatConversationList')).toContainText('Алина HR');
  await expect(page.locator('#chatThreadTitle')).toContainText('Выберите диалог');
  await expect(page.locator('#chatEmptyState')).toBeVisible();

  await page.click('[data-chat-conversation-id="chat-1"]');
  await expect(page.locator('#chatThreadTitle')).toContainText('Алина HR');
  await expect(page.locator('#chatMessageList')).toContainText('Добрый день!');
});

test('admin dashboard loads queue and users with server-side search', async ({ page }) => {
  let userSearch = '';

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-1', email: 'admin@example.com', login: 'admin', role: 'admin' },
          profile: null,
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/admin/queue')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'doc-1',
            full_name: 'Кирилл Архипов',
            user_email: 'candidate@example.com',
            ach_type: 'education',
            ach_title: 'Бакалавриат',
            file_name: 'diploma.pdf',
          },
        ], 1, 20, 1)),
      });
    }

    if (url.pathname.endsWith('/admin/users')) {
      userSearch = url.searchParams.get('search') || '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'user-1',
            email: 'founder@lomo.website',
            full_name: 'Основатель LOMO',
            company: 'LOMO',
            role: 'employer',
          },
        ], 1, 20, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'admin@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenAdminQueue')).toHaveClass(/active/);
  await expect(page.locator('#adminQueueList')).toContainText('Кирилл Архипов');

  await page.click('#adminTabUsers');
  await expect(page.locator('#adminUsersList')).toContainText('founder@lomo.website');

  await page.fill('#adminUserSearch', 'founder');
  await expect.poll(() => userSearch).toBe('founder');
});

test('admin logout returns to landing', async ({ page }) => {
  let logoutCalled = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-1', email: 'admin@example.com', login: 'admin', role: 'admin' },
          profile: null,
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/auth/logout')) {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }

    if (url.pathname.endsWith('/admin/queue')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], 1, 20, 0)),
      });
    }

    if (url.pathname.endsWith('/admin/users')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], 1, 20, 0)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'admin@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenAdminQueue')).toHaveClass(/active/);
  await page.click('#adminLogoutBtn');

  await expect.poll(() => logoutCalled).toBe(true);
  await expect(page.locator('#screenLanding')).toHaveClass(/active/);
  await expect(page.locator('#screenLanding')).toContainText('Подтверждённый.');
});

test('mobile registration role step stays readable and actionable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/');
  await page.click('#landingRegBtn2');

  await expect(page.locator('#screenRoleReg')).toHaveClass(/active/);

  const firstChoice = page.locator('#roleChoices .sqBtn').nth(0);
  const secondChoice = page.locator('#roleChoices .sqBtn').nth(1);
  const nextButton = page.locator('#btnRoleNext');

  const firstBox = await firstChoice.boundingBox();
  const secondBox = await secondChoice.boundingBox();

  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs(firstBox.x - secondBox.x)).toBeLessThan(8);
  expect(secondBox.y).toBeGreaterThan(firstBox.y + 20);
  expect(secondBox.y + secondBox.height).toBeLessThan(844);

  await firstChoice.dispatchEvent('touchend');
  await expect(nextButton).toBeEnabled();

  const nextBox = await nextButton.boundingBox();
  expect(nextBox).not.toBeNull();
  expect(nextBox.y + nextBox.height).toBeLessThan(844);
});

test('mobile candidate feed avoids horizontal overflow after login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'emp-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-2',
            role: 'candidate',
            full_name: 'Анна Петрова',
            location: 'Санкт-Петербург',
            edu_place: 'ИТМО',
            vacancies: 'Designer',
            about: 'Хочу работать в сильной команде и развиваться в продукте.',
          },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
  await expect(page.locator('#candidateFeedList')).toContainText('Анна Петрова');

  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    docWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    activeWidth: document.querySelector('.screen.active')?.scrollWidth || 0,
  }));

  expect(metrics.docWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.activeWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
});

test('mobile candidate feed keeps logout visible and usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let logoutCalled = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'emp-1', email: 'candidate@example.com', login: 'candidate', role: 'candidate' },
          profile: { full_name: 'Иван Кандидат', location: 'Москва', edu_place: 'МГУ', vacancies: 'Product Designer' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/auth/logout')) {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-2',
            role: 'candidate',
            full_name: 'Анна Петрова',
            location: 'Санкт-Петербург',
            edu_place: 'ИТМО',
            vacancies: 'Designer',
            about: 'Хочу работать в сильной команде и развиваться в продукте.',
          },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  const logoutButton = page.locator('#screenCandidateFeed .feedHeaderNav [data-next="toAuthFromProfile"]');
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  await expect.poll(() => logoutCalled).toBe(true);
  await expect(page.locator('#screenLanding')).toHaveClass(/active/);
});

test('mobile employer search keeps logout visible and usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let logoutCalled = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'company-1', email: 'employer@example.com', login: 'employer', role: 'employer' },
          profile: { full_name: 'Алина HR', company: 'LOMO Labs', industry: 'Tech', location: 'Москва' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/auth/logout')) {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }

    if (url.pathname.endsWith('/profile/candidates')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 'cand-77',
            role: 'candidate',
            full_name: 'Мария Тестова',
            location: 'Санкт-Петербург',
            edu_place: 'ИТМО',
            vacancies: 'Designer',
            about: 'Хочу в сильную команду',
          },
        ], 1, 12, 1)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'employer@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  const logoutButton = page.locator('#screenEmployerSearch .feedHeaderNav [data-next="toAuthFromProfile"]');
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  await expect.poll(() => logoutCalled).toBe(true);
  await expect(page.locator('#screenLanding')).toHaveClass(/active/);
});

test('existing account can log in by email without validation error', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      const body = JSON.parse(request.postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-existing', email: 'existing@example.com', login: 'existing.user', role: 'candidate' },
          profile: { full_name: 'Существующий Пользователь', location: 'Москва', edu_place: 'ВШЭ', vacancies: 'Analyst' },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], 1, 12, 0)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.fill('#loginEmail', 'existing@example.com');
  await page.locator('#loginPassword').focus();
  await expect(page.locator('#loginEmailError')).toHaveClass(/hidden/);
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');
  await expect(page.locator('#screenCandidateFeed')).toHaveClass(/active/);
});

test('candidate feed header profile button opens public profile screen', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'cand-12', email: 'candidate@example.com', role: 'candidate' },
          profile: {
            full_name: 'Иван Кандидат',
            public_id: 'LOMO-CAND0012',
            location: 'Москва',
            edu_place: 'МГУ',
            vacancies: 'Designer',
          },
          achievements: [],
        }),
      });
    }

    if (url.pathname.endsWith('/profile/feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], 1, 12, 0)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await openLogin(page);
  await page.evaluate(() => { document.cookie = 'lomo_csrf=test-suite; path=/'; });
  await page.fill('#loginEmail', 'candidate@example.com');
  await page.fill('#loginPassword', 'secret123');
  await page.click('[data-next="fromLoginForm"]');

  await page.click('#feedMyProfileBtn');
  await expect(page.locator('#screenEmployeePublic')).toHaveClass(/active/);
  await expect(page.locator('#epName')).toContainText('Иван Кандидат');
});
