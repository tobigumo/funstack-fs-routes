import type { ParsedRoute } from "./types.js";

const enum State {
  Normal,
  Escape,
}

/**
 * Parse a route ID (relative path without extension) into segments and params.
 *
 * Rules:
 * - "." in the route ID acts as a path separator
 * - "_index" marks an index route
 * - "$param" marks a dynamic parameter segment
 * - "[chars]" escapes characters (e.g., "[.]" becomes a literal ".")
 * - Segments starting with "_" (except "_index") are private and should be skipped
 *
 * Directory-style route IDs use "/" as separator (from nested folders).
 * "route" as the last segment in a directory is treated as the directory's route.
 */
export function parseRouteId(routeId: string): ParsedRoute | null {
  // Normalize directory separators to dots for uniform processing
  const normalized = routeId.replace(/\//g, ".");

  const rawSegments = splitSegments(normalized);

  // Filter out "route" if it's the last segment (folder/route.tsx convention)
  const segments: string[] = [];
  const params: string[] = [];
  let isIndex = false;

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];

    // "route" as last segment → treat as the folder's route (skip it)
    if (seg === "route" && i === rawSegments.length - 1) {
      continue;
    }

    // "_index" → index route (don't add as a path segment)
    if (seg === "_index") {
      isIndex = true;
      continue;
    }

    // Segments starting with "_" (private modules) → skip entire route
    if (seg.startsWith("_")) {
      return null;
    }

    // "$param" → dynamic segment
    if (seg.startsWith("$")) {
      const paramName = seg.slice(1);
      if (paramName.length === 0) {
        throw new Error(`Invalid dynamic segment in route "${routeId}": empty parameter name`);
      }
      params.push(paramName);
      segments.push(seg);
      continue;
    }

    segments.push(seg);
  }

  // If no explicit _index and no segments, it's also an index
  if (segments.length === 0 && !isIndex) {
    isIndex = true;
  }

  return { segments, params, isIndex };
}

/**
 * Split a normalized route ID into segments, respecting escape brackets.
 * "." acts as segment separator, "[chars]" escapes characters.
 */
function splitSegments(input: string): string[] {
  const segments: string[] = [];
  let current = "";
  let state: State = State.Normal;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;

    switch (state) {
      case State.Normal:
        if (char === ".") {
          if (current.length > 0) {
            segments.push(current);
          }
          current = "";
        } else if (char === "[") {
          state = State.Escape;
        } else {
          current += char;
        }
        break;

      case State.Escape:
        if (char === "]") {
          state = State.Normal;
        } else {
          current += char;
        }
        break;
    }
  }

  if (state === State.Escape) {
    throw new Error(
      `Unclosed "[" in route segment: "${input}"`,
    );
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

/**
 * Convert a ParsedRoute to an output HTML path.
 *
 * @param parsed - The parsed route
 * @param style - "directory" produces "about/index.html", "flat" produces "about.html"
 * @param params - For dynamic routes, the parameter values to substitute
 */
export function toOutputPath(
  parsed: ParsedRoute,
  style: "directory" | "flat",
  params?: Record<string, string>,
): string {
  const resolvedSegments = parsed.segments.map((seg) => {
    if (seg.startsWith("$")) {
      const paramName = seg.slice(1);
      const value = params?.[paramName];
      if (value == null) {
        throw new Error(`Missing parameter value for "${paramName}"`);
      }
      return value;
    }
    return seg;
  });

  if (resolvedSegments.length === 0 || parsed.isIndex) {
    // Index route
    const prefix = resolvedSegments.join("/");
    if (prefix) {
      return `${prefix}/index.html`;
    }
    return "index.html";
  }

  if (style === "flat") {
    return `${resolvedSegments.join("/")}.html`;
  }

  // directory style
  return `${resolvedSegments.join("/")}/index.html`;
}
