const API_ORIGIN = "https://futbol-uy-tv.vercel.app";
const ANTEL_CONFIG = { sessionApi: "https://veratv-be.vera.com.uy/api/sesiones", setupApi: "https://veratv-be.vera.com.uy/api/setup", gridBase: "https://cds-frontend.vera.com.uy/api-contenidos/listas", gridHeaders: { "x-service-id": "3", "x-frontend-id": "1196", "x-system-id": "1" }, lists: { canales: 68, radios: 221, camaras: 139, peliculas: 250 }, labels: { canales: "Canales", radios: "Radios", camaras: "Cámaras", peliculas: "Películas" } };
const $ = id => document.getElementById(id);
const state = { token: null, jwt: null, sessionExpiry: 0, renewTimer: null, streamTimer: null, streamRetry: 0, category: null, items: [], current: null, hls: null, favorites: new Set(JSON.parse(localStorage.getItem("antel-tv-favorites") || "[]")), showFavorites: false };

function setMessage(message, error = false) { $("antel-login-message").textContent = message; $("antel-login-message").classList.toggle("error", error); }
function setStatus(text) { $("antel-status").textContent = text; }
function showApp() { $("antel-login").hidden = true; $("antel-app").hidden = false; }
function showLogin() { $("antel-login").hidden = false; $("antel-app").hidden = true; }
function jwtPayload(token) { try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; } }
async function readJson(response) { const text = await response.text(); try { return JSON.parse(text); } catch { throw new Error(`El servidor respondió ${response.status} con un formato inesperado.`); } }

async function login(event) {
  event.preventDefault();
  const user = $("antel-user").value.trim();
  const password = $("antel-pass").value;
  if ((user && !password) || (!user && password)) { setMessage("Completa usuario y contraseña de Antel TV.", true); return; }
  if (user) state.user = user;
  if (password) state.password = password;
  setMessage("Conectando…");
  try {
    const loginResponse = await fetch(`${API_ORIGIN}/api/antel-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: user, password }) });
    const loginData = await readJson(loginResponse);
    if (!loginResponse.ok || !loginData.id_token) throw new Error(loginData.detail || loginData.error || "Usuario o contraseña incorrectos.");
    const sessionResponse = await fetch(ANTEL_CONFIG.sessionApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: loginData.usuario || user, dominio: loginData.dominio || "lua", tipo: "usuario", autenticacion_jwt: loginData.id_token }) });
    const sessionData = await readJson(sessionResponse);
    if (!sessionResponse.ok || !sessionData.token || !sessionData.jwt) throw new Error(sessionData.detail || sessionData.mensaje || "No se pudo crear la sesión.");
    state.token = sessionData.token; state.jwt = sessionData.jwt; state.user = loginData.usuario || state.user;
    scheduleRenewal(sessionData.jwt);
    setStatus("SESIÓN ACTIVA"); showApp(); renderCategories();
  } catch (error) { setMessage(error.message, true); }
}

function scheduleRenewal(jwt) {
  if (state.renewTimer) clearTimeout(state.renewTimer);
  const payload = jwtPayload(jwt);
  state.sessionExpiry = (payload.exp || Math.floor(Date.now() / 1000) + 21600) * 1000;
  const delay = Math.max(state.sessionExpiry - Date.now() - 10 * 60 * 1000, 5000);
  state.renewTimer = setTimeout(() => login({ preventDefault() {} }), delay);
}

function renderCategories() {
  const container = $("antel-categories"); container.replaceChildren();
  Object.entries(ANTEL_CONFIG.labels).forEach(([key, label]) => {
    const card = document.createElement("button"); card.type = "button"; card.className = `antel-category antel-category-${key}`;
    card.innerHTML = `<span class="antel-category-icon"></span><small>EXPLORAR</small><strong>${label}</strong><span class="antel-category-arrow">→</span>`;
    card.addEventListener("click", () => loadGrid(key)); container.appendChild(card);
  });
}

async function loadGrid(category) {
  state.category = category; state.showFavorites = false; $("antel-categories").hidden = true; $("antel-grid-view").hidden = false; $("antel-grid-title").textContent = ANTEL_CONFIG.labels[category]; $("antel-search").value = ""; $("antel-grid").innerHTML = '<div class="antel-loading">Cargando catálogo…</div>';
  try {
    const response = await fetch(`${ANTEL_CONFIG.gridBase}/${ANTEL_CONFIG.lists[category]}?token=${encodeURIComponent(state.token)}`, { headers: { ...ANTEL_CONFIG.gridHeaders, Authorization: `Bearer ${state.jwt}` } });
    const data = await readJson(response); if (!response.ok) throw new Error(data.info || data.detail || `Error ${response.status}`);
    state.items = (data.contenidos || []).map(item => ({ id: String(item.public_id), name: item.nombre_fantasia || item.nombre || "Sin nombre", logo: item.imagen_horizontal || item.imagen_principal || "" })); renderGrid();
  } catch (error) { $("antel-grid").innerHTML = ""; $("antel-empty").hidden = false; $("antel-empty").textContent = `No se pudo cargar ${ANTEL_CONFIG.labels[category]}. ${error.message}`; }
}

function renderGrid() {
  const query = $("antel-search").value.toLocaleLowerCase().trim(); const items = state.items.filter(item => (!state.showFavorites || state.favorites.has(item.id)) && item.name.toLocaleLowerCase().includes(query)); const grid = $("antel-grid"); grid.replaceChildren(); $("antel-empty").hidden = items.length > 0;
  items.forEach(item => { const card = document.createElement("article"); card.className = "antel-card"; card.innerHTML = `<button class="antel-card-main" type="button"><span class="antel-card-logo"><img loading="lazy" alt=""></span><strong></strong><small>${ANTEL_CONFIG.labels[state.category]}</small></button><button class="antel-card-fav" type="button" aria-label="Favorito">${state.favorites.has(item.id) ? "★" : "☆"}</button>`; card.querySelector("strong").textContent = item.name; const image = card.querySelector("img"); image.src = item.logo || fallbackLogo(item.name); image.onerror = () => { image.src = fallbackLogo(item.name); }; card.querySelector(".antel-card-main").addEventListener("click", () => play(item)); card.querySelector(".antel-card-fav").addEventListener("click", () => { state.favorites.has(item.id) ? state.favorites.delete(item.id) : state.favorites.add(item.id); localStorage.setItem("antel-tv-favorites", JSON.stringify([...state.favorites])); renderGrid(); }); grid.appendChild(card); });
}

function fallbackLogo(name) { const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase(); return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150"><rect width="240" height="150" fill="#18202d"/><text x="120" y="90" text-anchor="middle" fill="#d8a85b" font-size="42" font-family="Arial" font-weight="700">${initials}</text></svg>`)}`; }

function findStreamUrl(value) {
  if (typeof value === "string") return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
  if (Array.isArray(value)) for (const entry of value) { const found = findStreamUrl(entry); if (found) return found; }
  if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) { if (/url|stream|playlist|m3u8|source|suggested/i.test(key)) { const found = findStreamUrl(entry); if (found) return found; } }
  return null;
}

function setupError(data, status) {
  const code = data?.code_interno || data?.code || data?.info?.code_interno || data?.info?.code || "";
  const detail = String(data?.message || data?.info?.info || data?.detail || data?.error || data?.mensaje || "");
  const lower = detail.toLocaleLowerCase();
  if (code === "9601-REP_SIM" || lower.includes("reproducciones simultáneas") || lower.includes("reproducciones simultaneas")) return "Antel permite un máximo de 2 reproducciones simultáneas. Se renovará la sesión y se reintentará.";
  if (code === "9601-IPANTELNOROA" || lower.includes("redes de antel")) return "Esta señal solo está disponible desde una red de Antel dentro de Uruguay.";
  if (["9601-OTTEXTAUTH", "9601-AUTHREQ"].includes(code)) return "Antel requiere autorización adicional para esta señal.";
  if (code === "9601-SOLOUY") return "Esta señal solo está disponible dentro de Uruguay.";
  if (status === 403 && (lower.includes("condiciones") || lower.includes("restringido"))) return "Tu cuenta no cumple las condiciones de acceso para este contenido.";
  return detail || `Error de reproducción (${status})`;
}

function validateProvisioning(data) {
  if (data?.estado && data.estado !== "APROVISIONADO") {
    throw new Error(`Contenido no aprovisionado: ${data.estado}`);
  }
  if (data?.url?.status && data.url.status !== "OK") {
    throw new Error(`Antel no habilitó la URL de reproducción: ${data.url.status}`);
  }
}

async function refreshAntelSession() {
  const response = await fetch(`${API_ORIGIN}/api/antel-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: state.user, password: state.password }) });
  const data = await readJson(response);
  if (!response.ok || !data.id_token) throw new Error(data.detail || "No se pudo renovar el token.");
  const sessionResponse = await fetch(ANTEL_CONFIG.sessionApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: data.usuario, dominio: data.dominio || "lua", tipo: "usuario", autenticacion_jwt: data.id_token }) });
  const sessionData = await readJson(sessionResponse);
  if (!sessionResponse.ok || !sessionData.token || !sessionData.jwt) throw new Error(sessionData.detail || "No se pudo renovar la sesión.");
  state.token = sessionData.token; state.jwt = sessionData.jwt; scheduleRenewal(sessionData.jwt);
}

async function requestStream(item) {
  const request = () => fetch(`${ANTEL_CONFIG.setupApi}?token=${encodeURIComponent(state.token)}&public_id=${encodeURIComponent(item.id)}`);
  let response = await request();
  let data = await readJson(response);
  const code = data?.code_interno || data?.code || data?.info?.code || "";
  if (!response.ok && code === "9601-REP_SIM") { await refreshAntelSession(); response = await request(); data = await readJson(response); }
  if (!response.ok) throw new Error(setupError(data, response.status));
  validateProvisioning(data);
  const url = findStreamUrl(data);
  if (!url) throw new Error("Antel no entregó una URL de reproducción para este contenido.");
  return url;
}

function scheduleStreamRefresh(url) {
  if (state.streamTimer) clearTimeout(state.streamTimer);
  const tokenMatch = url.match(/_tkn_([^/]+)/);
  let expiry = 0;
  try { expiry = JSON.parse(atob(tokenMatch[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch {}
  const delay = expiry ? Math.max(expiry - Date.now() - 5 * 60 * 1000, 30000) : 20 * 60 * 1000;
  state.streamTimer = setTimeout(() => { if (state.current) play(state.current, true); }, delay);
}

async function play(item, silentRefresh = false) { state.current = item; if (!silentRefresh) { $("antel-grid-view").hidden = true; $("antel-player-view").hidden = false; } $("antel-player-name").textContent = item.name; $("antel-player-message").textContent = silentRefresh ? "Renovando señal…" : "Sintonizando…"; $("antel-player-message").hidden = false; if (state.hls) state.hls.destroy(); const video = $("antel-video"); video.muted = true; video.autoplay = true; video.playbackRate = 1; video.pause(); video.removeAttribute("src"); video.load(); try { const url = await requestStream(item); scheduleStreamRefresh(url); if (window.Hls?.isSupported() && /\.m3u8|playlist/i.test(url)) { state.hls = new Hls({ maxLiveSyncPlaybackRate: 1, lowLatencyMode: true }); state.hls.attachMedia(video); state.hls.on(Hls.Events.MANIFEST_PARSED, () => { $("antel-player-message").hidden = true; state.streamRetry = 0; video.play().catch(() => {}); }); state.hls.on(Hls.Events.ERROR, (_, data) => { if (!data.fatal || state.streamRetry >= 2) return; state.streamRetry += 1; play(state.current, true); }); state.hls.loadSource(url); } else { video.src = url; video.addEventListener("loadedmetadata", () => { $("antel-player-message").hidden = true; }, { once: true }); video.play().catch(() => {}); } } catch (error) { $("antel-player-message").textContent = `No se pudo reproducir: ${error.message}`; } }

function backToCategories() { $("antel-grid-view").hidden = true; $("antel-categories").hidden = false; }
function backToGrid() { $("antel-player-view").hidden = true; $("antel-grid-view").hidden = false; }
function logout() { if (state.renewTimer) clearTimeout(state.renewTimer); if (state.streamTimer) clearTimeout(state.streamTimer); if (state.hls) state.hls.destroy(); $("antel-video").pause(); state.token = null; state.jwt = null; state.user = null; state.password = null; state.items = []; showLogin(); setStatus("SESIÓN CERRADA"); }

$("antel-video-play").addEventListener("click", () => { const video = $("antel-video"); if (video.paused) video.play().catch(() => {}); else video.pause(); $("antel-video-play").textContent = video.paused ? "▶" : "❚❚"; });
$("antel-video").addEventListener("play", () => { $("antel-video-play").textContent = "❚❚"; });
$("antel-video").addEventListener("pause", () => { $("antel-video-play").textContent = "▶"; });
$("antel-video-fullscreen").addEventListener("click", () => $("antel-video-wrap").requestFullscreen?.());

$("antel-login-form").addEventListener("submit", login); $("antel-back").addEventListener("click", backToCategories); $("antel-player-back").addEventListener("click", backToGrid); $("antel-logout").addEventListener("click", logout); $("antel-search").addEventListener("input", renderGrid); $("antel-favorites").addEventListener("click", () => { state.showFavorites = !state.showFavorites; $("antel-favorites").textContent = state.showFavorites ? "★ Todos" : "☆ Favoritos"; renderGrid(); });
login({ preventDefault() {} });
