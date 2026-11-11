import os, re, uuid, shutil, subprocess, threading, time
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="roz Piper Worker", version="1.0.0")
SECRET = os.environ.get("PIPER_WORKER_SECRET", "")
VOICES_DIR = Path(os.environ.get("VOICES_DIR", "/voices"))
JOBS_DIR = Path(os.environ.get("JOBS_DIR", "/tmp/roz-jobs"))
JOBS_DIR.mkdir(parents=True, exist_ok=True)
jobs = {}
lock = threading.Lock()

def auth(value):
    if not SECRET or value != f"Bearer {SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

def voice_catalog():
    # Install voice model pairs (.onnx + .onnx.json) in VOICES_DIR.
    result = []
    for model in sorted(VOICES_DIR.glob("*.onnx")):
        config = Path(str(model) + ".json")
        if config.exists():
            result.append({"id": model.stem, "name": model.stem.replace("_", " ").replace("-", " ").title(),
                           "model": model.name, "language": model.stem.split("-")[0]})
    return result

class JobRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200000)
    voice: str
    format: str = "both"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    noiseScale: Optional[float] = Field(default=None, ge=0.1, le=1.5)
    noiseW: float = Field(default=0.8, ge=0.1, le=1.5)
    sentenceSilence: float = Field(default=0.2, ge=0, le=3)

def split_text(text, limit=2500):
    # Split on whitespace near limit, preserving all characters when rejoined.
    parts=[]
    while len(text)>limit:
        cut=text.rfind(" ", 0, limit+1)
        if cut < limit//2: cut=limit
        parts.append(text[:cut])
        text=text[cut:]
    if text: parts.append(text)
    return parts

def run_job(job_id, payload):
    folder=JOBS_DIR/job_id
    folder.mkdir(parents=True, exist_ok=True)
    try:
        model=VOICES_DIR/(payload["voice"]+".onnx")
        if not model.exists() or not Path(str(model)+".json").exists():
            raise RuntimeError("Voice model not found")
        parts=split_text(payload["text"])
        wavs=[]
        for i, part in enumerate(parts):
            out=folder/f"part-{i:04d}.wav"
            cmd=["python","-m","piper","-m",str(model),"-f",str(out),"--length-scale",str(1/payload["speed"]),
                 "--sentence-silence",str(payload["sentenceSilence"])]
            if payload.get("noiseScale") is not None: cmd += ["--noise-scale",str(payload["noiseScale"])]
            cmd += ["--noise-w",str(payload["noiseW"])]
            subprocess.run(cmd, input=part, text=True, check=True, capture_output=True, timeout=900)
            wavs.append(out)
        concat=folder/"joined.wav"
        # ffmpeg concat demuxer safely joins PCM WAV segments.
        listing=folder/"files.txt"
        listing.write_text("".join(f"file '{p.name}'\\n" for p in wavs))
        subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(listing),"-c:a","pcm_s16le",str(concat)],
                       check=True, capture_output=True, timeout=900)
        outputs={}
        if payload["format"] in ("wav","both"): outputs["wav"]="/files/"+job_id+"/joined.wav"
        if payload["format"] in ("mp3","both"):
            mp3=folder/"joined.mp3"
            subprocess.run(["ffmpeg","-y","-i",str(concat),"-codec:a","libmp3lame","-qscale:a","2",str(mp3)],
                           check=True, capture_output=True, timeout=900)
            outputs["mp3"]="/files/"+job_id+"/joined.mp3"
        with lock: jobs[job_id]={"status":"completed","progress":100,"outputs":outputs}
    except Exception as e:
        with lock: jobs[job_id]={"status":"failed","progress":0,"error":str(e)[:500]}

@app.get("/health")
def health():
    return {"ok": True, "service":"roz-piper-worker"}

@app.get("/voices")
def voices(authorization: str = Header(default="")):
    auth(authorization)
    return {"voices": voice_catalog()}

@app.post("/jobs", status_code=202)
def create_job(payload: JobRequest, authorization: str = Header(default="")):
    auth(authorization)
    if payload.format not in ("mp3","wav","both"): raise HTTPException(400,"Invalid format")
    if payload.voice not in {v["id"] for v in voice_catalog()}: raise HTTPException(400,"Unknown voice")
    job_id=str(uuid.uuid4())
    with lock: jobs[job_id]={"status":"queued","progress":0}
    threading.Thread(target=run_job,args=(job_id,payload.model_dump()),daemon=True).start()
    return {"id":job_id,"status":"queued"}

@app.get("/jobs/{job_id}")
def get_job(job_id: str, authorization: str = Header(default="")):
    auth(authorization)
    with lock: item=jobs.get(job_id)
    if not item: raise HTTPException(404,"Job not found or worker restarted")
    return {"id":job_id,**item}

@app.get("/files/{job_id}/{filename}")
def get_file(job_id: str, filename: str, authorization: str = Header(default="")):
    auth(authorization)
    if filename not in ("joined.wav","joined.mp3"): raise HTTPException(404,"Not found")
    path=JOBS_DIR/job_id/filename
    if not path.is_file(): raise HTTPException(404,"File not found")
    return FileResponse(path, filename=f"roz-{job_id}.{filename.split('.')[-1]}")
