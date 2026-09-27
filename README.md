# Room 01

A first-person horror room on the web. You wake up in a boarded-up bedroom with a figure standing in the middle of it, under a bulb that will not stay lit.

Built with React 19, TypeScript, Vite and three.js 0.186. No game engine, no physics library.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and click to play.

| | |
|---|---|
| `W` `A` `S` `D` | move |
| `Shift` / `Ctrl` | sprint / crouch |
| `Space` | jump |
| `E` or click | interact with whatever the crosshair is on |
| `Esc` | pause, settings and crosshair customisation |
| `` ` `` | show collision boxes |

Drop a `.glb` anywhere on the page to replace the figure with your own character. A `.gltf` needs its `.bin` and textures selected together.

## Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + production build to dist/
npm run preview     # serve the production build
npm run typecheck   # tsc --noEmit
npm run verify      # check the room models against the spec, offline
npm run build:chair # rebuild the chair character model
```

## How it is put together

The 3D scene is plain three.js in `src/engine/`, which imports no React. React owns only the interface — HUD, pause menu, crosshair — in `src/ui/`. A small external store carries discrete state (what the crosshair is pointing at, settings, stats) into React, while per-frame values are read imperatively inside an animation frame so the render loop never causes a re-render.

The room itself is a glTF file whose objects are found by name. `docs/ROOM01_SPEC.md` records every measurement of it — positions, lights, materials, collider boxes, the door animation — and `src/engine/room01.ts` holds the numbers the game needs. `npm run verify` checks the models still match.

Movement uses ground acceleration and friction rather than a smoothed camera, so it feels like a shooter. The player is kept inside the room by both the spec's wall colliders and a hard boundary, and the crosshair is customisable the way Counter-Strike's is: length, thickness, gap, outline, dot, colour, and a spread that opens up as you move.

## Credits

Room and placeholder character are original procedural assets, free to use.
