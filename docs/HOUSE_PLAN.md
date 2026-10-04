# House sections: kitchen and living room

## Build sequence

1. Build and review the kitchen and living room as standalone playable sections (implemented).
2. Add the hallway using the same section contract; review doorway clearance and visual consistency.
3. Place authored evidence and implement the shared journal and interaction state.
4. Integrate the quantum maze output as connectivity between approved sections. Validate reachability before entering the house.

## Current implementation

Open `?section=kitchen`, or select House / Kitchen in the pause menu. The original Room 01 remains the default. The kitchen includes cabinets, a recessed sink, cooker, refrigerator, table, chair, window, domestic props and four inspection targets. Inspection text is environmental flavour, not collected story evidence.

`src/engine/house/HouseSection.ts` describes a section's scene root, local bounds, collision boxes, spawn, look target, connection ports, interactions and disposal. `Kitchen.ts` authors the first section in metres, with a 6 x 5 m footprint and 3 m ceiling. It uses shared box geometry/materials and deterministic 256 px textures, with one shadow-casting light. There is no per-frame kitchen geometry or texture generation.

The hall connection is centred at local (0, 0, 2.5), faces +Z, and has a 1.2 x 2.2 m opening. A closed door seals it during standalone preview. A later assembler must transform local colliders, spawn and ports with each section placement, and replace/remove the door collider when joining sections. No maze topology, service API or random routing is assumed here.

## Living room

Open `?section=living-room`, or select House / Living room from the pause menu. The 6.8 x 6 m room has a 3 m ceiling, sofa, patterned rug, coffee table, fireplace and mantel clock, bookcase, television, curtained window and table lamp. Seven inspection targets provide environmental observations only; nothing is added to an evidence journal and no recording or memory is invented.

Its hall port is at local (0, 0, 3), facing +Z, with the same 1.2 x 2.2 m opening as the kitchen. The grouped `Hall_Door` seals the standalone preview. Furniture leaves a continuous path from the entrance to each inspection point. There is one shadow-casting lamp plus two inexpensive fill lights.

Both rooms inherit geometry/material/texture ownership from `ProceduralSection`. The Engine loads either through `HouseSection`, including spawn, collision boxes, lighting origin, interaction roots and cleanup. UI locations are listed in `locations.ts`. Room 01's dialogue remains separate.

## Moth engine integration boundary

This is the authored house base for the Moth hackathon; it does not yet invoke the engines. The intended integrations from the story remain Coin Toss for first-route selection, Quantum Labyrinth for validated connectivity, and Quantum Blur for authored memory imagery. Their actual APIs and constraints must be verified when integration starts.

Keep the future graph adapter outside room constructors. It should map graph nodes to approved room templates, transform their local geometry/colliders/ports together, open only connected door barriers, and validate spawn-to-evidence-to-exit reachability. Save engine outputs and case state above individual room instances. Existing coin/dialogue code is unchanged by this room increment; the section preview links are development navigation, not narrative routing or a claimed quantum run.

## Verification

Run `npm run build`, `npm run verify`, and `npm run verify:house`. The house check samples connected walkable space using the player radius, raycasts every inspection target from reachable positions, checks port approach clearance and verifies resource disposal for both rooms. It uses a stub drawing context for geometry checks; it does not verify textures visually. In the kitchen, walk around the table and cabinets, inspect the cup/cooker/fridge/door, toggle collision view, pause/resume, and follow the Room 01 link to check the original scene. Review the kitchen before authoring the next section.

For visual checks without the pointer-lock pause overlay, open `/scripts/house-preview.html?section=living-room` on the Vite development server. This harness runs the actual Engine, is not a production entry point, and changes no story state.

## Bedroom

Open `?section=bedroom` from the pause-menu location list. This 6 x 6 m section uses the same 3 m ceiling and 1.2 x 2.2 m hall port at (0, 0, 3). A disordered bed, fallen pillow, overturned chair and floor scrapes, pulled-out drawer, scattered clothes, broken frame and damaged latch suggest a struggle. Six inspection points describe the scene without establishing a murderer or a cause of death. The room uses the shared procedural resources and has no per-frame construction. The house verification includes bedroom spawn, inspection access, port approach and cleanup.

## Basement

Basement follows ProceduralSection with the standard hall port for later maze connections. A hunting rifle, torn note, stained coat, tools, boots and storage supplies create suspicion of the boyfriend while inspection details preserve innocent explanations. The rifle is an inspectable room prop. Shared resources are owned and disposed by the section; no per-frame room logic is added.

## Utility room

A compact laundry and maintenance room using ProceduralSection, with washer, dryer, deep sink, storage, laundry basket and fuse panel. Uses the standard hall port, shared resource cleanup and inspectable groups. The saved four-qubit Labyrinth experiment remains a four-room fixture; expanding that experiment requires a new grid design and run.

## Study

A domestic study connects the basement repair clues to receipts and household correspondence. An unsigned letter and empty photograph frame preserve the uncertainty in Rowan's memories. Seven inspection points, shared ProceduralSection resource ownership and a standard hall port. The existing four-room quantum test remains a saved experiment, separate from room authoring.
