const LIST_ENDPOINT = "/api/my-list";
const PROXY_PREFIX = "/api/proxy?target=";
const $ = id => document.getElementById(id);
let channels = [];
let activeCategory = "Todas";
let hls = null;

function proxyUrl(url) { return `${PROXY_PREFIX}${encodeURIComponent(url)}`; }
function streamUrl(url) {
  try {
    const parsed = new URL(url);
    if (/\.ts$/i.test(parsed.pathname)) parsed.pathname = parsed.pathname.replace(/\.ts$/i, ".m3u8");
    return parsed.href;
  } catch { return url; }
}
function parseAttributes(value) { return Object.fromEntries([...value.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1].toLowerCase(), match[2].trim()])); }

function parseM3U(text, sourceUrl) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.reduce((result, line, index) => {
    if (!line.toUpperCase().startsWith("#EXTINF")) return result;
    const comma = line.indexOf(",");
    const attributes = parseAttributes(line);
    const stream = lines.slice(index + 1).find(entry => !entry.startsWith("#"));
    if (!stream) return result;
    let url = stream;
    try { url = new URL(stream, sourceUrl).href; } catch { return result; }
    result.push({ name: (comma >= 0 ? line.slice(comma + 1) : "Canal sin nombre").trim(), url: proxyUrl(streamUrl(url)), category: attributes["group-title"] || "Sin categoría", logo: attributes["tvg-logo"] || "" });
    return result;
  }, []);
}

function setMessage(text, error = false) { $("m3u-message").textContent = text; $("m3u-message").classList.toggle("is-error", error); }

function renderCategories() {
  const categories = ["Todas", ...new Set(channels.map(channel => channel.category))];
  $("m3u-categories").replaceChildren(...categories.map(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-button${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => { activeCategory = category; renderCategories(); renderChannels(); });
    return button;
  }));
}

function renderChannels() {
  const visible = channels.filter(channel => activeCategory === "Todas" || channel.category === activeCategory);
  $("m3u-count").textContent = `${visible.length} CANALES`;
  $("m3u-channels").replaceChildren(...visible.map(channel => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "channel-card";
    card.innerHTML = '<div class="channel-logo"><img alt=""><\/div><h3><\/h3><div class="card-live"><i class="live-dot"><\/i> REPRODUCIR<\/div>';
    card.querySelector("h3").textContent = channel.name;
    const image = card.querySelector("img");
    image.src = channel.logo || "";
    image.onerror = () => { image.removeAttribute("src"); };
    card.addEventListener("click", () => play(channel));
    return card;
  }));
}

function play(channel) {
  const video = $("m3u-video");
  $("m3u-player").hidden = false;
  $("m3u-player-title").textContent = channel.name;
  $("m3u-cast").hidden = !("remote" in video && video.remote?.prompt);
  if (hls) hls.destroy();
  hls = null;
  video.removeAttribute("src");
  video.load();
  if (window.Hls?.isSupported()) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(channel.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => { setMessage(`Reproduciendo ${channel.name}.`); video.play().catch(() => {}); });
    hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setMessage("La señal no pudo iniciar. Probá otro canal o verificá la fuente.", true); });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = channel.url;
    video.play().then(() => setMessage(`Reproduciendo ${channel.name}.`)).catch(() => setMessage("El navegador bloqueó la reproducción automática. Usá el botón de play.", true));
  } else setMessage("Este navegador no soporta reproducción HLS.", true);
  $("m3u-player").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadList() {
  setMessage("Conectando con la fuente privada...");
  $("m3u-status").textContent = "CARGANDO...";
  try {
    const response = await fetch(LIST_ENDPOINT, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`La lista respondió ${response.status}.`);
    const imported = await response.json();
    if (!Array.isArray(imported) || !imported.length) throw new Error("No se encontraron canales en la fuente privada.");
    channels = imported.map(channel => ({ ...channel, url: channel.url.startsWith("/") ? channel.url : proxyUrl(streamUrl(channel.url)) }));
    activeCategory = "Todas";
    $("m3u-list-title").textContent = "FUENTE PRIVADA";
    $("m3u-status").textContent = "LISTA ACTIVA";
    renderCategories();
    renderChannels();
    setMessage(`${imported.length} canales cargados. Elegí una señal para reproducirla.`);
  } catch (error) { setMessage(error.message || "No se pudo cargar la fuente privada.", true); $("m3u-status").textContent = "ERROR DE FUENTE"; }
}

$("m3u-refresh").addEventListener("click", loadList);
function applyTheme(theme) { document.body.dataset.theme = theme; const button = $("m3u-theme-toggle"); if (button) { button.textContent = theme === "light" ? "☾" : "☼"; button.setAttribute("aria-label", theme === "light" ? "Activar modo oscuro" : "Activar modo claro"); } }
const savedTheme = localStorage.getItem("m3u-theme");
applyTheme(savedTheme || (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark"));
$("m3u-theme-toggle").addEventListener("click", () => { const theme = document.body.dataset.theme === "light" ? "dark" : "light"; localStorage.setItem("m3u-theme", theme); applyTheme(theme); });
$("m3u-cast").addEventListener("click", () => $("m3u-video").remote?.prompt?.().catch(() => setMessage("No se pudo abrir Cast.", true)));
loadList();