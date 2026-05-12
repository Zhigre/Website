# Zhigre Website

Static living portfolio site for cyber projects, writeups, notes, and job-hunting evidence.

The public site is still plain HTML/CSS, so it works on GitHub Pages. The source content now lives in `content/` and is compiled by a small dependency-free Node script.

## Edit Content

- Normal pages: edit Markdown files in `content/pages`.
- Posts/articles: add a new `.md` or `.html` file in `content/posts`.
- Styling: edit `css/style.css`.

## Add a New Post

Create a file like `content/posts/example.md`:

```md
---
title: My New Writeup
slug: my-new-writeup
date: 2026-05-12
type: Project Note
summary: One sentence summary shown on the Articles page.
---

Write the post here in Markdown.
```

Then rebuild the static HTML:

```sh
npm run build
```

The build creates:

- `pages/articles.html` with the post card added.
- `pages/posts/my-new-writeup.html` as the post page.

## Local Preview

Open `index.html` in a browser, or run a simple static server from the repo folder:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
