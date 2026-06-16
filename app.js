const DATA_URL = "./data/materials.json";

const CARD_W = 180;
const CARD_H = 238;
const CELL_W = 218;
const CELL_H = 276;
const GRID_COLS = 28;
const STORAGE_KEY = "quixel-material-canvas-state-v2";
const LOCK_ICON = '<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>';
const UNLOCK_ICON = '<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 10h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h9V8a3 3 0 0 0-5.64-1.42L7.6 5.64A5 5 0 0 1 17 8v2Z"/></svg>';

const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const gridLayer = document.getElementById("gridLayer");
const freeLayer = document.getElementById("freeLayer");
const cardTemplate = document.getElementById("cardTemplate");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const matchCount = document.getElementById("matchCount");
const assetCount = document.getElementById("assetCount");
const categoryFilter = document.getElementById("categoryFilter");
const resetViewButton = document.getElementById("resetViewButton");
const handCards = document.getElementById("handCards");
const toast = document.getElementById("toast");

let allMaterials = [];
let activeItems = [];
let materialById = new Map();
let activeIndexById = new Map();
let renderedGrid = new Map();
let renderedFree = new Map();
let pinnedIds = new Set();
let freeCopies = [];
let freeCopySeq = 1;

let activeQuery = "";
let activeMatches = [];
let activeMatchSet = new Set();
let nextMatchIndex = 0;
let currentFocusId = "";

let view = { x: 28, y: 28, scale: 0.82 };
let panState = null;
let freeDragState = null;
let handDragState = null;
let saveTimer = 0;

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("ru-RU")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSearchHaystack(item) {
  if (!item.searchText) {
    item.searchText = normalizeText([
      item.title,
      item.title_ru,
      item.categoryPath,
      item.categoryLeaf,
      item.slug,
      item.purchased ? "purchased bought куплено" : "not purchased не куплено"
    ].join(" "));
  }
  return item.searchText;
}

function itemMatchesQuery(item, query) {
  if (!query) return true;
  const haystack = getSearchHaystack(item);
  return query.split(/\s+/).filter(Boolean).every(part => haystack.includes(part));
}

function positionForIndex(index) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: col * CELL_W,
    y: row * CELL_H
  };
}

function screenToWorld(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale
  };
}

function setWorldTransform() {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  renderVisible();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveState, 180);
}

function saveState() {
  const state = {
    pinnedIds: Array.from(pinnedIds),
    freeCopies: freeCopies.map(copy => ({
      copyId: copy.copyId,
      itemId: copy.itemId,
      x: copy.x,
      y: copy.y,
      unlocked: copy.unlocked
    })),
    freeCopySeq,
    view
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    pinnedIds = new Set((state.pinnedIds || []).filter(id => materialById.has(id)));
    freeCopies = (state.freeCopies || [])
      .filter(copy => materialById.has(copy.itemId))
      .map(copy => ({
        copyId: copy.copyId,
        itemId: copy.itemId,
        x: Number(copy.x) || 0,
        y: Number(copy.y) || 0,
        unlocked: copy.unlocked !== false
      }));
    freeCopySeq = Math.max(Number(state.freeCopySeq) || 1, freeCopies.length + 1);
    if (state.view && Number.isFinite(state.view.x) && Number.isFinite(state.view.y) && Number.isFinite(state.view.scale)) {
      view = {
        x: state.view.x,
        y: state.view.y,
        scale: Math.min(2.2, Math.max(0.35, state.view.scale))
      };
    }
  } catch {
    pinnedIds = new Set();
    freeCopies = [];
  }
}

function populateCategories() {
  const paths = Array.from(new Set(allMaterials.map(item => item.categoryShort))).sort((a, b) => a.localeCompare(b));
  for (const path of paths) {
    const option = document.createElement("option");
    option.value = path;
    option.textContent = path;
    categoryFilter.appendChild(option);
  }
}

function applyCategoryFilter() {
  const selected = categoryFilter.value;
  activeItems = selected
    ? allMaterials.filter(item => item.categoryShort === selected)
    : allMaterials.slice();
  activeIndexById = new Map(activeItems.map((item, index) => [item.id, index]));
  renderedGrid.forEach(card => card.remove());
  renderedGrid.clear();
  searchInput.value = "";
  clearSearch(false);
  updateAssetCount();
  resetView(false);
  renderVisible();
}

function updateAssetCount() {
  const total = allMaterials.length.toLocaleString("ru-RU");
  const active = activeItems.length.toLocaleString("ru-RU");
  assetCount.textContent = activeItems.length === allMaterials.length ? `${total} materials` : `${active} / ${total} materials`;
}

function clearSearch(render = true) {
  activeQuery = "";
  activeMatches = [];
  activeMatchSet = new Set();
  nextMatchIndex = 0;
  currentFocusId = "";
  searchButton.textContent = "Search";
  matchCount.textContent = "";
  if (render) renderVisible();
}

function runSearch() {
  activeQuery = normalizeText(searchInput.value.trim());
  currentFocusId = "";
  nextMatchIndex = 0;
  if (!activeQuery) {
    clearSearch();
    return;
  }
  activeMatches = activeItems.filter(item => itemMatchesQuery(item, activeQuery));
  activeMatchSet = new Set(activeMatches.map(item => item.id));
  const count = activeMatches.length;
  matchCount.textContent = `${count.toLocaleString("ru-RU")} совпадений`;
  searchButton.textContent = count ? `Next 1/${count}` : "Search";
  if (!count) showToast("Совпадений нет");
  renderVisible();
}

function goToNextMatch() {
  if (!activeMatches.length) {
    runSearch();
    return;
  }
  const item = activeMatches[nextMatchIndex];
  currentFocusId = item.id;
  centerOnItem(item, 1.12);
  nextMatchIndex = (nextMatchIndex + 1) % activeMatches.length;
  searchButton.textContent = `Next ${nextMatchIndex + 1}/${activeMatches.length}`;
}

function centerOnItem(item, scale = view.scale) {
  const index = activeIndexById.get(item.id);
  if (index == null) return;
  const pos = positionForIndex(index);
  const rect = viewport.getBoundingClientRect();
  view.scale = Math.min(2.2, Math.max(0.35, scale));
  view.x = rect.width / 2 - (pos.x + CARD_W / 2) * view.scale;
  view.y = rect.height / 2 - (pos.y + CARD_H / 2) * view.scale;
  setWorldTransform();
  scheduleSave();
}

function resetView(save = true) {
  view = { x: 28, y: 28, scale: 0.82 };
  setWorldTransform();
  if (save) scheduleSave();
}

function createMaterialCard(item, options) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.itemId = item.id;
  node.dataset.kind = options.kind;
  if (options.copyId) node.dataset.copyId = options.copyId;

  node.querySelector(".title-text").textContent = item.title;
  node.querySelector(".purchase-dot").classList.toggle("is-owned", item.purchased);
  node.querySelector(".category-label").textContent = item.categoryShort;

  const image = node.querySelector(".card-image");
  image.src = item.preview;
  image.alt = item.title;
  image.addEventListener("error", () => {
    image.removeAttribute("src");
    image.style.background = "linear-gradient(135deg, #27272d, #18181b)";
  }, { once: true });

  const link = node.querySelector(".link-button");
  link.href = item.url;

  const starButton = node.querySelector(".star-button");
  starButton.classList.toggle("is-pinned", pinnedIds.has(item.id));
  starButton.addEventListener("click", event => {
    event.stopPropagation();
    togglePinned(item.id);
  });

  const lockButton = node.querySelector(".lock-button");
  setLockIcon(lockButton, options.kind === "free" && options.unlocked);
  if (options.kind === "free") {
    node.classList.add("is-free");
    lockButton.classList.toggle("is-unlocked", options.unlocked);
    lockButton.title = options.unlocked ? "Lock card" : "Unlock card";
  }
  lockButton.addEventListener("click", event => {
    event.stopPropagation();
    if (options.kind === "grid") {
      const index = activeIndexById.get(item.id);
      const pos = positionForIndex(index ?? 0);
      createFreeCopy(item.id, pos.x, pos.y, true);
      showToast("Создана свободная копия");
    } else {
      const copy = freeCopies.find(entry => entry.copyId === options.copyId);
      if (!copy) return;
      copy.unlocked = !copy.unlocked;
      updateFreeCardState(options.copyId);
      scheduleSave();
    }
  });

  if (options.kind === "free") {
    node.addEventListener("pointerdown", event => startFreeDrag(event, options.copyId));
  }

  node.addEventListener("dblclick", event => {
    if (event.target.closest("button, a")) return;
    window.open(item.url, "_blank", "noreferrer");
  });

  updateCardSearchState(node, item);
  return node;
}

function updateCardSearchState(node, item) {
  const hasSearch = Boolean(activeQuery);
  const isMatch = !hasSearch || activeMatchSet.has(item.id);
  node.classList.toggle("search-dim", hasSearch && !isMatch);
  node.classList.toggle("search-match", hasSearch && isMatch);
  node.classList.toggle("current-hit", currentFocusId === item.id);
  node.querySelector(".star-button").classList.toggle("is-pinned", pinnedIds.has(item.id));
}

function updateFreeCardState(copyId) {
  const node = renderedFree.get(copyId);
  const copy = freeCopies.find(entry => entry.copyId === copyId);
  if (!node || !copy) return;
  const lockButton = node.querySelector(".lock-button");
  setLockIcon(lockButton, copy.unlocked);
  lockButton.classList.toggle("is-unlocked", copy.unlocked);
  lockButton.title = copy.unlocked ? "Lock card" : "Unlock card";
}

function setLockIcon(button, unlocked) {
  button.innerHTML = unlocked ? UNLOCK_ICON : LOCK_ICON;
}

function placeCard(node, x, y) {
  node.style.transform = `translate(${x}px, ${y}px)`;
}

function renderVisible() {
  if (!activeItems.length) return;
  const rect = viewport.getBoundingClientRect();
  const pad = 420 / view.scale;
  const left = (-view.x / view.scale) - pad;
  const top = (-view.y / view.scale) - pad;
  const right = ((rect.width - view.x) / view.scale) + pad;
  const bottom = ((rect.height - view.y) / view.scale) + pad;

  const minCol = Math.max(0, Math.floor(left / CELL_W));
  const maxCol = Math.min(GRID_COLS - 1, Math.ceil(right / CELL_W));
  const minRow = Math.max(0, Math.floor(top / CELL_H));
  const maxRow = Math.min(Math.ceil(activeItems.length / GRID_COLS), Math.ceil(bottom / CELL_H));
  const needed = new Set();

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const index = row * GRID_COLS + col;
      const item = activeItems[index];
      if (!item) continue;
      needed.add(item.id);
      let node = renderedGrid.get(item.id);
      if (!node) {
        node = createMaterialCard(item, { kind: "grid" });
        gridLayer.appendChild(node);
        renderedGrid.set(item.id, node);
      }
      placeCard(node, col * CELL_W, row * CELL_H);
      updateCardSearchState(node, item);
    }
  }

  renderedGrid.forEach((node, id) => {
    if (!needed.has(id)) {
      node.remove();
      renderedGrid.delete(id);
    }
  });

  renderFreeCopies();
}

function renderFreeCopies() {
  const activeIds = new Set(freeCopies.map(copy => copy.copyId));
  for (const copy of freeCopies) {
    const item = materialById.get(copy.itemId);
    if (!item) continue;
    let node = renderedFree.get(copy.copyId);
    if (!node) {
      node = createMaterialCard(item, {
        kind: "free",
        copyId: copy.copyId,
        unlocked: copy.unlocked
      });
      freeLayer.appendChild(node);
      renderedFree.set(copy.copyId, node);
    }
    placeCard(node, copy.x, copy.y);
    updateCardSearchState(node, item);
    updateFreeCardState(copy.copyId);
  }

  renderedFree.forEach((node, id) => {
    if (!activeIds.has(id)) {
      node.remove();
      renderedFree.delete(id);
    }
  });
}

function togglePinned(itemId) {
  if (pinnedIds.has(itemId)) pinnedIds.delete(itemId);
  else pinnedIds.add(itemId);
  renderHand();
  renderVisible();
  scheduleSave();
}

function renderHand() {
  handCards.replaceChildren();
  for (const itemId of pinnedIds) {
    const item = materialById.get(itemId);
    if (!item) continue;
    const card = document.createElement("div");
    card.className = "hand-card";
    card.dataset.itemId = itemId;
    card.innerHTML = `
      <button class="hand-remove" type="button" title="Remove" aria-label="Remove pinned material">x</button>
      <img src="${escapeAttribute(item.preview)}" alt="" referrerpolicy="no-referrer">
      <span>${escapeHtml(item.title)}</span>
    `;
    card.querySelector(".hand-remove").addEventListener("click", event => {
      event.stopPropagation();
      pinnedIds.delete(itemId);
      renderHand();
      renderVisible();
      scheduleSave();
    });
    card.addEventListener("pointerdown", event => startHandDrag(event, itemId));
    handCards.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function createFreeCopy(itemId, x, y, unlocked) {
  const copyId = `copy-${Date.now()}-${freeCopySeq++}`;
  freeCopies.push({ copyId, itemId, x, y, unlocked });
  renderFreeCopies();
  scheduleSave();
  return copyId;
}

function startFreeDrag(event, copyId) {
  if (event.button !== 0 || event.target.closest("button, a")) return;
  const copy = freeCopies.find(entry => entry.copyId === copyId);
  if (!copy || !copy.unlocked) return;
  event.preventDefault();
  event.stopPropagation();
  const node = renderedFree.get(copyId);
  node.classList.add("is-dragging");
  freeDragState = {
    copy,
    node,
    startX: event.clientX,
    startY: event.clientY,
    originX: copy.x,
    originY: copy.y
  };
  node.setPointerCapture(event.pointerId);
}

function moveFreeDrag(event) {
  if (!freeDragState) return;
  const dx = (event.clientX - freeDragState.startX) / view.scale;
  const dy = (event.clientY - freeDragState.startY) / view.scale;
  freeDragState.copy.x = freeDragState.originX + dx;
  freeDragState.copy.y = freeDragState.originY + dy;
  placeCard(freeDragState.node, freeDragState.copy.x, freeDragState.copy.y);
}

function endFreeDrag() {
  if (!freeDragState) return;
  freeDragState.node.classList.remove("is-dragging");
  freeDragState = null;
  scheduleSave();
}

function startHandDrag(event, itemId) {
  if (event.button !== 0 || event.target.closest(".hand-remove")) return;
  event.preventDefault();
  const item = materialById.get(itemId);
  const ghost = createMaterialCard(item, { kind: "grid" });
  ghost.classList.add("drag-ghost");
  document.body.appendChild(ghost);
  handDragState = { itemId, ghost };
  moveHandGhost(event.clientX, event.clientY);
  document.addEventListener("pointermove", onHandDragMove);
  document.addEventListener("pointerup", onHandDragEnd, { once: true });
}

function moveHandGhost(clientX, clientY) {
  if (!handDragState) return;
  handDragState.ghost.style.left = `${clientX}px`;
  handDragState.ghost.style.top = `${clientY}px`;
}

function onHandDragMove(event) {
  moveHandGhost(event.clientX, event.clientY);
}

function onHandDragEnd(event) {
  document.removeEventListener("pointermove", onHandDragMove);
  if (!handDragState) return;
  const rect = viewport.getBoundingClientRect();
  if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
    const point = screenToWorld(event.clientX, event.clientY);
    createFreeCopy(handDragState.itemId, point.x - CARD_W / 2, point.y - CARD_H / 2, true);
    showToast("Копия добавлена на доску");
  }
  handDragState.ghost.remove();
  handDragState = null;
}

function startPan(event) {
  if (event.button !== 0 || event.target.closest(".material-card, .toolbar, .hand")) return;
  panState = {
    startX: event.clientX,
    startY: event.clientY,
    originX: view.x,
    originY: view.y
  };
  viewport.classList.add("is-panning");
  viewport.setPointerCapture(event.pointerId);
}

function movePan(event) {
  if (!panState) return;
  view.x = panState.originX + event.clientX - panState.startX;
  view.y = panState.originY + event.clientY - panState.startY;
  setWorldTransform();
}

function endPan() {
  if (!panState) return;
  panState = null;
  viewport.classList.remove("is-panning");
  scheduleSave();
}

function zoomAt(event) {
  event.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  const before = {
    x: (px - view.x) / view.scale,
    y: (py - view.y) / view.scale
  };
  const factor = event.deltaY < 0 ? 1.12 : 0.89;
  view.scale = Math.min(2.2, Math.max(0.35, view.scale * factor));
  view.x = px - before.x * view.scale;
  view.y = py - before.y * view.scale;
  setWorldTransform();
  scheduleSave();
}

function attachEvents() {
  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    if (activeQuery && normalizeText(searchInput.value.trim()) === activeQuery && activeMatches.length) goToNextMatch();
    else runSearch();
  });

  searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim()) clearSearch();
    else if (activeQuery && normalizeText(searchInput.value.trim()) !== activeQuery) {
      searchButton.textContent = "Search";
      matchCount.textContent = "";
    }
  });

  categoryFilter.addEventListener("change", applyCategoryFilter);
  resetViewButton.addEventListener("click", () => resetView());

  viewport.addEventListener("pointerdown", startPan);
  viewport.addEventListener("pointermove", event => {
    movePan(event);
    moveFreeDrag(event);
  });
  viewport.addEventListener("pointerup", () => {
    endPan();
    endFreeDrag();
  });
  viewport.addEventListener("pointercancel", () => {
    endPan();
    endFreeDrag();
  });
  viewport.addEventListener("wheel", zoomAt, { passive: false });

  window.addEventListener("resize", renderVisible);
}

async function init() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Failed to load ${DATA_URL}`);
  allMaterials = await response.json();
  allMaterials.forEach((item, index) => {
    item.id = item.id || `material-${index}`;
    materialById.set(item.id, item);
  });
  populateCategories();
  activeItems = allMaterials.slice();
  activeIndexById = new Map(activeItems.map((item, index) => [item.id, index]));
  loadState();
  updateAssetCount();
  renderHand();
  attachEvents();
  setWorldTransform();
}

init().catch(error => {
  console.error(error);
  assetCount.textContent = "Load failed";
  showToast("Не удалось загрузить materials.json");
});
