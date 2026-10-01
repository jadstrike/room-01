import type { Engine, EngineState } from "../engine/Engine";
import { CONFIGURATIONS, HOUSE_ROOMS, HouseRun, KEY_CLUES, ROOM_NAMES } from "../engine/house/HouseRun";

export function HousePlaythrough({ engine, state }: { engine: Engine; state: EngineState }) {
  if (!state.house) return null;
  const run = new HouseRun(state.house), { housePanel, inspection } = state;
  const collected = inspection && state.house.journal.find(e => e.id === inspection.id);
  const panel = housePanel ?? (!state.locked ? "pause" : null);
  return <>
    <aside className="house-status">
      <span>THE HOUSE · {ROOM_NAMES[state.house.room]}</span>
      <strong>{run.config.name}</strong>
      <p>{run.objective}</p>
      <small>{state.house.visited.length}/6 rooms · {run.clueCount}/6 key clues · J journal · P device</small>
    </aside>
    {panel && <div className="house-backdrop"><section className="house-panel" role="dialog" aria-modal="true" aria-label={panel === "pause" ? "House investigation" : panel}>
      <header><span>ROWAN'S INVESTIGATION</span><button onClick={() => { engine.closeHousePanel(); engine.requestLock(); }}>{panel === "pause" ? "Explore the room" : "Back to the room"}</button></header>
      {panel === "pause" && <>
        <h1>{run.complete ? "The house leaves questions." : "The boyfriend's house"}</h1>
        <p>{run.complete ? "You have visited every room, recovered earlier configurations and recorded the key evidence. The rifle and the argument are not a verdict. The repair records offer other explanations. This is the end of the first house playthrough." : "The coin has brought you to the living room. Inspect objects, recall what Rowan remembers, and record evidence. The brass device beside the hall door changes which rooms connect."}</p>
        <p>WASD to move · mouse to look · E to inspect or use a passage · J journal · P device · Esc pause</p>
        <p>At a hall door, choose an open connection to step into that room. A fold in the passage returns you beside the next room's door.</p>
        <div className="house-actions"><button onClick={() => engine.openHousePanel("journal")}>Open journal</button><button onClick={() => state.house!.device ? engine.openHousePanel("device") : engine.acquireHouseDevice()}>{state.house.device ? "Use device" : "Pick up nearby brass device"}</button><button onClick={() => engine.openHousePanel("passage")}>Open nearby passage</button></div>
        <details><summary>Start over</summary><p>This clears the saved house investigation.</p><button onClick={() => engine.restartHouse()}>Start a new house investigation</button></details>
      </>}
      {panel === "inspection" && inspection && <>
        <span className="house-eyebrow">{ROOM_NAMES[inspection.room]} {KEY_CLUES[inspection.room] === inspection.id ? '· Key clue' : ''}</span>
        <h1>{inspection.title}</h1><h2>Observation</h2><p>{inspection.observation}</p>
        <button onClick={() => engine.recallEvidence()} disabled={state.recalled}>{state.recalled ? "Memory recalled" : "Recall"}</button>
        {state.recalled && <div className="house-memory"><h2>Rowan remembers</h2><p>{inspection.recall}</p><small>A memory is a recollection, not proof.</small></div>}
        <div className="house-actions"><button onClick={() => engine.collectEvidence()} disabled={!!collected && (!state.recalled || !!collected.memory)}>{collected ? state.recalled && !collected.memory ? "Add memory to journal" : "Recorded in journal" : "Record evidence in journal"}</button><button onClick={() => engine.openHousePanel("journal")}>Read journal</button></div>
      </>}
      {panel === "journal" && <>
        <h1>Evidence journal</h1><p>{run.clueCount}/6 key clues · {state.house.visited.length}/6 rooms · {state.house.restores} configuration recalls</p>
        <p>{run.objective}</p>
        <details><summary>Key clues to look for</summary><p>Living room: clock · Kitchen: cup · Utility room: cleaning cupboard · Bedroom: broken frame · Basement: rifle · Study: repair receipts</p></details>
        {!state.house.journal.length && <p>Your journal is empty. Examine an object with E, then record your observation.</p>}
        {state.house.journal.map(e => <article className="journal-entry" key={e.id}><small>{ROOM_NAMES[e.room]}{KEY_CLUES[e.room] === e.id ? " · Key clue" : ""}</small><h2>{e.title}</h2><p>{e.observation}</p>{e.memory && <div className="house-memory"><strong>Recollection</strong><p>{e.memory}</p></div>}</article>)}
      </>}
      {panel === "device" && <>
        <h1>The brass device</h1><p>Turning the dial folds the house into a new arrangement. You keep your position and journal. Each arrangement is remembered; restore one whenever a passage cuts you off.</p>
        <strong>Active: {run.config.name}</strong><p>{run.config.hint}</p>
        <button onClick={() => engine.shiftHouse()} disabled={state.house.history.length === CONFIGURATIONS.length}>Discover next configuration</button>
        <h2>Remembered configurations</h2>
        <div className="house-configurations">{state.house.history.map(index => <article key={index}><h3>{CONFIGURATIONS[index].name}</h3><p>{CONFIGURATIONS[index].hint}</p><ul>{CONFIGURATIONS[index].edges.map(([a,b]) => <li key={a+b}>{ROOM_NAMES[a]} ↔ {ROOM_NAMES[b]}</li>)}</ul><button disabled={index === state.house!.configuration} onClick={() => engine.restoreHouse(index)}>{index === state.house!.configuration ? "Active" : "Restore configuration"}</button></article>)}</div>
        <p>Open from here: {run.exits.map(r => ROOM_NAMES[r]).join(', ') || "none — shift or restore the device"}.</p>
      </>}
      {panel === "passage" && <>
        <h1>The shifting passage</h1><p>{ROOM_NAMES[state.house.room]} · {run.config.name}</p>
        <p>Only the connections in this arrangement can be crossed.</p>
        <div className="house-routes">{HOUSE_ROOMS.filter(r => r !== state.house!.room).map(room => <button key={room} disabled={!run.exits.includes(room)} onClick={() => engine.travelHouse(room)}>{run.exits.includes(room) ? "Enter" : "Sealed"} · {ROOM_NAMES[room]}{state.house!.visited.includes(room) ? " · visited" : ""}</button>)}</div>
        {!run.exits.length && <p>This room is cut off. Use the device to restore a connection.</p>}
        <button disabled={!state.house.device} onClick={() => engine.openHousePanel("device")}>Use device</button>
      </>}
      {state.saveWarning && <p role="alert">{state.saveWarning}</p>}
    </section></div>}
  </>;
}
