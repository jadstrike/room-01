/**
 * Decides which display refreshes are worth rendering, so the game does not
 * run a laptop's GPU flat out drawing frames nobody needs: a 144 Hz monitor
 * gets the frame cap, a pause menu over a still room gets a trickle, and a
 * hidden tab or a loading screen gets nothing at all (the Engine stops the
 * loop for those).
 *
 * Skipping a refresh is free: setAnimationLoop still ticks at the display
 * rate, but a skipped tick returns before any scene work.
 */

/** Frames per second the player can cap at; 0 renders every display refresh. */
export const FRAME_CAPS = [30, 60, 120, 0] as const;
export type FrameCap = (typeof FRAME_CAPS)[number];

/**
 * play: the pointer is locked and the player is moving.
 * ambient: a conversation or an evidence panel is open; things still move behind it.
 * menu: the pause menu; the room only needs to look alive.
 */
export type PaceMode = "play" | "ambient" | "menu";

const AMBIENT_FPS = 30;
const MENU_FPS = 20;

export class Pacer {
  cap: FrameCap = 60;
  mode: PaceMode = "menu";
  private last = -1;
  /** Time owed to the next frame; carrying it keeps the average rate right on any display. */
  private debt = 0;

  /** The rate the current mode aims for, or 0 for every refresh. */
  get target(): number {
    const cap = this.cap || Infinity;
    if (this.mode === "menu") return Math.min(cap, MENU_FPS);
    if (this.mode === "ambient") return Math.min(cap, AMBIENT_FPS);
    return this.cap;
  }

  /** Whether the refresh at `now` (ms) should render. */
  tick(now: number): boolean {
    if (this.last < 0) {
      this.last = now;
      return true;
    }
    const elapsed = now - this.last;
    this.last = now;
    const target = this.target;
    if (!target) return true;
    const interval = 1000 / target;
    this.debt += elapsed;
    // A little slack, or a 60 cap on a 60 Hz display would drop every frame that arrives a hair early.
    if (this.debt < interval - 1.5) return false;
    this.debt = Math.min(this.debt - interval, interval);
    return true;
  }

  /** Forget timing after the loop was stopped, so the first frame back is not a catch-up. */
  reset(): void {
    this.last = -1;
    this.debt = 0;
  }
}

const MIN_SCALE = 0.5;
const WINDOW = 2;

/**
 * Lowers the render resolution when the frame rate cannot hold, and raises it
 * again, slowly, once it can. Fill rate is what the post chain (GTAO, bloom)
 * costs, so pixels are the lever that actually cools things down.
 *
 * It only aims for 60 at most: an uncapped or 120 cap on a 60 Hz display can
 * never be met, and chasing it would just blur the picture.
 */
export class AdaptiveResolution {
  enabled = true;
  /** Multiplier on the device pixel ratio. */
  scale = 1;
  private frames = 0;
  private elapsed = 0;
  private hold = 0;
  private good = 0;

  /** Feed one rendered frame. Returns true when `scale` changed. */
  sample(dt: number, cap: number): boolean {
    if (!this.enabled) {
      if (this.scale === 1) return false;
      this.scale = 1;
      return true;
    }
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < WINDOW) return false;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if ((this.hold -= WINDOW) > 0) return false;

    const target = Math.min(cap || 60, 60);
    if (fps < target * 0.8 && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, +(this.scale - 0.15).toFixed(2));
      this.good = 0;
      // Give the new size time to show what it costs before judging again.
      this.hold = WINDOW * 2;
      return true;
    }
    if (fps >= target * 0.95 && this.scale < 1) {
      // Climbing back is cautious: ten good seconds per step.
      if ((this.good += WINDOW) >= 10) {
        this.scale = Math.min(1, +(this.scale + 0.1).toFixed(2));
        this.good = 0;
        this.hold = WINDOW * 2;
        return true;
      }
    } else this.good = 0;
    return false;
  }

  /** Start measuring afresh, as after a loading screen. */
  reset(): void {
    this.frames = 0;
    this.elapsed = 0;
    this.hold = WINDOW;
  }
}
