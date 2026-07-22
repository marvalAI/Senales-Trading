// Server-only: fetches OHLCV from Yahoo Finance. Never import from client code.
import type { Candle } from "./indicatorService";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

type YahooChart = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
};

export async function fetchDailyCandles(
  yahooSymbol: string,
  range = "2y",
): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?range=${range}&interval=1d&includePrePost=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Yahoo ${yahooSymbol}: HTTP ${res.status}`);
  const json = (await res.json()) as YahooChart;
  if (json.chart.error) throw new Error(`Yahoo ${yahooSymbol}: ${json.chart.error.description}`);
  const result = json.chart.result?.[0];
  if (!result || !result.timestamp) return [];
  const q = result.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    const v = q.volume[i] ?? 0;
    if (o == null || h == null || l == null || c == null) continue;
    out.push({
      ts: new Date(result.timestamp[i] * 1000).toISOString(),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
    });
  }
  return out;
}
