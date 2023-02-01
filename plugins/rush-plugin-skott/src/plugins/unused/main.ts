import { performance } from "node:perf_hooks";

import RushSdk from "@rushstack/rush-sdk";
import { Effect, pipe } from "effect";
import kleur from "kleur";
import skott from "skott";
import { EcmaScriptDependencyResolver } from "skott/modules/resolvers/ecmascript/resolver";

class RushConfigurationError extends Error {
  readonly _tag = "RushConfigurationError";
  constructor(message: string) {
    super(message);
  }
}

function loadRushConfiguration() {
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

function collectUnusedDependencies({
  path,
  name,
  relativePath,
}: {
  path: string;
  name: string;
  relativePath: string;
}) {
  return pipe(
    Effect.tryPromise(() =>
      skott({
        cwd: path,
        dependencyResolvers: [new EcmaScriptDependencyResolver()],
        dependencyTracking: {
          thirdParty: true,
          typeOnly: false,
          builtin: false,
        },
      }).then(({ findUnusedDependencies }) => findUnusedDependencies())
    ),
    Effect.map(({ thirdParty }) => ({
      unused: thirdParty,
      name,
      relativePath,
    })),
    Effect.tapError(() => {
      console.log();
      console.log(
        kleur.bold().yellow(`⚠ ${name} skipped.`),
        kleur.bold().gray("Reason: invalid or missing package.json")
      );
      return Effect.unit();
    })
  );
}

function main() {
  return pipe(
    loadRushConfiguration(),
    Effect.map((config) =>
      config.projects.map(
        ({ packageName, projectFolder, projectRelativeFolder }) => ({
          name: packageName,
          path: projectFolder,
          relativePath: projectRelativeFolder,
        })
      )
    ),
    Effect.map((projects) => projects.map(collectUnusedDependencies)),
    Effect.flatMap((listOfProjectsToAnalyze) =>
      pipe(
        Effect.collectAllSuccessesPar(listOfProjectsToAnalyze),
        Effect.withParallelism(10)
      )
    ),
    Effect.map((projectsResults) => {
      for (const { name, unused, relativePath } of projectsResults) {
        console.log();
        console.log(
          kleur.bold().magenta(name),
          kleur.bold().grey(`(${relativePath})`)
        );

        if (unused.length === 0) {
          console.log(kleur.bold().green(" ✓ No unused dependencies"));
          continue;
        }

        for (const packageName of unused) {
          console.log(kleur.bold().yellow(` ✖ ${packageName}`));
        }
      }
    })
  );
}

const timing = performance.now();
Effect.unsafeRunPromise(main()).finally(() => {
  console.log();
  console.log(
    kleur.bold().white(`✨ Done in ${Math.round(performance.now() - timing)}ms`)
  );
});
