/**
 * Plays the story offline: the dialogue scripts, the investigation rules and
 * the save, with no three.js and no browser. Every node a script can reach
 * must exist, and each of the four endings must be reachable the way the
 * story flowchart says. Run it after editing a script.
 */
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true }, logLevel: "error" });
try {
  const { Conversation } = await server.ssrLoadModule("/src/story/dialogue.ts");
  const { ENTITY_SCRIPT, entityStart, contradiction } = await server.ssrLoadModule("/src/story/entityScript.ts");
  const { ACCUSED_SCRIPT, accusedStart } = await server.ssrLoadModule("/src/story/accusedScript.ts");
  const { newStoryState, parseSave } = await server.ssrLoadModule("/src/story/state.ts");
  const { SITES } = await server.ssrLoadModule("/src/story/sites.ts");
  const { Investigation } = await server.ssrLoadModule("/src/story/investigation.ts");
  const { endingFor } = await server.ssrLoadModule("/src/story/endings.ts");

  // --- every script link resolves ---------------------------------------------------
  for (const [name, script] of [["entity", ENTITY_SCRIPT], ["accused", ACCUSED_SCRIPT]]) {
    for (const [id, node] of Object.entries(script)) {
      for (const c of node.choices ?? []) assert(script[c.next], `${name}:${id} -> missing node ${c.next}`);
      if (typeof node.next === "string") assert(script[node.next], `${name}:${id} -> missing node ${node.next}`);
    }
  }

  // --- helpers -------------------------------------------------------------------------
  const talk = (script, s, start) => new Conversation(script, s, start);
  /** Pick the choice whose label starts with `label`; fails if it is not on offer. */
  const say = (c, label) => {
    const i = c.view.choices.findIndex((ch) => ch.label.startsWith(label));
    assert(i >= 0, `"${label}" not offered at "${c.view.text.slice(0, 50)}" (offered: ${c.view.choices.map((ch) => ch.label).join(" | ")})`);
    c.choose(i);
  };
  /** Continue through choiceless lines until a choice or the end. Returns false at the end. */
  const on = (c) => {
    while (!c.view.choices.length) if (!c.advance()) return false;
    return true;
  };
  const offers = (c, label) => c.view.choices.some((ch) => ch.label.startsWith(label));
  /** What Game.endDialogue does with a request. */
  const close = (s) => {
    const r = s.request;
    s.request = null;
    if (r?.kind === "travel") {
      s.act = "investigating";
      s.rounds.push(r.to);
    }
    return r;
  };
  /** Record every key clue of `place`, as a completed investigation would. */
  const investigate = (s, place) => {
    const inv = new Investigation(SITES[place], s);
    for (const [room, id] of Object.entries(SITES[place].keyClues)) inv.record({ ...inv.inspection(id, id, `${id} observed`), room }, true);
    assert(inv.complete, `${place}: not complete after recording every key clue`);
    s.act = "trial";
  };

  /** Room 01's first act, up to the coin. */
  const opening = () => {
    const s = newStoryState();
    const c = talk(ENTITY_SCRIPT, s, entityStart(s));
    say(c, "Who are these two?");
    on(c);
    say(c, "Tell me about the boyfriend.");
    on(c);
    say(c, "How do I find out which one?");
    say(c, "The boyfriend's house.");
    on(c);
    assert(s.coin === "heads" || s.coin === "tails");
    say(c, "...Fine.");
    assert(!on(c));
    const r = close(s);
    assert.equal(r.kind, "travel");
    assert.equal(r.to, s.destination);
    return s;
  };
  /** Back from the first site, at the verdict. */
  const atVerdict = (s) => {
    const c = talk(ENTITY_SCRIPT, s, entityStart(s));
    say(c, "I've decided.");
    return c;
  };

  // --- ending 1 and 2: name one and shoot him; reconsidering loops back ----------------
  for (const who of ["boyfriend", "coworker"]) {
    const s = opening();
    investigate(s, s.rounds[0]);
    let c = atVerdict(s);
    assert(offers(c, "None of this proves anything."), "the first trial must allow a challenge");
    assert(!offers(c, "Your story doesn't add up."), "one site cannot contradict itself");
    say(c, `The ${who}.`);
    say(c, "No. Wait.");
    say(c, `The ${who}.`);
    say(c, "Yes.");
    assert.equal(s.act, "execution");
    assert.equal(s.accused, who);
    assert.equal(close(s).kind, "execute");
    // Talk to the entity instead of shooting: change your mind, then mean it.
    c = talk(ENTITY_SCRIPT, s, entityStart(s));
    say(c, "I've changed my mind.");
    assert.equal(s.act, "trial");
    assert.equal(s.accused, null);
    assert.equal(close(s).kind, "stand-down");
    c = atVerdict(s);
    say(c, `The ${who}.`);
    say(c, "Yes.");
    close(s);
    assert.equal(endingFor(who, s).number, who === "boyfriend" ? 1 : 2);
  }

  // --- ending 3: refuse, and accept the threat ---------------------------------------------
  {
    const s = opening();
    investigate(s, s.rounds[0]);
    const c = atVerdict(s);
    say(c, "I won't kill anyone.");
    say(c, "...Let me think.");
    say(c, "I won't kill anyone.");
    say(c, "Then let it be me.");
    assert.deepEqual(close(s), { kind: "ending", ending: "rowan" });
    assert.equal(endingFor("rowan", s).number, 3);
  }

  // --- the challenge, the contradiction, the reveal, and ending 4 ---------------------------
  {
    const s = opening();
    const first = s.rounds[0];
    investigate(s, first);
    let c = atVerdict(s);
    say(c, "None of this proves anything.");
    const r = close(s);
    assert.equal(r.kind, "travel");
    assert.notEqual(r.to, first, "the challenge must send Rowan to the other place");
    investigate(s, r.to);
    assert(contradiction(s), "both sites in the journal must contradict each other");

    // The accused answer evidence from both places now.
    for (const who of ["boyfriend", "coworker"]) {
      const a = talk(ACCUSED_SCRIPT, s, accusedStart(who, s));
      assert(a.view.choices.length <= 10, `${who}: more choices than number keys`);
      say(a, "Did you kill her?");
      say(a, "That's all.");
      assert(!on(a));
    }

    c = atVerdict(s);
    assert(!offers(c, "None of this proves anything."), "only one challenge");
    say(c, "Your story doesn't add up.");
    on(c);
    say(c, "What did you do to me?");
    say(c, "Then who killed her?");
    on(c);
    assert.equal(s.act, "revealed");
    assert(offers(c, "I'm putting the gun down."));
    // Naming one after the reveal is still endings 1 or 2, and reconsidering comes back here.
    say(c, "The coworker.");
    say(c, "Yes.");
    assert.equal(s.verdictFrom, "revealed");
    close(s);
    c = talk(ENTITY_SCRIPT, s, entityStart(s));
    say(c, "I've changed my mind.");
    assert.equal(s.act, "revealed");
    close(s);
    on(c);
    say(c, "I'm putting the gun down.");
    say(c, "No.");
    say(c, "Then do it.");
    assert.equal(s.act, "released");
    assert.deepEqual(close(s), { kind: "release" });
    assert.equal(endingFor("walk-away", s).number, 4);
    // The accused, after the reveal, doubt their own memories.
    assert.equal(accusedStart("boyfriend", s), "boyfriend:after");
  }

  // --- the device can reach every room, by its own rules ------------------------------------
  for (const site of Object.values(SITES)) {
    const s = newStoryState();
    const inv = new Investigation(site, s);
    inv.acquireDevice();
    while (inv.shift());
    // Every arrangement has now been shown, so restore() can reach any of them.
    const seen = new Set([site.start]);
    const queue = [site.start];
    while (queue.length) {
      const room = queue.shift();
      for (let i = 0; i < site.configurations.length; i++) {
        s.sites[site.id].room = room;
        if (i !== s.sites[site.id].configuration) inv.restore(i);
        for (const next of inv.exits) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    }
    assert.equal(seen.size, site.rooms.length, `${site.id}: the device cannot reach every room`);
  }

  // --- the Labyrinth: measured layouts become arrangements that can reach every room -------
  {
    const { layoutsFrom, doorsOf, reachable, LATTICES } = await server.ssrLoadModule("/src/story/labyrinth.ts");
    const { LABYRINTHS } = await server.ssrLoadModule("/api/_moth.js");
    for (const place of ["house", "lab"]) {
      const l = LATTICES[place];
      const server_ = LABYRINTHS[place];
      assert.equal(l.rows * l.cols, l.rooms.length, `${place}: lattice size`);
      assert.deepEqual(l.edges, server_.edges, `${place}: the server and the game disagree on the lattice`);
      assert.equal(l.rooms[server_.start], SITES[place].start, `${place}: the radiating qubit is not the start room`);
      assert.deepEqual([...l.rooms].sort(), [...SITES[place].rooms].sort(), `${place}: lattice rooms differ from the site`);
    }
    assert.deepEqual(doorsOf("house", "011000"), doorsOf("house", "100111"), "a bitstring and its complement open the same doors");
    const fixture = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("./moth/fixture-house-labyrinth.json", import.meta.url), "utf8"));
    const measured = layoutsFrom(SITES.house, fixture.job, fixture.output.measurements);
    assert(measured && measured.configurations.length >= 2, "a real result gives at least two arrangements");
    assert.equal(reachable(SITES.house, measured.configurations).size, SITES.house.rooms.length, "a real result strands a room");
    // A result that only ever opens one corridor still cannot strand Rowan.
    const poor = layoutsFrom(SITES.house, "x", [{ bitstring: "110000", probability: 0.9 }, { bitstring: "111111", probability: 0.1 }]);
    assert.equal(reachable(SITES.house, poor.configurations).size, SITES.house.rooms.length, "the fallback must reach every room");
    assert.equal(layoutsFrom(SITES.house, "x", [{ bitstring: "111111", probability: 1 }]), null, "a result that says nothing is not used");
    // The device rules over measured arrangements.
    const s = newStoryState();
    const inv = new Investigation(SITES.house, s);
    s.sites.house.measured = measured;
    inv.acquireDevice();
    while (inv.shift());
    assert.equal(s.sites.house.history.length, measured.configurations.length);
  }

  // --- saves ---------------------------------------------------------------------------------
  {
    const s = opening();
    investigate(s, s.rounds[0]);
    const back = parseSave(JSON.stringify(s));
    assert.equal(back.act, "trial");
    assert.equal(back.journal.length, s.journal.length);
    for (const bad of [null, "nope", "{}", JSON.stringify({ ...s, version: 0 }), JSON.stringify({ ...s, act: "lost" }), JSON.stringify({ ...s, act: "investigating", rounds: [] })]) {
      assert.equal(parseSave(bad).act, "intro", `bad save accepted: ${String(bad).slice(0, 40)}`);
    }
  }

  console.log("ok story: every node resolves; endings 1-4 reachable; challenge, contradiction and reveal; device reaches every room; measured layouts reach every room; saves round-trip");
} finally {
  await server.close();
}
