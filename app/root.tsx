import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";

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
        {children}
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
  let message = "Something went wrong.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found." : error.statusText;
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
  }
  return (
    <main>
      <h1>Sorry about the delay.</h1>
      <p>{message}</p>
    </main>
  );
}
