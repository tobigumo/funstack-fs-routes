import { describe, expect, test } from "vitest";
import type { EntryDefinition, RouteModule } from "../types.js";
import { fsRoutes } from "../fsRoutes.js";

async function collect(gen: AsyncIterable<EntryDefinition>): Promise<EntryDefinition[]> {
  const result: EntryDefinition[] = [];
  for await (const entry of gen) {
    result.push(entry);
  }
  return result;
}

function makeModules(
  files: string[],
  opts: { eager: boolean } = { eager: true },
): Record<string, RouteModule> {
  const modules: Record<string, RouteModule> = {};
  for (const file of files) {
    const key = `./routes/${file}`;
    if (opts.eager) {
      modules[key] = { default: () => null };
    } else {
      modules[key] = async () => ({ default: () => null });
    }
  }
  return modules;
}

const dummyRoot = { default: () => null };

describe("fsRoutes", () => {
  test("generates entries for static routes", async () => {
    const modules = makeModules([
      "_index.tsx",
      "about.tsx",
      "blog.first-post.tsx",
    ]);

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
    }));

    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual([
      "about/index.html",
      "blog/first-post/index.html",
      "index.html",
    ]);
  });

  test("generates entries with flat output style", async () => {
    const modules = makeModules(["about.tsx"]);

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
      outputStyle: "flat",
    }));

    expect(entries[0]!.path).toBe("about.html");
  });

  test("generates entries for dynamic routes", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/blog.$slug.tsx": {
        default: ({ params }: { params: { slug: string } }) => params.slug,
        getStaticPaths: () => [
          { slug: "hello-world" },
          { slug: "second-post" },
        ],
      },
    };

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
    }));

    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual([
      "blog/hello-world/index.html",
      "blog/second-post/index.html",
    ]);
  });

  test("generates entries for dynamic routes with async getStaticPaths", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/blog.$slug.tsx": {
        default: ({ params }: { params: { slug: string } }) => params.slug,
        getStaticPaths: async () => [
          { slug: "async-post" },
        ],
      },
    };

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
    }));

    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toBe("blog/async-post/index.html");
  });

  test("throws for dynamic route without getStaticPaths", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/blog.$slug.tsx": {
        default: () => null,
      },
    };

    await expect(
      collect(fsRoutes({ root: dummyRoot, modules })),
    ).rejects.toThrow("getStaticPaths");
  });

  test("throws for dynamic route with lazy module", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/blog.$slug.tsx": async () => ({
        default: () => null,
        getStaticPaths: () => [{ slug: "test" }],
      }),
    };

    await expect(
      collect(fsRoutes({ root: dummyRoot, modules })),
    ).rejects.toThrow("eager");
  });

  test("wraps getStaticPaths errors with route context", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/blog.$slug.tsx": {
        default: () => null,
        getStaticPaths: () => { throw new Error("DB connection failed"); },
      },
    };

    await expect(
      collect(fsRoutes({ root: dummyRoot, modules })),
    ).rejects.toThrow('getStaticPaths() failed for dynamic route "blog.$slug"');
  });

  test("detects route collisions", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/about.tsx": { default: () => null },
      "./routes/about/route.tsx": { default: () => null },
    };

    await expect(
      collect(fsRoutes({ root: dummyRoot, modules })),
    ).rejects.toThrow("collision");
  });

  test("detects dynamic route collision with static route", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/blog.about.tsx": { default: () => null },
      "./routes/blog.$slug.tsx": {
        default: () => null,
        getStaticPaths: () => [{ slug: "about" }],
      },
    };

    await expect(
      collect(fsRoutes({ root: dummyRoot, modules })),
    ).rejects.toThrow("collision");
  });

  test("all entries share the same root", async () => {
    const modules = makeModules(["_index.tsx", "about.tsx"]);

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
    }));

    for (const entry of entries) {
      expect(entry.root).toBe(dummyRoot);
    }
  });

  test("returns no entries for empty modules", async () => {
    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules: {},
    }));

    expect(entries).toEqual([]);
  });

  test("respects explicit prefix option", async () => {
    const modules: Record<string, RouteModule> = {
      "./pages/about.tsx": { default: () => null },
      "./pages/contact.tsx": { default: () => null },
    };

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
      prefix: "./pages/",
    }));

    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual([
      "about/index.html",
      "contact/index.html",
    ]);
  });

  test("auto-detects prefix from glob keys", async () => {
    const modules: Record<string, RouteModule> = {
      "./src/views/home.tsx": { default: () => null },
      "./src/views/about.tsx": { default: () => null },
    };

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
    }));

    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual([
      "about/index.html",
      "home/index.html",
    ]);
  });

  test("skips private modules", async () => {
    const modules: Record<string, RouteModule> = {
      "./routes/_index.tsx": { default: () => null },
      "./routes/_components/Button.tsx": { default: () => null },
    };

    const entries = await collect(fsRoutes({
      root: dummyRoot,
      modules,
    }));

    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toBe("index.html");
  });
});
