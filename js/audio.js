// Alle Klänge werden live mit der Web-Audio-Schnittstelle erzeugt – keine Audiodateien nötig.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI-Nummer -> Hz

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.musicTimer = null;
  }

  // Muss nach einer Berührung/Klick aufgerufen werden (Browser-Regel)
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createDynamicsCompressor();
      this.master.threshold.value = -14;
      this.master.ratio.value = 4;
      this.master.connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.gain.value = 0.9;
      this.music = c.createGain();
      this.music.gain.value = 0;
      this.reverb = c.createConvolver();
      this.reverb.buffer = this._impulse(2.2, 2.5);
      this.wet = c.createGain();
      this.wet.gain.value = 0.28;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.reverb.connect(this.wet).connect(this.master);
      this.sfx.connect(this.reverb);
      this.music.connect(this.reverb);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn && !this.musicTimer) this.startMusic();
  }

  _impulse(sec, decay) {
    const c = this.ctx;
    const len = c.sampleRate * sec;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // Ein einzelner Ton mit Hüllkurve
  _tone(freq, t, dur, { type = 'sine', gain = 0.3, attack = 0.005, out = this.sfx, detune = 0, slideTo = null, filter = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(filter, t);
      f.Q.value = 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Marimba-artiger Klang: Grundton + schnell abklingender Oberton
  _marimba(freq, t, gain = 0.25, out = this.sfx, dur = 0.6) {
    this._tone(freq, t, dur, { gain, out });
    this._tone(freq * 4, t, 0.12, { gain: gain * 0.35, out });
    this._tone(freq * 10, t, 0.04, { gain: gain * 0.12, out });
  }

  _bell(freq, t, gain = 0.2) {
    this._tone(freq, t, 1.4, { gain });
    this._tone(freq * 2.76, t, 0.7, { gain: gain * 0.35 });
    this._tone(freq * 5.4, t, 0.35, { gain: gain * 0.15 });
  }

  _noise(t, dur, { gain = 0.2, from = 400, to = 4000, q = 1.2, out = this.sfx, type = 'bandpass' } = {}) {
    const c = this.ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }

  _ok() { return this.ctx && this.sfxOn; }
  get now() { return this.ctx.currentTime + 0.01; }

  click() {
    if (!this._ok()) return;
    const t = this.now;
    this._tone(900, t, 0.07, { type: 'triangle', gain: 0.18, slideTo: 1300 });
  }

  tap() {
    if (!this._ok()) return;
    const t = this.now;
    this._tone(520, t, 0.09, { gain: 0.22, slideTo: 780 });
  }

  correct() {
    if (!this._ok()) return;
    const t = this.now;
    [72, 76, 79, 84].forEach((n, i) => this._marimba(NOTE(n), t + i * 0.075, 0.26));
    [96, 100, 103].forEach((n, i) => this._bell(NOTE(n), t + 0.32 + i * 0.06, 0.06));
  }

  wrong() {
    if (!this._ok()) return;
    const t = this.now;
    this._tone(NOTE(64), t, 0.22, { type: 'triangle', gain: 0.22, filter: 1400 });
    this._tone(NOTE(60), t + 0.16, 0.38, { type: 'triangle', gain: 0.22, filter: 1000, slideTo: NOTE(58) });
  }

  water() {
    if (!this._ok()) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) this._tone(500 + i * 180, t + i * 0.07, 0.1, { gain: 0.14, slideTo: 1200 + i * 200 });
  }

  whoosh() {
    if (!this._ok()) return;
    this._noise(this.now, 0.6, { gain: 0.09, from: 300, to: 2500, q: 0.8 });
  }

  reveal() {
    if (!this._ok()) return;
    const t = this.now;
    [67, 71, 74].forEach((n, i) => this._tone(NOTE(n), t + i * 0.12, 0.5, { type: 'sine', gain: 0.16 }));
  }

  tick(urgent = false) {
    if (!this._ok()) return;
    this._tone(urgent ? 1500 : 1100, this.now, 0.05, { type: 'square', gain: 0.05, filter: 3000 });
  }

  star(i) {
    if (!this._ok()) return;
    const t = this.now;
    this._bell(NOTE(84 + [0, 4, 7][i]), t, 0.18);
    this._noise(t, 0.4, { gain: 0.05, from: 6000, to: 12000, type: 'highpass' });
  }

  fanfare(stars) {
    if (!this._ok()) return;
    const t = this.now;
    const brass = (n, s, d, g = 0.12) => {
      this._tone(NOTE(n), t + s, d, { type: 'sawtooth', gain: g, attack: 0.03, filter: 2200 });
      this._tone(NOTE(n), t + s, d, { type: 'sawtooth', gain: g * 0.7, attack: 0.03, filter: 2200, detune: 9 });
    };
    if (stars >= 2) {
      brass(67, 0, 0.18); brass(67, 0.2, 0.18); brass(67, 0.4, 0.18);
      brass(72, 0.6, 0.9, 0.14); brass(76, 0.6, 0.9, 0.09); brass(79, 0.6, 0.9, 0.08);
      this._tone(NOTE(48), t + 0.6, 1.0, { type: 'triangle', gain: 0.25 });
    } else {
      [60, 64, 67, 72].forEach((n, i) => this._marimba(NOTE(n), t + i * 0.14, 0.25));
    }
  }

  // ---------- Hintergrundmusik: fröhliche, leise Endlosschleife ----------
  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const c = this.ctx;
    this.music.gain.cancelScheduledValues(c.currentTime);
    this.music.gain.setTargetAtTime(0.32, c.currentTime, 0.8);
    const bpm = 100;
    const step = 60 / bpm / 2; // Achtelnoten
    // C – G – Am – F  (I – V – vi – IV)
    const chords = [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69]];
    const scale = [72, 74, 76, 79, 81, 84, 86, 88]; // C-Dur pentatonisch
    let pos = 0;
    let melody = 3;
    let next = c.currentTime + 0.1;
    const schedule = () => {
      while (next < c.currentTime + 0.25) {
        const bar = Math.floor(pos / 8) % chords.length;
        const beat = pos % 8;
        const ch = chords[bar];
        const out = this.music;
        if (beat === 0 || beat === 4) this._tone(NOTE(ch[0]), next, 0.5, { type: 'triangle', gain: 0.16, out });
        if (beat === 6) this._tone(NOTE(ch[0] + 7), next, 0.25, { type: 'triangle', gain: 0.1, out });
        // Arpeggio
        if (beat % 2 === 1) this._marimba(NOTE(ch[1 + ((beat >> 1) % 3)]), next, 0.06, out, 0.35);
        // Melodie: zufälliger Spaziergang in der Tonleiter, nicht jede Note
        const phrase = Math.floor(pos / 32) % 2;
        if ((beat === 0 || beat === 3 || beat === 4 || (beat === 6 && phrase)) && Math.random() < 0.8) {
          melody = Math.max(0, Math.min(scale.length - 1, melody + Math.floor(Math.random() * 5) - 2));
          this._marimba(NOTE(scale[melody]), next, 0.075, out, 0.5);
        }
        // leiser Shaker
        if (beat % 2 === 0) this._noise(next, 0.05, { gain: 0.018, from: 7000, to: 9000, type: 'highpass', out });
        next += step;
        pos++;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 60);
  }

  stopMusic() {
    if (!this.ctx) return;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  // Musik leiser stellen, während vorgelesen wird
  duck(on) {
    if (!this.ctx || !this.musicOn) return;
    this.music.gain.setTargetAtTime(on ? 0.12 : 0.32, this.ctx.currentTime, 0.15);
  }
}

export const sound = new SoundEngine();

// ---------- Vorlesen ----------
let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const de = vs.filter((v) => v.lang && v.lang.toLowerCase().startsWith('de'));
  voice = de.find((v) => /de-CH/i.test(v.lang)) || de.find((v) => /google|anna|petra|helena|katja/i.test(v.name)) || de[0] || null;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export const speech = {
  on: true,
  say(text) {
    if (!this.on || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice ? voice.lang : 'de-DE';
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1.1;
      u.onstart = () => sound.duck(true);
      u.onend = () => sound.duck(false);
      speechSynthesis.speak(u);
    } catch (e) {
      /* Sprachausgabe nicht verfügbar */
    }
  },
  stop() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    sound.duck(false);
  },
};
