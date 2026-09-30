# House sections: kitchen first

## Build sequence

1. Build and review the kitchen as a standalone playable section (current increment).
2. Add the hallway and one further room using the same section contract; review doorway clearance and visual consistency.
3. Place authored evidence and implement the shared journal and interaction state.
4. Integrate the quantum maze output as connectivity between approved sections. Validate reachability before entering the house.

## Current implementation

Open `?section=kitchen`, or select House / Kitchen in the pause menu. The original Room 01 remains the default. The kitchen includes cabinets, a recessed sink, cooker, refrigerator, table, chair, window, domestic props and four inspection targets. Inspection text is environmental flavour, not collected story evidence.

`src/engine/house/HouseSection.ts` describes a section's scene root, local bounds, collision boxes, spawn, look target, connection ports, interactions and disposal. `Kitchen.ts` authors the first section in metres, with a 6 x 5 m footprint and 3 m ceiling. It uses shared box geometry/materials and deterministic 256 px textures, with one shadow-casting light. There is no per-frame kitchen geometry or texture generation.

The hall connection is centred at local (0, 0, 2.5), faces +Z, and has a 1.2 x 2.2 m opening. A closed door seals it during standalone preview. A later assembler must transform local colliders, spawn and ports with each section placement, and replace/remove the door collider when joining sections. No maze topology, service API or random routing is assumed here.

## Verification

Run `npm run build` and `npm run verify`. In the kitchen, walk around the table and cabinets, inspect the cup/cooker/fridge/door, toggle collision view, pause/resume, and follow the Room 01 link to check the original scene. Review the kitchen before authoring the next section.
