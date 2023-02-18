import { performance } from "node:perf_hooks";

import RushSdk, { DependencyType } from "@rushstack/rush-sdk";
import { Effect, pipe } from "effect";
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
    Effect.tap(() => {
      console.log(
        kleur
          .bold()
          .yellow(
            `Warning: some unused dependencies might be false negatives (e.g: used in some specific runtime configuration files that could not be analyzed).`
          )
      );
      return Effect.unit();
    }),
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

function main(options = { interactive: false }) {
  return pipe(
    loadRushConfiguration(),
    Effect.map((config) =>
      config.projects.map(
        ({ packageName, projectFolder, projectRelativeFolder }) => ({
          name: packageName,
          path: projectFolder,
          relativePath: projectRelativeFolder,
          // Deal with not found project
          project: config.getProjectByName(packageName)!,
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

Effect.unsafeRunPromise(main()).finally(() => {
  console.log();
  console.log(
    kleur.bold().white(`✨ Done in ${Math.round(performance.now() - timing)}ms`)
  );
});
