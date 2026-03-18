import { createElement } from "react";
import { parseRouteId, toOutputPath } from "./convention.js";
import {
  DEFAULT_EXTENSIONS,
  type EagerRouteModule,
  type EntryDefinition,
  type FsRoutesOptions,
  type ParsedRoute,
  type RouteModule,
} from "./types.js";

/**
 * Generate EntryDefinition items from import.meta.glob module keys.
 *
 * Returns an AsyncGenerator so that the result can be directly returned
 * from getEntries() as an AsyncIterable — the format FUNSTACK Static expects.
 *
 * @example
 * ```typescript
 * // entries.tsx
 * import { fsRoutes } from "funstack-fs-routes";
 *
 * const modules = import.meta.glob("./routes/*.tsx", { eager: true });
 *
 * export default function getEntries() {
 *   return fsRoutes({
 *     root: () => import("./root"),
 *     modules,
 *   });
 * }
 * ```
 */
export async function* fsRoutes(
  options: FsRoutesOptions,
): AsyncGenerator<EntryDefinition> {
  const {
    root,
    modules,
    prefix,
    extensions = DEFAULT_EXTENSIONS,
    outputStyle = "directory",
  } = options;

  const keys = Object.keys(modules);
  if (keys.length === 0) {
    return;
  }

  const resolvedPrefix = prefix ?? detectPrefix(keys);
  const extensionSet = new Set(extensions);

  const outputPaths = new Set<string>();

  for (const key of keys) {
    const route = parseGlobKey(key, resolvedPrefix, extensionSet);
    if (route === null) {
      continue;
    }

    const mod = modules[key]!;
    const { parsed } = route;

    if (parsed.params.length > 0) {
      const dynamicEntries = await resolveDynamicRoute(
        route.routeId,
        parsed,
        mod,
        root,
        outputStyle,
      );
      for (const entry of dynamicEntries) {
        checkCollision(entry.path, route.routeId, outputPaths);
        yield entry;
      }
    } else {
      const outputPath = toOutputPath(parsed, outputStyle);
      checkCollision(outputPath, route.routeId, outputPaths);

      yield {
        path: outputPath,
        root,
        app: resolveAppModule(mod),
      };
    }
  }

  if (outputPaths.size === 0) {
    console.warn(
      `[fs-routes] ${keys.length} module(s) were provided but none matched. ` +
      `Check that the prefix ("${resolvedPrefix}") and extensions (${[...extensionSet].join(", ")}) are correct. ` +
      `Module keys: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}`,
    );
  }
}

interface GlobRoute {
  routeId: string;
  parsed: ParsedRoute;
}

/**
 * Parse a glob key into a route ID and parsed route.
 * Returns null if the key should be skipped (private module, unknown extension).
 */
function parseGlobKey(
  key: string,
  prefix: string,
  extensions: Set<string>,
): GlobRoute | null {
  if (!key.startsWith(prefix)) {
    return null;
  }

  const rest = key.slice(prefix.length);

  // Find and strip the extension
  const extMatch = Array.from(extensions).find((ext) => rest.endsWith(ext));
  if (!extMatch) {
    return null;
  }

  const routeId = rest.slice(0, rest.length - extMatch.length);
  const parsed = parseRouteId(routeId);
  if (parsed === null) {
    return null;
  }

  return { routeId, parsed };
}

/**
 * Detect the common directory prefix from glob keys.
 * e.g., ["./routes/about.tsx", "./routes/blog.tsx"] → "./routes/"
 */
function detectPrefix(keys: string[]): string {
  if (keys.length === 0) {
    return "./";
  }

  const first = keys[0]!;
  const lastSlash = first.lastIndexOf("/");
  if (lastSlash === -1) {
    return "";
  }

  const candidate = first.slice(0, lastSlash + 1);

  for (let i = 1; i < keys.length; i++) {
    if (!keys[i]!.startsWith(candidate)) {
      // Fall back to finding the true common prefix
      return findCommonPrefix(keys);
    }
  }

  return candidate;
}

function findCommonPrefix(keys: string[]): string {
  if (keys.length === 0) return "";

  let prefix = keys[0]!;
  for (let i = 1; i < keys.length; i++) {
    const key = keys[i]!;
    let j = 0;
    while (j < prefix.length && j < key.length && prefix[j] === key[j]) {
      j++;
    }
    prefix = prefix.slice(0, j);
  }

  // Trim to last "/" to ensure we have a directory prefix
  const lastSlash = prefix.lastIndexOf("/");
  return lastSlash === -1 ? "" : prefix.slice(0, lastSlash + 1);
}

function checkCollision(
  outputPath: string,
  routeId: string,
  seen: Set<string>,
): void {
  if (seen.has(outputPath)) {
    throw new Error(
      `Route collision: "${routeId}" produces output path "${outputPath}" which is already defined by another route`,
    );
  }
  seen.add(outputPath);
}

async function resolveDynamicRoute(
  routeId: string,
  parsed: ParsedRoute,
  mod: RouteModule,
  root: FsRoutesOptions["root"],
  outputStyle: "directory" | "flat",
): Promise<EntryDefinition[]> {
  const eagerMod = resolveEagerModule(routeId, mod);

  if (!eagerMod.getStaticPaths) {
    throw new Error(
      `Dynamic route "${routeId}" must export a "getStaticPaths" function`,
    );
  }

  let pathParams: Record<string, string>[];
  try {
    pathParams = await eagerMod.getStaticPaths();
  } catch (error: unknown) {
    throw new Error(
      `getStaticPaths() failed for dynamic route "${routeId}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (!Array.isArray(pathParams)) {
    throw new Error(
      `getStaticPaths() for route "${routeId}" must return an array of parameter objects, got ${typeof pathParams}`,
    );
  }

  const Component = eagerMod.default;

  return pathParams.map((params) => {
    const outputPath = toOutputPath(parsed, outputStyle, params);
    return {
      path: outputPath,
      root,
      app: createElement(Component, { params }),
    };
  });
}

/**
 * Resolve a module from import.meta.glob to an app value for EntryDefinition.
 */
function resolveAppModule(
  mod: RouteModule,
): EntryDefinition["app"] {
  if (typeof mod === "function") {
    // Lazy module — return as-is (FUNSTACK Static will call it)
    return mod as EntryDefinition["app"];
  }
  // Eager module — return as-is (has .default)
  return mod as EntryDefinition["app"];
}

/**
 * Resolve a module that must be eagerly loaded (for dynamic routes).
 */
function resolveEagerModule(
  routeId: string,
  mod: RouteModule,
): EagerRouteModule {
  if (typeof mod === "function") {
    throw new Error(
      `Dynamic route "${routeId}" requires eager modules. Use import.meta.glob with { eager: true }`,
    );
  }
  return mod;
}
