import type { SkottStructure } from "skott";
import type { SkottNode } from "skott/graph/node";

import type { RushDependencies } from "./dependency-resolver.js";

function createUniqueCollection<T>(collection: Array<T>): Array<T> {
  return Array.from(new Set(collection));
}

export interface RushProjectReferences {
  name: string;
  path: string;
}

function isRushWorkspaceDependency(
  rushProjectReferences: RushProjectReferences[]
) {
  return (dependency: string) =>
    rushProjectReferences.find((ref) => ref.name === dependency);
}

function isThirdPartyDependency(
  rushProjectReferences: RushProjectReferences[]
) {
  return (dependency: string) =>
    !rushProjectReferences.find((ref) => ref.name === dependency);
}

export function createRushGraph(
  skottGraph: Record<string, SkottNode<RushDependencies>>,
  rushProjectReferences: RushProjectReferences[],
  skottWorkspace: Record<
    string,
    { prodDependencies: string[]; devDependencies: string[] }
  > = {}
): SkottStructure<unknown> {
  return Object.values(skottGraph).reduce(
    ({ graph, files }, node) => {
      files.push(node.id);

      const rushRef = rushProjectReferences.find((ref) =>
        node.id.startsWith(ref.path)
      );

      if (rushRef) {
        const rushNode = graph[rushRef.name];
        const prodDependencies =
          skottWorkspace[rushRef.name]?.prodDependencies ?? [];
        const devDependencies =
          skottWorkspace[rushRef.name]?.devDependencies ?? [];

        graph[rushRef.name] = {
          id: rushRef.name,
          adjacentTo: createUniqueCollection(
            (rushNode?.adjacentTo ?? [])
              .concat(skottGraph[node.id]?.body.rushDependencies ?? [])
              .concat(
                prodDependencies.filter(
                  isRushWorkspaceDependency(rushProjectReferences)
                )
              )
              .concat(
                devDependencies.filter(
                  isRushWorkspaceDependency(rushProjectReferences)
                )
              )
          ),
          body: {
            size: (rushNode?.body.size ?? 0) + node.body.size,
            thirdPartyDependencies: createUniqueCollection(
              (rushNode?.body.thirdPartyDependencies ?? [])
                .concat(node.body.thirdPartyDependencies)
                .concat(
                  prodDependencies.filter(
                    isThirdPartyDependency(rushProjectReferences)
                  )
                )
                .concat(
                  devDependencies.filter(
                    isThirdPartyDependency(rushProjectReferences)
                  )
                )
            ),
            builtinDependencies: createUniqueCollection(
              (rushNode?.body.builtinDependencies ?? []).concat(
                node.body.builtinDependencies
              )
            ),
          },
        };
      }

      return { graph, files };
    },
    {
      graph: {},
      files: [],
    } as SkottStructure<unknown>
  );
}
