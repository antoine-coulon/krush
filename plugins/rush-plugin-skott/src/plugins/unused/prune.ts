import RushSdk, { DependencyType } from "@rushstack/rush-sdk";
import { Effect, pipe } from "effect";
import { prompt } from "enquirer";
import kleur from "kleur";

interface AnalyzedProject {
  unused: string[];
  name: string;
  relativePath: string;
  project: RushSdk.RushConfigurationProject;
}

function makePrunePrompt(unusedDependencies: string[]): Promise<string[]> {
  return prompt([
    {
      type: "multiselect",
      name: "selection",
      message: "Select a dependency to remove",
      choices: unusedDependencies.map((name) => ({ name, value: name })),
    },
  ]);
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
        depsToPrune,
        Effect.forEach((depToPrune) => {
          return pipe(
            Effect.attempt(() =>
              project.packageJsonEditor.removeDependency(
                depToPrune,
                DependencyType.Regular
              )
            ),
            Effect.tapBoth(
              () => {
                return Effect.sync(() => {
                  console.log(
                    kleur.bold().red("✗"),
                    kleur
                      .bold()
                      .white(
                        `Failed to remove ${depToPrune} from ${project.packageName}`
                      )
                  );
                });
              },
              () => {
                return Effect.sync(() => {
                  console.log(
                    kleur.bold().green("✓"),
                    kleur
                      .bold()
                      .white(
                        `Removed ${depToPrune} from ${project.packageName}`
                      )
                  );
                });
              }
            )
          );
        })
      )
    )
  );
}

export function pruneInteractive(projectResults: Array<AnalyzedProject>) {
  return pipe(
    projectResults,
    Effect.forEach((result) =>
      pipe(
        Effect.tryPromise(() => makePrunePrompt(result.unused)),
        Effect.map((depsToPrune) => ({ depsToPrune, ...result }))
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
