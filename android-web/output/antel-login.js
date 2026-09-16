const crypto = require("crypto");

const CLIENT_ID = "veratv-beta";
const REDIRECT_URI = "https://tv.vera.com.uy/";
const OIDC_AUTHORIZE_URL = "https://login.vera.com.uy/oidc/authorize";
const DOMINIO = "lua";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = request.body || {};
  const usuario = String(body.usuario || process.env.ANTEL_USER || "").trim();
  const password = String(body.password || process.env.ANTEL_PASS || "");
  if (!usuario || !password) {
    response.status(400).json({ error: "credentials_required", detail: "Ingresa tu usuario y contraseña de Antel TV." });
    return;
  }
  try {
    const jar = new CookieJar();
    const authorizeResponse = await jar.fetch(buildAuthorizeUrl());
    assertRedirect(authorizeResponse, "PASO_1_AUTHORIZE");
    const loginPageUrl = authorizeResponse.headers.get("location");

    const loginPageResponse = await jar.fetch(loginPageUrl);
    if (loginPageResponse.status !== 200) throw new AppError("PASO_2_LOGIN_PAGE", `status ${loginPageResponse.status}`);
    const hiddenFields = parseHiddenFields(await loginPageResponse.text());
    if (!hiddenFields.execution) throw new AppError("PASO_2_SIN_EXECUTION", "No se encontró el campo execution");

    const form = new URLSearchParams({ ...hiddenFields, username: usuario, password, _eventId: hiddenFields._eventId || "submit", geolocation: hiddenFields.geolocation || "" });
    const credentialsResponse = await jar.fetch(loginPageUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    assertRedirect(credentialsResponse, "PASO_3_CREDENCIALES");

    const ticketResponse = await jar.fetch(credentialsResponse.headers.get("location"));
    assertRedirect(ticketResponse, "PASO_4_TICKET");
    const oidcResponse = await jar.fetch(ticketResponse.headers.get("location"));
    assertRedirect(oidcResponse, "PASO_5_OIDC_FINAL");
    const idToken = extractIdToken(oidcResponse.headers.get("location"));
    if (!idToken) throw new AppError("PASO_5_SIN_TOKEN", "No se encontró id_token");

    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({ id_token: idToken, usuario, dominio: DOMINIO });
  } catch (error) {
    console.error("Antel login error:", error.step || "general", error.message);
    response.status(502).json({ error: "login_failed", step: error.step || null, detail: error.message });
  }
};

class AppError extends Error { constructor(step, message) { super(message); this.step = step; } }
function assertRedirect(result, step) { if (result.status < 300 || result.status >= 400 || !result.headers.get("location")) throw new AppError(step, `Se esperaba redirección y se obtuvo status ${result.status}`); }
function buildAuthorizeUrl() { const query = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "id_token token", scope: "openid", state: randomHex(16), nonce: randomHex(16), service: REDIRECT_URI }); return `${OIDC_AUTHORIZE_URL}?${query}`; }
function randomHex(bytes) { return crypto.randomBytes(bytes).toString("hex"); }
function parseHiddenFields(html) {
  const fields = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/type\s*=\s*["']hidden["']/i.test(tag)) continue;
    const name = tag.match(/name\s*=\s*["']([^"']+)["']/i);
    const value = tag.match(/value\s*=\s*["']([^"']*)["']/i);
    if (name) fields[name[1]] = (value ? value[1] : "").replace(/&amp;/g, "&");
  }
  return fields;
}
function extractIdToken(url) { const hashIndex = String(url || "").indexOf("#"); return hashIndex < 0 ? null : new URLSearchParams(String(url).slice(hashIndex + 1)).get("id_token"); }

class CookieJar {
  constructor() { this.cookies = new Map(); }
  header() { return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "); }
  store(result) {
    const values = typeof result.headers.getSetCookie === "function" ? result.headers.getSetCookie() : [result.headers.get("set-cookie")].filter(Boolean);
    for (const cookie of values) { const pair = cookie.split(";", 1)[0]; const separator = pair.indexOf("="); if (separator > 0) this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()); }
  }
  async fetch(url, options = {}) { const result = await fetch(url, { ...options, redirect: "manual", headers: { ...(options.headers || {}), Cookie: this.header(), "User-Agent": UA } }); this.store(result); return result; }
}
