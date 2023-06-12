import * as Effect from "@effect/io/Effect";
import compression from "compression";
import { DiGraph } from "digraph-js";
import kleur from "kleur";
import { ServerResponse } from "node:http";
import polka from "polka";
import sirv from "sirv";
import skott, { type SkottStructure } from "skott";
import resolvePathToWebApp from "skott-webapp";
import { EcmaScriptDependencyResolver } from "skott/modules/resolvers/ecmascript/resolver";
import { open } from "topenurl";

import { loadRushConfiguration } from "../workspace.js";
import {
  type RushDependencies,
  RushDependencyResolver,
} from "./dependency-resolver.js";
import { createRushGraph } from "./graph.js";

async function buildRushStructure() {
  const config = await Effect.runPromise(loadRushConfiguration());

  const projectNames = config.projects.map((project) => project.packageName);

  // If skip source code analysis
  // then don't use skott at all

  // otherwise
  // Then keep only RushDependencyResolver
  // provide {} graph in createRushGraph
  // provide just the workspace in 3rd argument using getWorkspace()
  // remove dependency tracking
  const { graph: skottGraph } = await skott<RushDependencies>({
    dependencyResolvers: [
      new RushDependencyResolver(projectNames),
      new EcmaScriptDependencyResolver(),
    ],
    dependencyTracking: {
      builtin: true,
      thirdParty: true,
      typeOnly: true,
    },
  }).then(({ getStructure }) => getStructure());

  const rushGraph = createRushGraph(
    skottGraph,
    config.projects.map(({ packageName, projectRelativeFolder }) => ({
      name: packageName,
      path: projectRelativeFolder,
    })),
    // @TODO: implement that in skott
    {}
  );

  console.log(kleur.bold().green("✓"), kleur.bold("Rush graph created"));

  return rushGraph;
}

function openWebApplication(skottStructure: SkottStructure): void {
  const skottWebAppPath = resolvePathToWebApp();

  const compress = compression();
  const assets = sirv(skottWebAppPath, {
    immutable: true,
  });
  const srv = polka().use(compress, assets);

  srv.get("/api/cycles", (_: any, response: ServerResponse) => {
    const graph = DiGraph.fromRaw(skottStructure.graph);
    const cycles = graph.findCycles({ maxDepth: 10 });

    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(cycles));
  });

  srv.get("/api/analysis", (_: any, response: ServerResponse) => {
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        ...skottStructure,
        entrypoint: "none",
        cycles: [],
      })
    );
  });

  srv.listen(process.env.SKOTT_PORT || 0);

  // @ts-expect-error - "port" exists
  const bindedAddress = `http://127.0.0.1:${srv.server?.address()?.port}`;

  open(bindedAddress, (error) => {
    if (error) {
      console.log(
        kleur.bold().red("✖"),
        kleur.bold(`Could not open @skott/webapp on ${bindedAddress}`)
      );
      process.exitCode = 1;
    } else {
      console.log(
        kleur.bold().green("✓"),
        kleur.bold(`Opened webapp on ${bindedAddress}`)
      );
    }
  });
}

async function main() {
  const rushStructure = await buildRushStructure();
  openWebApplication(rushStructure);
}

main().catch((error) => console.error(error));
