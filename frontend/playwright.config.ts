import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, "../backend");
const backendPort = Number(process.env.M8_BACKEND_PORT ?? 18082);
const frontendPort = Number(process.env.M8_FRONTEND_PORT ?? 15182);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const dataDir = path.join(tmpdir(), `ledgerflow-m8-browser-${process.pid}`);
const java = process.env.JAVA_HOME
  ? `"${path.join(process.env.JAVA_HOME, "bin", "java.exe")}"`
  : "java";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/m8",
  use: { baseURL: frontendUrl, browserName: "chromium", channel: "msedge", actionTimeout: 15_000, trace: "retain-on-failure" },
  webServer: [
    {
      command: `${java} -Dlogging.level.root=WARN -jar "${path.join(backendDir, "target", "ledgerflow-backend-0.1.0.jar")}" --server.port=${backendPort}`,
      cwd: backendDir,
      url: `${backendUrl}/api/health`,
      timeout: 90_000,
      reuseExistingServer: false,
      env: {
        LEDGERFLOW_DATA_DIR: dataDir,
        LEDGERFLOW_ALLOWED_ORIGINS: frontendUrl,
        LEDGERFLOW_BACKUP_PBKDF2_ITERATIONS: "100000",
      },
    },
    {
      command: `npm.cmd run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      cwd: frontendDir,
      url: `${frontendUrl}/login`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { VITE_API_BASE_URL: backendUrl },
    },
  ],
});
