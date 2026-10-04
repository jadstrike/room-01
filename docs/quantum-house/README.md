# House-only Labyrinth test

Live Moth job `caaaf370-9976-4683-95b2-7b85f3bf28aa` completed on 2026-09-30.
One submission, listed price 5 credits. Mode `emu`, backend `aer`, 4 qubits, 4096 shots.
This is a connection-data experiment, not yet a change to playable 3D door behavior.
No existing game files or Room 01 files were modified for this experiment.

## Run and inspect

- With Vite running, open `/docs/quantum-house/` to select outcomes and preview the four existing rooms.
- `node scripts/verify-house-labyrinth.mjs` validates the saved real result without spending credits.
- `./scripts/test-house-labyrinth.ps1` submits a NEW paid run. It reads `MOTH_API_KEY` from the environment or ignored `.env.moth.local`. Never use a `VITE_` key or move this call into browser code.
- `./scripts/test-house-labyrinth.ps1 -JobId <id>` resumes polling/fetching without another submission.
- The preview draws classically from the saved quantum-simulator distribution; it does not make fresh quantum calls.

## Room mapping and actual response

Row-major logical grid: kitchen (0), living room (1), bedroom (2), basement (3).
Requested corridors: 0–1, 1–3, 3–2. Requested wall: 0–2. Kitchen radiating=true, other rooms false.
The grid describes topology, not architectural floor elevations.

Request parameters must be inside `params`. Submission returns a job id; use `/status` until completed, then `/result`.
Observed inline result is at `result.output`. Its `coupling_map` includes ALL four lattice edges, including the requested wall. It is not a list of sampled open corridors.
Use `results.measurements[*].bitstring` directly, with room 0 at string index 0. Equal adjacent bits open an edge; different bits close it.
The `target.edge_signs` record design intent, `results.zz_couplings` record preparation expectations, and `initial_states` contain Bloch coordinates plus the preserved radiating flags. These are different from a single sampled outcome.

## Findings

- All sixteen bitstrings were returned; probabilities sum to one. All four radiating flags survived.
- Most likely: `1101` (22.7051%). Kitchen–living room and living room–basement are open; bedroom is isolated.
- Its complement `0010` (21.4355%) has identical doors. Complementary bitstrings must not be treated as distinct door layouts.
- Fully connected outcomes `0000` and `1111` account for 8.0322% of measured probability. Both open every lattice edge.
- The requested three-corridor/one-wall loop cannot occur exactly in a single bitstring: equality along the three-edge path forces the endpoints of the fourth edge to agree too. More generally, a closed loop must have an even number of disagreeing edges. This is a constraint of the documented mapping, not an API failure.
- Any equal-bit connected component contains only one bit value. Requiring every room to be connected by these edges alone forces all bits equal, losing interesting wall variation. Blindly rerolling until fully connected is therefore a poor game design.
- This simulator run does not demonstrate hardware decoherence. Differences from the target may reflect preparation, the incompatible target loop, and sampling; do not label these as QPU noise.

## Next gameplay integration

Keep an authored hall/return route outside the quantum-controlled graph and let measured edges govern optional shortcuts or evidence routes. Clearly distinguish that game rule from raw Moth output. Alternatively, permit temporary isolation with an explicit player-controlled remeasurement/return mechanic. Freeze each chosen outcome while the player traverses it; never close a doorway on the player.

Each current HouseSection has one sealed hall port. Physical inter-room traversal therefore needs a separate house coordinator and doorway handling before these samples can control the 3D environment. Keep that coordinator in the house branch; Room 01 must remain excluded. Persist the chosen bitstring and job id for repeatable debugging. Bloch vectors can later drive atmosphere; radiating is authored metadata rather than a sampled bit.

Sources: [Labyrinth engine](https://docs.mothquantum.com/docs/engines/labyrinth-v1), [submitting jobs](https://docs.mothquantum.com/docs/submitting-jobs), [job results](https://docs.mothquantum.com/docs/job-status-and-results).
