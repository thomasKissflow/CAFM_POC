// Speech layer (browser). Phase 7 swaps these for Google Cloud streaming STT/TTS behind the same shapes.
import type { Lang } from "@/domain/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  onspeechstart: (() => void) | null;
};

const RecognitionCtor = (): (new () => Recognition) | undefined => {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function speechSupport() {
  return {
    stt: typeof window !== "undefined" && RecognitionCtor() !== undefined,
    tts: typeof window !== "undefined" && "speechSynthesis" in window
  };
}

export const localeFor = (lang: Lang) => (lang === "ar" ? "ar-AE" : "en-GB");

/** Continuous recognizer that keeps itself alive across the browser's silence timeouts. */
export class Listener {
  private rec: Recognition | null = null;
  private active = false;
  constructor(
    private handlers: { onInterim: (t: string) => void; onFinal: (t: string) => void; onError: (msg: string) => void }
  ) {}

  start(lang: Lang) {
    const Ctor = RecognitionCtor();
    if (Ctor === undefined) return this.handlers.onError("Speech recognition is not available in this browser");
    this.stop();
    const rec = new Ctor();
    rec.lang = localeFor(lang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.handlers.onFinal(r[0].transcript);
        else interim += r[0].transcript;
      }
      if (interim) this.handlers.onInterim(interim);
    };
    rec.onerror = (e) => {
      if (e?.error === "no-speech" || e?.error === "aborted") return;
      if (e?.error === "not-allowed") this.handlers.onError("Microphone permission was denied");
      else this.handlers.onError(String(e?.error ?? "recognition error"));
    };
    rec.onend = () => {
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* already restarting */
        }
      }
    };
    this.rec = rec;
    this.active = true;
    try {
      rec.start();
    } catch {
      /* started */
    }
  }

  stop() {
    this.active = false;
    if (this.rec) {
      this.rec.onend = null;
      try {
        this.rec.abort();
      } catch {
        /* noop */
      }
    }
    this.rec = null;
  }
}

/** Sentence-queue speaker. Speaks as text streams in; can be cut off instantly (barge-in). */
export class Speaker {
  private queue: string[] = [];
  private speaking = false;
  private spokenChars = 0;
  private current = "";
  private utteranceSeq = 0;
  enabled = true;
  constructor(private handlers: { onStart: () => void; onIdle: () => void; onProgress: (spokenChars: number) => void }) {}

  private voiceFor(lang: Lang) {
    const voices = window.speechSynthesis.getVoices();
    const want = localeFor(lang).toLowerCase();
    const prefix = lang;
    const pref = lang === "ar" ? ["Maged", "Laila", "Google العربية", "ar-SA", "ar-AE"] : ["Google UK English Female", "Serena", "Kate", "Samantha", "Daniel"];
    for (const p of pref) {
      const v = voices.find((x) => x.name.includes(p) || x.lang === p);
      if (v) return v;
    }
    return voices.find((v) => v.lang.toLowerCase() === want) ?? voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  }

  /** Call once from a user gesture (iOS/Safari require it before any speech). */
  unlock() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  enqueue(sentence: string, lang: Lang) {
    const s = sentence.trim();
    if (!s) return;
    this.queue.push(`${lang}|${s}`);
    if (!this.speaking) this.next();
  }

  private next() {
    const item = this.queue.shift();
    if (item === undefined) {
      this.speaking = false;
      this.handlers.onIdle();
      return;
    }
    const [lang, text] = [item.slice(0, 2) as Lang, item.slice(3)];
    this.current = text;
    if (!this.speaking) this.handlers.onStart();
    this.speaking = true;
    if (!this.enabled || !("speechSynthesis" in window)) {
      // silent mode: pace like speech so the UI still reads naturally (~15 chars/s)
      const ms = Math.min(6000, 350 + text.length * 55);
      window.setTimeout(() => {
        this.spokenChars += text.length + 1;
        this.handlers.onProgress(this.spokenChars);
        this.next();
      }, ms);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = localeFor(lang);
    const v = this.voiceFor(lang);
    if (v) u.voice = v;
    u.rate = lang === "ar" ? 1.0 : 1.05;
    const base = this.spokenChars;
    const token = ++this.utteranceSeq;
    let finished = false;
    const finish = () => {
      if (finished || token !== this.utteranceSeq) return;
      finished = true;
      window.clearTimeout(watchdog);
      this.spokenChars = base + text.length + 1;
      this.handlers.onProgress(this.spokenChars);
      this.next();
    };
    // Some engines (headless, some webviews) never fire onend: don't let the call hang.
    const watchdog = window.setTimeout(finish, 2500 + text.length * 90);
    u.onboundary = (e) => this.handlers.onProgress(base + e.charIndex);
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  }

  get isSpeaking() {
    return this.speaking;
  }
  get currentSentence() {
    return this.current;
  }

  /** Stop immediately (caller barged in). Returns how many characters had been spoken this turn. */
  cancel(): number {
    this.queue = [];
    this.utteranceSeq++; // orphan any in-flight utterance callbacks
    const spoken = this.spokenChars;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.speaking = false;
    return spoken;
  }

  resetTurn() {
    this.spokenChars = 0;
  }
}

/** Echo-cancelled mic level meter (0..1) — drives the visual and energy-based barge-in. */
export class MicMeter {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  async start(onLevel: (level: number) => void): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      return false;
    }
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const data = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
    return true;
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
  }
}

/** True when an interim transcript is most likely the agent's own voice picked up by the mic. */
export function isEcho(interim: string, agentText: string): boolean {
  const words = interim.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return true;
  const agent = agentText.toLowerCase();
  const overlap = words.filter((w) => agent.includes(w)).length / words.length;
  return overlap >= 0.6;
}
