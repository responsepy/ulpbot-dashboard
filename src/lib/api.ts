// All paths are relative — Next.js rewrites proxy them to the backend.

export type HealthResponse = {
  status: string;
  services: { elasticsearch: boolean; redis: boolean };
};

export type RuntimeStatusResponse = {
  api: { online: boolean; message: string };
  discord?: { online: boolean; message?: string };
  telegram?: { online: boolean; message?: string };
};

export type AnalyticsResponse = {
  total_searches?: number;
  total_credits_used?: number;
  unique_users?: number;
  daily?: Array<{ date: string; searches: number; credits: number }>;
  top_searches?: Array<{ query: string; count: number }>;
  top_users?: Array<{ user: string; count: number }>;
};

export type AdminState = {
  settings: {
    general: Record<string, unknown>;
    branding: Record<string, unknown>;
    discord: Record<string, unknown>;
    telegram: Record<string, unknown>;
  };
  health: HealthResponse;
  runtime_tuning: { index_batch_size: number; index_workers: number };
};

export type UserSummary = {
  platform: "discord" | "telegram";
  user_id: number;
  name: string;
  username: string;
  display_name: string;
  profile_picture: string;
  premium: boolean;
  credits: number;
  credits_display: string;
  blocked: boolean;
  access: string;
};

export type IndexingStatus = {
  running: boolean;
  status: string;
  job_type?: string;
  message: string;
  started_at?: string | null;
  finished_at?: string | null;
  target_files?: number;
  checked_files?: number;
  pending_lines?: number;
  processed_lines?: number;
  processed_files?: number;
  indexed_lines?: number;
  indexed_docs?: number;
  failed_docs?: number;
  reindexed_files?: number;
  progress_percent?: number;
  current_file?: string | null;
  last_error?: string | null;
};

export type LogEntry = {
  name: string;
  path: string;
  size_bytes?: number;
  updated_at?: string;
  total_lines?: number;
  tail_lines?: number;
  truncated?: boolean;
  content?: string;
  error?: string;
};

export type GroupFile = {
  name: string;
  path: string;
  id: string;
  size_bytes: number;
  line_count: number;
  added_at: string;
  indexed_lines?: number | null;
  unindexed_lines?: number;
};

export type GroupSummary = {
  group: string;
  file_count?: number;
  total_size_bytes?: number;
  total_line_count?: number;
  total_indexed_lines?: number;
  total_unindexed_lines?: number;
  files?: GroupFile[];
};

export type TierSummary = {
  directory: string;
  file_count: number;
  total_size_bytes: number;
  total_line_count: number;
  total_indexed_lines: number;
  total_unindexed_lines: number;
  group_count: number;
  groups: GroupSummary[];
};

export type FilesSummaryResponse = {
  free?: TierSummary;
  premium?: TierSummary;
};

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...opts, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      detail = JSON.parse(text)?.detail ?? text;
    } catch {
      // leave as-is
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  health: () => apiFetch<HealthResponse>("/health"),
  runtimeStatus: () => apiFetch<RuntimeStatusResponse>("/runtime/status"),
  analytics: () => apiFetch<AnalyticsResponse>("/analytics/summary"),

  getState: () => apiFetch<AdminState>("/admin/state"),
  updateState: (patch: Record<string, unknown>) =>
    apiFetch<AdminState>("/admin/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  resetState: () => apiFetch<AdminState>("/admin/state/reset", { method: "POST" }),

  users: () => apiFetch<{ items: UserSummary[] }>("/admin/users"),
  manageUser: (payload: {
    platform: string;
    user_id: number;
    action: string;
    amount?: number;
  }) => apiFetch<{ ok: boolean; user?: UserSummary; deleted?: boolean }>("/admin/users/manage", json(payload)),

  logs: (tailLines = 2000) =>
    apiFetch<{ items: LogEntry[]; tail_lines: number }>(`/api/logs?tail_lines=${tailLines}`),
  clearLogs: () => apiFetch<{ cleared_count: number; failed_count: number }>("/api/logs/clear", { method: "POST" }),

  filesSummary: () => apiFetch<FilesSummaryResponse>("/files/summary"),
  deleteFile: (tier: string, path: string) =>
    apiFetch<{ deleted: boolean }>("/files/delete", json({ tier, path })),
  createGroup: (tier: string, group: string) =>
    apiFetch<{ tier: string; group: string; path: string }>("/files/groups/create", json({ tier, group })),

  indexingStatus: () => apiFetch<IndexingStatus>("/admin/indexing/status"),
  reindexMissing: () =>
    apiFetch<{ started: boolean; message: string; target_files?: number; pending_lines?: number }>(
      "/admin/indexing/reindex-missing",
      { method: "POST" },
    ),
  reindexFiles: (tier: string, paths: string[]) =>
    apiFetch<{ ok: boolean; summary: Record<string, number> }>("/admin/indexing/reindex-files", json({ tier, paths })),

  broadcastSend: (message: string, platform: "discord" | "telegram" | "both") =>
    apiFetch<{
      sent: number;
      platform: string;
      message: string;
      sent_by_platform: Record<string, number>;
      failures: string[];
    }>("/broadcast/send", json({ message, platform })),

  restartServices: () =>
    apiFetch<{ scheduled: boolean; message: string }>("/admin/restart-services", { method: "POST" }),
};
