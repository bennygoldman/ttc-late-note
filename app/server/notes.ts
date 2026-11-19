import type { Incident } from "./incidents";

export type Note = {
  id: string;
  created_at: string;
  from_name: string;
  to_name: string;
  event: string;
  source: "delay" | "alert";
  mode: string;
  date: string;
  time: string;
  line_name: string;
  location: string;
  cause: string;
  cause_official: string;
  minutes: number | null;
  details: string;
};

export async function createNote(
  db: D1Database,
  people: { fromName: string; toName: string; event: string },
  incident: Incident,
) {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO notes (
         id, created_at, from_name, to_name, event,
         source, source_id, mode, date, time, line_name, location,
         cause, cause_official, minutes, details
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      new Date().toISOString(),
      people.fromName,
      people.toName,
      people.event,
      incident.source,
      incident.sourceId,
      incident.mode,
      incident.date,
      incident.time,
      incident.lineName,
      incident.location,
      incident.cause,
      incident.causeOfficial,
      incident.minutes,
      incident.details,
    )
    .run();
  return id;
}

export function getNote(db: D1Database, id: string) {
  return db.prepare(`SELECT * FROM notes WHERE id = ?`).bind(id).first<Note>();
}

// 8 characters from an alphabet without look-alikes (no 0/o, 1/l/i).
function newId() {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
