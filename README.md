# roz — Voice Studio

An English-language React + Vite frontend for creating spoken script playback with voices available on the user's browser/device.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
npm run preview
```

## What's included

- One-page dark responsive website using the supplied roz logo.
- English-only interface: script editor, device voice library, voice settings and Generate voice action.
- No account, login or API key required.
- Real voice list detected through the browser SpeechSynthesis API. No fabricated third-party voice catalog.
- Unique voice card identity using a generated initials mark, color treatment and language flag. These are custom UI avatars, not official logos for individual voices.
- Search and language filters for the voices actually available on the device.
- Playback settings for speed, pitch and volume.
- Script cues: `[pause: 1s]`, `[silence: 2s]`, `[whisper]`, `[shout]`, `[slow]`, `[fast]`, `[normal]`, `[stop]`.
- Automatic local saving in browser storage and text-file export.
- Long scripts are internally divided into smaller utterances for browser playback. No visible parts/chunks tab or engine selector.
- “Why roz” and FAQ sections below the studio.

## Voice availability and limits

roz uses the voices exposed by the browser and operating system through `SpeechSynthesis`. The available voices vary by device, browser, language packs and system configuration. No API key or external voice-provider account is required. This version plays speech in the browser; it does not export MP3/WAV audio files. Text export is available. Browser storage has device-specific limits.

## Deploy

This is a Vite static frontend and can be deployed to Netlify, Cloudflare Pages, Vercel or another static hosting service. Build command: `npm run build`. Output directory: `dist`.
