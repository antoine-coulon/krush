import { describe, expect, test } from "vitest";
import { doSomething } from "./index.js";

describe("Something", () => {
  test("should do something", () => {
    expect(doSomething()).toBe("Hello World");
  });
});
