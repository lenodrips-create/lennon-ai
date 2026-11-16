# Lennon

A simple black-and-white AI chat.

- `index.html` is the website, hosted on GitHub Pages.
- `supabase/functions/lennon-chat/` is a Supabase Edge Function. It holds the Groq API key and sends chats to Groq.

The Groq key is stored only as the `GROQ_API_KEY` secret in Supabase (Edge Functions → Secrets). It is never in this repository or the web page.

Only `https://lenodrips-create.github.io` (and `localhost:8000` for testing) may call the function. To use another domain, add it to `ALLOWED_ORIGINS` in the function and redeploy.
