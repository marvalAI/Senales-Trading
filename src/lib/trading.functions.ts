import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const runScan = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { analyzeAsset } = await import("@/lib/trading.server");
  const { data: assets, error } = await supabaseAdmin
    .from("assets")
    .select("id, symbol, yahoo_symbol, name, type");
  if (error) throw new Error(error.message);
  const results = await Promise.all((assets ?? []).map((a) => analyzeAsset(a)));
  const ok = results.filter((r) => "ok" in r).length;
  const failed = results
    .filter((r): r is Extract<typeof r, { error: string }> => "error" in r)
    .map((r) => ({ symbol: r.asset.symbol, error: r.error }));
  return { scanned: results.length, ok, failed, at: new Date().toISOString() };
});

export const getScanner = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: assets }, { data: scores }, { data: setups }] = await Promise.all([
    supabaseAdmin.from("assets").select("*").order("type").order("symbol"),
    supabaseAdmin.from("scores").select("*"),
    supabaseAdmin.from("trade_setups").select("*"),
  ]);
  const scoreMap = new Map((scores ?? []).map((s) => [s.asset_id, s]));
  const setupMap = new Map((setups ?? []).map((s) => [s.asset_id, s]));
  const rows = (assets ?? []).map((a) => {
    const s = scoreMap.get(a.id);
    const t = setupMap.get(a.id);
    return {
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      type: a.type,
      tech_score: s?.tech_score ?? null,
      trend: s?.trend ?? null,
      valid: t?.valid ?? null,
      bias: t?.bias ?? null,
      kind: t?.kind ?? null,
      rr: t?.rr ?? null,
      probability: t?.probability ?? null,
      updated_at: s?.updated_at ?? t?.updated_at ?? null,
    };
  });
  rows.sort((a, b) => (b.tech_score ?? -1) - (a.tech_score ?? -1));
  return { rows };
});

export const getAssetDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ symbol: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: asset } = await supabaseAdmin
      .from("assets")
      .select("*")
      .eq("symbol", data.symbol)
      .maybeSingle();
    if (!asset) return null;
    const [{ data: bars }, { data: ind }, { data: score }, { data: setup }] = await Promise.all([
      supabaseAdmin
        .from("market_data")
        .select("ts, open, high, low, close, volume")
        .eq("asset_id", asset.id)
        .order("ts", { ascending: true })
        .limit(250),
      supabaseAdmin
        .from("technical_indicators")
        .select("*")
        .eq("asset_id", asset.id)
        .maybeSingle(),
      supabaseAdmin.from("scores").select("*").eq("asset_id", asset.id).maybeSingle(),
      supabaseAdmin.from("trade_setups").select("*").eq("asset_id", asset.id).maybeSingle(),
    ]);
    return { asset, bars: bars ?? [], indicators: ind, score, setup };
  });
