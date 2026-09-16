const SESSION_API = "https://veratv-be.vera.com.uy/api/sesiones";

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const upstream = await fetch(SESSION_API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(request.body || {}) });
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    response.status(upstream.status).send(await upstream.text());
  } catch (error) {
    response.status(502).json({ error: "session_unavailable", detail: error.message });
  }
};
