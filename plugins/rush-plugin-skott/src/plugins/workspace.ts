import * as Effect from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";

import RushSdk from "@rushstack/rush-sdk";
import kleur from "kleur";

class RushConfigurationError extends Error {
  readonly _tag = "RushConfigurationError";
  constructor(message: string) {
    super(message);
  }
}

export function loadRushConfiguration() {
  try {
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
  } catch {
    throw new RushConfigurationError(
      "Could not load 'rush.json' configuration"
    );
  }
}
