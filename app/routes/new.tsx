// Making a note, on one page. Each choice is in the URL (?date=&mode=&line=),
// so the page shows more as you fill it in, and works without JavaScript.

import { env } from "cloudflare:workers";
import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/new";
import { formatDate, torontoToday } from "~/lib/format";
import { MODES, type Mode } from "~/lib/lines";
import { coverage, findIncident, incidentsOn } from "~/server/incidents";
import { createNote } from "~/server/notes";

export function meta() {
  return [{ title: "Get a late note · TTC Late Note" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : "";
  const mode = MODES.includes(params.get("mode") as Mode) ? (params.get("mode") as Mode) : "";

  const range = await coverage(env.DB);
  const today = torontoToday();

  if (!date || !mode) {
    return { date, mode, line: "", today, range, lines: [], incidents: [] };
  }

  const all = await incidentsOn(env.DB, date, mode);

  // The lines that had at least one incident that day. A route can show up
  // under a few names ('504 King', '504 King Rad Car'); keep the shortest.
  const names = new Map<string, string>();
  for (const i of all) {
    const current = names.get(i.route);
    if (!current || i.lineName.length < current.length) names.set(i.route, i.lineName);
  }
  const lines = [...names.entries()]
    .map(([route, name]) => ({ route, name }))
    .sort((a, b) => Number(a.route) - Number(b.route));

  const line = lines.some((l) => l.route === params.get("line")) ? params.get("line")! : "";
  const incidents = line ? all.filter((i) => i.route === line) : [];

  return { date, mode, line, today, range, lines, incidents };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const text = (name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);

  const people = { fromName: text("fromName", 60), toName: text("toName", 60), event: text("event", 80) };
  if (!people.fromName || !people.toName || !people.event) {
    return { error: "Please fill in all three: your name, their name, and what you were late for." };
  }

  const incident = await findIncident(env.DB, text("incident", 40), text("date", 10));
  if (!incident) {
    return { error: "Please choose the delay that made you late." };
  }

  const id = await createNote(env.DB, people, incident);
  return redirect(`/n/${id}?new=1`);
}

export default function NewNote({ loaderData, actionData }: Route.ComponentProps) {
  const { date, mode, line, today, range, lines, incidents } = loaderData;
  const busy = useNavigation().state !== "idle";

  return (
    <main className="page">
      <h1>What happened?</h1>
      <Coverage range={range} />

      {/* Step 1 and 2: choosing the day, vehicle and line. Changing any of them reloads the page. */}
      <Form method="get" className="card" onChange={(e) => e.currentTarget.requestSubmit()}>
        <label>
          The day it happened
          <input type="date" name="date" defaultValue={date} min={range.delaysFrom ?? undefined} max={today} required />
        </label>

        <fieldset>
          <legend>I was on a</legend>
          <div className="choices">
            {MODES.map((m) => (
              <label key={m} className="choice">
                <input type="radio" name="mode" value={m} defaultChecked={m === mode} required />
                {m}
              </label>
            ))}
          </div>
        </fieldset>

        {date && mode && lines.length > 0 && (
          <label>
            The line
            <select name="line" defaultValue={line} key={`${date}-${mode}`}>
              <option value="">Choose a line…</option>
              {lines.map((l) => (
                <option key={l.route} value={l.route}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <noscript>
          <button type="submit" className="button">
            Next
          </button>
        </noscript>
      </Form>

      {date && mode && lines.length === 0 && (
        <p className="notice">
          We have no record of any {mode} delays on {formatDate(date)}. Without a record, we can't vouch for you.
        </p>
      )}

      {/* Step 3: choosing the incident and writing the note. */}
      {incidents.length > 0 && (
        <Form method="post" className="card">
          <input type="hidden" name="date" value={date} />
          <fieldset>
            <legend>Which one got you?</legend>
            <div className="incidents">
              {incidents.map((i, n) => (
                <label key={i.ref} className="incident">
                  <input type="radio" name="incident" value={i.ref} defaultChecked={n === 0} />
                  <span>
                    {i.summary}
                    <small>{i.source === "delay" ? "Official delay log" : "TTC service alert"}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Your name
            <input name="fromName" maxLength={60} required autoComplete="given-name" />
          </label>
          <label>
            Who you kept waiting
            <input name="toName" maxLength={60} required />
          </label>
          <label>
            What you were late for
            <input name="event" maxLength={80} required placeholder="our dinner reservation" />
          </label>

          {actionData?.error && <p className="error">{actionData.error}</p>}

          <button type="submit" className="button" disabled={busy}>
            {busy ? "Writing…" : "Write my note"}
          </button>
        </Form>
      )}
    </main>
  );
}

function Coverage({ range }: { range: Route.ComponentProps["loaderData"]["range"] }) {
  const sources = [];
  if (range.delaysFrom && range.delaysTo) {
    sources.push(`official delay logs from ${formatDate(range.delaysFrom)} to ${formatDate(range.delaysTo)}`);
  }
  if (range.alertsFrom) {
    sources.push(`live service alerts since ${formatDate(range.alertsFrom)}`);
  }
  if (sources.length === 0) return null;

  return (
    <p className="muted">
      We have the TTC's {sources.join(", and its ")}. The official logs are published about a month after the fact.
    </p>
  );
}
