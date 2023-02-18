import { Effect, pipe } from "effect";

import RushSdk from "@rushstack/rush-sdk";
import kleur from "kleur";

class RushConfigurationError extends Error {
  readonly _tag = "RushConfigurationError";
  constructor(message: string) {
    super(message);
  }
}

export function loadRushConfiguration() {
  return pipe(
    Effect.attempt(() => {
      const config = RushSdk.RushConfiguration.loadFromDefaultLocation({
        startingFolder: process.cwd(),
      });

      if (!config) {
        throw new Error();
      }

      console.log(
        kleur.bold().green("✓"),
        kleur.bold().white("Rush configuration found")
      );

      return config;
    }),
    Effect.orElseFail(
      () =>
        new RushConfigurationError("Could not load 'rush.json' configuration")
    )
  );
}
