import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { voiceProxy } from "./server/voiceProxy";
import { createApiHandler } from "./server/http";

// Build conventions mirror Kissflow's @kissflow/create-app scaffold so the bundle can be
// uploaded as a Custom UI (Phase 6): relative base, single React copy, manifest.json in dist.
export default defineConfig(({ mode }) => {
  // Secrets live in the project-root .env (never VITE_-prefixed, so never bundled).
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  // The AI backend reads its secrets from process.env (as on Cloud Run). Copied here for the dev server process only.
  for (const k of ["GEMINI_API_KEY", "GEMINI_LIVE_MODEL", "GEMINI_TEXT_MODEL", "KF_DOMAIN", "KF_ACCOUNT_ID", "KF_ACCESS_KEY_ID", "KF_ACCESS_KEY_SECRET"])
    if (env[k] !== undefined && env[k] !== "" && process.env[k] === undefined) process.env[k] = env[k];
  return {
  plugins: [
    react(),
    tailwindcss(),
    {
      // Dev-only voice brain proxy (Claude). The Custom UI bundle has no server; it falls back to the demo brain.
      name: "cafm-voice-proxy",
      configureServer(server) {
        server.middlewares.use(voiceProxy(env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY, env.CAFM_VOICE_MODEL || "claude-opus-5"));
      }
    },
    {
      // AI backend (Gemini tokens, AI settings) + the dev-only Kissflow proxy so local dev runs on live Kissflow data.
      name: "cafm-ai-api",
      configureServer(server) {
        const handle = createApiHandler({ devKfProxy: true });
        server.middlewares.use((req, res, next) => { void handle(req, res, next); });
      }
    },
    {
      name: "emit-kf-manifest",
      writeBundle() {
        writeFileSync(
          path.resolve(__dirname, "dist/manifest.json"),
          JSON.stringify({ Category: "Application", Framework: "React" }, null, 2)
        );
      }
    }
  ],
  base: "",
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: { "@": path.resolve(__dirname, "src") }
  },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  server: { port: 5188, host: "127.0.0.1", strictPort: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
  } as never;
});
