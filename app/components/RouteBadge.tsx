// A route the way TTC signs show it: a coloured bullet for subway lines, a red
// box for bus and streetcar routes, and blue with a moon for night routes.

import { isNightRoute, routeLabel, SUBWAY_COLORS, type Mode } from "~/lib/lines";
import { MoonIcon } from "./icons";

export function RouteBadge({ mode, route, name }: { mode: Mode; route: string; name?: string }) {
  const label = name ? routeLabel(name) : "";

  if (mode === "subway") {
    const color = SUBWAY_COLORS[route] ?? { background: "#000", text: "#fff" };
    return (
      <span className="route">
        <span className="route-bullet" style={{ background: color.background, color: color.text }}>
          {route}
        </span>
        {label && <span className="route-name">{label}</span>}
      </span>
    );
  }

  const night = isNightRoute(route);
  return (
    <span className="route">
      <span className={night ? "route-number night" : "route-number"}>
        {night && <MoonIcon className="route-moon" />}
        {route}
      </span>
      {label && <span className="route-name">{label}</span>}
    </span>
  );
}
