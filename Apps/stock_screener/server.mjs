import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);

const ROUTES = new Map([
  ["/", "prototype/index.html"],
  ["/index.html", "prototype/index.html"],
  ["/app", "prototype/app.html"],
  ["/app.html", "prototype/app.html"],
  ["/methodology", "prototype/methodology.html"],
  ["/methodology.html", "prototype/methodology.html"],
  ["/affiliate", "prototype/affiliate.html"],
  ["/affiliate.html", "prototype/affiliate.html"],
  ["/entity", "prototype/entity.html"],
  ["/entity.html", "prototype/entity.html"],
  ["/terms", "prototype/terms.html"],
  ["/terms.html", "prototype/terms.html"],
  ["/docs", "Documentation/INDEX.md"]
]);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolvePath(urlPath) {
  let pathname = ROUTES.get(urlPath) || urlPath.replace(/^\/+/, "");

  if (urlPath.startsWith("/assets/")) {
    pathname = `prototype${urlPath}`;
  }

  const candidate = path.resolve(__dirname, pathname || "prototype/index.html");

  if (!candidate.startsWith(__dirname)) {
    return null;
  }

  return candidate;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const filePath = resolvePath(url.pathname);

  if (!filePath) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`StockMap prototype server running at http://127.0.0.1:${PORT}`);
});
