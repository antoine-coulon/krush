import { SkottNode, SkottStructure } from "skott";

import { RushDependencies } from "./dependency-resolver.js";

function createUniqueCollection<T>(collection: Array<T>): Array<T> {
  return Array.from(new Set(collection));
}

export interface RushProjectReferences {
  name: string;
  path: string;
}

export function createRushGraph(
  skottGraph: Record<string, SkottNode<RushDependencies>>,
  rushProjectReferences: RushProjectReferences[]
): SkottStructure<unknown> {
  return Object.values(skottGraph).reduce(
    ({ graph, files }, node) => {
      files.push(node.id);

      const rushRef = rushProjectReferences.find((ref) =>
        node.id.startsWith(ref.path)
      );

      if (rushRef) {
        const rushNode = graph[rushRef.name];

        graph[rushRef.name] = {
          id: rushRef.name,
          adjacentTo: createUniqueCollection(
            (rushNode?.adjacentTo ?? []).concat(
              skottGraph[node.id]?.body.rushDependencies ?? []
            )
          ),
          body: {
            size: (rushNode?.body.size ?? 0) + node.body.size,
            thirdPartyDependencies: createUniqueCollection(
              (rushNode?.body.thirdPartyDependencies ?? []).concat(
                node.body.thirdPartyDependencies
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
