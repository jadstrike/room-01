/**
 * The single value that drives all of the room's atmosphere: bulb intensity,
 * bulb emissive, dust glow, audio hum, and the HUD's flicker tell. Ported from
 * the Room 01 viewer - keep new light-reactive effects reading this level
 * rather than re-deriving their own timing.
 */
type EventKind = "out" | "stutter";

export class Flicker {
  enabled: boolean;
  private nextEvent = 3;
  private eventEnd = 0;
  private kind: EventKind = "stutter";

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  level(t: number): number {
    if (!this.enabled) return 1;
    if (t > this.nextEvent) {
      this.kind = Math.random() < 0.22 ? "out" : "stutter";
      this.eventEnd = t + (this.kind === "out" ? 0.8 + Math.random() * 1.2 : 0.35 + Math.random() * 0.5);
      this.nextEvent = this.eventEnd + 3 + Math.random() * 7;
    }
    if (t < this.eventEnd) {
      if (this.kind === "out") return 0.02;
      return Math.sin(t * 90) > 0.2 ? 1 : 0.08;
    }
    return 0.94 + 0.06 * Math.sin(t * 50) * Math.sin(t * 13.7); // mains buzz
  }
}
