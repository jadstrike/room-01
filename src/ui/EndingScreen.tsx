import { useState } from "react";
import type { Engine } from "../engine/Engine";
import type { EndingView } from "../story/endings";
import { ENDING_ORDER, ENDING_TITLES } from "../story/endings";
import { CreditsRoll } from "./CreditsRoll";

type Stage = "story" | "credits" | "after";

/**
 * How a playthrough ends: the ending's own text, then the credits rolling,
 * then which endings this player has found and the way back in. Opaque
 * throughout, so the Engine stops drawing the room behind it.
 */
export function EndingScreen({ engine, ending, found }: { engine: Engine; ending: EndingView; found: string[] }) {
  const [stage, setStage] = useState<Stage>("story");

  if (stage === "credits") return <CreditsRoll
        onDone={() => setStage("after")}
        coin={engine.game.story.coinProof}
        labyrinths={Object.values(engine.game.story.sites).flatMap((p) => (p?.measured ? [p.measured.jobId] : []))}
      />;

  return (
    <div className="ending" role="dialog" aria-label={`Ending ${ending.number}: ${ending.title}`}>
      <div className="card">
        <span className="eyebrow">Ending {ending.number} of 4</span>
        <h1>{ending.title}</h1>
        {stage === "story" ? (
          <>
            {ending.text.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <div className="ending-actions">
              <button className="primary" onClick={() => setStage("credits")} autoFocus>
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              You have found {found.length} of the 4 endings.
              {found.length < 4 && " The others are still in that room."}
            </p>
            <ul className="endings-list">
              {ENDING_ORDER.map((id) => (
                <li key={id} data-found={found.includes(id) || undefined}>
                  {found.includes(id) ? ENDING_TITLES[id] : "???"}
                </li>
              ))}
            </ul>
            <div className="ending-actions">
              <button className="primary" onClick={() => void engine.game.beginNewGame()} autoFocus>
                Begin again
              </button>
              <button className="quiet" onClick={() => void engine.game.toTitle()}>
                Title screen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
