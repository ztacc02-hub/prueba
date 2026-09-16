const params = new URLSearchParams(window.location.search);
const source = params.get("src");
const title = params.get("name") || "Canal";
const video = document.getElementById("standalone-video");
const message = document.getElementById("player-message");
const status = document.getElementById("player-status");
const retry = document.getElementById("player-retry");
let hls = null;
let attempts = 0;
let retryTimer = null;
const maxAttempts = 3;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function destroyPlayer() {
  if (hls) hls.destroy();
  hls = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function startPlayer() {
  destroyPlayer();
  if (!source) {
    status.textContent = "SIN SEÑAL";
    setMessage("No se recibió una URL de reproducción.", true);
    return;
  }
  attempts += 1;
  status.textContent = attempts > 1 ? `REINTENTO ${attempts}/${maxAttempts}` : "CONECTANDO";
  setMessage("Sintonizando señal...");
  if (window.Hls?.isSupported()) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 20, backBufferLength: 30 });
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      status.textContent = "EN VIVO";
      setMessage("Señal activa");
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (attempts < maxAttempts) {
        setMessage(`La señal tardó en responder. Reintentando (${attempts}/${maxAttempts})...`);
        retryTimer = setTimeout(startPlayer, attempts * 1500);
      } else {
        status.textContent = "SIN SEÑAL";
        setMessage("La señal no respondió. Probá Reintentar o elegí otro canal.", true);
      }
    });
    hls.loadSource(source);
    return;
  }
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = source;
    video.addEventListener("loadedmetadata", () => { status.textContent = "EN VIVO"; setMessage("Señal activa"); video.play().catch(() => {}); }, { once: true });
    video.addEventListener("error", () => setMessage("El navegador no pudo abrir esta señal.", true), { once: true });
    return;
  }
  status.textContent = "NO COMPATIBLE";
  setMessage("Este dispositivo no soporta reproducción HLS.", true);
}

document.getElementById("player-title").textContent = title;
retry.addEventListener("click", () => { attempts = 0; startPlayer(); });
startPlayer();
