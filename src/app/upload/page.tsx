"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { GroupFile, GroupSummary, FilesSummaryResponse, IndexingStatus } from "../../lib/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");

function uploadEndpoints(): string[] {
  // /api/upload is a Next.js API route that proxies server-side at request time —
  // works on Vercel even when the backend is HTTP (avoids mixed-content blocking)
  // and doesn't depend on build-time env vars.
  const candidates: string[] = ["/api/upload", "/upload-data"];

  // Direct backend — only add when same protocol as current page (avoids mixed content).
  if (API_BASE && typeof window !== "undefined") {
    try {
      const backendProto = new URL(API_BASE).protocol;
      if (backendProto === window.location.protocol) {
        candidates.push(`${API_BASE}/upload-data`);
      }
    } catch {
      // ignore malformed URL
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

type UploadResponse = {
  tier?: string;
  group?: string;
  target_directory?: string;
  filename?: string;
  filenames?: string[];
  file_count?: number;
  skipped_files?: string[];
  skipped_existing_names?: string[];
  skipped_existing_duplicates?: string[];
  uploaded_lines?: number;
  valid_lines?: number;
  duplicates_in_upload?: number;
  duplicates_in_free?: number;
  added_lines?: number;
  indexed_lines?: number;
  index_failures?: number;
  partial_success?: boolean;
};

function formatBytes(bytes?: number) {
  const v = Number(bytes || 0);
  if (!v) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let s = v, i = 0;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return i === 0 ? `${Math.round(s)} B` : `${s.toFixed(2)} ${u[i]}`;
}

function unindexed(f: GroupFile) {
  if (typeof f.unindexed_lines === "number") return Math.max(0, f.unindexed_lines);
  return Math.max(0, Number(f.line_count || 0) - Number(f.indexed_lines || 0));
}

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Ready to upload.");
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [group, setGroup] = useState("default");
  const [newGroup, setNewGroup] = useState("");
  const [groupOptions, setGroupOptions] = useState<string[]>(["default"]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [summary, setSummary] = useState<FilesSummaryResponse | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
  const [indexingBusy, setIndexingBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: GroupFile } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endpoints = useMemo(() => uploadEndpoints(), []);

  const loadSummary = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const data = await api.filesSummary();
      setSummary(data);
      const src = tier === "free" ? data.free : data.premium;
      const groups = src?.groups?.map((g) => g.group).filter(Boolean) ?? [];
      const opts = Array.from(new Set(["default", ...groups])).sort();
      setGroupOptions(opts);
      setGroup((cur) => (opts.includes(cur) ? cur : opts[0] ?? "default"));
    } catch {
      // keep stale data
    } finally {
      setLoadingGroups(false);
    }
  }, [tier]);

  const pollIndexing = useCallback(async () => {
    try {
      const st = await api.indexingStatus();
      setIndexingStatus(st);
      return st;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => { void loadSummary(); void pollIndexing(); }, [loadSummary, pollIndexing]);

  const isRunning = Boolean(indexingStatus?.running);
  useEffect(() => {
    if (!isRunning) { setIndexingBusy(false); return; }
    const t = setInterval(() => {
      void pollIndexing().then((st) => {
        if (!st?.running) void loadSummary();
      });
    }, 2500);
    return () => clearInterval(t);
  }, [isRunning, pollIndexing, loadSummary]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, []);

  const tierSummary = tier === "free" ? summary?.free : summary?.premium;
  const groupSummary: GroupSummary | null = tierSummary?.groups?.find((g) => g.group === group) ?? null;
  const groupFiles = groupSummary?.files ?? [];
  const allSelected = groupFiles.length > 0 && selectedIds.length === groupFiles.length;
  const indexedLines = Number(groupSummary?.total_indexed_lines ?? 0);
  const unindexedLines = Number(groupSummary?.total_unindexed_lines ?? 0);
  const totalLines = Number(groupSummary?.total_line_count ?? 0);
  const indexPct = totalLines > 0 ? Math.min(100, Math.round((indexedLines / totalLines) * 100)) : 0;
  const livePct = isRunning ? (indexingStatus?.progress_percent ?? 0) : indexPct;

  const startBackgroundIndex = async () => {
    if (indexingBusy || isRunning) return;
    setIndexingBusy(true);
    try {
      const r = await api.reindexMissing();
      setStatus(r.started
        ? `Background indexing started — ${r.target_files ?? 0} file(s), ~${(r.pending_lines ?? 0).toLocaleString()} lines.`
        : r.message);
      await pollIndexing();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Failed to start indexing"}`);
      setIndexingBusy(false);
    }
  };

  const indexFile = async (file: GroupFile) => {
    if (indexingBusy || isRunning || tier !== "free") return;
    setIndexingBusy(true);
    try {
      const r = await api.reindexFiles(tier, [file.path]);
      const s = r.summary;
      setStatus(`Indexed file: ${file.name} — ${s.indexed_lines ?? 0} lines, ${s.failed_docs ?? 0} failures.`);
      await loadSummary();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Indexing failed"}`);
    } finally {
      setIndexingBusy(false);
    }
  };

  const deleteFile = async (file: GroupFile) => {
    if (!confirm(`Delete "${file.name}" from ${tier}/${group}?`)) return;
    setDeletingId(file.id);
    try {
      await api.deleteFile(tier, file.path);
      setStatus(`Deleted: ${file.name}`);
      await loadSummary();
      setSelectedIds((cur) => cur.filter((id) => id !== file.id));
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Delete failed"}`);
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelected = async () => {
    const files = groupFiles.filter((f) => selectedIds.includes(f.id));
    if (!files.length || !confirm(`Delete ${files.length} file(s)?`)) return;
    let ok = 0, fail = 0;
    for (const f of files) {
      try { await api.deleteFile(tier, f.path); ok++; } catch { fail++; }
    }
    setStatus(`Deleted ${ok} file(s)${fail ? `, ${fail} failed` : ""}.`);
    setSelectedIds([]);
    await loadSummary();
  };

  const createGroup = async () => {
    const name = newGroup.trim();
    if (!name) { setStatus("Enter a group name first."); return; }
    setCreatingGroup(true);
    try {
      const r = await api.createGroup(tier, name);
      setGroup(r.group);
      setNewGroup("");
      setStatus(`Group created: ${r.tier}/${r.group}`);
      await loadSummary();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Failed to create group"}`);
    } finally {
      setCreatingGroup(false);
    }
  };

  const uploadFiles = async (list: FileList | File[]) => {
    const files = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".txt"));
    if (!files.length) { setStatus("Please select .txt files."); return; }
    setUploading(true);
    setProgress(0);
    setStatus(`Uploading ${files.length} file(s)...`);
    const form = new FormData();
    form.append("tier", tier);
    form.append("group", group.trim() || "default");
    files.forEach((f) => form.append("files", f, f.name));

    const tryUpload = (url: string) =>
      new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.responseType = "json";
        xhr.timeout = 15 * 60 * 1000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          const p = xhr.response || {};
          if (xhr.status >= 200 && xhr.status < 300) resolve(p);
          else reject(new Error(p?.detail || `HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Timed out"));
        xhr.send(form);
      });

    try {
      let data: UploadResponse | null = null;
      let lastErr: Error | null = null;
      for (let i = 0; i < endpoints.length; i++) {
        if (i > 0) setStatus(`Retrying via ${endpoints[i]}...`);
        try { data = await tryUpload(endpoints[i]); break; }
        catch (e) { lastErr = e instanceof Error ? e : new Error("Upload failed"); }
      }
      if (!data) throw lastErr ?? new Error("Upload failed");
      const names = (data.filenames ?? [data.filename ?? ""]).filter(Boolean).join(", ");
      setStatus([
        "Upload complete.",
        `Tier: ${data.tier ?? tier} | Group: ${data.group ?? group}`,
        `Files: ${names || "N/A"} | Count: ${data.file_count ?? files.length}`,
        `Lines uploaded: ${data.uploaded_lines ?? 0} | Valid: ${data.valid_lines ?? 0}`,
        `Duplicates: ${data.duplicates_in_upload ?? 0} | Already exists: ${data.duplicates_in_free ?? 0}`,
        `Added: ${data.added_lines ?? 0} | Indexed: ${data.indexed_lines ?? 0}`,
        data.index_failures ? `Index failures: ${data.index_failures}` : "",
        data.partial_success ? "Note: saved to disk but ES indexing unavailable." : "",
      ].filter(Boolean).join("\n"));
      setProgress(100);
      await loadSummary();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Upload failed"}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-cyan-400">Files</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-100">Upload</h1>
        <p className="mt-1 text-sm text-slate-400">Drop .txt files to add them to the search index.</p>
      </div>

      {/* Drop zone */}
      <label
        htmlFor="upload-input"
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files); }}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${dragActive ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900/60 hover:border-slate-500"}`}
      >
        <svg className="mx-auto h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="mt-3 text-sm font-medium text-slate-300">Click or drop .txt files here</p>
        <p className="mt-1 text-xs text-slate-500">Multiple files supported</p>
        <div className="mx-auto mt-6 max-w-sm overflow-hidden rounded-full border border-slate-700 bg-slate-800">
          <div className="h-2 bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {uploading && <p className="mt-2 text-xs text-slate-400">Uploading... {progress}%</p>}
      </label>

      {/* Tier + Group */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <p className="text-sm font-medium text-slate-200">Destination</p>
        <div className="flex flex-wrap gap-3">
          {(["free", "premium"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded-lg border px-4 py-2 text-sm capitalize transition ${
                tier === t
                  ? t === "free"
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                    : "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">/url searches free-tier files only.</p>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            {loadingGroups ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="New group name (e.g. eu_batch_1)"
            onKeyDown={(e) => e.key === "Enter" && void createGroup()}
          />
          <button
            type="button"
            onClick={() => void createGroup()}
            disabled={creatingGroup}
            className="rounded-lg border border-emerald-600/50 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {creatingGroup ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>

      {/* Group details + Indexing */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-200">{tier} / {group}</p>
            <p className="text-xs text-slate-500">
              {groupSummary?.file_count ?? 0} files &bull; {formatBytes(groupSummary?.total_size_bytes)} &bull; {totalLines.toLocaleString()} lines
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tier === "free" && (
              <button
                type="button"
                onClick={() => void startBackgroundIndex()}
                disabled={indexingBusy || isRunning || unindexedLines === 0}
                className="rounded-lg border border-cyan-600/50 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
              >
                {indexingBusy || isRunning ? "Indexing..." : `Index Missing (${unindexedLines.toLocaleString()})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(groupFiles.map((f) => f.id))}
              disabled={allSelected || !groupFiles.length}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={!selectedIds.length}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void deleteSelected()}
              disabled={!selectedIds.length}
              className="rounded-lg border border-rose-600/50 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
            >
              Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>

        {/* Index progress bar */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Index coverage</span>
            <span className={unindexedLines > 0 ? "text-rose-400" : "text-emerald-400"}>
              {indexedLines.toLocaleString()} / {totalLines.toLocaleString()} lines
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isRunning ? "animate-pulse bg-cyan-400" : unindexedLines > 0 ? "bg-rose-400" : "bg-emerald-400"
              }`}
              style={{ width: `${livePct}%` }}
            />
          </div>
          {isRunning && (
            <p className="mt-1 text-xs text-slate-500">{indexingStatus?.message} — {indexingStatus?.current_file ?? ""}</p>
          )}
        </div>

        {/* File table */}
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" checked={allSelected} onChange={(e) => setSelectedIds(e.target.checked ? groupFiles.map((f) => f.id) : [])} />
                </th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Indexed</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {groupFiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-600">
                    No files in this group.
                  </td>
                </tr>
              )}
              {groupFiles.map((file) => {
                const notIndexed = unindexed(file);
                return (
                  <tr
                    key={file.id}
                    className="border-t border-slate-800 hover:bg-slate-800/40"
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, file }); }}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(file.id)}
                        onChange={() => setSelectedIds((cur) => cur.includes(file.id) ? cur.filter((i) => i !== file.id) : [...cur, file.id])}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`max-w-[220px] block truncate font-medium ${notIndexed > 0 ? "text-rose-300" : "text-slate-200"}`}>
                        {file.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{formatBytes(file.size_bytes)}</td>
                    <td className="px-3 py-2 text-slate-400">{file.line_count.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={notIndexed > 0 ? "text-rose-300" : "text-emerald-400"}>
                        {file.indexed_lines == null ? "—" : Number(file.indexed_lines).toLocaleString()}
                      </span>
                      <span className="text-slate-600"> / {file.line_count.toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{new Date(file.added_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status */}
      <pre className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
        {status}
      </pre>

      <input
        ref={inputRef}
        id="upload-input"
        type="file"
        accept=".txt,text/plain"
        multiple
        className="hidden"
        onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
        onChange={(e) => { if (e.currentTarget.files?.length) void uploadFiles(e.currentTarget.files); }}
      />

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400 truncate">{contextMenu.file.name}</div>
          <button
            className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => { void navigator.clipboard.writeText(contextMenu.file.name); setContextMenu(null); }}
          >
            Copy name
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => { void navigator.clipboard.writeText(contextMenu.file.path); setContextMenu(null); }}
          >
            Copy path
          </button>
          {tier === "free" && (
            <button
              className="block w-full px-3 py-2 text-left text-sm text-cyan-300 hover:bg-slate-800 disabled:opacity-50"
              disabled={indexingBusy || isRunning}
              onClick={() => { void indexFile(contextMenu.file); setContextMenu(null); }}
            >
              Index this file
            </button>
          )}
          <button
            className="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-800 disabled:opacity-50"
            disabled={deletingId === contextMenu.file.id}
            onClick={() => { void deleteFile(contextMenu.file); setContextMenu(null); }}
          >
            {deletingId === contextMenu.file.id ? "Deleting..." : "Delete file"}
          </button>
        </div>
      )}
    </div>
  );
}
