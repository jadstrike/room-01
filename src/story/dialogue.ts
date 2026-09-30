/**
 * A small branching-dialogue runner. A script is a map of nodes: each shows
 * one line, then either offers choices or continues to the next node. Nodes
 * and choices can read and change the story state, so the same script can
 * remember what the player has already asked and where the story has got to.
 */

export type ChoiceDef<S> = {
  label: string;
  next: string;
  /** Hidden unless this returns true. */
  when?: (s: S) => boolean;
  /** Marks a question as already asked, so the UI can dim it. */
  seen?: (s: S) => boolean;
  /** Runs when picked, before moving on. */
  pick?: (s: S) => void;
};

export type NodeDef<S> = {
  speaker: string;
  text: string | ((s: S) => string);
  /** Runs when the node is shown. */
  enter?: (s: S) => void;
  choices?: ChoiceDef<S>[];
  /** With no choices: where Continue goes. With neither, the conversation ends. */
  next?: string | ((s: S) => string);
};

export type Script<S> = Record<string, NodeDef<S>>;

export type DialogueView = {
  speaker: string;
  text: string;
  choices: { label: string; seen: boolean }[];
  /** No choices: Continue moves on, or ends the conversation when `last`. */
  last: boolean;
};

export class Conversation<S> {
  private node: NodeDef<S>;
  private choices: ChoiceDef<S>[] = [];

  constructor(
    private script: Script<S>,
    private state: S,
    start: string,
  ) {
    this.node = this.enter(start);
  }

  get view(): DialogueView {
    const n = this.node;
    return {
      speaker: n.speaker,
      text: typeof n.text === "function" ? n.text(this.state) : n.text,
      choices: this.choices.map((c) => ({ label: c.label, seen: c.seen?.(this.state) ?? false })),
      last: !this.choices.length && !n.next,
    };
  }

  /** Pick a choice by index. Returns false if there is no such choice. */
  choose(index: number): boolean {
    const choice = this.choices[index];
    if (!choice) return false;
    choice.pick?.(this.state);
    this.node = this.enter(choice.next);
    return true;
  }

  /** Continue from a line with no choices. Returns false when the conversation is over. */
  advance(): boolean {
    if (this.choices.length) return true;
    const next = this.node.next;
    if (!next) return false;
    this.node = this.enter(typeof next === "function" ? next(this.state) : next);
    return true;
  }

  private enter(id: string): NodeDef<S> {
    const node = this.script[id];
    if (!node) throw new Error(`Dialogue node "${id}" does not exist`);
    node.enter?.(this.state);
    this.choices = (node.choices ?? []).filter((c) => c.when?.(this.state) ?? true);
    return node;
  }
}
