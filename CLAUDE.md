# WinLog — Project Context

## What it is
A personal win-tracking web app for PMs. Users log raw wins (text or voice), Claude cleans them into resume-ready bullets, and the app tracks streaks/stats.

Live: https://winlog-sage.vercel.app

## Stack
- **Frontend:** Single-page HTML (`winlog.html` = dev, `index.html` = prod/deployed)
- **Backend:** Vercel serverless functions (`api/`)
- **AI:** Anthropic Claude API (proxied via `api/claude.js`)
- **DB:** Supabase (live — replaced localStorage)
- **Hosting:** Vercel

## Data model
Win object: `{ id, raw, clean, category, impact, source, date, user_id }`
- `category`: one of `delivery | leadership | stakeholder | strategy | growth`
- `source`: `text` or `voice`
- Stored in Supabase `wins` table, scoped by `user_id` (auth.users FK)
- Guest wins (pre-auth) stored in localStorage `winlog_v2`, count in `winlog_guest_count`

## Roadmap phases (from Notion)
- ✅ V2 - Done
- ✅ V3 - Supabase persistence, deployed
- ✅ V4 - Auth, voice, edit, export, trial, rate limit (all shipped)
- 🔄 Beta prep (current phase)
- 🔜 V5 - Growth

## Notion
Roadmap DB: https://www.notion.so/31d8957fea8e40869503406304afbcc7

## Current stopping point (resume here)
V4 is complete and deployed. Working through beta-prep hardening.

**Shipped so far:**
- Auth: email/password, magic link, sign-up confirmation screen, sign-out flow
- Dupe-email detection on sign-up (handles Supabase anti-enumeration + explicit error)
- `email_not_confirmed` handling on sign-in with inline "Resend confirmation" link
- Password reset: "Forgot password?" → reset email → `PASSWORD_RECOVERY` event opens new-password overlay
- Guest trial: 5 free wins in localStorage, ephemeral, not portable to account
- Per-user daily cap (25 wins/day) + per-IP guest rate limit (10 / 15 min, in-memory)
- Edit wins, export, voice input (SpeechRecognition)
- All wins scoped by `user_id` with RLS enforced

**Design decision — keeping email confirmation ON.** Earlier plan was to disable it for signup smoothness; we chose to keep it for signup quality and harden the UX around it instead (resend links, duplicate detection, recovery flow).

**Test account:** test@winlog.dev / WinLog#Test1

**Next actions (beta-prep priorities):**
1. **Supabase redirect URLs** — confirm both `https://winlog-sage.vercel.app` and localhost are in Auth → URL Configuration → Redirect URLs, or password reset bounces.
2. **Smoke test** dupe-email, unconfirmed-signin, and password-reset flows on deployed site with a throwaway address.
3. Rate-limit storage — if beta traffic warrants, move guest rate-limit from in-memory Map to Upstash/KV (current impl resets on cold start, per-container).
4. Polish: client-side email validation, lockout after N rapid signup attempts.
5. Beta launch checklist.

## Supabase
- Project URL: https://swberpmhzcrwfpadbtsq.supabase.co
- `wins` table live with RLS — policy: `auth.uid() = user_id` (user-scoped)
- `api/config.js` exposes SUPABASE_URL + SUPABASE_ANON_KEY to frontend
- Email confirmation is ON (intentional — UX is hardened around it)
- Redirect URLs must include prod origin + localhost for password reset to work

## Env vars (all set in Vercel + .env.local)
- `ANTHROPIC_API_KEY` — Claude API
- `SUPABASE_URL` — https://swberpmhzcrwfpadbtsq.supabase.co
- `SUPABASE_ANON_KEY` — publishable key

## Key files
- `winlog.html` — dev version (keep in sync with index.html)
- `index.html` — prod/deployed version
- `api/claude.js` — proxies Anthropic API calls
- `api/config.js` — exposes Supabase config to frontend
