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
  const route = <RouteBadge mode={mode} route={note.route} name={note.line_name} />;

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
        <p>File no. LN-{note.id.toUpperCase()}</p>
        <p>{written}</p>
      </div>

      <p className="letter-re">
        Re: Lateness of <Blank>{note.from_name}</Blank> to <Blank>{note.event}</Blank>
      </p>

      <p>
        Dear <Blank>{note.to_name}</Blank>,
      </p>

      <p>Please accept the sincere apologies of the TTC.</p>

      {note.source === "delay" ? (
        <p>
          Our records show that on {formatDate(note.date)} at {formatTime(note.time)}, {route} {mode} service near{" "}
          {note.location} was delayed {note.minutes} minutes due to {note.cause}.
        </p>
      ) : (
        <p>
          Our records show that on {formatDate(note.date)}, {route} service was disrupted due to {note.cause}. Our
          service alert at the time read: <q>{note.details}</q>
        </p>
      )}

      <p>
        <Blank>{note.from_name}</Blank> left on time and put their faith in public transit. That faith was,
        regrettably, misplaced.
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
          Official cause, per the {note.source === "delay" ? "TTC delay log" : "TTC service alert"}: “
          {note.cause_official}”
        </p>
        <p>
          We can confirm the delay happened. We can't confirm {note.from_name} was on board. Forgive accordingly.
        </p>
        <p className="form-code">Form LN-1</p>
      </footer>
    </article>
  );
}

// What the person filled in, handwritten into a blank.
function Blank({ children }: { children: React.ReactNode }) {
  return <span className="blank-filled">{children}</span>;
}

function Stamp({ date }: { date: string }) {
  return (
    <div className="stamp" aria-label={`Stamped excused, ${date}`}>
      <span className="stamp-big">Excused</span>
      <span className="stamp-small">Late Note Division · {date}</span>
    </div>
  );
}
