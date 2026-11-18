# Kepler AI

A simple AI chat site.

- `index.html` is the website, hosted on GitHub Pages.
- `supabase/functions/lennon-chat/` is a Supabase Edge Function. It holds the Groq API key and sends chats to Groq.

The Groq key is stored only as a secret in Supabase (Edge Functions → Secrets), named `GROQ_API_KEY`. It is never in this repository or the web page.

Only `https://lenodrips-create.github.io` (and `localhost:8000` for testing) may call the function. To use another domain, add it to `ALLOWED_ORIGINS` in the function and redeploy.

## Legal pages

**How to edit everything added in the audit:** see [`docs/EDITING-GUIDE.md`](docs/EDITING-GUIDE.md).

`privacy.html`, `terms.html` and `credits.html` are **drafts**. Fill in every highlighted `[placeholder]` and have them reviewed by a lawyer before launch. See `docs/compliance-audit-2026-11-18.md` for the full audit.

## Updating

- After changing `supabase/functions/lennon-chat/index.ts`, redeploy the function in Supabase. Changes in this repository do not reach the live function on their own.
- The two CDN scripts in `index.html` are pinned with `integrity` hashes. If you change a version, update its hash too, or the browser will refuse to load it.
