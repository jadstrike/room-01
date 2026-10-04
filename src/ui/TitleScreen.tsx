import { useEffect, useState } from "react";
import type { Engine, EngineState } from "../engine/Engine";
import type { CrosshairSettings } from "./crosshairSettings";
import { ENDING_ORDER, ENDING_TITLES } from "../story/endings";
import { MenuList, type MenuItem } from "./MenuList";
import { OptionsMenu } from "./OptionsMenu";
import { Keys } from "./Keys";
import { Credits } from "./Credits";

type View = "main" | "confirm" | "options" | "controls" | "credits";

type Props = {
  engine: Engine;
  state: EngineState;
  crosshair: CrosshairSettings;
  onCrosshair: (patch: Partial<CrosshairSettings>) => void;
};

/**
 * The main menu, drawn over the room itself: whatever level the save is in
 * loads behind it, so Continue is instant, and the view drifts slowly while
 * it waits. Arrow keys or W/S move, Enter picks, Esc goes back.
 */
export function TitleScreen({ engine, state, crosshair, onCrosshair }: Props) {
  const [view, setView] = useState<View>("main");
  const loading = state.phase !== "ready" || state.transition !== null;
  const game = engine.game;

  useEffect(() => {
    if (view === "main" || view === "options") return;
    const onKey = (e: KeyboardEvent) => e.code === "Escape" && setView("main");
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [view]);

  if (view === "options") {
    return <OptionsMenu engine={engine} state={state} crosshair={crosshair} onCrosshair={onCrosshair} onBack={() => setView("main")} />;
  }

  const items: MenuItem[] = [
    ...(state.progress ? [{ id: "continue", label: "Continue", detail: state.progress, disabled: loading, run: () => game.continueGame() }] : []),
    { id: "new", label: "New game", disabled: loading, run: () => (state.progress ? setView("confirm") : void game.beginNewGame()) },
    { id: "options", label: "Options", run: () => setView("options") },
    { id: "controls", label: "Controls", run: () => setView("controls") },
    { id: "credits", label: "Credits", run: () => setView("credits") },
  ];

  return (
    <div className="title-screen">
      <div className="title-column">
        <h1 className="game-title">
          ROOM <span>01</span>
        </h1>
        <p className="tagline">One of them killed your sister.</p>

        {view === "main" && <MenuList items={items} label="Main menu" onMove={() => engine.audio?.blip(520, 0.03)} />}

        {view === "confirm" && (
          <div className="title-panel">
            <p>Start again from the beginning? The story so far will be lost. Endings you have found are kept.</p>
            <div className="title-actions">
              <button className="primary" onClick={() => void game.beginNewGame()} autoFocus>
                Start again
              </button>
              <button className="quiet" onClick={() => setView("main")}>
                Back
              </button>
            </div>
          </div>
        )}

        {view === "controls" && (
          <div className="title-panel">
            <Keys />
            <button className="quiet" onClick={() => setView("main")} autoFocus>
              Back <kbd>Esc</kbd>
            </button>
          </div>
        )}

        {view === "credits" && (
          <div className="title-panel">
            <p>A game about a sister you remember. Made for the Moth quantum games hackathon.</p>
            <Credits />
            <button className="quiet" onClick={() => setView("main")} autoFocus>
              Back <kbd>Esc</kbd>
            </button>
          </div>
        )}

        <footer className="title-footer">
          {loading ? (
            <span className="title-loading">{state.transition?.step || "Preparing the room"}…</span>
          ) : (
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> select · <kbd>Enter</kbd> choose
            </span>
          )}
          <span className="endings-found" aria-label={`${state.endingsFound.length} of 4 endings found`}>
            Endings{" "}
            {ENDING_ORDER.map((id) => (
              <i key={id} data-found={state.endingsFound.includes(id) || undefined} title={state.endingsFound.includes(id) ? ENDING_TITLES[id] : "Not found yet"} />
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
