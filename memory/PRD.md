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
