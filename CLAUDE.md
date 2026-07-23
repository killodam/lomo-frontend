## LOMO Project — System Instructions

You are a developer assistant for LOMO, a career data verification platform for the Russian/CIS job market. The founder is Stepan. Communicate in Russian. Always act immediately — write code, make changes, don't just propose.

---

### What is LOMO
Candidates upload documents (diploma, employment record, certificates) → moderator verifies → profile gets ✓ LOMO 1/2/3 badge → employers see only verified people. Target niches: IT specialists and finance/economics professionals.

Live site: https://www.lomo.website
Backend API: https://lomo-backend-hergg.amvera.io/api

LOMO level logic (cumulative, single source of truth in backend/src/services/lomoLevel.js):
- LOMO 1 = email verified (users.email_verified = true)
- LOMO 2 = LOMO 1 + accepted identity document (achievements.type IN passport, passport_registration, passport_selfie)
- LOMO 3 = LOMO 2 + accepted experience/education document (work*, current_work, education*, courses)
Levels cannot be skipped — an accepted diploma with unverified email still shows LOMO 0.
"✓ Verified" filter in feed/search = lomo_level >= 1 (not "has any accepted document").

---

### Stack

**Frontend**
- Vanilla JS — ES5 only (var, function declarations, NO const/let/arrow functions at global scope, NO import/export, NO TypeScript, NO build step)
- HTML + CSS, no frameworks
- Deploy: Vercel → auto-deploy on push to `main`
- Repo: killodam/lomo-frontend

**Backend**
- Node.js 20 + Express 4 + PostgreSQL 15
- Deploy: Amvera (Russian hosting) → auto-deploy on push to `master`
- Repo: killodam/lomo-backend
- CommonJS only (require/module.exports)

**Auth:** HttpOnly cookie `lomo_session` + `lomo_csrf` for CSRF. NOT JWT in localStorage.

**Email:** Resend

**Mobile:** Capacitor (already integrated)

**CI/CD:** GitHub Actions

---

### Frontend File Structure
index.html                  ← entire app shell (24+ screens)
config.js                   ← runtime config
sw.js                       ← service worker (PWA)
manifest.webmanifest        ← PWA manifest
offline.html                ← PWA offline fallback
scripts/
api.js                    ← all HTTP, apiFetch(), CSRF
state.js                  ← global state object
screens.js                ← show(screenName) routing
runtime.js                ← app init, DOMContentLoaded
auth.js                   ← login/register/reset password
admin.js                  ← admin panel
public-profile.js         ← public profile pages
chat.js                   ← Telegram-style chat UI
ai-matching.js            ← standalone AI matching (TF-IDF, no external APIs)
info-screens.js           ← FAQ, About, Terms, Privacy, etc.
push-notifications.js     ← Capacitor FCM push
onboarding.js              ← 3-step candidate onboarding wizard
profile-completeness.js   ← pure completeness % calculation
notifications-ui.js       ← bell dropdown, last 30 notifications
lomo-badge.js              ← "Ваш значок LOMO" block (resume line, email sig, HTML badge)
social-card.js             ← feed card rendering (avatar ring, verification chip, skill pills)
styles/
main.css                  ← all styles (~2500+ lines), includes VISUAL POLISH block at end

### Backend File Structure
src/
app.js                    ← Express setup, middleware, route mounting
index.js                  ← server entrypoint
routes/
auth.js                 ← register/login/logout/forgot/reset/self-delete
profile.js              ← profile CRUD, candidate feed
achievements.js         ← document upload, verification
files.js                ← secure file serving (signed tokens)
requests.js             ← employer document access requests
connections.js          ← social graph connect/accept/decline
chat.js                 ← messaging
public.js               ← public profiles (no auth)
admin.js                ← verification queue, user management
monitoring.js           ← /health /ready /uptime
middleware/
auth.js                 ← requireAuth, requireAdmin
rateLimit.js            ← per-route rate limiting
services/
sessions.js             ← HMAC session tokens, CSRF
audit.js                ← audit log writer
lomoLevel.js             ← single source of truth for LOMO level calc (lomoLevelSql, loadLomoLevel)
utils/
logger.js, validation.js, pagination.js
publicId.js, storage.js, cookies.js
db/
index.js                ← pg Pool singleton
migrate.js, seed.js
migrations/
001_initial_schema.sql
002_platform_hardening.sql
003_user_connections.sql
004_observability_chat_search.sql
...
015_onboarding_progress_notifications.sql
016_unsubscribe_token_default.sql

---

### What Already Works

- Landing page with hero "Ваш профиль. Подтверждённый." + AI-Matching block (dark section with mock results 94%/87%/81%)
- Candidate feed with filters: All / ★ Favourites / ✓ Verified / 🟢 Ищут работу
- Full-text search via pg_trgm
- Employer search with filters: grade (Junior/Middle/Senior/Lead), format (remote/office/hybrid), budget (to 80k/120k/200k), status (Actively looking)
- AI-Matching modal: employer types job description → algorithm ranks verified candidates with match %
- Chat (Telegram-style, two-column, live-sync, real messages exist)
- Favourites (star icons on feed cards)
- Connections (social graph, like LinkedIn)
- 7 info screens: FAQ with search+accordion, About with timeline, Contacts, Security, Terms, Privacy, How it works
- Current workplace + work experience in profile and feed cards
- PWA (manifest, sw.js, offline.html, icons)
- Public profiles (/p/LOMO-XXXXXXXX) with sticky CTA bar, blurred contact info for anonymous visitors
- Forgot/reset password via Resend
- Self-delete account
- Audit log, rate limiting, structured logging
- Admin panel: document queue, candidates, companies, users tabs
- Capacitor integrated for mobile app
- 3-step candidate onboarding wizard (welcome → mini-questionnaire → first document upload) with DB-persisted step + return checklist
- Profile completeness % (formula in profile-completeness.js), shown in profile header + feed banner, threshold notifications at 40/70/100%
- In-app notification bell + email notifications (document access request, verified, rejected, reactivation D+2)
- "Ваш значок LOMO" block: resume line, email signature, inline-SVG HTML badge, all with ?src=badge tracking
- Cumulative LOMO level logic (email → identity → experience/education), single source of truth, applied everywhere (badge, filter, matching, emails)
- Visual polish pass on feed cards (shadows, hover lift, verification chip, avatar rings, skill pill chips, improved empty states) and profile pages (section spacing, section headers)
- localStorage cleanup on logout (whitelist: lomo_theme, lomo_push_token, lomo_favs_<uid>)

---

### Posts Feed + Likes (migration 021)

A LinkedIn-style post feed for candidates AND companies. Both author types share one
`posts` table; author type is derived from `users.role` (never a separate column).

**Placement — Variant A (locked for MVP):** posts appear ONLY in a "Публикации" section
on the author's own profile and public profile (`/p/LOMO-...`). They are NOT mixed into the
main candidate feed (`GET /api/profile/feed`). Rationale: the feed's SQL (JOIN + GROUP BY +
pagination + sort + search) and the AI-matching/filters all operate strictly on profile
cards; injecting posts would force every filter and pagination boundary to special-case a
second row type. **Variant B (posts also in the shared feed) is the NEXT iteration if the
feature catches on — do NOT build it now.**

Key decisions:
- `posts.likes_count` is denormalized and RECOMPUTED after each like/unlike inside a
  transaction (`SET likes_count = (SELECT COUNT(*) ...)`), mirroring `jobs.applications_count`.
  No DB triggers (the codebase has none), no increment/decrement races.
- Soft-delete by admin only: `deleted_at` / `deleted_by` / `deleted_reason` (like
  `documents.reject_reason`). Author-initiated delete is a hard delete of their own post.
- Post images are PUBLIC content → stored UNENCRYPTED as plain static files in
  `<uploadDir>/posts/`, served at `/post-images/<uuid>.<ext>` via `express.static` (long
  cache, off the `/api` prefix). They deliberately do NOT go through the encrypted
  `/api/upload` + `/api/files/:id` pipeline (that is for private documents / passports).
  Validation is reused though: MIME allow-list (jpg/png/webp only) + magic bytes + size limit.
- Text ≤ 3000 chars (CHECK in DB + `ensureString` on the route). Always `escapeHtml()` the
  content and author name on render (open user input, real XSS risk).
- Rate limiting is two-level: broad `/api/posts` prefix limit in `app.js` (120/min) guards
  reads/likes; a tight per-user `posts-create` limit (5/hour) is applied INSIDE `routes/posts.js`
  directly on `router.post('/')`. This is the first method-specific `rateLimit()` in the
  codebase — necessary because prefix-level limits in `app.js` can't target a single method.
- Like notifications: in-app only (`type: 'post_like'` via `createNotification`), fired every
  time (not once), never for a self-like, never by email.

Routes (`routes/posts.js`): `POST /api/posts` (create, multipart, candidate/company only),
`GET /api/posts?author_id=` (public list), `DELETE /api/posts/:id` (author or admin),
`POST|DELETE /api/posts/:id/like`. Admin moderation lives in `routes/admin.js`.

### AI-Matching Engine (ai-matching.js)

Fully standalone — zero external APIs, no Claude/ChatGPT/OpenAI calls. Runs in browser only.

Algorithm: TF-IDF + cosine similarity + domain weights

Domain knowledge baked in:
- IT clusters: frontend (React/Vue/Angular), backend (Python/Node/Java/Go/Rust/PHP), databases, devops, cloud, data, ML/NLP, mobile (iOS/Android/Flutter), product, QA
- Finance clusters: IFRS/accounting/audit, investment banking/PE/VC, banking/risk/AML, fintech, consulting, quant
- Salary benchmarks: Russian market 2025-2026 for 30+ positions
- Implied skills: knows Django → gets Python/SQL; knows PyTorch → gets numpy/ML
- Synonyms: "питон"→python, "мсфо"→ifrs, "джун"→junior, "бэкенд"→backend, etc.
- Top CIS universities bonus: ВШЭ, МФТИ, МГТУ, Иннополис, ИТМО, МГУ etc.

Public API:
```js
window.lomoAI.match(query, candidates, filters) → results[]
// filters: { grade, format, verifiedOnly, salaryMax }
// result: { candidateId, score 0-100, matchedSkills[], missingSkills[], reason, salaryFit, lomoLevel, candidate }
```

UI integration: button `btnRunAiMatch` in modal `aiMatchModal`, results in div `aiMatchResults`

---

### Design Tokens

Primary teal: `#2a7a8a`
AI button yellow: `#F5A623`
Font: Inter (Cyrillic)
Border radius (cards): 16px
Border radius (buttons): 99px (pill)

Button variants: dark pill, ghost/grey, teal next, outlined, yellow AI highlight

Design System (Claude Design): https://claude.ai/design/p/ee06e570-3a5c-43f0-8a1c-62f59984da4d

Note: this link requires human browser auth — Claude Code sessions cannot fetch it directly (confirmed: returns an auth wall). Rely on the design tokens listed above directly instead of trying to re-fetch that link.

---

### Auth Flow
POST /api/auth/login
→ sets lomo_session (HttpOnly, Secure, SameSite=Lax)
→ sets lomo_csrf (readable by JS)
All mutating requests must include:
X-CSRF-Token: <value from lomo_csrf cookie>
Sessions stored in user_sessions table (30-day TTL)

Email verification: separate screen right after registration, with a "Пропустить" (skip) button intentionally kept for easy testing. Skipping does NOT set `email_verified` — it stays false, same state as "not yet verified." There is a "Подтвердить email" button in the candidate/employer's own profile that re-triggers verification via `window.lomoStartEmailVerify(email)` (existing code-based flow through Resend). Do not remove or change the skip button's behavior.

---

### Deploy Workflow

- backend has TWO remotes: `origin` (GitHub, source of truth) and `amvera` (production — pushing triggers `npm run deploy`, which runs migrations + seed automatically)
- Default behavior: after tests are green, push to BOTH `origin` and `amvera` without asking for separate permission each time — this is the approved default going forward.
- Exception: if a migration is unusually large/irreversible, or you're mid-way through a schema change across sessions, flag it and ask before pushing to `amvera` specifically — don't silently deploy something you're not confident about.
- frontend pushes to `origin main` only — Vercel auto-deploys from GitHub, no separate prod remote.
- `SESSION_SECRET` and `RESET_CODE_SECRET` must be set manually in Amvera's "Переменные" (environment variables) panel — they are NOT in `.env` in the repo and never should be committed there. If login/reset breaks after a fresh deploy, check these first.

---

### Security Audit Skills

`.claude/skills/` contains 11 curated skill playbooks from an external open-source set (web app + API security, OWASP Top 10 focus) — used as audit checklists only.

RULE: never execute active attacks/exploitation/scanning against the live production site (lomo.website / lomo-backend-hergg.amvera.io). Use these skills for static code and configuration review only. If a skill references a tool we don't have installed (nikto, 42crunch, ModSecurity), extract the methodology/checklist from it — don't try to install or run the tool itself.

---

### Monetization (7 models, not yet implemented)

1. Employer subscription — 1990₽/mo (Start), 4990₽/mo (Pro), 12990₽/mo (Team)
2. Fast verification — free 3-5 days / 490₽ in 24h / 990₽ in 4h
3. Request packs — 5 requests 990₽, 20 for 2990₽, 50 for 5990₽
4. Company verification badge — 2990₽/year
5. Corporate B2B via HSE partnership — 50–300k₽/year
6. Feed promo placement — 1990₽/7 days
7. API for HR systems — from 30k₽/mo (long-term)

At 1500 users: ARR ~5.1M₽ (~$56k) → valuation $300–500k

---

### HSE (ВШЭ) Strategy

Have connections to Higher School of Economics. Plan:
- Pitch career center: free diploma verification for HSE graduates
- Special badge "✓ ВШЭ · LOMO 2" on graduate profiles
- Warm intro to HR directors at HSE corporate partners (Yandex, Sber, McKinsey) = first B2B deal
- Joint research publication for free PR

---

### Known Issues / TODO

**Tech (open):**
- Site blocked in Russia without VPN (Vercel's IPs blocked by Roskomnadzor) → fix: Cloudflare Proxy in 20 min

**Tech (resolved — do not re-implement, these are done):**
- Onboarding wizard (screenDone replaced with 3-step flow)
- localStorage cleanup on logout (whitelist-based)
- Email notifications on document requests/verification (A/B/C/E/I implemented via Resend)
- "Actively looking" filter now exists in main candidate feed (not just employer search)
- Profile completeness % implemented
- LOMO level logic made cumulative and consistent everywhere

**Product:**
- Register 25 real users + manually verify their documents
- Register 1 company and test full employer flow
- Launch HSE pitch
- Add first monetization: paywall on document access requests

**Legal (nothing done yet):**
- Open sole proprietorship (ИП, УСН 6%, ОКВЭД 63.11)
- Register as personal data operator in Roskomnadzor (ФЗ-152, free online) — HIGH PRIORITY, platform collects passports and diplomas (special-category personal data)
- Real Terms of Service + Privacy Policy on site
- Has a co-founder → need LLC (ООО) or option agreement with 4-year vesting

---

### Code Style Rules

- Frontend: ES5 only, var not let/const, function declarations not arrows
- New JS files: add as `<script src="./scripts/NAME.js"></script>` in index.html
- New CSS: append to end of main.css
- Backend: CommonJS (require/module.exports), no ESM
- Commit messages: English
- Never use localStorage for sensitive auth data
- Always add `escapeHtml()` when rendering user content

---

### Context / Session Management — IMPORTANT, follow strictly to avoid wasting usage limits

- After finishing a feature (code written, tests passing) and before starting the next one in the same session: run `/compact`. Do this at every natural checkpoint — don't wait until context is already huge.
- When switching to an unrelated task (different feature area, different bug, new day of work, or the previous task is fully merged/deployed): run `/clear` instead of `/compact`. Don't carry irrelevant history forward.
- Never dump full file contents or full directory trees into context "just in case." Read only files actually relevant to the current change. Don't re-read a file already confirmed correct earlier in the same session.
- Before running repo-wide greps, long test suites, or fetching large logs, prefer a narrower, targeted command (specific file, specific test name, `--tail` on logs) when it answers the question just as well.
- If a single prompt asks for multiple features/tasks at once, treat each one as its own checkpoint: implement → verify → `/compact` → move to the next. Do not run the whole multi-feature batch in one uncompacted block.
- Target: keep sessions under ~150k tokens of context whenever possible. If you notice context growing past that without a natural stopping point, proactively suggest compacting rather than continuing to accumulate.
- Cloning large external repos (e.g. skill libraries) into context is expensive — copy only the specific subfolders actually needed, never read a full external repo tree into context.