"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { UserSummary } from "../../lib/api";

type Platform = "all" | "discord" | "telegram";
type Action = "grant_premium" | "revoke_premium" | "add_credits" | "remove_credits" | "block_access" | "unblock_access" | "delete_user";

/* eslint-disable @next/next/no-img-element */
function Avatar({ src, name }: { src?: string; name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-300">
      {initials || "?"}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
        platform === "discord" ? "bg-indigo-500/20 text-indigo-300" : "bg-sky-500/20 text-sky-300"
      }`}
    >
      {platform}
    </span>
  );
}

function UserRow({
  user,
  onAction,
  busy,
}: {
  user: UserSummary;
  onAction: (user: UserSummary, action: Action, amount?: number) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [creditAmount, setCreditAmount] = useState("10");

  return (
    <>
      <tr
        className={`border-t border-slate-800 cursor-pointer hover:bg-slate-800/40 ${expanded ? "bg-slate-800/20" : ""}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar src={user.profile_picture} name={user.name} />
            <div>
              <p className="text-sm font-medium text-slate-200">{user.name}</p>
              {user.username && <p className="text-xs text-slate-500">@{user.username}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><PlatformBadge platform={user.platform} /></td>
        <td className="px-4 py-3 text-xs text-slate-400 font-mono">{user.user_id}</td>
        <td className="px-4 py-3">
          {user.premium ? (
            <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">Premium</span>
          ) : (
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">Free</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-slate-300">{user.credits_display}</td>
        <td className="px-4 py-3">
          {user.blocked ? (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-300">Blocked</span>
          ) : (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Active</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-slate-800/50 bg-slate-900/50">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {user.premium ? (
                <button
                  disabled={busy}
                  onClick={() => onAction(user, "revoke_premium")}
                  className="rounded-lg border border-fuchsia-600/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
                >
                  Revoke Premium
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => onAction(user, "grant_premium")}
                  className="rounded-lg border border-fuchsia-600/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
                >
                  Grant Premium
                </button>
              )}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  min="1"
                />
                <button
                  disabled={busy}
                  onClick={() => onAction(user, "add_credits", parseInt(creditAmount, 10))}
                  className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  + Credits
                </button>
                <button
                  disabled={busy}
                  onClick={() => onAction(user, "remove_credits", parseInt(creditAmount, 10))}
                  className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  - Credits
                </button>
              </div>
              {user.blocked ? (
                <button
                  disabled={busy}
                  onClick={() => onAction(user, "unblock_access")}
                  className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  Unblock
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => onAction(user, "block_access")}
                  className="rounded-lg border border-rose-600/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  Block
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm(`Delete ${user.name} (${user.platform}:${user.user_id})? This removes all their data.`)) {
                    onAction(user, "delete_user");
                  }
                }}
                className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-900/40 disabled:opacity-50"
              >
                Delete User
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Platform>("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.users();
      setUsers(r.items ?? []);
    } catch (e) {
      setMsg({ text: `Load error: ${e instanceof Error ? e.message : "Failed"}`, ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAction = async (user: UserSummary, action: Action, amount?: number) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.manageUser({ platform: user.platform, user_id: user.user_id, action, amount });
      if (r.deleted) {
        setUsers((cur) => cur.filter((u) => !(u.platform === user.platform && u.user_id === user.user_id)));
        setMsg({ text: `Deleted user ${user.name}.`, ok: true });
      } else if (r.user) {
        setUsers((cur) => cur.map((u) => (u.platform === user.platform && u.user_id === user.user_id ? r.user! : u)));
        setMsg({ text: `Updated ${user.name}: ${action.replace(/_/g, " ")}.`, ok: true });
      }
    } catch (e) {
      setMsg({ text: `Error: ${e instanceof Error ? e.message : "Action failed"}`, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const filtered = users.filter((u) => {
    if (filter !== "all" && u.platform !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        String(u.user_id).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">Access</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">Users</h1>
          <p className="mt-1 text-sm text-slate-400">{users.length} configured user{users.length !== 1 ? "s" : ""} — click a row to manage</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, or ID..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
        />
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1">
          {(["all", "discord", "telegram"] as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === p ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/60 text-xs text-slate-400">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading users...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {search || filter !== "all" ? "No users match the filter." : "No configured users found. Add user IDs in Settings."}
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <UserRow key={`${u.platform}:${u.user_id}`} user={u} onAction={handleAction} busy={busy} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        {[
          { label: "Total Users", value: users.length },
          { label: "Premium", value: users.filter((u) => u.premium).length, accent: "text-fuchsia-300" },
          { label: "Blocked", value: users.filter((u) => u.blocked).length, accent: "text-rose-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p className="text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.accent ?? "text-slate-200"}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
