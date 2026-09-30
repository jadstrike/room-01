import type { Script } from "./dialogue";
import { tossCoin, type Coin } from "./quantum";

/**
 * Room 01, first act, from the story flowchart: the entity claims Rowan's
 * sister was murdered by one of the two accused and offers him revenge; he
 * questions it about both of them; he picks where to investigate, and the
 * entity overrides him with a coin toss (heads, the boyfriend's house;
 * tails, the research lab). The verdict and the twist come later.
 *
 * The entity is a bored 4D being: sassy, deranged, borderline psychopathic.
 * Lines about the sister are deliberately vague about her - her face is the
 * thing Rowan cannot quite remember - because the final reveal is that he
 * never had one.
 */

export type Place = "house" | "lab";

export type StoryState = {
  met: boolean;
  asked: { who: boolean; where: boolean; boyfriend: boolean; coworker: boolean; sister: boolean; research: boolean };
  /** Where Rowan wanted to go, and what the coin said. */
  picked: Place | null;
  coin: Coin | null;
  destination: Place | null;
};

export function newStoryState(): StoryState {
  return {
    met: false,
    asked: { who: false, where: false, boyfriend: false, coworker: false, sister: false, research: false },
    picked: null,
    coin: null,
    destination: null,
  };
}

/** Where a conversation with the entity starts, given how far the story has got. */
export function entityStart(s: StoryState): string {
  if (s.destination) return "waiting";
  return s.met ? "again" : "intro";
}

const PLACE_NAME: Record<Place, string> = { house: "the boyfriend's house", lab: "the research lab" };

export const ENTITY_SCRIPT: Script<StoryState> = {
  intro: {
    speaker: "The entity",
    text: "Rowan Langdon. Awake at last. I was getting bored, and you really don't want to know what I do when I'm bored.",
    enter: (s) => {
      s.met = true;
    },
    choices: [
      { label: "Who are you?", next: "who", pick: (s) => void (s.asked.who = true) },
      { label: "Where am I?", next: "where", pick: (s) => void (s.asked.where = true) },
      { label: "Who are these two?", next: "claim" },
    ],
  },

  again: {
    speaker: "The entity",
    text: "Back already? They're still tied up. I checked. Twice. From the inside.",
    next: (s) => (s.asked.boyfriend || s.asked.coworker ? "offer" : "claim"),
  },

  who: {
    speaker: "The entity",
    text: "Imagine standing outside a box and seeing every side of it at once, inside included. That's me, and you're the box. Four dimensions, darling. You're a drawing I can fold.",
    choices: [
      { label: "Where am I?", next: "where", when: (s) => !s.asked.where, pick: (s) => void (s.asked.where = true) },
      { label: "Why am I here?", next: "claim" },
    ],
  },

  where: {
    speaker: "The entity",
    text: "A room. Your room, if we're being sentimental. Nobody leaves it unless I fold them out of it.",
    choices: [
      { label: "Who are you?", next: "who", when: (s) => !s.asked.who, pick: (s) => void (s.asked.who = true) },
      { label: "Why am I here?", next: "claim" },
    ],
  },

  claim: {
    speaker: "The entity",
    text: "Because your sister is dead. Murdered. And one of these two did it. On the left, her boyfriend. On the right, her coworker. Say hello. They can't.",
    next: "offer_revenge",
  },

  offer_revenge: {
    speaker: "The entity",
    text: "So here's my gift. A chance at revenge. Work out which one, and I'll let you do the thing grieving people only dream about. Ask me anything. I love questions. I know all the answers.",
    next: "offer",
  },

  offer: {
    speaker: "The entity",
    text: "Well? Ask.",
    choices: [
      { label: "Tell me about the boyfriend.", next: "boyfriend", seen: (s) => s.asked.boyfriend, pick: (s) => void (s.asked.boyfriend = true) },
      { label: "Tell me about the coworker.", next: "coworker", seen: (s) => s.asked.coworker, pick: (s) => void (s.asked.coworker = true) },
      { label: "What was she working on?", next: "research", seen: (s) => s.asked.research, pick: (s) => void (s.asked.research = true) },
      { label: "What happened to her?", next: "sister", seen: (s) => s.asked.sister, pick: (s) => void (s.asked.sister = true) },
      { label: "How do I find out which one?", next: "choose" },
    ],
  },

  boyfriend: {
    speaker: "The entity",
    text: "Three years together. He loved her loudly and he hurt her quietly. The neighbours heard things through the wall. Nobody knocked. Nobody ever knocks.",
    next: "offer",
  },

  coworker: {
    speaker: "The entity",
    text: "Same lab, same bench, same breakthrough. Her idea, his hands on the equipment. When the paper went out, his name was second. Second, Rowan. Some men never recover from being second.",
    next: "offer",
  },

  research: {
    speaker: "The entity",
    text: "Qubits. Millions of them, stable, stacked, cheap enough to build in a factory. She worked out how. Do you know what that's worth? Everything. People have been killed for a great deal less than everything.",
    next: "offer",
  },

  sister: {
    speaker: "The entity",
    text: "Mm. Your memory's a little fuzzy about her, isn't it? Her voice. Her face. Grief does that. Mostly.",
    next: "offer",
  },

  choose: {
    speaker: "The entity",
    text: "Evidence. There are two places it could be. His house, or their lab. Pick one.",
    choices: [
      { label: "The boyfriend's house.", next: "override", pick: (s) => void (s.picked = "house") },
      { label: "The research lab.", next: "override", pick: (s) => void (s.picked = "lab") },
    ],
  },

  override: {
    speaker: "The entity",
    text: "Good choice. Terrible choice. Irrelevant choice, actually, because I'm going to flip a coin.",
    enter: (s) => {
      s.coin = tossCoin();
    },
    next: "toss",
  },

  toss: {
    speaker: "The entity",
    text: (s) => {
      const place: Place = s.coin === "heads" ? "house" : "lab";
      const call = s.coin === "heads" ? "Heads." : "Tails.";
      const where = place === "house" ? "The boyfriend's house. Try not to touch anything you don't want to remember." : "The lab. Mind the equipment. Some of it still hums.";
      const agree = s.picked === place ? "Look at that, the universe agrees with you. It never does that." : "Not what you wanted? Nothing ever is.";
      return `${call} ${where} ${agree}`;
    },
    enter: (s) => {
      s.destination = s.coin === "heads" ? "house" : "lab";
    },
    choices: [{ label: "...Fine.", next: "send_off" }],
  },

  send_off: {
    speaker: "The entity",
    text: (s) => `Off you go, then. ${s.destination ? PLACE_NAME[s.destination][0].toUpperCase() + PLACE_NAME[s.destination].slice(1) : "Somewhere"} is waiting. Come back with something worth killing for.`,
  },

  waiting: {
    speaker: "The entity",
    text: (s) => `Still here? ${s.destination ? PLACE_NAME[s.destination][0].toUpperCase() + PLACE_NAME[s.destination].slice(1) : "Somewhere"} won't search itself. Well. It might. I haven't decided.`,
  },
};
