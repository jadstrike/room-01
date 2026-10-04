# How Room 01 uses Moth's quantum engines

Five of Moth's engines are in the game, and each one decides or makes something the story turns on.

| Engine | What it does in the game | When it runs |
|---|---|---|
| **Coin Toss** | Decides whether Rowan investigates the boyfriend's house or the research lab | Live, every playthrough |
| **Quantum Labyrinth** | Measures how the house's or the lab's rooms connect, giving the device its arrangements | Live, on arriving at a site |
| **Quantum Blur** | The sister's photograph, never in focus, less clear with each memory | Baked once, shipped as images |
| **Quantum Teleblur** | At the reveal, her face dissolves into a stranger's | Baked once, shipped as images |
| **Retrocausal Echo** | The entity's voice echoes back out of order | Baked once, shipped as audio |

## 1. Coin Toss: where you go

The entity refuses to let Rowan choose and flips a coin. One qubit in superposition, measured eleven times (an odd count cannot tie); the majority decides. The entity reads the count out: *"Tails. Six out of eleven. One qubit, both sides at once, until I looked."* The measurement starts when Rowan wakes, and the entity holds its line for up to six seconds if the answer is still in flight. The end credits name the job.

## 2. Quantum Labyrinth: how the place is joined

Each room of a site is a qubit on a lattice whose edges are the doors that could exist: the house a 2×3 grid, the lab a chain of five, with the start room radiating. One shot opens a door wherever two neighbouring rooms' qubits measured the same, so one measurement is one whole layout. (A bitstring and its complement open the same doors and count as one.)

`src/story/labyrinth.ts` turns a result into the device's arrangements:

- the three layouts measured most often, skipping the two that say nothing (every door open, every door shut);
- if together they cannot reach every room, the all-doors-open layout takes the last place, so no measurement can strand Rowan. This is the problem kl25abc's first experiment found ([`docs/quantum-house/`](quantum-house/README.md)).

The job starts the moment the coin decides, so it runs while the entity is still talking. The arrival loading screen says *"Moth's Quantum Labyrinth is measuring the house"* and waits at most fourteen seconds; if Moth does not answer, the hand-made arrangements stand in. The layouts are saved with the story, and the device screen shows each arrangement's share of the shots and the job ID.

Real results are kept as test fixtures (`scripts/moth/fixture-*-labyrinth.json`): the house measured three arrangements seen in 11%, 9% and 8% of the shots, and the lab in 25%, 16% and 5%. Both reach every room.

## 3. Quantum Blur: her face

Rowan cannot remember his sister's face. Her photograph (painted for the game, not of a real person: `scripts/moth/portraits.html`) went through Blur at three strengths. Calibration showed that a wide reach or a y rotation pushes the image into darkness, while a narrow x rotation smears and warps the face without losing it, which is what a memory of a face does. The prologue shows the furthest stage beside *"He cannot remember her face."* Each key memory he recalls shows her photograph, slipping a stage for every three memories recorded.

## 4. Quantum Teleblur: whose face

At the reveal the entity says *"I built her out of bits of other people… Her face I never finished."* While it does, her photograph is morphed into a stranger's by Teleblur in four steps: a ghost of her face in a quantum mosaic, interference, abstraction, and finally someone else entirely.

## 5. Retrocausal Echo: its voice

Without an input, the engine renders a multi-tap echo measured on a qubit chain, in which negative returns play reversed. That rendering is the convolution reverb on the entity's voice.

## How it is wired

```
browser ──POST /api/coin, /api/labyrinth──▶ our server function ──Bearer key──▶ Moth Quantum API
        ◀── job id ─────────────────────────
        ──GET …?job=<id>──────────────────▶ status, then result ──▶ counts / measurements back
```

- `api/_moth.js` holds the key server-side. It runs as Vercel functions in production and as Vite dev-server middleware locally. Moth's API sends no CORS headers, so the browser could not call it directly anyway.
- Only fixed parameters are exposed: an eleven-shot coin toss, a Labyrinth run over one of the two sites' fixed lattices, and reading back a job. Requests without the browser's same-origin header are refused. Nothing can be used to spend credits on other work.
- If Moth is slow or unreachable, a local coin and the hand-made arrangements stand in, and the game says so. It never waits more than a few seconds on the network.
- Blur, Teleblur and Echo are baked by `scripts/moth/bake-sister.mjs` and `scripts/moth/bake-echo.mjs` into `public/images/sister/` and `public/audio/`, with each job ID recorded beside them; the credits read those files.

## Credits used

A playthrough costs one coin toss (2 credits) and one Labyrinth run per site visited (5 each). The baked assets cost about 12 credits once.

## Running it yourself

Put `MOTH_API_KEY=...` in a `.env` file in the project root (git-ignored), then `npm run dev`. Without a key, the game plays with a local coin and the hand-made arrangements.
