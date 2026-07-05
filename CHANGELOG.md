# Changelog

## Unreleased

- legal: aligned site copy with the published policy — Security vulnerability contact now support@lomo.website (dropped the non-existent security@ mailbox), removed the "[в разработке]" at-rest encryption line from Privacy §11, and dropped the FAQ "90-day backup" claim that referenced a policy clause that does not exist
- seo: pointed og:url, og:image and canonical at https://www.lomo.website and removed the stale lomo.work trusted push-link hosts
- legal: replaced the Terms of Use and Privacy Policy screens with the final published copy (sole-proprietor operator details, ФЗ-152 wording, Resend cross-border disclosure, updated 2026-07-04)
- landing: added "Безопасность и доверие" trust band and a closing call-to-action section (light + dark + mobile)
- performance: deferred all page scripts and added decoding/lazy hints to non-critical logos
- security: moved clickjacking protection to real HTTP headers (`X-Frame-Options`, CSP `frame-ancestors`) via `vercel.json` and removed the ineffective meta `frame-ancestors`
- bumped static asset and service worker cache versions (`v26` / `lomo-static-v22`)
- cleaned repository naming by removing `legacy-*.js` filenames
- renamed frontend runtime modules to `auth-ui.js`, `profile-runtime.js`, `ui-shell.js`
- kept PWA shell, smoke tests and Vercel runtime wiring intact

## 2026-04

- added PWA layer with manifest, icons, offline shell and service worker
- improved mobile auth and profile flows
- added password reset, password visibility toggles and self-service account deletion
- added user connections and frontend quality gates
- hardened auth runtime and split the former frontend monolith into modules
