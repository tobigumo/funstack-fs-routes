# funstack-fs-routes

File-based routing package for [FUNSTACK Static](https://github.com/uhyo/funstack-static) ([website](https://static.funstack.work)). Takes a module map from Vite's [Glob Import](https://vite.dev/guide/features.html#glob-import) and automatically generates `EntryDefinition` entries based on file naming conventions.

## Install

```bash
npm install github:tobigumo/funstack-fs-routes
```

## Usage

```tsx
// src/entries.tsx
import { fsRoutes } from "funstack-fs-routes";

const modules = import.meta.glob("./routes/**/*.tsx", { eager: true });

export default function getEntries() {
  return fsRoutes({
    root: () => import("./root"),
    modules,
  });
}
```

## File Naming Convention

Based on [React Router's fs-routes](https://github.com/remix-run/react-router/tree/main/packages/react-router-fs-routes) conventions.

| File                  | Output Path                        |
| --------------------- | ---------------------------------- |
| `_index.tsx`          | `index.html`                       |
| `about.tsx`           | `about/index.html`                 |
| `blog.first-post.tsx` | `blog/first-post/index.html`       |
| `blog.$slug.tsx`      | `blog/{slug}/index.html` (dynamic) |
| `blog._index.tsx`     | `blog/index.html`                  |
| `blog/route.tsx`      | `blog/index.html`                  |

### Rules

- `.` acts as a path separator — `blog.first-post.tsx` → `/blog/first-post/`
- `$param` marks a dynamic segment — `blog.$slug.tsx` → `/blog/:slug/`
- `_index` marks an index route
- `_` prefix (except `_index`) marks a private module (excluded from routing)
- `[chars]` escapes characters — `sitemap[.]xml.tsx` → `sitemap.xml`
- `route.tsx` inside a folder acts as that folder's route

## Dynamic Routes

Dynamic routes must export a `getStaticPaths` function to specify the paths to generate at build time.

```tsx
// src/routes/blog.$slug.tsx
import type { GetStaticPaths } from "funstack-fs-routes";

export const getStaticPaths: GetStaticPaths = () => [
  { slug: "hello-world" },
  { slug: "second-post" },
];

export default function BlogPost({ params }: { params: { slug: string } }) {
  return <h1>Blog: {params.slug}</h1>;
}
```

Dynamic routes require `import.meta.glob` to be called with `{ eager: true }`.

## Options

```ts
fsRoutes({
  // (required) Root component
  root: () => import("./root"),

  // (required) Result of import.meta.glob
  modules: import.meta.glob("./routes/**/*.tsx", { eager: true }),

  // Prefix to strip from glob keys (default: auto-detected)
  prefix: "./routes/",

  // File extensions to consider (default: [".tsx", ".ts", ".jsx", ".js"])
  extensions: [".tsx", ".ts", ".jsx", ".js"],

  // Output path style (default: "directory")
  // "directory": about.tsx → about/index.html
  // "flat":      about.tsx → about.html
  outputStyle: "directory",
});
```

## License

MIT
