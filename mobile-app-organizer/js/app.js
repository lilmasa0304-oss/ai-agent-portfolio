const STORAGE_KEY = "appshelf-data";

const ICON_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#1e293b",
];

const DEFAULT_CATEGORIES = [
  { id: "cat-sns", name: "SNS", emoji: "💬" },
  { id: "cat-work", name: "仕事", emoji: "💼" },
  { id: "cat-game", name: "ゲーム", emoji: "🎮" },
  { id: "cat-life", name: "生活", emoji: "🏠" },
  { id: "cat-finance", name: "金融", emoji: "💰" },
];

const PLATFORM_LABELS = {
  ios: "iOS",
  android: "Android",
  both: "両方",
};

let state = {
  apps: [],
  categories: [],
  layout: "grid",
  activeCategoryFilter: "",
  editingAppId: null,
  editingCategoryId: null,
};

let filters = {
  search: "",
  category: "",
  platform: "",
  favoritesOnly: false,
};

// ── Storage ──────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.apps = data.apps || [];
      state.categories = data.categories || [];
      state.layout = data.layout || "grid";
    }
  } catch {
  }

  if (state.categories.length === 0) {
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apps: state.apps,
      categories: state.categories,
      layout: state.layout,
    })
  );
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── DOM refs ─────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  searchInput: $("#search-input"),
  filterCategory: $("#filter-category"),
  filterPlatform: $("#filter-platform"),
  filterFavorites: $("#filter-favorites"),
  statTotal: $("#stat-total"),
  statCategories: $("#stat-categories"),
  statFavorites: $("#stat-favorites"),
  categoryChips: $("#category-chips"),
  appList: $("#app-list"),
  emptyApps: $("#empty-apps"),
  categoryList: $("#category-list"),
  emptyCategories: $("#empty-categories"),
  appModal: $("#app-modal"),
  appForm: $("#app-form"),
  appModalTitle: $("#app-modal-title"),
  categoryModal: $("#category-modal"),
  categoryForm: $("#category-form"),
  categoryModalTitle: $("#category-modal-title"),
  importFile: $("#import-file"),
  colorPicker: $("#color-picker"),
};

// ── Render ───────────────────────────────────────────

function getFilteredApps() {
  return state.apps
    .filter((app) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const cat = state.categories.find((c) => c.id === app.categoryId);
        const haystack = [app.name, app.notes, cat?.name].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.category && app.categoryId !== filters.category) return false;
      if (filters.platform && app.platform !== filters.platform) return false;
      if (filters.favoritesOnly && !app.favorite) return false;
      if (state.activeCategoryFilter && app.categoryId !== state.activeCategoryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.name.localeCompare(b.name, "ja");
    });
}

function getCategoryName(id) {
  return state.categories.find((c) => c.id === id)?.name || "未分類";
}

function getCategoryEmoji(id) {
  return state.categories.find((c) => c.id === id)?.emoji || "📦";
}

function renderStats() {
  els.statTotal.textContent = state.apps.length;
  els.statCategories.textContent = state.categories.length;
  els.statFavorites.textContent = state.apps.filter((a) => a.favorite).length;
}

function renderCategoryChips() {
  const allChip = `<button type="button" class="chip${!state.activeCategoryFilter ? " active" : ""}" data-chip="">すべて</button>`;
  const chips = state.categories
    .map(
      (cat) =>
        `<button type="button" class="chip${state.activeCategoryFilter === cat.id ? " active" : ""}" data-chip="${cat.id}">${cat.emoji || "📁"} ${escapeHtml(cat.name)}</button>`
    )
    .join("");
  els.categoryChips.innerHTML = allChip + chips;
}

function renderAppList() {
  const apps = getFilteredApps();
  els.emptyApps.classList.toggle("hidden", apps.length > 0);
  els.appList.classList.toggle("list-layout", state.layout === "list");

  els.appList.innerHTML = apps
    .map((app) => {
      const emoji = app.emoji || app.name.charAt(0);
      const catName = getCategoryName(app.categoryId);
      const platform = PLATFORM_LABELS[app.platform] || "";
      return `
        <article class="app-card" data-app-id="${app.id}">
          ${app.favorite ? '<span class="fav-badge">★</span>' : ""}
          <div class="app-icon" style="background:${app.color}">${escapeHtml(emoji)}</div>
          <div class="app-info">
            <div class="app-name">${escapeHtml(app.name)}</div>
            <div class="app-meta">${escapeHtml(catName)} · ${platform}</div>
          </div>
        </article>`;
    })
    .join("");
}

function renderCategoryList() {
  els.emptyCategories.classList.toggle("hidden", state.categories.length > 0);
  els.categoryList.innerHTML = state.categories
    .map((cat) => {
      const count = state.apps.filter((a) => a.categoryId === cat.id).length;
      return `
        <div class="category-item" data-category-id="${cat.id}">
          <span class="category-item-emoji">${cat.emoji || "📁"}</span>
          <div class="category-item-info">
            <div class="category-item-name">${escapeHtml(cat.name)}</div>
            <div class="category-item-count">${count}個のアプリ</div>
          </div>
          <div class="category-item-actions">
            <button type="button" class="icon-btn edit-cat-btn" data-id="${cat.id}" title="編集">✏️</button>
            <button type="button" class="icon-btn danger delete-cat-btn" data-id="${cat.id}" title="削除">🗑️</button>
          </div>
        </div>`;
    })
    .join("");
}

function populateCategorySelects() {
  const options = state.categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");

  $("#app-category").innerHTML = options;
  els.filterCategory.innerHTML = `<option value="">すべてのカテゴリ</option>${options}`;
}

function renderColorPicker(selected) {
  els.colorPicker.innerHTML = ICON_COLORS.map(
    (color) =>
      `<button type="button" class="color-option${color === selected ? " selected" : ""}" data-color="${color}" style="background:${color}" aria-label="色 ${color}"></button>`
  ).join("");
}

function render() {
  renderStats();
  renderCategoryChips();
  renderAppList();
  renderCategoryList();
  populateCategorySelects();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Modals ───────────────────────────────────────────

function openAppModal(appId = null) {
  state.editingAppId = appId;
  const isEdit = !!appId;
  els.appModalTitle.textContent = isEdit ? "アプリを編集" : "アプリを追加";

  if (isEdit) {
    const app = state.apps.find((a) => a.id === appId);
    if (!app) return;
    $("#app-name").value = app.name;
    $("#app-category").value = app.categoryId;
    $("#app-platform").value = app.platform;
    $("#app-emoji").value = app.emoji || "";
    $("#app-notes").value = app.notes || "";
    $("#app-favorite").checked = app.favorite;
    renderColorPicker(app.color);
  } else {
    els.appForm.reset();
    $("#app-category").value = state.categories[0]?.id || "";
    renderColorPicker(ICON_COLORS[0]);
  }

  els.appModal.showModal();
}

function openCategoryModal(categoryId = null) {
  state.editingCategoryId = categoryId;
  const isEdit = !!categoryId;
  els.categoryModalTitle.textContent = isEdit ? "カテゴリを編集" : "カテゴリを追加";

  if (isEdit) {
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    $("#category-name").value = cat.name;
    $("#category-emoji").value = cat.emoji || "";
  } else {
    els.categoryForm.reset();
  }

  els.categoryModal.showModal();
}

function closeModals() {
  els.appModal.close();
  els.categoryModal.close();
  state.editingAppId = null;
  state.editingCategoryId = null;
}

// ── CRUD ─────────────────────────────────────────────

function saveApp(e) {
  e.preventDefault();
  const name = $("#app-name").value.trim();
  if (!name) return;

  const selectedColor = els.colorPicker.querySelector(".color-option.selected");
  const data = {
    name,
    categoryId: $("#app-category").value,
    platform: $("#app-platform").value,
    color: selectedColor?.dataset.color || ICON_COLORS[0],
    emoji: $("#app-emoji").value.trim(),
    notes: $("#app-notes").value.trim(),
    favorite: $("#app-favorite").checked,
  };

  if (state.editingAppId) {
    const idx = state.apps.findIndex((a) => a.id === state.editingAppId);
    if (idx !== -1) state.apps[idx] = { ...state.apps[idx], ...data };
  } else {
    state.apps.push({ id: generateId("app"), ...data });
  }

  saveState();
  closeModals();
  render();
}

function deleteApp(appId) {
  if (!confirm("このアプリを削除しますか？")) return;
  state.apps = state.apps.filter((a) => a.id !== appId);
  saveState();
  render();
}

function toggleFavorite(appId) {
  const app = state.apps.find((a) => a.id === appId);
  if (app) {
    app.favorite = !app.favorite;
    saveState();
    render();
  }
}

function saveCategory(e) {
  e.preventDefault();
  const name = $("#category-name").value.trim();
  if (!name) return;

  const data = {
    name,
    emoji: $("#category-emoji").value.trim() || "📁",
  };

  if (state.editingCategoryId) {
    const idx = state.categories.findIndex((c) => c.id === state.editingCategoryId);
    if (idx !== -1) state.categories[idx] = { ...state.categories[idx], ...data };
  } else {
    state.categories.push({ id: generateId("cat"), ...data });
  }

  saveState();
  closeModals();
  render();
}

function deleteCategory(categoryId) {
  const count = state.apps.filter((a) => a.categoryId === categoryId).length;
  const msg = count > 0
    ? `このカテゴリには${count}個のアプリがあります。削除すると「未分類」になります。よろしいですか？`
    : "このカテゴリを削除しますか？";
  if (!confirm(msg)) return;

  state.apps.forEach((app) => {
    if (app.categoryId === categoryId) app.categoryId = "";
  });
  state.categories = state.categories.filter((c) => c.id !== categoryId);
  if (state.activeCategoryFilter === categoryId) state.activeCategoryFilter = "";
  saveState();
  render();
}

// ── Import / Export ──────────────────────────────────

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    apps: state.apps,
    categories: state.categories,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appshelf-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.apps) || !Array.isArray(data.categories)) {
        alert("無効なファイル形式です。");
        return;
      }
      if (!confirm("現在のデータを上書きしてインポートしますか？")) return;
      state.apps = data.apps;
      state.categories = data.categories;
      saveState();
      render();
      alert("インポートが完了しました。");
    } catch {
      alert("ファイルの読み込みに失敗しました。");
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm("すべてのデータを削除します。この操作は元に戻せません。本当によろしいですか？")) return;
  if (!confirm("最終確認: 本当にすべて削除しますか？")) return;
  state.apps = [];
  state.categories = [...DEFAULT_CATEGORIES];
  state.activeCategoryFilter = "";
  saveState();
  render();
}

// ── Context menu ─────────────────────────────────────

let contextMenu = null;

function showContextMenu(x, y, appId) {
  removeContextMenu();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.innerHTML = `
    <button type="button" data-action="edit">✏️ 編集</button>
    <button type="button" data-action="favorite">★ お気に入り切替</button>
    <button type="button" data-action="delete" class="danger">🗑️ 削除</button>
  `;
  menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`;

  menu.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "edit") openAppModal(appId);
    if (action === "favorite") toggleFavorite(appId);
    if (action === "delete") deleteApp(appId);
    removeContextMenu();
  });

  document.body.appendChild(menu);
  contextMenu = menu;
}

function removeContextMenu() {
  contextMenu?.remove();
  contextMenu = null;
}

// ── Navigation ───────────────────────────────────────

function switchView(viewName) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === viewName));
  $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === viewName));
  $(".fab").style.display = viewName === "home" ? "flex" : "none";
}

// ── Event listeners ──────────────────────────────────

function initEvents() {
  els.searchInput.addEventListener("input", (e) => {
    filters.search = e.target.value;
    renderAppList();
  });

  els.filterCategory.addEventListener("change", (e) => {
    filters.category = e.target.value;
    state.activeCategoryFilter = "";
    renderCategoryChips();
    renderAppList();
  });

  els.filterPlatform.addEventListener("change", (e) => {
    filters.platform = e.target.value;
    renderAppList();
  });

  els.filterFavorites.addEventListener("click", () => {
    filters.favoritesOnly = !filters.favoritesOnly;
    els.filterFavorites.setAttribute("aria-pressed", String(filters.favoritesOnly));
    renderAppList();
  });

  els.categoryChips.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (!chip) return;
    state.activeCategoryFilter = chip.dataset.chip;
    filters.category = "";
    els.filterCategory.value = "";
    renderCategoryChips();
    renderAppList();
  });

  $$(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.layout = btn.dataset.layout;
      $$(".view-btn").forEach((b) => b.classList.toggle("active", b === btn));
      saveState();
      renderAppList();
    });
  });

  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.nav));
  });

  $("#btn-add-app").addEventListener("click", () => openAppModal());
  $("#btn-add-category").addEventListener("click", () => openCategoryModal());
  $("#btn-add-category-2").addEventListener("click", () => openCategoryModal());

  els.appForm.addEventListener("submit", saveApp);
  els.categoryForm.addEventListener("submit", saveCategory);

  $$("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeModals);
  });

  els.colorPicker.addEventListener("click", (e) => {
    const opt = e.target.closest(".color-option");
    if (!opt) return;
    els.colorPicker.querySelectorAll(".color-option").forEach((o) => o.classList.remove("selected"));
    opt.classList.add("selected");
  });

  els.appList.addEventListener("click", (e) => {
    const card = e.target.closest("[data-app-id]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    showContextMenu(rect.left + rect.width / 2, rect.top, card.dataset.appId);
  });

  els.categoryList.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-cat-btn");
    const deleteBtn = e.target.closest(".delete-cat-btn");
    if (editBtn) openCategoryModal(editBtn.dataset.id);
    if (deleteBtn) deleteCategory(deleteBtn.dataset.id);
  });

  $("#btn-export").addEventListener("click", exportData);
  $("#btn-export-2").addEventListener("click", exportData);
  $("#btn-import").addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });
  $("#btn-reset").addEventListener("click", resetData);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".context-menu") && !e.target.closest(".app-card")) {
      removeContextMenu();
    }
  });
}

// ── Init ─────────────────────────────────────────────

function init() {
  loadState();
  renderColorPicker(ICON_COLORS[0]);
  $$(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.layout === state.layout));
  initEvents();
  render();
}

init();
