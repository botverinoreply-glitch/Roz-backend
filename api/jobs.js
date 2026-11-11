export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req, res) {
  const worker = process.env.PIPER_WORKER_URL;
  const secret = process.env.PIPER_WORKER_SECRET;
  if (!worker || !secret) return res.status(503).json({ error: "Voice service is not configured" });

  try {
    const root = worker.replace(/\/$/, "");
    if (req.method === "POST") {
      const { text, voice, format = "both", speed = 1, noiseScale, noiseW = 0.8, sentenceSilence = 0.2 } = req.body || {};
      if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Text is required" });
      if (text.length > 200000) return res.status(413).json({ error: "Maximum script length is 200,000 characters per job" });
      if (!["mp3", "wav", "both"].includes(format)) return res.status(400).json({ error: "Invalid audio format" });
      if (typeof voice !== "string" || !/^[a-zA-Z0-9_-]+$/.test(voice)) return res.status(400).json({ error: "Invalid voice id" });
      const r = await fetch(`${root}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
        body: JSON.stringify({ text, voice, format, speed, noiseScale, noiseW, sentenceSilence })
      });
      return res.status(r.status).json(await r.json());
    }
    if (req.method === "GET") {
      const id = String(req.query.id || "");
      if (!/^[a-f0-9-]{20,50}$/i.test(id)) return res.status(400).json({ error: "Invalid job id" });
      const r = await fetch(`${root}/jobs/${encodeURIComponent(id)}`, {
        headers: { "Authorization": `Bearer ${secret}` }
      });
      const data = await r.json();
      if (data.status === "completed" && data.outputs) {
        data.outputs = Object.fromEntries(Object.keys(data.outputs).map(fmt => [fmt, `/api/download?id=${encodeURIComponent(id)}&format=${fmt}`]));
      }
      return res.status(r.status).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch {
    return res.status(502).json({ error: "Voice service unavailable" });
  }
}