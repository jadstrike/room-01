# House MVP

Open `?house=1` for a new investigation or saved resume. A new investigation starts in the living room. When Room 01's existing coin result sends Rowan to the house, finishing the entity conversation enters this mode. The lab outcome remains separate.

## Player loop

1. Examine the stopped clock and pick up the brass device by the living-room door.
2. Use E on evidence, choose Recall, then record the observation and optional recollection in the journal. Objects remain where they are. Re-examination updates an entry rather than duplicating it.
3. Open the hall door to see open and sealed connections. Selecting an open destination folds the passage into that room and places Rowan at its entry. Every transition checks both configuration and proximity to the door.
4. P opens the acquired portable device. Discover an arrangement or restore a remembered arrangement. J opens the journal. Esc pauses.
5. Visit all six rooms and record six key clues: stopped clock, forgotten cup, cleaning cupboard, broken frame, hunting rifle and repair receipts. Recall at least one memory, restore at least one configuration, then return to the living room to finish the first investigation.

The pause screen also provides nearby passage/device actions, guarded by the same proximity checks. It contains no room-selector shortcut.

## Authored configurations

- Hearth: Living room ↔ Kitchen ↔ Utility room.
- Echo: Living room ↔ Bedroom ↔ Basement.
- Paper: Basement ↔ Study ↔ Utility room.

Example full route: gather the clock and device; Hearth to kitchen and utility; return to living room; discover Echo; bedroom then basement; discover Paper; study then utility; restore Hearth; kitchen then living room. Collect each room's key clue along the way. The device can always recover a disconnected current room once acquired.

## Architecture and saves

`HouseRun` owns graph rules, journal, visited rooms, configuration history and completion. `Engine` wraps the existing section inspections, adds a resource-owned device, validates passage travel and swaps one room at a time. `HousePlaythrough` reads discrete state for journal, device, inspection, passage and pause screens. Authored room geometry is reused.

Progress is saved under the versioned `moth.house.playthrough.v1` local-storage key after each state change. Invalid saves reset to the living room; storage failures show a message and permit play in memory. Start over is in the pause screen and replaces only this house save.

The MVP uses authored graphs. It makes no Labyrinth calls and consumes no engine credits. `CONFIGURATIONS` is the future provider boundary; the previous four-room Labyrinth experiment remains a separate saved fixture. House connections do not include Room 01.

## Verification

`npm run verify:playthrough` performs a complete headless playthrough using real authored geometry and raycast inspections, checks evidence recording and recall, blocked travel, disconnected-room recovery, saved resume, restart and disposal on every room swap. `npm run verify:house` verifies each room's walkable inspection targets and port access. `npm run build` checks types and the production bundle.
