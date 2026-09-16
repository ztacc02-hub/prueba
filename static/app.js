const API_ORIGIN = "https://futbol-uy-k93k8sbvh-jjj-e3cd.vercel.app";
const FALLBACK_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'%3E%3Crect width='200' height='120' fill='%231c1f27'/%3E%3Ctext x='100' y='70' fill='%23e52b3a' font-size='30' text-anchor='middle' font-family='Arial'%3EUY TV%3C/text%3E%3C/svg%3E";
const channels = [
  ["Maroñas HD", "542835"], ["La Red Interior HD", "437206"], ["Canal 4 FHD", "52810"],
  ["Canal 4 HD", "52811"], ["Canal 4 SD", "52812"], ["Canal 10 FHD", "52815"],
  ["Canal 10 HD", "52816"], ["Canal 10 SD", "52817"], ["Canal Tele 12 FHD", "52818"],
  ["Canal Tele 12 HD", "52820"], ["Canal Tele 12 SD", "52819"], ["DSports Uruguay HD", "52825"],
  ["PPV Fútbol 2 HD", "52834"], ["PPV Fútbol 1 HD", "52835"], ["DSports Premium HD 1", "52836"],
  ["DSports Premium HD 2", "52832"], ["VTV HD", "52833"], ["A+V HD", "52826"],
  ["VTV Plus HD", "358427"], ["VTV Fútbol FHD", "347109"], ["TV Ciudad HD", "52838"],
  ["TNU Canal 5 SD", "307573"], ["TNU Canal 5 HD", "135976"]
].map(([name, id]) => ({ name, url: `${API_ORIGIN}/api/proxy?channel=${id}`, logo: FALLBACK_LOGO }));

const $ = id => document.getElementById(id);
const video = $("video");
let currentChannel = null;
let hls = null;

function renderChannels(query = "") {
  const normalized = query.toLocaleLowerCase();
  const visible = channels.filter(channel => channel.name.toLocaleLowerCase().includes(normalized));
  $("channel-grid").replaceChildren();
  $("count").textContent = `${visible.length} CANALES`;
  visible.forEach(channel => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "channel-card";
    card.dataset.url = channel.url;
    card.innerHTML = '<div class="channel-logo"><img alt=""></div><h3></h3><div class="card-live"><i class="live-dot"></i> EN VIVO</div>';
    card.querySelector("img").src = channel.logo;
    card.querySelector("h3").textContent = channel.name;
    card.addEventListener("click", () => loadChannel(channel));
    $("channel-grid").appendChild(card);
  });
}

function destroyHls() { if (hls) hls.destroy(); hls = null; }
function showError(message) { $("error-detail").textContent = message; $("player-error").classList.add("show"); }
function loadChannel(channel) {
  currentChannel = channel;
  $("current-title").textContent = channel.name;
  $("current-logo").src = channel.logo;
  $("player-error").classList.remove("show");
  destroyHls();
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (!window.Hls?.isSupported()) { showError("Este dispositivo no soporta reproducción HLS."); return; }
  hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 12, backBufferLength: 20 });
  hls.attachMedia(video);
  hls.loadSource(channel.url);
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
    else { destroyHls(); showError("La señal no está disponible en este momento."); }
  });
}

$("search").addEventListener("input", event => renderChannels(event.target.value));
$("play").addEventListener("click", () => video.paused ? video.play().catch(() => {}) : video.pause());
video.addEventListener("play", () => { $("play").textContent = "❚❚"; });
video.addEventListener("pause", () => { $("play").textContent = "▶"; });
$("mute").addEventListener("click", () => { video.muted = !video.muted; $("mute").textContent = video.muted ? "🔇" : "🔊"; });
$("volume").addEventListener("input", event => { video.volume = Number(event.target.value); video.muted = video.volume === 0; });
$("fullscreen").addEventListener("click", () => $("player").requestFullscreen?.());
$("retry").addEventListener("click", () => currentChannel && loadChannel(currentChannel));

$("total").textContent = channels.length;
renderChannels();
setTimeout(() => { $("splash").classList.add("hide"); if (channels[0]) loadChannel(channels[0]); }, 700);
