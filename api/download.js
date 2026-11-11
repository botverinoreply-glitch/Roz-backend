export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const worker = process.env.PIPER_WORKER_URL;
  const secret = process.env.PIPER_WORKER_SECRET;
  const id = String(req.query.id || "");
  const format = String(req.query.format || "");
  if (!worker || !secret) return res.status(503).json({ error: "Voice service is not configured" });
  if (!/^[a-f0-9-]{20,50}$/i.test(id) || !["mp3", "wav"].includes(format)) return res.status(400).json({ error: "Invalid download request" });
  try {
    const r = await fetch(`${worker.replace(/\/$/, "")}/files/${id}/joined.${format}`, {
      headers: { "Authorization": `Bearer ${secret}` }
    });
    if (!r.ok) return res.status(r.status).json({ error: "Audio file unavailable" });
    res.setHeader("Content-Type", format === "mp3" ? "audio/mpeg" : "audio/wav");
    res.setHeader("Content-Disposition", `attachment; filename="roz-${id}.${format}"`);
    const bytes = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(bytes);
  } catch {
    return res.status(502).json({ error: "Download service unavailable" });
  }
}