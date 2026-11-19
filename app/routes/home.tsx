import { env } from "cloudflare:workers";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { RouteBadge } from "~/components/RouteBadge";
import { formatDate, formatTime } from "~/lib/format";
import { latestDelay } from "~/server/incidents";

export function meta() {
  return [
    { title: "TTC Late Note" },
    { name: "description", content: "Late because of the TTC? Get a signed apology for whoever you kept waiting." },
  ];
}

export async function loader() {
  return { latest: await latestDelay(env.DB) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { latest } = loaderData;

  return (
    <main className="page">
      <h1 className="hero">Late because of the TTC?</h1>
      <p className="lead">
        Tell us which day and which line. We'll find the delay in the TTC's own records and write a signed apology
        to whoever you kept waiting.
      </p>

      <Link to="/new" className="button">
        Request a late note
      </Link>

      {latest && (
        <p className="latest">
          Most recent delay on file: {formatDate(latest.date)}, {formatTime(latest.time)},{" "}
          <RouteBadge mode={latest.mode} route={latest.route} name={latest.lineName} /> {latest.mode} near{" "}
          {latest.location}. {latest.minutes} minutes, {latest.cause}.
        </p>
      )}
    </main>
  );
}
