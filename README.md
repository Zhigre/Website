# Zhigre Website

Static living portfolio site for cyber projects, writeups, notes, and job-hunting evidence.

The public site is still plain HTML/CSS, so it works on GitHub Pages. The source content now lives in `content/` and is compiled by a small dependency-free Node script.

## Edit Content in the Browser

Run the local admin server:

```sh
npm run admin
```

Then open:

```text
http://127.0.0.1:8010/admin.html
```

Use the admin page to:

- Add articles, scam records, scripts, achievements, instructions, and wiki entries.
- Add AI project entries for Daimon, OneShot, OrionBook, or future AI-driven work.
- Edit normal page copy.
- Preview Markdown rendering before saving.
- Rebuild the static HTML automatically.

The admin server writes Markdown files in `content/` and regenerates the static pages. It is intended for local use on your machine, not as a public editing system on GitHub Pages.

## Recruiter Link

The focused recruiter version is generated at:

```text
recruiter.html
```

On GitHub Pages, that will be:

```text
https://zhigre.github.io/Website/recruiter.html
```

## Edit Content Manually

- Normal pages: edit Markdown files in `content/pages`.
- Posts/articles: add a new `.md` or `.html` file in `content/posts`.
- AI projects: add a new `.md` file in `content/ai-projects`.
- Scam records: add a new `.md` file in `content/scams`.
- Scripts: add a new `.md` file in `content/scripts`.
- Achievements: add a new `.md` file in `content/achievements`.
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
