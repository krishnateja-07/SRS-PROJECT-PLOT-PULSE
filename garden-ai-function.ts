// Garden AI edge function: the only place the Gemini key is used.
// Actions: status | recommend | health | chat
// When GEMINI_API_KEY is not set, it answers { demo: true } and the app shows labeled demo results.
//
// Observability and robustness:
// - every request gets a request id (returned as the x-request-id header and in error bodies)
// - one structured JSON log line per request (visible in Supabase → Edge Functions → Logs)
// - one row per request in public.garden_function_logs (service role only; aggregated by garden_ai_stats())
// - per-client rate limit, request-size limits and a timeout on the Gemini call
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const RATE_LIMIT_PER_MIN = Number(Deno.env.get("GARDEN_AI_RATE_LIMIT") ?? 20);
const MAX_BODY_BYTES = 8_000_000;   // a 1024px JPEG is far smaller; this stops abuse
const GEMINI_TIMEOUT_MS = 25_000;
const ACTIONS = new Set(["status", "recommend", "health", "chat"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-request-id",
};

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const SYSTEM = `You are Garden AI, a practical assistant inside a community garden planning app.
Give concrete, safe, organic-first gardening advice suited to the user's region and season.
Be honest about uncertainty. Never claim to diagnose with certainty from a photo.`;

type Part = { text?: string; inline_data?: { mime_type: string; data: string } };
type Content = { role: "user" | "model"; parts: Part[] };

async function gemini(contents: Content[], schema?: unknown, temperature = 0.6) {
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { temperature, ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}) },
  };
  let r: Response;
  try {
    r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) throw new HttpError(504, "The AI service took too long to answer. Please try again.");
    throw new HttpError(502, "Could not reach the AI service.");
  }
  if (r.status === 429) throw new HttpError(503, "The AI service is busy right now. Please try again in a minute.");
  if (!r.ok) throw new HttpError(502, `AI service error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: Part) => p.text ?? "").join("") ?? "";
  if (!text) throw new HttpError(502, "The model returned no content (it may have been blocked by safety filters).");
  return text;
}

function parseJson(text: string) {
  try { return JSON.parse(text); } catch { throw new HttpError(502, "The AI returned an unreadable answer. Please try again."); }
}

const S = (description: string) => ({ type: "STRING", description });

const RECOMMEND_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: S("One or two sentences summarising the plan"),
    recommendations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: S("Plant name"),
          category: S("One of Vegetable, Leafy green, Root, Herb, Fruit, Legume, Grain, Flower"),
          why: S("Why it suits these conditions"),
          planting_period: S("When to sow or plant"),
          growth_duration: S("Typical time to first harvest"),
          watering: S("Watering guidance"),
          sunlight: S("Sunlight requirement"),
          soil: S("Soil preference"),
          recommended_bed: S("Code of the best free bed from the list, or 'Any free bed'"),
          days_to_harvest: { type: "INTEGER", description: "Approximate days from sowing to first harvest" },
        },
        required: ["name", "category", "why", "planting_period", "growth_duration", "watering", "sunlight", "soil", "recommended_bed", "days_to_harvest"],
      },
    },
  },
  required: ["summary", "recommendations"],
};

const HEALTH_SCHEMA = {
  type: "OBJECT",
  properties: {
    plant_guess: S("Likely plant type, or 'Unclear'"),
    overall: S("Short overall impression, e.g. 'Mostly healthy with mild yellowing'"),
    image_quality: S("Whether the photo is clear enough to judge, and what would help"),
    observations: { type: "ARRAY", items: S("A visible sign seen in the image") },
    possible_causes: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { name: S("Possible cause"), explanation: S("Why this fits what is visible") }, required: ["name", "explanation"] },
    },
    care_steps: { type: "ARRAY", items: S("A general, safe care step") },
    see_expert_if: S("When to consult a local extension officer or expert"),
  },
  required: ["plant_guess", "overall", "image_quality", "observations", "possible_causes", "care_steps", "see_expert_if"],
};

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

/* ------------------------------ monitoring ------------------------------ */
async function clientHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const salt = SB_SERVICE.slice(-16); // never logged; makes the hash useless outside this project
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ip));
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

async function recentCalls(hash: string) {
  if (!SB_URL || !SB_SERVICE) return 0;
  const since = new Date(Date.now() - 60_000).toISOString();
  const r = await rest(`garden_function_logs?select=id&client_hash=eq.${hash}&at=gte.${encodeURIComponent(since)}&action=neq.status`, {
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const total = Number((r.headers.get("content-range") ?? "*/0").split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

async function record(row: Record<string, unknown>) {
  console.log(JSON.stringify({ level: Number(row.status) >= 500 ? "error" : "info", fn: "garden-ai", ...row, client_hash: undefined }));
  if (!SB_URL || !SB_SERVICE) return;
  try {
    await rest("garden_function_logs", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } });
    if (Math.random() < 0.02) await rest("rpc/garden_prune_function_logs", { method: "POST", body: "{}" });
  } catch (e) {
    console.log(JSON.stringify({ level: "warn", fn: "garden-ai", msg: "could not write log row", error: String(e) }));
  }
}

/* ------------------------------ handler ------------------------------ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const requestId = crypto.randomUUID();
  const started = performance.now();
  const hash = await clientHash(req);
  let action = "unknown";
  let demo = false;

  const respond = async (body: unknown, status = 200, error?: string) => {
    await record({
      request_id: requestId, action, status, demo, error: error ? error.slice(0, 500) : null,
      model: KEY ? MODEL : null, duration_ms: Math.round(performance.now() - started), client_hash: hash,
    });
    return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "x-request-id": requestId } });
  };
  const fail = (status: number, message: string) => respond({ error: message, request_id: requestId }, status, message);

  try {
    if (req.method !== "POST") return await fail(405, "Use POST");
    const size = Number(req.headers.get("content-length") ?? 0);
    if (size > MAX_BODY_BYTES) return await fail(413, "Request too large");

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return await fail(400, "Invalid JSON body"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return await fail(400, "Body must be a JSON object");

    const asked = str(body.action, 20);
    if (!ACTIONS.has(asked)) { action = "invalid"; return await fail(400, "Unknown action. Use status, recommend, health or chat."); }
    action = asked;

    if (action === "status") return await respond({ configured: Boolean(KEY), model: KEY ? MODEL : null });

    if (await recentCalls(hash) >= RATE_LIMIT_PER_MIN) {
      return await fail(429, `Too many AI requests. Please wait a minute (limit ${RATE_LIMIT_PER_MIN} per minute).`);
    }
    if (!KEY) { demo = true; return await respond({ demo: true }); }

    if (action === "recommend") {
      const f = (body.inputs && typeof body.inputs === "object" ? body.inputs : {}) as Record<string, unknown>;
      const beds = Array.isArray(body.beds) ? body.beds.slice(0, 40) : [];
      const space = Number(f.space);
      if (!Number.isFinite(space) || space <= 0 || space > 100000) return await fail(400, "Available space must be a positive number of square metres.");
      const prompt = `Recommend 4 to 6 plants for a community garden.
Location / region: ${str(f.location, 80) || "not given"}
Season: ${str(f.season, 20)}
Soil type: ${str(f.soil, 30)}
Available space: ${space} square metres
Sunlight: ${str(f.sunlight, 60)}
Water availability: ${str(f.water, 60)}
Garden beds (code, soil, area m², free or occupied): ${JSON.stringify(beds).slice(0, 4000)}
Prefer beds that are free and match the soil. Keep each field short and practical.`;
      const text = await gemini([{ role: "user", parts: [{ text: prompt }] }], RECOMMEND_SCHEMA, 0.5);
      return await respond({ demo: false, model: MODEL, ...parseJson(text) });
    }

    if (action === "health") {
      const image = String(body.image ?? ""), mime = str(body.mime, 30) || "image/jpeg";
      if (!image) return await fail(400, "No image provided");
      if (!/^image\/(jpeg|png|webp)$/.test(mime)) return await fail(415, "Only JPEG, PNG or WebP images are supported");
      if (image.length > 7_000_000) return await fail(413, "Image too large");
      if (!/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 2000))) return await fail(400, "Image must be base64-encoded");
      const plant = str(body.plant, 60), notes = str(body.notes, 400);
      const prompt = `Look at this plant leaf photo${plant ? ` (the gardener says it is ${plant})` : ""}.
${notes ? `Gardener's notes: ${notes}` : ""}
Describe only what is visible: signs of stress, pests, nutrient issues or disease. List possible causes, not a diagnosis.
Suggest general, safe care steps. If the photo is unclear or not a plant, say so in image_quality and keep lists short.`;
      const text = await gemini([{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: prompt }] }], HEALTH_SCHEMA, 0.3);
      // Gemini does not return a calibrated confidence score, so none is passed on.
      return await respond({ demo: false, model: MODEL, confidence: null, ...parseJson(text) });
    }

    // chat
    const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-16) as { role: string; content: string }[];
    if (!msgs.length) return await fail(400, "No messages");
    const context = body.context ? `Current garden data (for reference): ${JSON.stringify(body.context).slice(0, 4000)}` : "";
    const contents: Content[] = msgs.map((m) => ({ role: m?.role === "assistant" ? "model" : "user", parts: [{ text: str(m?.content, 4000) }] }));
    if (context) contents[0].parts.unshift({ text: context });
    const text = await gemini(contents, undefined, 0.7);
    return await respond({ demo: false, model: MODEL, reply: text });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof HttpError ? e.message : "Unexpected server error";
    if (!(e instanceof HttpError)) console.log(JSON.stringify({ level: "error", fn: "garden-ai", request_id: requestId, stack: String(e) }));
    return await fail(status, message);
  }
});
