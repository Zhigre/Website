const state = {
  pages: [],
  collections: {},
};

const statusEl = document.querySelector("#admin-status");
const previewEl = document.querySelector("#markdown-preview");
const itemForm = document.querySelector("#item-form");
const pageForm = document.querySelector("#page-form");
const collectionSelect = document.querySelector("#collection-select");
const pageSelect = document.querySelector("#page-select");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error-text", isError);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadState() {
  const data = await request("/api/state");
  state.pages = data.pages;
  state.collections = data.collections;

  collectionSelect.innerHTML = Object.entries(state.collections)
    .map(([key, collection]) => `<option value="${key}">${collection.plural}</option>`)
    .join("");

  pageSelect.innerHTML = state.pages
    .map((page) => `<option value="${page.slug}">${page.title}</option>`)
    .join("");

  fillPageForm(state.pages[0]);
  setStatus("Ready. Changes save to content files and rebuild the static site.");
}

function fillPageForm(page) {
  if (!page) return;
  pageForm.elements.slug.value = page.slug;
  pageForm.elements.title.value = page.title || "";
  pageForm.elements.intro.value = page.intro || "";
  pageForm.elements.body.value = page.body || "";
}

async function preview(markdown) {
  const data = await request("/api/preview", {
    method: "POST",
    body: JSON.stringify({ markdown }),
  });
  previewEl.innerHTML = data.html || '<p class="muted">Nothing to preview.</p>';
}

document.querySelectorAll(".admin-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.remove("is-active"));
    document.querySelectorAll(".admin-panel").forEach((panel) => panel.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelector(`#${button.dataset.panel}`).classList.add("is-active");
  });
});

itemForm.elements.title.addEventListener("input", () => {
  if (!itemForm.elements.slug.value.trim()) {
    itemForm.elements.slug.placeholder = slugify(itemForm.elements.title.value);
  }
});

collectionSelect.addEventListener("change", () => {
  const collection = state.collections[collectionSelect.value];
  itemForm.elements.type.placeholder = collection?.label || "";
});

pageSelect.addEventListener("change", () => {
  fillPageForm(state.pages.find((page) => page.slug === pageSelect.value));
});

document.querySelector("#preview-item").addEventListener("click", () => {
  preview(itemForm.elements.body.value).catch((error) => setStatus(error.message, true));
});

document.querySelector("#preview-page").addEventListener("click", () => {
  preview(pageForm.elements.body.value).catch((error) => setStatus(error.message, true));
});

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(itemForm);
  const payload = Object.fromEntries(formData.entries());
  payload.slug = payload.slug || slugify(payload.title);
  try {
    const data = await request("/api/item", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(`Saved ${data.path}. Built ${data.url}.`);
    itemForm.reset();
    await loadState();
  } catch (error) {
    setStatus(error.message, true);
  }
});

pageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(pageForm).entries());
  try {
    const data = await request("/api/page", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(`Updated ${data.path} and rebuilt the site.`);
    await loadState();
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadState().catch((error) => {
  setStatus(`${error.message}. Start the admin server with npm run admin.`, true);
});
