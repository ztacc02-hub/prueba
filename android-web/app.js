const API_ORIGIN = window.Capacitor?.isNativePlatform?.() ? "https://futbol-uy-tv.vercel.app" : "";
const FALLBACK_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 180'%3E%3Crect width='300' height='180' fill='%231c1f27'/%3E%3Ctext x='150' y='105' fill='%23e52b3a' font-size='38' text-anchor='middle' font-family='Arial'%3EUY TV%3C/text%3E%3C/svg%3E";
const CHANNEL_PROXY_PREFIX = `${API_ORIGIN}/api/proxy?channel=`;
const PROXY_TARGET_PREFIX = `${API_ORIGIN}/api/proxy?target=`;

const ORIGINAL_LOGOS = {
  maronas: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSx24ZVTnt-MtRaXuKL9EwB4dWmfvutMqHrS1gglvXVbA&s=10",
  interior: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2dvrDMOHf3ygjGveFMd6KsVshCciQx_hWvYJ1lWmdVg&s",
  canal4: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQo3xFdkhqdzEnQZMReH-5vaSeH_iIHhlp2jli-ImEb7w&s=10",
  canal10: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQ-c1W4aa4W71olntaOz9AUrCEfBmMh8BEvuppV5C2oA&s=10",
  teledoce: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOhplm_BjjNWv5Am5ui8RFrQQCUZpHRJMjDJflmAV4og&s",
  tvciudad: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4e5oA9oyAuogZGSPUAQvKRgWxk4cC9wR0yIxM97Cw0A&s=10",
  tnu: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrhgMPWVm4VgzwePzg5__BiAehavyNecnvyMZ0eSqa-A&s=10"
};

// Wikimedia Commons se usa como fuente estable de logos; el onerror de las tarjetas cubre archivos retirados.
const LOGOS = {
  canal4: "https://commons.wikimedia.org/wiki/Special:FilePath/Canal%204%20Uruguay%20logo.svg",
  canal10: "https://commons.wikimedia.org/wiki/Special:FilePath/Canal%2010%20Uruguay%20logo.svg",
  teledoce: "https://commons.wikimedia.org/wiki/Special:FilePath/Teledoce%20logo.svg",
  vtv: "https://commons.wikimedia.org/wiki/Special:FilePath/VTV%20Uruguay%20logo.svg",
  dsports: "https://commons.wikimedia.org/wiki/Special:FilePath/DSports%20logo.svg",
  tnu: "https://commons.wikimedia.org/wiki/Special:FilePath/TNU%20Uruguay%20logo.svg",
  tvciudad: "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Ciudad%20logo.svg"
};

const defaultChannels = [
  { name: "Maroñas HD", logo: ORIGINAL_LOGOS.maronas, id: "542835" },
  { name: "La Red Interior HD", logo: ORIGINAL_LOGOS.interior, id: "437206" },
  { name: "Canal 4 FHD", logo: ORIGINAL_LOGOS.canal4, id: "52810" },
  { name: "Canal 4 HD", logo: LOGOS.canal4, id: "52811" },
  { name: "Canal 4 SD", logo: LOGOS.canal4, id: "52812" },
  { name: "Canal 10 FHD", logo: ORIGINAL_LOGOS.canal10, id: "52815" },
  { name: "Canal 10 HD", logo: ORIGINAL_LOGOS.canal10, id: "52816" },
  { name: "Canal 10 SD", logo: ORIGINAL_LOGOS.canal10, id: "52817" },
  { name: "Teledoce FHD", logo: ORIGINAL_LOGOS.teledoce, id: "52818" },
  { name: "Teledoce HD", logo: ORIGINAL_LOGOS.teledoce, id: "52820" },
  { name: "Teledoce SD", logo: ORIGINAL_LOGOS.teledoce, id: "52819" },
  { name: "DSports Uruguay HD", logo: LOGOS.dsports, id: "52825" },
  { name: "DSports Premium HD 1", logo: LOGOS.dsports, id: "52836" },
  { name: "DSports Premium HD 2", logo: LOGOS.dsports, id: "52832" },
  { name: "PPV Fútbol 1 HD", logo: LOGOS.dsports, id: "52835" },
  { name: "PPV Fútbol 2 HD", logo: LOGOS.dsports, id: "52834" },
  { name: "VTV HD", logo: LOGOS.vtv, id: "52833" },
  { name: "VTV Plus HD", logo: LOGOS.vtv, id: "358427" },
  { name: "VTV Fútbol FHD", logo: LOGOS.vtv, id: "347109" },
  { name: "TV Ciudad HD", logo: ORIGINAL_LOGOS.tvciudad, id: "52838" },
  { name: "Canal 5 TNU SD", logo: ORIGINAL_LOGOS.tnu, id: "307573" },
  { name: "Canal 5 TNU HD", logo: ORIGINAL_LOGOS.tnu, id: "135976" },
  { name: "A+V HD", logo: LOGOS.vtv, id: "52826" }
].map(channel => ({ ...channel, category: "Fútbol Uruguay", url: `${CHANNEL_PROXY_PREFIX}${encodeURIComponent(channel.id)}` }));

const $ = id => document.getElementById(id);
const video = $("video");
let activeChannel = null;
let hls = null;
let streamRetryTimer = null;
let streamRetryCount = 0;
const MAX_STREAM_RETRIES = 3;
const LIST_DB = "futbol-uy-tv";
const LIST_STORE = "lists";
let activeSavedList = null;
let currentChannels = defaultChannels;
let activeCategory = "Todas";
let channelLimit = 120;

function openListDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIST_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LIST_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveList(list) {
  const database = await openListDB();
  await new Promise((resolve, reject) => {
    const request = database.transaction(LIST_STORE, "readwrite").objectStore(LIST_STORE).put(list);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  database.close();
}

async function loadSavedList() {
  const database = await openListDB();
  const list = await new Promise((resolve, reject) => {
    const request = database.transaction(LIST_STORE, "readonly").objectStore(LIST_STORE).get("my-list");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return list;
}

function displayName(name) {
  return name.replace(/\s+/g, " ").trim();
}

function makeFallbackLogo(name) {
  const initials = displayName(name).split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "TV";
  const encoded = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180"><rect width="300" height="180" rx="18" fill="#171a21"/><path d="M0 145h300v35H0z" fill="#e52b3a"/><text x="150" y="111" fill="#fff" font-size="56" font-weight="700" text-anchor="middle" font-family="Arial,sans-serif">${initials}</text></svg>`);
  return `data:image/svg+xml,${encoded}`;
}

function logoFor(channel) {
  return channel.logo || makeFallbackLogo(channel.name);
}

function proxyStreamUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (!["http:", "https:"].includes(parsed.protocol)) return url;
    return `${PROXY_TARGET_PREFIX}${encodeURIComponent(parsed.href)}`;
  } catch {
    return url;
  }
}

function categories() {
  return ["Todas", ...new Set(currentChannels.map(channel => channel.category || "Sin categoría"))];
}

function renderCategories() {
  const bar = $("category-bar");
  bar.replaceChildren();
  categories().forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-button${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      channelLimit = 120;
      renderCategories();
      renderChannels($("search").value);
    });
    bar.appendChild(button);
  });
}

function renderChannels(query = "") {
  const normalizedQuery = query.toLocaleLowerCase();
  const filtered = currentChannels.filter(channel => (activeCategory === "Todas" || (channel.category || "Sin categoría") === activeCategory) && displayName(channel.name).toLocaleLowerCase().includes(normalizedQuery));
  const visible = filtered.slice(0, channelLimit);
  const grid = $("channel-grid");
  grid.replaceChildren();
  $("count").textContent = `${filtered.length} CANALES`;

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No se encontraron canales.";
    grid.appendChild(empty);
    if ($("load-more")) $("load-more").hidden = true;
    return;
  }

  visible.forEach(channel => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "channel-card";
    card.dataset.url = channel.url;
    card.innerHTML = '<div class="channel-logo"><img alt=""><\/div><h3><\/h3><div class="card-live"><i class="live-dot"><\/i> EN VIVO<\/div>';

    const image = card.querySelector("img");
    image.src = logoFor(channel);
    image.onerror = () => { image.src = makeFallbackLogo(channel.name); };
    card.querySelector("h3").textContent = displayName(channel.name);
    card.addEventListener("click", () => loadChannel(channel));
    grid.appendChild(card);
  });

  const loadMore = $("load-more");
  if (loadMore) {
    loadMore.hidden = visible.length >= filtered.length;
    loadMore.textContent = `Mostrar más (${filtered.length - visible.length})`;
  }
  markActiveCard();
}

function markActiveCard() {
  document.querySelectorAll(".channel-card").forEach(card => {
    card.classList.toggle("active", card.dataset.url === activeChannel?.url);
  });
}

function setError(message) {
  $("error-detail").textContent = message;
  $("player-error").classList.add("show");
}

function clearError() {
  $("player-error").classList.remove("show");
}

function destroyHls() {
  if (hls) hls.destroy();
  hls = null;
  if (streamRetryTimer) clearTimeout(streamRetryTimer);
  streamRetryTimer = null;
}

function loadChannel(channel) {
  const playerUrl = new URL("/player.html", window.location.origin);
  playerUrl.searchParams.set("src", new URL(channel.url, window.location.href).href);
  playerUrl.searchParams.set("name", channel.name);
  if (window.Capacitor?.isNativePlatform?.()) window.location.assign(playerUrl.href);
  else window.open(playerUrl.href, "_blank", "noopener");
  return;

  activeChannel = channel;
  $("current-title").textContent = displayName(channel.name);
  $("current-logo").src = logoFor(channel);
  $("current-logo").onerror = () => { $("current-logo").src = makeFallbackLogo(channel.name); };
  clearError();
  markActiveCard();
  destroyHls();
  streamRetryCount = 0;
  video.playbackRate = 1;
  video.pause();
  video.removeAttribute("src");
  video.load();

  if (window.Hls?.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      liveSyncDurationCount: 1,
      liveMaxLatencyDurationCount: 3,
      maxLiveSyncPlaybackRate: 1,
      maxBufferLength: 12,
      backBufferLength: 20,
      capLevelToPlayerSize: true,
      startLevel: -1
    });
    hls.loadSource(channel.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && streamRetryCount < MAX_STREAM_RETRIES) {
        streamRetryCount += 1;
        setError(`La señal tardó en responder. Reintentando (${streamRetryCount}/${MAX_STREAM_RETRIES})…`);
        streamRetryTimer = setTimeout(() => hls?.startLoad(), 1500 * streamRetryCount);
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else {
        destroyHls();
        setError(streamRetryCount >= MAX_STREAM_RETRIES ? "La señal no respondió después de varios intentos." : "El proveedor no entregó una señal HLS válida.");
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = channel.url;
    video.addEventListener("loadedmetadata", () => video.play().catch(() => {}), { once: true });
  } else {
    setError("Este navegador no soporta reproducción HLS.");
  }
}

function parseAttributes(value) {
  return Object.fromEntries([...value.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1].toLowerCase(), match[2].trim()]));
}

function parseM3U(text, sourceUrl = "") {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const imported = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].toUpperCase().startsWith("#EXTINF")) continue;
    const metadata = lines[index];
    const comma = metadata.indexOf(",");
    const name = displayName(comma >= 0 ? metadata.slice(comma + 1) : "Canal sin nombre");
    const attributes = parseAttributes(metadata);
    const stream = lines.slice(index + 1).find(line => !line.startsWith("#"));
    if (!stream) continue;
    index = lines.indexOf(stream, index + 1);
    let url = stream;
    try { url = sourceUrl ? new URL(stream, sourceUrl).href : stream; } catch { /* conserva URLs no estándar */ }
    imported.push({ name, url: proxyStreamUrl(url), sourceUrl: url, logo: attributes["tvg-logo"] || "", category: attributes["group-title"] || "Sin categoría" });
  }
  return imported;
}

function activateImportedList(list) {
  activeSavedList = list;
  currentChannels = list.channels;
  activeCategory = "Todas";
  channelLimit = 120;
  $("channels-title").textContent = list.name.toUpperCase();
  $("channels-subtitle").textContent = `${list.channels.length} canales sincronizados desde tu lista M3U.`;
  $("total").textContent = list.channels.length;
  renderCategories();
  renderChannels($("search").value);
  $("import-panel").hidden = true;
}

async function importM3U() {
  const file = $("m3u-file").files[0];
  const urlInput = $("m3u-url").value.trim();
  const status = $("import-status");
  status.textContent = "Leyendo lista...";
  try {
    let text;
    let sourceUrl = "";
    let name = file?.name.replace(/\.(m3u8?|txt)$/i, "") || "Mi lista M3U";
    if (file) text = await file.text();
    else if (urlInput) {
      sourceUrl = urlInput;
      name = new URL(urlInput).hostname;
      const response = await fetch(proxyStreamUrl(urlInput));
      if (!response.ok) throw new Error(`La lista respondió ${response.status}`);
      text = await response.text();
    } else throw new Error("Elige un archivo o indica una URL.");
    const channelsFromList = parseM3U(text, sourceUrl);
    if (!channelsFromList.length) throw new Error("No se encontraron canales con formato EXTINF.");
    const list = { id: Date.now(), name, channels: channelsFromList };
    await saveList({ ...list, id: "my-list" });
    activateImportedList(list);
    status.textContent = `${channelsFromList.length} canales importados.`;
  } catch (error) {
    status.textContent = error.message;
  }
}

$("search").addEventListener("input", event => { channelLimit = 120; renderChannels(event.target.value); });
if ($("import-m3u")) $("import-m3u").addEventListener("click", importM3U);
if ($("load-more")) $("load-more").addEventListener("click", () => { channelLimit += 120; renderChannels($("search").value); });
$("play").addEventListener("click", () => video.paused ? video.play().catch(() => {}) : video.pause());
video.addEventListener("play", () => { $("play").textContent = "❚❚"; });
video.addEventListener("pause", () => { $("play").textContent = "▶"; });
$("mute").addEventListener("click", () => { video.muted = !video.muted; $("mute").textContent = video.muted ? "🔇" : "🔊"; });
$("volume").addEventListener("input", event => { video.volume = Number(event.target.value); video.muted = video.volume === 0; });
$("fullscreen").addEventListener("click", () => $("player").requestFullscreen?.());
$("retry").addEventListener("click", () => activeChannel && loadChannel(activeChannel));
video.addEventListener("error", () => setError("No se pudo abrir el stream. Comprueba la disponibilidad del proveedor."));

async function startApp() {
  if (document.body.dataset.page === "my-list") {
    try {
      const response = await fetch(`${API_ORIGIN}/api/my-list`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo sincronizar la lista privada.");
      const channelsFromServer = await response.json();
      activeSavedList = { id: "my-list", name: "MI LISTA", channels: channelsFromServer };
      saveList(activeSavedList).catch(error => console.warn("No se pudo guardar la lista local:", error));
    } catch (error) {
      activeSavedList = await loadSavedList().catch(() => null);
      if (!activeSavedList) setError(error.message);
    }
  }
  if (document.body.dataset.page === "my-list" && activeSavedList?.channels?.length) {
    currentChannels = activeSavedList.channels;
    $("channels-title").textContent = activeSavedList.name.toUpperCase();
    $("channels-subtitle").textContent = `${activeSavedList.channels.length} canales sincronizados.`;
  }
  $("total").textContent = currentChannels.length;
  renderCategories();
  renderChannels();
  setTimeout(() => $("splash").classList.add("hide"), 700);
}

startApp().catch(error => {
  console.error("No se pudo iniciar la aplicación:", error);
  $("splash").classList.add("hide");
  setError("No se pudo cargar la lista. Reintentá desde el botón del reproductor.");
});
