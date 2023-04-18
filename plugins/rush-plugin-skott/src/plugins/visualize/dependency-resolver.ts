import {
  continueResolution,
  DependencyResolver,
  DependencyResolverOptions,
  skipNextResolvers,
} from "skott/modules/resolvers/base-resolver";
import * as Option from "@effect/data/Option";

export interface RushDependencies {
  rushDependencies?: string[];
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
    Option.Option<{ exitOnResolve: boolean }>
  > {
    if (this.rushProjectReferences.includes(moduleDeclaration)) {
      projectGraph.mergeVertexBody(resolvedNodePath, (body) => {
        body.rushDependencies = (body.rushDependencies ?? []).concat(
          moduleDeclaration
        );
      });

      // Ensure that the module treated as a rush dependency is not treated as a
      // third-party dependency during the next resolver step
      return skipNextResolvers();
    }

    projectGraph.mergeVertexBody(resolvedNodePath, (body) => {
      body.rushDependencies = [...(body.rushDependencies ?? [])];
    });

    return continueResolution();
  }
}
