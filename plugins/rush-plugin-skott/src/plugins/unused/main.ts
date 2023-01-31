import RushSdk from "@rushstack/rush-sdk";
import kleur from "kleur";
import skott from "skott";

import { Effect, pipe } from "effect";

class RushConfigurationError extends Error {
  readonly _tag = "RushConfigurationError";
  constructor(message: string) {
    super(message);
  }
}

function loadRush() {
  return Effect.tryCatch(
    () => {
      const config = RushSdk.RushConfiguration.loadFromDefaultLocation({
        startingFolder: process.cwd(),
      });

      if (!config) {
        throw new Error();
      } else {
        console.log(
          kleur.bold().green("✓"),
          kleur.bold("Rush configuration found")
        );
      }

      return config;
    },
    () => {
      return new RushConfigurationError(
        "Could not load 'rush.json' configuration"
      );
    }
  );
}

function main() {
  return pipe(
    loadRush(),
    Effect.map((config) =>
      config.projects.map(({ packageName, projectFolder }) => ({
        name: packageName,
        path: projectFolder,
      }))
    ),
    Effect.map((projects) =>
      projects.map(({ path, name }) =>
        pipe(
          Effect.tryPromise(() =>
            skott({
              cwd: path,
            }).then(({ findUnusedDependencies }) => findUnusedDependencies())
          ),
          Effect.map(({ thirdParty }) => ({ unused: thirdParty, name })),
          Effect.catchAll(() => {
            console.log(
              kleur
                .bold()
                .red(`✖ ${name} - error while collecting unused dependencies`)
            );
            return Effect.succeed({ unused: [], name });
          })
        )
      )
    ),
    Effect.flatMap((listOfProjectsToAnalyze) =>
      pipe(
        Effect.collectAllPar(listOfProjectsToAnalyze),
        Effect.withParallelism(10)
      )
    ),
    Effect.map((results) => {
      for (const result of results) {
        console.log();
        console.log(kleur.bold().magenta(result.name));

        for (const unused of result.unused) {
          console.log(" - ", kleur.bold().red(unused));
        }
      }
    })
  );
}

Effect.unsafeRunPromise(main());
