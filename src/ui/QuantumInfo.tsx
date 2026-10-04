import type { StoryState } from "../story/state";

/**
 * How the game uses Moth's quantum engines, for players and judges, on the
 * title screen. Only what is really in the build is stated as such; what is
 * planned says so.
 */
export function QuantumInfo({ coin }: { coin: StoryState["coinProof"] }) {
  return (
    <div className="quantum-info">
      <h2>The coin is real</h2>
      <p>
        Early on, the entity refuses to let Rowan choose where to look for evidence and flips a coin instead: heads, the
        boyfriend&apos;s house; tails, the research lab. That coin is not a random number in your browser. The game asks
        Moth&apos;s <b>Coin Toss</b> engine to put one qubit into superposition and measure it eleven times. Whichever side
        comes up more often decides where the story goes.
      </p>
      <p>
        The entity reads the result out (&ldquo;Six out of eleven&rdquo;), and the end credits show the Moth job that decided
        your playthrough. It runs on Moth&apos;s quantum simulator, so the answer arrives in about five seconds, while the
        entity is still talking.
      </p>
      {coin && (
        <p className="quantum-last">
          {coin.source === "moth"
            ? `Your last coin: ${coin.heads} heads, ${coin.tails} tails · Moth job ${coin.jobId}`
            : "Your last coin was flipped locally: Moth did not answer in time."}
        </p>
      )}

      <h2>Why a quantum coin</h2>
      <p>
        The entity is a four-dimensional being that sees every side of a thing at once. The one choice it hands to chance
        is the one that sets the whole investigation going, and a qubit is the honest version of chance: both answers at
        once, until it is measured. It is the same thing Rowan&apos;s memory of his sister turns out to be.
      </p>

      <h2>How it is wired</h2>
      <p>
        Your browser never sees the API key. It asks this game&apos;s own server, which calls the Moth Quantum API, waits for
        the measurement and passes back only the counts. If Moth is slow or unreachable, a local coin stands in and the
        entity admits it flipped that one itself. The game never stalls on the network.
      </p>

      <h2>Researched, and next</h2>
      <p>
        <b>Quantum Labyrinth</b>: we ran Moth&apos;s Labyrinth engine on four rooms of the house to see whether measured
        qubit correlations could decide which doors connect. The findings, from a real run, are in the project&apos;s{" "}
        <code>docs/quantum-house</code>. The device that rearranges the house and the lab is where it will go.
      </p>
      <p>
        <b>Quantum Blur</b>: Rowan cannot remember his sister&apos;s face. Planned: her face, blurred by Moth&apos;s Blur
        engine, that never comes into focus.
      </p>
    </div>
  );
}
