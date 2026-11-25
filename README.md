# Kepler AI

A simple AI chat site with a black-and-white terminal interface. Type `/help` in the chat for commands.

- `index.html` is the website, hosted on GitHub Pages.
- `supabase/functions/lennon-chat/` is a Supabase Edge Function. It holds the Groq API key and sends chats to Groq.

The Groq key is stored only as a secret in Supabase (Edge Functions → Secrets), named `GROQ_API_KEY`. It is never in this repository or the web page.

Only `https://lenodrips-create.github.io` (and `localhost:8000` for testing) may call the function. To use another domain, add it to `ALLOWED_ORIGINS` in the function and redeploy.

## Site password

The site opens to a password screen. There is one password and no email: it signs in to a single Supabase account (`kepler@example.com`, never emailed), and the chat function only answers that account.

**Set or change the password:** Supabase dashboard → SQL Editor → run (replace the text in quotes):

```sql
update auth.users
set encrypted_password = extensions.crypt('YOUR PASSWORD HERE', extensions.gen_salt('bf'))
where email = 'kepler@example.com';
```

**Stay signed in for:** the password screen offers this visit only, 1 hour, 5 hours (default), 1 day, 7 days or 30 days. The site forgets the login when the time runs out, and Supabase ends the session at the same time (`kepler_set_session_expiry` in `supabase/migrations/20261125233000_session_expiry.sql`).

## Legal pages

**How to edit everything added in the audit:** see [`docs/EDITING-GUIDE.md`](docs/EDITING-GUIDE.md).

`privacy.html`, `terms.html` and `credits.html` are **drafts**. Fill in every highlighted `[placeholder]` and have them reviewed by a lawyer before launch. See `docs/compliance-audit-2026-11-18.md` for the full audit.

## Updating

- After changing `supabase/functions/lennon-chat/index.ts`, redeploy the function in Supabase. Changes in this repository do not reach the live function on their own.
- The CDN script in `index.html` (supabase-js) is pinned with `integrity` hashes. If you change a version, update its hash too, or the browser will refuse to load it.
