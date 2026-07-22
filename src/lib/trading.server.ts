// Server-only helper for per-asset analysis. Imported dynamically from server fn handlers.
import { computeIndicators, type Candle } from "@/lib/services/indicatorService";
import { computeScore, probabilityFromScore } from "@/lib/services/scoringService";
import { generateSetup } from "@/lib/services/setupService";
import { fetchDailyCandles } from "@/lib/services/dataService.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AssetRow = {
  id: string;
  symbol: string;
  yahoo_symbol: string;
  name: string;
  type: string;
};

export async function analyzeAsset(asset: AssetRow) {
  let candles: Candle[] = [];
  try {
    candles = await fetchDailyCandles(asset.yahoo_symbol);
  } catch (e) {
    return { asset, error: (e as Error).message };
  }
  if (candles.length < 210) return { asset, error: "Insufficient bars" };

  const recent = candles.slice(-250).map((c) => ({
    asset_id: asset.id,
    timeframe: "1d",
    ts: c.ts,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
  await supabaseAdmin.from("market_data").upsert(recent, { onConflict: "asset_id,timeframe,ts" });

  const ind = computeIndicators(candles);
  if (!ind) return { asset, error: "Indicator computation failed" };

  await supabaseAdmin.from("technical_indicators").upsert({
    asset_id: asset.id,
    ts: ind.ts,
    ema20: ind.ema20,
    ema50: ind.ema50,
    ema200: ind.ema200,
    rsi: ind.rsi,
    macd: ind.macd,
    macd_signal: ind.macd_signal,
    macd_hist: ind.macd_hist,
    atr: ind.atr,
    avg_volume: ind.avg_volume,
  });

  const breakdown = computeScore(ind);
  await supabaseAdmin.from("scores").upsert({
    asset_id: asset.id,
    tech_score: breakdown.tech_score,
    trend: breakdown.trend,
    trend_score: breakdown.trend_score,
    rsi_score: breakdown.rsi_score,
    macd_score: breakdown.macd_score,
    volume_score: breakdown.volume_score,
    updated_at: new Date().toISOString(),
  });

  const setup = generateSetup(candles, ind, breakdown);
  if (setup.valid) {
    await supabaseAdmin.from("trade_setups").upsert({
      asset_id: asset.id,
      valid: true,
      bias: setup.bias,
      kind: setup.kind,
      entry: setup.entry,
      stop_loss: setup.stop_loss,
      take_profit: setup.take_profit,
      rr: setup.rr,
      probability: setup.probability,
      score: setup.score,
      reason: setup.reason,
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabaseAdmin.from("trade_setups").upsert({
      asset_id: asset.id,
      valid: false,
      bias: null,
      kind: null,
      entry: null,
      stop_loss: null,
      take_profit: null,
      rr: null,
      probability: probabilityFromScore(breakdown.tech_score),
      score: breakdown.tech_score,
      reason: setup.reason,
      updated_at: new Date().toISOString(),
    });
  }
  return { asset, ok: true as const };
}
