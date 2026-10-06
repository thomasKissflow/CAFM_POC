// Browser audio for Gemini Live: mic capture at 16 kHz PCM (AudioWorklet) and gapless 24 kHz PCM playback
// that can be flushed instantly when the caller barges in.

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;

  /** Throws DOMException NotAllowedError / NotFoundError when the mic is blocked or missing. */
  async start(onChunk: (pcm16: ArrayBuffer) => void, onLevel: (level: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule(new URL("worklets/pcm-capture.js", document.baseURI).href);
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "pcm-capture");
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
      onChunk(e.data.pcm);
      onLevel(Math.min(1, e.data.level * 4));
    };
    src.connect(this.node);
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  stop() {
    if (this.node !== null) { this.node.port.onmessage = null; this.node.disconnect(); this.node = null; }
    if (this.stream !== null) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.ctx !== null) { void this.ctx.close(); this.ctx = null; }
  }
}

export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nextAt = 0;
  private live = new Set<AudioBufferSourceNode>();
  private idleCb: () => void;
  muted = false;

  constructor(onIdle: () => void, private readonly rate = 24000) { this.idleCb = onIdle; }

  /** Must be called from a user gesture (Start button) so browsers allow sound. */
  unlock() {
    if (this.ctx === null) {
      this.ctx = new AudioContext({ sampleRate: this.rate });
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get playing() { return this.live.size > 0; }

  setMuted(m: boolean) { this.muted = m; if (this.gain !== null) this.gain.gain.value = m ? 0 : 1; }

  /** Queue one chunk of 16-bit little-endian mono PCM (base64 from the Live API). */
  enqueueBase64(b64: string) {
    if (this.ctx === null || this.gain === null) return;
    const bin = atob(b64);
    const n = bin.length >> 1;
    const buf = this.ctx.createBuffer(1, n, this.rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      ch[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const at = Math.max(this.ctx.currentTime + 0.02, this.nextAt);
    src.start(at);
    this.nextAt = at + buf.duration;
    this.live.add(src);
    src.onended = () => { this.live.delete(src); if (this.live.size === 0) this.idleCb(); };
  }

  /** Barge-in: stop everything now and drop what was queued. */
  flush() {
    for (const s of this.live) { s.onended = null; try { s.stop(); } catch { /* already stopped */ } }
    this.live.clear();
    this.nextAt = 0;
  }

  close() { this.flush(); if (this.ctx !== null) { void this.ctx.close(); this.ctx = null; this.gain = null; } }
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
