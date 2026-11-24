// The letter. This is the page people share.

import { env } from "cloudflare:workers";
import { data, Link } from "react-router";
import type { Route } from "./+types/note";
import { formatDate, formatTime, torontoDateTime } from "~/lib/format";
import { getNote } from "~/server/notes";
import { CopyLink } from "~/components/CopyLink";
import { TtcLogo } from "~/components/icons";
import { RouteBadge } from "~/components/RouteBadge";
import type { Mode } from "~/lib/lines";

export async function loader({ params, request }: Route.LoaderArgs) {
  const note = await getNote(env.DB, params.id);
  if (!note) throw data(null, { status: 404 });

  const url = new URL(request.url);
  return { note, isNew: url.searchParams.has("new"), shareUrl: `${url.origin}/n/${note.id}` };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Note not found · TTC Late Note" }];
  const { note } = loaderData;
  const title = `A note regarding ${note.from_name}'s lateness`;
  const description = `An apology to ${note.to_name}, from the Late Note Division.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
}

export default function NotePage({ loaderData }: Route.ComponentProps) {
  const { note, isNew, shareUrl } = loaderData;

  return (
    <main className="page">
      {isNew && (
        <section className="card share">
          <h1>Your note is ready.</h1>
          <p>Send this link to {note.to_name}:</p>
          <CopyLink url={shareUrl} />
        </section>
      )}

      <Letter note={note} />

      <p className="center">
        <Link to="/new">{isNew ? "Make another note" : "Late too? Get your own note"}</Link>
      </p>
    </main>
  );
}

function Letter({ note }: { note: Route.ComponentProps["loaderData"]["note"] }) {
  const written = formatDate(torontoDateTime(note.created_at).date);
  const mode = note.mode as Mode;
  const lateParty = (
    <Field label="late party" handwritten>
      {note.from_name}
    </Field>
  );

  return (
    <article className="paper letter">
      <header className="letterhead">
        <TtcLogo className="letterhead-logo" />
        <div className="letterhead-address">
          <p>Late Note Division</p>
          <p>1900 Yonge Street</p>
          <p>Toronto, Ontario M4S 1Z2</p>
        </div>
      </header>

      <div className="letter-meta">
        <p>
          <Field label="file no.">LN-{note.id.toUpperCase()}</Field>
        </p>
        <p>
          <Field label="date issued">{written}</Field>
        </p>
      </div>

      <p className="letter-re">
        Re: Lateness of {lateParty} to{" "}
        <Field label="occasion" handwritten>
          {note.event}
        </Field>
      </p>

      <p>
        Dear{" "}
        <Field label="recipient" handwritten after=",">
          {note.to_name}
        </Field>
      </p>

      <p>Please accept the sincere apologies of the TTC.</p>

      <p>
        Our records show that on{" "}
        <Field label="date" after={note.time ? "" : ","}>
          {formatDate(note.date)}
        </Field>
        {note.time && (
          <>
            {" "}
            at{" "}
            <Field label="time" after=",">
              {formatTime(note.time)}
            </Field>
          </>
        )}{" "}
        <Field label="route">
          <RouteBadge mode={mode} route={note.route} name={note.line_name} />
        </Field>{" "}
        {note.source === "delay" ? (
          <>
            <Field label="vehicle">{mode}</Field> service near <Field label="location">{note.location}</Field> was
            delayed{" "}
            <Field label="length of delay">
              <Struck>{note.minutes} minutes</Struck>
            </Field>
          </>
        ) : (
          <>
            service <Field label="nature of disruption">{note.effect}</Field>
            {note.location && (
              <>
                {" "}
                <Field label="affected section">{note.location}</Field>
              </>
            )}
            {note.minutes ? (
              <>
                {" "}
                for{" "}
                <Field label="approx. duration">
                  <Struck>about {note.minutes} minutes</Struck>
                </Field>
              </>
            ) : null}
          </>
        )}{" "}
        due to{" "}
        <Field label="reason for delay" after=".">
          <Struck>{note.cause}</Struck>
        </Field>
      </p>

      <p>
        {lateParty} left on time and put their faith in public transit. That faith was, regrettably, misplaced.
      </p>

      <p>We hope you can forgive them. If anyone is to blame, it is us.</p>

      <div className="signoff">
        <p>Sincerely,</p>
        <p className="signature" aria-hidden="true">
          A. Pology
        </p>
        <p>
          A. Pology
          <br />
          Director, Late Note Division
        </p>
        <Stamp date={written} />
      </div>

      <footer className="letter-footnote">
        <p>
          Official cause, per the {note.source === "delay" ? "TTC delay log" : "TTC service alert"}:{" "}
          <Field label="verbatim">“{note.cause_official}”</Field>
        </p>
        <p>
          We can confirm the delay happened. We can't confirm <Field label="late party">{note.from_name}</Field> was on
          board. Forgive accordingly.
        </p>
        <p className="form-code">Form LN-1</p>
      </footer>
    </article>
  );
}

// Typed twice over, the way typists made a word darker: here, the facts the apology rests on.
function Struck({ children }: { children: React.ReactNode }) {
  return <span className="struck">{children}</span>;
}

// A filled-in blank, as on a printed form: the value on a rule, with a small
// caption under it saying what goes there. Handwritten for what the person
// supplied, typed for what came from the records. `after` is punctuation that
// must stay on the same line as the blank.
function Field({
  label,
  handwritten,
  after,
  children,
}: {
  label: string;
  handwritten?: boolean;
  after?: string;
  children: React.ReactNode;
}) {
  const field = (
    <span className={handwritten ? "filled handwritten" : "filled"}>
      <span className="filled-value">{children}</span>
      <span className="filled-caption">({label})</span>
    </span>
  );
  if (!after) return field;
  return (
    <span className="nowrap">
      {field}
      {after}
    </span>
  );
}

function Stamp({ date }: { date: string }) {
  return (
    <div className="stamp" aria-label={`Stamped excused, ${date}`}>
      <span className="stamp-big">Excused</span>
      <span className="stamp-small">Late Note Division · {date}</span>
    </div>
  );
}
