import * as Effect from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import RushSdk from "@rushstack/rush-sdk";
import Enquirer from "enquirer";
import kleur from "kleur";

interface AnalyzedProject {
  unused: string[];
  name: string;
  relativePath: string;
  project: RushSdk.RushConfigurationProject;
}

function makePrunePrompt(analyzedProject: AnalyzedProject): Promise<string[]> {
  console.log();

  return Enquirer.prompt([
    {
      type: "multiselect",
      name: "selection",
      message: kleur.bold().white(analyzedProject.name),
      choices: analyzedProject.unused.map((name) => ({ name, value: name })),
    },
    // @ts-ignore
  ]).then(({ selection }) => selection);
}

/**
 * TODO: Handle all types of dependencies. For now, only "dependencies" and
 * "devDependencies" are supported.
 */
function getDependencyType(
  project: RushSdk.RushConfigurationProject,
  dependencyName: string
): RushSdk.DependencyType {
  const deps = project.packageJson.dependencies ?? {};

  if (deps[dependencyName]) {
    return RushSdk.DependencyType.Regular;
  }

  return RushSdk.DependencyType.Dev;
}

function pruneDependenciesFromProjects(
  pruneInformation: Array<
    AnalyzedProject & {
      depsToPrune: string[];
    }
  >
) {
  return pipe(
    pruneInformation,
    Effect.forEachPar(({ project, depsToPrune }) =>
      pipe(
        Effect.succeed(depsToPrune),
        Effect.tap(() => {
          if (depsToPrune.length > 0) {
            console.log();
            console.log(kleur.bold().magenta(project.packageName));
          }
          return Effect.unit();
        }),
        Effect.flatMap(
          Effect.forEach((depToPrune) => {
            return pipe(
              Effect.sync(() => getDependencyType(project, depToPrune)),
              Effect.flatMap((dependencyType) =>
                pipe(
                  Effect.attempt(() => {
                    project.packageJsonEditor.removeDependency(
                      depToPrune,
                      dependencyType
                    );

                    project.packageJsonEditor.saveIfModified();
                  }),
                  Effect.tapBoth(
                    () => {
                      return Effect.sync(() => {
                        console.log(
                          kleur.bold().red("  ✗"),
                          kleur.bold().white(`Failed to remove ${depToPrune}`),
                          kleur.bold().grey(`(${dependencyType})`)
                        );
                      });
                    },
                    () => {
                      return Effect.sync(() => {
                        console.log(
                          kleur.bold().green("  ✓"),
                          kleur.bold().white(depToPrune),
                          kleur.bold().grey(`(${dependencyType})`)
                        );
                      });
                    }
                  ),
                  Effect.tap(() => {
                    console.log();
                    return Effect.unit();
                  })
                )
              )
            );
          })
        )
      )
    )
  );
}

export function pruneInteractive(analyzedProjects: Array<AnalyzedProject>) {
  return pipe(
    analyzedProjects,
    Effect.filter(({ unused, name }) =>
      pipe(
        Effect.succeed(unused.length > 0),
        Effect.tap(() => {
          if (unused.length === 0) {
            console.log();
            console.log(
              kleur.bold().grey(`Skipped ${name}. No unused dependencies found`)
            );
          }
          return Effect.unit();
        })
      )
    ),
    Effect.flatMap(
      Effect.forEach((result) =>
        pipe(
          Effect.tryPromise(() => makePrunePrompt(result)),
          Effect.map((depsToPrune) => ({ depsToPrune, ...result })),
          Effect.tap(() => {
            console.log();
            return Effect.unit();
          })
        )
      )
    ),
    Effect.flatMap((projects) =>
      pipe(
        pruneDependenciesFromProjects(Array.from(projects)),
        Effect.withParallelism(15)
      )
    ),
    Effect.asUnit
  );
}
