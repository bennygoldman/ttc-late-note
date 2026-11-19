import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap" },
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="site-header">
          <Link to="/" className="site-name">
            TTC Late Note
          </Link>
        </header>
        {children}
        <footer className="site-footer">
          <p>
            A parody by the Tardy Toronto Collective. Not affiliated with the Toronto Transit Commission.
          </p>
          <p>
            Delay records from{" "}
            <a href="https://open.toronto.ca/dataset/ttc-subway-delay-data/">City of Toronto Open Data</a> and{" "}
            <a href="https://www.ttc.ca/service-alerts">TTC service alerts</a>.
          </p>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong on our end.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "We couldn't find that page." : error.statusText;
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
  }
  return (
    <main className="page">
      <h1>We apologize for the delay.</h1>
      <p>{message}</p>
      <p>
        <Link to="/">Back to the start</Link>
      </p>
    </main>
  );
}
