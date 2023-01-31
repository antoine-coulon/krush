import { ServerResponse } from "node:http";
import skott, {
  continueResolution,
  DependencyResolver,
  DependencyResolverOptions,
  SkottStructure,
} from "skott";
import resolvePathToWebApp from "skott-webapp";

import compression from "compression";
import polka from "polka";
import sirv from "sirv";
import { open } from "topenurl";

import RushSdk from "@rushstack/rush-sdk";
import { createRushGraph, RushDependencyResolver } from "./graph.js";

async function buildRushStructure() {
  const config = RushSdk.RushConfiguration.loadFromDefaultLocation({
    startingFolder: process.cwd(),
  });

  if (!config) {
    throw new Error("Could not load 'rush.json' configuration");
  }

  const projectNames = config.projects.map((project) => project.packageName);

  const { graph: skottGraph } = await skott({
    dependencyResolvers: [new RushDependencyResolver(projectNames)],
  }).then(({ getStructure }) => getStructure());

  const rushGraph = createRushGraph(
    skottGraph,
    config.projects.map(({ packageName, projectRelativeFolder }) => ({
      name: packageName,
      path: projectRelativeFolder,
    }))
  );

  return rushGraph;
}

function openWebApplication(skottStructure: SkottStructure): void {
  const skottWebAppPath = resolvePathToWebApp();

  const compress = compression();
  const assets = sirv(skottWebAppPath, {
    immutable: true,
  });
  const srv = polka().use(compress, assets);

  srv.get("/api/cycles", (_, response: ServerResponse) => {
    const cycles: string[] = [];

    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(cycles));
  });

  srv.get("/api/analysis", (_, response: ServerResponse) => {
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
      console.error(`Could not open @skott/webapp on ${bindedAddress}`);
      process.exitCode = 1;
    } else {
      console.log(`Opened webapp on ${bindedAddress}`);
    }
  });
}

async function main() {
  const rushGraph = await buildRushStructure();
  console.log(JSON.stringify(rushGraph, null, 2));

  openWebApplication({ graph: rushGraph, files: [] });
}

main().catch((error) => console.error(error));
