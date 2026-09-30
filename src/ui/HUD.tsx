import { locationLabel } from "../engine/house/locations";
import type { EngineState } from "../engine/Engine";


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

      {state.weapon && !state.weapon.holstered && (
        <div className="ammo" aria-label={`${state.weapon.name}: ${state.weapon.ammo} in the magazine, ${state.weapon.reserve} in reserve`}>
          <span className="weapon-name">{state.weapon.reloading ? "Reloading…" : state.weapon.name}</span>
          <span className={state.weapon.ammo <= Math.ceil(state.weapon.magSize * 0.25) ? "mag low" : "mag"}>{state.weapon.ammo}</span>
          <span className="reserve">/ {state.weapon.reserve}</span>
        </div>
      )}

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
          <dt>{state.location !== "room01" ? "Section" : "Spec"}</dt>
          <dd>{state.location !== "room01" ? locationLabel(state.location).replace("House / ", "") : state.specOk ? "match" : "see console"}</dd>
        </div>
      </dl>

      {state.debug && (
        <p className="debug-note">
          Collider view · green = room boundary, red = obstacles
        </p>
      )}
    </>
  );
}
