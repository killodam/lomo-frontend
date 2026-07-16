# LOMO Frontend

SPA-фронтенд LOMO, работающий как installable PWA. Канонический продакшн отдаётся backend-приложением из синхронизированной `backend/public` копии; Vercel-домен используется только как permanent redirect на `https://www.lomo.website`.

## Что внутри

- `index.html` — основной экранный shell и HTML-разметка
- `styles/*.css` — стили подключаются напрямую из `index.html`; `main.css` хранит дополнительные продуктовые блоки и совместимость
- `config.js` — frontend-конфиг API и среды
- `scripts/api.js` — HTTP-слой и работа с backend API
- `scripts/state.js` — клиентское состояние приложения
- `scripts/screens.js` — навигация по экранам и screen orchestration
- `scripts/auth.js` — логин, регистрация, reset password, self-delete
- `scripts/auth-ui.js` — локальная UI-логика auth-экранов
- `scripts/admin.js` — админская очередь, поиск, модерация
- `scripts/public-profile.js` — публичные профили и related flows
- `scripts/profile-runtime.js` — рендер профилей, файлы, формы профиля
- `scripts/ui-shell.js` — drawer, модалки, статические UI-связки
- `scripts/chat.js` — клиентская подготовка под чат
- `scripts/runtime.js` — PWA/install/runtime monitoring hooks
- `scripts/info-screens.js` — полноэкранные legal/info-экраны из drawer/footer
- `scripts/onboarding.js`, `scripts/referral.js`, `scripts/saved-searches.js`, `scripts/subscriptions.js` — текущие продуктовые модули
- `sw.js`, `manifest.webmanifest`, `offline.html` — PWA-слой
- `quality/` — lint и Playwright smoke-тесты

## Архитектура

Фронтенд остаётся vanilla SPA без framework runtime и build step, но уже разбит на независимые слои:

1. `api.js` отвечает только за backend-коммуникацию.
2. `state.js` хранит текущего пользователя, профили, ленты, контакты и чат.
3. `screens.js` переключает экраны и связывает high-level переходы.
4. `auth.js`, `admin.js`, `public-profile.js`, `profile-runtime.js`, `ui-shell.js` реализуют доменные куски UI.
5. `info-screens.js` обслуживает полноэкранные информационные, legal и FAQ-экраны.
6. `runtime.js` добавляет service worker, install prompt и client error reporting.

Это позволяет развивать продукт дальше без возврата к монолитному `legacy-app.js`.

## Локальный запуск

```bash
cd frontend/quality
npm install
npm run lint
npm run test:smoke
```

Для ручной разработки фронтенд можно открывать напрямую или через локальный статический сервер. На локальном host `api.js` ходит в Amvera backend; на продакшн-доменах API ожидается под тем же origin по `/api`.

## Качество

- `npm run lint` — базовый JS lint
- `npm run test:smoke` — критичные smoke/e2e сценарии
- GitHub Actions workflow: `.github/workflows/ci.yml`

## Деплой

- ветка frontend-источника: `main`
- основной продакшн: backend/Amvera отдаёт синхронизированный `backend/public`
- Vercel: `lomo-frontend.vercel.app` должен отвечать `308` на `https://www.lomo.website`
- runtime sanity:
  - canonical frontend root должен отвечать `200`
  - `manifest.webmanifest` должен быть доступен
  - service worker должен регистрироваться без ошибок
