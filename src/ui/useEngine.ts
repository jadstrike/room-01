import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Engine, INITIAL_STATE, type EngineState } from "../engine/Engine";

/**
 * Mounts one Engine into a container div and exposes its discrete state.
 *
 * The canvas is created here rather than rendered by React: a disposed
 * WebGLRenderer cannot hand its context back, so reusing one canvas element
 * across StrictMode's double mount would leave the second Engine driving a dead
 * context. A fresh canvas per mount sidesteps that entirely.
 */
export function useEngine(): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  engine: Engine | null;
  state: EngineState;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = document.createElement("canvas");
    canvas.className = "viewport";
    canvas.setAttribute("aria-label", "Room 01, first person");
    container.appendChild(canvas);

    const next = new Engine(canvas);
    setEngine(next);
    void next.init();

    return () => {
      next.dispose();
      canvas.remove();
      setEngine(null);
    };
  }, []);

  const subscribe = useCallback(
    (onChange: () => void) => (engine ? engine.store.subscribe(onChange) : () => {}),
    [engine],
  );
  const getSnapshot = useCallback(() => (engine ? engine.store.get() : INITIAL_STATE), [engine]);
  const state = useSyncExternalStore(subscribe, getSnapshot);

  return { containerRef, engine, state };
}
