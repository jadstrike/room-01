/**
 * Everything is synthesised - there are no audio assets - so this must start
 * from a user gesture. Ambient bed ported from the Room 01 viewer; footsteps
 * and the interaction blip are new and driven by the player/interaction code.
 */
export class Audio {
  private ctx: AudioContext;
  private out: GainNode;
  private hum: GainNode;

  constructor() {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.5;
    this.out.connect(this.ctx.destination);

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

  close(): void {
    void this.ctx.close();
  }
}
