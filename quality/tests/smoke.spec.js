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
  await page.click('#startBtn');
  await page.click('[data-pick="auth"][data-value="LOGIN"]');
}

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
