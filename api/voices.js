export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const worker = process.env.PIPER_WORKER_URL;
  const secret = process.env.PIPER_WORKER_SECRET;
  if (!worker || !secret) return res.status(503).json({ error: "Voice service is not configured" });
  try {
    const r = await fetch(`${worker.replace(/\/$/, "")}/voices`, {
      headers: { "Authorization": `Bearer ${secret}` }
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch {
    return res.status(502).json({ error: "Voice service unavailable" });
  }
}