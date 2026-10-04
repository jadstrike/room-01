import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

/**
 * The sister's photograph, as Moth's image engines left it (baked by
 * scripts/moth/bake-sister.mjs, see public/images/sister/provenance.json).
 *
 * - "memory": a Quantum Blur stage. `stage` 0 is the clearest; the more
 *   Rowan remembers, the further the face slips (Quantum Blur, rx rotation).
 * - "morph": the reveal, her face dissolving through interference into a
 *   stranger's (Quantum Teleblur), one frame at a time.
 */
export function SisterPhoto({ kind, stage = 0, caption = true }: { kind: "memory" | "morph"; stage?: number; caption?: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (kind !== "morph") return;
    setFrame(0);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFrame(3);
      return;
    }
    const t = setInterval(() => setFrame((f) => Math.min(3, f + 1)), 1700);
    return () => clearInterval(t);
  }, [kind]);

  const src = kind === "memory" ? `${BASE}images/sister/blur-${Math.max(0, Math.min(2, stage))}.png` : `${BASE}images/sister/morph-${frame}.png`;
  return (
    <figure className={`sister-photo ${kind}`}>
      <img src={src} alt={kind === "memory" ? "Her photograph. The face will not come into focus." : "Her face, coming apart into someone else's."} />
      {caption && <figcaption>{kind === "memory" ? "Moth Quantum Blur" : "Moth Quantum Teleblur"}</figcaption>}
    </figure>
  );
}

/** Preload the frames, so the reveal never waits on the network mid-line. */
export function preloadSister(): void {
  for (const name of ["blur-0", "blur-1", "blur-2", "morph-0", "morph-1", "morph-2", "morph-3"]) {
    const img = new Image();
    img.src = `${BASE}images/sister/${name}.png`;
  }
}
