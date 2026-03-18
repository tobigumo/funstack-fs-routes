import { fsRoutes, type EagerRouteModule } from "funstack-fs-routes";

const modules = import.meta.glob<EagerRouteModule>("./routes/**/*.tsx", { eager: true });

export default function getEntries() {
  return fsRoutes({
    root: () => import("./root"),
    modules,
  });
}
