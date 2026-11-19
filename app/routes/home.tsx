import { Link } from "react-router";

export function meta() {
  return [
    { title: "TTC Late Note" },
    { name: "description", content: "Late because of the TTC? Get an official apology for whoever you kept waiting." },
  ];
}

export default function Home() {
  return (
    <main className="page">
      <h1 className="hero">Late because of the TTC?</h1>
      <p className="lead">
        We're sorry. Tell us when and where your trip went wrong, and we'll find the delay in the TTC's own
        records and write an apology to whoever you kept waiting.
      </p>

      <ol className="steps">
        <li>Pick the day and the line you were on.</li>
        <li>Choose the delay that got you.</li>
        <li>Get a signed letter to send with a link.</li>
      </ol>

      <Link to="/new" className="button">
        Get a late note
      </Link>
    </main>
  );
}
