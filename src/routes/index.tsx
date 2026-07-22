import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getScanner, runScan } from "@/lib/trading.functions";
import { useState } from "react";

const scannerQuery = queryOptions({
  queryKey: ["scanner"],
  queryFn: () => getScanner(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scanner — Signal Desk" },
      { name: "description", content: "Ranked market scanner: score, trend, bias, RR, and probability across indices, commodities, forex and stocks." },
      { property: "og:title", content: "Scanner — Signal Desk" },
      { property: "og:description", content: "Ranked market scanner with technical scoring and trade setups." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(scannerQuery),
  component: Scanner,
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => <div>Not found</div>,
});

function scoreClass(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s > 70) return "text-score-high";
  if (s >= 50) return "text-score-mid";
  return "text-score-low";
}

function trendBadge(t: string | null) {
  if (t === "uptrend") return <span className="rounded bg-bull/15 px-2 py-0.5 text-xs font-medium text-bull">UPTREND</span>;
  if (t === "downtrend") return <span className="rounded bg-bear/15 px-2 py-0.5 text-xs font-medium text-bear">DOWNTREND</span>;
  return <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">NEUTRAL</span>;
}

function biasBadge(bias: string | null, valid: boolean | null) {
  if (!valid || !bias) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = bias === "long" ? "text-bull" : "text-bear";
  return <span className={`text-xs font-semibold uppercase ${cls}`}>{bias}</span>;
}

function Scanner() {
  const router = useRouter();
  const { data } = useSuspenseQuery(scannerQuery);
  const [msg, setMsg] = useState<string | null>(null);
  const scan = useMutation({
    mutationFn: () => runScan(),
    onSuccess: async (r) => {
      setMsg(`Scanned ${r.ok}/${r.scanned} assets at ${new Date(r.at).toLocaleTimeString()}${r.failed.length ? ` — ${r.failed.length} failed` : ""}`);
      await router.invalidate();
    },
    onError: (e: Error) => setMsg(`Scan failed: ${e.message}`),
  });

  const groups = ["index", "commodity", "forex", "stock"] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Scanner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily technical scoring, trend classification, and validated trade setups. Decision support only — no auto-trading.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          <button
            onClick={() => { setMsg("Scanning…"); scan.mutate(); }}
            disabled={scan.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {scan.isPending ? "Scanning…" : "Run scan"}
          </button>
        </div>
      </div>

      {data.rows.every((r) => r.tech_score == null) && (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          No data yet. Click <span className="font-medium text-foreground">Run scan</span> to pull the latest OHLCV, compute indicators, and generate setups.
        </div>
      )}

      {groups.map((g) => {
        const rows = data.rows.filter((r) => r.type === g);
        if (rows.length === 0) return null;
        return (
          <section key={g}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g}s</h2>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Asset</th>
                    <th className="px-4 py-2 text-right font-medium">Score</th>
                    <th className="px-4 py-2 text-left font-medium">Trend</th>
                    <th className="px-4 py-2 text-left font-medium">Bias</th>
                    <th className="px-4 py-2 text-left font-medium">Setup</th>
                    <th className="px-4 py-2 text-right font-medium">RR</th>
                    <th className="px-4 py-2 text-right font-medium">Prob.</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const highlight = r.valid && r.tech_score != null && r.tech_score >= 70 && (r.rr ?? 0) >= 3;
                    return (
                      <tr key={r.id} className={`border-t border-border ${highlight ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.symbol}</div>
                          <div className="text-xs text-muted-foreground">{r.name}</div>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${scoreClass(r.tech_score)}`}>
                          {r.tech_score != null ? r.tech_score.toFixed(1) : "—"}
                        </td>
                        <td className="px-4 py-3">{trendBadge(r.trend)}</td>
                        <td className="px-4 py-3">{biasBadge(r.bias, r.valid)}</td>
                        <td className="px-4 py-3 text-xs uppercase text-muted-foreground">
                          {r.valid ? r.kind : "no valid setup"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{r.rr != null ? r.rr.toFixed(1) : "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{r.probability != null ? `${Math.round(r.probability)}%` : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link to="/asset/$symbol" params={{ symbol: r.symbol }} className="text-xs text-primary hover:underline">
                            Detail →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
