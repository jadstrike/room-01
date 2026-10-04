import type * as THREE from "three";
import type { WalkRect } from "../Player";

export type LevelContext = {
  /** The player's feet. */
  player: THREE.Vector3;
  /** The flicker level, 0 dark .. 1 lit. */
  light: number;
};

export type DebugBox = { box: THREE.Box3; color: number };

/**
 * One place the player can be: Room 01, or one room of a site. The Engine
 * keeps exactly one level in the scene and swaps them behind the loading
 * screen. A level is presentation and physics only; what interacting with
 * its objects means is the Game's business.
 */
export interface Level {
  readonly id: string;
  readonly root: THREE.Object3D;
  /** Floor to ceiling: the player's floor height and headroom. */
  readonly bounds: THREE.Box3;
  /**
   * What the player collides with. A level may move boxes in place or change
   * the contents, but never replaces the array, so the player keeps seeing it.
   */
  readonly colliders: THREE.Box3[];
  /** Hard clamp on the player's position, or null for colliders alone. */
  readonly confine: WalkRect | null;
  readonly spawn: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
  /** Where the dust motes glow from: the level's main light. */
  readonly lightPosition: THREE.Vector3;
  /**
   * Something that casts a shadow moves here, so shadow maps re-render (at a
   * capped rate). Otherwise they are drawn once, when the level is entered.
   */
  readonly dynamicShadows: boolean;
  /**
   * Kept when the player leaves, rather than disposed: for a level that is
   * expensive to load and that the story returns to.
   */
  readonly persistent: boolean;
  /** Drive the practical lights from the flicker level. */
  setLightLevel(level: number): void;
  /** What the interaction ray and bullets are cast against. */
  raycastRoots(): THREE.Object3D[];
  update(dt: number, ctx: LevelContext): void;
  debugBoxes(): DebugBox[];
  dispose(): void;
}

/** Progress for the loading screen: what is happening, and how far along, 0..1. */
export type Report = (step: string, progress: number) => void;
