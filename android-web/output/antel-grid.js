const GRID_BASE = "https://cds-frontend.vera.com.uy/api-contenidos/listas";
const GRID_HEADERS = { "x-service-id": "3", "x-frontend-id": "1196", "x-system-id": "1" };

module.exports = async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const body = request.body || {};
  const id = body.id || request.query.id;
  const token = body.token || request.headers["x-antel-token"] || request.query.token;
  const jwt = body.jwt || request.headers["x-antel-jwt"] || request.query.jwt;
  if (!id || !token || !jwt) {
    response.status(400).json({ error: "missing_session" });
    return;
  }
  try {
    const upstream = await fetch(`${GRID_BASE}/${encodeURIComponent(String(id))}?token=${encodeURIComponent(String(token))}`, { headers: { ...GRID_HEADERS, Authorization: `Bearer ${jwt}` } });
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    response.status(upstream.status).send(await upstream.text());
  } catch (error) {
    response.status(502).json({ error: "grid_unavailable", detail: error.message });
  }
};
