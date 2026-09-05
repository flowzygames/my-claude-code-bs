/* ------------------------------------------------------------------ *
 *  audio.js — everything you hear is synthesised with WebAudio.
 *  No sample files, so the whole game stays a few hundred KB of text.
 * ------------------------------------------------------------------ */
'use strict';

const Sound = {
  ctx: null,
  master: null,
  droneGain: null,
  ready: false,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.ready = true;
    this._buildNoise();
    this._startDrone();
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  /* --- shared white-noise buffer --------------------------------- */
  _buildNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  },

  _noise(dur, gain, filterType, freq, q) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType || 'lowpass';
    f.frequency.value = freq || 900;
    if (q) f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
    return { src, filter: f, gain: g, t };
  },

  _tone(type, freq, dur, gain, dest) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
    return { osc: o, gain: g, t };
  },

  /* --- ambience: a low, uneasy house drone ------------------------ */
  _startDrone() {
    const t = this.ctx.currentTime;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.connect(this.master);

    [46, 69, 92.5].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = i === 2 ? 0.06 : 0.16;
      // slow detune wobble keeps it from sounding like a test tone
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.037;
      const lg = this.ctx.createGain();
      lg.gain.value = 1.6;
      lfo.connect(lg); lg.connect(o.detune);
      lfo.start(t);
      o.connect(g); g.connect(this.droneGain);
      o.start(t);
    });

    // distant wind
    const w = this._noise(1e6, 0, 'lowpass', 280, 1);
    w.gain.gain.value = 0.055;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = this.ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg); lg.connect(w.filter.frequency);
    lfo.start(t);
    w.gain.disconnect(); w.gain.connect(this.droneGain);
  },

  /** 0 = menu silence, 1 = exploring, 2 = she is coming. */
  setTension(v) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.linearRampToValueAtTime(U.clamp(v, 0, 1) * 0.5, t + 1.2);
  },

  /* ------------------------- effects ----------------------------- */

  /** Floorboard creak — pitch varies so repeated steps aren't a metronome. */
  step(vol, wood) {
    if (!this.ready) return;
    const n = this._noise(0.14, 0, wood ? 'bandpass' : 'lowpass',
                          wood ? U.rand(260, 520) : U.rand(120, 220), 3);
    n.gain.gain.linearRampToValueAtTime(vol * 0.5, n.t + 0.012);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.14);
  },

  creak() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = U.rand(180, 320);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * U.rand(1.4, 2.2), t + 0.55);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 700; flt.Q.value = 7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(flt); flt.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.62);
  },

  doorSlam() {
    if (!this.ready) return;
    const n = this._noise(0.4, 0, 'lowpass', 400, 1);
    n.gain.gain.linearRampToValueAtTime(0.55, n.t + 0.006);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.38);
    this._tone('sine', 72, 0.35, 0.4);
  },

  pickup() {
    if (!this.ready) return;
    this._tone('triangle', 660, 0.1, 0.10);
    setTimeout(() => this.ready && this._tone('triangle', 990, 0.14, 0.08), 70);
  },

  deny() {
    if (!this.ready) return;
    this._tone('square', 150, 0.12, 0.07);
    setTimeout(() => this.ready && this._tone('square', 110, 0.18, 0.06), 90);
  },

  click() {
    if (!this.ready) return;
    const n = this._noise(0.06, 0, 'bandpass', 2200, 8);
    n.gain.gain.linearRampToValueAtTime(0.18, n.t + 0.003);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.06);
  },

  unlock() {
    if (!this.ready) return;
    const n = this._noise(0.25, 0, 'bandpass', 2600, 6);
    n.gain.gain.linearRampToValueAtTime(0.16, n.t + 0.02);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.25);
    setTimeout(() => this.ready && this._tone('square', 320, 0.16, 0.10), 180);
  },

  smash() {
    if (!this.ready) return;
    const n = this._noise(0.7, 0, 'highpass', 700, 1);
    n.gain.gain.linearRampToValueAtTime(0.5, n.t + 0.005);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.55);
    this._tone('sine', 90, 0.3, 0.34);
  },

  gunshot() {
    if (!this.ready) return;
    const n = this._noise(0.3, 0, 'bandpass', 1800, 1.4);
    n.gain.gain.linearRampToValueAtTime(0.42, n.t + 0.004);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.26);
    this._tone('sine', 180, 0.2, 0.2);
  },

  trapSnap() {
    if (!this.ready) return;
    const n = this._noise(0.25, 0, 'bandpass', 3200, 5);
    n.gain.gain.linearRampToValueAtTime(0.5, n.t + 0.003);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 0.22);
    this._tone('square', 420, 0.14, 0.16);
  },

  /** Her shriek when she spots you. */
  scream() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      o.type = i ? 'sawtooth' : 'square';
      const base = 420 + i * 130;
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 1.7, t + 0.18);
      o.frequency.linearRampToValueAtTime(base * 0.7, t + 0.95);
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = 1400 + i * 400; flt.Q.value = 4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.13 - i * 0.03, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(flt); flt.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 1.05);
    }
  },

  /** Sting for the moment she reaches you. */
  caught() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 1.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1.55);
    const n = this._noise(1.2, 0, 'lowpass', 900, 1);
    n.gain.gain.linearRampToValueAtTime(0.3, n.t + 0.01);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, n.t + 1.1);
  },

  heartbeat(intensity) {
    if (!this.ready) return;
    const thud = (delay, amp) => {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(78, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * intensity, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.24);
    };
    thud(0, 0.34); thud(0.19, 0.22);
  },

  escapeFanfare() {
    if (!this.ready) return;
    [392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.ready && this._tone('triangle', f, 0.9, 0.12), i * 150));
  },
};
