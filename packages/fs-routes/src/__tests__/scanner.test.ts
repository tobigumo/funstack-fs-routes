import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { scanRoutesDir } from "../scanner.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `fs-routes-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function createFile(relativePath: string, content = "export default () => null;") {
  const fullPath = join(testDir, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

describe("scanRoutesDir", () => {
  test("scans flat route files", () => {
    createFile("_index.tsx");
    createFile("about.tsx");
    createFile("blog.first-post.tsx");

    const routes = scanRoutesDir(testDir);
    const routeIds = routes.map((r) => r.routeId).sort();

    expect(routeIds).toEqual(["_index", "about", "blog.first-post"]);
  });

  test("scans folder/route.tsx convention", () => {
    createFile("blog/route.tsx");
    createFile("blog/first-post/route.tsx");

    const routes = scanRoutesDir(testDir);
    const routeIds = routes.map((r) => r.routeId).sort();

    expect(routeIds).toEqual(["blog/first-post/route", "blog/route"]);

    // Both should have "route" stripped in parsed segments
    const blogRoute = routes.find((r) => r.routeId === "blog/route")!;
    expect(blogRoute.parsed.segments).toEqual(["blog"]);
  });

  test("ignores private modules (underscore prefix)", () => {
    createFile("_index.tsx");
    createFile("_components/Button.tsx");
    createFile("blog._utils.tsx");

    const routes = scanRoutesDir(testDir);
    const routeIds = routes.map((r) => r.routeId);

    expect(routeIds).toContain("_index");
    expect(routeIds).not.toContain("_components/Button");
    expect(routeIds).not.toContain("blog._utils");
  });

  test("ignores non-matching extensions", () => {
    createFile("about.tsx");
    createFile("about.css");
    createFile("readme.md");

    const routes = scanRoutesDir(testDir);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.routeId).toBe("about");
  });

  test("respects custom extensions", () => {
    createFile("about.tsx");
    createFile("post.mdx");

    const routes = scanRoutesDir(testDir, [".tsx", ".mdx"]);
    expect(routes).toHaveLength(2);
  });

  test("detects dynamic routes", () => {
    createFile("blog.$slug.tsx");
    createFile("users.$id.profile.tsx");

    const routes = scanRoutesDir(testDir);

    const blogRoute = routes.find((r) => r.routeId === "blog.$slug")!;
    expect(blogRoute.parsed.params).toEqual(["slug"]);

    const userRoute = routes.find((r) => r.routeId === "users.$id.profile")!;
    expect(userRoute.parsed.params).toEqual(["id"]);
  });

  test("throws for non-existent root directory", () => {
    expect(() => scanRoutesDir("/nonexistent/path")).toThrow("Cannot read routes directory");
  });
});

