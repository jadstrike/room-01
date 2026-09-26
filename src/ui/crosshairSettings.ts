/**
 * Counter-Strike style crosshair settings. Deliberately the same knobs CS2
 * exposes (length, thickness, gap, outline, dot, dynamic spread) so the numbers
 * mean what a player expects them to mean.
 */
export type CrosshairSettings = {
  style: "cross" | "cross-dot" | "dot" | "circle";
  /** Length of each bar, px. */
  length: number;
  thickness: number;
  /** Distance from centre to the inner end of each bar, px. */
  gap: number;
  outline: number;
  color: string;
  focusColor: string;
  alpha: number;
  /** Bars spread apart as the player moves. */
  dynamic: boolean;
  /** T-style: drop the top bar. */
  tStyle: boolean;
};

export const CROSSHAIR_DEFAULTS: CrosshairSettings = {
  style: "cross-dot",
  length: 7,
  thickness: 2,
  gap: 4,
  outline: 1,
  color: "#5ef2c0",
  focusColor: "#ff5b4a",
  alpha: 0.95,
  dynamic: true,
  tStyle: false,
};

export const CROSSHAIR_PRESETS: ReadonlyArray<{ name: string; settings: CrosshairSettings }> = [
  { name: "Default", settings: CROSSHAIR_DEFAULTS },
  {
    name: "Classic",
    settings: { ...CROSSHAIR_DEFAULTS, style: "cross", length: 10, thickness: 2, gap: 5, color: "#d8d2c4" },
  },
  {
    name: "Dot",
    settings: { ...CROSSHAIR_DEFAULTS, style: "dot", thickness: 4, dynamic: false, color: "#ff4d4d" },
  },
  {
    name: "T-style",
    settings: { ...CROSSHAIR_DEFAULTS, style: "cross", tStyle: true, length: 9, gap: 3, color: "#9fb4d8" },
  },
  {
    name: "Long",
    settings: { ...CROSSHAIR_DEFAULTS, style: "cross-dot", length: 16, thickness: 1, gap: 7, color: "#f1e9dc" },
  },
];

const KEY = "moth.crosshair.v1";

/**
 * Per-viewer convenience only: browser storage can throw or come back empty in
 * a private window, so every read and write is guarded and the defaults stand.
 */
export function loadCrosshair(): CrosshairSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return CROSSHAIR_DEFAULTS;
    return { ...CROSSHAIR_DEFAULTS, ...(JSON.parse(raw) as Partial<CrosshairSettings>) };
  } catch {
    return CROSSHAIR_DEFAULTS;
  }
}

export function saveCrosshair(settings: CrosshairSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // no-op: the crosshair just falls back to defaults next visit
  }
}
