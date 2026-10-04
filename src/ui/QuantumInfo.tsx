import type { StoryState } from "../story/state";
import { BAKED } from "../story/moth";

/**
 * How the game uses Moth's quantum engines, for players and judges, on the
 * title screen. Five engines, each doing a job the story needs.
 */
export function QuantumInfo({ story }: { story: StoryState }) {
  const coin = story.coinProof;
  const measured = Object.entries(story.sites).flatMap(([place, p]) => (p?.measured ? [[place, p.measured.jobId] as const] : []));

  return (
    <div className="quantum-info">
      <p>Five of Moth&apos;s quantum engines are part of this game. Each one decides or makes something the story turns on.</p>

      <h2>1 · Coin Toss: where you go</h2>
      <p>
        The entity won&apos;t let Rowan choose where to look for evidence. It flips a coin: heads, the boyfriend&apos;s house;
        tails, the research lab. The game asks Moth to put one qubit into superposition and measure it eleven times, live,
        while the entity talks. The majority decides your story, and the entity reads the count out.
      </p>

      <h2>2 · Quantum Labyrinth: how the place is joined</h2>
      <p>
        When you arrive, Moth measures the house or the lab. Each room is a qubit; a door opens between two rooms whose qubits
        measured the same. The three layouts measured most often become the brass device&apos;s arrangements, so every
        playthrough has a different house, and no measurement can leave a room unreachable.
      </p>

      <h2>3 · Quantum Blur: her face</h2>
      <p>
        Rowan can&apos;t remember his sister&apos;s face. Her photograph went through Moth&apos;s Blur engine at three
        strengths. It never comes into focus, and each memory he recalls shows it a little less clearly.
      </p>

      <h2>4 · Quantum Teleblur: whose face</h2>
      <p>
        At the reveal, the entity admits it built her out of other people. Her photograph comes apart through quantum
        interference into a stranger&apos;s: Moth&apos;s Teleblur, in four steps.
      </p>

      <h2>5 · Retrocausal Echo: its voice</h2>
      <p>
        The entity&apos;s voice runs through an echo measured on a qubit chain, where negative returns play backwards. It
        answers itself out of order, the way a thing outside time would.
      </p>

      <h2>How it is wired</h2>
      <p>
        Coin Toss and Labyrinth run live, through this game&apos;s own server, which holds the API key; your browser never
        sees it. If Moth is slow, the game carries on with a local coin and the authored rooms, and says so. Blur, Teleblur
        and Echo were made once, ahead of time, so they never keep you waiting.
      </p>

      <p className="quantum-last">
        {coin ? (coin.source === "moth" ? `Your coin: ${coin.heads} heads, ${coin.tails} tails · job ${coin.jobId}` : "Your coin was flipped locally: Moth did not answer in time.") : "Your coin has not been flipped yet."}
        {measured.map(([place, job]) => (
          <span key={job}>
            <br />
            Your {place === "house" ? "house" : "lab"}: Labyrinth job {job}
          </span>
        ))}
        <br />
        Blur {BAKED.blur[0].slice(0, 8)}… · Teleblur {BAKED.teleblur[0].slice(0, 8)}… · Echo {BAKED.echo.slice(0, 8)}…
      </p>
    </div>
  );
}
