# roz — Piper backend starter

This repository combines the existing React frontend with Vercel API routes and a separate Piper TTS worker.

## Architecture
- React/Vite frontend
- Vercel serverless API: `/api/voices` and `/api/jobs`
- Piper + FFmpeg worker in `worker/`
- WAV and MP3 output; `both` creates both files

## Configure Vercel
Set these environment variables in Vercel:
- `PIPER_WORKER_URL`: public HTTPS base URL of the deployed worker (no trailing slash)
- `PIPER_WORKER_SECRET`: same long random secret configured on the worker

Deploy the frontend/API project to Vercel after setting both variables.

## Deploy the worker
Deploy `worker/` as a Docker service on a persistent container host. Mount persistent storage for `/voices` and `/tmp/roz-jobs`. Configure:
- `PIPER_WORKER_SECRET`: long random secret shared with Vercel
- `VOICES_DIR=/voices`
- `JOBS_DIR=/data/jobs` (mount `/data` persistently)

Add `.onnx` voice models and matching `.onnx.json` config files to `/voices`. The API lists only installed models.

## API
- `GET /api/voices` — list installed voices
- `POST /api/jobs` — create job `{ "text":"...", "voice":"en_US-lessac-medium", "format":"both", "speed":1 }`
- `GET /api/jobs?id=<job-id>` — poll job status\n- `GET /api/download?id=<job-id>&format=mp3|wav` — authenticated download proxy

Worker job response includes `outputs.mp3` and/or `outputs.wav` paths. The frontend should poll until `completed`, then download from the worker using an authenticated download flow. Do not expose `PIPER_WORKER_SECRET` in browser code.

## Important limitations before public launch
The worker's starter job registry is in memory and output files are temporary. A worker restart loses job state. Before production, add Redis/managed queue + object storage (Cloudflare R2/S3), cleanup/retention, rate limiting, abuse protection, and durable job status. The starter does not pretend those production services already exist.

No provider API keys are needed for Piper. Hosting the worker itself may have a cost. Review the license of each voice model before commercial use.
