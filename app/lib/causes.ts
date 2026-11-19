// Turns the TTC's cause descriptions into plain English for the letter,
// e.g. 'TTC COLLISION – PROPERTY DAMAGE' -> 'a collision'.
//
// Rules are checked in order and the first match wins, so specific rules go
// before general ones. Where a rule has several phrasings, one is picked from
// the incident's id, so the same delay is always described the same way and
// common vague causes ('OTHER') don't all read identically.

type Phrase = string | string[];

const RULES: [RegExp, Phrase][] = [
  // Security
  [/SUSPICIOUS PACKAGE|BOMB/, "a suspicious package"],
  [/ASSAULT|ASSUALT|ROBBERY|SECURITY INCIDENT/, "a security incident"],
  [/DISORDERLY/, ["a disorderly passenger", "an unruly passenger"]],
  [/POLICE|\bTPS\b/, "a police investigation"],
  [/UNAUTHORIZED AT TRACK|PERSON ON TRACK/, "a person on the tracks"],
  [/GRAFFITI|SCRATCHITI/, "graffiti"],

  // Ahead of the people rules, since these descriptions also mention injuries
  [/COLLISION/, "a collision"],
  [/ESCL|ELEV|STAIRWAY/, "an escalator or elevator incident"],

  // Alarms and false alarms
  [/PAA.*NO TROUBLE|ALARM.*NO TROUBLE/, "a passenger alarm that turned out to be nothing"],
  [/EQUIPMENT.*NO TROUBLE/, "an equipment fault"],

  // People
  [/MEDICAL AID REFUSED|TRANSPORTATION DECLINED|MEDICAL AID DECLINED/, "a sick passenger who refused help"],
  [/ILL OPERATOR/, "an operator falling ill"],
  [/INJURED EMPLOYEE/, "an injured employee"],
  [/INJUR|ILL CUSTOMER|MEDICAL/, "a medical emergency"],

  // On the street
  [/AUTO FOUL RAIL/, "a car blocking the tracks"],
  [/BLOCKED TRACK/, "a blocked track"],
  [/BLOCKED ROAD/, "a blocked road"],
  [/TRAPPED VEHICLE/, "a vehicle stuck in traffic"],
  [/TRAF|CONGES/, "traffic"],
  [/FIRE|SMOKE/, "a fire or smoke"],
  [/WEATHER|FORCE MAJEURE/, "the weather"],
  [/CONSTRUCTION|ENGINEERING/, "construction"],
  [/TRACK WORK/, "track work"],
  [/TRACK ISSUE/, "a track problem"],

  // Operations
  [/NO OPERATOR|NO COLLECTOR|CREW/, ["a staffing shortage", "a missing operator"]],
  [/DIVERSION/, "a diversion"],
  [/SHUTTLE/, "a replacement shuttle"],
  [/SWITCH VIOLATION|VIOLATED SWITCH/, "a switching error"],
  [/VIOLATED SIGNAL|OVERSHOT|OVERSPEED/, "an operator error"],
  [/SCHEDULE|LATE ENTERING|LATE VEHICLE/, "trouble keeping to the schedule"],
  [/CLOSURE/, "a service closure"],

  // The vehicle
  [/UNSANITARY/, ["an unsanitary vehicle", "a dirty vehicle"]],
  [/DOOR/, "a door problem"],
  [/RAMP/, "a ramp problem"],
  [/BRAKE/, "a brake problem"],
  [/PROPULSION|TRACTION|MOTOR/, "a propulsion problem"],
  [/HEAT|VENT|AIR CONDITIONING|HVAC/, "a heating or cooling problem"],
  [/WINDSHIELD|WIPER/, "a windshield wiper problem"],
  [/LIGHTING/, "a lighting problem"],
  [/COMMUNICATION|RADIO/, "a communications problem"],
  [/VEHICLE CONTROLS/, "a controls problem"],
  [/\bBODY\b/, "damage to the vehicle"],

  // Signals, track and stations
  [/\bSIGNAL|\bATC\b|SPEED CONTROL/, "a signal problem"],
  [/PLANT/, "an infrastructure problem"],
];

// When nothing above matches, describe it by the first letter of the code,
// which is its category. These are deliberately vague, the way the records are.
const CATEGORIES: Record<string, string[]> = {
  E: ["a mechanical problem", "an equipment problem", "an unknown mechanical problem"],
  M: ["a miscellaneous problem", "an unspecified incident", "an unknown problem"],
  P: ["an infrastructure problem"],
  S: ["a security incident", "a security matter"],
  T: ["an operational issue", "an unspecified issue"],
};

const FALLBACK = ["unknown causes", "circumstances beyond our control"];

// Some codes in the delay logs aren't in the City's code lists, but the same
// code exists for another mode (e.g. bus 'EFLT' and streetcar 'ETLT', lighting).
// The second letter is the mode, so we compare the rest.
const SIBLING_DESCRIPTIONS: Record<string, string> = {
  AFR: "AUTO FOUL RAIL",
  CE: "COMMUNICATION EQUIPMENT",
  GD: "MISCELLANEOUS GENERAL DELAY",
  IE: "INJURED EMPLOYEES",
  LT: "LIGHTING",
  SH: "USED AS SHUTTLE",
  VC: "VEHICLE CONTROLS",
  WA: "WARNING / ALARM SYSTEMS",
  WS: "WINDSHIELD / WIPERS",
};

export function causeFromDelay(code: string, description: string | null, seed: string) {
  const text = (description ?? SIBLING_DESCRIPTIONS[code.slice(2)] ?? "").toUpperCase();
  return matchRules(text, seed) ?? pick(CATEGORIES[code[0]] ?? FALLBACK, seed);
}

// Live alerts carry a short note ('Blocked track', 'TPS investigation') and a
// standard GTFS cause ('ACCIDENT', 'MEDICAL_EMERGENCY'). The note is more specific.
const ALERT_CAUSES: Record<string, Phrase> = {
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

export function causeFromAlert(cause: string, note: string, seed: string) {
  return matchRules(note.toUpperCase(), seed) ?? pick(ALERT_CAUSES[cause] ?? FALLBACK, seed);
}

// --- Helpers ---

function matchRules(text: string, seed: string) {
  if (!text) return null;
  const rule = RULES.find(([pattern]) => pattern.test(text));
  return rule ? pick(rule[1], seed) : null;
}

function pick(phrase: Phrase, seed: string) {
  if (typeof phrase === "string") return phrase;
  return phrase[hash(seed) % phrase.length];
}

// A small, stable string hash (FNV-1a).
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
