const fs = require("fs");
const http = require("http");
const path = require("path");
const url = require("url");
const {
  build,
  collections,
  contentRoot,
  readContentFile,
  renderMarkdown,
  slugify,
  writeContentFile,
} = require("./build");

const root = path.resolve(__dirname, "..");
const pagesRoot = path.join(contentRoot, "pages");
const port = Number(process.env.PORT || 8010);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function safeJoin(base, requestedPath) {
  const resolved = path.resolve(base, requestedPath);
  if (!resolved.startsWith(base)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function listPages() {
  return fs
    .readdirSync(pagesRoot)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const slug = path.basename(file, ".md");
      const { meta, body } = readContentFile(path.join(pagesRoot, file));
      return { slug, title: meta.title || slug, intro: meta.intro || "", body };
    });
}

function listItems(collectionKey) {
  const config = collections[collectionKey];
  const sourceDir = path.join(contentRoot, config.sourceDir);
  if (!fs.existsSync(sourceDir)) return [];
  return fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const { meta, body } = readContentFile(path.join(sourceDir, file));
      return {
        slug: meta.slug || path.basename(file, ".md"),
        title: meta.title || path.basename(file, ".md"),
        date: meta.date || "",
        type: meta.type || config.label,
        summary: meta.summary || "",
        source: meta.source || "",
        image: meta.image || "",
        body,
      };
    });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/state") {
    return send(res, 200, {
      collections: Object.fromEntries(
        Object.entries(collections).map(([key, config]) => [
          key,
          {
            label: config.label,
            plural: config.plural,
            pageSlug: config.pageSlug,
            items: listItems(key),
          },
        ]),
      ),
      pages: listPages(),
    });
  }

  if (req.method === "POST" && pathname === "/api/preview") {
    const body = await readBody(req);
    return send(res, 200, { html: renderMarkdown(body.markdown || "") });
  }

  if (req.method === "POST" && pathname === "/api/page") {
    const body = await readBody(req);
    const slug = slugify(body.slug || "");
    if (!slug) return send(res, 400, { error: "Page slug is required" });
    const filePath = safeJoin(pagesRoot, `${slug}.md`);
    if (!fs.existsSync(filePath)) return send(res, 404, { error: "Page not found" });
    const existing = readContentFile(filePath);
    writeContentFile(
      filePath,
      {
        ...existing.meta,
        title: body.title || existing.meta.title || slug,
        intro: body.intro || "",
      },
      body.body || "",
    );
    build();
    return send(res, 200, { ok: true, path: path.relative(root, filePath) });
  }

  if (req.method === "POST" && pathname === "/api/item") {
    const body = await readBody(req);
    const config = collections[body.collection];
    if (!config) return send(res, 400, { error: "Unknown collection" });
    const slug = slugify(body.slug || body.title || "");
    if (!slug) return send(res, 400, { error: "Title or slug is required" });

    const sourceDir = path.join(contentRoot, config.sourceDir);
    fs.mkdirSync(sourceDir, { recursive: true });
    const filePath = safeJoin(sourceDir, `${slug}.md`);
    writeContentFile(
      filePath,
      {
        title: body.title || slug,
        slug,
        date: body.date || new Date().toISOString().slice(0, 10),
        type: body.type || config.label,
        summary: body.summary || "",
        source: body.source || "",
        image: body.image || "",
      },
      body.body || "",
    );
    build();
    return send(res, 200, {
      ok: true,
      path: path.relative(root, filePath),
      url: `/pages/${config.outputDir}/${slug}.html`,
    });
  }

  return send(res, 404, { error: "Unknown API route" });
}

function serveStatic(req, res, pathname) {
  const cleanPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = safeJoin(root, cleanPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

build();

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url);
    if (parsed.pathname.startsWith("/api/")) {
      await handleApi(req, res, parsed.pathname);
    } else {
      serveStatic(req, res, decodeURIComponent(parsed.pathname));
    }
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Admin server running at http://127.0.0.1:${port}/admin.html`);
  console.log(`Recruiter view at http://127.0.0.1:${port}/recruiter.html`);
});
