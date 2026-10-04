import type { ReloadCues, WeaponSounds } from "./weapons";
import { Score, type Sting } from "./Score";

type GunSample = "shot" | "dryFire" | "shell" | "reload";

/**
 * The ambience, footsteps and blips are synthesised; the gun uses recorded
 * samples once they have loaded, with synthesised stand-ins until then (or if
 * they fail). Audio must start from a user gesture. Ambient bed ported from
 * the Room 01 viewer.
 */
export class Audio {
  private samples = new Map<GunSample, AudioBuffer>();
  private gunSounds: WeaponSounds | null = null;
  private ctx: AudioContext;
  private out: GainNode;
  private master: WaveShaperNode;
  private hum: GainNode;
  private room: ConvolverNode;
  /** Gun bus: loud, so it goes through a limiter before the master. */
  private gun: GainNode;
  private drive: WaveShaperNode;
  /** Everything passes through this before the limiter: the volume option. */
  private volume: GainNode;
  /** Drones, distant noises, the heartbeat, the stings. */
  readonly score: Score;
  /**
   * The entity's voice goes through an echo measured by Moth's
   * Retrocausal Echo engine (public/audio/entity-echo.wav), where negative
   * returns play reversed: it answers itself out of order. Dry until loaded.
   */
  private voiceEcho: ConvolverNode;

  constructor(ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    // Everything ends in one soft limiter, so a gunshot on top of the room's
    // echo and rumble bends rather than clips. Its curve is ~1.4x in the
    // quiet range, hence the lower ambience gain.
    this.master = this.ctx.createWaveShaper();
    const soft = new Float32Array(2048);
    for (let i = 0; i < soft.length; i++) soft[i] = (Math.tanh(((i / (soft.length - 1)) * 2 - 1) * 1.2) / Math.tanh(1.2)) * 0.97;
    this.master.curve = soft;
    this.volume = this.ctx.createGain();
    this.master.connect(this.volume).connect(this.ctx.destination);
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

    this.score = new Score(this.ctx, this.out, this.room);
    this.voiceEcho = this.ctx.createConvolver();
    const echoWet = this.ctx.createGain();
    echoWet.gain.value = 0.55;
    this.voiceEcho.connect(echoWet).connect(this.out);
  }

  /** Fetch the quantum echo for the entity's voice; until it lands the voice is dry. */
  async loadEntityEcho(base: string): Promise<void> {
    try {
      const res = await fetch(`${base}audio/entity-echo.wav`);
      if (!res.ok) throw new Error(`${res.status}`);
      this.voiceEcho.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (error) {
      console.warn("[audio] could not load the entity's echo; its voice stays dry", error);
    }
  }

  /** 0..1, applied after the limiter so the mix keeps its shape at any level. */
  setVolume(v: number): void {
    this.volume.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.05);
  }

  setAmbience(on: boolean): void {
    this.score.setEnabled(on);
  }

  setDread(level: number): void {
    this.score.setDread(level);
  }

  sting(kind: Sting): void {
    this.score.sting(kind);
  }

  /** A door on old hinges: a resonant, slowing creak and the latch giving. */
  door(): void {
    const now = this.ctx.currentTime;
    this.click(now, 1800, 0.25, 0.03);
    const src = this.noise(0.9, 0.6);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 18;
    bp.frequency.setValueAtTime(520, now + 0.05);
    bp.frequency.exponentialRampToValueAtTime(240, now + 0.9);
    const g = this.ctx.createGain();
    g.gain.value = 0.55;
    src.connect(bp).connect(g).connect(this.out);
    src.start(now + 0.05);
  }

  /** Space folding open: a rising rush, a pitch dropping away under it, and a soft thud at the end. */
  portal(): void {
    const now = this.ctx.currentTime;
    const rush = this.noise(1.1, 0.4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(180, now);
    lp.frequency.exponentialRampToValueAtTime(4200, now + 0.9);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.0001, now);
    rg.gain.exponentialRampToValueAtTime(0.5, now + 0.8);
    rg.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    rush.connect(lp).connect(rg).connect(this.out);
    rush.start(now);
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, now);
    o.frequency.exponentialRampToValueAtTime(30, now + 1.1);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.08, now + 0.3);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    o.connect(og).connect(this.room);
    o.start(now);
    o.stop(now + 1.2);
  }

  /** A fridge door: the seal letting go, and the compressor hum spilling out. */
  fridge(): void {
    const now = this.ctx.currentTime;
    this.click(now, 400, 0.4, 0.06);
    const hum = this.ctx.createOscillator();
    hum.type = "triangle";
    hum.frequency.value = 50;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    hum.connect(g).connect(this.out);
    hum.start(now);
    hum.stop(now + 2.3);
  }

  /** Writing something down. */
  scribble(): void {
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.click(now + i * 0.07 + Math.random() * 0.03, 3000 + Math.random() * 2000, 0.06, 0.05);
  }

  /** Fetch and decode a weapon's recordings; until each lands, its synthesised version plays. */
  async loadGunSounds(sounds: WeaponSounds, base: string): Promise<void> {
    this.gunSounds = sounds;
    const names: GunSample[] = ["shot", "dryFire", "shell", "reload"];
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(base + sounds[name]);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          this.samples.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
        } catch (error) {
          console.warn(`[audio] could not load ${sounds[name]}, using the synthesised sound`, error);
        }
      }),
    );
  }

  private play(
    name: GunSample,
    at: number,
    { gain = 1, rate = 1, from = 0, to, lowpass, dest = this.gun }: { gain?: number; rate?: number; from?: number; to?: number; lowpass?: number; dest?: AudioNode } = {},
  ): boolean {
    const buffer = this.samples.get(name);
    if (!buffer) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = src;
    if (lowpass) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = lowpass;
      node = node.connect(lp);
    }
    node.connect(g).connect(dest);
    const start = Math.max(this.ctx.currentTime, at);
    if (to === undefined) src.start(start, from);
    else {
      src.start(start, from, to - from);
      // Fade the end of a slice so the cut never clicks.
      const end = start + (to - from) / rate;
      g.gain.setValueAtTime(gain, Math.max(start, end - 0.03));
      g.gain.linearRampToValueAtTime(0, end);
    }
    return true;
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
    // A touch of pitch drift, so rapid shots do not sound like one sample repeated.
    if (this.play("shot", now, { gain: 2.4, rate: 0.96 + Math.random() * 0.08 })) {
      this.casing(now + 0.5 + Math.random() * 0.15);
      return;
    }

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

    this.casing(now + 0.5 + Math.random() * 0.15);
  }

  /** The spent case landing. The recording is on concrete, so it is pitched and dulled for floorboards. */
  private casing(at: number): void {
    if (this.play("shell", at, { gain: 0.55, rate: 0.82 + Math.random() * 0.1, lowpass: 4200, dest: this.out })) return;
    this.brass(at, 1);
    this.brass(at + 0.13 + Math.random() * 0.08, 0.45);
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

  /**
   * The entity's voice: no words, a low, wet murmur under the text, longer for
   * longer lines, with a formant that wanders as if something is trying on a
   * throat it does not have.
   */
  voice(chars: number): void {
    const now = this.ctx.currentTime;
    const len = Math.min(2.4, 0.35 + chars * 0.018);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.08);
    g.gain.setValueAtTime(0.16, now + len - 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    const formant = this.ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.value = 7;
    formant.frequency.setValueAtTime(420, now);
    for (let t = 0.1; t < len; t += 0.11) formant.frequency.linearRampToValueAtTime(260 + Math.random() * 520, now + t);
    formant.connect(g).connect(this.out);
    if (this.voiceEcho.buffer) g.connect(this.voiceEcho);
    for (const f of [58, 58 * 1.505, 87.7]) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, now);
      o.frequency.linearRampToValueAtTime(f * (0.9 + Math.random() * 0.2), now + len);
      o.connect(formant);
      o.start(now);
      o.stop(now + len + 0.05);
    }
    const breath = this.noise(len, 1.5);
    const bg = this.ctx.createGain();
    bg.gain.value = 0.35;
    breath.connect(bg).connect(formant);
    breath.start(now);
  }

  /** Leather and steel: the gun coming out of, or going into, the holster. */
  holster(drawing: boolean): void {
    const now = this.ctx.currentTime;
    const rub = this.noise(0.18, 2);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    rub.connect(bp).connect(g).connect(this.out);
    rub.start(now);
    if (drawing) this.click(now + 0.3, 2800, 0.2, 0.03);
  }

  dryFire(): void {
    if (this.play("dryFire", this.ctx.currentTime, { gain: 0.9, dest: this.out })) return;
    this.click(this.ctx.currentTime, 2600, 0.35, 0.02);
  }

  /**
   * Magazine out, magazine in, and the slide going home after an empty
   * reload, each slice of the recording landing on its cue in the animation.
   */
  reload(empty: boolean, duration: number): void {
    const now = this.ctx.currentTime;
    const sounds = this.gunSounds;
    if (sounds && this.samples.has("reload")) {
      const cues: ReloadCues = empty ? sounds.cues.reloadEmpty : sounds.cues.reload;
      const parts: [keyof ReloadCues, number | undefined][] = [["magOut", cues.magOut], ["magIn", cues.magIn], ["slide", cues.slide]];
      for (const [part, cue] of parts) {
        if (cue === undefined) continue;
        const slice = sounds.reloadSlices[part];
        this.play("reload", now + cue - (slice.hit - slice.from), { gain: 1.1, from: slice.from, to: slice.to, dest: this.out });
      }
      return;
    }
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

  /** A hidden tab has nothing to listen to. */
  suspend(): void {
    if (this.ctx.state === "running") void this.ctx.suspend();
  }

  close(): void {
    this.score.dispose();
    void this.ctx.close();
  }
}
