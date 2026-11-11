FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng libsndfile1 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir piper-tts
COPY app.py .
ENV VOICES_DIR=/voices
RUN mkdir -p /voices /tmp/roz-jobs
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]