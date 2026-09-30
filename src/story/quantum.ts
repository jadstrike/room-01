export type Coin = "heads" | "tails";

/**
 * The entity's coin. A stand-in for the Moth Atlas quantum engine, which is
 * planned for a later phase: swap the body for a call to it and keep the
 * signature, and the story does not need to change.
 */
export function tossCoin(): Coin {
  const bit = new Uint8Array(1);
  crypto.getRandomValues(bit);
  return bit[0] & 1 ? "heads" : "tails";
}
