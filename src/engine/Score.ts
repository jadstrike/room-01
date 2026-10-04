/**
 * The horror score, synthesised like the rest of the audio: a breathing
 * drone under everything, draughts of air, something in the walls every so
 * often, a heartbeat that quickens as the entity comes close, and stings
 * for the moments the story turns on. All of it sits on one bus, so the
 * "Horror ambience" option is a single gain.
 */
export type Sting = "wake" | "arrive" | "reveal" | "death";

const EVENTS = ["creak", "knock", "whisper", "pipe", "breath"] as const;
type Event = (typeof EVENTS)[number];

export class Score {
  private bus: GainNode;
  private enabled = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dread = 0;
  private nextBeat = 0;
  private beatTimer: ReturnType<typeof setInterval> | undefined;
  private noiseBuffer: AudioBuffer;

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    private reverb: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(out);

    const len = ctx.sampleRate * 3;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.drone();
    this.air();
    this.schedule();
    // The heartbeat is checked on a coarse clock and scheduled precisely on the audio one.
    this.beatTimer = setInterval(() => this.heartbeat(), 100);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.bus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.4);
  }

  /** 0 calm .. 1 something is right next to you. */
  setDread(level: number): void {
    this.dread = level;
  }

  /** A low drone: a fifth and a minor second rubbing against each other, filtered, breathing slowly. */
  private drone(): void {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.value = 0.11;
    filter.connect(gain).connect(this.bus);
    for (const [f, type, level] of [
      [55, "sine", 0.9],
      [82.4, "sawtooth", 0.18],
      [58.3, "sine", 0.55],
      [110.6, "triangle", 0.12],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(filter);
      o.start();
    }
    // Two slow LFOs: the filter opens and closes like breathing, the level swells.
    const lfo = (rate: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start();
    };
    lfo(0.047, 180, filter.frequency);
    lfo(0.031, 0.05, gain.gain);
  }

  /** A draught: band-limited noise that drifts in pitch and level. */
  private air(): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.025;
    src.connect(bp).connect(g).connect(this.bus);
    src.start();
    const o = ctx.createOscillator();
    o.frequency.value = 0.07;
    const og = ctx.createGain();
    og.gain.value = 400;
    o.connect(og).connect(bp.frequency);
    o.start();
  }

  /** Something in the walls, every 15 to 40 seconds. */
  private schedule(): void {
    this.timer = setTimeout(
      () => {
        if (this.enabled && this.ctx.state === "running") this.event(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
        this.schedule();
      },
      15000 + Math.random() * 25000,
    );
  }

  private noise(at: number, seconds: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.start(at, Math.random() * Math.max(0, this.noiseBuffer.duration - seconds), seconds);
    return src;
  }

  /** Panned, and sent to the room's reverb, so it sounds like it is somewhere rather than in your head. */
  private place(node: AudioNode, pan: number, wet = 0.6): AudioNode {
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner).connect(this.bus);
    const send = this.ctx.createGain();
    send.gain.value = wet;
    panner.connect(send).connect(this.reverb);
    return panner;
  }

  private event(kind: Event): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pan = Math.random() * 1.6 - 0.8;
    if (kind === "creak") {
      // Wood under load: a resonant band sweeping slowly, with a rough edge.
      const len = 1.1 + Math.random() * 0.8;
      const src = this.noise(now, len);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 22;
      bp.frequency.setValueAtTime(260 + Math.random() * 120, now);
      bp.frequency.linearRampToValueAtTime(700 + Math.random() * 400, now + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.5, now + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      src.connect(bp).connect(g);
      this.place(g, pan);
    } else if (kind === "knock") {
      // Three knocks behind a wall.
      const g = ctx.createGain();
      g.gain.value = 0.35;
      this.place(g, pan, 0.9);
      for (let i = 0; i < 3; i++) {
        const t = now + i * (0.32 + Math.random() * 0.08);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(95, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        const e = ctx.createGain();
        e.gain.setValueAtTime(0.0001, t);
        e.gain.exponentialRampToValueAtTime(1, t + 0.005);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(e).connect(g);
        o.start(t);
        o.stop(t + 0.2);
      }
    } else if (kind === "whisper") {
      // Breathy sibilance chopped into syllables, crossing the stereo field.
      const len = 1.6 + Math.random();
      const src = this.noise(now, len);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3200;
      bp.Q.value = 1.4;
      const chop = ctx.createGain();
      chop.gain.value = 0;
      for (let t = 0; t < len; t += 0.09 + Math.random() * 0.12) chop.gain.setTargetAtTime(Math.random() < 0.6 ? 0.12 : 0, now + t, 0.02);
      chop.gain.setTargetAtTime(0, now + len, 0.05);
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      panner.pan.linearRampToValueAtTime(-pan, now + len);
      src.connect(bp).connect(chop).connect(panner).connect(this.bus);
    } else if (kind === "pipe") {
      // A distant pipe or radiator ringing: inharmonic partials, long and quiet.
      const g = ctx.createGain();
      g.gain.value = 0.05;
      this.place(g, pan, 1);
      for (const f of [196, 311, 467, 733]) {
        const o = ctx.createOscillator();
        o.frequency.value = f * (0.98 + Math.random() * 0.04);
        const e = ctx.createGain();
        e.gain.setValueAtTime(0.0001, now);
        e.gain.exponentialRampToValueAtTime(1, now + 0.01);
        e.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        o.connect(e).connect(g);
        o.start(now);
        o.stop(now + 3.6);
      }
    } else {
      // Something breathing out, close by.
      const len = 2.2;
      const src = this.noise(now, len);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      src.connect(lp).connect(g);
      this.place(g, pan, 0.2);
    }
  }

  /** Lub-dub, faster and louder the closer the entity is. Silent when calm. */
  private heartbeat(): void {
    const ctx = this.ctx;
    if (!this.enabled || this.dread < 0.08 || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (now < this.nextBeat) return;
    const bpm = 58 + this.dread * 70;
    this.nextBeat = now + 60 / bpm;
    const level = 0.15 + this.dread * 0.45;
    for (const [offset, f, gain] of [
      [0, 52, 1],
      [0.18, 46, 0.7],
    ] as const) {
      const t = now + 0.02 + offset;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.15);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(level * gain, t + 0.012);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(e).connect(this.bus);
      o.start(t);
      o.stop(t + 0.22);
    }
  }

  /** The moments the story turns on: a reversed swell into a low hit and a dissonant cluster. */
  sting(kind: Sting): void {
    const ctx = this.ctx;
    if (!this.enabled) return;
    const now = ctx.currentTime;
    const swell = kind === "arrive" ? 0.9 : 1.6;
    const hit = now + swell;

    const src = this.noise(now, swell + 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.setValueAtTime(400, now);
    hp.frequency.exponentialRampToValueAtTime(5000, hit);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.exponentialRampToValueAtTime(kind === "arrive" ? 0.12 : 0.22, hit - 0.02);
    sg.gain.linearRampToValueAtTime(0, hit);
    src.connect(hp).connect(sg).connect(this.bus);

    const boom = ctx.createOscillator();
    boom.frequency.setValueAtTime(70, hit);
    boom.frequency.exponentialRampToValueAtTime(28, hit + 1.2);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, hit);
    bg.gain.exponentialRampToValueAtTime(kind === "arrive" ? 0.35 : 0.7, hit + 0.01);
    bg.gain.exponentialRampToValueAtTime(0.0001, hit + 1.6);
    boom.connect(bg).connect(this.bus);
    boom.start(hit);
    boom.stop(hit + 1.7);

    if (kind === "arrive") return;
    // Strings that cannot agree: a cluster a semitone apart, fading for a long time.
    const cluster = ctx.createGain();
    cluster.gain.setValueAtTime(0.0001, hit);
    cluster.gain.exponentialRampToValueAtTime(kind === "reveal" ? 0.07 : 0.05, hit + 0.05);
    cluster.gain.exponentialRampToValueAtTime(0.0001, hit + (kind === "reveal" ? 6 : 3.5));
    this.place(cluster, 0, 0.8);
    for (const f of kind === "death" ? [146.8, 155.6, 220] : [293.7, 311.1, 329.6, 440]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      o.connect(lp).connect(cluster);
      o.start(hit);
      o.stop(hit + 6.2);
    }
  }

  dispose(): void {
    clearTimeout(this.timer);
    clearInterval(this.beatTimer);
  }
}
