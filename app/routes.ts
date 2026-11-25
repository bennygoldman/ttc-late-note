import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("new", "routes/new.tsx"),
  route("n/:id", "routes/note.tsx"),
  route("status", "routes/status.tsx"),
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
