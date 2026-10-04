import { useRef } from "react";
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
        </div>
      )}
    </div>
  );
}
