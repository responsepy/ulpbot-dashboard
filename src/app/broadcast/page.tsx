"use client";

import { useState } from "react";
import { api } from "../../lib/api";

type Platform = "discord" | "telegram" | "both";

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<Platform>("both");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    sent_by_platform: Record<string, number>;
    failures: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!message.trim()) { setError("Message cannot be empty."); return; }
    if (!confirm(`Send broadcast to ${platform}?\n\n"${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`)) return;
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const r = await api.broadcastSend(message.trim(), platform);
      setResult(r);
      if (!r.failures.length) setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const isLong = charCount > 3500;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-cyan-400">Messaging</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-100">Broadcast</h1>
        <p className="mt-1 text-sm text-slate-400">Send a message to all users on Discord and/or Telegram.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        {/* Platform selector */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-400">Target Platform</p>
          <div className="flex gap-2">
            {(["both", "discord", "telegram"] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`rounded-lg border px-4 py-2 text-sm capitalize transition-colors ${
                  platform === p
                    ? p === "discord"
                      ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                      : p === "telegram"
                      ? "border-sky-500/40 bg-sky-500/15 text-sky-200"
                      : "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                }`}
              >
                {p === "both" ? "Both Platforms" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Platform notes */}
        <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-500 space-y-0.5">
          <p><span className="text-indigo-400">Discord:</span> Sends to the configured broadcast channel.</p>
          <p><span className="text-sky-400">Telegram:</span> Sends to all known users (from Redis broadcast set + allowed list).</p>
        </div>

        {/* Message input */}
        <div>
          <div className="mb-1 flex justify-between">
            <p className="text-xs font-medium text-slate-400">Message</p>
            <span className={`text-xs ${isLong ? "text-rose-400" : "text-slate-600"}`}>{charCount}/4096</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            placeholder="Type your broadcast message here..."
            maxLength={4096}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none resize-y"
          />
          {isLong && (
            <p className="mt-1 text-xs text-rose-400">Messages over 3500 characters may fail on some platforms.</p>
          )}
        </div>

        <button
          onClick={() => void send()}
          disabled={sending || !message.trim()}
          className="w-full rounded-lg border border-cyan-600/50 bg-cyan-500/15 py-3 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50 transition-colors"
        >
          {sending ? "Sending..." : `Send Broadcast to ${platform === "both" ? "Discord + Telegram" : platform.charAt(0).toUpperCase() + platform.slice(1)}`}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
          <p className="text-sm font-medium text-emerald-300">
            Broadcast sent — {result.sent} message{result.sent !== 1 ? "s" : ""} delivered
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="text-slate-500">Discord</p>
              <p className="mt-1 font-semibold text-indigo-300">{result.sent_by_platform?.discord ?? 0} sent</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="text-slate-500">Telegram</p>
              <p className="mt-1 font-semibold text-sky-300">{result.sent_by_platform?.telegram ?? 0} sent</p>
            </div>
          </div>
          {result.failures.length > 0 && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <p className="text-xs font-medium text-rose-300 mb-1">Failures ({result.failures.length})</p>
              {result.failures.map((f, i) => (
                <p key={i} className="text-xs text-slate-500">{f}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message preview */}
      {message.trim() && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-2 text-xs font-medium text-slate-500">Preview</p>
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
            <p className="text-xs text-slate-500 mb-2">Broadcast</p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
