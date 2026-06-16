import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DATA_URL = "/data/assets.json";
const STORAGE_KEY = "quixel-asset-canvas-react-v2";

const CARD_W = 180;
const CARD_H = 238;
const CELL_W = 218;
const CELL_H = 278;
const GRID_COLS = 26;
const NOTE_H = 72;
const GROUP_GAP = 104;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4.25;

const TYPE_LABELS = {
  material: "Materials",
  decal: "Decals",
  brush: "Brushes",
};

const TYPE_ORDER = ["material", "decal", "brush"];

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("ru-RU")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function makeSearchText(asset) {
  return normalizeText([
    asset.title,
    asset.title_ru,
    asset.assetType,
    asset.listingType,
    asset.categoryPath,
    asset.categoryShort,
    asset.categoryLeaf,
    asset.slug,
    asset.purchased ? "purchased bought куплено" : "not purchased не куплено",
  ].join(" "));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pluralAsset(count) {
  return count === 1 ? "asset" : "assets";
}

function buildLayout(assets) {
  const groupMap = new Map();
  for (const asset of assets) {
    const key = asset.categoryPath || asset.categoryShort || asset.listingType;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        id: key,
        title: key,
        listingType: asset.listingType,
        assetType: asset.assetType,
        assets: [],
      });
    }
    groupMap.get(key).assets.push(asset);
  }

  const groups = Array.from(groupMap.values())
    .sort((a, b) => {
      const typeDelta = TYPE_ORDER.indexOf(a.listingType) - TYPE_ORDER.indexOf(b.listingType);
      return typeDelta || a.title.localeCompare(b.title);
    })
    .map(group => ({
      ...group,
      assets: group.assets.slice().sort((a, b) => {
        const titleDelta = a.title.localeCompare(b.title);
        return titleDelta || a.id.localeCompare(b.id);
      }),
    }));

  const assetPositions = new Map();
  const notes = [];
  let y = 0;

  for (const group of groups) {
    notes.push({
      id: `note-${group.id}`,
      groupId: group.id,
      title: group.title,
      assetType: group.assetType,
      listingType: group.listingType,
      count: group.assets.length,
      x: 0,
      y,
      width: GRID_COLS * CELL_W - (CELL_W - CARD_W),
      height: NOTE_H,
    });

    const startY = y + NOTE_H + 18;
    group.assets.forEach((asset, index) => {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      assetPositions.set(asset.id, {
        x: col * CELL_W,
        y: startY + row * CELL_H,
        groupId: group.id,
      });
    });

    const rows = Math.ceil(group.assets.length / GRID_COLS);
    y = startY + rows * CELL_H + GROUP_GAP;
  }

  return {
    groups,
    notes,
    assetPositions,
    width: GRID_COLS * CELL_W,
    height: Math.max(y, 1000),
  };
}

function usePersistentBoard(assetById) {
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [freeCopies, setFreeCopies] = useState([]);
  const [freeCopySeq, setFreeCopySeq] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!assetById.size || loaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoaded(true);
        return;
      }
      const state = JSON.parse(raw);
      setPinnedIds(new Set((state.pinnedIds || []).filter(id => assetById.has(id))));
      setFreeCopies((state.freeCopies || [])
        .filter(copy => assetById.has(copy.assetId))
        .map(copy => ({
          copyId: copy.copyId,
          assetId: copy.assetId,
          x: Number(copy.x) || 0,
          y: Number(copy.y) || 0,
        })));
      setFreeCopySeq(Math.max(Number(state.freeCopySeq) || 1, 1));
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [assetById, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const handle = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        pinnedIds: Array.from(pinnedIds),
        freeCopies,
        freeCopySeq,
      }));
    }, 150);
    return () => window.clearTimeout(handle);
  }, [pinnedIds, freeCopies, freeCopySeq, loaded]);

  return {
    pinnedIds,
    setPinnedIds,
    freeCopies,
    setFreeCopies,
    freeCopySeq,
    setFreeCopySeq,
  };
}

export default function App() {
  const viewportRef = useRef(null);
  const panRef = useRef(null);
  const freeDragRef = useRef(null);
  const handDragRef = useRef(null);

  const [assets, setAssets] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [hideUnpurchased, setHideUnpurchased] = useState(true);
  const [enabledTypes, setEnabledTypes] = useState(() => new Set(["material"]));
  const [categoryFilter, setCategoryFilter] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removePinnedOnDrag, setRemovePinnedOnDrag] = useState(true);
  const [showOriginalTitle, setShowOriginalTitle] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [nextMatchIndex, setNextMatchIndex] = useState(0);
  const [currentFocusId, setCurrentFocusId] = useState("");
  const [view, setView] = useState({ x: 32, y: 34, scale: 0.78 });
  const [toast, setToast] = useState("");
  const [handGhost, setHandGhost] = useState(null);
  const [windowWidth, setWindowWidth] = useState(() => typeof window === "undefined" ? 1280 : window.innerWidth);

  const assetById = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets]);
  const board = usePersistentBoard(assetById);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load ${DATA_URL}`);
        return response.json();
      })
      .then(data => {
        if (!cancelled) {
          setAssets(data.map(asset => ({ ...asset, searchText: makeSearchText(asset) })));
        }
      })
      .catch(error => {
        if (!cancelled) setLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const handle = window.setTimeout(() => setToast(""), 1900);
    return () => window.clearTimeout(handle);
  }, [toast]);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const typeCounts = useMemo(() => {
    const counts = new Map(TYPE_ORDER.map(type => [type, 0]));
    for (const asset of assets) counts.set(asset.listingType, (counts.get(asset.listingType) || 0) + 1);
    return counts;
  }, [assets]);

  const filteredBaseAssets = useMemo(() => {
    return assets.filter(asset => {
      if (!enabledTypes.has(asset.listingType)) return false;
      if (hideUnpurchased && !asset.purchased) return false;
      if (categoryFilter && asset.categoryPath !== categoryFilter) return false;
      return true;
    });
  }, [assets, categoryFilter, enabledTypes, hideUnpurchased]);

  const categories = useMemo(() => {
    const seen = new Map();
    for (const asset of assets) {
      if (!enabledTypes.has(asset.listingType)) continue;
      if (hideUnpurchased && !asset.purchased) continue;
      seen.set(asset.categoryPath, asset.categoryPath);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [assets, enabledTypes, hideUnpurchased]);

  useEffect(() => {
    if (categoryFilter && !categories.includes(categoryFilter)) setCategoryFilter("");
  }, [categories, categoryFilter]);

  const activeAssets = useMemo(() => {
    const query = normalizeText(activeQuery);
    return filteredBaseAssets.map(asset => ({
      ...asset,
      isSearchMatch: query ? query.split(/\s+/).filter(Boolean).every(part => asset.searchText.includes(part)) : true,
    }));
  }, [activeQuery, filteredBaseAssets]);

  const layout = useMemo(() => buildLayout(activeAssets), [activeAssets]);
  const searchMatches = useMemo(() => {
    if (!activeQuery) return [];
    return activeAssets.filter(asset => asset.isSearchMatch);
  }, [activeAssets, activeQuery]);
  const searchMatchSet = useMemo(() => new Set(searchMatches.map(asset => asset.id)), [searchMatches]);

  useEffect(() => {
    setNextMatchIndex(0);
    setCurrentFocusId("");
  }, [activeQuery, categoryFilter, enabledTypes, hideUnpurchased]);

  const viewportBounds = useMemo(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { left: -500, top: -500, right: 1600, bottom: 1200 };
    const pad = 520 / view.scale;
    return {
      left: -view.x / view.scale - pad,
      top: -view.y / view.scale - pad,
      right: (rect.width - view.x) / view.scale + pad,
      bottom: (rect.height - view.y) / view.scale + pad,
    };
  }, [view]);

  const visibleAssets = useMemo(() => {
    return activeAssets.filter(asset => {
      const pos = layout.assetPositions.get(asset.id);
      if (!pos) return false;
      return pos.x + CARD_W >= viewportBounds.left
        && pos.x <= viewportBounds.right
        && pos.y + CARD_H >= viewportBounds.top
        && pos.y <= viewportBounds.bottom;
    });
  }, [activeAssets, layout.assetPositions, viewportBounds]);

  const visibleNotes = useMemo(() => {
    return layout.notes.filter(note => note.x + note.width >= viewportBounds.left
      && note.x <= viewportBounds.right
      && note.y + note.height >= viewportBounds.top
      && note.y <= viewportBounds.bottom);
  }, [layout.notes, viewportBounds]);

  const visibleFreeCopies = useMemo(() => {
    return board.freeCopies.filter(copy => copy.x + CARD_W >= viewportBounds.left
      && copy.x <= viewportBounds.right
      && copy.y + CARD_H >= viewportBounds.top
      && copy.y <= viewportBounds.bottom);
  }, [board.freeCopies, viewportBounds]);

  const setTypeEnabled = useCallback((type) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(type) && next.size > 1) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
  }, []);

  const resetView = useCallback(() => {
    setView({ x: 32, y: 34, scale: 0.78 });
  }, []);

  const centerOnAsset = useCallback((asset, requestedScale = 1.18) => {
    const pos = layout.assetPositions.get(asset.id);
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!pos || !rect) return;
    const scale = clamp(requestedScale, MIN_ZOOM, MAX_ZOOM);
    setView({
      scale,
      x: rect.width / 2 - (pos.x + CARD_W / 2) * scale,
      y: rect.height / 2 - (pos.y + CARD_H / 2) * scale,
    });
    setCurrentFocusId(asset.id);
  }, [layout.assetPositions]);

  const runSearch = useCallback(() => {
    const query = normalizeText(queryInput.trim());
    setActiveQuery(query);
    setCurrentFocusId("");
    setNextMatchIndex(0);
    if (!query) return;
    const matches = filteredBaseAssets.filter(asset => query.split(/\s+/).filter(Boolean).every(part => asset.searchText.includes(part)));
    if (!matches.length) showToast("Совпадений нет");
  }, [filteredBaseAssets, queryInput, showToast]);

  const goToNextMatch = useCallback(() => {
    if (!activeQuery || !searchMatches.length) {
      runSearch();
      return;
    }
    const index = nextMatchIndex % searchMatches.length;
    centerOnAsset(searchMatches[index], Math.max(view.scale, 1.24));
    setNextMatchIndex((index + 1) % searchMatches.length);
  }, [activeQuery, centerOnAsset, nextMatchIndex, runSearch, searchMatches, view.scale]);

  const handleSearchSubmit = useCallback((event) => {
    event.preventDefault();
    const normalizedInput = normalizeText(queryInput.trim());
    if (activeQuery && normalizedInput === activeQuery && searchMatches.length) goToNextMatch();
    else runSearch();
  }, [activeQuery, goToNextMatch, queryInput, runSearch, searchMatches.length]);

  const handleQueryInputChange = useCallback((value) => {
    setQueryInput(value);
    if (normalizeText(value.trim()) !== activeQuery) {
      setActiveQuery("");
      setCurrentFocusId("");
      setNextMatchIndex(0);
    }
  }, [activeQuery]);

  const togglePinned = useCallback((assetId) => {
    board.setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, [board]);

  const createFreeCopy = useCallback((assetId, x, y) => {
    board.setFreeCopySeq(seq => seq + 1);
    board.setFreeCopies(prev => {
      const copyId = `copy-${Date.now()}-${board.freeCopySeq}`;
      return [...prev, { copyId, assetId, x, y }];
    });
  }, [board]);

  const duplicateAsset = useCallback((assetId) => {
    const pos = layout.assetPositions.get(assetId);
    if (!pos) return;
    createFreeCopy(assetId, pos.x + 28, pos.y + 28);
    showToast("Создана свободная копия");
  }, [createFreeCopy, layout.assetPositions, showToast]);

  const deleteFreeCopy = useCallback((copyId) => {
    board.setFreeCopies(prev => prev.filter(copy => copy.copyId !== copyId));
  }, [board]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }, [view]);

  const handleViewportPointerDown = useCallback((event) => {
    if (event.button !== 0 || event.target.closest(".toolbar, .hand, button, a, input, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
  }, [view]);

  const handleViewportPointerMove = useCallback((event) => {
    if (panRef.current) {
      const pan = panRef.current;
      setView(prev => ({
        ...prev,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      }));
    }
    if (freeDragRef.current) {
      const drag = freeDragRef.current;
      const dx = (event.clientX - drag.startX) / view.scale;
      const dy = (event.clientY - drag.startY) / view.scale;
      board.setFreeCopies(prev => prev.map(copy => copy.copyId === drag.copyId
        ? { ...copy, x: drag.originX + dx, y: drag.originY + dy }
        : copy));
    }
  }, [board, view.scale]);

  const endPointerGesture = useCallback(() => {
    panRef.current = null;
    freeDragRef.current = null;
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const before = {
      x: (px - view.x) / view.scale,
      y: (py - view.y) / view.scale,
    };
    const factor = event.deltaY < 0 ? 1.16 : 0.86;
    const scale = clamp(view.scale * factor, MIN_ZOOM, MAX_ZOOM);
    setView({
      scale,
      x: px - before.x * scale,
      y: py - before.y * scale,
    });
  }, [view]);

  const startFreeDrag = useCallback((event, copy) => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    freeDragRef.current = {
      copyId: copy.copyId,
      startX: event.clientX,
      startY: event.clientY,
      originX: copy.x,
      originY: copy.y,
    };
  }, []);

  const startHandDrag = useCallback((event, assetId) => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    event.preventDefault();
    const asset = assetById.get(assetId);
    if (!asset) return;
    handDragRef.current = { assetId };
    setHandGhost({ asset, x: event.clientX, y: event.clientY });
  }, [assetById]);

  useEffect(() => {
    function handleMove(event) {
      if (!handDragRef.current) return;
      setHandGhost(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : prev);
    }

    function handleUp(event) {
      if (!handDragRef.current) return;
      const { assetId } = handDragRef.current;
      handDragRef.current = null;
      setHandGhost(null);
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      const point = screenToWorld(event.clientX, event.clientY);
      createFreeCopy(assetId, point.x - CARD_W / 2, point.y - CARD_H / 2);
      if (removePinnedOnDrag) {
        board.setPinnedIds(prev => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
      }
      showToast("Копия добавлена на доску");
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [board, createFreeCopy, removePinnedOnDrag, screenToWorld, showToast]);

  const matchButtonLabel = activeQuery && searchMatches.length
    ? `Next ${nextMatchIndex + 1}/${searchMatches.length}`
    : "Search";

  const activeSummary = `${filteredBaseAssets.length.toLocaleString("ru-RU")} / ${assets.length.toLocaleString("ru-RU")} assets`;

  return (
    <div className="app-shell">
      <Toolbar
        assetSummary={loadError ? "Load failed" : activeSummary}
        queryInput={queryInput}
        setQueryInput={handleQueryInputChange}
        onSubmit={handleSearchSubmit}
        matchButtonLabel={matchButtonLabel}
        matchCount={activeQuery ? searchMatches.length : null}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        typeCounts={typeCounts}
        enabledTypes={enabledTypes}
        onToggleType={setTypeEnabled}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
        hideUnpurchased={hideUnpurchased}
        setHideUnpurchased={setHideUnpurchased}
        removePinnedOnDrag={removePinnedOnDrag}
        setRemovePinnedOnDrag={setRemovePinnedOnDrag}
        showOriginalTitle={showOriginalTitle}
        setShowOriginalTitle={setShowOriginalTitle}
        resetView={resetView}
      />

      <main
        ref={viewportRef}
        className={`viewport ${panRef.current ? "is-panning" : ""}`}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={endPointerGesture}
        onPointerCancel={endPointerGesture}
        onWheel={handleWheel}
      >
        <div
          className="world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <div className="note-layer">
            {visibleNotes.map(note => (
              <GroupNote
                key={note.id}
                note={note}
                activeQuery={activeQuery}
                searchMatchCount={activeQuery
                  ? activeAssets.filter(asset => asset.categoryPath === note.title && asset.isSearchMatch).length
                  : null}
              />
            ))}
          </div>
          <div className="grid-layer">
            {visibleAssets.map(asset => {
              const pos = layout.assetPositions.get(asset.id);
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  x={pos.x}
                  y={pos.y}
                  kind="grid"
                  isPinned={board.pinnedIds.has(asset.id)}
                  hasSearch={Boolean(activeQuery)}
                  isSearchMatch={!activeQuery || searchMatchSet.has(asset.id)}
                  isCurrent={currentFocusId === asset.id}
                  showOriginalTitle={showOriginalTitle}
                  onTogglePinned={() => togglePinned(asset.id)}
                  onDuplicate={() => duplicateAsset(asset.id)}
                />
              );
            })}
          </div>
          <div className="free-layer">
            {visibleFreeCopies.map(copy => {
              const asset = assetById.get(copy.assetId);
              if (!asset) return null;
              return (
                <AssetCard
                  key={copy.copyId}
                  asset={asset}
                  x={copy.x}
                  y={copy.y}
                  kind="free"
                  isPinned={board.pinnedIds.has(asset.id)}
                  hasSearch={Boolean(activeQuery)}
                  isSearchMatch={!activeQuery || searchMatchSet.has(asset.id)}
                  isCurrent={currentFocusId === asset.id}
                  showOriginalTitle={showOriginalTitle}
                  onTogglePinned={() => togglePinned(asset.id)}
                  onDelete={() => deleteFreeCopy(copy.copyId)}
                  onPointerDown={(event) => startFreeDrag(event, copy)}
                />
              );
            })}
          </div>
        </div>
      </main>

      <Hand
        pinnedIds={board.pinnedIds}
        assetById={assetById}
        windowWidth={windowWidth}
        showOriginalTitle={showOriginalTitle}
        onRemove={(assetId) => togglePinned(assetId)}
        onDragStart={startHandDrag}
      />

      {handGhost && <HandGhost ghost={handGhost} showOriginalTitle={showOriginalTitle} />}
      {toast && <div className="toast is-visible">{toast}</div>}
    </div>
  );
}

function Toolbar({
  assetSummary,
  typeCounts,
  enabledTypes,
  onToggleType,
  queryInput,
  setQueryInput,
  onSubmit,
  matchButtonLabel,
  matchCount,
  settingsOpen,
  setSettingsOpen,
  categoryFilter,
  setCategoryFilter,
  categories,
  hideUnpurchased,
  setHideUnpurchased,
  removePinnedOnDrag,
  setRemovePinnedOnDrag,
  showOriginalTitle,
  setShowOriginalTitle,
  resetView,
}) {
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">Q</span>
        <div>
          <strong>Quixel Asset Canvas</strong>
          <span>{assetSummary}</span>
        </div>
      </div>

      <form className="search-bar" onSubmit={onSubmit}>
        <input
          value={queryInput}
          type="search"
          autoComplete="off"
          placeholder="Поиск по title / title_ru"
          onChange={event => setQueryInput(event.target.value)}
        />
        <button className="primary-button" type="submit">{matchButtonLabel}</button>
        <span className="match-count">{matchCount == null ? "" : `${matchCount.toLocaleString("ru-RU")} совпадений`}</span>
      </form>

      <div className="toolbar-controls">
        <button className="icon-button" type="button" title="Reset view" aria-label="Reset view" onClick={resetView}>
          <ResetIcon />
        </button>
        <button
          className={`icon-button settings-button ${settingsOpen ? "is-active" : ""}`}
          type="button"
          title="Settings"
          aria-label="Settings"
          onClick={() => setSettingsOpen(open => !open)}
        >
          <SettingsIcon />
        </button>
        {settingsOpen && (
          <SettingsPanel
            typeCounts={typeCounts}
            enabledTypes={enabledTypes}
            onToggleType={onToggleType}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            categories={categories}
            hideUnpurchased={hideUnpurchased}
            setHideUnpurchased={setHideUnpurchased}
            removePinnedOnDrag={removePinnedOnDrag}
            setRemovePinnedOnDrag={setRemovePinnedOnDrag}
            showOriginalTitle={showOriginalTitle}
            setShowOriginalTitle={setShowOriginalTitle}
          />
        )}
      </div>
    </header>
  );
}

function SettingsPanel({
  typeCounts,
  enabledTypes,
  onToggleType,
  categoryFilter,
  setCategoryFilter,
  categories,
  hideUnpurchased,
  setHideUnpurchased,
  removePinnedOnDrag,
  setRemovePinnedOnDrag,
  showOriginalTitle,
  setShowOriginalTitle,
}) {
  return (
    <section className="settings-popover" aria-label="Settings panel">
      <div className="settings-section">
        <strong>Asset types</strong>
        <div className="settings-type-list">
          {TYPE_ORDER.map(type => (
            <label key={type} className="settings-check">
              <input
                type="checkbox"
                checked={enabledTypes.has(type)}
                onChange={() => onToggleType(type)}
              />
              <span>{TYPE_LABELS[type]}</span>
              <small>{(typeCounts.get(type) || 0).toLocaleString("ru-RU")}</small>
            </label>
          ))}
        </div>
      </div>

      <label className="settings-section">
        <strong>Sub category</strong>
        <select
          value={categoryFilter}
          aria-label="Sub category"
          onChange={event => setCategoryFilter(event.target.value)}
        >
          <option value="">Все подкатегории</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      <div className="settings-section compact">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={hideUnpurchased}
            onChange={event => setHideUnpurchased(event.target.checked)}
          />
          <span>Скрыть не купленные</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={removePinnedOnDrag}
            onChange={event => setRemovePinnedOnDrag(event.target.checked)}
          />
          <span>Убирать из Pinned при вытаскивании</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={showOriginalTitle}
            onChange={event => setShowOriginalTitle(event.target.checked)}
          />
          <span>Показывать оригинальный title</span>
        </label>
      </div>
    </section>
  );
}

function GroupNote({ note, activeQuery, searchMatchCount }) {
  return (
    <section
      className="group-note"
      style={{ transform: `translate(${note.x}px, ${note.y}px)`, width: note.width, height: note.height }}
    >
      <div>
        <span className={`note-type note-${note.listingType}`}>{TYPE_LABELS[note.listingType] || note.assetType}</span>
        <strong>{note.title}</strong>
      </div>
      <span>{activeQuery ? `${searchMatchCount} / ${note.count}` : `${note.count} ${pluralAsset(note.count)}`}</span>
    </section>
  );
}

function AssetCard({
  asset,
  x,
  y,
  kind,
  isPinned,
  hasSearch,
  isSearchMatch,
  isCurrent,
  showOriginalTitle,
  onTogglePinned,
  onDuplicate,
  onDelete,
  onPointerDown,
}) {
  const className = [
    "asset-card",
    kind === "free" ? "is-free" : "",
    hasSearch && !isSearchMatch ? "search-dim" : "",
    hasSearch && isSearchMatch ? "search-match" : "",
    isCurrent ? "current-hit" : "",
  ].filter(Boolean).join(" ");
  const primaryTitle = showOriginalTitle ? asset.title : (asset.title_ru || asset.title);
  const secondaryTitle = showOriginalTitle ? asset.title_ru : "";

  return (
    <article
      className={className}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        if (event.target.closest("button, a")) return;
        window.open(asset.url, "_blank", "noreferrer");
      }}
    >
      <div className="card-title">
        <span className="title-text" title={`${asset.title}\n${asset.title_ru}`}>{primaryTitle}</span>
        {secondaryTitle && <span className="title-ru">{secondaryTitle}</span>}
      </div>
      <div className="card-image-wrap">
        <img
          className="card-image"
          src={asset.preview}
          alt=""
          draggable="false"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="card-footer">
        <div className="card-actions">
          <button className={`card-icon star-button ${isPinned ? "is-pinned" : ""}`} type="button" title="Pin" aria-label="Pin asset" onClick={onTogglePinned}>
            <StarIcon />
          </button>
          {kind === "free" ? (
            <button className="card-icon delete-button" type="button" title="Delete duplicate" aria-label="Delete duplicate" onClick={onDelete}>
              <TrashIcon />
            </button>
          ) : (
            <button className="card-icon duplicate-button" type="button" title="Create movable copy" aria-label="Create movable copy" onClick={onDuplicate}>
              <CopyIcon />
            </button>
          )}
          <a className="card-icon link-button" href={asset.url} target="_blank" rel="noreferrer" title="Open Fab" aria-label="Open Fab listing">
            <ExternalIcon />
          </a>
        </div>
      </div>
    </article>
  );
}

function Hand({ pinnedIds, assetById, windowWidth, showOriginalTitle, onRemove, onDragStart }) {
  const pinnedAssets = Array.from(pinnedIds)
    .map(assetId => assetById.get(assetId))
    .filter(Boolean);
  const availableWidth = Math.max(280, windowWidth - 44);
  const step = pinnedAssets.length > 1
    ? clamp((availableWidth - 116) / (pinnedAssets.length - 1), 8, 104)
    : 0;

  return (
    <aside className="hand" aria-label="Pinned assets">
      <div className="hand-cards" style={{ "--hand-count": pinnedAssets.length, "--hand-step": `${step}px` }}>
        {pinnedAssets.map((asset, index) => {
          const primaryTitle = showOriginalTitle ? asset.title : (asset.title_ru || asset.title);
          const secondaryTitle = showOriginalTitle ? asset.title_ru : "";
          return (
            <div
              key={asset.id}
              className="hand-card"
              style={{
                "--hand-index": index,
              }}
              onPointerDown={(event) => onDragStart(event, asset.id)}
            >
              <div className="hand-card-title">
                <span>{primaryTitle}</span>
                {secondaryTitle && <small>{secondaryTitle}</small>}
              </div>
              <div className="hand-card-image">
                <img src={asset.preview} alt="" draggable="false" referrerPolicy="no-referrer" />
              </div>
              <div className="hand-card-actions">
                <button className="card-icon star-button is-pinned" type="button" title="Unpin" aria-label="Unpin asset" onClick={(event) => {
                  event.stopPropagation();
                  onRemove(asset.id);
                }}>
                  <StarIcon />
                </button>
                <a className="card-icon link-button" href={asset.url} target="_blank" rel="noreferrer" title="Open Fab" aria-label="Open Fab listing" onPointerDown={event => event.stopPropagation()}>
                  <ExternalIcon />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function HandGhost({ ghost, showOriginalTitle }) {
  return (
    <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
      <AssetCard
        asset={ghost.asset}
        x={0}
        y={0}
        kind="grid"
        isPinned
        hasSearch={false}
        isSearchMatch
        isCurrent={false}
        showOriginalTitle={showOriginalTitle}
        onTogglePinned={() => {}}
        onDuplicate={() => {}}
      />
    </div>
  );
}

function ResetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.68V3h-5.68l1.93 1.93A10 10 0 1 0 22 14h-2a8 8 0 1 1-16-2Z" /></svg>;
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65-2-3.46-2.49 1a7.4 7.4 0 0 0-1.69-.98L15 3h-4l-.36 2.93c-.6.24-1.16.57-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65 2 3.46 2.49-1c.52.41 1.09.74 1.69.98L11 21h4l.36-2.93c.6-.24 1.16-.57 1.69-.98l2.49 1 2-3.46-2.11-1.65ZM13 17h-2l-.28-2.27-.64-.26a5.5 5.5 0 0 1-1.26-.73l-.55-.42-1.94.78-1-1.73 1.65-1.29-.09-.69A5.6 5.6 0 0 1 6.82 12c0-.27.02-.53.06-.79l.09-.69-1.65-1.29 1-1.73 1.94.78.55-.42c.39-.3.81-.55 1.26-.73l.64-.26L11 4.6h2l.28 2.27.64.26c.45.18.87.43 1.26.73l.55.42 1.94-.78 1 1.73-1.65 1.29.09.69c.04.26.06.52.06.79s-.02.53-.06.79l-.09.69 1.65 1.29-1 1.73-1.94-.78-.55.42c-.39.3-.81.55-1.26.73l-.64.26L13 17Zm-1-7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" /></svg>;
}

function StarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.42l-5.8 3.05L7.31 14l-4.7-4.58 6.49-.94L12 2.6Z" /></svg>;
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h2Zm2 10v1a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1h-4a3 3 0 0 1-1-.17V17Zm1-11a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-7ZM6 9a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.17A3 3 0 0 1 8 18v-8c0-.35.06-.69.17-1H6Z" /></svg>;
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h5v2h-2l-1.1 13.1A2 2 0 0 1 15.9 22H8.1a2 2 0 0 1-1.99-1.9L5 7H3V5h5l1-2Zm-1 4 1.08 13h5.84L16 7H8Zm2 2h2v9h-2V9Zm4 0h2v9h-2V9Z" /></svg>;
}

function ExternalIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>;
}
