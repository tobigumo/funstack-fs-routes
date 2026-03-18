import { describe, expect, test } from "vitest";
import { parseRouteId, toOutputPath } from "../convention.js";

describe("parseRouteId", () => {
  test("_index → index route with no segments", () => {
    const result = parseRouteId("_index");
    expect(result).toEqual({ segments: [], params: [], isIndex: true });
  });

  test("about → static segment", () => {
    const result = parseRouteId("about");
    expect(result).toEqual({ segments: ["about"], params: [], isIndex: false });
  });

  test("blog._index → blog index", () => {
    const result = parseRouteId("blog._index");
    expect(result).toEqual({ segments: ["blog"], params: [], isIndex: true });
  });

  test("blog.first-post → nested segments via dot separator", () => {
    const result = parseRouteId("blog.first-post");
    expect(result).toEqual({
      segments: ["blog", "first-post"],
      params: [],
      isIndex: false,
    });
  });

  test("docs.getting-started.installation → deep nesting", () => {
    const result = parseRouteId("docs.getting-started.installation");
    expect(result).toEqual({
      segments: ["docs", "getting-started", "installation"],
      params: [],
      isIndex: false,
    });
  });

  test("sitemap[.]xml → escaped dot becomes literal", () => {
    const result = parseRouteId("sitemap[.]xml");
    expect(result).toEqual({
      segments: ["sitemap.xml"],
      params: [],
      isIndex: false,
    });
  });

  test("_components → private module returns null", () => {
    const result = parseRouteId("_components");
    expect(result).toBeNull();
  });

  test("blog._utils → private segment returns null", () => {
    const result = parseRouteId("blog._utils");
    expect(result).toBeNull();
  });

  test("blog/first-post/route → folder/route.tsx convention", () => {
    const result = parseRouteId("blog/first-post/route");
    expect(result).toEqual({
      segments: ["blog", "first-post"],
      params: [],
      isIndex: false,
    });
  });

  test("blog/$slug → dynamic segment", () => {
    const result = parseRouteId("blog.$slug");
    expect(result).toEqual({
      segments: ["blog", "$slug"],
      params: ["slug"],
      isIndex: false,
    });
  });

  test("users.$id.profile → dynamic + static mixed", () => {
    const result = parseRouteId("users.$id.profile");
    expect(result).toEqual({
      segments: ["users", "$id", "profile"],
      params: ["id"],
      isIndex: false,
    });
  });

  test("empty param name throws", () => {
    expect(() => parseRouteId("blog.$")).toThrow("empty parameter name");
  });

  test("unclosed escape bracket throws", () => {
    expect(() => parseRouteId("sitemap[.xml")).toThrow('Unclosed "["');
  });
});

describe("toOutputPath", () => {
  describe("directory style", () => {
    test("index route → index.html", () => {
      const parsed = parseRouteId("_index")!;
      expect(toOutputPath(parsed, "directory")).toBe("index.html");
    });

    test("about → about/index.html", () => {
      const parsed = parseRouteId("about")!;
      expect(toOutputPath(parsed, "directory")).toBe("about/index.html");
    });

    test("blog._index → blog/index.html", () => {
      const parsed = parseRouteId("blog._index")!;
      expect(toOutputPath(parsed, "directory")).toBe("blog/index.html");
    });

    test("blog.first-post → blog/first-post/index.html", () => {
      const parsed = parseRouteId("blog.first-post")!;
      expect(toOutputPath(parsed, "directory")).toBe(
        "blog/first-post/index.html",
      );
    });

    test("sitemap[.]xml → sitemap.xml/index.html (directory style)", () => {
      const parsed = parseRouteId("sitemap[.]xml")!;
      expect(toOutputPath(parsed, "directory")).toBe(
        "sitemap.xml/index.html",
      );
    });

    test("dynamic route with params", () => {
      const parsed = parseRouteId("blog.$slug")!;
      expect(toOutputPath(parsed, "directory", { slug: "hello-world" })).toBe(
        "blog/hello-world/index.html",
      );
    });

    test("dynamic route missing param throws", () => {
      const parsed = parseRouteId("blog.$slug")!;
      expect(() => toOutputPath(parsed, "directory")).toThrow(
        'Missing parameter value for "slug"',
      );
    });
  });

  describe("flat style", () => {
    test("index route → index.html", () => {
      const parsed = parseRouteId("_index")!;
      expect(toOutputPath(parsed, "flat")).toBe("index.html");
    });

    test("about → about.html", () => {
      const parsed = parseRouteId("about")!;
      expect(toOutputPath(parsed, "flat")).toBe("about.html");
    });

    test("blog._index → blog/index.html", () => {
      const parsed = parseRouteId("blog._index")!;
      expect(toOutputPath(parsed, "flat")).toBe("blog/index.html");
    });

    test("blog.first-post → blog/first-post.html", () => {
      const parsed = parseRouteId("blog.first-post")!;
      expect(toOutputPath(parsed, "flat")).toBe("blog/first-post.html");
    });

    test("sitemap[.]xml → sitemap.xml.html (flat)", () => {
      const parsed = parseRouteId("sitemap[.]xml")!;
      expect(toOutputPath(parsed, "flat")).toBe("sitemap.xml.html");
    });
  });
});
