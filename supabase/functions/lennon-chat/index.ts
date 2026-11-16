// Kepler AI chat: receives messages from the website, adds the Groq key, and returns the reply.
// The key is read from the GROQ_API_KEY secret, so it never reaches the browser.

const ALLOWED_ORIGINS = [
  "https://lenodrips-create.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

// Kepler AI models: three families (Titan best, Pan middle, Janus fastest), versions 2 to 5.5.
// Each version runs on a real Groq engine. Higher versions get stronger engines, more thinking
// effort and longer replies. If an engine is retired, the next lower one is used.
type Engine = { id: string; effort?: "low" | "medium" | "high"; tokens: number };
const ENGINES: Engine[] = [
  { id: "openai/gpt-oss-120b", effort: "high", tokens: 8192 },   // 0 strongest
  { id: "openai/gpt-oss-120b", effort: "medium", tokens: 6144 }, // 1
  { id: "openai/gpt-oss-120b", effort: "low", tokens: 4096 },    // 2
  { id: "llama-3.3-70b-versatile", tokens: 1536 },               // 3
  { id: "openai/gpt-oss-20b", effort: "medium", tokens: 4096 },  // 4
  { id: "openai/gpt-oss-20b", effort: "low", tokens: 3072 },     // 5
  { id: "llama-3.1-8b-instant", tokens: 1024 },                  // 6
  { id: "llama-3.1-8b-instant", tokens: 512 },                   // 7 lightest
];
const VERSIONS = ["5.5", "5", "4.5", "4", "3.5", "3", "2.5", "2"];
const FAMILY: Record<string, { name: string; engines: number[] }> = {
  //            5.5 5  4.5 4  3.5 3  2.5 2
  titan: { name: "Titan", engines: [0, 1, 2, 3, 3, 4, 5, 6] },
  pan:   { name: "Pan",   engines: [1, 2, 3, 4, 4, 5, 6, 7] },
  janus: { name: "Janus", engines: [3, 4, 5, 6, 6, 7, 7, 7] },
};
function pickModel(value: unknown) {
  const parts: string[] = typeof value === "string" ? value.split("-") : [];
  const fam = parts[0] ?? "", ver = parts[1] ?? "5.5";
  const family = fam in FAMILY ? fam : "titan";
  const vi = Math.max(0, VERSIONS.indexOf(ver));
  const start = FAMILY[family].engines[vi];
  const level = (VERSIONS.length - 1 - vi) / (VERSIONS.length - 1); // 0 (v2) .. 1 (v5.5)
  return {
    name: `${FAMILY[family].name} ${VERSIONS[vi]}`,
    chain: ENGINES.slice(start),
    style: level >= 0.7 ? "Give clear, thorough answers." : level >= 0.35 ? "Keep replies fairly short." : "Keep replies very short and simple.",
  };
}

const system = (name: string, style: string) =>
  `Your name is Kepler AI and you are running the ${name} model. You are a friendly chat assistant. ${style} Reply in plain text, no markdown.`;

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
  let picked = pickModel("titan-5.5");
  try {
    const body = await req.json();
    messages = body.messages;
    picked = pickModel(body.model);
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

  const tried = new Set<string>();
  for (const eng of picked.chain) {
    const key2 = eng.id + (eng.effort ?? "");
    if (tried.has(eng.id + "!")) continue; // engine already found missing
    if (tried.has(key2)) continue;
    tried.add(key2);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: eng.id,
        max_tokens: eng.tokens,
        ...(eng.effort ? { reasoning_effort: eng.effort } : {}),
        messages: [{ role: "system", content: system(picked.name, picked.style) }, ...messages],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content ?? "";
      return json({ reply }, 200, origin);
    }

    const text = await res.text();
    // A retired or unknown model: try the next one.
    if ((res.status === 400 || res.status === 404) && /model/i.test(text)) { tried.add(eng.id + "!"); continue; }
    if (res.status === 401) return json({ error: "The Groq key was rejected. Check the GROQ_API_KEY secret." }, 502, origin);
    if (res.status === 429) return json({ error: "Too many messages. Wait a moment and try again." }, 429, origin);
    console.error("Groq error", res.status, text);
    return json({ error: "Kepler AI had a problem. Try again." }, 502, origin);
  }

  return json({ error: "No Groq model is available right now." }, 502, origin);
});
