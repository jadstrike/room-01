import type { ChoiceDef, Script } from "./dialogue";
import type { AccusedId, Place } from "./sites";
import { hasEvidence, type StoryState } from "./state";

/**
 * The two accused, once the entity has "given them their mouths back" (the
 * trial). Rowan can ask where they were and whether they did it, and put
 * each key clue from the journal to them. Each has an answer for the evidence
 * from their own place and a shrug for the other. After the reveal they are
 * as unsure of their memories as Rowan is of his.
 *
 * Every answer is consistent with innocence and none of them proves it:
 * the verdict is meant to stay the player's to make.
 */

type Accused = {
  speaker: string;
  /** Their own place, whose evidence they answer one by one. */
  place: Place;
  gagged: string;
  open: string;
  night: string;
  kill: string;
  /** Key clue id -> how Rowan puts it, and the answer. */
  evidence: Record<string, { ask: string; reply: string }>;
  /** Asked about the other place. */
  elsewhere: { ask: string; reply: string };
  after: string;
};

const ACCUSED: Record<AccusedId, Accused> = {
  boyfriend: {
    speaker: "The boyfriend",
    place: "house",
    gagged: "He strains against the tape over his mouth. Whatever he is trying to say, it is not words yet.",
    open: "Rowan? Rowan, thank God. Get me out of this. I don't know what that thing is. I don't know how I got here. Please.",
    night: "Home. I was home. We argued, all right? We argued and she left. She took her keys and she left and that was the last time I saw her.",
    kill: "No. I loved her. I wasn't always good to her, I know that. I know what the neighbours heard. But no.",
    evidence: {
      "living-room:Mantel_Clock": {
        ask: "The clock on your mantel stopped at twenty to twelve.",
        reply: "That clock's been dead for months. The battery. I kept meaning to... The fourteenth? I don't know when it stopped. I never looked at it.",
      },
      "kitchen:Forgotten_Mug": {
        ask: "There's a cup of tea going cold in your kitchen.",
        reply: "Mine. I make it and forget it. I always forget it. She used to laugh at me for that.",
      },
      "utility-room:Cleaning_Cupboard": {
        ask: "Someone wanted the cellar latch fixed.",
        reply: "The cellar door wouldn't shut. She asked me to fix it for weeks. I finally did. That's all that is.",
      },
      "bedroom:Broken_Frame": {
        ask: "The frame in the bedroom is smashed.",
        reply: "I threw it. At the wall, not at her. I'm not proud of it. She walked out after that, and she was fine when she walked out.",
      },
      "basement:Hunting_Rifle": {
        ask: "There's a rifle in your basement.",
        reply: "I hunt. Deer, twice a year, with my brother. It hasn't been fired since November. Check the tag. Check the barrel. Check anything.",
      },
      "study:Repair_Receipts": {
        ask: "Wood stain. A latch. Pipe fittings.",
        reply: "The stairs, the cellar, the leak under the sink. I keep receipts. Keeping receipts isn't a crime.",
      },
    },
    elsewhere: {
      ask: "What about her lab?",
      reply: "I've never been inside it. She never let me. Said I'd touch things I didn't understand. She was right.",
    },
    after:
      "I remember her. I do. Her coat on the hook by the door, the... What colour was her coat, Rowan? I can see the hook. I can't see the coat.",
  },
  coworker: {
    speaker: "The coworker",
    place: "lab",
    gagged: "He holds very still, watching the entity over the tape on his mouth, the way you would watch a wasp.",
    open: "Rowan. Listen carefully, because I don't think we have long. That thing is not a person. Whatever it has told you about me, it told you on purpose.",
    night: "In the lab until about ten. Then home. I was asleep by midnight. I live alone, so no, nobody can say so.",
    kill: "She was the best physicist I have ever worked with. Why would I kill the only person who could finish it?",
    evidence: {
      "reception:Badge_Log": {
        ask: "Your badge opened Lab 2 a minute after hers.",
        reply: "0412 is my badge, and I lost it on the ninth. I reported it. Nobody deactivated it. Anyone could have used it. Anyone did.",
      },
      "office:Draft_Paper": {
        ask: "Her name is struck off the draft. Yours is first.",
        reply: "I wrote that email on the board: her name first. I meant it. I never touched that draft. And everyone in the group has those green pens; they come in boxes of fifty.",
      },
      "cryostat:Incident_Log": {
        ask: "Someone opened valve V7 at 23:52.",
        reply: "V7 opens on its own when the line warms. I reported it. Twice. Read the tag. I'd have put money on it quenching that week.",
      },
      "server-room:Deletion_Record": {
        ask: "Her data was deleted from the admin account.",
        reply: "labadmin? The password is on a sticky note on the rack. The cleaners could have used it. Whoever did it, look for the backup tape. Whoever has the tape has her work.",
      },
      "break-room:Whiteboard_Argument": {
        ask: "\"MY idea.\" \"OUR idea.\"",
        reply: "We fought about that paper. Loudly. Then we went for a drink. People who fight about credit aren't murderers, Rowan. They're academics.",
      },
    },
    elsewhere: {
      ask: "What about his house?",
      reply: "I've never been. I met him once, at a conference dinner. He didn't like me. I didn't blame him.",
    },
    after:
      "I keep trying to remember her presenting it. I can see the slides, every one. I can't see who's standing next to them.",
  },
};

/** Where a conversation with one of the accused starts. */
export function accusedStart(id: AccusedId, s: StoryState): string {
  if (s.act === "intro" || s.act === "investigating") return `${id}:gagged`;
  if (s.act === "revealed" || s.act === "released") return `${id}:after`;
  return `${id}:open`;
}

function scriptFor(id: AccusedId): Script<StoryState> {
  const a = ACCUSED[id];
  const shown = (s: StoryState, key: string) => s.shown[id].includes(key);
  const mark = (key: string) => (s: StoryState) => {
    if (!s.shown[id].includes(key)) s.shown[id].push(key);
  };
  const otherPlace = (s: StoryState) => s.journal.some((e) => e.place !== a.place);

  const evidenceChoices: ChoiceDef<StoryState>[] = Object.entries(a.evidence).map(([key, e]) => ({
    label: e.ask,
    next: `${id}:${key}`,
    when: (s) => hasEvidence(s, key),
    seen: (s) => shown(s, key),
    pick: mark(key),
  }));

  // Every answer offers the same questions again, so Rowan can work through them in any order.
  const questions: ChoiceDef<StoryState>[] = [
    { label: "Where were you on the fourteenth?", next: `${id}:night`, seen: (s) => shown(s, "night"), pick: mark("night") },
    { label: "Did you kill her?", next: `${id}:kill`, seen: (s) => shown(s, "kill"), pick: mark("kill") },
    ...evidenceChoices,
    { label: a.elsewhere.ask, next: `${id}:elsewhere`, when: otherPlace, seen: (s) => shown(s, "elsewhere"), pick: mark("elsewhere") },
    { label: "That's all.", next: `${id}:leave` },
  ];

  const script: Script<StoryState> = {
    [`${id}:gagged`]: { speaker: a.speaker, text: a.gagged },
    [`${id}:open`]: { speaker: a.speaker, text: a.open, choices: questions },
    [`${id}:night`]: { speaker: a.speaker, text: a.night, choices: questions },
    [`${id}:kill`]: { speaker: a.speaker, text: a.kill, choices: questions },
    [`${id}:elsewhere`]: { speaker: a.speaker, text: a.elsewhere.reply, choices: questions },
    [`${id}:leave`]: { speaker: a.speaker, text: "Rowan. Whatever it tells you to do, it wants you to do it. Think about why." },
    [`${id}:after`]: { speaker: a.speaker, text: a.after },
  };
  for (const [key, e] of Object.entries(a.evidence)) script[`${id}:${key}`] = { speaker: a.speaker, text: e.reply, choices: questions };
  return script;
}

export const ACCUSED_SCRIPT: Script<StoryState> = { ...scriptFor("boyfriend"), ...scriptFor("coworker") };
