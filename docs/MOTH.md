# How Room 01 uses Moth's quantum engines

## The short version

The coin that decides where Rowan investigates, the boyfriend's house or the research lab, is measured by Moth's **Coin Toss** engine. One qubit in superposition, measured eleven times; the majority decides. Every playthrough makes its own measurement, the entity reads the counts out, and the end credits show the Moth job ID that decided that run.

## Where it happens in the game

1. Rowan wakes in Room 01. The moment the entity starts talking, the game starts a Coin Toss job.
2. Rowan asks where the evidence is and picks a place. The entity overrides him: *"Irrelevant choice, actually, because I'm going to flip a coin."*
3. The flip uses Moth's measurement: *"Tails. Six out of eleven. One qubit, both sides at once, until I looked. The lab."* If the answer is still in flight, the entity holds on that line for up to six seconds.
4. The whole investigation, which site, which rooms and which evidence, follows from that one measurement. The credits name the job.

## Why a quantum coin

The entity is a four-dimensional being that sees every side of a thing at once, and it hands exactly one decision to chance: the one that starts everything. A qubit is the honest version of chance, both answers until it is measured. That is also what the story's twist turns out to be about: Rowan's memory of his sister is a state that never collapses into a face.

## How it is wired

```
browser ──POST /api/coin──▶ our server function ──Bearer key──▶ Moth Quantum API
        ◀── job id ────────                      (coin-toss-v1, emu, 11 shots)
        ──GET /api/coin?job=…─▶ status, then result ──▶ heads/tails counts back
```

- `api/_moth.js` holds the API key server-side. It runs as a Vercel function (`api/coin.js`) in production and inside the Vite dev server locally. Moth's API sends no CORS headers, so the browser could not call it directly anyway.
- The endpoint exposes only fixed parameters (an eleven-shot toss and a job read). Eleven, because an odd count cannot tie. It refuses requests without the browser's same-origin header, so it cannot be used to spend credits on other work.
- `src/story/quantum.ts` starts the measurement, polls for it, and hands the story either Moth's result or, if Moth is slow or unreachable, a local eleven-shot coin from `crypto.getRandomValues`. The entity says plainly when it flipped the coin itself. The story never waits on the network.
- Each toss is one job on Moth's quantum simulator (`emu` mode, Aer backend), about five seconds end to end, at 2 credits.

## Researched: the Labyrinth engine

The house and the lab have a device that rearranges which rooms their doors lead to. We ran Moth's **Quantum Labyrinth** engine on four rooms of the house to see whether measured qubit correlations could be that door graph. The request, the real result and the analysis are in [`docs/quantum-house/`](quantum-house/README.md). The main findings:

- A measured layout can leave a room cut off, and requiring every room to be connected forces every door open. So raw samples cannot be the door graph as-is.
- The workable design is a guaranteed way back, with Labyrinth deciding the shortcuts, frozen while the player is inside.

In the current build the arrangements are authored. `Investigation.exits` in `src/story/investigation.ts` is the single place a measured layout would plug in.

## Planned

- **Quantum Blur** for the sister's face, which Rowan can never quite remember, and **Quantum Teleblur** to morph it into a stranger's at the reveal. Both would be generated at build time and shipped as images, so play never waits on them.
- **Retrocausal Echo** on the entity's voice once the twist lands.

## Running it yourself

Put `MOTH_API_KEY=...` in a `.env` file in the project root (git-ignored), then `npm run dev`. The dev server serves `/api/coin` with the same code Vercel runs. Without a key, the game plays with the local coin.
