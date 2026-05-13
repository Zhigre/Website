const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentRoot = path.join(root, "content");
const pagesRoot = path.join(contentRoot, "pages");
const outputPagesRoot = path.join(root, "pages");

const pageOrder = [
  "about",
  "contact",
  "ai-projects",
  "wiki",
  "achievements",
  "articles",
  "instructions",
  "scripts",
  "scams",
  "clear",
];

const collections = {
  articles: {
    label: "Article",
    plural: "Articles",
    sourceDir: "posts",
    outputDir: "posts",
    pageSlug: "articles",
  },
  aiProjects: {
    label: "AI Project",
    plural: "AI Projects",
    sourceDir: "ai-projects",
    outputDir: "ai-projects",
    pageSlug: "ai-projects",
  },
  scams: {
    label: "Scam Record",
    plural: "Scam Records",
    sourceDir: "scams",
    outputDir: "scams",
    pageSlug: "scams",
  },
  scripts: {
    label: "Script",
    plural: "Scripts",
    sourceDir: "scripts",
    outputDir: "scripts",
    pageSlug: "scripts",
  },
  achievements: {
    label: "Achievement",
    plural: "Achievements",
    sourceDir: "achievements",
    outputDir: "achievements",
    pageSlug: "achievements",
  },
  instructions: {
    label: "Instruction",
    plural: "Instructions",
    sourceDir: "instructions",
    outputDir: "instructions",
    pageSlug: "instructions",
  },
  wiki: {
    label: "Wiki Entry",
    plural: "Wiki Entries",
    sourceDir: "wiki",
    outputDir: "wiki",
    pageSlug: "wiki",
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readContentFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body: match[2].trim() };
}

function writeContentFile(filePath, meta, body) {
  const frontMatter = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${key}: ${String(value).replace(/\n/g, " ")}`)
    .join("\n");
  fs.writeFileSync(filePath, `---\n${frontMatter}\n---\n\n${body.trim()}\n`, "utf8");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2">$2</a>',
  );
  return html;
}

function renderMarkdown(markdown = "") {
  const lines = String(markdown).split("\n");
  const html = [];
  let paragraph = [];
  let listItems = [];
  let listType = "ul";
  let inCode = false;
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${listType}>`);
    listItems = [];
    listType = "ul";
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      flushParagraph();
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(list[1]);
      continue;
    }

    const orderedList = line.match(/^\d+\.\s+(.+)$/);
    if (orderedList) {
      flushParagraph();
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(orderedList[1]);
      continue;
    }

    if (line.trim().startsWith("<")) {
      flushParagraph();
      flushList();
      html.push(line);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getPages() {
  return pageOrder.map((slug) => {
    const filePath = path.join(pagesRoot, `${slug}.md`);
    const { meta, body } = readContentFile(filePath);
    return {
      slug,
      title: meta.title || slug,
      navTitle: meta.navTitle || meta.title || slug,
      meta,
      body,
      outputPath: `pages/${slug}.html`,
    };
  });
}

function getCollectionItems(collectionKey) {
  const config = collections[collectionKey];
  const sourceRoot = path.join(contentRoot, config.sourceDir);
  if (!fs.existsSync(sourceRoot)) return [];

  return fs
    .readdirSync(sourceRoot)
    .filter((file) => file.endsWith(".md") || file.endsWith(".html"))
    .map((file) => {
      const filePath = path.join(sourceRoot, file);
      const { meta, body } = readContentFile(filePath);
      const extension = path.extname(file);
      const fallbackSlug = slugify(path.basename(file, extension));
      const slug = meta.slug || fallbackSlug;
      const isHtml = extension === ".html";
      const title = meta.title || slug;
      const type = meta.type || config.label;
      return {
        collectionKey,
        config,
        slug,
        title,
        date: meta.date || "",
        type,
        summary: meta.summary || "",
        source: meta.source || "",
        image: meta.image || "",
        body,
        html: isHtml ? body : renderMarkdown(body),
        outputPath: `pages/${config.outputDir}/${slug}.html`,
        filePath,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function layout({ title, rootPath, activePath, content, intro, recruiter = false }) {
  const navItems = getPages()
    .map((page) => {
      const href = `${rootPath}${page.outputPath}`;
      const active = activePath === page.outputPath ? " aria-current=\"page\"" : "";
      return `<a class="nav-link" href="${href}"${active}>${escapeHtml(page.navTitle)}</a>`;
    })
    .join("\n");
  const recruiterLink = recruiter
    ? ""
    : `<a class="nav-link nav-link-quiet" href="${rootPath}recruiter.html">Recruiter View</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Zhigre's cyber portfolio, notes, projects, and writeups.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tilt+Neon&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${rootPath}css/style.css">
  <title>${escapeHtml(title)} | Zhigre</title>
</head>
<body>
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="${rootPath}index.html" aria-label="Zhigre home">
        <span class="brand-mark">
          <img src="${rootPath}images/Brain.png" alt="">
        </span>
        <span>
          <strong>Zhigre</strong>
          <small>Cyber Citizen</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="Primary navigation">
${navItems}
${recruiterLink}
      </nav>
    </header>

    <main class="main-panel">
      <section class="page-hero">
        <h1>${escapeHtml(title)}</h1>
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
      </section>
      <section class="page-content">
${content}
      </section>
    </main>

    <footer class="site-footer">
      <span>Cyber Citizen | Loading ...</span>
      <span class="footer-links">
        <a href="https://x.com/Zhigre_X" target="_blank" rel="noreferrer">X</a>
        <a href="https://github.com/Zhigre" target="_blank" rel="noreferrer">GitHub</a>
      </span>
    </footer>
  </div>
</body>
</html>
`;
}

function renderCollectionList(items, rootPath, emptyLabel) {
  if (!items.length) {
    return `<p class="muted">No ${escapeHtml(emptyLabel.toLowerCase())} yet. Use the local admin page to add one.</p>`;
  }

  return `<div class="content-grid">
${items
  .map(
    (item) => `<article class="post-card">
  ${item.image ? `<img class="card-image" src="${escapeHtml(item.image)}" alt="">` : ""}
  <p class="post-meta">${escapeHtml(item.type)}${item.date ? ` | ${formatDate(item.date)}` : ""}</p>
  <h2><a href="${rootPath}${item.outputPath}">${escapeHtml(item.title)}</a></h2>
  ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
  ${item.source ? `<p><a href="${escapeHtml(item.source)}">Source</a></p>` : ""}
</article>`,
  )
  .join("\n")}
</div>`;
}

function renderRecruiterContent(collectionData) {
  const aiProjects = collectionData.aiProjects || [];
  const articles = collectionData.articles || [];
  const scripts = collectionData.scripts || [];
  const achievements = collectionData.achievements || [];
  const instructions = collectionData.instructions || [];
  const featured = [...aiProjects, ...articles, ...scripts, ...achievements, ...instructions]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 9);

  return `<p>This is the focused version of the portfolio for hiring conversations: AI-driven projects, cyber writeups, achievements, and practical evidence without the admin workflow.</p>
${renderCollectionList(featured, "", "portfolio entries")}`;
}

function build() {
  ensureDir(outputPagesRoot);

  const pages = getPages();
  const collectionData = {};
  for (const key of Object.keys(collections)) {
    const config = collections[key];
    ensureDir(path.join(outputPagesRoot, config.outputDir));
    collectionData[key] = getCollectionItems(key);
  }

  const home = readContentFile(path.join(contentRoot, "index.md"));
  fs.writeFileSync(
    path.join(root, "index.html"),
    layout({
      title: home.meta.title || "Home",
      rootPath: "",
      activePath: "index.html",
      intro: home.meta.intro,
      content: renderMarkdown(home.body),
    }),
  );

  fs.writeFileSync(
    path.join(root, "recruiter.html"),
    layout({
      title: "Recruiter View",
      rootPath: "",
      activePath: "recruiter.html",
      intro: "A focused portfolio view for hiring teams.",
      content: renderRecruiterContent(collectionData),
      recruiter: true,
    }),
  );

  for (const page of pages) {
    const body = renderMarkdown(page.body);
    const collectionKey = Object.keys(collections).find((key) => collections[key].pageSlug === page.slug);
    const collection = collectionKey ? collections[collectionKey] : null;
    const extra = collection
      ? `\n<h2>${escapeHtml(collection.plural)}</h2>\n${renderCollectionList(collectionData[collectionKey], "../", collection.plural)}`
      : "";
    fs.writeFileSync(
      path.join(root, page.outputPath),
      layout({
        title: page.title,
        rootPath: "../",
        activePath: page.outputPath,
        intro: page.meta?.intro,
        content: `${body}${extra}`,
      }),
    );
  }

  for (const key of Object.keys(collections)) {
    for (const item of collectionData[key]) {
      const config = collections[key];
      fs.writeFileSync(
        path.join(root, item.outputPath),
        layout({
          title: item.title,
          rootPath: "../../",
          activePath: `pages/${config.pageSlug}.html`,
          intro: item.summary,
          content: `<article class="post-body">
  ${item.image ? `<img class="entry-image" src="${escapeHtml(item.image)}" alt="">` : ""}
  <p class="post-meta">${escapeHtml(item.type)}${item.date ? ` | ${formatDate(item.date)}` : ""}</p>
${item.html}
  ${item.source ? `<p><a href="${escapeHtml(item.source)}">Source</a></p>` : ""}
</article>`,
        }),
      );
    }
  }

  console.log(`Built ${pages.length + Object.values(collectionData).flat().length + 2} pages.`);
}

if (require.main === module) {
  build();

  if (process.argv.includes("--watch")) {
    console.log("Watching content and css. Press Ctrl+C to stop.");
    fs.watch(contentRoot, { recursive: true }, build);
    fs.watch(path.join(root, "css"), { recursive: true }, build);
  }
}

module.exports = {
  build,
  collections,
  contentRoot,
  readContentFile,
  renderMarkdown,
  slugify,
  writeContentFile,
};
