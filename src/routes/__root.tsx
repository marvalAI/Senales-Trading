import { Link, Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Route not found.</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">Back to scanner</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Signal Desk — CFD Decision Support" },
      { name: "description", content: "Technical analysis scanner for indices, commodities, forex and equities. Scoring, setups, and risk plans." },
      { property: "og:title", content: "Signal Desk — CFD Decision Support" },
      { property: "og:description", content: "Scanner with technical scoring, trade setups, and ATR-based risk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/50 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-primary" />
              <span className="text-sm font-semibold tracking-wide uppercase">Signal Desk</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Scanner</Link>
              <Link to="/settings" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Settings</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8"><Outlet /></main>
      </div>
    </QueryClientProvider>
  );
}
