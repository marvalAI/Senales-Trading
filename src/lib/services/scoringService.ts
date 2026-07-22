import type { IndicatorSnapshot } from "./indicatorService";

export type Trend = "uptrend" | "downtrend" | "neutral";

export function classifyTrend(i: IndicatorSnapshot): Trend {
  const { ema20, ema50, ema200 } = i;
  if (ema20 == null || ema50 == null || ema200 == null) return "neutral";
  if (ema20 > ema50 && ema50 > ema200) return "uptrend";
  if (ema20 < ema50 && ema50 < ema200) return "downtrend";
  return "neutral";
}

function trendScore(i: IndicatorSnapshot, trend: Trend): number {
  if (trend === "neutral") return 30;
  // Distinguish strong vs partial via how far apart EMAs are (>1% between EMAs = strong).
  const { ema20, ema50, ema200 } = i;
  if (ema20 == null || ema50 == null || ema200 == null) return 30;
  const spread = Math.abs(ema20 - ema200) / ema200;
  return spread > 0.02 ? 100 : 70;
}

function rsiScore(i: IndicatorSnapshot, trend: Trend): number {
  const r = i.rsi;
  if (r == null) return 50;
  if (trend !== "neutral" && r >= 45 && r <= 55) return 80;
  if (r >= 70 || r <= 30) return 60;
  return 50;
}

function macdScore(i: IndicatorSnapshot): number {
  const h = i.macd_hist;
  const hp = i.macd_hist_prev;
  if (h == null || hp == null) return 50;
  if (hp <= 0 && h > 0) return 80; // bullish crossover
  if (hp >= 0 && h < 0) return 20; // bearish crossover
  if (Math.abs(h) < Math.abs(hp) * 0.1) return 50; // flat
  return h > 0 ? 65 : 35;
}

function volumeScore(i: IndicatorSnapshot): number {
  if (i.avg_volume == null || i.avg_volume === 0) return 50;
  const ratio = i.volume / i.avg_volume;
  if (ratio >= 1.2) return 80;
  if (ratio >= 0.8) return 50;
  return 30;
}

export type ScoreBreakdown = {
  tech_score: number;
  trend: Trend;
  trend_score: number;
  rsi_score: number;
  macd_score: number;
  volume_score: number;
};

export function computeScore(i: IndicatorSnapshot): ScoreBreakdown {
  const trend = classifyTrend(i);
  const ts = trendScore(i, trend);
  const rs = rsiScore(i, trend);
  const ms = macdScore(i);
  const vs = volumeScore(i);
  const tech = 0.5 * ts + 0.2 * rs + 0.15 * ms + 0.15 * vs;
  return {
    tech_score: Math.round(tech * 10) / 10,
    trend,
    trend_score: ts,
    rsi_score: rs,
    macd_score: ms,
    volume_score: vs,
  };
}

export function probabilityFromScore(score: number): number {
  if (score > 80) return 70;
  if (score >= 70) return 60;
  if (score >= 60) return 55;
  return 45;
}
