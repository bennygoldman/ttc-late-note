import { env } from "cloudflare:workers";
import type { Route } from "./+types/status";

export function meta() {
  return [{ title: "Data status · TTC Late Note" }];
}

// Shows what data has been loaded. Handy for checking the scheduled jobs.
export async function loader() {
  const { results: delays } = await env.DB.prepare(
    `SELECT mode, COUNT(*) AS rows, MIN(date) AS first_day, MAX(date) AS last_day
     FROM delays GROUP BY mode ORDER BY mode`,
  ).all<{ mode: string; rows: number; first_day: string; last_day: string }>();

  const alerts = await env.DB.prepare(
    `SELECT COUNT(*) AS rows, MIN(first_seen) AS first_seen, MAX(last_seen) AS last_seen FROM alerts`,
  ).first<{ rows: number; first_seen: string | null; last_seen: string | null }>();

  return { delays, alerts };
}

export default function Status({ loaderData }: Route.ComponentProps) {
  const { delays, alerts } = loaderData;
  return (
    <main className="page">
      <h1>Data status</h1>
      <h2>Official delay logs</h2>
      <ul>
        {delays.map((d) => (
          <li key={d.mode}>
            {d.mode}: {d.rows} delays, {d.first_day} to {d.last_day}
          </li>
        ))}
      </ul>
      <h2>Live alerts recorded</h2>
      <p>
        {alerts?.rows ?? 0} alerts, seen between {alerts?.first_seen ?? "–"} and {alerts?.last_seen ?? "–"}
      </p>
    </main>
  );
}
