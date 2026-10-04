# Sites: the house and the lab

The coin sends Rowan to one of two sites; a challenge at the trial sends him to the other. Each is a handful of procedural rooms joined by doors that a device rearranges. This page covers how they are put together and how to add to them.

## The pieces

| | |
|---|---|
| `src/story/sites.ts` | Each site as data: its rooms and their display names, the start room, the device's configurations (which rooms connect), the key clue in each room and what Rowan remembers of it. No three.js. |
| `src/story/investigation.ts` | The rules over that data: open exits, taking the device, shifting to a new configuration, restoring an old one, travelling, recording evidence, completion. |
| `src/engine/house/`, `src/engine/lab/` | One class per room, built from boxes and cylinders in local metres. |
| `src/engine/levels/rooms.ts` | Room id → constructor. A room in `sites.ts` without an entry here fails `verify:sites`. |
| `src/engine/levels/SiteLevel.ts` | Wraps one room as a level: batches its geometry, adds the device if it is still on the wall, drives the main light from the flicker. |
| `src/engine/Game.ts` | Registers what E does on each examinable, the exit door and the device, and moves between rooms. |

## How a visit works

Rowan arrives in the site's start room, where the device hangs beside the door. Rooms connect only through the device's current configuration: E on the exit door goes straight through if there is one way to go, or opens a choice of the rooms this arrangement connects (the rest are shown as "not from here"). If a room is cut off, the device (P) shifts to an arrangement it has not shown yet, or restores one it has.

Examining something shows what Rowan sees. *Try to remember* adds what he recalls, which for a key clue is written per clue in `sites.ts`, and for anything else is a vague line. *Record* puts it in the journal (J). Once every key clue of the site is recorded, every door offers the way back to Room 01.

Each door is a short fade to black, not a walk through. Sites have no floor plan to stream, since the device rearranges them, and keeping two rooms loaded would double the lights every pixel pays for. A room builds in milliseconds; the fade covers disposing the old one, compiling the new one's shaders and drawing its shadow maps once (nothing in a site room moves, so they are never redrawn).

## The evidence

Every key clue points at the site's owner and then undercuts itself: the rifle has not been fired since November, the "blood" on the coat is wood stain; his badge opened Lab 2, but it was reported lost; the valve was opened by hand, or it opens by itself. The accused answer each of their own site's key clues when Rowan puts it to them (`src/story/accusedScript.ts`).

Two clues are written to contradict each other across sites, and the twist depends on them: the living room's mantel clock stopped at 23:40 on the 14th, and the lab's night log has her badge opening Lab 2 at 23:40 on the 14th. Both IDs are in `CONTRADICTION` in `src/story/entityScript.ts`. **Change either text and the reveal stops making sense.**

## Adding a room

1. Write a class extending `ProceduralSection` (see any of the lab rooms). Use `shell()` and `doorSlab()` for the walls, doorway and door. Give it `bounds`, `spawn`, `lookAt`, `dustOrigin` and a `ports` entry at the doorway. Put furniture in named groups, mark solid things with `solid = true` or an explicit collider box, call `inspect()` for each examinable and `exitDoor()` once, and add one `keyLight()`.
2. Register it in `src/engine/levels/rooms.ts`.
3. Add it to its site in `sites.ts`: `rooms`, `roomNames`, an edge in at least one configuration, its key clue and memory.
4. `npm run verify:sites` checks it: every examinable reachable on foot and hit by the centre-screen ray, the door reachable, the room reachable through some configuration, and everything disposed. Then walk it: `npm run dev`, and use the dev chapter jumps in the pause menu.

Keep emissive materials low (around 0.5): bloom picks up anything above its threshold, and a bright ceiling panel in a 2.7 m room whites out the view.

## Adding a site

Add a `Place`, a `SiteDef` in `sites.ts` and its rooms. Nothing in the engine changes. The story only knows two places, though: the coin picks between `house` and `lab`, and the challenge sends Rowan to whichever he has not visited.

## Moth quantum engines

The coin toss is `tossCoin()` in `src/story/quantum.ts`, the stand-in for the Moth Atlas coin. The configurations are authored. `docs/quantum-house/` holds a real Labyrinth run against four of the house rooms, with notes on why its raw output cannot be the door graph as-is: a measured layout can isolate rooms, and requiring connectivity forces every door open. The suggested integration is a fixed way back plus Labyrinth-chosen shortcuts, frozen while the player is inside. `Investigation.exits` is the single place a configuration becomes doors.
