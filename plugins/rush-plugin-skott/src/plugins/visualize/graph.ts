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

export interface SkottWorkspace {
  [packageName: string]: {
    dependencies: {
      [packageName: string]: string;
    };
    devDependencies: {
      [packageName: string]: string;
    };
    peerDependencies: {
      [packageName: string]: string;
    };
  };
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

function fromWorkspaceInformationOnly(
  skottWorkspace: SkottWorkspace,
  rushReferences: RushProjectReferences[]
) {
  const workspaceOnlyGraph: Record<string, SkottNode> = {};

  for (const [workspacePackage, dependencies] of Object.entries(
    skottWorkspace
  )) {
    const flattenedDeps = [
      ...Object.keys(dependencies.dependencies),
      ...Object.keys(dependencies.devDependencies),
      ...Object.keys(dependencies.peerDependencies),
    ];

    workspaceOnlyGraph[workspacePackage] = {
      id: workspacePackage,
      adjacentTo: flattenedDeps.filter(
        isRushWorkspaceDependency(rushReferences)
      ),
      body: {
        size: 0,
        thirdPartyDependencies: [],
        builtinDependencies: [],
      },
    };
  }

  return { graph: workspaceOnlyGraph, files: [] };
}

function fromSkottGraph(
  skottGraph: Record<string, SkottNode<RushDependencies>>,
  rushProjectReferences: RushProjectReferences[],
  skottWorkspace: SkottWorkspace
) {
  return Object.values(skottGraph).reduce(
    ({ graph, files }, node) => {
      files.push(node.id);

      const rushRef = rushProjectReferences.find((ref) =>
        node.id.startsWith(ref.path)
      );

      if (rushRef) {
        const rushNode = graph[rushRef.name];
        const prodDependencies = Object.keys(
          skottWorkspace[rushRef.name]?.dependencies ?? []
        );
        const devDependencies = Object.keys(
          skottWorkspace[rushRef.name]?.devDependencies ?? []
        );
        const peerDependencies = Object.keys(
          skottWorkspace[rushRef.name]?.peerDependencies ?? []
        );

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
              .concat(
                peerDependencies.filter(
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
                .concat(
                  peerDependencies.filter(
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

export function createRushGraph(
  skottGraph: Record<string, SkottNode<RushDependencies>>,
  rushProjectReferences: RushProjectReferences[],
  skottWorkspace: SkottWorkspace = {}
): SkottStructure<unknown> {
  if (Object.keys(skottGraph).length === 0) {
    return fromWorkspaceInformationOnly(skottWorkspace, rushProjectReferences);
  }

  return fromSkottGraph(skottGraph, rushProjectReferences, skottWorkspace);
}
