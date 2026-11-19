import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import { TtcLogo } from "./components/icons";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Reenie+Beanie&display=swap",
  },
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
            <TtcLogo className="site-logo" />
            Late Note Division
          </Link>
        </header>
        {children}
        <footer className="site-footer">
          <p>A parody. TTC here means the Tardy Toronto Collective, not the Toronto Transit Commission.</p>
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
