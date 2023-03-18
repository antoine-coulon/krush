import { performance } from "node:perf_hooks";

import RushSdk from "@rushstack/rush-sdk";
import * as Effect from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import * as Option from "@effect/data/Option";
import { prompt } from "enquirer";
import kleur from "kleur";
import skott from "skott";
import { EcmaScriptDependencyResolver } from "skott/modules/resolvers/ecmascript/resolver";
import { loadRushConfiguration } from "../workspace.js";
import { pruneInteractive } from "./prune.js";

function collectUnusedDependencies({
  path,
  name,
  relativePath,
  project,
}: {
  path: string;
  name: string;
  relativePath: string;
  project: RushSdk.RushConfigurationProject;
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
      project,
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

function listUnusedDependencies(
  projectsResults: Array<{
    unused: string[];
    name: string;
    relativePath: string;
    project: RushSdk.RushConfigurationProject;
  }>
) {
  return pipe(
    projectsResults,
    Effect.forEach(({ name, unused, relativePath }) => {
      return Effect.sync(() => {
        console.log();
        console.log(
          kleur.bold().magenta(name),
          kleur.bold().grey(`(${relativePath})`)
        );

        if (unused.length === 0) {
          console.log(kleur.bold().green(" ✓ No unused dependencies"));
          return;
        }

        for (const packageName of unused) {
          console.log(kleur.bold().yellow(` ✖ ${packageName}`));
        }
      });
    })
  );
}

function findProjectByName(name: string, config: RushSdk.RushConfiguration) {
  return pipe(
    Effect.attempt(() => config.getProjectByName(name)),
    Effect.map(Option.fromNullable),
    Effect.someOrFailException,
    Effect.orDie
  );
}

function main(options = { interactive: true }) {
  return pipe(
    loadRushConfiguration(),
    Effect.flatMap((config) =>
      pipe(
        config.projects,
        Effect.forEach(
          ({ packageName, projectFolder, projectRelativeFolder }) =>
            pipe(
              findProjectByName(packageName, config),
              Effect.map((project) => ({
                name: packageName,
                path: projectFolder,
                relativePath: projectRelativeFolder,
                project,
              }))
            )
        )
      )
    ),
    Effect.tap(() => {
      console.log();
      console.log(
        kleur
          .bold()
          .yellow(
            `Warning: some unused dependencies might be false negatives (e.g: used in some specific runtime configuration files that could not be analyzed).`
          )
      );
      return Effect.unit();
    }),
    Effect.map((projects) =>
      Array.from(projects).map(collectUnusedDependencies)
    ),
    Effect.flatMap((projectsAnalysis) =>
      pipe(
        Effect.collectAllSuccessesPar(projectsAnalysis),
        Effect.withParallelism(10)
      )
    ),
    Effect.map((results) => Array.from(results)),
    Effect.flatMap((projectsResults) => {
      if (options.interactive) {
        return pruneInteractive(projectsResults);
      }

      return listUnusedDependencies(projectsResults);
    })
  );
}

const timing = performance.now();

Effect.runPromise(main()).finally(() => {
  console.log();
  console.log(
    kleur.bold().white(`✨ Done in ${Math.round(performance.now() - timing)}ms`)
  );
});
