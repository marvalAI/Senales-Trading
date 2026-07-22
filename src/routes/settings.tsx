import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Signal Desk" },
      { name: "description", content: "Capital and per-trade risk configuration for position sizing." },
      { property: "og:title", content: "Settings — Signal Desk" },
      { property: "og:description", content: "Configure capital and risk-per-trade for position sizing." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [capital, setCapital] = useState(10000);
  const [risk, setRisk] = useState(0.01);
  const [saved, setSaved] = useState(false);

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

  function save(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("risk-settings", JSON.stringify({ capital, risk }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Risk Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Used only for position sizing on the asset detail page. Stored locally in your browser.
        </p>
      </div>
      <form onSubmit={save} className="space-y-5 rounded-md border border-border bg-card p-6">
        <label className="block">
          <span className="text-sm font-medium">Capital</span>
          <input
            type="number"
            min={100}
            step={100}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="flex justify-between text-sm font-medium">
            <span>Risk per trade</span>
            <span className="font-mono text-primary">{(risk * 100).toFixed(2)}%</span>
          </span>
          <input
            type="range"
            min={0.005}
            max={0.01}
            step={0.0005}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase text-muted-foreground">
            <span>0.50%</span><span>1.00%</span>
          </div>
        </label>
        <div className="flex items-center gap-3">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save</button>
          {saved && <span className="text-xs text-bull">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
