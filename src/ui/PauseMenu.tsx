import type { Engine, EngineState } from "../engine/Engine";
import type { CrosshairSettings } from "./crosshairSettings";
import { Settings } from "./Settings";
import { Keys } from "./Keys";
import { Credits } from "./Credits";

type Props = {
  engine: Engine | null;
  state: EngineState;
  crosshair: CrosshairSettings;
  onCrosshair: (patch: Partial<CrosshairSettings>) => void;
};

/**
 * Shown during play whenever the pointer is not locked - Escape releases it,
 * so this is the pause screen and the settings, the way an FPS does it. The
 * story is saved as it goes, so quitting to the title loses nothing.
 */
export function PauseMenu({ engine, state, crosshair, onCrosshair }: Props) {
  if (!engine) return null;

  return (
    <div className="menu-backdrop">
      <div className="menu" role="dialog" aria-label="Paused">
        <header>
          <h1>{state.place.toUpperCase()}</h1>
          <button className="primary" onClick={() => engine.requestLock()} autoFocus>
            Resume
          </button>
        </header>

        {state.objective && <p className="objective-line">{state.objective}</p>}

        <div className="story-actions">
          <button className="quiet" onClick={() => engine.game.quitToTitle()}>
            Quit to title
          </button>
          <span>Progress is saved as you play.</span>
          {import.meta.env.DEV && (
            <span className="dev-jumps">
              Dev:
              <button className="quiet" onClick={() => void engine.game.jumpTo("house")}>
                House
              </button>
              <button className="quiet" onClick={() => void engine.game.jumpTo("lab")}>
                Lab
              </button>
              <button className="quiet" onClick={() => void engine.game.jumpToTrial("house")}>
                Trial
              </button>
              <button className="quiet" onClick={() => void engine.game.jumpToTrial("house", "lab")}>
                Second trial
              </button>
            </span>
          )}
        </div>

        <Keys />
        <Settings engine={engine} state={state} crosshair={crosshair} onCrosshair={onCrosshair} />
        <Credits />
      </div>
    </div>
  );
}
