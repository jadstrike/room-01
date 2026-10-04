import type { Engine, EngineState } from "../engine/Engine";
import type { Evidence } from "../story/state";
import { CONTRADICTION } from "../story/entityScript";

const PLACE_NAMES: Record<Evidence["place"], string> = { house: "The boyfriend's house", lab: "The research lab" };

/**
 * The investigation's panels: what Rowan sees when he examines something,
 * his journal, the device that rearranges a site, and the choice at a door.
 * Opening one releases the pointer; going back to the room takes it again,
 * using the click as the gesture pointer lock needs.
 */
export function InvestigationPanel({ engine, state }: { engine: Engine; state: EngineState }) {
  const { panel, site, inspection } = state;
  const game = engine.game;
  if (!panel) return null;
  const back = () => {
    game.closePanel();
    engine.requestLock();
  };

  return (
    <div className="panel-backdrop">
      <section className="panel" role="dialog" aria-modal="true" aria-label={TITLES[panel]}>
        <header>
          <span>{site ? `${site.name} · ${site.roomName}` : state.place}</span>
          <button className="quiet" onClick={back} autoFocus>
            Back to the room <kbd>Esc</kbd>
          </button>
        </header>

        {panel === "inspection" && inspection && (
          <>
            <span className="eyebrow">{inspection.key ? "Key evidence" : "Observation"}</span>
            <h1>{inspection.title}</h1>
            <p>{inspection.observation}</p>
            {state.recalled ? (
              <div className="memory">
                <h2>Rowan remembers</h2>
                <p>{inspection.recall}</p>
                <small>A memory is a recollection, not proof.</small>
              </div>
            ) : (
              <button onClick={() => game.recall()}>Try to remember</button>
            )}
            <div className="actions">
              <button
                className="primary"
                onClick={() => game.record()}
                disabled={inspection.recorded && (!state.recalled || inspection.remembered)}
              >
                {inspection.recorded
                  ? state.recalled && !inspection.remembered
                    ? "Add the memory to the journal"
                    : "In the journal"
                  : "Record in the journal"}
              </button>
              <button onClick={() => game.openPanel("journal")}>Read the journal</button>
            </div>
          </>
        )}

        {panel === "journal" && (
          <>
            <h1>Journal</h1>
            {site && (
              <p className="hint">
                {site.clues.found} of {site.clues.total} key evidence from {site.name.toLowerCase()} ·{" "}
                {site.rooms.filter((r) => r.visited).length} of {site.rooms.length} rooms seen
              </p>
            )}
            <p className="objective-line">{state.objective}</p>
            {!state.journal.length && <p>Nothing yet. Examine things with E, then record what you see.</p>}
            {CONTRADICTION.every((id) => state.journal.some((e) => e.id === id)) && (
              <div className="memory contradiction">
                <h2>These cannot both be true</h2>
                <p>
                  The clock in his house stopped at twenty to twelve on the fourteenth. At twenty to twelve on the
                  fourteenth, her badge opened Lab 2. She cannot have died in two places at once.
                </p>
              </div>
            )}
            {(["house", "lab"] as const).map((place) => {
              const entries = state.journal.filter((e) => e.place === place);
              if (!entries.length) return null;
              return (
                <div key={place}>
                  <h2>{PLACE_NAMES[place]}</h2>
                  {entries.map((e) => (
                    <article className="journal-entry" key={e.id}>
                      <h3>{e.title}</h3>
                      <p>{e.observation}</p>
                      {e.memory && (
                        <div className="memory">
                          <strong>Rowan remembers</strong>
                          <p>{e.memory}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {panel === "device" && site && (
          <>
            <h1>{site.device.name}</h1>
            <p>{site.device.intro}</p>
            <div className="actions">
              <button className="primary" onClick={() => game.shiftDevice()} disabled={!site.canShift}>
                {site.canShift ? "Turn the dial to something new" : "Every arrangement found"}
              </button>
            </div>
            <h2>Arrangements it remembers</h2>
            <div className="configurations">
              {site.configurations.map((c) => (
                <article key={c.index} data-active={c.active || undefined}>
                  <h3>{c.name}</h3>
                  <p>{c.hint}</p>
                  <ul>
                    {c.links.map((link) => (
                      <li key={link}>{link}</li>
                    ))}
                  </ul>
                  <button disabled={c.active} onClick={() => game.restoreDevice(c.index)}>
                    {c.active ? "Active" : "Restore"}
                  </button>
                </article>
              ))}
            </div>
            <p className="hint">
              From the {site.roomName.toLowerCase()} now:{" "}
              {site.rooms.filter((r) => r.open).map((r) => r.name).join(", ") || "nowhere"}.
            </p>
          </>
        )}

        {panel === "passage" && site && (
          <>
            <h1>The door</h1>
            <p>{site.door}</p>
            <div className="routes">
              {site.complete && (
                <button
                  className="primary"
                  onClick={() => {
                    void game.leaveSite();
                    engine.requestLock();
                  }}
                >
                  Go back to Room 01 · the entity is waiting
                </button>
              )}
              {site.rooms
                .filter((r) => !r.here)
                .map((r) => (
                  <button
                    key={r.id}
                    disabled={!r.open}
                    onClick={() => {
                      void game.travel(r.id);
                      engine.requestLock();
                    }}
                  >
                    {r.open ? "Through to" : "Not from here:"} {r.name}
                    {r.visited ? " · seen" : ""}
                  </button>
                ))}
            </div>
            {site.device.held ? (
              <button onClick={() => game.openPanel("device")}>Use {site.device.name}</button>
            ) : (
              <p className="hint">Something in this place decides where its doors lead.</p>
            )}
          </>
        )}

        {state.saveWarning && (
          <p className="hint" role="alert">
            {state.saveWarning}
          </p>
        )}
      </section>
    </div>
  );
}

const TITLES = { inspection: "Examine", journal: "Journal", device: "Device", passage: "Door" } as const;
