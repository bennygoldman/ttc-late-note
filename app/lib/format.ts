// Small formatting helpers shared by pages and server code.

export const TORONTO = "America/Toronto";

// 'KING AND PARLIAMENT' -> 'King and Parliament', 'MCCOWAN' -> 'McCowan'
export function titleCase(text: string) {
  const small = new Set(["and", "at", "of", "to", "the", "via"]);
  const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);
  return text.toLowerCase().replace(/[a-z0-9']+/g, (word, offset) => {
    if (offset > 0 && small.has(word)) return word;
    if (/^mc[a-z]/.test(word)) return "Mc" + capitalize(word.slice(2));
    return capitalize(word);
  });
}

// '2026-09-15' -> 'September 15, 2026'
export function formatDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// '17:30' -> '5:30 p.m.'
export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "a.m." : "p.m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

// A UTC timestamp -> Toronto date and time: { date: 'YYYY-MM-DD', time: 'HH:MM' }
export function torontoDateTime(isoTimestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoTimestamp));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// Today's date in Toronto, 'YYYY-MM-DD'
export function torontoToday() {
  return torontoDateTime(new Date().toISOString()).date;
}
