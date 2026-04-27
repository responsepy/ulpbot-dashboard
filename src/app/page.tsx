"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthResponse, RuntimeStatusResponse, AnalyticsResponse, IndexingStatus } from "../lib/api";
import { api } from "../lib/api";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`}
    />
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ?? "text-slate-100"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function ServiceRow({ name, ok, message }: { name: string; ok: boolean; message?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <StatusDot ok={ok} />
        <span className="text-sm font-medium text-slate-200">{name}</span>
      </div>
      <span className={`text-xs ${ok ? "text-emerald-400" : "text-rose-400"}`}>
        {message ?? (ok ? "Online" : "Offline")}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatusResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [indexing, setIndexing] = useState<IndexingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartMsg, setRestartMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, r, a, ix] = await Promise.allSettled([
        api.health(),
        api.runtimeStatus(),
        api.analytics(),
        api.indexingStatus(),
      ]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (r.status === "fulfilled") setRuntime(r.value);
      if (a.status === "fulfilled") setAnalytics(a.value);
      if (ix.status === "fulfilled") setIndexing(ix.value);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const restart = async () => {
    if (!confirm("Restart ULPBot and web services?")) return;
    setRestarting(true);
    setRestartMsg(null);
    try {
      const r = await api.restartServices();
      setRestartMsg(r.message);
    } catch (e) {
      setRestartMsg(`Error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setRestarting(false);
    }
  };

  const apiOk = health?.services !== undefined;
  const esOk = Boolean(health?.services?.elasticsearch);
  const redisOk = Boolean(health?.services?.redis);
  const discordOk = Boolean(runtime?.discord?.online);
  const telegramOk = Boolean(runtime?.telegram?.online);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">Overview</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
          >
            Refresh
          </button>
          <button
            onClick={() => void restart()}
            disabled={restarting}
            className="rounded-lg border border-rose-600/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {restarting ? "Restarting..." : "Restart Services"}
          </button>
        </div>
      </div>

      {restartMsg && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {restartMsg}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Unable to reach backend API. Is the server running? ({error})
        </div>
      )}

      {/* Service Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Services</p>
          <div className="divide-y divide-slate-800">
            <ServiceRow name="API" ok={apiOk} message={health?.status ?? "Unknown"} />
            <ServiceRow name="Elasticsearch" ok={esOk} />
            <ServiceRow name="Redis" ok={redisOk} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Bots</p>
          <div className="divide-y divide-slate-800">
            <ServiceRow
              name="Discord Bot"
              ok={discordOk}
              message={runtime?.discord?.message ?? (discordOk ? "Online" : "Offline")}
            />
            <ServiceRow
              name="Telegram Bot"
              ok={telegramOk}
              message={runtime?.telegram?.message ?? (telegramOk ? "Online" : "Offline")}
            />
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Searches"
          value={(analytics?.total_searches ?? 0).toLocaleString()}
          sub="All time"
          accent="text-cyan-300"
        />
        <StatCard
          label="Credits Used"
          value={(analytics?.total_credits_used ?? 0).toLocaleString()}
          sub="All time"
          accent="text-fuchsia-300"
        />
        <StatCard
          label="Unique Users"
          value={(analytics?.unique_users ?? 0).toLocaleString()}
          sub="Tracked"
          accent="text-emerald-300"
        />
        <StatCard
          label="Index Status"
          value={indexing?.running ? "Running" : (indexing?.status ?? "Idle")}
          sub={indexing?.running ? `${indexing?.progress_percent ?? 0}% complete` : indexing?.message ?? ""}
          accent={indexing?.running ? "text-amber-300" : indexing?.status === "failed" ? "text-rose-300" : "text-slate-300"}
        />
      </div>

      {/* Indexing progress */}
      {indexing?.running && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-amber-300">Background Indexing Running</p>
            <span className="text-xs text-amber-400">{indexing.progress_percent ?? 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full animate-pulse rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${indexing.progress_percent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {indexing.message} {indexing.current_file ? `— ${indexing.current_file}` : ""}
          </p>
        </div>
      )}

      {/* Analytics tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {analytics?.top_searches && analytics.top_searches.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Top Searches</p>
            <div className="space-y-2">
              {analytics.top_searches.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="max-w-[200px] truncate font-mono text-slate-300">{s.query}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-cyan-300">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analytics?.top_users && analytics.top_users.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Top Users</p>
            <div className="space-y-2">
              {analytics.top_users.slice(0, 8).map((u, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="max-w-[200px] truncate text-slate-300">{u.user}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-fuchsia-300">{u.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-right text-xs text-slate-700">Auto-refreshes every 15 seconds</p>
    </div>
  );
}
