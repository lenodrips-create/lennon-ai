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
function pickModel(value: unknown, effortIn?: unknown) {
  const parts: string[] = typeof value === "string" ? value.split("-") : [];
  const fam = parts[0] ?? "", ver = parts[1] ?? "5.5";
  const family = fam in FAMILY ? fam : "titan";
  const vi = Math.max(0, VERSIONS.indexOf(ver));
  const start = FAMILY[family].engines[vi];
  const level = (VERSIONS.length - 1 - vi) / (VERSIONS.length - 1); // 0 (v2) .. 1 (v5.5)
  // Effort (chosen in the site's model menu) sets how hard thinking engines reason.
  const effort = effortIn === "low" || effortIn === "medium" || effortIn === "high" ? effortIn : null;
  const extra = effort === "high" ? " Think carefully before answering." : effort === "low" ? " Answer quickly and briefly." : "";
  return {
    name: `${FAMILY[family].name} ${VERSIONS[vi]}`,
    chain: ENGINES.slice(start).map((e) => (e.effort && effort ? { ...e, effort } : e)),
    style: (level >= 0.7 ? "Give clear, thorough answers." : level >= 0.35 ? "Keep replies fairly short." : "Keep replies very short and simple.") + extra,
  };
}

const system = (name: string, style: string) =>
  `You are Kepler ${name}, an AI assistant made by Lennon at Kepler Designs. ` +
  `When anyone asks who or what you are, which model you are, or who made you, answer: "I'm Kepler ${name}, made by Lennon." ` +
  `Do not call yourself ChatGPT, GPT, Llama, or any other assistant's name. ` +
  `If someone asks what technology powers you, you can say Kepler runs on open-source AI models served by Groq. ` +
  `You are a friendly chat assistant. ${style} Reply in plain text, no markdown.`;

// Kepler Code: the coding mode. The site shows any HTML it writes in a live preview panel.
const codeSystem = (name: string) =>
  `You are Kepler Code ${name}, the coding mode of Kepler AI, made by Lennon at Kepler Designs. ` +
  `When anyone asks who or what you are, which model you are, or who made you, answer: "I'm Kepler Code ${name}, made by Lennon." ` +
  `Do not call yourself ChatGPT, GPT, Llama, or any other assistant's name. ` +
  `If someone asks what technology powers you, you can say Kepler runs on open-source AI models served by Groq.\n\n` +
  `You build websites, web apps and browser games with HTML, CSS and JavaScript. The user sees your HTML running in a live preview next to the chat.\n\n` +
  `When the user asks you to build or change something:\n` +
  `1. Start with one or two short sentences saying what you built or changed.\n` +
  `2. Then give the complete result as ONE self-contained HTML file in a single \`\`\`html code block. Put the CSS in a <style> tag and the JavaScript in a <script> tag in that same file. Give the page a <title>.\n` +
  `3. When changing earlier work, always return the whole updated file, never a partial snippet or a diff.\n` +
  `4. Optionally end with up to three short ideas for what to add next.\n\n` +
  `Quality rules: modern, clean design; works at phone width; readable colours; semantic HTML; accessible buttons and labels; ` +
  `JavaScript that runs without errors. Do not use outside images, fonts or APIs that need keys; draw graphics with CSS, inline SVG or canvas. ` +
  `Only if a library is really needed, load it from https://cdnjs.cloudflare.com with an exact version. ` +
  `The preview runs in a sandbox, so wrap any localStorage or sessionStorage use in try/catch and do not rely on it.\n\n` +
  `For questions that don't need a page (explaining code, fixing a bug, other languages), answer briefly and put any code in a code block with a language tag. ` +
  `Outside code blocks, write plain text without markdown headings, bold or tables.`;

// Free messages per account per day (UTC). The website shows the same number: keep DAILY_LIMIT in index.html in step.
const DAILY_LIMIT = 10;

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;          // per user message
const MAX_REPLY_CHARS = 60000;   // per earlier assistant reply (Kepler Code replies hold whole files)
const MAX_TOTAL_CHARS = 150000;  // whole conversation sent to Groq

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
  const uid: string | undefined = (await who.json().catch(() => null))?.id;

  // Accept the key under any of the names it might have been saved with in Supabase.
  const key = ["GROQ_API_KEY", "lennon api", "LENNON_API", "lennon_api", "LENNON API"]
    .map((n) => Deno.env.get(n)?.trim())
    .find(Boolean);
  if (!key) {
    console.error("GROQ_API_KEY secret is missing");
    return json({ error: "Kepler AI is not available right now. Try again later." }, 500, origin);
  }

  let messages: { role: string; content: string }[];
  let picked = pickModel("titan-5.5");
  let code = false;
  try {
    const body = await req.json();
    messages = body.messages;
    picked = pickModel(body.model, body.effort);
    code = body.mode === "code";
  } catch {
    return json({ error: "Bad request." }, 400, origin);
  }

  if (
    !Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES ||
    !messages.every((m) =>
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" && m.content.length <= (m.role === "user" ? MAX_CHARS : MAX_REPLY_CHARS)
    ) ||
    messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS
  ) {
    return json({ error: "That chat is too long. Start a new chat." }, 400, origin);
  }
  // Forward only role and text, so a client cannot slip extra fields (tool calls, names) through to Groq.
  messages = messages.map((m) => ({ role: m.role, content: m.content }));

  // Daily limit: take one message now (atomically, as the user), give it back if no reply comes.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_KGnwpyai1gG2rHBj6XSnmA_VlK-Yc8a";
  const rpc = (fn: string, body: unknown, bearer: string, apikey: string) =>
    fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const took = await rpc("kepler_take_message", { p_limit: DAILY_LIMIT }, token, publicKey);
  if (!took.ok) {
    console.error(`usage take failed ${took.status}: ${(await took.text()).slice(0, 200)}`);
    return json({ error: "Kepler AI is not available right now. Try again later." }, 500, origin);
  }
  const remaining = Number(await took.json());
  if (remaining < 0) {
    return json({
      error: `You've used all ${DAILY_LIMIT} of today's free messages. Buy credit to keep chatting, or come back tomorrow.`,
      code: "limit", limit: DAILY_LIMIT, remaining: 0,
    }, 429, origin);
  }
  const refund = async () => {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey || !uid) { console.error("usage refund skipped: no service key or user id"); return; }
    const r = await rpc("kepler_refund_message", { p_user: uid }, serviceKey, serviceKey).catch(() => null);
    if (!r?.ok) console.error(`usage refund failed ${r?.status}`);
  };
  const result = await reply();
  if (result.status !== 200) await refund();
  return result;

  async function reply(): Promise<Response> {
    const sys = { role: "system", content: code ? codeSystem(picked.name) : system(picked.name, picked.style) };
    // Whole files need room: Kepler Code gets a bigger reply budget (thinking engines count their reasoning in it).
    const budget = (e: { effort?: string; tokens: number }) => (code ? Math.max(e.tokens, e.effort ? 16384 : 8192) : e.tokens);
    const MISSING = /model_not_found|does not exist|decommissioned|no longer supported|not found|unknown model/i;
    const groq = (payload: Record<string, unknown>) =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, messages: [sys, ...messages] }),
      });

    // Try one engine: first with its tuned settings, then (if Groq refuses a setting) with plain ones.
    // Returns a Response to send back, "next" to try another engine, or "missing" if the model is gone.
    async function attempt(id: string, tuned: Record<string, unknown>): Promise<Response | "next" | "missing"> {
      const payloads = Object.keys(tuned).length ? [{ model: id, ...tuned }, { model: id }] : [{ model: id }];
      for (const payload of payloads) {
        const res = await groq(payload);
        if (res.ok) {
          const data = await res.json();
          const reply = data?.choices?.[0]?.message?.content ?? "";
          if (reply.trim()) return json({ reply, remaining, limit: DAILY_LIMIT }, 200, origin);
          console.error(`groq ${id}: empty reply`, JSON.stringify(payload).slice(0, 120));
          continue;
        }
        const text = await res.text();
        console.error(`groq ${id} ${res.status}: ${text.slice(0, 400)}`);
        if (res.status === 401) {
          console.error("Groq rejected the key: check the GROQ_API_KEY secret");
          return json({ error: "Kepler AI is not available right now. Try again later." }, 502, origin);
        }
        if (res.status === 429) return json({ error: "Too many messages. Wait a moment and try again." }, 429, origin);
        if ((res.status === 404 || res.status === 400) && MISSING.test(text)) return "missing";
        if (res.status >= 500) return "next";
        // Other 400s: Groq refused a setting; loop retries with plain settings.
      }
      return "next";
    }

    const tried = new Set<string>();
    const gone = new Set<string>();
    for (const eng of picked.chain) {
      const k = eng.id + (eng.effort ?? "");
      if (gone.has(eng.id) || tried.has(k)) continue;
      tried.add(k);
      const out = await attempt(eng.id, { max_tokens: budget(eng), ...(eng.effort ? { reasoning_effort: eng.effort } : {}) });
      if (out === "missing") { gone.add(eng.id); continue; }
      if (out !== "next") return out;
    }

    // Last resort: ask Groq which models this key can use and try a sensible one.
    try {
      const list = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      if (list.ok) {
        const ids: string[] = ((await list.json())?.data ?? []).map((m: { id: string }) => m.id)
          .filter((id: string) => !/whisper|tts|guard|playai|orpheus|prompt-guard|compound/i.test(id) && !gone.has(id));
        const prefer = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
        ids.sort((a, b) => (prefer.indexOf(a) + 1 || 99) - (prefer.indexOf(b) + 1 || 99));
        for (const id of ids.slice(0, 4)) {
          const out = await attempt(id, {});
          if (out instanceof Response) return out;
        }
      } else {
        console.error(`groq models ${list.status}: ${(await list.text()).slice(0, 300)}`);
      }
    } catch (e) {
      console.error("groq models list failed", String(e));
    }

    return json({ error: "No Groq model is available right now." }, 502, origin);
  }
});
