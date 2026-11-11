# roz Piper worker

This service runs Piper TTS and FFmpeg outside Vercel. It exposes authenticated voice/job endpoints.

## Run locally
1. Install Docker.
2. Put Piper voice model pairs in `worker/voices/` (each `.onnx` must have its matching `.onnx.json`).
3. Build and run:

```bash
docker build -t roz-piper ./worker
docker run --rm -p 8000:8000 \
  -e PIPER_WORKER_SECRET='replace-with-a-long-random-secret' \
  -v "$PWD/worker/voices:/voices" roz-piper
```

Health: `http://localhost:8000/health`

## Voice models
Download compatible Piper models from the official Piper voice collection/release source. Check each model's license and redistribution terms before including it in a public product. Do not commit model files to this repository.

## Production note
This starter uses an in-memory job registry and local temporary files. It is suitable for development/single-instance testing only. For production, use a persistent queue (Redis/managed queue), object storage (S3/R2), worker concurrency limits, per-user quotas, job expiry, and durable status storage. Keep the worker on a persistent container host; Vercel only calls it through the API proxy.
