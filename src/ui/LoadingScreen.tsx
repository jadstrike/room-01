import { useMemo, useRef } from "react";

/** Fragments, one per loading screen, the way a horror game lets its files bleed into the waits. */
const LORE = [
  "\"The entity does not lie. It simply never finishes a sentence.\"",
  "Her badge was found in the lab. Her coat was found in the house. She was found nowhere.",
  "A qubit is both answers at once, until someone looks. So was she.",
  "Twenty to twelve, the fourteenth. Everyone remembers the time. Nobody remembers her face.",
  "The doors in this place were not built. They were measured.",
  "Some rooms only exist while you are standing in them.",
  "If the lights go out, keep your torch on the far wall.",
  "Grief is a kind of memory. So is a lie told often enough.",
];
import type { Transition } from "../engine/Engine";

/**
 * Black card over the canvas while one level is swapped for another. It is
 * always mounted so it can fade both ways; the last card stays on it while it
 * fades out. The progress bar only appears if a load takes long enough to
 * need one, so a quick room change is a plain dip to black.
 */
export function LoadingScreen({ transition }: { transition: Transition | null }) {
  const last = useRef<Transition | null>(null);
  if (transition) last.current = transition;
  const card = transition ?? last.current;
  const visible = transition !== null;
  // A new fragment for each new card, not for each progress update.
  const lore = useMemo(() => LORE[Math.floor(Math.random() * LORE.length)], [card?.title, card?.line]);

  return (
    <div className="loading-screen" data-visible={visible || undefined} aria-hidden={!visible}>
      {card && (
        <div className="card" role={visible ? "status" : undefined}>
          {card.title && <h1>{card.title}</h1>}
          {card.line && <p className="line">{card.line}</p>}
          <div className="bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${card.progress})` }} />
          </div>
          <p className="step">{card.step}</p>
          <p className="lore">{lore}</p>
        </div>
      )}
    </div>
  );
}
