"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AdminState } from "../../lib/api";

type Tab = "general" | "discord" | "telegram" | "branding";

function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-300">{label}</label>
      {children}
      {help && <p className="text-[11px] text-slate-600">{help}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-cyan-500" : "bg-slate-700"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

function IdsField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: unknown[];
  onChange: (v: number[]) => void;
  help?: string;
}) {
  const text = (value ?? []).join(", ");
  return (
    <Field label={label} help={help}>
      <input
        type="text"
        defaultValue={text}
        onBlur={(e) => {
          const ids = e.target.value
            .split(/[\s,]+/)
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0);
          onChange(ids);
        }}
        placeholder="Comma-separated IDs"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
      />
    </Field>
  );
}

export default function SettingsPage() {
  const [state, setState] = useState<AdminState | null>(null);
  const [patch, setPatch] = useState<Record<string, Record<string, unknown>>>({
    general: {},
    discord: {},
    telegram: {},
    branding: {},
  });
  const [tab, setTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.getState();
      setState(s);
      setPatch({ general: {}, discord: {}, telegram: {}, branding: {} });
    } catch (e) {
      setMsg({ text: `Load error: ${e instanceof Error ? e.message : "Failed"}`, ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function get(section: string, key: string, fallback: unknown = ""): unknown {
    const patchVal = (patch[section] as Record<string, unknown>)?.[key];
    if (patchVal !== undefined) return patchVal;
    return (state?.settings?.[section as keyof typeof state.settings] as Record<string, unknown>)?.[key] ?? fallback;
  }

  function set(section: string, key: string, value: unknown) {
    setPatch((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
  }

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const payload: Record<string, unknown> = {};
    for (const [section, changes] of Object.entries(patch)) {
      if (Object.keys(changes).length > 0) payload[section] = changes;
    }
    if (!Object.keys(payload).length) {
      setMsg({ text: "No changes to save.", ok: true });
      setSaving(false);
      return;
    }
    try {
      const updated = await api.updateState(payload);
      setState(updated);
      setPatch({ general: {}, discord: {}, telegram: {}, branding: {} });
      setMsg({ text: "Settings saved successfully.", ok: true });
    } catch (e) {
      setMsg({ text: `Save error: ${e instanceof Error ? e.message : "Failed"}`, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Reset all settings to defaults? This cannot be undone.")) return;
    setResetting(true);
    try {
      const updated = await api.resetState();
      setState(updated);
      setPatch({ general: {}, discord: {}, telegram: {}, branding: {} });
      setMsg({ text: "Settings reset to defaults.", ok: true });
    } catch (e) {
      setMsg({ text: `Reset error: ${e instanceof Error ? e.message : "Failed"}`, ok: false });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">Loading settings...</div>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "discord", label: "Discord" },
    { id: "telegram", label: "Telegram" },
    { id: "branding", label: "Branding" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">Configuration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">Settings</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void reset()}
            disabled={resetting}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Defaults"}
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg border border-cyan-600/50 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${tab === t.id ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-5">
        {/* General */}
        {tab === "general" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Maintenance Mode</p>
                <p className="text-xs text-slate-500">Block all bot commands</p>
              </div>
              <Toggle checked={Boolean(get("general", "maintenance_mode", false))} onChange={(v) => set("general", "maintenance_mode", v)} />
            </div>
            <hr className="border-slate-800" />
            <Field label="Watermark" help="Appended to all search results">
              <textarea
                value={String(get("general", "watermark", ""))}
                onChange={(e) => set("general", "watermark", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Credit Cost per Search">
                <Input value={String(get("general", "credit_cost_per_url", 1))} onChange={(v) => set("general", "credit_cost_per_url", parseInt(v, 10) || 1)} type="number" />
              </Field>
              <Field label="Daily Claim Amount">
                <Input value={String(get("general", "daily_claim_amount", 3))} onChange={(v) => set("general", "daily_claim_amount", parseInt(v, 10) || 0)} type="number" />
              </Field>
              <Field label="Initial Credits (new users)">
                <Input value={String(get("general", "initial_credits", 3))} onChange={(v) => set("general", "initial_credits", parseInt(v, 10) || 0)} type="number" />
              </Field>
              <Field label="Referral Credit Reward">
                <Input value={String(get("general", "referral_credit_reward", 1))} onChange={(v) => set("general", "referral_credit_reward", parseInt(v, 10) || 0)} type="number" />
              </Field>
              <Field label="Query Default Size">
                <Input value={String(get("general", "query_default_size", 200))} onChange={(v) => set("general", "query_default_size", parseInt(v, 10) || 200)} type="number" />
              </Field>
              <Field label="Query Max Size">
                <Input value={String(get("general", "query_max_size", 1000))} onChange={(v) => set("general", "query_max_size", parseInt(v, 10) || 1000)} type="number" />
              </Field>
              <Field label="Cache TTL (seconds)">
                <Input value={String(get("general", "cache_ttl", 3600))} onChange={(v) => set("general", "cache_ttl", parseInt(v, 10) || 3600)} type="number" />
              </Field>
              <Field label="Request Timeout (seconds)">
                <Input value={String(get("general", "request_timeout_seconds", 120))} onChange={(v) => set("general", "request_timeout_seconds", parseInt(v, 10) || 120)} type="number" />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">GoFile Upload Enabled</p>
                <p className="text-xs text-slate-500">Upload oversized results to GoFile</p>
              </div>
              <Toggle checked={Boolean(get("general", "gofile_enabled", true))} onChange={(v) => set("general", "gofile_enabled", v)} />
            </div>
          </>
        )}

        {/* Discord */}
        {tab === "discord" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Discord Bot Enabled</p>
              </div>
              <Toggle checked={Boolean(get("discord", "enabled", true))} onChange={(v) => set("discord", "enabled", v)} />
            </div>
            <hr className="border-slate-800" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Presence Status">
                <select
                  value={String(get("discord", "presence_status", "online"))}
                  onChange={(e) => set("discord", "presence_status", e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {["online", "idle", "dnd", "invisible"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Presence Activity Type">
                <select
                  value={String(get("discord", "presence_activity_type", "playing"))}
                  onChange={(e) => set("discord", "presence_activity_type", e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {["playing", "watching", "listening", "streaming"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Presence Text">
              <Input value={String(get("discord", "presence_text", ""))} onChange={(v) => set("discord", "presence_text", v)} />
            </Field>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Require Status Text</p>
                <p className="text-xs text-slate-500">Users must have specific status to use bot</p>
              </div>
              <Toggle checked={Boolean(get("discord", "require_status_text", true))} onChange={(v) => set("discord", "require_status_text", v)} />
            </div>
            <Field label="Required Status Text">
              <Input value={String(get("discord", "required_status_text", ""))} onChange={(v) => set("discord", "required_status_text", v)} />
            </Field>
            <Field label="Status Access Role ID" help="Role ID that grants access when status requirement is enabled">
              <Input value={String(get("discord", "status_access_role_id", ""))} onChange={(v) => set("discord", "status_access_role_id", parseInt(v, 10) || null)} />
            </Field>
            <Field label="Cooldown (seconds)" help="Per-user search cooldown (0 = disabled)">
              <Input value={String(get("discord", "cooldown_seconds", 0))} onChange={(v) => set("discord", "cooldown_seconds", parseInt(v, 10) || 0)} type="number" />
            </Field>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Ephemeral Responses</p>
                <p className="text-xs text-slate-500">Only the requesting user sees results</p>
              </div>
              <Toggle checked={Boolean(get("discord", "ephemeral", false))} onChange={(v) => set("discord", "ephemeral", v)} />
            </div>
            <hr className="border-slate-800" />
            <IdsField
              label="Allowed Channel IDs"
              value={(get("discord", "allowed_channel_ids") as unknown[]) ?? []}
              onChange={(v) => set("discord", "allowed_channel_ids", v)}
              help="Bot only responds in these channels (empty = all)"
            />
            <IdsField
              label="Allowed Role IDs"
              value={(get("discord", "allowed_role_ids") as unknown[]) ?? []}
              onChange={(v) => set("discord", "allowed_role_ids", v)}
            />
            <IdsField
              label="Allowed User IDs"
              value={(get("discord", "allowed_user_ids") as unknown[]) ?? []}
              onChange={(v) => set("discord", "allowed_user_ids", v)}
            />
            <IdsField
              label="Owner User IDs"
              value={(get("discord", "owner_user_ids") as unknown[]) ?? []}
              onChange={(v) => set("discord", "owner_user_ids", v)}
            />
            <IdsField
              label="Owner Role IDs"
              value={(get("discord", "owner_role_ids") as unknown[]) ?? []}
              onChange={(v) => set("discord", "owner_role_ids", v)}
            />
            <hr className="border-slate-800" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Button Labels</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {["full", "email_pass", "both"].map((key) => (
                <Field key={key} label={key}>
                  <Input
                    value={String((get("discord", "button_labels") as Record<string, string>)?.[key] ?? "")}
                    onChange={(v) => {
                      const cur = (get("discord", "button_labels") as Record<string, string>) ?? {};
                      set("discord", "button_labels", { ...cur, [key]: v });
                    }}
                  />
                </Field>
              ))}
            </div>
          </>
        )}

        {/* Telegram */}
        {tab === "telegram" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Telegram Bot Enabled</p>
              </div>
              <Toggle checked={Boolean(get("telegram", "enabled", true))} onChange={(v) => set("telegram", "enabled", v)} />
            </div>
            <hr className="border-slate-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Require Channel Subscription</p>
                <p className="text-xs text-slate-500">Users must join channel before using bot</p>
              </div>
              <Toggle checked={Boolean(get("telegram", "require_subscription", true))} onChange={(v) => set("telegram", "require_subscription", v)} />
            </div>
            <Field label="Required Join Link">
              <Input value={String(get("telegram", "required_join_link", ""))} onChange={(v) => set("telegram", "required_join_link", v)} />
            </Field>
            <Field label="Cooldown (seconds)">
              <Input value={String(get("telegram", "cooldown_seconds", 0))} onChange={(v) => set("telegram", "cooldown_seconds", parseInt(v, 10) || 0)} type="number" />
            </Field>
            <hr className="border-slate-800" />
            <IdsField
              label="Allowed Chat IDs"
              value={(get("telegram", "allowed_chat_ids") as unknown[]) ?? []}
              onChange={(v) => set("telegram", "allowed_chat_ids", v)}
              help="Bot only responds in these chats (empty = all)"
            />
            <IdsField
              label="Allowed User IDs"
              value={(get("telegram", "allowed_user_ids") as unknown[]) ?? []}
              onChange={(v) => set("telegram", "allowed_user_ids", v)}
            />
            <IdsField
              label="Owner User IDs"
              value={(get("telegram", "owner_user_ids") as unknown[]) ?? []}
              onChange={(v) => set("telegram", "owner_user_ids", v)}
            />
            <hr className="border-slate-800" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Button Labels</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {["full", "email_pass", "both"].map((key) => (
                <Field key={key} label={key}>
                  <Input
                    value={String((get("telegram", "button_labels") as Record<string, string>)?.[key] ?? "")}
                    onChange={(v) => {
                      const cur = (get("telegram", "button_labels") as Record<string, string>) ?? {};
                      set("telegram", "button_labels", { ...cur, [key]: v });
                    }}
                  />
                </Field>
              ))}
            </div>
          </>
        )}

        {/* Branding */}
        {tab === "branding" && (
          <>
            <Field label="App Name">
              <Input value={String(get("branding", "app_name", "ULPBot Control Center"))} onChange={(v) => set("branding", "app_name", v)} />
            </Field>
            <Field label="Tagline">
              <Input value={String(get("branding", "tagline", ""))} onChange={(v) => set("branding", "tagline", v)} />
            </Field>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg border border-cyan-600/50 bg-cyan-500/15 px-6 py-2 text-sm text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
