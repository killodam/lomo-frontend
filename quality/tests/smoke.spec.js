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

  await page.click('#candidateFeedPager .pagerBtn:text("Далее")');
  await expect(page.locator('#candidateFeedList')).toContainText('Павел Иванов');
  await expect.poll(() => requestedPage).toBe('2');
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

  await page.fill('#chatMessageInput', 'Добрый день!');
  await page.click('#chatSendBtn');
  await expect.poll(() => sentMessage).toBe('Добрый день!');
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
