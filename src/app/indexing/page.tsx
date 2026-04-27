"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { IndexingStatus, TierSummary } from "../../lib/api";

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}>
      {children}
    </span>
  );
}

function statusBadge(status: IndexingStatus) {
  if (status.running) return <Badge color="bg-amber-500/20 text-amber-300">Running</Badge>;
  if (status.status === "completed") return <Badge color="bg-emerald-500/20 text-emerald-300">Completed</Badge>;
  if (status.status === "failed") return <Badge color="bg-rose-500/20 text-rose-300">Failed</Badge>;
  return <Badge color="bg-slate-700 text-slate-400">Idle</Badge>;
}

export default function IndexingPage() {
  const [status, setStatus] = useState<IndexingStatus | null>(null);
  const [freeTier, setFreeTier] = useState<TierSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "info" | "error" | "success" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [st, files] = await Promise.allSettled([api.indexingStatus(), api.filesSummary()]);
      if (st.status === "fulfilled") setStatus(st.value);
      if (files.status === "fulfilled") setFreeTier(files.value.free ?? null);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const st = await api.indexingStatus();
        setStatus(st);
        if (!st.running) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          const files = await api.filesSummary();
          setFreeTier(files.free ?? null);
        }
      } catch {
        // ignore
      }
    }, 2000);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.running) startPolling();
    return () => {
      if (pollRef.current && !status?.running) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [status?.running, startPolling]);

  const reindexMissing = async () => {
    if (starting || status?.running) return;
    setStarting(true);
    setMessage(null);
    try {
      const r = await api.reindexMissing();
      if (r.started) {
        setMessage({ text: `Started — ${r.target_files ?? 0} file(s), ~${(r.pending_lines ?? 0).toLocaleString()} lines pending.`, type: "info" });
        startPolling();
      } else {
        setMessage({ text: r.message, type: "success" });
      }
      await loadStatus();
    } catch (e) {
      setMessage({ text: `Error: ${e instanceof Error ? e.message : "Failed"}`, type: "error" });
    } finally {
      setStarting(false);
    }
  };

  const reindexAll = async () => {
    if (!confirm("This will re-index ALL free-tier files from scratch. Continue?")) return;
    if (starting || status?.running) return;
    setStarting(true);
    setMessage(null);
    try {
      const files = freeTier?.groups?.flatMap((g) => (g.files ?? []).map((f) => f.path)) ?? [];
      if (!files.length) { setMessage({ text: "No files found to index.", type: "error" }); return; }
      const r = await api.reindexFiles("free", files);
      const s = r.summary;
      setMessage({
        text: `Re-indexed ${s.matched_files ?? 0} file(s) — ${(s.indexed_lines ?? 0).toLocaleString()} lines, ${s.failed_docs ?? 0} failures.`,
        type: "success",
      });
      await loadStatus();
    } catch (e) {
      setMessage({ text: `Error: ${e instanceof Error ? e.message : "Failed"}`, type: "error" });
    } finally {
      setStarting(false);
    }
  };

  const isRunning = Boolean(status?.running);
  const pct = status?.progress_percent ?? 0;
  const totalFiles = freeTier?.file_count ?? 0;
  const totalLines = freeTier?.total_line_count ?? 0;
  const indexedLines = freeTier?.total_indexed_lines ?? 0;
  const unindexedLines = freeTier?.total_unindexed_lines ?? 0;
  const indexPct = totalLines > 0 ? Math.min(100, Math.round((indexedLines / totalLines) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading indexing status...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">Elasticsearch</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">Indexing</h1>
          <p className="mt-1 text-sm text-slate-400">Manage the Elasticsearch index for the free-tier search data.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => void loadStatus()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
          >
            Refresh
          </button>
          <button
            onClick={() => void reindexMissing()}
            disabled={starting || isRunning}
            className="rounded-lg border border-cyan-600/50 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {isRunning ? "Running..." : starting ? "Starting..." : "Index Missing Lines"}
          </button>
          <button
            onClick={() => void reindexAll()}
            disabled={starting || isRunning}
            className="rounded-lg border border-amber-600/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Reindex All Files
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current job status */}
      {status && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Current Job Status</p>
            {statusBadge(status)}
          </div>

          <p className="text-sm text-slate-400">{status.message}</p>

          {(isRunning || (status.status !== "idle" && status.progress_percent !== undefined)) && (
            <>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isRunning ? "animate-pulse bg-cyan-400" : "bg-emerald-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                {[
                  { label: "Target Files", value: status.target_files ?? 0 },
                  { label: "Processed Files", value: status.processed_files ?? 0 },
                  { label: "Indexed Lines", value: (status.indexed_lines ?? 0).toLocaleString() },
                  { label: "Failed Docs", value: status.failed_docs ?? 0 },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">{s.label}</p>
                    <p className="mt-1 font-semibold text-slate-200">{s.value}</p>
                  </div>
                ))}
              </div>

              {status.current_file && (
                <p className="text-xs text-slate-500">Current file: <span className="font-mono text-slate-400">{status.current_file}</span></p>
              )}
              {status.last_error && (
                <p className="text-xs text-rose-400">Error: {status.last_error}</p>
              )}
              {status.started_at && (
                <p className="text-xs text-slate-600">
                  Started: {new Date(status.started_at).toLocaleString()}
                  {status.finished_at && ` → Finished: ${new Date(status.finished_at).toLocaleString()}`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Free-tier overview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <p className="text-sm font-medium text-slate-200">Free-Tier Index Coverage</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          {[
            { label: "Total Files", value: totalFiles },
            { label: "Total Lines", value: totalLines.toLocaleString() },
            { label: "Indexed Lines", value: indexedLines.toLocaleString(), accent: "text-emerald-300" },
            { label: "Missing Lines", value: unindexedLines.toLocaleString(), accent: unindexedLines > 0 ? "text-rose-300" : "text-emerald-300" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <p className="text-slate-500">{s.label}</p>
              <p className={`mt-1 font-semibold ${s.accent ?? "text-slate-200"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Overall coverage</span>
            <span className={unindexedLines > 0 ? "text-rose-400" : "text-emerald-400"}>{indexPct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${unindexedLines > 0 ? "bg-rose-400" : "bg-emerald-400"}`}
              style={{ width: `${indexPct}%` }}
            />
          </div>
        </div>

        {/* Per-group breakdown */}
        {(freeTier?.groups ?? []).length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Files</th>
                  <th className="px-3 py-2">Total Lines</th>
                  <th className="px-3 py-2">Indexed</th>
                  <th className="px-3 py-2">Missing</th>
                  <th className="px-3 py-2">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {(freeTier?.groups ?? []).map((g) => {
                  const gTotal = Number(g.total_line_count ?? 0);
                  const gIndexed = Number(g.total_indexed_lines ?? 0);
                  const gMissing = Number(g.total_unindexed_lines ?? 0);
                  const gPct = gTotal > 0 ? Math.min(100, Math.round((gIndexed / gTotal) * 100)) : 0;
                  return (
                    <tr key={g.group} className="border-t border-slate-800">
                      <td className="px-3 py-2 font-medium text-slate-200">{g.group}</td>
                      <td className="px-3 py-2 text-slate-400">{g.file_count ?? 0}</td>
                      <td className="px-3 py-2 text-slate-400">{gTotal.toLocaleString()}</td>
                      <td className="px-3 py-2 text-emerald-400">{gIndexed.toLocaleString()}</td>
                      <td className={`px-3 py-2 ${gMissing > 0 ? "text-rose-300" : "text-emerald-400"}`}>{gMissing.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className={`h-full rounded-full ${gMissing > 0 ? "bg-rose-400" : "bg-emerald-400"}`}
                              style={{ width: `${gPct}%` }}
                            />
                          </div>
                          <span className={gMissing > 0 ? "text-rose-400" : "text-emerald-400"}>{gPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-right text-xs text-slate-700">
        {isRunning ? "Polling every 2s while running..." : "Status auto-refreshes on page load."}
      </p>
    </div>
  );
}
