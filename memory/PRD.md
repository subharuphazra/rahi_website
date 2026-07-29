# Rahi Bangla — PRD

## Original Problem Statement
Build a news website "Rahi Bangla" covering Indian business, education, sports, entertainment, science, lifestyle and elections. Admin publishes daily updates (blogs + images). Anyone can register/login. Public visitors see latest headlines with photos.

## User Choices (locked in)
- Authentication: JWT-based email/password (httpOnly cookies)
- Admin: pre-seeded from env (rahipatrika@gmail.com)
- Language: bilingual EN + BN toggle
- Image uploads: Emergent Object Storage
- MVP extras: likes/bookmarks, comments, newsletter subscribe

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT auth, bcrypt, object storage integration
- Frontend: React 19 + React Router 7, TanStack Query, Tailwind + Shadcn UI, Playfair Display / IBM Plex / Noto Serif Bengali / Hind Siliguri
- Design system: Editorial "Swiss & High-Contrast" (white/black + Rahi Red #D92D20), no gradients, cardless news lists

## User Personas
- Reader (anonymous) — browses homepage, category, article, subscribes to newsletter
- Registered reader — can comment, like, bookmark
- Admin — creates/edits/deletes bilingual stories, uploads cover images, toggles publish/featured

## Implemented (2026-02)
- Public: Home (hero bento + latest + category sections), Category page + search, Article page (like/bookmark/share/comments), 404
- Auth: Register / Login / Logout / Me, admin seed on startup, role-based route guards
- Admin dashboard: article list with stats, create/edit editor with bilingual tabs, category select, cover image upload OR external URL, published/featured switches, delete with confirmation
- Article system: seeded sample articles across 7 categories, slug-based URLs, view counter
- Engagement: toggle likes, toggle bookmarks (+ bookmarks page), comments list + post
- Newsletter subscribe from footer
- Bilingual UI: language context toggle switches strings + font families dynamically
- Object storage: /api/uploads (admin only) + /api/files/{path} serve
- Backend regression suite at /app/backend/tests/backend_test.py (18/18 passing)

## Added (2026-07 — Customization Suite)
1. **Customizable layouts (drag-and-drop + resize)** — Admin at `/admin/layout` picks a section (home latest, per-category home strip, category page grid), auto-arranges from articles, then drags/resizes cards on a 12-column grid via react-grid-layout. Saved layouts render on the public site through the new CustomLayoutSection component.
2. **Left/Right sidebar with latest news** — Home and category pages now render sticky sidebars showing latest headlines as text-only entries with "time ago" stamps. Auto-fills from newest published articles and auto-refreshes every 60 s. Admin can curate items at `/admin/sidebar` (per-side add/edit/delete/reorder, active toggle).
3. **Breaking news CRUD + scheduling** — Ticker at the top now pulls from `/api/breaking`. Admin manages headlines at `/admin/breaking` (add/edit/delete/active-toggle, bilingual, optional link, order, **optional start_at / end_at**). Items auto-appear at start_at and auto-vanish at end_at. Status badges: Live / Scheduled / Expired / Paused. Falls back to latest articles when no items are configured.
4. **Category CRUD** — Categories are now stored in Mongo (`categories` collection) and seeded from the previous hardcoded list on first boot. Admin manages them at `/admin/categories` (slug, bilingual name, order). Delete is blocked if any article still uses the category. Header nav, footer, article cards, admin editor and sitemap all read dynamically from `/api/categories`.
5. **Ingress health endpoints** — Added `/health`, `/health/ready`, `/health/live` to help the platform ingress discover the backend and to satisfy readiness/liveness probes.
6. **Preview URL fix** — Updated `REACT_APP_BACKEND_URL` and `FRONTEND_URL` from the stale `rahi-news-portal.preview.emergentagent.com` to the actual routable preview URL `https://0c2b6ec2-46d8-46b0-a4fe-96cf47296641.preview.emergentagent.com`; this restored the admin login flow.

### Data model additions
- `db.categories { id, slug, name_en, name_bn, order, created_at }`
- `db.breaking { id, text_en, text_bn, link, active, order, created_at }`
- `db.sidebar_news { id, side, text_en, text_bn, link, article_id?, active, order, created_at }`
- `db.layouts { key, blocks: [{i,x,y,w,h,articleId}], updated_at, updated_by }`

### New API endpoints (all `/api/*`)
- GET/POST `/categories`, PUT/DELETE `/categories/{id}` (admin)
- GET `/breaking`, POST `/breaking`, PUT/DELETE `/breaking/{id}` (admin)
- GET `/sidebar-news?side=left|right`, GET `/admin/sidebar-news`, POST/PUT/DELETE `/sidebar-news/{id}` (admin)
- GET/PUT/DELETE `/layouts/{key}` (admin write)

## Backlog (P1)
- Newsletter: schedule "Daily Briefing" cron (currently manual /api/admin/newsletter/broadcast), unsubscribe reason survey
- Analytics: view dedupe per session, most-read widget
- Search: full-text index (Mongo Atlas Search), autocomplete
- Split server.py into routers (auth, articles, newsletter, seo, uploads) + service modules
- Newsletter broadcast: background task / Resend batch send for large lists
- Content: related articles / next-to-read

## Backlog (P2)
- Related articles / next-to-read
- Author profile pages
- Dark mode toggle (design system already supports it)
- Reader push notifications
- Multi-admin roles (editor / contributor)

## Deployment Notes
- Backend env: MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, EMERGENT_LLM_KEY, FRONTEND_URL, APP_NAME
- Frontend env: REACT_APP_BACKEND_URL
- All API routes prefixed `/api`. Cookies SameSite=None; Secure.
be flow
- SEO: sitemap, OG images, JSON-LD article markup, RSS feed
- Article: rich-text editor (currently plain paragraphs), inline images inside body
- Analytics: view dedupe per session, most-read widget
- Search: full-text index, autocomplete

## Backlog (P2)
- Related articles / next-to-read
- Author profile pages
- Dark mode toggle (design system already supports it)
- Reader push notifications
- Multi-admin roles (editor / contributor)

## Deployment Notes
- Backend env: MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, EMERGENT_LLM_KEY, FRONTEND_URL, APP_NAME
- Frontend env: REACT_APP_BACKEND_URL
- All API routes prefixed `/api`. Cookies SameSite=None; Secure.
