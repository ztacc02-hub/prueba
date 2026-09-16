const SETUP_API = "https://veratv-be.vera.com.uy/api/setup";

module.exports = async function handler(request, response) {
  if (request.method !== "GET") { response.status(405).json({ error: "method_not_allowed" }); return; }
  const { token, public_id: publicId } = request.query;
  if (!token || !publicId) { response.status(400).json({ error: "missing_content", detail: "Faltan token y public_id." }); return; }
  try {
    const upstream = await fetch(`${SETUP_API}?token=${encodeURIComponent(String(token))}&public_id=${encodeURIComponent(String(publicId))}`, { headers: { Accept: "application/json" } });
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    response.status(upstream.status).send(await upstream.text());
  } catch (error) { response.status(502).json({ error: "setup_unavailable", detail: error.message }); }
};