import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DATA_URL = "/data/assets.json";
const LEGACY_STORAGE_KEY = "quixel-asset-canvas-react-v2";
const PROFILES_STORAGE_KEY = "quixel-asset-canvas-profiles-v1";
const PROFILE_EXPORT_VERSION = 1;
const DEFAULT_PROFILE_NAME = "Мой профиль";

const CARD_W = 180;
const CARD_H = 238;
const CELL_W = 218;
const CELL_H = 278;
const GRID_COLS = 26;
const NOTE_H = 72;
const GROUP_GAP = 104;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4.25;
const DEFAULT_VIEW = { x: 32, y: 34, scale: 0.78 };
const DEFAULT_SETTINGS = {
  hideUnpurchased: true,
  enabledTypes: ["material"],
  categoryFilter: "",
  removePinnedOnDrag: true,
  showOriginalTitle: false,
  pinnedFan: false,
  staticGridBackground: true,
  theme: "dark",
};

const TYPE_LABELS = {
  material: "Materials",
  decal: "Decals",
  brush: "Brushes",
};

const TYPE_ORDER = ["material", "decal", "brush"];

const THEME_OPTIONS = [
  { value: "light", label: "Светлая" },
  { value: "mixed", label: "Светлая с темным" },
  { value: "dark", label: "Темная" },
];

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

function extractSearchTokens(asset) {
  return [
    asset.title,
    asset.title_ru,
    asset.categoryLeaf,
    asset.categoryShort,
  ]
    .join(" ")
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function matchSuggestionCase(word, typedWord) {
  if (!word || !typedWord) return word;
  if (typedWord === typedWord.toLocaleUpperCase("ru-RU")) return word.toLocaleUpperCase("ru-RU");
  const first = typedWord[0];
  if (first && first !== first.toLocaleLowerCase("ru-RU") && first === first.toLocaleUpperCase("ru-RU")) {
    return word[0].toLocaleUpperCase("ru-RU") + word.slice(1);
  }
  return word;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pluralAsset(count) {
  return count === 1 ? "asset" : "assets";
}

function russianPlural(count, forms) {
  const value = Math.abs(count) % 100;
  const single = value % 10;
  if (value > 10 && value < 20) return forms[2];
  if (single > 1 && single < 5) return forms[1];
  if (single === 1) return forms[0];
  return forms[2];
}

function formatProfileTime(timestamp) {
  const value = Number(timestamp);
  if (!value) return "еще не сохранялся";
  const deltaMs = Math.max(0, Date.now() - value);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (deltaMs < minute) return "только что";
  if (deltaMs < hour) {
    const count = Math.floor(deltaMs / minute);
    return `${count} ${russianPlural(count, ["минуту", "минуты", "минут"])} назад`;
  }
  if (deltaMs < day) {
    const count = Math.floor(deltaMs / hour);
    return `${count} ${russianPlural(count, ["час", "часа", "часов"])} назад`;
  }
  if (deltaMs < 7 * day) {
    const count = Math.floor(deltaMs / day);
    return `${count} ${russianPlural(count, ["день", "дня", "дней"])} назад`;
  }
  if (deltaMs < 14 * day) return "неделю назад";
  const date = new Date(value);
  const formatted = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return date.getFullYear() === new Date().getFullYear()
    ? formatted
    : `${formatted} ${date.getFullYear()}`;
}

function makeProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEnabledTypes(types) {
  const next = Array.isArray(types)
    ? types.filter(type => TYPE_ORDER.includes(type))
    : DEFAULT_SETTINGS.enabledTypes;
  return next.length ? Array.from(new Set(next)) : DEFAULT_SETTINGS.enabledTypes;
}

function normalizeTheme(theme) {
  return THEME_OPTIONS.some(option => option.value === theme) ? theme : DEFAULT_SETTINGS.theme;
}

function sanitizeView(view) {
  return {
    x: Number.isFinite(Number(view?.x)) ? Number(view.x) : DEFAULT_VIEW.x,
    y: Number.isFinite(Number(view?.y)) ? Number(view.y) : DEFAULT_VIEW.y,
    scale: clamp(Number(view?.scale) || DEFAULT_VIEW.scale, MIN_ZOOM, MAX_ZOOM),
  };
}

function sanitizeBoard(board, assetById) {
  const pinnedIds = Array.isArray(board?.pinnedIds)
    ? board.pinnedIds.filter(assetId => assetById.has(assetId))
    : [];
  const freeCopies = Array.isArray(board?.freeCopies)
    ? board.freeCopies
      .filter(copy => assetById.has(copy?.assetId))
      .map((copy, index) => ({
        copyId: String(copy.copyId || `copy-${Date.now()}-${index}`),
        assetId: copy.assetId,
        x: Number.isFinite(Number(copy.x)) ? Number(copy.x) : 0,
        y: Number.isFinite(Number(copy.y)) ? Number(copy.y) : 0,
      }))
    : [];
  return {
    pinnedIds: Array.from(new Set(pinnedIds)),
    freeCopies,
    freeCopySeq: Math.max(Number(board?.freeCopySeq) || 1, freeCopies.length + 1, 1),
  };
}

function createBlankProfile(name = DEFAULT_PROFILE_NAME, now = Date.now()) {
  return {
    id: makeProfileId(),
    name: name.trim() || DEFAULT_PROFILE_NAME,
    createdAt: now,
    updatedAt: now,
    view: { ...DEFAULT_VIEW },
    settings: { ...DEFAULT_SETTINGS },
    board: {
      pinnedIds: [],
      freeCopies: [],
      freeCopySeq: 1,
    },
  };
}

function sanitizeProfile(profile, assetById, fallbackName = DEFAULT_PROFILE_NAME) {
  const now = Date.now();
  const settings = profile?.settings || {};
  return {
    id: String(profile?.id || makeProfileId()),
    name: String(profile?.name || fallbackName).trim() || fallbackName,
    createdAt: Number(profile?.createdAt) || now,
    updatedAt: Number(profile?.updatedAt) || now,
    view: sanitizeView(profile?.view),
    settings: {
      hideUnpurchased: settings.hideUnpurchased ?? DEFAULT_SETTINGS.hideUnpurchased,
      enabledTypes: normalizeEnabledTypes(settings.enabledTypes),
      categoryFilter: String(settings.categoryFilter || ""),
      removePinnedOnDrag: settings.removePinnedOnDrag ?? DEFAULT_SETTINGS.removePinnedOnDrag,
      showOriginalTitle: settings.showOriginalTitle ?? DEFAULT_SETTINGS.showOriginalTitle,
      pinnedFan: settings.pinnedFan ?? DEFAULT_SETTINGS.pinnedFan,
      staticGridBackground: settings.staticGridBackground ?? DEFAULT_SETTINGS.staticGridBackground,
      theme: normalizeTheme(settings.theme),
    },
    board: sanitizeBoard(profile?.board, assetById),
  };
}

function readLegacyBoard(assetById) {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeBoard(JSON.parse(raw), assetById);
  } catch {
    return null;
  }
}

function loadProfileStore(assetById) {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      const profiles = (Array.isArray(state.profiles) ? state.profiles : [])
        .map((profile, index) => sanitizeProfile(profile, assetById, `Профиль ${index + 1}`));
      if (profiles.length) {
        const activeProfileId = profiles.some(profile => profile.id === state.activeProfileId)
          ? state.activeProfileId
          : profiles[0].id;
        return { profiles, activeProfileId };
      }
    }
  } catch {
    // Fall through to the legacy/default profile.
  }

  const now = Date.now();
  const profile = createBlankProfile(DEFAULT_PROFILE_NAME, now);
  const legacyBoard = readLegacyBoard(assetById);
  if (legacyBoard) profile.board = legacyBoard;
  return { profiles: [profile], activeProfileId: profile.id };
}

function writeProfileStore(profiles, activeProfileId) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify({
    version: PROFILE_EXPORT_VERSION,
    activeProfileId,
    profiles,
  }));
}

function makeUniqueProfileName(name, usedNames) {
  const cleanName = String(name || DEFAULT_PROFILE_NAME).trim() || DEFAULT_PROFILE_NAME;
  if (!usedNames.has(cleanName)) return cleanName;
  let index = 2;
  let nextName = `${cleanName} ${index}`;
  while (usedNames.has(nextName)) {
    index += 1;
    nextName = `${cleanName} ${index}`;
  }
  return nextName;
}

function readProfilesFromPayload(payload, assetById) {
  const rawProfiles = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.profiles)
      ? payload.profiles
      : [];
  return rawProfiles.map((profile, index) => sanitizeProfile(profile, assetById, `Импорт ${index + 1}`));
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

export default function App() {
  const viewportRef = useRef(null);
  const panRef = useRef(null);
  const freeDragRef = useRef(null);
  const handDragRef = useRef(null);
  const profileFileInputRef = useRef(null);
  const skipNextAutosaveRef = useRef(false);

  const [assets, setAssets] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [hideUnpurchased, setHideUnpurchased] = useState(DEFAULT_SETTINGS.hideUnpurchased);
  const [enabledTypes, setEnabledTypes] = useState(() => new Set(DEFAULT_SETTINGS.enabledTypes));
  const [categoryFilter, setCategoryFilter] = useState(DEFAULT_SETTINGS.categoryFilter);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [removePinnedOnDrag, setRemovePinnedOnDrag] = useState(DEFAULT_SETTINGS.removePinnedOnDrag);
  const [showOriginalTitle, setShowOriginalTitle] = useState(DEFAULT_SETTINGS.showOriginalTitle);
  const [pinnedFan, setPinnedFan] = useState(DEFAULT_SETTINGS.pinnedFan);
  const [staticGridBackground, setStaticGridBackground] = useState(DEFAULT_SETTINGS.staticGridBackground);
  const [theme, setTheme] = useState(DEFAULT_SETTINGS.theme);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [nextMatchIndex, setNextMatchIndex] = useState(0);
  const [currentFocusId, setCurrentFocusId] = useState("");
  const [view, setView] = useState(DEFAULT_VIEW);
  const [toast, setToast] = useState("");
  const [handGhost, setHandGhost] = useState(null);
  const [windowWidth, setWindowWidth] = useState(() => typeof window === "undefined" ? 1280 : window.innerWidth);
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [freeCopies, setFreeCopies] = useState([]);
  const [freeCopySeq, setFreeCopySeq] = useState(1);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");

  const assetById = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets]);

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

  const searchVocabulary = useMemo(() => {
    const words = new Map();
    for (const asset of filteredBaseAssets) {
      for (const token of extractSearchTokens(asset)) {
        if (token.length < 2) continue;
        const key = normalizeText(token);
        if (!key || key.length < 2) continue;
        const current = words.get(key);
        if (current) current.count += 1;
        else words.set(key, { word: token, count: 1 });
      }
    }
    return Array.from(words.values())
      .sort((a, b) => b.count - a.count || a.word.length - b.word.length || a.word.localeCompare(b.word));
  }, [filteredBaseAssets]);

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
  const searchSuggestion = useMemo(() => {
    const currentWord = queryInput.match(/[\p{L}\p{N}]+$/u)?.[0] || "";
    const normalizedWord = normalizeText(currentWord);
    if (normalizedWord.length < 2) return "";
    const suggestion = searchVocabulary.find(entry => {
      const normalizedSuggestion = normalizeText(entry.word);
      return normalizedSuggestion.startsWith(normalizedWord) && normalizedSuggestion !== normalizedWord;
    });
    return matchSuggestionCase(suggestion?.word || "", currentWord);
  }, [queryInput, searchVocabulary]);

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
    return freeCopies.filter(copy => copy.x + CARD_W >= viewportBounds.left
      && copy.x <= viewportBounds.right
      && copy.y + CARD_H >= viewportBounds.top
      && copy.y <= viewportBounds.bottom);
  }, [freeCopies, viewportBounds]);

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

  const applyProfileToState = useCallback((profile) => {
    setView(profile.view);
    setHideUnpurchased(profile.settings.hideUnpurchased);
    setEnabledTypes(new Set(profile.settings.enabledTypes));
    setCategoryFilter(profile.settings.categoryFilter);
    setRemovePinnedOnDrag(profile.settings.removePinnedOnDrag);
    setShowOriginalTitle(profile.settings.showOriginalTitle);
    setPinnedFan(profile.settings.pinnedFan);
    setStaticGridBackground(profile.settings.staticGridBackground);
    setTheme(normalizeTheme(profile.settings.theme));
    setPinnedIds(new Set(profile.board.pinnedIds));
    setFreeCopies(profile.board.freeCopies);
    setFreeCopySeq(profile.board.freeCopySeq);
    setQueryInput("");
    setActiveQuery("");
    setNextMatchIndex(0);
    setCurrentFocusId("");
  }, []);

  useEffect(() => {
    if (!assetById.size || profilesLoaded) return;
    const store = loadProfileStore(assetById);
    const activeProfile = store.profiles.find(profile => profile.id === store.activeProfileId) || store.profiles[0];
    setProfiles(store.profiles);
    setActiveProfileId(activeProfile.id);
    skipNextAutosaveRef.current = true;
    applyProfileToState(activeProfile);
    writeProfileStore(store.profiles, activeProfile.id);
    setProfilesLoaded(true);
  }, [applyProfileToState, assetById, profilesLoaded]);

  const activeProfile = useMemo(() => {
    return profiles.find(profile => profile.id === activeProfileId) || null;
  }, [activeProfileId, profiles]);

  const buildCurrentProfile = useCallback((baseProfile, savedAt = Date.now()) => {
    const profile = baseProfile || createBlankProfile(DEFAULT_PROFILE_NAME, savedAt);
    const cleanBoard = sanitizeBoard({
      pinnedIds: Array.from(pinnedIds),
      freeCopies,
      freeCopySeq,
    }, assetById);
    return {
      ...profile,
      updatedAt: savedAt,
      view: sanitizeView(view),
      settings: {
        hideUnpurchased,
        enabledTypes: normalizeEnabledTypes(Array.from(enabledTypes)),
        categoryFilter,
        removePinnedOnDrag,
        showOriginalTitle,
        pinnedFan,
        staticGridBackground,
        theme,
      },
      board: cleanBoard,
    };
  }, [assetById, categoryFilter, enabledTypes, freeCopies, freeCopySeq, hideUnpurchased, pinnedFan, pinnedIds, removePinnedOnDrag, showOriginalTitle, staticGridBackground, theme, view]);

  const mergeCurrentIntoProfiles = useCallback((profileList, savedAt = Date.now()) => {
    if (!activeProfileId) return profileList;
    return profileList.map(profile => (
      profile.id === activeProfileId ? buildCurrentProfile(profile, savedAt) : profile
    ));
  }, [activeProfileId, buildCurrentProfile]);

  useEffect(() => {
    if (!profilesLoaded || !activeProfileId) return undefined;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return undefined;
    }
    const handle = window.setTimeout(() => {
      setProfiles(prev => {
        const next = mergeCurrentIntoProfiles(prev);
        writeProfileStore(next, activeProfileId);
        return next;
      });
    }, 500);
    return () => window.clearTimeout(handle);
  }, [activeProfileId, mergeCurrentIntoProfiles, profilesLoaded]);

  const saveActiveProfile = useCallback((message = "") => {
    if (!profilesLoaded || !activeProfileId) return;
    const next = mergeCurrentIntoProfiles(profiles);
    setProfiles(next);
    writeProfileStore(next, activeProfileId);
    if (message) showToast(message);
  }, [activeProfileId, mergeCurrentIntoProfiles, profiles, profilesLoaded, showToast]);

  const createProfile = useCallback((event) => {
    event.preventDefault();
    const savedProfiles = mergeCurrentIntoProfiles(profiles);
    const usedNames = new Set(savedProfiles.map(profile => profile.name));
    const name = makeUniqueProfileName(profileNameInput || `Профиль ${savedProfiles.length + 1}`, usedNames);
    const profile = createBlankProfile(name);
    const next = [...savedProfiles, profile];
    setProfiles(next);
    setActiveProfileId(profile.id);
    setProfileNameInput("");
    skipNextAutosaveRef.current = true;
    applyProfileToState(profile);
    writeProfileStore(next, profile.id);
    showToast(`Профиль "${profile.name}" создан`);
  }, [applyProfileToState, mergeCurrentIntoProfiles, profileNameInput, profiles, showToast]);

  const loadProfile = useCallback((profileId) => {
    const target = profiles.find(profile => profile.id === profileId);
    if (!target || target.id === activeProfileId) return;
    const next = mergeCurrentIntoProfiles(profiles);
    setProfiles(next);
    setActiveProfileId(target.id);
    skipNextAutosaveRef.current = true;
    applyProfileToState(target);
    writeProfileStore(next, target.id);
    showToast(`Профиль "${target.name}" загружен`);
  }, [activeProfileId, applyProfileToState, mergeCurrentIntoProfiles, profiles, showToast]);

  const deleteProfile = useCallback((profileId) => {
    const target = profiles.find(profile => profile.id === profileId);
    if (!target) return;
    if (!window.confirm(`Удалить профиль "${target.name}"?`)) return;
    const baseProfiles = profileId === activeProfileId ? profiles : mergeCurrentIntoProfiles(profiles);
    let next = baseProfiles.filter(profile => profile.id !== profileId);
    if (!next.length) next = [createBlankProfile(DEFAULT_PROFILE_NAME)];
    const nextActive = profileId === activeProfileId
      ? next[0]
      : next.find(profile => profile.id === activeProfileId) || next[0];
    setProfiles(next);
    setActiveProfileId(nextActive.id);
    skipNextAutosaveRef.current = true;
    applyProfileToState(nextActive);
    writeProfileStore(next, nextActive.id);
    showToast(`Профиль "${target.name}" удален`);
  }, [activeProfileId, applyProfileToState, mergeCurrentIntoProfiles, profiles, showToast]);

  const downloadProfiles = useCallback(() => {
    const next = mergeCurrentIntoProfiles(profiles);
    setProfiles(next);
    writeProfileStore(next, activeProfileId);
    const payload = {
      version: PROFILE_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      activeProfileId,
      profiles: next,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quixel-material-canvas-profiles.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("JSON с профилями скачан");
  }, [activeProfileId, mergeCurrentIntoProfiles, profiles, showToast]);

  const uploadProfiles = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const importedProfiles = readProfilesFromPayload(payload, assetById);
      if (!importedProfiles.length) throw new Error("profiles missing");
      const savedProfiles = mergeCurrentIntoProfiles(profiles);
      const usedNames = new Set(savedProfiles.map(profile => profile.name));
      const importedIdMap = new Map();
      const preparedProfiles = importedProfiles.map(profile => {
        const id = makeProfileId();
        importedIdMap.set(profile.id, id);
        const name = makeUniqueProfileName(profile.name, usedNames);
        usedNames.add(name);
        return { ...profile, id, name };
      });
      const importedActiveId = importedIdMap.get(payload?.activeProfileId) || preparedProfiles[0].id;
      const next = [...savedProfiles, ...preparedProfiles];
      const activeImportedProfile = preparedProfiles.find(profile => profile.id === importedActiveId) || preparedProfiles[0];
      setProfiles(next);
      setActiveProfileId(activeImportedProfile.id);
      skipNextAutosaveRef.current = true;
      applyProfileToState(activeImportedProfile);
      writeProfileStore(next, activeImportedProfile.id);
      showToast(`Загружено профилей: ${preparedProfiles.length}`);
    } catch {
      showToast("Не удалось загрузить JSON профилей");
    }
  }, [applyProfileToState, assetById, mergeCurrentIntoProfiles, profiles, showToast]);

  const resetView = useCallback(() => {
    setView(DEFAULT_VIEW);
  }, []);

  const centerOnCategory = useCallback((direction) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || !layout.notes.length) return;
    const sortedNotes = layout.notes.slice().sort((a, b) => a.y - b.y);
    const centerY = (rect.height / 2 - view.y) / view.scale;
    const target = direction > 0
      ? sortedNotes.find(note => note.y > centerY + 24) || sortedNotes[0]
      : sortedNotes.slice().reverse().find(note => note.y < centerY - 24) || sortedNotes[sortedNotes.length - 1];
    setView(prev => ({
      ...prev,
      x: 32 - target.x * prev.scale,
      y: 28 - target.y * prev.scale,
    }));
  }, [layout.notes, view]);

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
    const normalizedValue = normalizeText(value.trim());
    if (!normalizedValue) {
      setActiveQuery("");
      setCurrentFocusId("");
      setNextMatchIndex(0);
      return;
    }
    if (normalizedValue !== activeQuery) {
      setActiveQuery("");
      setCurrentFocusId("");
      setNextMatchIndex(0);
    }
  }, [activeQuery]);

  const completeSearchSuggestion = useCallback(() => {
    if (!searchSuggestion) return false;
    setQueryInput(prev => prev.replace(/[\p{L}\p{N}]+$/u, searchSuggestion));
    setActiveQuery("");
    setCurrentFocusId("");
    setNextMatchIndex(0);
    return true;
  }, [searchSuggestion]);

  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === "Tab" && searchSuggestion) {
      event.preventDefault();
      completeSearchSuggestion();
    }
  }, [completeSearchSuggestion, searchSuggestion]);

  useEffect(() => {
    function isEditableTarget(target) {
      return target?.closest?.("input, textarea, select, [contenteditable='true']");
    }

    function handleHotkey(event) {
      const key = event.key.toLowerCase();
      if (event.key === "F3" || (event.ctrlKey && (key === "g" || event.code === "KeyG"))) {
        event.preventDefault();
        goToNextMatch();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (key === "f" || event.code === "KeyF") && !isEditableTarget(event.target)) {
        event.preventDefault();
        resetView();
      }
    }

    window.addEventListener("keydown", handleHotkey);
    return () => window.removeEventListener("keydown", handleHotkey);
  }, [goToNextMatch, resetView]);

  const togglePinned = useCallback((assetId) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const createFreeCopy = useCallback((assetId, x, y) => {
    setFreeCopySeq(seq => seq + 1);
    setFreeCopies(prev => {
      const copyId = `copy-${Date.now()}-${freeCopySeq}`;
      return [...prev, { copyId, assetId, x, y }];
    });
  }, [freeCopySeq]);

  const duplicateAsset = useCallback((assetId) => {
    const pos = layout.assetPositions.get(assetId);
    if (!pos) return;
    createFreeCopy(assetId, pos.x + 28, pos.y + 28);
    showToast("Создана свободная копия");
  }, [createFreeCopy, layout.assetPositions, showToast]);

  const deleteFreeCopy = useCallback((copyId) => {
    setFreeCopies(prev => prev.filter(copy => copy.copyId !== copyId));
  }, []);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }, [view]);

  const handleViewportPointerDown = useCallback((event) => {
    if (event.button !== 0 || event.target.closest(".toolbar, .hand, button, a, input, select")) return;
    if (document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']")) {
      document.activeElement.blur();
    }
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
      setFreeCopies(prev => prev.map(copy => copy.copyId === drag.copyId
        ? { ...copy, x: drag.originX + dx, y: drag.originY + dy }
        : copy));
    }
  }, [view.scale]);

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
        setPinnedIds(prev => {
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
  }, [createFreeCopy, removePinnedOnDrag, screenToWorld, showToast]);

  const matchButtonLabel = activeQuery && searchMatches.length
    ? `Далее ${nextMatchIndex + 1}/${searchMatches.length}`
    : "Поиск";

  const activeSummary = `${filteredBaseAssets.length.toLocaleString("ru-RU")} / ${assets.length.toLocaleString("ru-RU")} assets`;
  const visibleAssetCount = visibleAssets.length;
  const activeAssetCount = activeAssets.length;
  const viewportStats = {
    zoom: Math.round(view.scale * 100),
    x: (-view.x / view.scale).toFixed(2),
    y: (-view.y / view.scale).toFixed(2),
  };
  const dynamicGridSize = Math.max(12, 64 * view.scale);
  const viewportGridStyle = staticGridBackground
    ? undefined
    : {
      "--grid-size": `${dynamicGridSize}px`,
      "--grid-x": `${view.x % dynamicGridSize}px`,
      "--grid-y": `${view.y % dynamicGridSize}px`,
    };

  return (
    <div className={`app-shell theme-${theme}`}>
      <Toolbar
        assetSummary={loadError ? "Load failed" : activeSummary}
        queryInput={queryInput}
        setQueryInput={handleQueryInputChange}
        searchSuggestion={searchSuggestion}
        onSearchKeyDown={handleSearchKeyDown}
        onSubmit={handleSearchSubmit}
        matchButtonLabel={matchButtonLabel}
        matchCount={activeQuery ? searchMatches.length : null}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        profilesOpen={profilesOpen}
        setProfilesOpen={setProfilesOpen}
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
        pinnedFan={pinnedFan}
        setPinnedFan={setPinnedFan}
        staticGridBackground={staticGridBackground}
        setStaticGridBackground={setStaticGridBackground}
        theme={theme}
        setTheme={setTheme}
        visibleAssetCount={visibleAssetCount}
        activeAssetCount={activeAssetCount}
        profiles={profiles}
        activeProfile={activeProfile}
        activeProfileId={activeProfileId}
        profileNameInput={profileNameInput}
        setProfileNameInput={setProfileNameInput}
        onCreateProfile={createProfile}
        onSaveProfile={() => saveActiveProfile("Профиль сохранен")}
        onLoadProfile={loadProfile}
        onDeleteProfile={deleteProfile}
        onDownloadProfiles={downloadProfiles}
        onUploadProfiles={uploadProfiles}
        profileFileInputRef={profileFileInputRef}
      />

      <main
        ref={viewportRef}
        className={`viewport ${staticGridBackground ? "grid-static" : "grid-dynamic"} ${panRef.current ? "is-panning" : ""}`}
        style={viewportGridStyle}
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
                  isPinned={pinnedIds.has(asset.id)}
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
                  isPinned={pinnedIds.has(asset.id)}
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
        <div className="viewport-hud viewport-stats" aria-label="Положение канваса">
          <span>Zoom: {viewportStats.zoom}</span>
          <span>X: {viewportStats.x}</span>
          <span>Y: {viewportStats.y}</span>
        </div>
        <div className="viewport-hud viewport-count" aria-label="Количество ассетов">
          Видно: {visibleAssetCount.toLocaleString("ru-RU")} / {activeAssetCount.toLocaleString("ru-RU")}
        </div>
        <div className="viewport-actions" aria-label="Навигация по канвасу">
          <button className="icon-button viewport-reset" type="button" title="Сбросить вид (F)" aria-label="Сбросить вид" onClick={resetView}>
            <ResetIcon />
          </button>
          <div className="category-jump">
            <button className="icon-button" type="button" title="Предыдущая категория" aria-label="Предыдущая категория" onClick={() => centerOnCategory(-1)}>
              <ChevronUpIcon />
            </button>
            <button className="icon-button" type="button" title="Следующая категория" aria-label="Следующая категория" onClick={() => centerOnCategory(1)}>
              <ChevronDownIcon />
            </button>
          </div>
        </div>
      </main>

      <Hand
        pinnedIds={pinnedIds}
        assetById={assetById}
        windowWidth={windowWidth}
        showOriginalTitle={showOriginalTitle}
        pinnedFan={pinnedFan}
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
  searchSuggestion,
  onSearchKeyDown,
  onSubmit,
  matchButtonLabel,
  matchCount,
  settingsOpen,
  setSettingsOpen,
  profilesOpen,
  setProfilesOpen,
  categoryFilter,
  setCategoryFilter,
  categories,
  hideUnpurchased,
  setHideUnpurchased,
  removePinnedOnDrag,
  setRemovePinnedOnDrag,
  showOriginalTitle,
  setShowOriginalTitle,
  pinnedFan,
  setPinnedFan,
  staticGridBackground,
  setStaticGridBackground,
  theme,
  setTheme,
  visibleAssetCount,
  activeAssetCount,
  profiles,
  activeProfile,
  activeProfileId,
  profileNameInput,
  setProfileNameInput,
  onCreateProfile,
  onSaveProfile,
  onLoadProfile,
  onDeleteProfile,
  onDownloadProfiles,
  onUploadProfiles,
  profileFileInputRef,
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
        <div className="search-input-wrap">
          <input
            value={queryInput}
            type="search"
            autoComplete="off"
            placeholder="Асфальт"
            onChange={event => setQueryInput(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          {searchSuggestion && (
            <div className="autocomplete-hint">
              <span>{searchSuggestion}</span>
              <kbd>Tab</kbd>
            </div>
          )}
        </div>
        {queryInput.trim() && <button className="primary-button search-button" type="submit">{matchButtonLabel}</button>}
        <span className="match-count">{matchCount == null ? "" : `${matchCount.toLocaleString("ru-RU")} совпадений`}</span>
      </form>

      <div className="toolbar-controls">
        <button
          className={`icon-button profiles-button ${profilesOpen ? "is-active" : ""}`}
          type="button"
          title="Профили"
          aria-label="Профили"
          onClick={() => {
            setSettingsOpen(false);
            setProfilesOpen(open => !open);
          }}
        >
          <ProfilesIcon />
        </button>
        {profilesOpen && (
          <ProfilesPanel
            profiles={profiles}
            activeProfile={activeProfile}
            activeProfileId={activeProfileId}
            profileNameInput={profileNameInput}
            setProfileNameInput={setProfileNameInput}
            onCreateProfile={onCreateProfile}
            onSaveProfile={onSaveProfile}
            onLoadProfile={onLoadProfile}
            onDeleteProfile={onDeleteProfile}
            onDownloadProfiles={onDownloadProfiles}
            onUploadProfiles={onUploadProfiles}
            profileFileInputRef={profileFileInputRef}
          />
        )}
        <button
          className={`icon-button settings-button ${settingsOpen ? "is-active" : ""}`}
          type="button"
          title="Настройки"
          aria-label="Настройки"
          onClick={() => {
            setProfilesOpen(false);
            setSettingsOpen(open => !open);
          }}
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
            pinnedFan={pinnedFan}
            setPinnedFan={setPinnedFan}
            staticGridBackground={staticGridBackground}
            setStaticGridBackground={setStaticGridBackground}
            theme={theme}
            setTheme={setTheme}
            visibleAssetCount={visibleAssetCount}
            activeAssetCount={activeAssetCount}
          />
        )}
      </div>
    </header>
  );
}

function ProfilesPanel({
  profiles,
  activeProfile,
  activeProfileId,
  profileNameInput,
  setProfileNameInput,
  onCreateProfile,
  onSaveProfile,
  onLoadProfile,
  onDeleteProfile,
  onDownloadProfiles,
  onUploadProfiles,
  profileFileInputRef,
}) {
  const sortedProfiles = profiles.slice().sort((a, b) => {
    if (a.id === activeProfileId) return -1;
    if (b.id === activeProfileId) return 1;
    return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
  });

  return (
    <section className="profiles-popover" aria-label="Профили">
      <div className="profile-current">
        <span>Выбран:</span>
        <strong>{activeProfile?.name || "Нет профиля"}</strong>
        <small>Последнее сохранение: {formatProfileTime(activeProfile?.updatedAt)}</small>
        <button className="panel-button" type="button" onClick={onSaveProfile}>Сохранить</button>
      </div>

      <form className="profile-create" onSubmit={onCreateProfile}>
        <input
          value={profileNameInput}
          type="text"
          autoComplete="off"
          placeholder="Название профиля"
          onChange={event => setProfileNameInput(event.target.value)}
        />
        <button className="panel-button" type="submit">Создать</button>
      </form>

      <div className="profile-list">
        {sortedProfiles.map(profile => {
          const isCurrent = profile.id === activeProfileId;
          return (
            <div className={`profile-row ${isCurrent ? "is-current" : ""}`} key={profile.id}>
              <div>
                <strong>{profile.name}</strong>
                <small>{formatProfileTime(profile.updatedAt)}</small>
              </div>
              <div className="profile-row-actions">
                {isCurrent ? (
                  <span className="profile-current-badge">Текущий</span>
                ) : (
                  <button className="panel-button small" type="button" onClick={() => onLoadProfile(profile.id)}>Загрузить</button>
                )}
                <button className="card-icon delete-button" type="button" title="Удалить профиль" aria-label="Удалить профиль" onClick={() => onDeleteProfile(profile.id)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="profile-file-actions">
        <button className="panel-button" type="button" onClick={() => profileFileInputRef.current?.click()}>Загрузить профили</button>
        <button className="panel-button" type="button" onClick={onDownloadProfiles}>Скачать JSON</button>
        <input
          ref={profileFileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onUploadProfiles}
        />
      </div>
    </section>
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
  pinnedFan,
  setPinnedFan,
  staticGridBackground,
  setStaticGridBackground,
  theme,
  setTheme,
  visibleAssetCount,
  activeAssetCount,
}) {
  return (
    <section className="settings-popover" aria-label="Настройки">
      <div className="settings-canvas-count">
        {visibleAssetCount.toLocaleString("ru-RU")} из {activeAssetCount.toLocaleString("ru-RU")}
      </div>

      <div className="settings-section">
        <strong>Типы ассетов</strong>
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
        <strong>Подкатегория</strong>
        <select
          value={categoryFilter}
          aria-label="Подкатегория"
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
        <label className="settings-check">
          <input
            type="checkbox"
            checked={pinnedFan}
            onChange={event => setPinnedFan(event.target.checked)}
          />
          <span>Закрепленные карточки веером</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={staticGridBackground}
            onChange={event => setStaticGridBackground(event.target.checked)}
          />
          <span>Фон сетки статичный</span>
        </label>
      </div>

      <label className="settings-section">
        <strong>Тема</strong>
        <select
          value={theme}
          aria-label="Тема"
          onChange={event => setTheme(normalizeTheme(event.target.value))}
        >
          {THEME_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
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

function Hand({ pinnedIds, assetById, windowWidth, showOriginalTitle, pinnedFan, onRemove, onDragStart }) {
  const pinnedAssets = Array.from(pinnedIds)
    .map(assetId => assetById.get(assetId))
    .filter(Boolean);
  const availableWidth = Math.max(280, windowWidth - 44);
  const step = pinnedAssets.length > 1
    ? clamp((availableWidth - 116) / (pinnedAssets.length - 1), 8, 104)
    : 0;
  const maxAngle = pinnedFan && pinnedAssets.length > 1 ? clamp(3 + pinnedAssets.length * 0.16, 3, 6.5) : 0;
  const maxLift = pinnedFan && pinnedAssets.length > 1 ? clamp(16 + pinnedAssets.length * 0.75, 18, 34) : 0;

  return (
    <aside className="hand" aria-label="Pinned assets">
      <div className="hand-cards" style={{ "--hand-count": pinnedAssets.length, "--hand-step": `${step}px` }}>
        {pinnedAssets.map((asset, index) => {
          const primaryTitle = showOriginalTitle ? asset.title : (asset.title_ru || asset.title);
          const secondaryTitle = showOriginalTitle ? asset.title_ru : "";
          const progress = pinnedAssets.length > 1 ? index / (pinnedAssets.length - 1) : 0;
          const wavePhase = progress * Math.PI * 2 - Math.PI / 2;
          const wave = Math.sin(wavePhase);
          const slope = Math.cos(wavePhase);
          const spread = pinnedAssets.length > 1 ? (0.5 - progress) * 2 : 0;
          const lift = pinnedFan ? Math.round((1 - Math.abs(spread)) * maxLift + Math.max(0, wave) * maxLift * 0.32) : 0;
          const angle = pinnedFan ? slope * maxAngle * 0.6 + spread * maxAngle * 0.55 : 0;
          return (
            <div
              key={asset.id}
              className="hand-card"
              style={{
                "--hand-index": index,
                "--hand-y": `${-lift}px`,
                "--hand-angle": `${angle.toFixed(2)}deg`,
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

function ProfilesIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a3 3 0 0 1 3-3h5.2a3 3 0 0 1 2.1.86L16.44 5H18a3 3 0 0 1 3 3v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V5h1Zm3-1a1 1 0 0 0-1 1v1h11.27l-2.39-2.39A1 1 0 0 0 14.17 3H7Zm-2 4v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5Zm7 2a2.4 2.4 0 0 1 1.9 3.86A4.2 4.2 0 0 1 16 17h-2a2 2 0 0 0-4 0H8a4.2 4.2 0 0 1 2.1-3.14A2.4 2.4 0 0 1 12 10Zm0 2a.4.4 0 1 0 0 .8.4.4 0 0 0 0-.8Z" /></svg>;
}

function ChevronUpIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.3 4.65 14.65l1.41 1.41L12 10.12l5.94 5.94 1.41-1.41L12 7.3Z" /></svg>;
}

function ChevronDownIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 16.7 7.35-7.35-1.41-1.41L12 13.88 6.06 7.94 4.65 9.35 12 16.7Z" /></svg>;
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
