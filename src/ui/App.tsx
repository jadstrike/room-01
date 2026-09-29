import { useCallback, useEffect, useState } from "react";
import { useEngine } from "./useEngine";
import { HUD } from "./HUD";
import { PauseMenu } from "./PauseMenu";
import { Crosshair } from "./Crosshair";
import { loadCrosshair, saveCrosshair, type CrosshairSettings } from "./crosshairSettings";

export function App() {
  const { containerRef, engine, state } = useEngine();
  const [crosshair, setCrosshair] = useState<CrosshairSettings>(loadCrosshair);
  const [dragging, setDragging] = useState(false);

  const updateCrosshair = useCallback((patch: Partial<CrosshairSettings>) => {
    setCrosshair((prev) => {
      const next = { ...prev, ...patch };
      saveCrosshair(next);
      return next;
    });
  }, []);

  // Drop a character anywhere on the page, as the Room 01 viewer does.
  useEffect(() => {
    if (!engine) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (!files.length) return;
      // A picture on its own goes on a sign; anything else is a character.
      if (files.every((f) => f.type.startsWith("image/"))) {
        const target = engine.signDropTarget();
        if (target) void engine.setSignPicture(target, files[0]);
      } else void engine.loadCharacterFiles(files);
    };
    addEventListener("dragover", onDragOver);
    addEventListener("dragleave", onDragLeave);
    addEventListener("drop", onDrop);
    return () => {
      removeEventListener("dragover", onDragOver);
      removeEventListener("dragleave", onDragLeave);
      removeEventListener("drop", onDrop);
    };
  }, [engine]);

  const playing = state.phase === "ready" && state.locked;

  return (
    <div className="app" ref={containerRef}>
      <Crosshair engine={engine} settings={crosshair} focused={Boolean(state.focus)} hidden={!playing} />

      {playing && <HUD state={state} />}

      {state.phase === "loading" && (
        <div className="overlay">
          <p className="loading">Loading Room 01…</p>
        </div>
      )}

      {state.phase === "error" && (
        <div className="overlay">
          <div className="error">
            <h2>Could not load the room</h2>
            <p>{state.error}</p>
            <p className="hint">Check that /models/horror_room.web.glb is being served.</p>
          </div>
        </div>
      )}

      {state.phase === "ready" && !state.locked && (
        <PauseMenu engine={engine} state={state} crosshair={crosshair} onCrosshair={updateCrosshair} />
      )}

      {dragging && <div className="dropzone">Drop a picture for the sign, or a .glb character</div>}
    </div>
  );
}
