// =============================================================================
// PM2 ecosystem — used by:
//   pm2 start ecosystem.config.js
//   pm2 reload ecosystem.config.js --update-env
//
// Two processes:
//   1. invoxai-app      — Next.js in cluster mode (cpu - 1, capped at 4)
//   2. invoxai-workers  — single fork-mode BullMQ worker process
//
// Both load .env.production via dotenv inside the app/worker entrypoints,
// so PM2 doesn't need to know any secrets.
// =============================================================================

const os = require("os");

// Cluster size — leave at least 1 core free for nginx + workers + sshd.
const APP_INSTANCES = Math.max(1, Math.min(4, (os.cpus()?.length ?? 2) - 1));

module.exports = {
  apps: [
    {
      name: "invoxai-app",
      cwd: "/var/www/invoxai",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "cluster",
      instances: APP_INSTANCES,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Bounce a process if it climbs over 512 MB (Next.js memory leaks happen).
      max_memory_restart: "512M",
      // Graceful reload — give Next a chance to drain the request queue.
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      // Logs
      out_file: "/var/log/invoxai/app.out.log",
      error_file: "/var/log/invoxai/app.err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      name: "invoxai-workers",
      cwd: "/var/www/invoxai",
      script: "node_modules/.bin/tsx",
      args: "workers/index.ts",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "256M",
      kill_timeout: 8000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      out_file: "/var/log/invoxai/workers.out.log",
      error_file: "/var/log/invoxai/workers.err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
