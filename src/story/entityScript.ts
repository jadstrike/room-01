import type { Script } from "./dialogue";
import { tossCoin } from "./quantum";
import type { AccusedId, Place } from "./sites";
import { hasEvidence, type StoryState } from "./state";

/**
 * Room 01, first act, from the story flowchart: the entity claims Rowan's
 * sister was murdered by one of the two accused and offers him revenge; he
 * questions it about both of them; he picks where to investigate, and the
 * entity overrides him with a coin toss (heads, the boyfriend's house;
 * tails, the research lab).
 *
 * Back with evidence, the trial: the entity demands a verdict. Rowan can
 * name one of the accused (and must then shoot him), refuse and be killed
 * in their place, or challenge the evidence, which buys a round at the
 * other site. With both sites in the journal the evidence contradicts
 * itself; confronted with that, the entity admits it built the whole case,
 * and the sister, and Rowan chooses again knowing it. Putting the gun down
 * and holding his nerve lets all three of them go.
 *
 * The entity is a bored 4D being: sassy, deranged, borderline psychopathic.
 * Lines about the sister are deliberately vague about her - her face is the
 * thing Rowan cannot quite remember - because the final reveal is that he
 * never had one.
 */

/** Where a conversation with the entity starts, given how far the story has got. */
export function entityStart(s: StoryState): string {
  if (s.act === "trial") return "trial";
  if (s.act === "execution") return "execution";
  if (s.act === "revealed") return "revealed";
  if (s.act === "released" || s.act === "ended") return "gone";
  if (s.destination) return "waiting";
  return s.met ? "again" : "intro";
}

/**
 * The two key clues that cannot both be true: the house says she died there
 * at 23:40 on the 14th, the lab says she badged into Lab 2 at the same minute.
 */
export const CONTRADICTION = ["living-room:Mantel_Clock", "reception:Badge_Log"] as const;

export function contradiction(s: StoryState): boolean {
  return CONTRADICTION.every((id) => hasEvidence(s, id));
}

const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven"];

/** What the coin really was: Moth's measurement, or the entity admitting it flipped it itself. */
function measured(s: StoryState): string {
  const p = s.coinProof;
  if (!p || p.source !== "moth") return "I flipped this one myself. Your universe was slow to answer.";
  const won = s.coin === "heads" ? p.heads : p.tails;
  return `${WORDS[won] ?? won} out of ${WORDS[p.shots]?.toLowerCase() ?? p.shots}. One qubit, both sides at once, until I looked.`;
}

function otherPlace(s: StoryState): Place {
  return s.rounds[0] === "house" ? "lab" : "house";
}

/** Name the accused; the gun will fire on him. Where the verdict came from is where reconsidering returns. */
function condemn(s: StoryState, who: AccusedId): void {
  s.accused = who;
  s.verdictFrom = s.act === "revealed" ? "revealed" : "trial";
  s.act = "execution";
  s.request = { kind: "execute" };
}

function reconsider(s: StoryState): void {
  s.act = s.verdictFrom ?? "trial";
  s.accused = null;
  s.request = { kind: "stand-down" };
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
    next: "toss",
  },

  toss: {
    speaker: "The entity",
    text: (s) => {
      const place: Place = s.coin === "heads" ? "house" : "lab";
      const call = s.coin === "heads" ? "Heads." : "Tails.";
      const where = place === "house" ? "The boyfriend's house. Try not to touch anything you don't want to remember." : "The lab. Mind the equipment. Some of it still hums.";
      const agree = s.picked === place ? "Look at that, the universe agrees with you. It never does that." : "Not what you wanted? Nothing ever is.";
      return `${call} ${measured(s)} ${where} ${agree}`;
    },
    enter: (s) => {
      // Flipped here rather than a line earlier, so Moth's measurement has as long as possible to land.
      const { coin, ...proof } = tossCoin();
      s.coin = coin;
      s.coinProof = proof;
      const destination: Place = s.coin === "heads" ? "house" : "lab";
      s.destination = destination;
      // Even walking away mid-sentence does not get Rowan out of it.
      s.request = { kind: "travel", to: destination };
    },
    choices: [{ label: "...Fine.", next: "send_off" }],
  },

  send_off: {
    speaker: "The entity",
    text: (s) => `Off you go, then. ${s.destination ? PLACE_NAME[s.destination][0].toUpperCase() + PLACE_NAME[s.destination].slice(1) : "Somewhere"} is waiting. Come back with something worth killing for.`,
  },

  // --- the trial ------------------------------------------------------------------
  trial: {
    speaker: "The entity",
    text: (s) =>
      s.rounds.length > 1
        ? "Two whole places, and you're still standing there with that face. Well? Who did it?"
        : "Back already, with your pockets full of someone else's life. Well? Who did it?",
    choices: [
      { label: "I want to question them first.", next: "trial_question" },
      { label: "I've decided.", next: "verdict" },
    ],
  },

  trial_question: {
    speaker: "The entity",
    text: "Be my guest. I gave them their mouths back. They'll say what everyone says.",
  },

  verdict: {
    speaker: "The entity",
    text: (s) => (s.act === "revealed" ? "Pick one. Or I pick you." : "Then say it. Which one of them killed her?"),
    choices: [
      { label: "The boyfriend.", next: "confirm_boyfriend" },
      { label: "The coworker.", next: "confirm_coworker" },
      { label: "I won't kill anyone.", next: "refuse", when: (s) => s.act !== "revealed" },
      { label: "Then pick me.", next: "refuse", when: (s) => s.act === "revealed" },
      { label: "None of this proves anything.", next: "challenge", when: (s) => s.act === "trial" && s.rounds.length === 1 },
      { label: "Your story doesn't add up.", next: "contradiction", when: (s) => s.act === "trial" && contradiction(s) },
      { label: "I'm putting the gun down.", next: "hold", when: (s) => s.act === "revealed" },
      { label: "Not yet.", next: "not_yet" },
    ],
  },

  not_yet: {
    speaker: "The entity",
    text: "Take your time. I have all of it. You, on the other hand, have rather less.",
  },

  confirm_boyfriend: {
    speaker: "The entity",
    text: "Him. The loud one. You're sure? Once it's done it stays done. Mostly.",
    choices: [
      { label: "Yes. Him.", next: "sentence", pick: (s) => condemn(s, "boyfriend") },
      { label: "No. Wait.", next: "verdict" },
    ],
  },

  confirm_coworker: {
    speaker: "The entity",
    text: "Him. The clever one. You're sure? Once it's done it stays done. Mostly.",
    choices: [
      { label: "Yes. Him.", next: "sentence", pick: (s) => condemn(s, "coworker") },
      { label: "No. Wait.", next: "verdict" },
    ],
  },

  sentence: {
    speaker: "The entity",
    text: "Then do it. The gun's in your hand, Rowan; it's been in your hand the whole time. One round. I'll hold him still. He's already very still.",
  },

  execution: {
    speaker: "The entity",
    text: "Well? He isn't getting any less tied up.",
    choices: [
      { label: "I've changed my mind.", next: "reconsider", pick: reconsider },
      { label: "Give me a second.", next: "not_yet" },
    ],
  },

  reconsider: {
    speaker: "The entity",
    text: "Have you. How tiresome. Go on, then. Choose again.",
    next: "verdict",
  },

  refuse: {
    speaker: "The entity",
    text: "Oh, you will. Or I will. Somebody leaves this room in a box, darling, and I'm really not fussy who.",
    choices: [
      { label: "Then let it be me.", next: "rowan" },
      { label: "...Let me think.", next: "verdict" },
    ],
  },

  rowan: {
    speaker: "The entity",
    text: "...Brave. Stupid, but brave. Close your eyes, Rowan. This won't hurt. Well. Not for long.",
    enter: (s) => {
      s.request = { kind: "ending", ending: "rowan" };
    },
  },

  challenge: {
    speaker: "The entity",
    text: (s) => `A sceptic! How refreshing. Fine. One more round: ${PLACE_NAME[otherPlace(s)]}. And Rowan? Don't come back empty-handed twice.`,
    enter: (s) => {
      s.request = { kind: "travel", to: otherPlace(s) };
    },
  },

  // --- the twist ------------------------------------------------------------------
  contradiction: {
    speaker: "Rowan",
    text: "The clock in his house stopped at twenty to twelve on the fourteenth. Her badge went through the lab door at twenty to twelve on the fourteenth. I remember both. She can't have died twice.",
    next: "twist_noticed",
  },

  twist_noticed: {
    speaker: "The entity",
    text: "...Oh. You noticed. I did wonder if you would.",
    next: "twist_tampered",
  },

  twist_tampered: {
    speaker: "The entity",
    text: "Yes, I moved a few things. A clock. A badge. A memory or two. It's ever so easy. You're all so soft on the inside.",
    choices: [{ label: "What did you do to me?", next: "twist_sister" }],
  },

  twist_sister: {
    speaker: "The entity",
    text: "I gave you a sister. Do you like her? I built her out of bits of other people. Her laugh is a woman on a bus in 2009. Her face I never finished. That's why you can't see it.",
    choices: [{ label: "Then who killed her?", next: "twist_nobody" }],
  },

  twist_nobody: {
    speaker: "The entity",
    text: "Nobody. There was nobody to kill. Those two have never met you. I put a boyfriend's grief in one and a colleague's grudge in the other, and a sister in you, and pointed you all at each other. They believe it too. Ask them.",
    enter: (s) => {
      s.act = "revealed";
    },
    next: "twist_offer",
  },

  twist_offer: {
    speaker: "The entity",
    text: "So. Nobody's guilty, nobody's dead, and I'm still bored. The offer stands.",
    next: "verdict",
  },

  revealed: {
    speaker: "The entity",
    text: "Still deciding? Nobody did anything, remember. Surely that makes it easier.",
    next: "verdict",
  },

  // --- the gun goes down ----------------------------------------------------------
  hold: {
    speaker: "The entity",
    text: "Pick it up.",
    choices: [
      { label: "No.", next: "hold_threat" },
      { label: "...All right.", next: "verdict" },
    ],
  },

  hold_threat: {
    speaker: "The entity",
    text: "I could fold you inside out, Rowan. You'd stay alive for it. You'd feel every crease.",
    choices: [
      { label: "Then do it.", next: "released" },
      { label: "...All right.", next: "verdict" },
    ],
  },

  released: {
    speaker: "The entity",
    text: "...You're no fun at all. Fine. Go. All of you. Take your borrowed grief with you; I've no use for it any more.",
    enter: (s) => {
      s.act = "released";
      s.request = { kind: "release" };
    },
  },

  gone: {
    speaker: "The entity",
    text: "Go on. Before I get interested again.",
  },

  waiting: {
    speaker: "The entity",
    text: (s) => `Still here? ${s.destination ? PLACE_NAME[s.destination][0].toUpperCase() + PLACE_NAME[s.destination].slice(1) : "Somewhere"} won't search itself. Well. It might. I haven't decided.`,
  },
};
