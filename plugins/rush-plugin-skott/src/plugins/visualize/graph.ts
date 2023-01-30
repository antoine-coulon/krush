import {
  continueResolution,
  DependencyResolver,
  DependencyResolverOptions,
  SkottNode,
} from "skott";

export interface RushProjectReferences {
  name: string;
  path: string;
}

export class RushDependencyResolver
  implements DependencyResolver<RushDependencies>
{
  constructor(private readonly rushProjectReferences: string[]) {}

  async resolve({
    moduleDeclaration,
    projectGraph,
    resolvedNodePath,
  }: DependencyResolverOptions<RushDependencies>): Promise<
    ReturnType<typeof continueResolution>
  > {
    if (this.rushProjectReferences.includes(moduleDeclaration)) {
      projectGraph.mergeVertexBody(resolvedNodePath, (body) => {
        body.rushDependencies = (body.rushDependencies ?? []).concat(
          moduleDeclaration
        );
      });
    } else {
      projectGraph.mergeVertexBody(resolvedNodePath, (body) => {
        body.rushDependencies = [];
      });
    }

    return continueResolution();
  }
}

export interface RushDependencies {
  rushDependencies: string[];
}

export function createRushGraph(
  skottGraph: Record<string, SkottNode<RushDependencies>>,
  rushProjectReferences: RushProjectReferences[]
): Record<string, SkottNode> {
  return Object.entries(skottGraph).reduce((rushGraph, [nodeId, nodeValue]) => {
    const rushRef = rushProjectReferences.find((ref) =>
      nodeId.startsWith(ref.path)
    );

    if (rushRef) {
      const rushNode = rushGraph[rushRef.name];

      rushGraph[rushRef.name] = {
        id: rushRef.name,
        adjacentTo: (rushNode?.adjacentTo ?? []).concat(
          skottGraph[nodeId]?.body.rushDependencies ?? []
        ),
        body: {
          size: (rushNode?.body.size ?? 0) + nodeValue.body.size,
          thirdPartyDependencies: (
            rushNode?.body.thirdPartyDependencies ?? []
          ).concat(nodeValue.body.thirdPartyDependencies),
          builtinDependencies: (
            rushNode?.body.builtinDependencies ?? []
          ).concat(nodeValue.body.builtinDependencies),
        },
      };
    }

    return rushGraph;
  }, {} as Record<string, SkottNode>);
}
