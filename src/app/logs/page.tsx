"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { LogEntry } from "../../lib/api";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tailLines, setTailLines] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.logs(tailLines);
      setLogs(r.items ?? []);
      if (!selected && r.items?.length) {
        setSelected(r.items[0].name);
      }
    } catch (e) {
      setMsg(`Load error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setLoading(false);
    }
  }, [tailLines, selected]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const clearLogs = async () => {
    if (!confirm("Clear all log files? This cannot be undone.")) return;
    setClearing(true);
    try {
      const r = await api.clearLogs();
      setMsg(`Cleared ${r.cleared_count} log file(s).${r.failed_count ? ` Failed: ${r.failed_count}.` : ""}`);
      await load();
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setClearing(false);
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const activeLog = logs.find((l) => l.name === selected);
  const content = activeLog?.content ?? "";
  const lines = content.split("\n");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">Debug</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">Logs</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tailLines}
            onChange={(e) => setTailLines(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300"
          >
            {[500, 1000, 2000, 5000, 10000].map((n) => (
              <option key={n} value={n}>{n} lines</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={() => void load()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            onClick={scrollToBottom}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
          >
            Jump to End
          </button>
          <button
            onClick={() => void clearLogs()}
            disabled={clearing}
            className="rounded-lg border border-rose-600/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {clearing ? "Clearing..." : "Clear All Logs"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          {msg}
        </div>
      )}

      {/* Log file tabs */}
      {logs.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {logs.map((l) => (
            <button
              key={l.name}
              onClick={() => setSelected(l.name)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected === l.name
                  ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {l.name}
              {l.size_bytes !== undefined && (
                <span className="ml-1.5 text-slate-600">
                  {l.size_bytes < 1024 ? `${l.size_bytes}B` : `${(l.size_bytes / 1024).toFixed(0)}KB`}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Log content */}
      {activeLog?.error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Error reading log: {activeLog.error}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">{activeLog?.name ?? "—"}</span>
              {activeLog?.truncated && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                  Showing last {tailLines} lines of {activeLog.total_lines?.toLocaleString()}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-600">
              {lines.length.toLocaleString()} lines
              {activeLog?.updated_at && ` · ${new Date(activeLog.updated_at).toLocaleString()}`}
            </span>
          </div>

          {/* Lines */}
          <div className="h-[calc(100vh-22rem)] overflow-auto">
            <pre className="px-4 py-3 font-mono text-xs leading-relaxed text-slate-300">
              {loading ? "Loading..." : content || "Log file is empty."}
            </pre>
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
          No log files found. Logs are expected in <code className="font-mono">logs/</code> or <code className="font-mono">/root/.pm2/logs/</code>.
        </div>
      )}
    </div>
  );
}
