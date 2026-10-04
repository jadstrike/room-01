import sister from "../../public/images/sister/provenance.json";
import echo from "../../public/audio/entity-echo.json";

/**
 * The Moth jobs baked into the game's assets, read from the provenance files
 * the bake scripts write, so the credits always name the jobs that made
 * what is on screen. The coin and the Labyrinth are measured per playthrough
 * and live in the story state instead.
 */
export const BAKED = {
  blur: sister.blur.map((b) => b.job),
  teleblur: sister.teleblur.map((t) => t.job),
  echo: echo.job,
};
