/**
 * ToolsCresta API gateway: same-origin Cloudflare Worker.
 * Secrets are Worker bindings, never client-side build variables.
 * All protected requests are validated with Cloudflare Turnstile Siteverify.
 */
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 12 * 1024;
const MAX_ADOBE_WAIT_MS = 90000;
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
    workersAi: Boolean(env.AI && typeof env.AI.run === "function"),
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
  try {
    // Cloudflare Workers does not implement Request.redirect="error".
    // Use manual redirects and reject 3xx responses without following them.
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      throw new Error("Unexpected upstream redirect blocked");
    }
    return response;
  } finally { clearTimeout(timeout); }
}
async function verifyTurnstile(request, env, token) {
  // Keep the private secret exclusively on the server. Return actionable
  // sanitized errors instead of treating an invalid secret as an expired token.
  if (!env.TURNSTILE_SECRET) {
    return { ok: false, status: 503, message: "Turnstile server Secret Key is missing. Configure TURNSTILE_SECRET in Worker Runtime Secrets." };
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    return { ok: false, status: 403, message: "Verification token missing or invalid. Complete a fresh challenge." };
  }
  try {
    const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) params.set("remoteip", ip);
    const res = await fetchTimed("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params,
    });
    if (!res.ok) return { ok: false, status: 502, message: "Turnstile verification service unavailable. Please retry." };
    const result = await res.json();
    if (result.success !== true) {
      const codes = Array.isArray(result["error-codes"]) ? result["error-codes"] : [];
      if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
        return { ok: false, status: 503, message: "Cloudflare Turnstile server Secret Key is incorrect. Replace TURNSTILE_SECRET with the private Secret Key from your ToolsCresta Turnstile widget." };
      }
      if (codes.includes("timeout-or-duplicate")) {
        return { ok: false, status: 403, message: "Verification expired or already used. Complete a new verification and try again." };
      }
      if (codes.includes("invalid-input-response") || codes.includes("missing-input-response")) {
        return { ok: false, status: 403, message: "Verification token rejected. Refresh verification and try again." };
      }
      return { ok: false, status: 403, message: "Cloudflare verification failed. Please complete a new challenge." };
    }
    const requestHost = new URL(request.url).hostname;
    if (result.hostname !== requestHost) {
      return { ok: false, status: 403, message: "Verification hostname mismatch. Allow the exact site hostname in your Cloudflare Turnstile widget." };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, message: "Could not reach Turnstile verification. Please retry." };
  }
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
// Never relay raw Google errors: they may include provider internals.
// Keep actionable HTTP categories and safe error summaries for the UI.
// Classify provider failures without exposing upstream response bodies or API keys.
async function geminiProviderErrorFromResponse(response, image = false) {
  const status = response.status;
  let providerStatus = "";
  let providerMessage = "";
  if (status === 400 || status === 403) {
    try {
      // Google returns machine-readable status and explanation. Both are untrusted.
      const body = await response.json();
      if (typeof body?.error?.status === "string") providerStatus = body.error.status.slice(0, 70);
      if (typeof body?.error?.message === "string") providerMessage = body.error.message.slice(0, 500);
    } catch { /* Generic message below is enough. */ }
  }
  const label = image ? "Gemini image generation" : "Gemini editable card design";
  const billingBlocked = providerStatus === "FAILED_PRECONDITION" ||
    /free.?tier|billing|paid.?tier|not available in your (country|region)/i.test(providerMessage);
  if (status === 400) {
    if (billingBlocked) return { status: 503, message: image
      ? "Gemini image API requires paid billing on the Google AI Studio project. Enable billing for the project tied to this API key."
      : "Gemini API Free Tier access is restricted for this project or region. Check billing eligibility in Google AI Studio." };
    return { status: 502, message: label + " request rejected by Google (HTTP 400). Please check model access and request configuration." };
  }
  if (status === 401) return { status: 503, message: "Gemini API key is invalid or revoked (Google HTTP 401)." };
  if (status === 403) return { status: 503, message: image
    ? "Gemini image generation is unavailable for this API project (Google HTTP 403). Check paid billing and model access in Google AI Studio."
    : "Gemini model access is denied (Google HTTP 403). Check API key restrictions and project access." };
  if (status === 404) return { status: 503, message: label + " model is unavailable for this API key (Google HTTP 404). Check model access." };
  if (status === 429) return { status: 429, message: image
    ? "Gemini image quota or billing limit reached (Google HTTP 429). Check your project's paid tier and quotas."
    : "Gemini text quota reached (Google HTTP 429). Check your project rate limits." };
  if (status === 408 || status === 504) return { status: 504, message: label + " request timed out at Google. Please try later." };
  if (status >= 500) return { status: 502, message: label + " provider is temporarily unavailable (Google HTTP " + status + ")." };
  return { status: 502, message: label + " provider returned HTTP " + status + ". Please review Google AI Studio API access." };
}
async function gemini(env, contents, asJson = false) {
  const response = await fetchTimed(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: asJson ? 1200 : 600,
          // Card design is a brief structured task; low thinking reduces latency.
          thinkingConfig: { thinkingLevel: "minimal" },
          ...(asJson ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
    45000,
  );
  if (!response.ok) throw await geminiProviderErrorFromResponse(response, false);
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
  const verification = await verifyTurnstile(request, env, body.token);
  if (!verification.ok) return error(verification.message, verification.status);
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
  } catch (e) {
    if (e?.name === "AbortError" || e?.name === "TimeoutError") {
      return error("Gemini took too long to respond. Try again with a shorter prompt.", 504);
    }
    return error(e?.message || "AI provider unavailable.", e?.status || 502);
  }
}

// Generate decorative artwork only: names and contact data are rendered accurately
// by the client canvas, NOT by an image model that can misspell them.
async function handleCloudflareCardBackground(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return error("Cloudflare AI is not enabled. Add the AI binding to the production Worker and deploy.", 503);
  }
  if (!env.TURNSTILE_SECRET) {
    return error("Turnstile server verification is not configured.", 503);
  }
  // Per-isolate throttle (in addition, configure Cloudflare zone-level rate limits).
  if (!limitRequests(request, 2, 60000)) return error("AI background request limit reached. Try again shortly.", 429);
  const body = await jsonInput(request);
  if (!body) return error("Invalid request.", 400);
  const kind = body.kind;
  const prompt = clean(body.prompt, 1500);
  if (!["visiting", "wedding", "birthday"].includes(kind) || prompt.length < 8) {
    return error("Choose a card type and describe its design in at least 8 characters.", 400);
  }
  const verified = await verifyTurnstile(request, env, body.token);
  if (!verified.ok) return error(verified.message, verified.status);
  // Intentionally extract only non-personal style words. User names, contact
  // information, dates and arbitrary text are NOT forwarded to the image model.
  const themes = [
    "blue", "red", "green", "gold", "silver", "black", "white", "pink", "purple",
    "orange", "teal", "navy", "pastel", "colorful", "minimal", "modern", "luxury",
    "elegant", "vintage", "rustic", "floral", "flowers", "roses", "botanical",
    "geometric", "abstract", "watercolor", "marble", "sparkle", "confetti",
    "balloons", "stars", "romantic", "traditional", "festive", "corporate",
    "professional", "nature", "leaves", "gradient", "texture"
  ];
  const lower = prompt.toLowerCase();
  const aesthetic = themes.filter(word => new RegExp("\\b" + word + "\\b", "i").test(lower)).slice(0, 9);
  const design = aesthetic.length ? aesthetic.join(", ") : (kind === "visiting" ? "modern elegant blue geometric" :
    kind === "wedding" ? "elegant floral pastel romantic" : "colorful festive balloons confetti");
  const sizeHint = kind === "visiting" ? "horizontal business card" : "portrait invitation card";
  const imagePrompt = "Create a high-quality seamless printable decorative BACKGROUND for a " + sizeHint +
    ". Style: " + design +
    ". Beautiful refined illustration, subtle professional composition, delicate ornamental details at the edges, clean light central area for readable editable text. " +
    "Flat straight-on digital artwork. NO typography, NO letters, NO words, NO numbers, NO handwriting, NO logos, NO borders, NO mockups, NO watermarks.";
  let result;
  try {
    result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: imagePrompt, steps: 4
    });
  } catch (e) {
    const details = String(e?.message || "");
    if (/quota|neuron|limit|exceeded|429/i.test(details)) {
      return error("Cloudflare AI daily free allowance or rate limit reached. Try again after quota resets.", 429);
    }
    return error("Cloudflare AI could not generate a background right now. Try the free template.", 502);
  }
  if (!result || typeof result.image !== "string" || result.image.length < 100 ||
      result.image.length > 6 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.image)) {
    return error("Cloudflare AI returned an invalid background image.", 502);
  }
  return reply({
    success: true,
    image: "data:image/jpeg;base64," + result.image,
    mimeType: "image/jpeg",
    source: "cloudflare-workers-ai",
  });
}

async function handleImageCard(request, env) {
  if (!env.GEMINI_API_KEY || !env.TURNSTILE_SECRET) return error("Gemini image generation is not configured yet.", 503);
  // Image calls consume paid provider quota. Use an aggressive per-isolate limit,
  // plus a Cloudflare zone-level rate limit before enabling public use.
  if (!limitRequests(request, 2, 60000)) return error("Too many image requests. Try again later.", 429);
  const body = await jsonInput(request);
  if (!body) return error("Invalid request.", 400);
  const verification = await verifyTurnstile(request, env, body.token);
  if (!verification.ok) return error(verification.message, verification.status);
  const kind = body.kind;
  const prompt = clean(body.prompt, 1500);
  if (!["visiting", "wedding", "birthday"].includes(kind) || prompt.length < 8)
    return error("Choose a card type and describe the design in at least 8 characters.", 400);
  const aspectRatio = kind === "visiting" ? "16:9" : "3:4";
  const cardType = kind === "visiting" ? "professional visiting or business card" :
    kind === "wedding" ? "wedding invitation card" : "birthday invitation card";
  const detailedPrompt = "Create ONE professionally designed, printable " + cardType +
    " as a flat, straight-on 2D graphic. Full card visible, no mockup, no hand, no desk, no shadows outside the card. " +
    "The card itself should have an aspect ratio near " + aspectRatio + ". " +
    "Make composition visually attractive with harmonious typography, spacing, decorative artwork and clear hierarchy. " +
    "Use the user's exact names, dates, venue and contact information when provided; DO NOT invent any missing details. " +
    "Make all text legible and correctly spelled; avoid watermarks and brand logos. User request: " + prompt;
  let response;
  try {
    response = await fetchTimed(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
          // Minimal documented GenerateContent payload: the model selects size.
          // Keeping optional format fields out avoids schema/version mismatches.
          generationConfig: { responseModalities: ["IMAGE"] }
        })
      }, 55000
    );
  } catch {
    return error("Gemini image generation timed out. Please try again.", 504);
  }
  if (!response.ok) {
    const failure = await geminiProviderErrorFromResponse(response, true);
    return error(failure.message, failure.status);
  }
  let data;
  try { data = await response.json(); } catch { return error("Gemini image response was invalid.", 502); }
  const output = (data.candidates?.[0]?.content?.parts || []).find(part =>
    part.inlineData && (part.inlineData.mimeType === "image/png" || part.inlineData.mimeType === "image/jpeg")
  )?.inlineData;
  if (!output || typeof output.data !== "string" || output.data.length > 8 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(output.data))
    return error("Gemini did not return a usable card image.", 502);
  return reply({
    success: true,
    image: "data:" + output.mimeType + ";base64," + output.data,
    mimeType: output.mimeType,
  });
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
  if (response.status === 429) throw { status: 429, message: "Adobe PDF Services quota or rate limit reached. Please try again later." };
  if (response.status === 401 || response.status === 403) {
    throw { status: 503, message: "Adobe PDF Services rejected these API credentials or access permissions. Check the Adobe PDF Services project." };
  }
  if (response.status >= 500) throw { status: 502, message: "Adobe PDF Services is temporarily unavailable. Please try again later." };
  if (!response.ok) throw { status: 502, message: "Adobe PDF Services could not process the conversion request. Check the file and operation." };
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
    const verification = await verifyTurnstile(request, env, token);
    if (!verification.ok) return error(verification.message, verification.status);
    const bytes = await file.arrayBuffer();
    const signature = new Uint8Array(bytes.slice(0, 5));
    const isValid = mode === "pdf-to-word"
      ? String.fromCharCode(...signature) === "%PDF-"
      : signature[0] === 0x50 && signature[1] === 0x4b;
    if (!isValid) return error("Invalid file signature. Please upload a real " + ext + " file.");
    const mediaType = mode === "pdf-to-word" ? "application/pdf" : mimeDocx;
    // Whitespace can be introduced when pasting values from Adobe credentials JSON.
    // Preserve both credentials server-side, never return provider body to browsers.
    const client = String(env.ADOBE_CLIENT_ID).trim();
    const clientSecret = String(env.ADOBE_CLIENT_SECRET).trim();
    if (!client || !clientSecret) return error("Adobe PDF Services Client ID or Client Secret is empty. Check Cloudflare runtime secrets.", 503);
    const credentials = new URLSearchParams({ client_id: client, client_secret: clientSecret });
    const tokenResp = await fetchTimed(ADOBE_BASE + "/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: credentials,
    });
    if (!tokenResp.ok) {
      if ([400, 401].includes(tokenResp.status)) {
        return error("Adobe PDF Services refused the Client ID and Client Secret (HTTP " + tokenResp.status + "). Verify both belong to the same PDF Services API credential.", 503);
      }
      if (tokenResp.status === 403) {
        return error("Adobe PDF Services access denied (HTTP 403). Check the Adobe PDF Services API entitlement and credential permissions.", 503);
      }
      if (tokenResp.status === 429) {
        return error("Adobe access token rate limit reached (HTTP 429). Try again later.", 429);
      }
      if (tokenResp.status >= 500) {
        return error("Adobe PDF Services authentication is temporarily unavailable (HTTP " + tokenResp.status + ").", 502);
      }
      return error("Adobe token endpoint rejected the request (HTTP " + tokenResp.status + "). Verify your PDF Services API credentials.", 502);
    }
    const oauth = await tokenResp.json();
    if (!oauth.access_token) return error("Adobe did not issue an access token. Check the PDF Services API credential.", 502);
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
    // Workers Free permits 50 external subrequests per invocation. Poll at most
    // 22 times, preserving room for Siteverify, token, upload and download.
    let polls = 0;
    while (Date.now() < deadline && polls++ < 22) {
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
      // Adobe jobs are asynchronous; fast polling wastes free subrequests.
      await new Promise((resolve) => setTimeout(resolve, 4000));
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
      return reply({ success: true, ...available(env), pdfServerCompression: false });
    }
    if (request.method === "GET" && path === "/api/health") {
      return reply({ success: true, status: "ok", service: "toolscresta-api" });
    }
    if (request.method === "GET" && path === "/api/admin/status") {
      const providers = available(env);
      return reply({ success: true, aiProvider: { name: providers.gemini ? "Gemini" : providers.workersAi ? "Cloudflare Workers AI" : "Not configured", isConfigured: providers.gemini || providers.workersAi }, providers, pdfServerCompression: false });
    }
    if (request.method !== "POST") return error("Unsupported method.", 405);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return error("This API accepts same-origin requests only.", 403);
    if (path === "/api/cards/generate-background") return handleCloudflareCardBackground(request, env);
    if (path === "/api/cards/generate-image") return handleImageCard(request, env);
    if (path === "/api/assistant/chat" || path === "/api/cards/generate") return handleAi(request, env, path);
    if (path === "/api/convert/pdf-to-word" || path === "/api/convert/word-to-pdf")
      return handleAdobe(request, env, path.endsWith("pdf-to-word") ? "pdf-to-word" : "word-to-pdf");
    return error("API endpoint not found.", 404);
  },
};
