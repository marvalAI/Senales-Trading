export type RiskParams = {
  capital: number;
  riskPerTrade: number; // 0.005 - 0.01
};

export type RiskPlan = {
  entry: number;
  stop_loss: number;
  take_profit: number;
  rr: number;
  sl_distance: number;
  position_size: number;
};

export function buildRiskPlan(
  bias: "long" | "short",
  entry: number,
  atr: number,
  params: RiskParams,
  targetRR = 3,
): RiskPlan {
  const slDist = atr * 2;
  const stop_loss = bias === "long" ? entry - slDist : entry + slDist;
  const take_profit = bias === "long" ? entry + slDist * targetRR : entry - slDist * targetRR;
  const rr = targetRR;
  const position_size = (params.capital * params.riskPerTrade) / slDist;
  return {
    entry,
    stop_loss,
    take_profit,
    rr,
    sl_distance: slDist,
    position_size,
  };
}
