const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentRoot = path.join(root, "content");
const pagesRoot = path.join(contentRoot, "pages");
const postsRoot = path.join(contentRoot, "posts");
const outputPagesRoot = path.join(root, "pages");
const outputPostsRoot = path.join(outputPagesRoot, "posts");

const pageOrder = [
  "about",
  "contact",
  "wiki",
  "achievements",
  "articles",
  "instructions",
  "scripts",
  "scams",
  "clear",
];

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

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2">$2</a>',
  );
  return html;
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
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

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 1;
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

function getPosts() {
  if (!fs.existsSync(postsRoot)) return [];
  return fs
    .readdirSync(postsRoot)
    .filter((file) => file.endsWith(".md") || file.endsWith(".html"))
    .map((file) => {
      const filePath = path.join(postsRoot, file);
      const { meta, body } = readContentFile(filePath);
      const extension = path.extname(file);
      const fallbackSlug = slugify(path.basename(file, extension));
      const slug = meta.slug || fallbackSlug;
      const isHtml = extension === ".html";
      const title = meta.title || slug;
      return {
        slug,
        title,
        date: meta.date || "",
        type: meta.type || "Post",
        summary: meta.summary || "",
        body,
        html: isHtml ? body : renderMarkdown(body),
        outputPath: `pages/posts/${slug}.html`,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function layout({ title, rootPath, activePath, content, intro }) {
  const navItems = getPages()
    .map((page) => {
      const href = `${rootPath}${page.outputPath}`;
      const active = activePath === page.outputPath ? " aria-current=\"page\"" : "";
      return `<a class="nav-link" href="${href}"${active}>${escapeHtml(page.navTitle)}</a>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Zhigre's living cyber portfolio, notes, projects, and writeups.">
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
      </nav>
    </header>

    <main class="main-panel">
      <section class="page-hero">
        <p class="kicker">Living Portfolio</p>
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

function renderPostList(posts, rootPath) {
  if (!posts.length) {
    return '<p class="muted">No posts yet. Add a Markdown file in <code>content/posts</code> and run <code>npm run build</code>.</p>';
  }

  return `<div class="content-grid">
${posts
  .map(
    (post) => `<article class="post-card">
  <p class="post-meta">${escapeHtml(post.type)}${post.date ? ` | ${formatDate(post.date)}` : ""}</p>
  <h2><a href="${rootPath}${post.outputPath}">${escapeHtml(post.title)}</a></h2>
  ${post.summary ? `<p>${escapeHtml(post.summary)}</p>` : ""}
</article>`,
  )
  .join("\n")}
</div>`;
}

function build() {
  ensureDir(outputPagesRoot);
  ensureDir(outputPostsRoot);

  const posts = getPosts();
  const pages = getPages();

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

  for (const page of pages) {
    const body = renderMarkdown(page.body);
    const extra = page.slug === "articles" ? `\n${renderPostList(posts, "../")}` : "";
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

  for (const post of posts) {
    fs.writeFileSync(
      path.join(root, post.outputPath),
      layout({
        title: post.title,
        rootPath: "../../",
        activePath: "pages/articles.html",
        intro: post.summary,
        content: `<article class="post-body">
  <p class="post-meta">${escapeHtml(post.type)}${post.date ? ` | ${formatDate(post.date)}` : ""}</p>
${post.html}
</article>`,
      }),
    );
  }

  console.log(`Built ${pages.length + posts.length + 1} pages.`);
}

build();

if (process.argv.includes("--watch")) {
  console.log("Watching content and css. Press Ctrl+C to stop.");
  fs.watch(contentRoot, { recursive: true }, build);
  fs.watch(path.join(root, "css"), { recursive: true }, build);
}
