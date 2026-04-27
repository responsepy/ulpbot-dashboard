/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from external domains (Telegram/Discord avatars)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.discordapp.com" },
      { protocol: "https", hostname: "**.discord.com" },
      { protocol: "https", hostname: "t.me" },
    ],
  },

  async rewrites() {
    const backendBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000")
      .trim()
      .replace(/\/+$/, "");

    return [
      { source: "/health", destination: `${backendBase}/health` },
      { source: "/runtime/status", destination: `${backendBase}/runtime/status` },
      { source: "/analytics/summary", destination: `${backendBase}/analytics/summary` },
      { source: "/reports", destination: `${backendBase}/reports` },
      { source: "/search", destination: `${backendBase}/search` },

      // Files
      { source: "/files/summary", destination: `${backendBase}/files/summary` },
      { source: "/files/delete", destination: `${backendBase}/files/delete` },
      { source: "/files/groups/create", destination: `${backendBase}/files/groups/create` },
      { source: "/upload-data", destination: `${backendBase}/upload-data` },

      // Logs
      { source: "/api/logs", destination: `${backendBase}/logs` },
      { source: "/api/logs/clear", destination: `${backendBase}/logs/clear` },

      // Admin
      { source: "/admin/state", destination: `${backendBase}/admin/state` },
      { source: "/admin/state/reset", destination: `${backendBase}/admin/state/reset` },
      { source: "/admin/users", destination: `${backendBase}/admin/users` },
      { source: "/admin/users/manage", destination: `${backendBase}/admin/users/manage` },
      { source: "/admin/restart-services", destination: `${backendBase}/admin/restart-services` },

      // Indexing
      { source: "/admin/indexing/status", destination: `${backendBase}/admin/indexing/status` },
      { source: "/admin/indexing/reindex-missing", destination: `${backendBase}/admin/indexing/reindex-missing` },
      { source: "/admin/indexing/reindex-files", destination: `${backendBase}/admin/indexing/reindex-files` },
      { source: "/admin/indexing/tune", destination: `${backendBase}/admin/indexing/tune` },

      // Broadcast
      { source: "/broadcast/send", destination: `${backendBase}/broadcast/send` },
    ];
  },
};

export default nextConfig;
