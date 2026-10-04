import { useState } from "react";
import type { Engine, EngineState } from "../engine/Engine";
import type { CrosshairSettings } from "./crosshairSettings";
import { MenuList, type MenuItem } from "./MenuList";
import { OptionsMenu } from "./OptionsMenu";
import { Keys } from "./Keys";

type Props = {
  engine: Engine | null;
  state: EngineState;
  crosshair: CrosshairSettings;
  onCrosshair: (patch: Partial<CrosshairSettings>) => void;
};

type View = "main" | "options" | "controls";

/**
 * The pause screen, shown whenever play loses the pointer (Escape releases
 * it). A short list in the title screen's style, with the room still
 * visible behind it; settings live one level down, under Options. The story
 * is saved as it goes, so quitting to the title loses nothing.
 */
export function PauseMenu({ engine, state, crosshair, onCrosshair }: Props) {
  const [view, setView] = useState<View>("main");
  if (!engine) return null;
  const game = engine.game;

  if (view === "options") {
    return <OptionsMenu engine={engine} state={state} crosshair={crosshair} onCrosshair={onCrosshair} onBack={() => setView("main")} />;
  }

  const items: MenuItem[] = [
    { id: "resume", label: "Resume", run: () => engine.requestLock() },
    ...(state.journal.length ? [{ id: "journal", label: "Journal", detail: `${state.journal.length} recorded`, run: () => game.openPanel("journal") }] : []),
    { id: "options", label: "Options", run: () => setView("options") },
    { id: "controls", label: "Controls", run: () => setView("controls") },
    { id: "quit", label: "Quit to title", detail: "Progress is saved as you play", run: () => game.quitToTitle() },
  ];

  return (
    <div className="pause" role="dialog" aria-label="Paused">
      <div className="title-column">
        <span className="pause-eyebrow">{state.site ? `Paused · ${state.site.name}` : "Paused"}</span>
        <h1 className="pause-place">{state.site ? state.site.roomName : state.place}</h1>
        {state.objective && view === "main" && <p className="objective-line">{state.objective}</p>}

        {view === "main" ? (
          <MenuList items={items} label="Pause menu" onMove={() => engine.audio?.blip(520, 0.03)} />
        ) : (
          <div className="title-panel">
            <Keys />
            <button className="quiet" onClick={() => setView("main")} autoFocus onKeyDown={(e) => e.code === "Escape" && setView("main")}>
              Back <kbd>Esc</kbd>
            </button>
          </div>
        )}

        {import.meta.env.DEV && view === "main" && (
          <p className="dev-jumps">
            Dev:
            <button className="quiet" onClick={() => void game.jumpTo("house")}>
              House
            </button>
            <button className="quiet" onClick={() => void game.jumpTo("lab")}>
              Lab
            </button>
            <button className="quiet" onClick={() => void game.jumpToTrial("house")}>
              Trial
            </button>
            <button className="quiet" onClick={() => void game.jumpToTrial("house", "lab")}>
              Second trial
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
