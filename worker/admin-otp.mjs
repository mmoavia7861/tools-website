/**
 * ToolsCresta owner-only email OTP second step.
 *
 * The browser cannot authorize itself: an authenticated and freshly signed-in
 * Firebase password ID token is verified here before any email is issued.
 * Only after a correct one-time email code does the Worker mint a Firebase
 * custom token (same UID) with toolscresta_otp=true. Firestore Rules MUST
 * require this claim and the "custom" sign-in provider for admin resources.
 *
 * Secrets (Cloudflare Worker runtime only):
 * RESEND_API_KEY, OTP_FROM_EMAIL, OTP_HASH_SECRET,
 * FIREBASE_SERVICE_ACCOUNT_EMAIL, FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.
 * Requires ADMIN_OTP Durable Object namespace binding.
 */
const OWNER = "moaviah760@gmail.com";
const PROJECT_ID = "gen-lang-client-0295520231";
const GOOGLE_ID_TOKEN_KEYS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CUSTOM_TOKEN_AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
const MAX_CODE_AGE_MS = 5 * 60 * 1000;
const FRESH_LOGIN_SECONDS = 10 * 60;
const MAX_BODY_BYTES = 2048;

function output(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
function failed(message, status = 400, errorCode) {
  return output(status, { success: false, error: message, ...(errorCode ? { errorCode } : {}) });
}

// Return only the *names* of missing runtime bindings. NEVER expose secrets.
function otpMissingConfiguration(env) {
  const checks = {
    ADMIN_OTP: typeof env.ADMIN_OTP?.idFromName === "function" && typeof env.ADMIN_OTP?.get === "function",
    RESEND_API_KEY: typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.length > 10,
    OTP_FROM_EMAIL: typeof env.OTP_FROM_EMAIL === "string" && /^[^@\s]+@toolscresta\.com$/i.test(env.OTP_FROM_EMAIL),
    OTP_HASH_SECRET: typeof env.OTP_HASH_SECRET === "string" && env.OTP_HASH_SECRET.length >= 32,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: typeof env.FIREBASE_SERVICE_ACCOUNT_EMAIL === "string",
    FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: typeof env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY === "string"
  };
  return Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
}
export function otpConfigured(env) {
  return otpMissingConfiguration(env).length === 0;
}
function b64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("Invalid JWT base64url");
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function jwtPart(obj) { return b64urlEncode(new TextEncoder().encode(JSON.stringify(obj))); }

export async function verifyFirebasePasswordIdToken(idToken, options = {}) {
  if (typeof idToken !== "string" || idToken.length > 9000 || idToken.length < 100) return null;
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid ||
      header.crit || header.jku || header.x5u) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== PROJECT_ID || payload.iss !== "https://securetoken.google.com/" + PROJECT_ID ||
      typeof payload.sub !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.sub) ||
      payload.email !== OWNER || payload.email_verified !== true ||
      payload.firebase?.sign_in_provider !== "password" ||
      !Number.isInteger(payload.auth_time) || payload.auth_time > now + 30 ||
      payload.auth_time < now - FRESH_LOGIN_SECONDS ||
      !Number.isInteger(payload.exp) || payload.exp <= now ||
      !Number.isInteger(payload.iat) || payload.iat > now + 30 ||
      payload.iat > payload.exp) return null;

    // Cloudflare Workers does not support redirect="error".
    // Use manual mode and never follow unexpected Google key redirects.
    const keyResponse = await (options.fetchImpl || fetch)(GOOGLE_ID_TOKEN_KEYS, { redirect: "manual" });
    if (!keyResponse.ok || keyResponse.status >= 300) return null;
    const keySet = await keyResponse.json();
    const key = keySet.keys?.find(key => key.kid === header.kid && key.kty === "RSA" &&
      (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"));
    if (!key) return null;
    const verifier = await crypto.subtle.importKey("jwk", key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", verifier,
      b64urlDecode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    return verified ? { uid: payload.sub, authTime: payload.auth_time } : null;
  } catch { return null; }
}

function randomOtp() {
  // Use rejection sampling (not Math.random) to avoid modulo bias.
  const bytes = new Uint32Array(1);
  const max = Math.floor(0x100000000 / 1000000) * 1000000;
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= max);
  return String(bytes[0] % 1000000).padStart(6, "0");
}
async function digestOtp(secret, uid, authTime, otp) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", material,
    new TextEncoder().encode(uid + ":" + authTime + ":" + otp));
  return b64urlEncode(digest);
}
function timingSafeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

export class AdminOtpState {
  constructor(state) { this.state = state; }

  async fetch(request) {
    if (request.method !== "POST") return failed("Not allowed.", 405);
    let input;
    try { input = await request.json(); } catch { return failed("Invalid request."); }
    const now = Date.now();
    return this.state.blockConcurrencyWhile(async () => {
      const storage = this.state.storage;
      const action = input.action;
      if (action === "issue") {
        if (!/^[A-Za-z0-9_-]{40,60}$/.test(input.hash || "")) return failed("Invalid challenge.");
        const lockedUntil = await storage.get("lockedUntil") || 0;
        if (lockedUntil > now) return failed("Too many code attempts. Try later.", 429);
        const sent = (await storage.get("sendHistory") || []).filter(t => t > now - 3600000);
        if (sent.length >= 5 || (sent.length && now - sent[sent.length - 1] < 60000)) {
          return failed("Please wait before requesting another code.", 429);
        }
        // Store a hash, never the code. One active challenge per owner/session.
        await storage.put("sendHistory", [...sent, now]);
        const expiresAt = now + MAX_CODE_AGE_MS;
        await storage.put("challenge", { hash: input.hash, authTime: input.authTime,
          uid: input.uid, attempts: 0, expiresAt });
        return output(200, { success: true, expiresAt });
      }
      if (action === "consume") {
        const lockedUntil = await storage.get("lockedUntil") || 0;
        if (lockedUntil > now) return failed("Too many code attempts. Try later.", 429);
        const challenge = await storage.get("challenge");
        if (!challenge) return failed("No active verification code for this login. Request a new code.", 403, "CODE_UNAVAILABLE");
        if (challenge.expiresAt <= now) {
          await storage.delete("challenge");
          return failed("This verification code has expired. Request a new code.", 403, "CODE_EXPIRED");
        }
        if (challenge.authTime !== input.authTime || challenge.uid !== input.uid)
          return failed("Your password session changed. Sign in again to request a fresh code.", 403, "SESSION_CHANGED");
        if (challenge.attempts >= 5) return failed("Too many code attempts.", 429, "CODE_LOCKED");
        if (!timingSafeEqual(challenge.hash, input.hash)) {
          challenge.attempts += 1;
          if (challenge.attempts >= 5) {
            await storage.delete("challenge");
            await storage.put("lockedUntil", now + 15 * 60 * 1000);
          } else await storage.put("challenge", challenge);
          return failed("Invalid verification code.", 403, "CODE_INVALID");
        }
        await storage.delete("challenge");
        return output(200, { success: true });
      }
      if (action === "cancel") {
        const challenge = await storage.get("challenge");
        if (challenge && challenge.authTime === input.authTime && challenge.uid === input.uid)
          await storage.delete("challenge");
        return output(200, { success: true });
      }
      return failed("Unknown operation.", 400);
    });
  }
}

async function stateCall(env, uid, action, fields) {
  const id = env.ADMIN_OTP.idFromName("toolscresta-owner-otp-" + uid);
  const state = env.ADMIN_OTP.get(id);
  const response = await state.fetch("https://admin-otp-internal/command", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, uid, ...fields }),
  });
  return { status: response.status, body: await response.json() };
}

export async function mintOtpVerifiedCustomToken(env, uid) {
  const account = env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  const keyText = env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
  if (!account.endsWith(".gserviceaccount.com") || !keyText.includes("BEGIN PRIVATE KEY")) throw new Error("Signing key unavailable");
  const now = Math.floor(Date.now() / 1000);
  const header = jwtPart({ alg: "RS256", typ: "JWT" });
  const body = jwtPart({
    iss: account, sub: account, aud: CUSTOM_TOKEN_AUDIENCE,
    iat: now, exp: now + 300, uid,
    claims: { toolscresta_otp: true },
  });
  const encoded = header + "." + body;
  const der = Uint8Array.from(atob(keyText.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey("pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(encoded));
  return encoded + "." + b64urlEncode(signature);
}

async function sendOtpEmail(env, code) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ToolsCresta Security <" + env.OTP_FROM_EMAIL + ">",
      to: [OWNER], subject: "Your ToolsCresta admin verification code",
      text: "Your ToolsCresta admin sign-in code is: " + code +
        "\n\nIt expires in 5 minutes. If you did not request it, change your admin password.",
    }),
    redirect: "manual",
  });
  return response.ok;
}

export async function handleAdminOtp(request, env, path) {
  if (request.method === "GET" && path === "/api/admin/otp/status") {
    const configured = otpConfigured(env);
    // Public status reveals only readiness. A freshly authenticated, verified
    // owner PASSWORD session may also see the missing variable names.
    const bearer = request.headers.get("Authorization") || "";
    if (configured || !bearer.startsWith("Bearer ")) {
      return output(200, { success: true, configured });
    }
    const principal = await verifyFirebasePasswordIdToken(bearer.slice(7));
    if (!principal) return output(200, { success: true, configured });
    return output(200, { success: true, configured, missing: otpMissingConfiguration(env) });
  }

  if (request.method !== "POST") return failed("Unsupported method.", 405);
  if (!otpConfigured(env)) return failed("Email verification is not configured by the site administrator.", 503);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if ((origin && origin !== new URL(request.url).origin) ||
      (!origin && fetchSite && fetchSite !== "same-origin" && fetchSite !== "none"))
    return failed("Same-origin requests only.", 403);
  const size = Number(request.headers.get("Content-Length") || "0");
  if (size > MAX_BODY_BYTES) return failed("Invalid request.", 413);
  let body;
  try {
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) return failed("Expected JSON.", 415);
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return failed("Invalid request.", 413);
    body = JSON.parse(text);
  } catch { return failed("Invalid request."); }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return failed("Sign in with Gmail and password first.", 401);
  const principal = await verifyFirebasePasswordIdToken(authorization.slice(7));
  if (!principal) return failed("Fresh verified owner password session required.", 403);
  if (!["/api/admin/otp/send", "/api/admin/otp/verify"].includes(path)) return failed("Not found.", 404);
  if (path === "/api/admin/otp/send") {
    const code = randomOtp();
    const hash = await digestOtp(env.OTP_HASH_SECRET, principal.uid, principal.authTime, code);
    const issued = await stateCall(env, principal.uid, "issue", { hash, authTime: principal.authTime });
    if (!issued.body.success) return failed(issued.body.error, issued.status);
    let sent = false;
    try { sent = await sendOtpEmail(env, code); } catch { /* Sanitized below. */ }
    if (!sent) {
      await stateCall(env, principal.uid, "cancel", { authTime: principal.authTime });
      return failed("Email service could not send the code. Check the verified sender domain and provider configuration.", 502);
    }
    return output(200, {
      success: true,
      message: "Verification code sent to the authorized Gmail address.",
      expiresAt: issued.body.expiresAt
    });
  }
  if (!/^\d{6}$/.test(body.code || "")) return failed("Enter the six-digit verification code.");
  // Prepare the signed session BEFORE consuming the one-time code. A malformed
  // or unavailable signing key must never burn a valid OTP and leave the owner
  // with a misleading "code expired" error on retry. Signing alone grants
  // nothing: the token is returned ONLY after the one-time code is consumed.
  let customToken;
  try {
    customToken = await mintOtpVerifiedCustomToken(env, principal.uid);
  } catch {
    return failed("Admin token signing is unavailable. Check the Firebase service account configuration. Your email code was not consumed.", 503, "SIGNING_UNAVAILABLE");
  }
  const hash = await digestOtp(env.OTP_HASH_SECRET, principal.uid, principal.authTime, body.code);
  const verified = await stateCall(env, principal.uid, "consume", { hash, authTime: principal.authTime });
  if (!verified.body.success) return failed(verified.body.error, verified.status, verified.body.errorCode);
  return output(200, { success: true, customToken });
}
