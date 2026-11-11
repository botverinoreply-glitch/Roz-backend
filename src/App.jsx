import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, Check, ChevronDown, CircleHelp, Download, Globe2, Headphones,
  LockKeyhole, Mic2, Search, SlidersHorizontal, Sparkles,
  Square, Trash2, Volume2, WandSparkles, X
} from 'lucide-react';

const STORAGE_KEY = 'roz-studio-v2';
const DEFAULT_SETTINGS = { rate: 1, pitch: 1, volume: 1 };
const CUES = [
  { label: 'Pause 1s', token: '[pause: 1s]' },
  { label: 'Silence 2s', token: '[silence: 2s]' },
  { label: 'Whisper', token: '[whisper]' },
  { label: 'Shout', token: '[shout]' },
  { label: 'Slow', token: '[slow]' },
  { label: 'Fast', token: '[fast]' },
  { label: 'Normal', token: '[normal]' },
  { label: 'Stop', token: '[stop]' },
];

const readSaved = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      script: typeof parsed.script === 'string' ? parsed.script : '',
      selectedVoiceId: parsed.selectedVoiceId || '',
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch {
    return { script: '', selectedVoiceId: '', settings: DEFAULT_SETTINGS };
  }
};

const getFlag = (locale = '') => {
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  const flags = {
    US: '🇺🇸', GB: '🇬🇧', AU: '🇦🇺', CA: '🇨🇦', IN: '🇮🇳', ES: '🇪🇸', MX: '🇲🇽',
    AR: '🇦🇷', CO: '🇨🇴', FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', PT: '🇵🇹', BR: '🇧🇷',
    NL: '🇳🇱', BE: '🇧🇪', RU: '🇷🇺', JP: '🇯🇵', CN: '🇨🇳', TW: '🇹🇼', KR: '🇰🇷',
    SA: '🇸🇦', AE: '🇦🇪', TR: '🇹🇷', PL: '🇵🇱', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰',
    FI: '🇫🇮', GR: '🇬🇷', UA: '🇺🇦', ID: '🇮🇩', TH: '🇹🇭', VN: '🇻🇳', IE: '🇮🇪',
    NZ: '🇳🇿', ZA: '🇿🇦', KE: '🇰🇪', EG: '🇪🇬', IL: '🇮🇱', CH: '🇨🇭', AT: '🇦🇹'
  };
  return flags[region] || '🌐';
};

const colorFor = (name = '') => {
  const colors = ['mint', 'violet', 'blue', 'peach', 'rose', 'amber', 'cyan'];
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

function VoiceAvatar({ voice, large = false }) {
  const initials = (voice?.name || 'Voice').split(/[\s-]+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <span className={`voice-avatar ${colorFor(voice?.name)} ${large ? 'large' : ''}`} aria-hidden="true">
      <span className="avatar-wave"><AudioLines size={large ? 18 : 15} strokeWidth={2.2} /></span>
      <span className="avatar-initials">{initials}</span>
      <span className="avatar-flag">{getFlag(voice?.lang)}</span>
    </span>
  );
}

function splitText(text, maxLength = 220) {
  const result = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf(' ', maxLength);
    const sentenceCut = Math.max(
      remaining.lastIndexOf('. ', maxLength), remaining.lastIndexOf('! ', maxLength),
      remaining.lastIndexOf('? ', maxLength), remaining.lastIndexOf('\n', maxLength)
    );
    if (sentenceCut > Math.floor(maxLength * 0.55)) cut = sentenceCut + 1;
    if (cut < Math.floor(maxLength * 0.45)) cut = maxLength;
    result.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}

function App() {
  const [saved, setSaved] = useState(readSaved);
  const [voices, setVoices] = useState([]);
  const [query, setQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [audioState, setAudioState] = useState('idle');
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const textareaRef = useRef(null);
  const playbackId = useRef(0);
  const toastTimer = useRef(null);

  const updateSaved = useCallback((patch) => {
    setSaved((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* browser storage may be full */ }
  }, [saved]);

  const refreshVoices = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const found = window.speechSynthesis.getVoices().map((voice) => ({
      id: voice.voiceURI || `${voice.name}-${voice.lang}`,
      name: voice.name || 'System voice',
      lang: voice.lang || '',
      default: Boolean(voice.default),
      nativeVoice: voice,
    }));
    setVoices(found);
  }, []);

  useEffect(() => {
    refreshVoices();
    if (!('speechSynthesis' in window)) return undefined;
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    const fallbackTimer = window.setTimeout(refreshVoices, 500);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
    };
  }, [refreshVoices]);

  useEffect(() => () => {
    playbackId.current += 1;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const selectedVoice = useMemo(() => (
    voices.find((voice) => voice.id === saved.selectedVoiceId) || voices.find((voice) => voice.default) || voices[0] || null
  ), [voices, saved.selectedVoiceId]);

  useEffect(() => {
    if (selectedVoice && selectedVoice.id !== saved.selectedVoiceId) updateSaved({ selectedVoiceId: selectedVoice.id });
  }, [selectedVoice, saved.selectedVoiceId, updateSaved]);

  const filteredVoices = useMemo(() => voices.filter((voice) => {
    const matchesQuery = `${voice.name} ${voice.lang}`.toLowerCase().includes(query.toLowerCase());
    const language = voice.lang.split('-')[0].toLowerCase();
    const matchesLanguage = languageFilter === 'all' || (languageFilter === 'en' ? language === 'en' : languageFilter === 'es' ? language === 'es' : language !== 'en' && language !== 'es');
    return matchesQuery && matchesLanguage;
  }), [voices, query, languageFilter]);

  const notify = (message) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3000);
  };

  const insertCue = (token) => {
    const area = textareaRef.current;
    const start = area?.selectionStart ?? saved.script.length;
    const end = area?.selectionEnd ?? saved.script.length;
    const next = `${saved.script.slice(0, start)}${start > 0 && saved.script[start - 1] !== ' ' ? ' ' : ''}${token} ${saved.script.slice(end)}`;
    updateSaved({ script: next });
    requestAnimationFrame(() => {
      area?.focus();
      const cursor = start + token.length + (start > 0 && saved.script[start - 1] !== ' ' ? 2 : 1);
      area?.setSelectionRange(cursor, cursor);
    });
  };

  const stopAudio = () => {
    playbackId.current += 1;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setAudioState('idle');
  };

  const wait = (milliseconds, id) => new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      window.clearInterval(check);
      resolve();
    };
    const timer = window.setTimeout(finish, milliseconds);
    const check = window.setInterval(() => {
      if (id !== playbackId.current) finish();
    }, 50);
  });

  const speakText = async (text, options, id) => {
    for (const part of splitText(text)) {
      if (id !== playbackId.current) return;
      await new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(part);
        if (selectedVoice?.nativeVoice) utterance.voice = selectedVoice.nativeVoice;
        utterance.rate = options.rate;
        utterance.pitch = options.pitch;
        utterance.volume = options.volume;
        utterance.onend = resolve;
        utterance.onerror = (event) => event.error === 'canceled' || event.error === 'interrupted' ? resolve() : reject(event.error);
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const generateVoice = async () => {
    if (!saved.script.trim()) { notify('Add a script before generating a voice.'); return; }
    if (!('speechSynthesis' in window)) { notify('Voice playback is not supported in this browser.'); return; }
    stopAudio();
    const id = playbackId.current;
    setAudioState('playing');
    const base = { ...saved.settings };
    let options = { ...base };
    const tokenPattern = /\[(?:silence|pause):\s*(\d+(?:\.\d+)?)s\]|\[\[(?:p)(\d+)\]\]|\[(whisper|shout|slow|fast|normal|stop)\]/gi;
    let cursor = 0;
    try {
      for (const match of saved.script.matchAll(tokenPattern)) {
        if (id !== playbackId.current) return;
        const textBefore = saved.script.slice(cursor, match.index);
        if (textBefore.trim()) await speakText(textBefore, options, id);
        const duration = match[1] ? Number(match[1]) * 1000 : match[2] ? Number(match[2]) : null;
        const command = (match[3] || '').toLowerCase();
        if (duration !== null) await wait(Math.min(duration, 15000), id);
        else if (command === 'stop') { stopAudio(); return; }
        else if (command === 'whisper') options = { ...options, volume: Math.min(base.volume, 0.32), rate: Math.max(0.75, base.rate * 0.9) };
        else if (command === 'shout') options = { ...options, volume: base.volume, pitch: Math.min(2, base.pitch * 1.18), rate: Math.min(1.5, base.rate * 1.05) };
        else if (command === 'slow') options = { ...options, rate: Math.max(0.5, base.rate * 0.75) };
        else if (command === 'fast') options = { ...options, rate: Math.min(2, base.rate * 1.25) };
        else if (command === 'normal') options = { ...base };
        cursor = match.index + match[0].length;
      }
      const tail = saved.script.slice(cursor);
      if (tail.trim() && id === playbackId.current) await speakText(tail, options, id);
      if (id === playbackId.current) setAudioState('idle');
    } catch {
      if (id === playbackId.current) { setAudioState('idle'); notify('The selected voice could not be played.'); }
    }
  };

  const downloadScript = () => {
    const blob = new Blob([saved.script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roz-script.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = saved.script.trim() ? saved.script.trim().split(/\s+/).length : 0;

  return (
    <div className="site-shell">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="roz home"><img src="/roz-logo.png" alt="roz" /><span>VOICE STUDIO</span></a>
        <nav className="header-nav" aria-label="Main navigation"><a href="#studio">Studio</a><a href="#why-roz">Why roz</a><a href="#faq">FAQ</a></nav>
        <a className="header-cta" href="#studio">Start creating <span>↗</span></a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR WORDS. YOUR VOICE.</div>
            <h1>Give your words<br /><em>a voice.</em></h1>
            <p className="hero-description">Turn scripts into speech with a voice that feels right. Simple controls, a library you can explore, and a creative space that stays out of your way.</p>
            <a className="hero-button" href="#studio"><WandSparkles size={16} /> Create your voice <span>↓</span></a>
            <div className="hero-trust"><span><LockKeyhole size={13} /> No account needed</span><span><Sparkles size={13} /> No API keys</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="art-core"><AudioLines size={54} strokeWidth={1.25} /><span>roz</span></div>
            <div className="art-float float-top"><span className="float-pulse" /> Natural voices</div>
            <div className="art-float float-bottom"><Volume2 size={15} /> Made to be heard</div>
            <div className="art-star star-one">✳</div><div className="art-star star-two">✦</div>
          </div>
        </section>

        <section id="studio" className="studio-section">
          <div className="section-intro"><div><span className="section-kicker">THE STUDIO</span><h2>Make something <em>you can hear.</em></h2></div><div className="save-indicator"><span /> Saved on this device</div></div>
          <div className="studio-grid">
            <section className="studio-panel script-panel">
              <div className="panel-heading"><div><span className="panel-overline">01 / YOUR CONTENT</span><h3>Your script</h3></div><span className="panel-icon"><Mic2 size={18} /></span></div>
              <div className="script-toolbar"><span>ADD A DELIVERY CUE</span><div className="cue-list">{CUES.map((cue) => <button key={cue.token} className="cue-chip" onClick={() => insertCue(cue.token)}>{cue.label}</button>)}</div></div>
              <textarea ref={textareaRef} className="script-input" value={saved.script} onChange={(event) => updateSaved({ script: event.target.value })} placeholder="Start typing or paste your script here...\n\nYour story starts with a few words." spellCheck="true" aria-label="Your script" />
              <div className="script-footer"><div className="script-stats"><strong>{saved.script.length.toLocaleString()}</strong><span>characters</span><i /> <strong>{wordCount.toLocaleString()}</strong><span>words</span></div><div className="script-actions"><button className="subtle-button" onClick={downloadScript} disabled={!saved.script}><Download size={14} /> Export text</button><button className="subtle-button danger" onClick={() => updateSaved({ script: '' })} disabled={!saved.script}><Trash2 size={14} /> Clear</button></div></div>
              <div className="cue-hint"><CircleHelp size={14} /><span>Use cues like <code>[pause: 1s]</code>, <code>[whisper]</code>, <code>[slow]</code> or <code>[stop]</code> to shape the delivery.</span></div>
            </section>

            <section className="studio-panel library-panel">
              <div className="panel-heading"><div><span className="panel-overline">02 / FIND YOUR SOUND</span><h3>Voice library</h3></div><span className="voice-number">{voices.length.toString().padStart(2, '0')} <small>voices</small></span></div>
              <div className="voice-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search voices or languages..." aria-label="Search voices" /><kbd>/</kbd></div>
              <div className="voice-filters" aria-label="Filter voices"><button className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}>All voices</button><button className={languageFilter === 'en' ? 'active' : ''} onClick={() => setLanguageFilter('en')}>English</button><button className={languageFilter === 'es' ? 'active' : ''} onClick={() => setLanguageFilter('es')}>Spanish</button><button className={languageFilter === 'other' ? 'active' : ''} onClick={() => setLanguageFilter('other')}>Other</button></div>
              <div className="voice-list">
                {filteredVoices.length ? filteredVoices.map((voice) => (
                  <button key={voice.id} className={`voice-item ${selectedVoice?.id === voice.id ? 'selected' : ''}`} onClick={() => updateSaved({ selectedVoiceId: voice.id })}>
                    <VoiceAvatar voice={voice} />
                    <span className="voice-info"><strong>{voice.name}</strong><span>{voice.lang || 'Language not specified'} {voice.default ? '· Default' : ''}</span></span>
                    <span className="voice-select-mark">{selectedVoice?.id === voice.id ? <Check size={14} /> : <span />}</span>
                  </button>
                )) : <div className="empty-voices"><Globe2 size={25} /><strong>{voices.length ? 'No voices found' : 'Looking for available voices'}</strong><p>{voices.length ? 'Try a different search or filter.' : 'Your browser and device provide the voices shown here. If none appear, check your system speech settings.'}</p><button onClick={refreshVoices}>Refresh voice list</button></div>}
              </div>
              <div className="library-note"><Globe2 size={14} /><span>Voice availability depends on your browser, operating system and installed languages.</span></div>
            </section>
          </div>

          <section className="generation-panel">
            <div className="generation-voice">
              {selectedVoice ? <VoiceAvatar voice={selectedVoice} large /> : <span className="no-voice-icon"><Headphones size={23} /></span>}
              <div><span className="generation-label">YOUR SELECTED VOICE</span><strong>{selectedVoice?.name || 'Choose a voice'}</strong><span>{selectedVoice?.lang || 'Select an available device voice'}</span></div>
              <button className="settings-toggle" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}><SlidersHorizontal size={15} /> Voice settings <ChevronDown size={14} className={settingsOpen ? 'rotated' : ''} /></button>
            </div>
            {settingsOpen && <div className="voice-settings">
              <label><span>Speed <b>{saved.settings.rate.toFixed(1)}×</b></span><input type="range" min="0.5" max="2" step="0.1" value={saved.settings.rate} onChange={(event) => updateSaved({ settings: { ...saved.settings, rate: Number(event.target.value) } })} /></label>
              <label><span>Pitch <b>{saved.settings.pitch.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" value={saved.settings.pitch} onChange={(event) => updateSaved({ settings: { ...saved.settings, pitch: Number(event.target.value) } })} /></label>
              <label><span>Volume <b>{Math.round(saved.settings.volume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={saved.settings.volume} onChange={(event) => updateSaved({ settings: { ...saved.settings, volume: Number(event.target.value) } })} /></label>
              <button className="reset-settings" onClick={() => updateSaved({ settings: { ...DEFAULT_SETTINGS } })}>Reset settings</button>
            </div>}
            <div className="generate-row"><div className="generate-note"><span className="generate-live-dot" /><span>{audioState === 'playing' ? 'Your voice is playing' : 'Ready when you are'}</span></div>
              {audioState === 'playing' ? <button className="generate-button stop-button" onClick={stopAudio}><Square size={16} fill="currentColor" /> Stop playback</button> : <button className="generate-button" onClick={generateVoice} disabled={!saved.script.trim() || !selectedVoice}><Sparkles size={17} /> Generate voice <span className="button-arrow">→</span></button>}
            </div>
          </section>
          <p className="playback-disclaimer">Playback uses the voices available on your device. Voice playback is supported by most modern browsers.</p>
        </section>

        <section id="why-roz" className="why-section">
          <div className="why-heading"><span className="section-kicker">WHY ROZ</span><h2>Less setup.<br /><em>More storytelling.</em></h2><p>Everything you need to bring an idea to life, without making the process complicated.</p></div>
          <div className="benefit-grid">
            <article className="benefit-card"><span className="benefit-icon purple"><WandSparkles size={20} /></span><h3>Simple by design</h3><p>A clean workspace that keeps your script, voice choices and playback controls in one place.</p></article>
            <article className="benefit-card"><span className="benefit-icon mint"><LockKeyhole size={20} /></span><h3>Your space, your pace</h3><p>No account or API key required. Your script and preferences are saved locally in your browser.</p></article>
            <article className="benefit-card"><span className="benefit-icon blue"><Globe2 size={20} /></span><h3>Voices across languages</h3><p>Explore the voices and languages made available by your device and operating system.</p></article>
            <article className="benefit-card"><span className="benefit-icon orange"><SlidersHorizontal size={20} /></span><h3>Shape the delivery</h3><p>Fine-tune speed, pitch and volume, then add pauses and performance cues to your script.</p></article>
          </div>
        </section>

        <section id="faq" className="faq-section"><div><span className="section-kicker">GOOD TO KNOW</span><h2>A few quick <em>answers.</em></h2></div><div className="faq-list">
          <details><summary>Do I need to create an account? <ChevronDown size={17} /></summary><p>No. roz works without signing up. Your script and settings are stored in your browser on this device.</p></details>
          <details><summary>Do I need an API key? <ChevronDown size={17} /></summary><p>No API key is needed. roz uses the voice options already available through your browser and device.</p></details>
          <details><summary>Why do I see different voices on different devices? <ChevronDown size={17} /></summary><p>The available voices depend on your browser, operating system and installed language packs. Another device may offer a different selection.</p></details>
          <details><summary>Can I save an audio file? <ChevronDown size={17} /></summary><p>This version plays speech in your browser and can export your script as a text file. Audio-file export is not included in this version.</p></details>
        </div></section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#top"><img src="/roz-logo.png" alt="roz" /><span>VOICE STUDIO</span></a><p>Made for ideas worth hearing.</p><span className="footer-copy">© {new Date().getFullYear()} roz</span></footer>
      {toast && <div className="toast-message" role="status"><Check size={15} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </div>
  );
}

export default App;
