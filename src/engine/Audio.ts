/**
 * Everything is synthesised - there are no audio assets - so this must start
 * from a user gesture. Ambient bed ported from the Room 01 viewer; footsteps
 * and the interaction blip are new and driven by the player/interaction code.
 */
export class Audio {
  private ctx: AudioContext;
  private out: GainNode;
  private master: WaveShaperNode;
  private hum: GainNode;
  private room: ConvolverNode;
  /** Gun bus: loud, so it goes through a limiter before the master. */
  private gun: GainNode;
  private drive: WaveShaperNode;

  constructor(ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    // Everything ends in one soft limiter, so a gunshot on top of the room's
    // echo and rumble bends rather than clips. Its curve is ~1.4x in the
    // quiet range, hence the lower ambience gain.
    this.master = this.ctx.createWaveShaper();
    const soft = new Float32Array(2048);
    for (let i = 0; i < soft.length; i++) soft[i] = (Math.tanh(((i / (soft.length - 1)) * 2 - 1) * 1.2) / Math.tanh(1.2)) * 0.97;
    this.master.curve = soft;
    this.master.connect(this.ctx.destination);
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.36;
    this.out.connect(this.master);

    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = buf;
    rumble.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    const rg = this.ctx.createGain();
    rg.gain.value = 0.9;
    rumble.connect(lp).connect(rg).connect(this.out);
    rumble.start();

    const hum = this.ctx.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 100;
    const hf = this.ctx.createBiquadFilter();
    hf.type = "bandpass";
    hf.frequency.value = 200;
    hf.Q.value = 6;
    this.hum = this.ctx.createGain();
    this.hum.gain.value = 0;
    hum.connect(hf).connect(this.hum).connect(this.out);
    hum.start();

    // A small room's reverb for the gunshot: a short burst of decaying noise.
    const irLen = Math.floor(this.ctx.sampleRate * 0.9);
    const ir = this.ctx.createBuffer(2, irLen, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    this.room = this.ctx.createConvolver();
    this.room.buffer = ir;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.32;
    this.room.connect(wet).connect(this.out);

    // The gun skips the ambience gain: a shot indoors is the loudest thing in the game.
    this.gun = this.ctx.createGain();
    this.gun.gain.value = 0.62;
    this.gun.connect(this.master);
    this.gun.connect(this.room);

    // Soft clipping gives the crack the grit of a real report.
    this.drive = this.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(3.2 * ((i / (curve.length - 1)) * 2 - 1));
    this.drive.curve = curve;
    this.drive.connect(this.gun);
  }

  private noise(seconds: number, shape: number): AudioBufferSourceNode {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /** Bandpassed noise tick: the vocabulary of every mechanical gun sound. */
  private click(at: number, freq: number, gain: number, seconds = 0.03): void {
    const src = this.noise(seconds, 6);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 2.5;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.out);
    src.start(at);
  }

  /**
   * A pistol report in layers: a few-millisecond snap for the edge, a gritty
   * high crack, a low boom, the room answering, the slide cycling, and the
   * spent case landing on the floorboards half a second later.
   */
  gunshot(): void {
    const now = this.ctx.currentTime;

    const snap = this.noise(0.005, 1);
    const sg = this.ctx.createGain();
    sg.gain.value = 1.2;
    snap.connect(sg).connect(this.gun);
    snap.start(now);

    const crack = this.noise(0.28, 9);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 0.6;
    const cg = this.ctx.createGain();
    cg.gain.value = 1.3;
    crack.connect(bp).connect(cg).connect(this.drive);
    crack.start(now);

    const thump = this.ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(125, now);
    thump.frequency.exponentialRampToValueAtTime(38, now + 0.2);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.exponentialRampToValueAtTime(1.0, now + 0.004);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    thump.connect(tg).connect(this.gun);
    thump.start(now);
    thump.stop(now + 0.3);

    const boom = this.noise(0.4, 4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 360;
    const bg = this.ctx.createGain();
    bg.gain.value = 0.9;
    boom.connect(lp).connect(bg).connect(this.gun);
    boom.start(now);

    this.click(now + 0.035, 3400, 0.22);
    this.click(now + 0.07, 2100, 0.16);

    const land = now + 0.5 + Math.random() * 0.15;
    this.brass(land, 1);
    this.brass(land + 0.13 + Math.random() * 0.08, 0.45);
  }

  /** A brass case striking wood: a tick and a few short, inharmonic rings. */
  private brass(at: number, level: number): void {
    this.click(at, 5200, 0.08 * level, 0.012);
    for (const f of [3900, 6150, 8300, 10400]) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * (0.97 + Math.random() * 0.06);
      const g = this.ctx.createGain();
      const len = 0.08 + Math.random() * 0.14;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.03 * level, at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(this.gun);
      o.start(at);
      o.stop(at + len + 0.02);
    }
  }

  dryFire(): void {
    this.click(this.ctx.currentTime, 2600, 0.35, 0.02);
  }

  /** Magazine out, magazine in, and the slide going home if it was locked back. */
  reload(empty: boolean, duration: number): void {
    const now = this.ctx.currentTime;
    this.click(now + duration * 0.2, 1500, 0.3, 0.05);
    this.click(now + duration * 0.62, 900, 0.45, 0.06);
    this.click(now + duration * 0.66, 2400, 0.3, 0.03);
    if (empty) {
      this.click(now + duration * 0.8, 1800, 0.5, 0.05);
      this.click(now + duration * 0.815, 3400, 0.25, 0.03);
    }
  }

  /** The bulb's electrical hum follows the flicker level. */
  setBulbLevel(level: number): void {
    this.hum.gain.setTargetAtTime(level > 0.5 ? 0.035 : 0, this.ctx.currentTime, 0.01);
  }

  footstep(hard = false): void {
    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hard ? 900 : 480;
    bp.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.value = hard ? 0.5 : 0.32;
    src.connect(bp).connect(g).connect(this.out);
    src.start(now);
  }

  /** Short UI blip when something becomes interactable / is interacted with. */
  blip(freq = 420, dur = 0.07): void {
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(this.out);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  /** Browsers can suspend audio (autoplay rules, background tabs); any click may wake it. */
  resume(): void {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  close(): void {
    void this.ctx.close();
  }
}
