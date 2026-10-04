import type { EngineState } from "../engine/Engine";

/** Everything drawn over the viewport while the player has the pointer. */
export function HUD({ state }: { state: EngineState }) {
  const { focus, stats, site } = state;

  return (
    <>
      <div className="objective">
        <span>{state.place}</span>
        {state.objective && <p>{state.objective}</p>}
        <small>
          {site && `${site.clues.found}/${site.clues.total} key evidence · ${site.config.name} · `}
          {state.journal.length > 0 && <><kbd>J</kbd> journal</>}
          {site?.device.held && <> · <kbd>P</kbd> device</>}
        </small>
      </div>

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
          <dt>Res</dt>
          <dd>{Math.round(stats.renderScale * 100)}%</dd>
        </div>
        <div>
          <dt>Tris</dt>
          <dd>{stats.triangles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Meshes</dt>
          <dd>{stats.meshes}</dd>
        </div>
        {stats.characterHeight > 0 && (
          <div>
            <dt>Figure</dt>
            <dd>
              {stats.characterHeight.toFixed(2)} m{stats.scaled && <em> scaled</em>}
            </dd>
          </div>
        )}
        {!site && (
          <div className={state.specOk ? "spec ok" : "spec bad"}>
            <dt>Spec</dt>
            <dd>{state.specOk ? "match" : "see console"}</dd>
          </div>
        )}
      </dl>

      {state.debug && <p className="debug-note">Collider view · green = level bounds, red = obstacles</p>}
    </>
  );
}
