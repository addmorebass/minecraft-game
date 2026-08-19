export class AudioBus {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, type = "square", gain = 0.06, slide = 0) {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  noise(dur, gain = 0.08) {
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  shoot(heavy) {
    this.noise(heavy ? 0.12 : 0.07, heavy ? 0.12 : 0.07);
    this.tone(heavy ? 140 : 220, 0.08, "sawtooth", 0.04, -80);
  }

  rocket() {
    this.noise(0.22, 0.16);
    this.tone(90, 0.28, "sawtooth", 0.1, -70);
    this.tone(240, 0.12, "square", 0.05, -120);
  }

  reload() {
    this.tone(180, 0.08, "square", 0.04);
    setTimeout(() => this.tone(240, 0.08, "square", 0.04), 180);
  }

  hit() {
    this.tone(520, 0.05, "square", 0.05);
  }

  hurt() {
    this.tone(90, 0.16, "sawtooth", 0.07, -40);
  }

  plantBeep() {
    this.tone(880, 0.07, "square", 0.05);
  }

  bombTick() {
    this.tone(640, 0.04, "square", 0.04);
  }

  explode() {
    this.noise(0.5, 0.2);
    this.tone(80, 0.4, "sawtooth", 0.1, -50);
  }

  crack() {
    this.noise(0.08, 0.09);
    this.tone(160, 0.07, "square", 0.035, -90);
  }

  moan() {
    this.tone(70 + Math.random() * 40, 0.42, "sawtooth", 0.055, -30);
    this.noise(0.18, 0.04);
  }

  win() {
    this.tone(392, 0.12, "square", 0.06);
    setTimeout(() => this.tone(523, 0.12, "square", 0.06), 120);
    setTimeout(() => this.tone(659, 0.2, "square", 0.06), 240);
  }

  lose() {
    this.tone(220, 0.16, "sawtooth", 0.06, -60);
    setTimeout(() => this.tone(140, 0.22, "sawtooth", 0.06, -40), 180);
  }
}
