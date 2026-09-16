function isAllowedUrl(value) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) return false;
    if (/^(10\.|192\.168\.|169\.254\.|127\.)/.test(hostname)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function proxyUrl(value) {
  return `/api/proxy?target=${encodeURIComponent(value)}`;
}

module.exports = async function handler(request, response) {
  const { path, target } = request.query;
  const upstreamUrl = target
    ? String(target)
    : `http://daleplaytv.vip/live/${String(path || "")}`;

  if (!isAllowedUrl(upstreamUrl)) {
    response.status(400).send("Invalid stream target");
    return;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      redirect: "follow",
      headers: {
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 FUTBOL-UY-TV"
      }
    });

    if (!upstream.ok) {
      response.status(upstream.status).send(`Upstream stream error: ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const isPlaylist = contentType.includes("mpegurl") || /\.(m3u8?|txt)(?:$|\?)/i.test(upstream.url);

    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    response.setHeader("Content-Type", isPlaylist ? "application/vnd.apple.mpegurl" : contentType);

    if (request.method === "HEAD") {
      response.status(200).end();
      return;
    }

    if (!isPlaylist) {
      response.status(200).send(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    const playlist = await upstream.text();
    const rewritten = playlist.split(/\r?\n/).map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const absoluteUrl = new URL(trimmed, upstream.url).href;
      return proxyUrl(absoluteUrl);
    }).join("\n");

    response.status(200).send(rewritten);
  } catch (error) {
    response.status(502).send(`Proxy error: ${error.message}`);
  }
};