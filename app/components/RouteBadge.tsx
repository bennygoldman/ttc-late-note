// A route the way TTC maps and signs show it: the vehicle, then the route
// number in its badge colour (a round marker for subway lines).

import { routeBadgeStyle, routeLabel, type Mode } from "~/lib/lines";
import { ModeIcon } from "./icons";

export function RouteBadge({ mode, route, name }: { mode: Mode; route: string; name?: string }) {
  const style = routeBadgeStyle(mode, route);
  const label = name ? routeLabel(name) : "";

  return (
    <span className="route">
      <ModeIcon mode={mode} className="route-icon" />
      <span
        className={mode === "subway" ? "route-number line" : "route-number"}
        style={{
          background: style.background ?? "transparent",
          color: style.color,
          boxShadow: style.border ? `inset 0 0 0 1.5px ${style.border}` : undefined,
        }}
      >
        {route}
      </span>
      {label && <span className="route-name">{label}</span>}
    </span>
  );
}
