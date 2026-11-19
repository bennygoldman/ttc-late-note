// Turns the TTC's internal cause descriptions into plain English for the letter,
// e.g. 'TTC COLLISION – PROPERTY DAMAGE' -> 'a collision'.
// The first matching rule wins, so put specific rules before general ones.

const RULES: [RegExp, string][] = [
  [/SUSPICIOUS PACKAGE|BOMB/, "a suspicious package"],
  [/ASSAULT|ASSUALT|ROBBERY/, "a security incident"],
  [/DISORDERLY/, "a disorderly passenger"],
  [/POLICE/, "a police investigation"],
  [/UNAUTHORIZED AT TRACK/, "a person on the tracks"],
  [/INJUR|ILL CUSTOMER|MEDICAL/, "a passenger in need of medical attention"],
  [/ILL OPERATOR/, "an operator falling ill"],
  [/COLLISION/, "a collision"],
  [/FIRE|SMOKE/, "a fire or smoke"],
  [/WEATHER|FORCE MAJEURE/, "the weather"],
  [/NO OPERATOR|NO COLLECTOR|CREW/, "a staffing shortage"],
  [/DIVERSION/, "a diversion"],
  [/SHUTTLE/, "the vehicle being reassigned as a shuttle"],
  [/UNSANITARY/, "an unsanitary vehicle"],
  [/DOOR/, "a door problem"],
  [/SIGNAL|ATC|SWITCH/, "a signal problem"],
  [/HEAT|VENT|AIR CONDITIONING|HVAC/, "a heating or cooling problem"],
  [/SCHEDULE|LATE/, "trouble keeping to the schedule"],
  [/CLOSURE/, "a service closure"],
  [/CONSTRUCTION|ENGINEERING/, "construction"],
  [/ESCL|ELEV|STAIRWAY/, "an escalator or elevator incident"],
];

// Fallbacks by the first letter of the official code.
const CATEGORIES: Record<string, string> = {
  E: "a mechanical problem",
  M: "an incident on board",
  P: "an infrastructure problem",
  S: "a security incident",
  T: "an operational issue",
};

const FALLBACK = "circumstances beyond our control";

export function causeFromDelay(code: string, description: string | null) {
  const text = (description ?? "").toUpperCase();
  for (const [pattern, phrase] of RULES) {
    if (pattern.test(text)) return phrase;
  }
  return CATEGORIES[code[0]] ?? FALLBACK;
}

// Live alerts use the standard GTFS cause values.
const ALERT_CAUSES: Record<string, string> = {
  ACCIDENT: "a collision",
  CONSTRUCTION: "construction",
  MAINTENANCE: "maintenance work",
  TECHNICAL_PROBLEM: "a technical problem",
  MEDICAL_EMERGENCY: "a medical emergency",
  POLICE_ACTIVITY: "police activity",
  WEATHER: "the weather",
  STRIKE: "a labour disruption",
  DEMONSTRATION: "a demonstration",
  HOLIDAY: "holiday service changes",
};

export function causeFromAlert(cause: string) {
  return ALERT_CAUSES[cause] ?? FALLBACK;
}
