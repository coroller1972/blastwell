export class SoundFx {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  resume() {
    if (!this.enabled) return;
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      this.context.resume();
    }
  }

  tick() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.035);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  land() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(54, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  explosion() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 1;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** 1.45;
    }

    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(1450, now + 0.22);
    filter.frequency.exponentialRampToValueAtTime(520, now + duration);
    filter.Q.setValueAtTime(0.7, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.42, now + 0.024);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter).connect(gain).connect(ctx.destination);

    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(74, now);
    boom.frequency.exponentialRampToValueAtTime(32, now + 0.55);
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
    boom.connect(boomGain).connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
    boom.start(now);
    boom.stop(now + 0.84);
  }

  bombExplosion() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.95;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** 1.05;
    }

    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2100, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter).connect(gain).connect(ctx.destination);

    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = "sawtooth";
    impact.frequency.setValueAtTime(92, now);
    impact.frequency.exponentialRampToValueAtTime(24, now + 0.7);
    impactGain.gain.setValueAtTime(0.0001, now);
    impactGain.gain.exponentialRampToValueAtTime(0.3, now + 0.014);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    impact.connect(impactGain).connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
    impact.start(now);
    impact.stop(now + 0.92);
  }

  ready() {
    if (!this.context || this.context.state !== "running") return null;
    return this.context;
  }
}
