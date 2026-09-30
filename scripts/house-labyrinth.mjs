// Qubit 0 is already LEFTMOST in Moth's response. Never reverse these strings.
export const HOUSE_ROOMS = [
  { id: 'kitchen', label: 'Kitchen' }, { id: 'living-room', label: 'Living room' },
  { id: 'bedroom', label: 'Bedroom' }, { id: 'basement', label: 'Basement' },
];
export const HOUSE_EDGES = [[0, 1], [0, 2], [1, 3], [2, 3]];
export function decodeHouse(bits) {
  if (typeof bits !== 'string' || !/^[01]{4}$/.test(bits)) throw new Error('Expected four house bits.');
  const edges = HOUSE_EDGES.map(([a, b]) => ({ a, b, open: bits[a] === bits[b] }));
  const reachable = new Set([0]);
  for (let pass = 0; pass < 4; pass++) for (const { a, b, open } of edges) {
    if (open && (reachable.has(a) || reachable.has(b))) { reachable.add(a); reachable.add(b); }
  }
  return { bits, edges, reachable: [...reachable].sort(), connected: reachable.size === 4 };
}
export function readHouseResult(envelope) {
  const out = envelope?.result?.output;
  if (out?.num_qubits !== 4 || out.grid_size?.rows !== 2 || out.grid_size?.cols !== 2) throw new Error('Not the four-room house result.');
  if (out.metrics?.mode !== 'emu' || out.metrics?.num_shots !== 4096) throw new Error('Unexpected test mode or shot count.');
  const samples = out.results?.measurements;
  if (!Array.isArray(samples) || samples.length !== 16) throw new Error('Expected all sixteen outcomes for this test.');
  const seen = new Set();
  let total = 0;
  for (const sample of samples) {
    decodeHouse(sample.bitstring);
    if (seen.has(sample.bitstring) || !Number.isFinite(sample.probability) || sample.probability < 0 || sample.probability > 1) throw new Error('Invalid measurement.');
    seen.add(sample.bitstring); total += sample.probability;
  }
  if (Math.abs(total - 1) > 1e-8) throw new Error('Incomplete probability mass.');
  HOUSE_ROOMS.forEach((_, i) => {
    const state = out.initial_states?.[i];
    if (!state || state.radiating !== (i === 0) || !['X', 'Y', 'Z'].every(axis => Number.isFinite(state[axis]) && Math.abs(state[axis]) <= 1)) throw new Error('Invalid room metadata.');
  });
  // Returned coupling_map lists candidate lattice edges, not open passages.
  const edgeKey = ([a, b]) => [a, b].sort((x, y) => x - y).join(',');
  if (JSON.stringify(out.coupling_map?.map(edgeKey).sort()) !== JSON.stringify(HOUSE_EDGES.map(edgeKey).sort())) throw new Error('Unexpected house lattice.');
  return { samples, states: out.initial_states, metrics: out.metrics };
}
