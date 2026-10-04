import { useEffect, useState } from "react";
import type { Engine, EngineState } from "../engine/Engine";
import type { Evidence } from "../story/state";
import { CONTRADICTION } from "../story/entityScript";
import { MenuList, type MenuItem } from "./MenuList";
import { SisterPhoto } from "./SisterPhoto";

const PLACE_NAMES: Record<Evidence["place"], string> = { house: "The boyfriend's house", lab: "The research lab" };

/**
 * The investigation's screens, laid out the way a survival-horror game lays
 * out its item and file screens:
 *
 * - Examine: the camera has already leaned in on the object, so the middle
 *   stays clear; the name sits above it and the description below, with the
 *   keys for what can be done spelled out.
 * - Journal: a file list on the left, the selected file on the right.
 * - The device and the door: short menus.
 *
 * Opening one releases the pointer; going back takes it again, using the
 * click or key as the gesture pointer lock needs.
 */
export function InvestigationPanel({ engine, state }: { engine: Engine; state: EngineState }) {
  const { panel } = state;
  if (!panel) return null;
  const back = () => {
    engine.game.closePanel();
    engine.requestLock();
  };
  if (panel === "inspection") return <Examine engine={engine} state={state} back={back} />;
  if (panel === "journal") return <Journal engine={engine} state={state} back={back} />;
  if (panel === "device") return <DeviceScreen engine={engine} state={state} back={back} />;
  return <Door engine={engine} state={state} back={back} />;
}

type ScreenProps = { engine: Engine; state: EngineState; back: () => void };

function Examine({ engine, state, back }: ScreenProps) {
  const inspection = state.inspection;
  const game = engine.game;
  const canRecord = !!inspection && !(inspection.recorded && (!state.recalled || inspection.remembered));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyR" && !state.recalled) game.recall();
      if ((e.code === "Enter" || e.code === "Space") && canRecord && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        game.record();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [game, state.recalled, canRecord]);

  if (!inspection) return null;
  return (
    <div className="examine" role="dialog" aria-label={`Examine: ${inspection.title}`}>
      <header>
        <span className={inspection.key ? "examine-kind key" : "examine-kind"}>{inspection.key ? "Key evidence" : "Examine"}</span>
        <h1>{inspection.title}</h1>
        {inspection.recorded && <span className="examine-recorded">In the journal</span>}
      </header>
      <section className="examine-text">
        <p>{inspection.observation}</p>
        {state.recalled && (
          <div className="examine-recall">
            {/* Her face slips further with every memory he records. */}
            {inspection.key && <SisterPhoto kind="memory" stage={Math.floor(state.journal.filter((e) => e.memory).length / 3)} />}
            <p className="examine-memory">
              <span>Rowan remembers</span>
              {inspection.recall}
            </p>
          </div>
        )}
        <div className="examine-actions">
          {!state.recalled && (
            <button onClick={() => game.recall()}>
              <kbd>R</kbd> Try to remember
            </button>
          )}
          <button className="go" onClick={() => game.record()} disabled={!canRecord} autoFocus>
            <kbd>Enter</kbd>{" "}
            {inspection.recorded ? (state.recalled && !inspection.remembered ? "Add the memory to the journal" : "Recorded") : "Record in the journal"}
          </button>
          <button onClick={back}>
            <kbd>Esc</kbd> Back
          </button>
        </div>
        {state.recalled && <small className="examine-note">A memory is a recollection, not proof.</small>}
      </section>
    </div>
  );
}

function Journal({ state, back }: ScreenProps) {
  const contradiction = CONTRADICTION.every((id) => state.journal.some((e) => e.id === id));
  const [selected, setSelected] = useState<string>(contradiction ? "contradiction" : (state.journal[0]?.id ?? ""));
  const entry = state.journal.find((e) => e.id === selected);

  return (
    <div className="files" role="dialog" aria-label="Journal">
      <header>
        <span>Journal</span>
        <h1>{entry?.title ?? (selected === "contradiction" ? "These cannot both be true" : "Nothing yet")}</h1>
        <button className="quiet" onClick={back} autoFocus>
          Back <kbd>Esc</kbd>
        </button>
      </header>
      <div className="files-body">
        <nav className="files-list" aria-label="Recorded evidence">
          {state.site && (
            <p className="files-progress">
              {state.site.clues.found} of {state.site.clues.total} key evidence · {state.site.name}
            </p>
          )}
          {contradiction && (
            <button className="contradiction" aria-current={selected === "contradiction" || undefined} onClick={() => setSelected("contradiction")}>
              These cannot both be true
            </button>
          )}
          {(["house", "lab"] as const).map((place) => {
            const entries = state.journal.filter((e) => e.place === place);
            if (!entries.length) return null;
            return (
              <div key={place}>
                <h2>{PLACE_NAMES[place]}</h2>
                {entries.map((e) => (
                  <button key={e.id} aria-current={e.id === selected || undefined} onClick={() => setSelected(e.id)}>
                    {e.title}
                    {e.memory && <i aria-label="with a memory" />}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <article className="files-page">
          {selected === "contradiction" ? (
            <p>
              The clock in his house stopped at twenty to twelve on the fourteenth. At twenty to twelve on the fourteenth,
              her badge opened Lab 2. She cannot have died in two places at once.
            </p>
          ) : entry ? (
            <>
              <p>{entry.observation}</p>
              {entry.memory && (
                <p className="examine-memory">
                  <span>Rowan remembers</span>
                  {entry.memory}
                </p>
              )}
            </>
          ) : (
            <p>Examine things with E, and record what you see. It will all be here.</p>
          )}
          <p className="files-objective">{state.objective}</p>
        </article>
      </div>
    </div>
  );
}

function DeviceScreen({ engine, state, back }: ScreenProps) {
  const site = state.site;
  if (!site) return null;
  const game = engine.game;
  const open = site.rooms.filter((r) => r.open).map((r) => r.name);

  return (
    <div className="files" role="dialog" aria-label={site.device.name}>
      <header>
        <span>{site.name}</span>
        <h1>{site.device.name}</h1>
        <button className="quiet" onClick={back} autoFocus>
          Back <kbd>Esc</kbd>
        </button>
      </header>
      <div className="device-body">
        <p className="device-intro">{site.device.intro}</p>
        <div className="arrangements">
          {site.configurations.map((c) => (
            <article key={c.index} data-active={c.active || undefined}>
              <h2>{c.name}</h2>
              <p>{c.hint}</p>
              <ul>
                {c.links.map((link) => (
                  <li key={link}>{link}</li>
                ))}
              </ul>
              <button disabled={c.active} onClick={() => game.restoreDevice(c.index)}>
                {c.active ? "Active" : "Restore this"}
              </button>
            </article>
          ))}
          {site.canShift && (
            <article className="unknown">
              <h2>???</h2>
              <p>The dial turns further than this.</p>
              <button className="go" onClick={() => game.shiftDevice()}>
                Turn the dial
              </button>
            </article>
          )}
        </div>
        <p className="device-proof">
          {site.measuredBy
            ? `These arrangements were measured by Moth's Quantum Labyrinth: each room a qubit, a door open where two rooms measured the same. Job ${site.measuredBy}.`
            : "These are the arrangements the place was built with: Moth did not answer in time."}
        </p>
        <p className="files-objective">
          From the {site.roomName.toLowerCase()} now: {open.length ? open.join(", ") : "nowhere. Turn it, or restore another."}
        </p>
      </div>
    </div>
  );
}

function Door({ engine, state, back }: ScreenProps) {
  const site = state.site;
  if (!site) return null;
  const game = engine.game;
  const go = (run: () => void) => () => {
    run();
    engine.requestLock();
  };
  const items: MenuItem[] = [
    ...(site.complete ? [{ id: "leave", label: "Back to Room 01", detail: "The entity is waiting", run: go(() => void game.leaveSite()) }] : []),
    ...site.rooms
      .filter((r) => !r.here)
      .map((r) => ({
        id: r.id,
        label: r.name,
        detail: r.open ? (r.visited ? "Seen" : "Not yet seen") : "Not from here",
        disabled: !r.open,
        run: go(() => void game.travel(r.id)),
      })),
    ...(site.device.held ? [{ id: "device", label: `Use ${site.device.name}`, run: () => game.openPanel("device") }] : []),
    { id: "back", label: "Stay here", run: back },
  ];

  return (
    <div className="pause" role="dialog" aria-label="The door">
      <div className="title-column">
        <span className="pause-eyebrow">{site.name} · the door</span>
        <h1 className="pause-place">Where to?</h1>
        <p className="objective-line">{site.door}</p>
        <MenuList items={items} label="Destinations" onMove={() => engine.audio?.blip(520, 0.03)} />
        {!site.device.held && <p className="hint">Something in this place decides where its doors lead.</p>}
      </div>
    </div>
  );
}
