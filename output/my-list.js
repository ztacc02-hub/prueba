const http = require("http");
const https = require("https");
const PLAYLIST_URL = process.env.PLAYLIST_URL || "";

function parseAttributes(value) {
  return Object.fromEntries([...value.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1].toLowerCase(), match[2].trim()]));
}

function parsePlaylist(text, sourceUrl) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const channels = [];
  for (let index = 0; index < lines.length; index += 1) {
    const metadata = lines[index];
    if (!metadata.toUpperCase().startsWith("#EXTINF")) continue;
    const comma = metadata.indexOf(",");
    const attributes = parseAttributes(metadata);
    const name = (comma >= 0 ? metadata.slice(comma + 1) : "Canal sin nombre").replace(/\s+/g, " ").trim();
    let stream = "";
    while (index + 1 < lines.length) {
      index += 1;
      if (!lines[index].startsWith("#")) {
        stream = lines[index];
        break;
      }
    }
    if (!stream) break;
    let url;
    try {
      url = new URL(stream, sourceUrl).href;
    } catch {
      continue;
    }
    channels.push({
      name,
      category: attributes["group-title"] || "Sin categoría",
      logo: attributes["tvg-logo"] || "",
      url: `/api/proxy?target=${encodeURIComponent(url)}`
    });
  }
  return channels;
}

function readPlaylistText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const chunks = [];
    let total = 0;
    let settled = false;
    let idleTimer;
    let completionTimer;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(completionTimer);
      if (error) reject(error);
      else resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const request = client.get(url, {
      headers: { Accept: "audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain", "Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0 FUTBOL-UY-TV" },
      timeout: 60000
    }, upstream => {
      if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
        upstream.resume();
        finish(new Error(`La lista respondió ${upstream.statusCode}`));
        return;
      }
      const stopWhenIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          upstream.destroy();
          finish();
        }, 1500);
      };
      upstream.on("data", chunk => {
        if (total < 64 * 1024 * 1024) {
          chunks.push(chunk);
          total += chunk.length;
        }
        stopWhenIdle();
      });
      upstream.on("end", () => finish());
      upstream.on("error", error => finish(error));
      stopWhenIdle();
    });
    request.on("timeout", () => {
      request.destroy(new Error("La lista tardó demasiado en responder"));
    });
    request.on("error", error => finish(error));
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).send("Method not allowed");
    return;
  }
  if (!PLAYLIST_URL) {
    response.status(503).send("Playlist no configurada. Importa un archivo M3U o configura PLAYLIST_URL en el servidor.");
    return;
  }

  try {
    const channels = parsePlaylist(await readPlaylistText(PLAYLIST_URL), PLAYLIST_URL);
    response.setHeader("Access-Control-Allow-Origin", "same-origin");
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.status(200).json(channels);
  } catch (error) {
    response.status(502).send(`Playlist sync error: ${error.message}`);
  }
};
