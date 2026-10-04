import type { Engine } from "../engine/Engine";
import type { EndingView } from "../story/endings";

/** The last card. Opaque, so the Engine stops drawing the room behind it. */
export function EndingScreen({ engine, ending }: { engine: Engine; ending: EndingView }) {
  return (
    <div className="ending" role="dialog" aria-label={`Ending ${ending.number}: ${ending.title}`}>
      <div className="card">
        <span className="eyebrow">Ending {ending.number} of 4</span>
        <h1>{ending.title}</h1>
        {ending.text.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button className="primary" onClick={() => void engine.game.newGame()} autoFocus>
          Begin again
        </button>
      </div>
    </div>
  );
}
