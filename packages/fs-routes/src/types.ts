import type { ComponentType, ReactNode } from "react";

type MaybePromise<T> = T | Promise<T>;
type RootModule = { default: ComponentType<{ children: ReactNode }> };
type AppModule = { default: ComponentType };

export const DEFAULT_EXTENSIONS: readonly string[] = [".tsx", ".ts", ".jsx", ".js"];

/** Eagerly loaded route module from import.meta.glob with { eager: true } */
export interface EagerRouteModule {
  readonly default: ComponentType<any>;
  readonly getStaticPaths?: GetStaticPaths;
}

/** Lazily loaded route module from import.meta.glob */
export type LazyRouteModule = () => Promise<EagerRouteModule>;

export type RouteModule = EagerRouteModule | LazyRouteModule;

/**
 * EntryDefinition compatible with @funstack/static/entries.
 * Defined here to avoid a hard dependency on @funstack/static.
 */
export interface EntryDefinition {
  readonly path: string;
  readonly root: MaybePromise<RootModule> | (() => MaybePromise<RootModule>);
  readonly app: ReactNode | MaybePromise<AppModule> | (() => MaybePromise<AppModule>);
}

export interface FsRoutesOptions {
  /** Root component — shared across all entries */
  readonly root: MaybePromise<RootModule> | (() => MaybePromise<RootModule>);
  /**
   * Module map from import.meta.glob.
   * Keys are relative paths like "./routes/about.tsx".
   *
   * - Eager: import.meta.glob("./routes/**\/*.tsx", { eager: true })
   * - Lazy: import.meta.glob("./routes/**\/*.tsx")
   */
  readonly modules: Record<string, RouteModule>;
  /**
   * Prefix to strip from glob keys to derive route IDs.
   * @default auto-detected from the common directory prefix of all keys
   *
   * @example "./routes/" — strips "./routes/" from "./routes/about.tsx" → "about"
   */
  readonly prefix?: string;
  /** File extensions to consider (default: [".tsx", ".ts", ".jsx", ".js"]) */
  readonly extensions?: readonly string[];
  /**
   * Output path style:
   * - "directory" (default): about.tsx → about/index.html
   * - "flat": about.tsx → about.html
   */
  readonly outputStyle?: "directory" | "flat";
}

/** Return type for getStaticPaths in dynamic route modules */
export type GetStaticPaths = () =>
  | Record<string, string>[]
  | Promise<Record<string, string>[]>;

/** Result of parsing a route ID */
export interface ParsedRoute {
  /** Path segments (e.g., ["blog", "first-post"]) */
  readonly segments: readonly string[];
  /** Dynamic parameter names (e.g., ["slug"]) — empty for static routes */
  readonly params: readonly string[];
  /** Whether this is an index route */
  readonly isIndex: boolean;
}

/** A scanned route file */
export interface ScannedRoute {
  /** Absolute file path */
  readonly filePath: string;
  /** Route ID: relative path from routesDir without extension */
  readonly routeId: string;
  /** Parsed route information */
  readonly parsed: ParsedRoute;
}
