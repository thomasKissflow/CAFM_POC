// AudioWorklet: microphone (any device rate) → 16 kHz mono 16-bit PCM chunks (~40 ms) + an RMS level for the meter.
// Served as a static file (same origin) so it also loads inside the Kissflow Custom UI.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // input samples per output sample
    this.pos = 0;                    // fractional read position into the carried-over input
    this.carry = new Float32Array(0);
    this.out = new Int16Array(640);  // 40 ms at 16 kHz
    this.n = 0;
    this.sumSq = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const buf = new Float32Array(this.carry.length + ch.length);
    buf.set(this.carry); buf.set(ch, this.carry.length);
    let p = this.pos;
    // linear interpolation resampler (good enough for speech; the browser already low-passes the mic)
    while (p + 1 < buf.length) {
      const i = Math.floor(p), f = p - i;
      const s = buf[i] * (1 - f) + buf[i + 1] * f;
      const c = Math.max(-1, Math.min(1, s));
      this.out[this.n++] = c < 0 ? c * 0x8000 : c * 0x7fff;
      this.sumSq += c * c;
      if (this.n === this.out.length) {
        this.port.postMessage({ pcm: this.out.buffer.slice(0), level: Math.sqrt(this.sumSq / this.n) });
        this.n = 0; this.sumSq = 0;
      }
      p += this.ratio;
    }
    const keep = Math.floor(p);
    this.carry = buf.slice(keep);
    this.pos = p - keep;
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
