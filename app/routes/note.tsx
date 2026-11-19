// The letter. This is the page people share.

import { env } from "cloudflare:workers";
import { data, Link } from "react-router";
import type { Route } from "./+types/note";
import { formatDate, formatTime, torontoDateTime } from "~/lib/format";
import { getNote } from "~/server/notes";
import { CopyLink } from "~/components/CopyLink";

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
  const description = `An official apology to ${note.to_name}, from the Late Note Division.`;
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
  const from = <Filled>{note.from_name}</Filled>;

  return (
    <article className="letter">
      <header className="letterhead">
        <p className="letterhead-name">Tardy Toronto Collective</p>
        <p>Late Note Division</p>
      </header>

      <p className="letter-date">{written}</p>

      <p>
        Dear <Filled>{note.to_name}</Filled>,
      </p>

      <p>
        Please accept our sincere apologies for making {from} late for <Filled>{note.event}</Filled>.
      </p>

      {note.source === "delay" ? (
        <p>
          Our records show that on {formatDate(note.date)}, at {formatTime(note.time)}, {note.mode} service on{" "}
          {note.line_name} near {note.location} was delayed by {note.minutes} minutes due to {note.cause}.
        </p>
      ) : (
        <p>
          Our records show that on {formatDate(note.date)}, service on {note.line_name} was disrupted due to{" "}
          {note.cause}. Our service alert at the time read: <q>{note.details}</q>
        </p>
      )}

      <p>
        {from} did everything right. They left on time and put their faith in public transit. That faith was,
        regrettably, misplaced.
      </p>

      <p>We hope you can find it in your heart to forgive them. If anyone is to blame, it is us.</p>

      <p className="signoff">Sincerely,</p>
      <p className="signature" aria-hidden="true">
        A. Pology
      </p>
      <p>
        A. Pology
        <br />
        Director, Late Note Division
        <br />
        Tardy Toronto Collective
      </p>

      <footer className="letter-footnote">
        <p>
          Reference: {note.source === "delay" ? "TTC delay log" : "TTC service alert"} · Official cause: “
          {note.cause_official}”
        </p>
        <p>
          P.S. This note is based on public TTC records. We can confirm the delay happened. We can't confirm{" "}
          {note.from_name} was on board. Forgive accordingly.
        </p>
      </footer>
    </article>
  );
}

// Text the person filled in, shown in handwriting as if on a form letter.
function Filled({ children }: { children: React.ReactNode }) {
  return <span className="filled">{children}</span>;
}
