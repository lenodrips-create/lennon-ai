// Kepler AI chat: receives messages from the website, adds the Groq key, and returns the reply.
// The key is read from the GROQ_API_KEY secret, so it never reaches the browser.

const ALLOWED_ORIGINS = [
  "https://lenodrips-create.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

// Tried in order; the first one Groq accepts is used. Set GROQ_MODEL to override.
const MODELS = [
  Deno.env.get("GROQ_MODEL"),
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter(Boolean) as string[];

const SYSTEM =
  "Your name is Kepler AI. You are a simple, friendly chat assistant. Reply briefly in plain text, no markdown.";

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "This site is not allowed to use Kepler AI." }, 403, origin);
  }

  // Only signed-in Kepler AI users may chat. The site sends the user's login token.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to chat with Kepler AI." }, 401, origin);
  const who = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_KGnwpyai1gG2rHBj6XSnmA_VlK-Yc8a",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!who.ok) return json({ error: "Your sign-in expired. Sign in again to keep chatting." }, 401, origin);

  // Accept the key under any of the names it might have been saved with in Supabase.
  const key = ["GROQ_API_KEY", "lennon api", "LENNON_API", "lennon_api", "LENNON API"]
    .map((n) => Deno.env.get(n)?.trim())
    .find(Boolean);
  if (!key) return json({ error: "Kepler AI is not set up yet: the Groq key is missing." }, 500, origin);

  let messages: { role: string; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
  } catch {
    return json({ error: "Bad request." }, 400, origin);
  }

  if (
    !Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES ||
    !messages.every((m) =>
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" && m.content.length <= MAX_CHARS
    )
  ) {
    return json({ error: "That chat is too long. Start a new chat." }, 400, origin);
  }

  for (const model of MODELS) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "system", content: SYSTEM }, ...messages],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content ?? "";
      return json({ reply }, 200, origin);
    }

    const text = await res.text();
    // A retired or unknown model: try the next one.
    if ((res.status === 400 || res.status === 404) && /model/i.test(text)) continue;
    if (res.status === 401) return json({ error: "The Groq key was rejected. Check the GROQ_API_KEY secret." }, 502, origin);
    if (res.status === 429) return json({ error: "Too many messages. Wait a moment and try again." }, 429, origin);
    console.error("Groq error", res.status, text);
    return json({ error: "Kepler AI had a problem. Try again." }, 502, origin);
  }

  return json({ error: "No Groq model is available right now." }, 502, origin);
});
