import { readdirSync, statSync } from "node:fs";
import { join, parse, relative } from "node:path";
import { parseRouteId } from "./convention.js";
import { DEFAULT_EXTENSIONS, type ScannedRoute } from "./types.js";

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * Scan a routes directory and return all valid route files.
 *
 * Supports two conventions:
 * - Flat files: routes/about.tsx, routes/blog.first-post.tsx
 * - Folder routes: routes/about/route.tsx
 *
 * Files starting with "_" (except "_index") are ignored as private modules.
 * Collision detection: throws if multiple files resolve to the same output path.
 */
export function scanRoutesDir(
  routesDir: string,
  extensions: readonly string[] = DEFAULT_EXTENSIONS,
): ScannedRoute[] {
  const routes: ScannedRoute[] = [];
  const extensionSet = new Set(extensions);

  walkDir(routesDir, routesDir, extensionSet, routes);

  return routes;
}

function walkDir(
  dir: string,
  routesDir: string,
  extensions: Set<string>,
  routes: ScannedRoute[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (error: unknown) {
    if (dir === routesDir) {
      throw new Error(
        `Cannot read routes directory "${routesDir}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // During recursion, only ignore ENOENT (race condition / stale entry)
    if (isEnoent(error)) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch (error: unknown) {
      if (isEnoent(error)) {
        continue;
      }
      throw error;
    }

    if (stat.isDirectory()) {
      // Skip directories starting with "_" (except for potential _index inside)
      if (entry.startsWith("_") && entry !== "_index") {
        continue;
      }
      walkDir(fullPath, routesDir, extensions, routes);
    } else if (stat.isFile()) {
      const { ext, name } = parse(entry);
      if (!extensions.has(ext)) {
        continue;
      }

      // Build routeId from relative path without extension
      const relPath = relative(routesDir, fullPath).replace(/\\/g, "/");
      const routeId = relPath.slice(0, relPath.length - ext.length);

      const parsed = parseRouteId(routeId);
      if (parsed === null) {
        // Private module, skip
        continue;
      }

      routes.push({
        filePath: fullPath,
        routeId,
        parsed,
      });
    }
  }
}
