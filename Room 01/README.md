# Room 01

A survival-horror bedroom for three.js / WebGL, with a character standing in the centre.
Drag your own `.glb` onto the page to put your character in the room.

- `index.html` loads three.js 0.186 from a CDN; no build step
- `models/horror_room.web.glb` is the room (glTF 2.0, WebP textures + meshopt, 1.2 MB)
- `models/placeholder_character.glb` is the stand-in mannequin

Run locally with `npx serve .` or `python -m http.server`.
