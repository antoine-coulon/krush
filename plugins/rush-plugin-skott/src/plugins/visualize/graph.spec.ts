import memfs from "memfs";
import { defaultConfig, Skott } from "skott";
import { InMemoryFileReader } from "skott/filesystem/file-reader";
import { InMemoryFileWriter } from "skott/filesystem/file-writer";
import { EcmaScriptDependencyResolver } from "skott/modules/resolvers/ecmascript/resolver";
import { ModuleWalkerSelector } from "skott/modules/walkers/common";
import { describe, expect, test } from "vitest";
import { RushDependencyResolver } from "./dependency-resolver.js";
import { createRushGraph, RushProjectReferences } from "./graph.js";

function mountFakeFileSystem(
  fs: Record<string, string>,
  mountingPoint = "./"
): void {
  // As Volumes are shared, we need to clear the volume before mounting another one
  // specifically for a test
  memfs.vol.reset();
  memfs.vol.fromJSON(fs, mountingPoint);
}

describe("Visualizer plugin", () => {
  describe("When resolving Rush projects dependencies", () => {
    test("Should link rushDependencies for one node with a dependency to another Rush project", async () => {
      mountFakeFileSystem({
        "apps/app1/index.js": `
          import "@libs/lib1";
          import _ from "lodash";
        `,
        "libs/lib1/index.js": ``,
      });

      const skott = new Skott(
        {
          ...defaultConfig,
          dependencyResolvers: [new RushDependencyResolver(["@libs/lib1"])],
        },
        new InMemoryFileReader(),
        new InMemoryFileWriter(),
        new ModuleWalkerSelector()
      );

      const { getStructure } = await skott.initialize();

      expect(getStructure().graph).to.deep.equal({
        "apps/app1/index.js": {
          id: "apps/app1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: ["@libs/lib1"],
          },
        },
        "libs/lib1/index.js": {
          id: "libs/lib1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
          },
        },
      });
    });

    test("Should link all rushDependencies for nodes with dependencies to Rush projects", async () => {
      mountFakeFileSystem({
        "apps/app1/index.js": `
          import "@libs/lib1";
        `,
        "apps/app2/index.js": `
          import "@libs/lib1";
          import "@libs/lib2";
        `,
        "libs/lib1/index.js": `
          import * as _ from "lodash";
        `,
        "libs/lib2/index.js": `
          import * as _ from "lodash";
        `,
      });

      const skott = new Skott(
        {
          ...defaultConfig,
          dependencyResolvers: [
            new RushDependencyResolver(["@libs/lib1", "@libs/lib2"]),
          ],
        },
        new InMemoryFileReader(),
        new InMemoryFileWriter(),
        new ModuleWalkerSelector()
      );

      const { getStructure } = await skott.initialize();

      expect(getStructure().graph).to.deep.equal({
        "apps/app1/index.js": {
          id: "apps/app1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: ["@libs/lib1"],
          },
        },
        "apps/app2/index.js": {
          id: "apps/app2/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: ["@libs/lib1", "@libs/lib2"],
          },
        },
        "libs/lib1/index.js": {
          id: "libs/lib1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
        "libs/lib2/index.js": {
          id: "libs/lib2/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
      });
    });

    test("Should only keep rushDependencies with no overlap with third-party dependencies", async () => {
      mountFakeFileSystem({
        "apps/app1/index.js": `
          import "@libs/lib1";
          import { Effect } from "effect";
        `,
        "libs/lib1/index.js": `
          import * as _ from "lodash";
        `,
      });

      const skott = new Skott(
        {
          ...defaultConfig,
          dependencyResolvers: [
            new RushDependencyResolver(["@libs/lib1"]),
            new EcmaScriptDependencyResolver(),
          ],
          dependencyTracking: {
            ...defaultConfig.dependencyTracking,
            thirdParty: true,
          },
        },
        new InMemoryFileReader(),
        new InMemoryFileWriter(),
        new ModuleWalkerSelector()
      );

      const { getStructure } = await skott.initialize();

      expect(getStructure().graph).to.deep.equal({
        "apps/app1/index.js": {
          id: "apps/app1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: ["effect"],
            builtinDependencies: [],
            rushDependencies: ["@libs/lib1"],
          },
        },
        "libs/lib1/index.js": {
          id: "libs/lib1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: ["lodash"],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
      });
    });
  });

  describe("When building the Rush data structure", () => {
    test("Should group project files nodes by project names", () => {
      const rushProjectReferences: RushProjectReferences[] = [
        { name: "@apps/app1", path: "apps/app1" },
        { name: "@libs/lib1", path: "libs/lib1" },
      ];

      const skottGraphWithRushDependencies = {
        "apps/app1/index.js": {
          id: "apps/app1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
        "libs/lib1/index.js": {
          id: "libs/lib1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
      };

      const { graph, files } = createRushGraph(
        skottGraphWithRushDependencies,
        rushProjectReferences
      );

      expect(graph).to.deep.equal({
        "@apps/app1": {
          id: "@apps/app1",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
          },
        },
        "@libs/lib1": {
          id: "@libs/lib1",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
          },
        },
      });
      expect(files).to.deep.equal(["apps/app1/index.js", "libs/lib1/index.js"]);
    });

    test("Should create links at the Rush project-level when there are links between files of different projects", () => {
      const rushProjectReferences: RushProjectReferences[] = [
        { name: "@apps/app1", path: "apps/app1" },
        { name: "@libs/lib1", path: "libs/lib1" },
        { name: "@libs/lib2", path: "libs/lib2" },
      ];

      const skottGraphWithRushDependencies = {
        "apps/app1/index.js": {
          id: "apps/app1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: ["@libs/lib1", "@libs/lib2"],
          },
        },
        "apps/app1/main.js": {
          id: "apps/app1/main.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: ["@libs/lib2"],
          },
        },
        "libs/lib1/index.js": {
          id: "libs/lib1/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
        "libs/lib2/index.js": {
          id: "libs/lib2/index.js",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
            rushDependencies: [],
          },
        },
      };

      const { graph } = createRushGraph(
        skottGraphWithRushDependencies,
        rushProjectReferences
      );

      expect(graph).to.deep.equal({
        "@apps/app1": {
          id: "@apps/app1",
          adjacentTo: ["@libs/lib1", "@libs/lib2"],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
          },
        },
        "@libs/lib1": {
          id: "@libs/lib1",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
          },
        },
        "@libs/lib2": {
          id: "@libs/lib2",
          adjacentTo: [],
          body: {
            size: 0,
            thirdPartyDependencies: [],
            builtinDependencies: [],
          },
        },
      });
    });

    test("Should merge all project files bodies into project bodies", () => {
      const rushProjectReferences: RushProjectReferences[] = [
        { name: "@libs/lib1", path: "libs/lib1" },
      ];

      const skottGraphWithRushDependencies = {
        "libs/lib1/index.js": {
          id: "libs/lib1/index.js",
          adjacentTo: [],
          body: {
            size: 1000,
            thirdPartyDependencies: ["skott", "skott-webapp"],
            builtinDependencies: ["node:fs", "node:path"],
            rushDependencies: [],
          },
        },
        "libs/lib1/lib.js": {
          id: "libs/lib1/lib.js",
          adjacentTo: [],
          body: {
            size: 3500,
            thirdPartyDependencies: ["effect", "skott"],
            builtinDependencies: ["node:child_process", "node:path"],
            rushDependencies: [],
          },
        },
      };

      const { graph } = createRushGraph(
        skottGraphWithRushDependencies,
        rushProjectReferences
      );

      expect(graph).to.deep.equal({
        "@libs/lib1": {
          id: "@libs/lib1",
          adjacentTo: [],
          body: {
            size: 4500,
            thirdPartyDependencies: ["skott", "skott-webapp", "effect"],
            builtinDependencies: ["node:fs", "node:path", "node:child_process"],
          },
        },
      });
    });
  });
});
