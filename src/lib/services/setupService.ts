import type { Candle, IndicatorSnapshot } from "./indicatorService";
import { classifyTrend, probabilityFromScore, type ScoreBreakdown } from "./scoringService";
import { buildRiskPlan, type RiskParams } from "./riskService";

export type Setup = {
  valid: true;
  bias: "long" | "short";
  kind: "pullback" | "breakout" | "rejection";
  entry: number;
  stop_loss: number;
  take_profit: number;
  rr: number;
  probability: number;
  score: number;
  reason: string;
};

export type NoSetup = { valid: false; reason: string };

const DEFAULT_RISK: RiskParams = { capital: 10000, riskPerTrade: 0.01 };

function near(price: number, ref: number, tolPct = 0.015): boolean {
  return Math.abs(price - ref) / ref <= tolPct;
}

function highVolume(ind: IndicatorSnapshot): boolean {
  return ind.avg_volume != null && ind.avg_volume > 0 && ind.volume >= ind.avg_volume * 1.2;
}

function detectPullback(ind: IndicatorSnapshot, trend: string): Setup | null {
  if (ind.rsi == null || ind.ema20 == null || ind.ema50 == null || ind.macd_hist == null) return null;
  if (trend === "uptrend") {
    const nearEma =
      near(ind.close, ind.ema20) || near(ind.close, ind.ema50);
    if (nearEma && ind.rsi >= 40 && ind.rsi <= 55 && ind.macd_hist > 0) {
      return {
        valid: true,
        bias: "long",
        kind: "pullback",
        entry: ind.close,
        stop_loss: 0,
        take_profit: 0,
        rr: 0,
        probability: 0,
        score: 0,
        reason: "Pullback to EMA in uptrend with bullish momentum",
      };
    }
  }
  if (trend === "downtrend") {
    const nearEma =
      near(ind.close, ind.ema20) || near(ind.close, ind.ema50);
    if (nearEma && ind.rsi >= 45 && ind.rsi <= 60 && ind.macd_hist < 0) {
      return {
        valid: true,
        bias: "short",
        kind: "pullback",
        entry: ind.close,
        stop_loss: 0,
        take_profit: 0,
        rr: 0,
        probability: 0,
        score: 0,
        reason: "Pullback to EMA in downtrend with bearish momentum",
      };
    }
  }
  return null;
}

function detectBreakout(
  candles: Candle[],
  ind: IndicatorSnapshot,
): Setup | null {
  if (candles.length < 30 || !highVolume(ind)) return null;
  const lookback = candles.slice(-21, -1); // prior 20 bars
  const resistance = Math.max(...lookback.map((c) => c.high));
  const support = Math.min(...lookback.map((c) => c.low));
  const last = candles[candles.length - 1];
  if (last.close > resistance) {
    return {
      valid: true,
      bias: "long",
      kind: "breakout",
      entry: last.close,
      stop_loss: 0,
      take_profit: 0,
      rr: 0,
      probability: 0,
      score: 0,
      reason: "Close above 20-bar resistance on above-average volume",
    };
  }
  if (last.close < support) {
    return {
      valid: true,
      bias: "short",
      kind: "breakout",
      entry: last.close,
      stop_loss: 0,
      take_profit: 0,
      rr: 0,
      probability: 0,
      score: 0,
      reason: "Close below 20-bar support on above-average volume",
    };
  }
  return null;
}

function detectRejection(
  candles: Candle[],
  ind: IndicatorSnapshot,
): Setup | null {
  if (!highVolume(ind) || ind.rsi == null) return null;
  const c = candles[candles.length - 1];
  const range = c.high - c.low;
  if (range <= 0) return null;
  const body = Math.abs(c.close - c.open);
  const upperWick = c.high - Math.max(c.close, c.open);
  const lowerWick = Math.min(c.close, c.open) - c.low;
  // Bullish rejection: long lower wick, oversold
  if (lowerWick > body * 2 && lowerWick / range > 0.5 && ind.rsi <= 35) {
    return {
      valid: true,
      bias: "long",
      kind: "rejection",
      entry: c.close,
      stop_loss: 0,
      take_profit: 0,
      rr: 0,
      probability: 0,
      score: 0,
      reason: "Bullish wick rejection at oversold RSI with volume spike",
    };
  }
  if (upperWick > body * 2 && upperWick / range > 0.5 && ind.rsi >= 65) {
    return {
      valid: true,
      bias: "short",
      kind: "rejection",
      entry: c.close,
      stop_loss: 0,
      take_profit: 0,
      rr: 0,
      probability: 0,
      score: 0,
      reason: "Bearish wick rejection at overbought RSI with volume spike",
    };
  }
  return null;
}

export function generateSetup(
  candles: Candle[],
  ind: IndicatorSnapshot,
  breakdown: ScoreBreakdown,
  risk: RiskParams = DEFAULT_RISK,
): Setup | NoSetup {
  const trend = classifyTrend(ind);
  const candidate =
    detectPullback(ind, trend) ??
    detectBreakout(candles, ind) ??
    detectRejection(candles, ind);

  if (!candidate) return { valid: false, reason: "No qualifying pattern on latest bar" };
  if (ind.atr == null || ind.atr <= 0)
    return { valid: false, reason: "ATR unavailable — cannot size risk" };

  // Trend alignment filter for pullback/breakout
  if (candidate.kind !== "rejection") {
    if (candidate.bias === "long" && trend !== "uptrend")
      return { valid: false, reason: "Trend not aligned with long bias" };
    if (candidate.bias === "short" && trend !== "downtrend")
      return { valid: false, reason: "Trend not aligned with short bias" };
  }

  // Volume filter
  if (!highVolume(ind) && candidate.kind !== "pullback")
    return { valid: false, reason: "Volume below threshold for setup" };

  const plan = buildRiskPlan(candidate.bias, candidate.entry, ind.atr, risk, 3);
  if (plan.rr < 2) return { valid: false, reason: "Risk/Reward below 2" };

  return {
    ...candidate,
    entry: plan.entry,
    stop_loss: plan.stop_loss,
    take_profit: plan.take_profit,
    rr: plan.rr,
    probability: probabilityFromScore(breakdown.tech_score),
    score: breakdown.tech_score,
  };
}
