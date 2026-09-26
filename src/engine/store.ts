/**
 * Minimal external store so React can read discrete engine state without the
 * engine importing React. Per-frame values (speed, bulb level) deliberately do
 * NOT live here - they go through Engine.live and are read in an rAF by the
 * components that need them, so the render loop never triggers a re-render.
 */
export class Store<T extends object> {
  private listeners = new Set<() => void>();
  private state: T;

  constructor(initial: T) {
    this.state = initial;
  }

  get = (): T => this.state;

  set = (patch: Partial<T>): void => {
    let changed = false;
    for (const k in patch) {
      if (!Object.is(this.state[k], patch[k]!)) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
}
