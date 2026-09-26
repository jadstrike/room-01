import type { EngineState } from "../engine/Engine";
import { ROOM01 } from "../engine/room01";

/** Everything drawn over the viewport while the player has the pointer. */
export function HUD({ state }: { state: EngineState }) {
  const { focus, stats } = state;

  return (
    <>
      {focus && (
        <div className="prompt" role="status">
          <kbd>E</kbd>
          <span>
            {focus.verb} {focus.label}
          </span>
        </div>
      )}

      {state.message && <p className="message">{state.message}</p>}

      <dl className="stats" aria-label="Scene statistics">
        <div>
          <dt>FPS</dt>
          <dd>{stats.fps || "–"}</dd>
        </div>
        <div>
          <dt>Tris</dt>
          <dd>{stats.triangles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Meshes</dt>
          <dd>{stats.roomMeshes}</dd>
        </div>
        <div>
          <dt>Figure</dt>
          <dd>
            {stats.characterHeight ? `${stats.characterHeight.toFixed(2)} m` : "–"}
            {stats.scaled && <em> scaled</em>}
          </dd>
        </div>
        <div className={state.specOk ? "spec ok" : "spec bad"}>
          <dt>Spec</dt>
          <dd>{state.specOk ? "match" : "see console"}</dd>
        </div>
      </dl>

      {state.debug && (
        <p className="debug-note">
          Collider view · room {ROOM01.shell.xMin}…{ROOM01.shell.xMax} m · green = confinement, red = spec colliders
        </p>
      )}
    </>
  );
}
