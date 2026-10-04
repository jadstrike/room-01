import { useEffect } from "react";
import type { StoryState } from "../story/state";
import { BAKED } from "../story/moth";

export const CREATORS = ["Khant Zwe Naing (Isaac)", "Kyaw Lwin (William)"];

const SECTIONS: ReadonlyArray<{ heading: string; lines: string[] }> = [
  { heading: "A game by", lines: CREATORS },
  { heading: "Made for", lines: ["The Moth quantum games hackathon"] },
  { heading: "Built with", lines: ["three.js · React · TypeScript · Vite"] },
  { heading: "The pistol", lines: ["“Beretta Pistol FPS ANIMATION” by BURNER", "CC BY 4.0"] },
  { heading: "The entity", lines: ["“Scary Creature” by shedmon", "CC BY 4.0"] },
  { heading: "Gun sounds", lines: ["synth2 · GFL7 (CC0)", "fastson (CC BY 3.0) · Debsound (CC BY-NC 4.0)", "via freesound.org"] },
  { heading: "Everything else", lines: ["The rooms, the characters, the score and the sound design were made for this game"] },
];

/**
 * The end credits, rolling up the screen once. Esc, Enter or the button skips
 * to the end; so does the roll finishing on its own.
 */
export function CreditsRoll({ onDone, coin, labyrinths }: { onDone: () => void; coin: StoryState["coinProof"]; labyrinths: string[] }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        onDone();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="credits-roll" role="dialog" aria-label="Credits">
      <div className="roll" onAnimationEnd={onDone}>
        <h1 className="game-title">
          ROOM <span>01</span>
        </h1>
        <section>
          <h2>Quantum, by Moth</h2>
          <p>Five of Moth's engines are in this game.</p>
          <p className="roll-proof">Coin Toss decided where you went · Quantum Labyrinth measured its doors</p>
          <p className="roll-proof">Quantum Blur made her face · Quantum Teleblur unmade it · Retrocausal Echo is the entity's voice</p>
          {labyrinths.map((job) => (
            <p className="roll-proof" key={job}>
              your Labyrinth · job {job}
            </p>
          ))}
          <p className="roll-proof">Blur · {BAKED.blur.map((j) => j.slice(0, 8)).join(" · ")}</p>
          <p className="roll-proof">Teleblur · {BAKED.teleblur.map((j) => j.slice(0, 8)).join(" · ")}</p>
          <p className="roll-proof">Retrocausal Echo · {BAKED.echo.slice(0, 8)}</p>
        </section>
        {coin && (
          <section>
            <h2>Your coin</h2>
            {coin.source === "moth" ? (
              <>
                <p>Measured by Moth's Coin Toss engine</p>
                <p>
                  {coin.heads} heads, {coin.tails} tails, from one qubit in superposition
                </p>
                <p className="roll-proof">job {coin.jobId}</p>
              </>
            ) : (
              <p>Flipped locally: Moth did not answer in time</p>
            )}
          </section>
        )}
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
        <p className="roll-end">Thank you for playing.</p>
      </div>
      <button className="quiet roll-skip" onClick={onDone}>
        Skip <kbd>Esc</kbd>
      </button>
    </div>
  );
}
