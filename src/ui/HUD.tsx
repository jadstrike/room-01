import { useEffect, useRef, useState } from "react";
import type { EngineState } from "../engine/Engine";

const TIP_SECONDS = 9;

/**
 * Everything drawn over the viewport while the player has the pointer, kept
 * as quiet as a survival-horror HUD: a prompt under the crosshair only when
 * something can be used, the objective announced once when it changes and
 * then tucked into the corner, captions that fade on their own, and a tip
 * card the first time a new thing matters.
 */
export function HUD({ state }: { state: EngineState }) {
  const { focus, stats, site } = state;

  return (
    <>
      <div className="objective">
        <span>{state.place}</span>
        {state.objective && <p>{state.objective}</p>}
        <small>
          {site && `${site.clues.found}/${site.clues.total} key evidence · `}
          {state.journal.length > 0 && (
            <>
              <kbd>J</kbd> journal
            </>
          )}
          {site?.device.held && (
            <>
              {" "}
              · <kbd>P</kbd> device
            </>
          )}
        </small>
      </div>

      <ObjectiveBanner objective={state.objective} />

      {focus && (
        <div className="prompt" role="status">
          <kbd>E</kbd>
          <span className="verb">{focus.verb}</span>
          <span className="label">{focus.label}</span>
        </div>
      )}

      {state.message && (
        <p className="message" key={state.message}>
          {state.message}
        </p>
      )}

      {state.tip && <TipCard tip={state.tip} />}

      {state.weapon && !state.weapon.holstered && (
        <div className="ammo" aria-label={`${state.weapon.name}: ${state.weapon.ammo} in the magazine, ${state.weapon.reserve} in reserve`}>
          <span className="weapon-name">{state.weapon.reloading ? "Reloading…" : state.weapon.name}</span>
          <span className={state.weapon.ammo <= Math.ceil(state.weapon.magSize * 0.25) ? "mag low" : "mag"}>{state.weapon.ammo}</span>
          <span className="reserve">/ {state.weapon.reserve}</span>
        </div>
      )}

      {state.debug && (
        <>
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
          </dl>
          <p className="debug-note">Collider view · green = level bounds, red = obstacles</p>
        </>
      )}
    </>
  );
}

/** "New objective", centred at the top for a few seconds whenever it changes. */
function ObjectiveBanner({ objective }: { objective: string }) {
  const last = useRef(objective);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (objective && objective !== last.current) setShown(objective);
    last.current = objective;
  }, [objective]);
  if (!shown) return null;
  return (
    <div className="objective-banner" key={shown} onAnimationEnd={() => setShown(null)} role="status">
      <span>New objective</span>
      <p>{shown}</p>
    </div>
  );
}

function TipCard({ tip }: { tip: NonNullable<EngineState["tip"]> }) {
  const [gone, setGone] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setGone(tip.id), TIP_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [tip.id]);
  if (gone === tip.id) return null;
  return (
    <aside className="tip-card" key={tip.id} role="note">
      <span>Tip · {tip.title}</span>
      <p>{tip.text}</p>
      <div>
        {tip.keys.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </div>
    </aside>
  );
}
