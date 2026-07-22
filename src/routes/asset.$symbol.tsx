import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAssetDetail } from "@/lib/trading.functions";
import { useEffect, useRef, useState } from "react";

const detailQuery = (symbol: string) =>
  queryOptions({
    queryKey: ["asset", symbol],
    queryFn: () => getAssetDetail({ data: { symbol } }),
  });

export const Route = createFileRoute("/asset/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — Signal Desk` },
      { name: "description", content: `Technical setup, score, and risk plan for ${params.symbol}.` },
      { property: "og:title", content: `${params.symbol} — Signal Desk` },
      { property: "og:description", content: `Technical setup, score, and risk plan for ${params.symbol}.` },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(detailQuery(params.symbol));
    if (!data) throw notFound();
    return data;
  },
  component: AssetDetail,
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="text-sm text-muted-foreground">
      Asset not found. <Link to="/" className="text-primary underline">Back to scanner</Link>
    </div>
  ),
});

type Bar = { ts: string; open: number; high: number; low: number; close: number; volume: number };

function PriceChart({ bars }: { bars: Bar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || bars.length === 0) return;
    let disposed = false;
    let chart: { remove: () => void } | null = null;
    (async () => {
      const { createChart, CandlestickSeries } = await import("lightweight-charts");
      if (disposed || !ref.current) return;
      const el = ref.current;
      const c = createChart(el, {
        width: el.clientWidth,
        height: 380,
        layout: {
          background: { color: "transparent" },
          textColor: "#a3adbf",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
        timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      });
      const s = c.addSeries(CandlestickSeries, {
        upColor: "#26a269",
        downColor: "#e5484d",
        wickUpColor: "#26a269",
        wickDownColor: "#e5484d",
        borderVisible: false,
      });
      s.setData(
        bars.map((b) => ({
          time: (Math.floor(new Date(b.ts).getTime() / 1000)) as never,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      );
      c.timeScale().fitContent();
      chart = c;
      const onResize = () => c.applyOptions({ width: el.clientWidth });
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    })();
    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [bars]);
  return <div ref={ref} className="w-full" />;
}

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function useRiskSettings() {
  const [capital, setCapital] = useState(10000);
  const [risk, setRisk] = useState(0.01);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("risk-settings");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.capital === "number") setCapital(p.capital);
        if (typeof p.risk === "number") setRisk(p.risk);
      }
    } catch { /* noop */ }
  }, []);
  return { capital, risk };
}

function AssetDetail() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(params.symbol));
  const { capital, risk } = useRiskSettings();

  if (!data) return null;
  const { asset, bars, indicators, score, setup } = data;
  const s = score?.tech_score ?? null;
  const scoreCls = s == null ? "text-muted-foreground" : s > 70 ? "text-score-high" : s >= 50 ? "text-score-mid" : "text-score-low";

  // Recompute position size client-side using local risk settings
  const slDist = setup?.entry != null && setup.stop_loss != null ? Math.abs(setup.entry - setup.stop_loss) : null;
  const positionSize = slDist && slDist > 0 ? (capital * risk) / slDist : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Scanner</Link>
          <h1 className="mt-1 text-2xl font-semibold">{asset.symbol}</h1>
          <p className="text-sm text-muted-foreground">{asset.name} · {asset.type}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Tech Score</div>
          <div className={`font-mono text-3xl font-semibold ${scoreCls}`}>{s != null ? s.toFixed(1) : "—"}</div>
          <div className="text-xs text-muted-foreground">Trend: {score?.trend ?? "—"}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-4 lg:col-span-2">
          <PriceChart bars={bars as Bar[]} />
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indicators</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">EMA20</dt><dd className="text-right font-mono">{fmt(indicators?.ema20)}</dd>
              <dt className="text-muted-foreground">EMA50</dt><dd className="text-right font-mono">{fmt(indicators?.ema50)}</dd>
              <dt className="text-muted-foreground">EMA200</dt><dd className="text-right font-mono">{fmt(indicators?.ema200)}</dd>
              <dt className="text-muted-foreground">RSI(14)</dt><dd className="text-right font-mono">{fmt(indicators?.rsi, 1)}</dd>
              <dt className="text-muted-foreground">MACD</dt><dd className="text-right font-mono">{fmt(indicators?.macd, 3)}</dd>
              <dt className="text-muted-foreground">ATR(14)</dt><dd className="text-right font-mono">{fmt(indicators?.atr)}</dd>
              <dt className="text-muted-foreground">Avg Vol(20)</dt><dd className="text-right font-mono">{fmt(indicators?.avg_volume, 0)}</dd>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trade Setup</h3>
              {setup?.valid ? (
                <span className={`text-xs font-semibold uppercase ${setup.bias === "long" ? "text-bull" : "text-bear"}`}>
                  {setup.bias} · {setup.kind}
                </span>
              ) : null}
            </div>
            {setup?.valid ? (
              <>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Entry</dt><dd className="text-right font-mono">{fmt(setup.entry)}</dd>
                  <dt className="text-muted-foreground">Stop Loss</dt><dd className="text-right font-mono text-bear">{fmt(setup.stop_loss)}</dd>
                  <dt className="text-muted-foreground">Take Profit</dt><dd className="text-right font-mono text-bull">{fmt(setup.take_profit)}</dd>
                  <dt className="text-muted-foreground">R:R</dt><dd className="text-right font-mono">{setup.rr?.toFixed(1)}</dd>
                  <dt className="text-muted-foreground">Probability</dt><dd className="text-right font-mono">{Math.round(setup.probability ?? 0)}%</dd>
                  <dt className="text-muted-foreground">Position Size</dt>
                  <dd className="text-right font-mono">{positionSize != null ? fmt(positionSize, 4) : "—"}</dd>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">{setup.reason}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sized from {capital.toLocaleString()} @ {(risk * 100).toFixed(2)}% risk
                </p>
              </>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">No valid setup on the latest bar.</p>
                {setup?.reason && <p className="mt-2 text-xs text-muted-foreground">{setup.reason}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
