/**
 * ToolsCresta API gateway: same-origin Cloudflare Worker.
 * Secrets are Worker bindings, never client-side build variables.
 * All protected requests are validated with Cloudflare Turnstile Siteverify.
 */
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 12 * 1024;
const MAX_ADOBE_WAIT_MS = 90000;
const ORIGIN = "https://toolscresta.com";
const ADOBE_BASE = "https://pdf-services.adobe.io";
const mimeDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const rate = new Map();

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function error(message, status = 400) { return reply({ success: false, error: message }, status); }
function available(env) {
  return {
    gemini: Boolean(env.GEMINI_API_KEY),
    adobe: Boolean(env.ADOBE_CLIENT_ID && env.ADOBE_CLIENT_SECRET),
    turnstile: Boolean(env.TURNSTILE_SECRET),
  };
}
function limitRequests(request, limit, windowMs) {
  // This is a modest per-isolate safeguard, NOT distributed rate limiting.
  // Set Cloudflare's zone-level WAF rate limits before enabling paid APIs.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = ip + ":" + new URL(request.url).pathname;
  const now = Date.now();
  const item = rate.get(key);
  if (!item || now > item.until) { rate.set(key, { count: 1, until: now + windowMs }); return true; }
  if (item.count >= limit) return false;
  item.count++;
  if (rate.size > 5000) rate.clear();
  return true;
}
async function fetchTimed(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal, redirect: "error" }); }
  finally { clearTimeout(timeout); }
}
async function verifyTurnstile(request, env, token) {
  if (!env.TURNSTILE_SECRET || typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  try {
    const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) params.set("remoteip", ip);
    const res = await fetchTimed("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true && data.hostname === "toolscresta.com";
  } catch { return false; }
}
async function jsonInput(request) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return null;
  const size = Number(request.headers.get("Content-Length") || "0");
  if (size > MAX_JSON_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) return null;
  try { const data = JSON.parse(text); return data && typeof data === "object" && !Array.isArray(data) ? data : null; }
  catch { return null; }
}
async function gemini(env, contents, asJson = false) {
  const response = await fetchTimed(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: asJson ? 1200 : 600,
          temperature: asJson ? 0.3 : 0.5,
          ...(asJson ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
    25000,
  );
  if (!response.ok) {
    if (response.status === 429) throw { status: 429, message: "Gemini quota or rate limit reached. Please try later." };
    if ([401, 403].includes(response.status)) throw { status: 503, message: "Gemini credentials or access are not valid." };
    throw { status: 502, message: "Gemini provider request failed." };
  }
  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw { status: 502, message: "Gemini returned no usable response." };
  return text;
}
function clean(value, length = 130) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, length) : "";
}
function validateCard(data, kind) {
  const defaults = kind === "wedding" ? ["#6C284A", "#C78C96", "#FFF5F7", "floral", "serif"]
    : kind === "birthday" ? ["#4A2688", "#FB7B67", "#FFF8EF", "playful", "sans"]
    : ["#123D78", "#3A94EA", "#EFF7FF", "modern", "sans"];
  const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(String(v)) ? v : d;
  const record = { kind };
  for (const [key, max] of Object.entries({
    headline: 90, subheading: 110, organization: 90, message: 180,
    date: 60, time: 60, venue: 120, contact: 90, email: 110, website: 100, rsvp: 110,
  })) record[key] = clean(data[key], max);
  record.primary = hex(data.primary, defaults[0]);
  record.accent = hex(data.accent, defaults[1]);
  record.background = hex(data.background, defaults[2]);
  record.style = ["modern", "classic", "floral", "playful"].includes(data.style) ? data.style : defaults[3];
  record.font = ["sans", "serif"].includes(data.font) ? data.font : defaults[4];
  record.imageData = "";
  return record;
}
async function handleAi(request, env, path) {
  if (!env.GEMINI_API_KEY || !env.TURNSTILE_SECRET) return error("Gemini and security verification are not configured yet.", 503);
  if (!limitRequests(request, 5, 60000)) return error("Please slow down and try again.", 429);
  const body = await jsonInput(request);
  if (!body) return error("Invalid request.");
  if (!await verifyTurnstile(request, env, body.token)) return error("Verification expired or invalid. Please try again.", 403);
  try {
    if (path === "/api/assistant/chat") {
      const message = clean(body.message, 900);
      if (!message) return error("Please enter a question.");
      const history = Array.isArray(body.history) ? body.history.slice(-6).map((entry) => ({
        role: entry?.role === "model" ? "model" : "user",
        parts: [{ text: clean(entry?.text, 350) }],
      })).filter((entry) => entry.parts[0].text) : [];
      const prompt = "You are ToolsCresta's helpful assistant. Explain its PDF, QR, image, and card tools accurately and concisely in the user's language. Do not pretend to convert files, perform actions, or have access to private user data. If unsure, say so. User question: " + message;
      const text = await gemini(env, [...history, { role: "user", parts: [{ text: prompt }] }]);
      return reply({ success: true, reply: clean(text, 1300) });
    }
    const kind = body.kind;
    const prompt = clean(body.prompt, 1500);
    if (!["visiting", "wedding", "birthday"].includes(kind) || prompt.length < 8) return error("Invalid card type or prompt.");
    const instruction = "You are a design assistant. Produce a single valid JSON object (no markdown) for a " + kind +
      " card using ONLY details provided by the user. Do not invent names, dates, addresses or contact information. " +
      "Keys: headline, subheading, organization, message, date, time, venue, contact, email, website, rsvp, " +
      "primary, accent, background (valid 6-digit hex colors), style (modern|classic|floral|playful), font (sans|serif). " +
      "Missing details should be empty strings. User prompt: " + prompt;
    const text = await gemini(env, [{ role: "user", parts: [{ text: instruction }] }], true);
    let generated;
    try { generated = JSON.parse(text); } catch { return error("Gemini returned an invalid card design. Please try again.", 502); }
    if (!generated || typeof generated !== "object" || Array.isArray(generated)) return error("Gemini response is not valid.", 502);
    return reply({ success: true, design: validateCard(generated, kind) });
  } catch (e) { return error(e?.message || "AI provider unavailable.", e?.status || 502); }
}
function safeAdobeApiUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === "https:" && u.hostname === "pdf-services.adobe.io" &&
      u.pathname.startsWith("/operation/") && !u.username && !u.password;
  } catch { return false; }
}
function safeAdobeStorageUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === "https:" && /^dcplatformstorageservice-prod-[a-z0-9-]+\.s3(?:-accelerate)?\.amazonaws\.com$/i.test(u.hostname) &&
      !u.username && !u.password;
  } catch { return false; }
}
async function adobeJSON(url, options, clientId, accessToken, timeout = 12000) {
  const response = await fetchTimed(url, {
    ...options,
    headers: { "x-api-key": clientId, Authorization: "Bearer " + accessToken,
      ...(options.headers || {}) },
  }, timeout);
  if (response.status === 429) throw { status: 429, message: "Adobe conversion quota reached. Please retry later." };
  if (!response.ok) throw { status: 502, message: "Adobe PDF Services rejected a conversion request." };
  return response;
}
async function handleAdobe(request, env, mode) {
  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET || !env.TURNSTILE_SECRET) return error("Adobe PDF Services is not configured yet.", 503);
  if (!limitRequests(request, 2, 60000)) return error("Conversion limit reached. Try again shortly.", 429);
  const len = Number(request.headers.get("Content-Length") || "0");
  if (len > MAX_PDF_BYTES + 50000) return error("File exceeds the 10 MB limit.", 413);
  if (!(request.headers.get("Content-Type") || "").startsWith("multipart/form-data")) return error("Expected a file upload.");
  try {
    const form = await request.formData();
    const file = form.get("file");
    const token = form.get("turnstileToken");
    if (!(file instanceof File) || !file.size || file.size > MAX_PDF_BYTES) return error("Upload a document smaller than 10 MB.", 413);
    const ext = mode === "pdf-to-word" ? ".pdf" : ".docx";
    if (!file.name.toLowerCase().endsWith(ext)) return error("Incorrect document extension.");
    if (!await verifyTurnstile(request, env, token)) return error("Verification failed or expired.", 403);
    const bytes = await file.arrayBuffer();
    const signature = new Uint8Array(bytes.slice(0, 5));
    const isValid = mode === "pdf-to-word"
      ? String.fromCharCode(...signature) === "%PDF-"
      : signature[0] === 0x50 && signature[1] === 0x4b;
    if (!isValid) return error("Invalid file signature. Please upload a real " + ext + " file.");
    const mediaType = mode === "pdf-to-word" ? "application/pdf" : mimeDocx;
    const credentials = new URLSearchParams({ client_id: env.ADOBE_CLIENT_ID, client_secret: env.ADOBE_CLIENT_SECRET });
    const tokenResp = await fetchTimed(ADOBE_BASE + "/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: credentials,
    });
    if (!tokenResp.ok) return error("Adobe credentials or subscription are not valid.", 503);
    const oauth = await tokenResp.json();
    if (!oauth.access_token) return error("Adobe did not issue an access token.", 502);
    const client = env.ADOBE_CLIENT_ID;
    const auth = oauth.access_token;
    const createAsset = await adobeJSON(ADOBE_BASE + "/assets", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaType }),
    }, client, auth);
    const asset = await createAsset.json();
    if (!asset.assetID || !safeAdobeStorageUrl(asset.uploadUri)) return error("Adobe provided an unexpected upload location.", 502);
    const uploaded = await fetchTimed(asset.uploadUri, {
      method: "PUT", headers: { "Content-Type": mediaType }, body: bytes,
    }, 30000);
    if (!uploaded.ok) return error("Adobe file upload failed.", 502);
    const op = mode === "pdf-to-word" ? "exportpdf" : "createpdf";
    const job = await adobeJSON(ADOBE_BASE + "/operation/" + op, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "pdf-to-word"
        ? { assetID: asset.assetID, targetFormat: "docx" }
        : { assetID: asset.assetID }),
    }, client, auth);
    const location = job.headers.get("location");
    if (!safeAdobeApiUrl(location)) return error("Adobe returned an invalid job location.", 502);
    const deadline = Date.now() + MAX_ADOBE_WAIT_MS;
    while (Date.now() < deadline) {
      const response = await adobeJSON(location, { method: "GET" }, client, auth);
      const status = await response.json();
      if (status.status === "failed") return error("Adobe could not convert this document.", 422);
      if (status.status === "done") {
        const uri = status.asset?.downloadUri || status.result?.asset?.downloadUri ||
          status.downloadUri || status.result?.downloadUri;
        if (!safeAdobeStorageUrl(uri)) return error("Adobe returned an unexpected download location.", 502);
        const downloaded = await fetchTimed(uri, { method: "GET" }, 25000);
        if (!downloaded.ok || !downloaded.body) return error("Adobe converted the document but download failed.", 502);
        const type = mode === "pdf-to-word" ? mimeDocx : "application/pdf";
        const name = mode === "pdf-to-word" ? "converted.docx" : "converted.pdf";
        return new Response(downloaded.body, {
          status: 200,
          headers: {
            "Content-Type": type, "Content-Disposition": "attachment; filename=\"" + name + "\"",
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
          },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return error("Adobe conversion is still processing. Please try again later.", 504);
  } catch (e) { return error(e?.message || "Adobe service unavailable.", e?.status || 502); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    if (request.method === "GET" && path === "/api/integrations/status") {
      return reply({ success: true, ...available(env) });
    }
    if (request.method !== "POST") return error("Unsupported method.", 405);
    const origin = request.headers.get("Origin");
    if (origin && origin !== ORIGIN) return error("This API accepts same-origin requests only.", 403);
    if (path === "/api/assistant/chat" || path === "/api/cards/generate") return handleAi(request, env, path);
    if (path === "/api/convert/pdf-to-word" || path === "/api/convert/word-to-pdf")
      return handleAdobe(request, env, path.endsWith("pdf-to-word") ? "pdf-to-word" : "word-to-pdf");
    return error("API endpoint not found.", 404);
  },
};
