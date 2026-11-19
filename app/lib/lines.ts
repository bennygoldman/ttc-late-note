// The two data sources name lines differently, so we reduce both to a route
// number ('1', '504', '54') to match them up.
//   Official logs: 'YU', 'BD', 'SHP', '504 KING', '54 LAWRENCE EAST'
//   Live alerts:   '1', '504', '59B'

import { titleCase } from "./format";

export type Mode = "subway" | "streetcar" | "bus";
export const MODES: Mode[] = ["subway", "streetcar", "bus"];

const SUBWAY_CODES: Record<string, string> = { YU: "1", BD: "2", SHP: "4" };

export const SUBWAY_NAMES: Record<string, string> = {
  "1": "Line 1 Yonge-University",
  "2": "Line 2 Bloor-Danforth",
  "4": "Line 4 Sheppard",
  "5": "Line 5 Eglinton",
  "6": "Line 6 Finch West",
};

// Route number for an official-log line. Some subway rows name two lines
// ('YU/BD'); we file those under the first.
export function routeFromDelayLine(mode: Mode, line: string) {
  if (mode === "subway") {
    const code = line.split("/")[0].trim();
    return SUBWAY_CODES[code] ?? null;
  }
  return line.match(/^\d+/)?.[0] ?? null;
}

// Route number for a live-alert route: '59B' -> '59'
export function routeFromAlertRoute(route: string) {
  return route.match(/^\d+/)?.[0] ?? null;
}

// A display name: 'Line 1 Yonge-University', '504 King', or 'Route 59'.
// `hint` is any text that might hold the name, like '504 KING' or an alert's
// '59B Maple Leaf: Detour via...'.
export function lineName(mode: Mode, route: string, hint = "") {
  if (mode === "subway") return SUBWAY_NAMES[route] ?? `Line ${route}`;

  const name = hint.split(":")[0].replace(/^\d+[A-Z]?\s*/, "").trim();
  return name && name.length < 40 ? `${route} ${titleCase(name)}` : `Route ${route}`;
}
