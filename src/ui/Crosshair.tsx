import { useEffect, useRef, type CSSProperties } from "react";
import type { Engine } from "../engine/Engine";
import type { CrosshairSettings } from "./crosshairSettings";

/**
 * The bars are plain divs driven by CSS custom properties, and the dynamic
 * spread is written straight onto the element from an rAF - it reads
 * engine.live.speed01 and the weapon's bloom every frame, so it never goes
 * through React state.
 */
export function Crosshair({
  engine,
  settings,
  focused,
  hidden,
  preview = false,
}: {
  engine: Engine | null;
  settings: CrosshairSettings;
  focused: boolean;
  hidden: boolean;
  /** Drawn inside a box (the options preview) rather than over the screen centre. */
  preview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!engine || !settings.dynamic) {
      el.style.setProperty("--ch-spread", "0px");
      return;
    }
    let raf = 0;
    const tick = () => {
      const s = engine.live.speed01;
      el.style.setProperty("--ch-spread", `${(s * s * 10 + engine.live.bloom01 * 9).toFixed(2)}px`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, settings.dynamic]);

  const showBars = settings.style === "cross" || settings.style === "cross-dot";
  const showDot = settings.style === "dot" || settings.style === "cross-dot";
  const showCircle = settings.style === "circle";

  return (
    <div
      ref={ref}
      className={preview ? "crosshair preview" : "crosshair"}
      data-hidden={hidden || undefined}
      style={
        {
          "--ch-len": `${settings.length}px`,
          "--ch-thick": `${settings.thickness}px`,
          "--ch-gap": `${settings.gap}px`,
          "--ch-spread": "0px",
          "--ch-color": focused ? settings.focusColor : settings.color,
          "--ch-outline": `${settings.outline}px`,
          "--ch-alpha": settings.alpha,
        } as CSSProperties
      }
    >
      {showBars && (
        <>
          {!settings.tStyle && <i className="bar v top" />}
          <i className="bar v bottom" />
          <i className="bar h left" />
          <i className="bar h right" />
        </>
      )}
      {showDot && <i className="dot" />}
      {showCircle && <i className="ring" />}
      {/* Brackets confirm a target without moving the aiming point. */}
      {focused && (
        <>
          <i className="tick tl" />
          <i className="tick tr" />
          <i className="tick bl" />
          <i className="tick br" />
        </>
      )}
    </div>
  );
}
