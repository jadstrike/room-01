# Room 01

A first-person horror game on the web. You are Rowan Langdon. You wake up in a boarded-up bedroom with two people tied to chairs in the middle of it, under a bulb that will not stay lit, and something tall moving around them in the dark. It says one of them murdered your sister, and it is offering you revenge.

Talk to it, and a coin decides where you look for evidence: the boyfriend's house or the research lab. Bring the evidence back, question the accused, and give the entity its answer. There are four endings.

Built with React 19, TypeScript, Vite and three.js 0.186. No game engine, no physics library.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The title screen has Continue (once there is a story to continue), New game, Options, Controls and Credits; arrow keys and Enter work as well as the mouse.

| | |
|---|---|
| `W` `A` `S` `D` | move |
| `Shift` / `Ctrl` | sprint / crouch |
| `Space` | jump |
| Click | fire |
| `R` | reload |
| `F` | inspect the gun |
| `1` / `2` | draw the pistol / put it away (`Q` or scroll swaps) |
| `E` | examine, open, or talk to whatever the crosshair is on |
| `J` | journal: the evidence you have recorded |
| `P` | the device that rearranges a site's doors, once you have it |
| `1`–`9`, `0` | pick a dialogue choice |
| `Esc` | pause, settings and crosshair customisation |
| `` ` `` | show collision boxes |

Drop a picture anywhere on the page (or pick one in the pause menu) to put it on the figure's sign; it is kept on your device. Drop a `.glb` to replace the figure with your own character. A `.gltf` needs its `.bin` and textures selected together.

Progress is saved in the browser as you play, so **Quit to title** in the pause menu loses nothing. The endings you have reached are remembered on the title screen. In a dev build the pause menu also has chapter jumps (straight into the house, the lab, or the trial) for testing.

## The sites

The house (six rooms) and the lab (five) are built in code rather than modelled, and connected by a device that changes which doors lead where. See [docs/SITES.md](docs/SITES.md) for how they work and how to add a room or a whole site.

## Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + production build to dist/
npm run preview     # serve the production build
npm run typecheck   # tsc --noEmit
npm run verify      # check the room models against the spec, offline
npm run verify:sites # walk every site room: reachability, raycasts, cleanup
npm run verify:story # play every branch of the story to all four endings, offline
npm run build:chair # rebuild the chair character model
```

## How it is put together

The 3D scene is plain three.js in `src/engine/`, which imports no React. React owns only the interface — HUD, pause menu, crosshair — in `src/ui/`. A small external store carries discrete state (what the crosshair is pointing at, settings, stats) into React, while per-frame values are read imperatively inside an animation frame so the render loop never causes a re-render.

The room itself is a glTF file whose objects are found by name. `docs/ROOM01_SPEC.md` records every measurement of it — positions, lights, materials, collider boxes, the door animation — and `src/engine/room01.ts` holds the numbers the game needs. `npm run verify` checks the models still match.

Only one place is loaded at a time. Moving between them (through a door, or when the entity sends you somewhere) fades to a loading screen, stops rendering while the next place is built, compiles its shaders and draws its shadows before fading back in. Room 01 stays in memory because the story keeps coming back to it; site rooms are rebuilt each visit. The frame rate is capped (60 by default, in the pause menu), menus and conversations draw fewer frames, a hidden tab draws none, and the resolution drops on its own if a machine cannot keep up.

Movement uses ground acceleration and friction rather than a smoothed camera, so it feels like a shooter. The player is kept inside the room by both the spec's wall colliders and a hard boundary, and the crosshair is customisable the way Counter-Strike's is: length, thickness, gap, outline, dot, colour, and a spread that opens up as you move.

## Credits

A game by **Khant Zwe Naing (Isaac)** and **Kyaw Lwin (William)**, made for the Moth quantum games hackathon.

Room, chair character and placeholder mannequin are original procedural assets, free to use.

This work is based on "Beretta Pistol FPS ANIMATION" (https://sketchfab.com/3d-models/beretta-pistol-fps-animation-0313ab1888994c14abeaf444d7af3217) by BURNER (https://sketchfab.com/Alexander_Ovelar), licensed under CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/). Textures resized and recompressed, and its animation cut into separate clips.

The entity is based on "Scary Creature" (https://sketchfab.com/3d-models/scary-creature-b996bf84da3d49edb52202cb4fab457c) by shedmon (https://sketchfab.com/shedmon), licensed under CC BY 4.0. Textures resized and recompressed.

Gun sounds from Freesound: "Gun (Pistol) Shot" by synth2 and "pistol reload sound" by GFL7 (both CC0); "DryFire_01" by fastson (https://freesound.org/s/399116/, CC BY 3.0); "Bullet Shell Falling on Concrete Surface 024" by Debsound (https://freesound.org/s/730748/, CC BY-NC 4.0). The dry fire and shell sounds were trimmed, mixed to mono and resampled. The shell sound's licence is non-commercial: replace it before any commercial release.
