import { useEffect } from "react";
import type { Engine } from "../engine/Engine";

const LINES = [
  "Rowan Langdon had a sister.",
  "He remembers the phone call at twenty to twelve. He remembers the funeral, mostly. He remembers her laugh.",
  "He cannot remember her face.",
  "Tonight he wakes in a room he has never seen, and he is not alone in it.",
];

/**
 * The opening card of a new game, while Room 01 loads behind it. The lines
 * fade in one by one; waking up takes the pointer, so the button (or Enter)
 * is the click pointer lock needs.
 */
export function Prologue({ engine, ready }: { engine: Engine; ready: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A focused button clicks itself on Enter and Space; this covers the rest of the page.
      if (ready && (e.code === "Enter" || e.code === "Space") && document.activeElement?.tagName !== "BUTTON") {
        e.preventDefault();
        engine.game.wake();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [engine, ready]);

  return (
    <div className="prologue" role="dialog" aria-label="Prologue">
      <div className="card">
        {LINES.map((line, i) => (
          <p key={line} style={{ animationDelay: `${0.4 + i * 1.6}s` }}>
            {line}
          </p>
        ))}
        <button className="primary" style={{ animationDelay: `${0.4 + LINES.length * 1.6}s` }} disabled={!ready} onClick={() => engine.game.wake()} autoFocus>
          {ready ? "Wake up" : "…"}
        </button>
      </div>
    </div>
  );
}
