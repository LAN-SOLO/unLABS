import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";
import { request as httpRequest } from "http";

let server: Server | null = null;

/**
 * Lightweight API gateway that routes Supabase client requests to the
 * correct backend service. @supabase/supabase-js expects a single URL
 * and appends /auth/v1 and /rest/v1 paths.
 */
export async function startGateway(
  port: number,
  gotruePort: number,
  postgrestPort: number,
  appOrigins: readonly string[],
): Promise<void> {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set(appOrigins);
  return new Promise<void>((resolve) => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? "/";

      // Only the game may talk to the local database. Browsers always send
      // Origin on cross-origin requests, so a web page the player visits in
      // their normal browser is rejected here; a foreign Host header means
      // DNS rebinding. Server-side calls from Next.js send no Origin.
      const origin = req.headers.origin;
      if (!hosts.has(req.headers.host ?? "") || (origin !== undefined && !origins.has(origin))) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return;
      }

      let targetPort: number;
      let targetPath: string;

      if (url.startsWith("/auth/v1")) {
        // Route to GoTrue, strip the /auth/v1 prefix
        targetPort = gotruePort;
        targetPath = url.replace("/auth/v1", "") || "/";
      } else if (url.startsWith("/rest/v1")) {
        // Route to PostgREST, strip the /rest/v1 prefix
        targetPort = postgrestPort;
        targetPath = url.replace("/rest/v1", "") || "/";
      } else {
        // Unknown route
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      // Proxy the request
      const proxyReq = httpRequest(
        {
          hostname: "127.0.0.1",
          port: targetPort,
          path: targetPath,
          method: req.method,
          headers: {
            ...forwardHeaders(req),
            host: `127.0.0.1:${targetPort}`,
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );

      proxyReq.on("error", (err) => {
        console.error("[gateway] Proxy error:", err.message);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Bad gateway" }));
        }
      });

      req.pipe(proxyReq);
    });

    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });
}

/** Request headers minus client-supplied proxy headers (rate-limit spoofing). */
function forwardHeaders(req: IncomingMessage): IncomingMessage["headers"] {
  const headers = { ...req.headers };
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-real-ip"];
  return headers;
}

export function stopGateway(): void {
  if (server) {
    server.close();
    server = null;
  }
}
