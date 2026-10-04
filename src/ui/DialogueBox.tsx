import { useEffect, useRef, useState } from "react";
import type { Engine } from "../engine/Engine";
import type { DialogueView } from "../story/dialogue";
import { SisterPhoto } from "./SisterPhoto";

const CHARS_PER_SECOND = 55;

/**
 * The conversation popup. The line types itself out (written straight onto
 * the element from an rAF, not through React state); a click, Space or Enter
 * finishes it. Choices are buttons, also on the number keys. Esc walks away,
 * which leaves the pointer free, so the pause menu shows as it would anyway.
 */
export function DialogueBox({ engine, view }: { engine: Engine; view: DialogueView }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [typed, setTyped] = useState(false);
  const skip = useRef<() => void>(() => {});

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setTyped(false);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const full = view.text;
    let raf = 0;
    const start = performance.now();
    const finish = () => {
      cancelAnimationFrame(raf);
      el.textContent = full;
      setTyped(true);
    };
    skip.current = finish;
    if (reduce) {
      finish();
      return;
    }
    const tick = (now: number) => {
      const n = Math.floor(((now - start) / 1000) * CHARS_PER_SECOND);
      if (n >= full.length) return finish();
      el.textContent = full.slice(0, n);
      raf = requestAnimationFrame(tick);
    };
    el.textContent = "";
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  // Back to the game: the click that closed the box counts as the gesture pointer lock needs.
  const close = () => {
    engine.game.endDialogue();
    engine.requestLock();
  };
  const next = () => {
    if (!typed) return skip.current();
    if (view.last) close();
    else engine.game.advanceDialogue();
  };
  const choose = (i: number) => {
    if (!typed) return skip.current();
    engine.game.chooseDialogue(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        engine.game.endDialogue();
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!view.choices.length || !typed) next();
        return;
      }
      const digit = /^Digit([0-9])$/.exec(e.code);
      // 1-9, and 0 for a tenth choice, as on a keyboard row.
      if (digit && typed) choose((Number(digit[1]) + 9) % 10);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  return (
    <div className="dialogue-backdrop" onClick={() => !view.choices.length && next()}>
      <section className="dialogue" role="dialog" aria-label={`Talking to ${view.speaker}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="speaker">{view.speaker}</h2>
        {view.image === "sister-morph" && <SisterPhoto kind="morph" />}
        <p className="line" ref={textRef} aria-live="polite" onClick={() => !typed && skip.current()} />
        {view.choices.length > 0 ? (
          <ol className="choices" data-hidden={!typed || undefined}>
            {view.choices.map((c, i) => (
              <li key={c.label}>
                <button className={c.seen ? "seen" : undefined} onClick={() => choose(i)} disabled={!typed}>
                  <kbd>{(i + 1) % 10}</kbd>
                  <span>{c.label}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <button className="continue" onClick={next}>
            {typed ? (view.last ? "Leave" : "Continue") : "…"} <kbd>Space</kbd>
          </button>
        )}
      </section>
    </div>
  );
}
