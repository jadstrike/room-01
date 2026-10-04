import type { EndingId, StoryState } from "./state";

export type EndingView = { id: EndingId; number: number; title: string; text: string[] };

/**
 * The four endings. Executing either accused is never confirmed as right or
 * wrong, before the reveal or after it; the only difference the reveal makes
 * is that Rowan knew. Only the walk-away ending leaves through the door.
 */
export function endingFor(id: EndingId, s: StoryState): EndingView {
  const knew = s.verdictFrom === "revealed";
  switch (id) {
    case "boyfriend":
    case "coworker": {
      const who = id === "boyfriend" ? "the boyfriend" : "the coworker";
      return {
        id,
        number: id === "boyfriend" ? 1 : 2,
        title: id === "boyfriend" ? "The boyfriend" : "The coworker",
        text: [
          "The shot is very loud in a small room.",
          knew
            ? `You knew. The entity told you there was nobody to avenge, and you shot ${who} anyway, because somebody had to be guilty of something.`
            : `The entity applauds, slowly, and is gone before the echo is. You never learn whether ${who} did it. You never learn whether there was an "it".`,
          "You remember your sister every day, for the rest of your life. Her face never comes.",
        ],
      };
    }
    case "rowan":
      return {
        id,
        number: 3,
        title: "Rowan",
        text: [
          "You close your eyes. Something folds.",
          "The two in the chairs wake in their own beds the next morning with a headache, and the feeling they have forgotten someone important.",
          "Nobody ever finds out what happened to Rowan Langdon. Nobody looks. Whether anyone was ever killed in that room, the truth goes with you.",
        ],
      };
    case "walk-away":
      return {
        id,
        number: 4,
        title: "The door",
        text: [
          "The hallway goes on longer than it should, and then it doesn't. Outside it is morning, and raining.",
          "You still remember your sister: the kettle, the arguments, the phone call at twenty to twelve. You will never know if any of it happened.",
          "You keep walking anyway.",
        ],
      };
  }
}
