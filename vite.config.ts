import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
/**
 * Serves the contact endpoint during `npm run dev`.
 *
 * The deployed site gets `/api/contact` from the platform; the dev server
 * would otherwise 404 it and the form could only ever be tested in
 * production. This mounts the *same* handler module, so what is exercised
 * locally is the real validation, sanitisation, rate limiting and payload
 * building rather than a stub that can drift from them.
 *
 * Dev only: `configureServer` never runs in a build, and nothing here is
 * reachable from the client bundle.
 */
function contactApiDevServer(): Plugin {
  return {
    name: "contact-api-dev-server",
    configureServer(server) {
      // Vite only exposes `VITE_`-prefixed variables to the client, and puts
      // nothing on `process.env`. The empty prefix loads everything from
      // `.env` for this server-side route only, which is what lets the real
      // credentials stay unprefixed and therefore unreachable from the bundle.
      const env = { ...process.env, ...loadEnv(server.config.mode, process.cwd(), "") };

      server.middlewares.use("/api/contact", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);

        const { handleContact } = await server.ssrLoadModule("/api/_contact.ts");
        let result;
        try {
          result = await handleContact(
            JSON.parse(Buffer.concat(chunks).toString() || "{}"),
            env,
            req.socket.remoteAddress ?? "dev",
          );
        } catch {
          result = { status: 400, body: { ok: false, error: "Malformed request." } };
        }
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contactApiDevServer()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    watch: {
      // Documents kept alongside the project, not sources. Vite watches the
      // whole root by default, and a PDF that is open in a viewer is locked
      // on Windows: the watcher throws EBUSY on it and takes the whole dev
      // server down with it. Nothing here is ever imported, so there is no
      // reason to watch it.
      ignored: ['**/Certificates/**'],
    },
  },
})
