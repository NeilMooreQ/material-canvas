import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const DATA_URL = `${import.meta.env.BASE_URL}data/assets.json`;
const LEGACY_STORAGE_KEY = "quixel-asset-canvas-react-v2";
const PROFILES_STORAGE_KEY = "quixel-asset-canvas-profiles-v1";
const SEARCH_HISTORY_STORAGE_KEY = "quixel-asset-canvas-search-history-v1";
const PROFILE_EXPORT_VERSION = 1;
const DEFAULT_PROFILE_NAME = "My Profile";
const MAX_SEARCH_HISTORY = 10;
const MAX_UNDO_STEPS = 30;
const GITHUB_REPOSITORY_URL = "https://github.com/NeilMooreQ/material-canvas";
const GITHUB_REPOSITORY_API_URL = "https://api.github.com/repos/NeilMooreQ/material-canvas";

const CARD_W = 180;
const CARD_H = 238;
const CELL_W = 218;
const CELL_H = 278;
const GRID_COLS = 26;
const NOTE_H = 72;
const GROUP_GAP = 104;
const VIEWPORT_OVERSCAN_PX = 520;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4.25;
const COMPACT_CARD_ZOOM = 0.37;
const VISUAL_ZOOM_MIN = -12;
const VISUAL_ZOOM_MAX = 12;
const KEYBOARD_PAN_FACTOR_VALUES = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KEYBOARD_PAN_MIN_SPEED = 240;
const KEYBOARD_PAN_MAX_SPEED = 24000;
const KEYBOARD_PAN_SPEED_OPTIONS = KEYBOARD_PAN_FACTOR_VALUES.map((factor, index) => ({
  factor,
  label: `x${factor}`,
  speed: Math.round((
    KEYBOARD_PAN_MIN_SPEED
    * Math.pow(KEYBOARD_PAN_MAX_SPEED / KEYBOARD_PAN_MIN_SPEED, index / (KEYBOARD_PAN_FACTOR_VALUES.length - 1))
  ) / 10) * 10,
}));
KEYBOARD_PAN_SPEED_OPTIONS[0].speed = KEYBOARD_PAN_MIN_SPEED;
KEYBOARD_PAN_SPEED_OPTIONS[KEYBOARD_PAN_SPEED_OPTIONS.length - 1].speed = KEYBOARD_PAN_MAX_SPEED;
const KEYBOARD_PAN_DEFAULT_FACTOR = 2;
const KEYBOARD_PAN_DEFAULT_SPEED = (
  KEYBOARD_PAN_SPEED_OPTIONS.find(option => option.factor === KEYBOARD_PAN_DEFAULT_FACTOR)
  || KEYBOARD_PAN_SPEED_OPTIONS[0]
).speed;
const KEYBOARD_PAN_ACCELERATION = 12;
const KEYBOARD_PAN_FRICTION = 16;
const KEYBOARD_PAN_STOP_EPSILON = 2;
const KEYBOARD_PAN_ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const KEYBOARD_PAN_WASD = new Map([
  ["KeyA", "ArrowLeft"],
  ["KeyD", "ArrowRight"],
  ["KeyW", "ArrowUp"],
  ["KeyS", "ArrowDown"],
]);
const DEFAULT_VIEW = { x: 32, y: 34, scale: 0.78 };
const DEFAULT_SETTINGS = {
  hideUnpurchased: true,
  enabledTypes: ["material"],
  categoryFilter: "",
  removePinnedOnDrag: true,
  showOriginalTitle: false,
  pinnedFan: false,
  staticGridBackground: true,
  lightweightCards: false,
  keyboardPanSpeed: KEYBOARD_PAN_DEFAULT_SPEED,
  theme: "dark",
  language: "en",
};

const TYPE_LABELS = {
  en: {
    material: "Materials",
    "3d-model": "3D Models",
    decal: "Decals",
    brush: "Brushes",
  },
  ru: {
    material: "Материалы",
    "3d-model": "3D модели",
    decal: "Декали",
    brush: "Кисти",
  },
};

const TYPE_ORDER = ["material", "3d-model", "decal", "brush"];

const CATEGORY_LABELS_RU = {
  "3D": "3D",
  Abandoned: "Заброшенное",
  Animals: "Животные",
  "Armor & Shields": "Броня и щиты",
  "Art & Statues": "Искусство и статуи",
  "Art & Traditional": "Искусство и традиционные",
  Asphalt: "Асфальт",
  Balconies: "Балконы",
  Blood: "Кровь",
  Books: "Книги",
  Brick: "Кирпич",
  Brushes: "Кисти",
  "Building & Human-made": "Здания и рукотворное",
  "Buildings & Architecture": "Здания и архитектура",
  Carpet: "Ковер",
  "Characters & Creatures": "Персонажи и существа",
  Cities: "Города",
  Cliffs: "Скалы",
  Coal: "Уголь",
  Commercial: "Коммерческое",
  Components: "Компоненты",
  Concrete: "Бетон",
  Consumer: "Бытовое",
  "Cooked Food": "Готовая еда",
  Damage: "Повреждения",
  "Damage & Grunge": "Повреждения и грязь",
  Debris: "Обломки",
  Decals: "Декали",
  Decoration: "Декор",
  Dirt: "Грязь",
  Doors: "Двери",
  Dungeon: "Подземелье",
  "Electronics & Technology": "Электроника и технологии",
  Environments: "Окружения",
  "Fabric & Clothing": "Ткани и одежда",
  Farm: "Ферма",
  Fingerprint: "Отпечатки пальцев",
  "Food & Drink": "Еда и напитки",
  Forest: "Лес",
  Frost: "Иней",
  "Fruits & Vegetables": "Фрукты и овощи",
  Fur: "Мех",
  "Furniture & Fixtures": "Мебель и фурнитура",
  Graffiti: "Граффити",
  Grain: "Зерно",
  Gravel: "Гравий",
  Ground: "Грунт",
  Grunge: "Гранж",
  Guns: "Огнестрельное оружие",
  Hardware: "Крепеж и фурнитура",
  Historical: "Историческое",
  "Historical / Points of Interest": "Исторические / достопримечательности",
  Home: "Дом",
  Imprint: "Отпечаток",
  Industrial: "Индустриальное",
  "Industrial Buildings": "Промышленные здания",
  Leakage: "Протечки",
  Leather: "Кожа",
  Ledges: "Уступы",
  "Marble & Granite": "Мрамор и гранит",
  "Material & Textures": "Материалы и текстуры",
  "Meat & Seafood": "Мясо и морепродукты",
  Medieval: "Средневековье",
  Melee: "Ближний бой",
  Metal: "Металл",
  Military: "Военное",
  "Military / Warzone": "Военное / зона боевых действий",
  Mountain: "Горы",
  Mud: "Грязь",
  Mushrooms: "Грибы",
  "Nature & Plants": "Природа и растения",
  "Nature & Terrain": "Природа и ландшафт",
  Organic: "Органика",
  Packs: "Наборы",
  Pattern: "Узор",
  Plain: "Равнина",
  Plants: "Растения",
  Plaster: "Штукатурка",
  Plastic: "Пластик",
  Rock: "Камень",
  "Rocks & Stones": "Камни и скалы",
  Roofing: "Кровля",
  Roofs: "Крыши",
  Rubber: "Резина",
  Sand: "Песок",
  Scatter: "Россыпь",
  "Scorch Mark": "Следы ожогов",
  Seabed: "Морское дно",
  Snow: "Снег",
  Soil: "Почва",
  Spatter: "Брызги",
  Sponge: "Губка",
  Stain: "Пятна",
  Stairs: "Лестницы",
  Stone: "Камень",
  Storage: "Хранение",
  "Streets & Construction": "Улицы и строительство",
  Tarp: "Брезент",
  Temple: "Храм",
  Terrain: "Ландшафт",
  "Throwing weapons": "Метательное оружие",
  Tile: "Плитка",
  "Tombs & Gravestones": "Гробницы и надгробия",
  "Tools, Objects & Decor": "Инструменты, объекты и декор",
  Toys: "Игрушки",
  Trashyard: "Свалка",
  Trees: "Деревья",
  Vegetation: "Растительность",
  Walls: "Стены",
  Water: "Вода",
  "Weapons & Combat": "Оружие и бой",
  Windows: "Окна",
  "Wipe Mark": "Следы протирки",
  Wood: "Дерево",
};

const THEME_OPTIONS = [
  { value: "light", labelKey: "themeLight" },
  { value: "mixed", labelKey: "themeMixed" },
  { value: "dark", labelKey: "themeDark" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
];

const UI_TEXT = {
  en: {
    loadError: "Data load failed",
    searchPlaceholder: "Asphalt",
    search: "Search",
    clearSearch: "Clear search",
    searchHistory: "Recent searches",
    selectedCategory: "Category",
    next: "Next",
    matches: "matches",
    noMatches: "No matches",
    visible: "Visible",
    inCanvas: "On canvas",
    assets: "assets",
    asset: "asset",
    profiles: "Profiles",
    selected: "Selected:",
    noProfile: "No profile",
    lastSaved: "Last saved:",
    save: "Save",
    profileName: "Profile name",
    create: "Create",
    current: "Current",
    load: "Load",
    deleteProfile: "Delete profile",
    uploadProfiles: "Upload profiles",
    downloadJson: "Download JSON",
    deleteConfirm: profileName => `Delete profile "${profileName}"?`,
    profileCreated: profileName => `Profile "${profileName}" created`,
    profileLoaded: profileName => `Profile "${profileName}" loaded`,
    profileDeleted: profileName => `Profile "${profileName}" deleted`,
    profileSaved: "Profile saved",
    profilesDownloaded: "Profiles JSON downloaded",
    profilesUploaded: count => `Profiles loaded: ${count}`,
    profilesUploadFailed: "Failed to load profiles JSON",
    settings: "Settings",
    assetTypes: "Asset types",
    subcategory: "Subcategory",
    allSubcategories: "All subcategories",
    hideUnpurchased: "Hide unpurchased assets",
    removePinnedOnDrag: "Remove from pinned when dragged out",
    showOriginalTitle: "Show original title",
    pinnedFan: "Pinned cards fan",
    staticGridBackground: "Static grid background",
    lightweightCards: "Lightweight cards",
    keyboardPanSpeed: "Canvas movement speed",
    keyboardPanSpeedValue: option => option.label,
    theme: "Theme",
    language: "Language",
    themeLight: "Light",
    themeMixed: "Light with dark canvas",
    themeDark: "Dark",
    resetView: "Reset view",
    focusModeHint: "Focus mode is on. Press F to exit.",
    prevCategory: "Previous category",
    nextCategory: "Next category",
    shortcuts: "Shortcuts",
    shortcutsTitle: "Hotkeys",
    githubRepository: "Open GitHub repository",
    githubStars: "Project stars",
    shortcutItems: [
      { keys: "Tab", label: "Accept autocomplete" },
      { keys: "F3 / Ctrl+G", label: "Jump to the next search match" },
      { keys: "R", label: "Reset view" },
      { keys: "F", label: "Toggle focus mode" },
      { keys: "/", label: "Show or hide shortcuts" },
      { keys: "E", label: "Toggle lightweight cards" },
      { keys: "Arrow keys / WASD", label: "Move around the canvas" },
      { keys: "Ctrl+Z", label: "Undo last canvas action" },
      { keys: "1-9", label: "Load profile by list order" },
    ],
    openFab: "Open Fab listing",
    pin: "Pin asset",
    unpin: "Unpin asset",
    duplicate: "Create movable copy",
    deleteDuplicate: "Delete duplicate",
    freeCopyCreated: "Movable copy created",
    copyAdded: "Copy added to canvas",
    copyReturnedToPinned: "Copy returned to pinned",
    undoApplied: "Last action undone",
    nothingToUndo: "Nothing to undo",
  },
  ru: {
    loadError: "Ошибка загрузки данных",
    searchPlaceholder: "Асфальт",
    search: "Поиск",
    clearSearch: "Очистить поиск",
    searchHistory: "Недавние поиски",
    selectedCategory: "Категория",
    next: "Далее",
    matches: "совпадений",
    noMatches: "Совпадений нет",
    visible: "Видно",
    inCanvas: "В канвасе",
    assets: "assets",
    asset: "asset",
    profiles: "Профили",
    selected: "Выбран:",
    noProfile: "Нет профиля",
    lastSaved: "Последнее сохранение:",
    save: "Сохранить",
    profileName: "Название профиля",
    create: "Создать",
    current: "Текущий",
    load: "Загрузить",
    deleteProfile: "Удалить профиль",
    uploadProfiles: "Загрузить профили",
    downloadJson: "Скачать JSON",
    deleteConfirm: profileName => `Удалить профиль "${profileName}"?`,
    profileCreated: profileName => `Профиль "${profileName}" создан`,
    profileLoaded: profileName => `Профиль "${profileName}" загружен`,
    profileDeleted: profileName => `Профиль "${profileName}" удален`,
    profileSaved: "Профиль сохранен",
    profilesDownloaded: "JSON с профилями скачан",
    profilesUploaded: count => `Загружено профилей: ${count}`,
    profilesUploadFailed: "Не удалось загрузить JSON профилей",
    settings: "Настройки",
    assetTypes: "Типы ассетов",
    subcategory: "Подкатегория",
    allSubcategories: "Все подкатегории",
    hideUnpurchased: "Скрыть не купленные",
    removePinnedOnDrag: "Убирать из Pinned при вытаскивании",
    showOriginalTitle: "Показывать оригинальный title",
    pinnedFan: "Закрепленные карточки веером",
    staticGridBackground: "Фон сетки статичный",
    lightweightCards: "Легкий режим карточек",
    keyboardPanSpeed: "Скорость передвижения",
    keyboardPanSpeedValue: option => option.label,
    theme: "Тема",
    language: "Язык",
    themeLight: "Светлая",
    themeMixed: "Светлая с темным",
    themeDark: "Темная",
    resetView: "Сбросить вид",
    focusModeHint: "Включен режим фокуса. Нажмите F, чтобы выйти.",
    prevCategory: "Предыдущая категория",
    nextCategory: "Следующая категория",
    shortcuts: "Подсказки",
    shortcutsTitle: "Горячие клавиши",
    githubRepository: "Открыть репозиторий GitHub",
    githubStars: "Звезды проекта",
    shortcutItems: [
      { keys: "Tab", label: "Принять автодополнение" },
      { keys: "F3 / Ctrl+G", label: "Перейти к следующему результату поиска" },
      { keys: "R", label: "Сбросить вид" },
      { keys: "F", label: "Включить или выключить режим фокуса" },
      { keys: "/", label: "Показать или скрыть горячие клавиши" },
      { keys: "E", label: "Включить или выключить легкие карточки" },
      { keys: "Стрелки / WASD", label: "Передвигаться по canvas" },
      { keys: "Ctrl+Z", label: "Отменить последнее действие на канвасе" },
      { keys: "1-9", label: "Загрузить профиль по порядку в списке" },
    ],
    openFab: "Open Fab listing",
    pin: "Pin asset",
    unpin: "Unpin asset",
    duplicate: "Create movable copy",
    deleteDuplicate: "Delete duplicate",
    freeCopyCreated: "Создана свободная копия",
    copyAdded: "Копия добавлена на доску",
    copyReturnedToPinned: "Копия возвращена в pinned",
    undoApplied: "Последнее действие отменено",
    nothingToUndo: "Нечего отменять",
  },
};

let lastOpenedListingUrl = "";
let lastOpenedListingAt = 0;

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

function openListingUrl(url) {
  if (!url) return;
  const now = Date.now();
  if (lastOpenedListingUrl === url && now - lastOpenedListingAt < 800) return;
  lastOpenedListingUrl = url;
  lastOpenedListingAt = now;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

function getAssetCardUrlFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) return "";
  if (target.closest("button, a, input, select, textarea")) return "";
  const pointHit = document.elementFromPoint(event.clientX, event.clientY);
  const card = target.closest(".asset-card")
    || (pointHit instanceof Element ? pointHit.closest(".asset-card") : null);
  return card?.dataset.assetUrl || "";
}

function russianPlural(count, forms) {
  const value = Math.abs(count) % 100;
  const single = value % 10;
  if (value > 10 && value < 20) return forms[2];
  if (single > 1 && single < 5) return forms[1];
  if (single === 1) return forms[0];
  return forms[2];
}

function formatProfileTime(timestamp, language = DEFAULT_SETTINGS.language) {
  const value = Number(timestamp);
  if (!value) return language === "ru" ? "еще не сохранялся" : "never";
  const deltaMs = Math.max(0, Date.now() - value);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (language !== "ru") {
    if (deltaMs < minute) return "just now";
    if (deltaMs < hour) {
      const count = Math.floor(deltaMs / minute);
      return `${count} minute${count === 1 ? "" : "s"} ago`;
    }
    if (deltaMs < day) {
      const count = Math.floor(deltaMs / hour);
      return `${count} hour${count === 1 ? "" : "s"} ago`;
    }
    if (deltaMs < 7 * day) {
      const count = Math.floor(deltaMs / day);
      return `${count} day${count === 1 ? "" : "s"} ago`;
    }
    if (deltaMs < 14 * day) return "a week ago";
    return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  }
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

function normalizeLanguage(language) {
  return LANGUAGE_OPTIONS.some(option => option.value === language) ? language : DEFAULT_SETTINGS.language;
}

function normalizeKeyboardPanSpeed(speed) {
  const numericSpeed = Number(speed);
  if (!Number.isFinite(numericSpeed)) return DEFAULT_SETTINGS.keyboardPanSpeed;
  return KEYBOARD_PAN_SPEED_OPTIONS.reduce((closest, option) => (
    Math.abs(option.speed - numericSpeed) < Math.abs(closest.speed - numericSpeed) ? option : closest
  ), KEYBOARD_PAN_SPEED_OPTIONS[0]).speed;
}

function getKeyboardPanSpeedIndex(speed) {
  const normalizedSpeed = normalizeKeyboardPanSpeed(speed);
  const index = KEYBOARD_PAN_SPEED_OPTIONS.findIndex(option => option.speed === normalizedSpeed);
  return index >= 0 ? index : 0;
}

function getKeyboardPanSpeedOption(speed) {
  return KEYBOARD_PAN_SPEED_OPTIONS[getKeyboardPanSpeedIndex(speed)];
}

function formatVisualZoom(zoom) {
  if (zoom > 0) return `+${zoom}`;
  return String(zoom);
}

function scaleToVisualZoom(scale) {
  const clampedScale = clamp(Number(scale) || DEFAULT_VIEW.scale, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(clampedScale - DEFAULT_VIEW.scale) < 0.0001) return 0;
  if (clampedScale > DEFAULT_VIEW.scale) {
    const positiveZoom = Math.log(clampedScale / DEFAULT_VIEW.scale) / Math.log(MAX_ZOOM / DEFAULT_VIEW.scale);
    return clamp(Math.round(positiveZoom * VISUAL_ZOOM_MAX), 0, VISUAL_ZOOM_MAX);
  }
  const negativeZoom = Math.log(DEFAULT_VIEW.scale / clampedScale) / Math.log(DEFAULT_VIEW.scale / MIN_ZOOM);
  return clamp(Math.round(negativeZoom * VISUAL_ZOOM_MIN), VISUAL_ZOOM_MIN, 0);
}

function getKeyboardPanKey(event) {
  if (KEYBOARD_PAN_ARROW_KEYS.has(event.key)) return event.key;
  return KEYBOARD_PAN_WASD.get(event.code) || "";
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

function sanitizeSearch(search, assetById) {
  const queryInput = String(search?.queryInput || "");
  const activeQuery = normalizeText(search?.activeQuery || "");
  const nextMatchIndex = Math.max(0, Math.floor(Number(search?.nextMatchIndex) || 0));
  const currentFocusId = assetById.has(search?.currentFocusId) ? String(search.currentFocusId) : "";
  return {
    queryInput,
    activeQuery,
    nextMatchIndex,
    currentFocusId,
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
    search: sanitizeSearch(null, new Map()),
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
      lightweightCards: settings.lightweightCards ?? DEFAULT_SETTINGS.lightweightCards,
      keyboardPanSpeed: normalizeKeyboardPanSpeed(settings.keyboardPanSpeed),
      theme: normalizeTheme(settings.theme),
      language: normalizeLanguage(settings.language),
    },
    board: sanitizeBoard(profile?.board, assetById),
    search: sanitizeSearch(profile?.search, assetById),
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
        .map((profile, index) => sanitizeProfile(profile, assetById, `Profile ${index + 1}`));
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

function getTypeLabel(type, language = DEFAULT_SETTINGS.language) {
  return TYPE_LABELS[language]?.[type] || TYPE_LABELS.en[type] || type;
}

function splitCategoryPath(category) {
  return String(category || "")
    .split(">")
    .map(part => part.trim())
    .filter(Boolean);
}

function getCategoryLocale(language) {
  return language === "ru" ? "ru-RU" : "en-US";
}

function localizeCategoryPart(part, language = DEFAULT_SETTINGS.language) {
  if (language !== "ru") return part;
  return CATEGORY_LABELS_RU[part] || part;
}

function formatCategoryPath(category, language = DEFAULT_SETTINGS.language) {
  return splitCategoryPath(category)
    .map(part => localizeCategoryPart(part, language))
    .join(" > ");
}

function getAssetDisplayTitles(asset, language = DEFAULT_SETTINGS.language, showOriginalTitle = false) {
  const originalTitle = asset.title || asset.title_ru || "";
  const translatedTitle = asset.title_ru || asset.title || "";
  if (showOriginalTitle) {
    return {
      primaryTitle: originalTitle,
      secondaryTitle: translatedTitle && translatedTitle !== originalTitle ? translatedTitle : "",
    };
  }
  return {
    primaryTitle: language === "ru" ? translatedTitle : originalTitle,
    secondaryTitle: "",
  };
}

function getCategoryLeafLabel(category, language = DEFAULT_SETTINGS.language) {
  const parts = splitCategoryPath(category);
  const leaf = parts.at(-1);
  return leaf ? localizeCategoryPart(leaf, language) : category;
}

function getCategoryGroupLabel(category, language = DEFAULT_SETTINGS.language) {
  const parts = splitCategoryPath(category);
  return parts.length > 1
    ? parts.slice(0, -1).map(part => localizeCategoryPart(part, language)).join(" > ")
    : "";
}

function groupCategoryOptions(categories, language = DEFAULT_SETTINGS.language) {
  const groups = new Map();
  const standalone = [];
  const locale = getCategoryLocale(language);
  for (const category of categories) {
    const groupLabel = getCategoryGroupLabel(category, language);
    const option = {
      value: category,
      label: getCategoryLeafLabel(category, language),
    };
    if (!groupLabel) {
      standalone.push(option);
      continue;
    }
    if (!groups.has(groupLabel)) groups.set(groupLabel, []);
    groups.get(groupLabel).push(option);
  }

  return {
    standalone: standalone.sort((a, b) => a.label.localeCompare(b.label, locale) || a.value.localeCompare(b.value)),
    groups: Array.from(groups, ([label, options]) => ({
      label,
      options: options.sort((a, b) => a.label.localeCompare(b.label, locale) || a.value.localeCompare(b.value)),
    })).sort((a, b) => a.label.localeCompare(b.label, locale)),
  };
}

function readSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    const entries = JSON.parse(raw || "[]");
    return Array.isArray(entries)
      ? entries.map(entry => String(entry || "").trim()).filter(Boolean).slice(0, MAX_SEARCH_HISTORY)
      : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(entries) {
  localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_SEARCH_HISTORY)));
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
    const noteY = y;
    notes.push({
      id: `note-${group.id}`,
      groupId: group.id,
      title: group.title,
      assetType: group.assetType,
      listingType: group.listingType,
      count: group.assets.length,
      x: 0,
      y: noteY,
      width: GRID_COLS * CELL_W - (CELL_W - CARD_W),
      height: NOTE_H,
    });

    const startY = noteY + NOTE_H + 18;
    const rows = Math.ceil(group.assets.length / GRID_COLS);
    group.noteY = noteY;
    group.startY = startY;
    group.rows = rows;
    group.assets.forEach((asset, index) => {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      assetPositions.set(asset.id, {
        x: col * CELL_W,
        y: startY + row * CELL_H,
        groupId: group.id,
      });
    });

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

function compareAssetCanvasOrder(a, b, assetPositions) {
  const posA = assetPositions.get(a.id);
  const posB = assetPositions.get(b.id);
  if (!posA || !posB) return a.id.localeCompare(b.id);
  const yDelta = posA.y - posB.y;
  if (Math.abs(yDelta) > 1) return yDelta;
  return posA.x - posB.x || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

function intersectsRect(x, y, width, height, bounds) {
  return x + width >= bounds.left
    && x <= bounds.right
    && y + height >= bounds.top
    && y <= bounds.bottom;
}

function getVisibleLayoutAssetEntries(layout, bounds) {
  const entries = [];
  const minCol = clamp(Math.floor((bounds.left - CARD_W) / CELL_W), 0, GRID_COLS - 1);
  const maxCol = clamp(Math.floor(bounds.right / CELL_W), 0, GRID_COLS - 1);

  for (const group of layout.groups) {
    if (!group.rows || group.startY + group.rows * CELL_H < bounds.top || group.startY > bounds.bottom) continue;
    const minRow = clamp(Math.floor((bounds.top - CARD_H - group.startY) / CELL_H), 0, group.rows - 1);
    const maxRow = clamp(Math.floor((bounds.bottom - group.startY) / CELL_H), 0, group.rows - 1);

    for (let row = minRow; row <= maxRow; row += 1) {
      const rowOffset = row * GRID_COLS;
      const y = group.startY + row * CELL_H;
      for (let col = minCol; col <= maxCol; col += 1) {
        const asset = group.assets[rowOffset + col];
        if (!asset) continue;
        const x = col * CELL_W;
        if (!intersectsRect(x, y, CARD_W, CARD_H, bounds)) continue;
        entries.push({ asset, x, y, groupId: group.id });
      }
    }
  }

  return entries;
}

export default function App() {
  const viewportRef = useRef(null);
  const panRef = useRef(null);
  const keyboardPanKeysRef = useRef(new Set());
  const keyboardPanFrameRef = useRef(0);
  const keyboardPanLastAtRef = useRef(0);
  const keyboardPanVelocityRef = useRef({ x: 0, y: 0 });
  const keyboardPanSpeedRef = useRef(DEFAULT_SETTINGS.keyboardPanSpeed);
  const freeDragRef = useRef(null);
  const handDragRef = useRef(null);
  const handRef = useRef(null);
  const undoStackRef = useRef([]);
  const profileFileInputRef = useRef(null);
  const skipNextAutosaveRef = useRef(false);
  const skipNextSearchResetRef = useRef(false);

  const [assets, setAssets] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [hideUnpurchased, setHideUnpurchased] = useState(DEFAULT_SETTINGS.hideUnpurchased);
  const [enabledTypes, setEnabledTypes] = useState(() => new Set(DEFAULT_SETTINGS.enabledTypes));
  const [categoryFilter, setCategoryFilter] = useState(DEFAULT_SETTINGS.categoryFilter);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [removePinnedOnDrag, setRemovePinnedOnDrag] = useState(DEFAULT_SETTINGS.removePinnedOnDrag);
  const [showOriginalTitle, setShowOriginalTitle] = useState(DEFAULT_SETTINGS.showOriginalTitle);
  const [pinnedFan, setPinnedFan] = useState(DEFAULT_SETTINGS.pinnedFan);
  const [staticGridBackground, setStaticGridBackground] = useState(DEFAULT_SETTINGS.staticGridBackground);
  const [lightweightCards, setLightweightCards] = useState(DEFAULT_SETTINGS.lightweightCards);
  const [keyboardPanSpeed, setKeyboardPanSpeed] = useState(DEFAULT_SETTINGS.keyboardPanSpeed);
  const [theme, setTheme] = useState(DEFAULT_SETTINGS.theme);
  const [language, setLanguage] = useState(DEFAULT_SETTINGS.language);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState(() => readSearchHistory());
  const [nextMatchIndex, setNextMatchIndex] = useState(0);
  const [currentFocusId, setCurrentFocusId] = useState("");
  const [view, setView] = useState(DEFAULT_VIEW);
  const [toast, setToast] = useState("");
  const [handGhost, setHandGhost] = useState(null);
  const [windowWidth, setWindowWidth] = useState(() => typeof window === "undefined" ? 1280 : window.innerWidth);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 720 });
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [freeCopies, setFreeCopies] = useState([]);
  const [freeCopySeq, setFreeCopySeq] = useState(1);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");

  const assetById = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets]);
  const t = UI_TEXT[language] || UI_TEXT.en;
  keyboardPanSpeedRef.current = keyboardPanSpeed;

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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const updateViewportSize = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize(prev => (
        Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
          ? prev
          : { width: rect.width, height: rect.height }
      ));
    };

    updateViewportSize();
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);
    window.addEventListener("resize", updateViewportSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewportSize);
    };
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
    return activeAssets
      .filter(asset => asset.isSearchMatch)
      .sort((a, b) => compareAssetCanvasOrder(a, b, layout.assetPositions));
  }, [activeAssets, activeQuery, layout.assetPositions]);
  const searchMatchSet = useMemo(() => new Set(searchMatches.map(asset => asset.id)), [searchMatches]);
  const searchGroupMatchCounts = useMemo(() => {
    if (!activeQuery) return new Map();
    const counts = new Map();
    for (const asset of activeAssets) {
      if (!asset.isSearchMatch) continue;
      const key = asset.categoryPath || asset.categoryShort || asset.listingType;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [activeAssets, activeQuery]);
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
  const searchHistoryMatches = useMemo(() => {
    const normalizedInput = normalizeText(queryInput.trim());
    return searchHistory
      .filter(query => !normalizedInput || normalizeText(query).includes(normalizedInput))
      .slice(0, MAX_SEARCH_HISTORY);
  }, [queryInput, searchHistory]);

  useEffect(() => {
    if (skipNextSearchResetRef.current) {
      skipNextSearchResetRef.current = false;
      return;
    }
    setNextMatchIndex(0);
    setCurrentFocusId("");
  }, [activeQuery, categoryFilter, enabledTypes, hideUnpurchased]);

  const viewportBounds = useMemo(() => {
    const pad = VIEWPORT_OVERSCAN_PX / view.scale;
    return {
      left: -view.x / view.scale - pad,
      top: -view.y / view.scale - pad,
      right: (viewportSize.width - view.x) / view.scale + pad,
      bottom: (viewportSize.height - view.y) / view.scale + pad,
    };
  }, [view, viewportSize]);

  const visibleAssetEntries = useMemo(() => (
    getVisibleLayoutAssetEntries(layout, viewportBounds)
  ), [layout, viewportBounds]);

  const visibleNotes = useMemo(() => {
    return layout.notes.filter(note => intersectsRect(note.x, note.y, note.width, note.height, viewportBounds));
  }, [layout.notes, viewportBounds]);

  const visibleFreeCopies = useMemo(() => {
    return freeCopies.filter(copy => intersectsRect(copy.x, copy.y, CARD_W, CARD_H, viewportBounds));
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
    undoStackRef.current = [];
    skipNextSearchResetRef.current = true;
    setView(profile.view);
    setHideUnpurchased(profile.settings.hideUnpurchased);
    setEnabledTypes(new Set(profile.settings.enabledTypes));
    setCategoryFilter(profile.settings.categoryFilter);
    setRemovePinnedOnDrag(profile.settings.removePinnedOnDrag);
    setShowOriginalTitle(profile.settings.showOriginalTitle);
    setPinnedFan(profile.settings.pinnedFan);
    setStaticGridBackground(profile.settings.staticGridBackground);
    setLightweightCards(profile.settings.lightweightCards);
    setKeyboardPanSpeed(normalizeKeyboardPanSpeed(profile.settings.keyboardPanSpeed));
    setTheme(normalizeTheme(profile.settings.theme));
    setLanguage(normalizeLanguage(profile.settings.language));
    setPinnedIds(new Set(profile.board.pinnedIds));
    setFreeCopies(profile.board.freeCopies);
    setFreeCopySeq(profile.board.freeCopySeq);
    setQueryInput(profile.search.queryInput);
    setActiveQuery(profile.search.activeQuery);
    setNextMatchIndex(profile.search.nextMatchIndex);
    setCurrentFocusId(profile.search.currentFocusId);
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
        lightweightCards,
        keyboardPanSpeed: normalizeKeyboardPanSpeed(keyboardPanSpeed),
        theme,
        language,
      },
      board: cleanBoard,
      search: sanitizeSearch({
        queryInput,
        activeQuery,
        nextMatchIndex,
        currentFocusId,
      }, assetById),
    };
  }, [activeQuery, assetById, categoryFilter, currentFocusId, enabledTypes, freeCopies, freeCopySeq, hideUnpurchased, keyboardPanSpeed, language, lightweightCards, nextMatchIndex, pinnedFan, pinnedIds, queryInput, removePinnedOnDrag, showOriginalTitle, staticGridBackground, theme, view]);

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
    const defaultProfileBase = language === "ru" ? "Профиль" : "Profile";
    const name = makeUniqueProfileName(profileNameInput || `${defaultProfileBase} ${savedProfiles.length + 1}`, usedNames);
    const profile = {
      ...createBlankProfile(name),
      view: sanitizeView(view),
      settings: {
        hideUnpurchased,
        enabledTypes: normalizeEnabledTypes(Array.from(enabledTypes)),
        categoryFilter,
        removePinnedOnDrag,
        showOriginalTitle,
        pinnedFan,
        staticGridBackground,
        lightweightCards,
        keyboardPanSpeed: normalizeKeyboardPanSpeed(keyboardPanSpeed),
        theme,
        language,
      },
    };
    const next = [...savedProfiles, profile];
    setProfiles(next);
    setActiveProfileId(profile.id);
    setProfileNameInput("");
    skipNextAutosaveRef.current = true;
    applyProfileToState(profile);
    writeProfileStore(next, profile.id);
    showToast(t.profileCreated(profile.name));
  }, [applyProfileToState, categoryFilter, enabledTypes, hideUnpurchased, keyboardPanSpeed, language, lightweightCards, mergeCurrentIntoProfiles, pinnedFan, profileNameInput, profiles, removePinnedOnDrag, showOriginalTitle, showToast, staticGridBackground, t, theme, view]);

  const loadProfile = useCallback((profileId) => {
    const target = profiles.find(profile => profile.id === profileId);
    if (!target || target.id === activeProfileId) return;
    const next = mergeCurrentIntoProfiles(profiles);
    setProfiles(next);
    setActiveProfileId(target.id);
    skipNextAutosaveRef.current = true;
    applyProfileToState(target);
    writeProfileStore(next, target.id);
    showToast(t.profileLoaded(target.name));
  }, [activeProfileId, applyProfileToState, mergeCurrentIntoProfiles, profiles, showToast, t]);

  const deleteProfile = useCallback((profileId) => {
    const target = profiles.find(profile => profile.id === profileId);
    if (!target) return;
    if (!window.confirm(t.deleteConfirm(target.name))) return;
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
    showToast(t.profileDeleted(target.name));
  }, [activeProfileId, applyProfileToState, mergeCurrentIntoProfiles, profiles, showToast, t]);

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
    showToast(t.profilesDownloaded);
  }, [activeProfileId, mergeCurrentIntoProfiles, profiles, showToast, t]);

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
      showToast(t.profilesUploaded(preparedProfiles.length));
    } catch {
      showToast(t.profilesUploadFailed);
    }
  }, [applyProfileToState, assetById, mergeCurrentIntoProfiles, profiles, showToast, t]);

  const resetView = useCallback(() => {
    setView(DEFAULT_VIEW);
  }, []);

  const centerOnCategory = useCallback((direction) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || !layout.notes.length) return;
    const sortedNotes = layout.notes.slice().sort((a, b) => a.y - b.y);
    const topY = -view.y / view.scale;
    const threshold = Math.max(8, 56 / view.scale);
    const target = direction > 0
      ? sortedNotes.find(note => note.y > topY + threshold) || sortedNotes[0]
      : sortedNotes.slice().reverse().find(note => note.y < topY - threshold) || sortedNotes[sortedNotes.length - 1];
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

  const addSearchHistory = useCallback((rawQuery) => {
    const cleanQuery = String(rawQuery || "").trim();
    if (!cleanQuery) return;
    const normalizedQuery = normalizeText(cleanQuery);
    setSearchHistory(prev => {
      const next = [
        cleanQuery,
        ...prev.filter(query => normalizeText(query) !== normalizedQuery),
      ].slice(0, MAX_SEARCH_HISTORY);
      writeSearchHistory(next);
      return next;
    });
  }, []);

  const runSearchWithValue = useCallback((rawQuery, remember = true) => {
    const cleanQuery = String(rawQuery || "").trim();
    const query = normalizeText(cleanQuery);
    setActiveQuery(query);
    setCurrentFocusId("");
    setNextMatchIndex(0);
    if (!query) return;
    if (remember) addSearchHistory(cleanQuery);
    const matches = filteredBaseAssets.filter(asset => query.split(/\s+/).filter(Boolean).every(part => asset.searchText.includes(part)));
    if (!matches.length) showToast(t.noMatches);
  }, [addSearchHistory, filteredBaseAssets, showToast, t]);

  const runSearch = useCallback(() => {
    runSearchWithValue(queryInput);
  }, [queryInput, runSearchWithValue]);

  const useSearchHistoryQuery = useCallback((query) => {
    setQueryInput(query);
    runSearchWithValue(query);
  }, [runSearchWithValue]);

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

  const makeBoardSnapshot = useCallback(() => ({
    pinnedIds: Array.from(pinnedIds),
    freeCopies: freeCopies.map(copy => ({ ...copy })),
    freeCopySeq,
  }), [freeCopies, freeCopySeq, pinnedIds]);

  const pushUndoSnapshot = useCallback((snapshot = makeBoardSnapshot()) => {
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-MAX_UNDO_STEPS);
  }, [makeBoardSnapshot]);

  const restoreBoardSnapshot = useCallback((snapshot) => {
    setPinnedIds(new Set(snapshot.pinnedIds));
    setFreeCopies(snapshot.freeCopies.map(copy => ({ ...copy })));
    setFreeCopySeq(Math.max(Number(snapshot.freeCopySeq) || 1, snapshot.freeCopies.length + 1, 1));
  }, []);

  const undoLastAction = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) {
      showToast(t.nothingToUndo);
      return;
    }
    restoreBoardSnapshot(snapshot);
    showToast(t.undoApplied);
  }, [restoreBoardSnapshot, showToast, t]);

  const stopKeyboardPan = useCallback(() => {
    keyboardPanKeysRef.current.clear();
    keyboardPanVelocityRef.current = { x: 0, y: 0 };
    keyboardPanLastAtRef.current = 0;
    if (keyboardPanFrameRef.current) {
      window.cancelAnimationFrame(keyboardPanFrameRef.current);
      keyboardPanFrameRef.current = 0;
    }
  }, []);

  const stepKeyboardPan = useCallback((timestamp) => {
    const keys = keyboardPanKeysRef.current;
    const lastTimestamp = keyboardPanLastAtRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
    keyboardPanLastAtRef.current = timestamp;

    let xDirection = 0;
    let yDirection = 0;
    if (keys.has("ArrowLeft")) xDirection += 1;
    if (keys.has("ArrowRight")) xDirection -= 1;
    if (keys.has("ArrowUp")) yDirection += 1;
    if (keys.has("ArrowDown")) yDirection -= 1;

    const length = Math.hypot(xDirection, yDirection);
    const targetSpeed = keyboardPanSpeedRef.current;
    const targetVelocity = length > 0
      ? {
        x: (xDirection / length) * targetSpeed,
        y: (yDirection / length) * targetSpeed,
      }
      : { x: 0, y: 0 };
    const velocity = keyboardPanVelocityRef.current;
    const blend = 1 - Math.exp(-(length > 0 ? KEYBOARD_PAN_ACCELERATION : KEYBOARD_PAN_FRICTION) * deltaSeconds);
    const nextVelocity = {
      x: velocity.x + (targetVelocity.x - velocity.x) * blend,
      y: velocity.y + (targetVelocity.y - velocity.y) * blend,
    };
    keyboardPanVelocityRef.current = nextVelocity;

    const velocityLength = Math.hypot(nextVelocity.x, nextVelocity.y);
    if (deltaSeconds > 0 && velocityLength > KEYBOARD_PAN_STOP_EPSILON) {
      setView(prev => ({
        ...prev,
        x: prev.x + nextVelocity.x * deltaSeconds,
        y: prev.y + nextVelocity.y * deltaSeconds,
      }));
    }

    if (keys.size || velocityLength > KEYBOARD_PAN_STOP_EPSILON) {
      keyboardPanFrameRef.current = window.requestAnimationFrame(stepKeyboardPan);
    } else {
      keyboardPanVelocityRef.current = { x: 0, y: 0 };
      keyboardPanLastAtRef.current = 0;
      keyboardPanFrameRef.current = 0;
    }
  }, []);

  const startKeyboardPan = useCallback(() => {
    if (!keyboardPanFrameRef.current) {
      keyboardPanFrameRef.current = window.requestAnimationFrame(stepKeyboardPan);
    }
  }, [stepKeyboardPan]);

  useEffect(() => {
    function isEditableTarget(target) {
      return target?.closest?.("input, textarea, select, [contenteditable='true']");
    }

    function handleHotkey(event) {
      const key = event.key.toLowerCase();
      const keyboardPanKey = getKeyboardPanKey(event);
      if (!event.ctrlKey && !event.metaKey && !event.altKey && keyboardPanKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        keyboardPanKeysRef.current.add(keyboardPanKey);
        startKeyboardPan();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (key === "z" || event.code === "KeyZ") && !isEditableTarget(event.target)) {
        event.preventDefault();
        undoLastAction();
        return;
      }
      if (event.key === "F3" || (event.ctrlKey && (key === "g" || event.code === "KeyG"))) {
        event.preventDefault();
        goToNextMatch();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (key === "r" || event.code === "KeyR") && !isEditableTarget(event.target)) {
        event.preventDefault();
        resetView();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (key === "f" || event.code === "KeyF") && !isEditableTarget(event.target)) {
        event.preventDefault();
        setShortcutsOpen(false);
        setFocusMode(prev => {
          const next = !prev;
          if (next) {
            setSettingsOpen(false);
            setProfilesOpen(false);
          }
          return next;
        });
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (key === "e" || event.code === "KeyE") && !isEditableTarget(event.target)) {
        event.preventDefault();
        setLightweightCards(prev => !prev);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "/" || event.code === "Slash") && !isEditableTarget(event.target)) {
        event.preventDefault();
        setSettingsOpen(false);
        setProfilesOpen(false);
        setShortcutsOpen(prev => !prev);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && /^Digit[1-9]$/.test(event.code) && !isEditableTarget(event.target)) {
        const profileIndex = Number(event.code.slice(5)) - 1;
        const profile = profiles[profileIndex];
        if (profile) {
          event.preventDefault();
          loadProfile(profile.id);
        }
      }
    }

    function handleKeyUp(event) {
      const keyboardPanKey = getKeyboardPanKey(event);
      if (!keyboardPanKey) return;
      keyboardPanKeysRef.current.delete(keyboardPanKey);
      startKeyboardPan();
    }

    window.addEventListener("keydown", handleHotkey);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", stopKeyboardPan);
    return () => {
      window.removeEventListener("keydown", handleHotkey);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", stopKeyboardPan);
      stopKeyboardPan();
    };
  }, [goToNextMatch, loadProfile, profiles, resetView, startKeyboardPan, stopKeyboardPan, undoLastAction]);

  const togglePinned = useCallback((assetId) => {
    pushUndoSnapshot();
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, [pushUndoSnapshot]);

  const createFreeCopy = useCallback((assetId, x, y, recordUndo = true) => {
    if (recordUndo) pushUndoSnapshot();
    setFreeCopySeq(seq => seq + 1);
    setFreeCopies(prev => {
      const copyId = `copy-${Date.now()}-${freeCopySeq}`;
      return [...prev, { copyId, assetId, x, y }];
    });
  }, [freeCopySeq, pushUndoSnapshot]);

  const duplicateAsset = useCallback((assetId) => {
    const pos = layout.assetPositions.get(assetId);
    if (!pos) return;
    createFreeCopy(assetId, pos.x + 28, pos.y + 28);
    showToast(t.freeCopyCreated);
  }, [createFreeCopy, layout.assetPositions, showToast, t]);

  const deleteFreeCopy = useCallback((copyId) => {
    pushUndoSnapshot();
    setFreeCopies(prev => prev.filter(copy => copy.copyId !== copyId));
  }, [pushUndoSnapshot]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }, [view]);

  const handleViewportPointerDown = useCallback((event) => {
    if (![0, 1].includes(event.button) || event.target.closest(".toolbar, .hand, button, a, input, select")) return;
    event.preventDefault();
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

  const handleViewportPointerDownCapture = useCallback((event) => {
    if (event.button !== 0 || event.detail < 2) return;
    const url = getAssetCardUrlFromEvent(event);
    if (!url) return;
    event.preventDefault();
    event.stopPropagation();
    openListingUrl(url);
  }, []);

  const handleViewportDoubleClick = useCallback((event) => {
    const url = getAssetCardUrlFromEvent(event);
    if (!url) return;
    event.preventDefault();
    event.stopPropagation();
    openListingUrl(url);
  }, []);

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
      drag.hasMoved = true;
      const dx = (event.clientX - drag.startX) / view.scale;
      const dy = (event.clientY - drag.startY) / view.scale;
      setFreeCopies(prev => prev.map(copy => copy.copyId === drag.copyId
        ? { ...copy, x: drag.originX + dx, y: drag.originY + dy }
        : copy));
    }
  }, [view.scale]);

  const endPointerGesture = useCallback((event) => {
    const freeDrag = freeDragRef.current;
    panRef.current = null;
    freeDragRef.current = null;
    if (!freeDrag || !event) return;

    const handRect = handRef.current?.getBoundingClientRect();
    const droppedOnHand = handRect
      && handRect.width > 0
      && handRect.height > 0
      && event.clientX >= handRect.left
      && event.clientX <= handRect.right
      && event.clientY >= handRect.top
      && event.clientY <= handRect.bottom;
    if (!droppedOnHand) {
      if (freeDrag.hasMoved) pushUndoSnapshot(freeDrag.undoSnapshot);
      return;
    }

    pushUndoSnapshot(freeDrag.undoSnapshot);
    setFreeCopies(prev => prev.filter(copy => copy.copyId !== freeDrag.copyId));
    setPinnedIds(prev => {
      if (prev.has(freeDrag.assetId)) return prev;
      const next = new Set(prev);
      next.add(freeDrag.assetId);
      return next;
    });
    showToast(t.copyReturnedToPinned);
  }, [pushUndoSnapshot, showToast, t]);

  const toggleShortcuts = useCallback(() => {
    setShortcutsOpen(prev => !prev);
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
      assetId: copy.assetId,
      undoSnapshot: makeBoardSnapshot(),
      hasMoved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: copy.x,
      originY: copy.y,
    };
  }, [makeBoardSnapshot]);

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
      showToast(t.copyAdded);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [createFreeCopy, removePinnedOnDrag, screenToWorld, showToast, t]);

  const nextMatchDisplayIndex = searchMatches.length ? (nextMatchIndex % searchMatches.length) + 1 : 0;
  const matchButtonLabel = activeQuery && searchMatches.length
    ? `${t.next} ${nextMatchDisplayIndex}/${searchMatches.length}`
    : t.search;

  const visibleAssetCount = visibleAssetEntries.length;
  const activeAssetCount = activeAssets.length;
  const viewportZoom = scaleToVisualZoom(view.scale);
  const isCompactCardZoom = focusMode || lightweightCards || view.scale <= COMPACT_CARD_ZOOM;
  const viewportStats = {
    zoom: formatVisualZoom(viewportZoom),
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
    <div className={`app-shell theme-${theme} ${focusMode ? "is-focus-mode" : ""}`}>
      {!focusMode && <Toolbar
        t={t}
        language={language}
        loadError={loadError}
        queryInput={queryInput}
        setQueryInput={handleQueryInputChange}
        searchSuggestion={searchSuggestion}
        searchHistoryMatches={searchHistoryMatches}
        onUseSearchHistory={useSearchHistoryQuery}
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
        lightweightCards={lightweightCards}
        setLightweightCards={setLightweightCards}
        keyboardPanSpeed={keyboardPanSpeed}
        setKeyboardPanSpeed={setKeyboardPanSpeed}
        theme={theme}
        setTheme={setTheme}
        setLanguage={setLanguage}
        visibleAssetCount={visibleAssetCount}
        activeAssetCount={activeAssetCount}
        profiles={profiles}
        activeProfile={activeProfile}
        activeProfileId={activeProfileId}
        profileNameInput={profileNameInput}
        setProfileNameInput={setProfileNameInput}
        onCreateProfile={createProfile}
        onSaveProfile={() => saveActiveProfile(t.profileSaved)}
        onLoadProfile={loadProfile}
        onDeleteProfile={deleteProfile}
        onDownloadProfiles={downloadProfiles}
        onUploadProfiles={uploadProfiles}
        profileFileInputRef={profileFileInputRef}
      />}

      <main
        ref={viewportRef}
        className={`viewport ${staticGridBackground ? "grid-static" : "grid-dynamic"} ${panRef.current ? "is-panning" : ""} ${isCompactCardZoom ? "is-far-zoom" : ""}`}
        style={viewportGridStyle}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={endPointerGesture}
        onPointerCancel={endPointerGesture}
        onPointerDownCapture={handleViewportPointerDownCapture}
        onDoubleClick={handleViewportDoubleClick}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
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
                    t={t}
                    language={language}
                    activeQuery={activeQuery}
                    searchMatchCount={activeQuery ? searchGroupMatchCounts.get(note.title) || 0 : null}
              />
            ))}
          </div>
          <div className="grid-layer">
            {visibleAssetEntries.map(({ asset, x, y }) => {
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  x={x}
                  y={y}
                  kind="grid"
                  isPinned={pinnedIds.has(asset.id)}
                  hasSearch={Boolean(activeQuery)}
                  isSearchMatch={!activeQuery || searchMatchSet.has(asset.id)}
                  isCurrent={currentFocusId === asset.id}
                  showOriginalTitle={showOriginalTitle}
                  language={language}
                  isCompact={isCompactCardZoom}
                  t={t}
                  onTogglePinned={togglePinned}
                  onDuplicate={duplicateAsset}
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
                  language={language}
                  isCompact={isCompactCardZoom}
                  t={t}
                  onTogglePinned={togglePinned}
                  onDelete={deleteFreeCopy}
                  onStartFreeDrag={startFreeDrag}
                  dragCopy={copy}
                  copyId={copy.copyId}
                />
              );
            })}
          </div>
        </div>
        {focusMode && (
          <div className="focus-mode-hint" aria-live="polite">
            {t.focusModeHint}
          </div>
        )}
        {!focusMode && (
          <>
            <div className="viewport-hud viewport-stats" aria-label="Положение канваса">
              <span>Zoom: {viewportStats.zoom}</span>
              <span>X: {viewportStats.x}</span>
              <span>Y: {viewportStats.y}</span>
            </div>
            <div className="viewport-hud viewport-count" aria-label="Количество ассетов">
              {t.visible}: {visibleAssetCount.toLocaleString("ru-RU")} / {activeAssetCount.toLocaleString("ru-RU")}
            </div>
          </>
        )}
        <div className="viewport-actions" aria-label="Навигация по канвасу">
          <div className="viewport-top-actions">
            <div className="shortcuts-anchor">
              <button
                className={`icon-button shortcuts-button ${shortcutsOpen ? "is-active" : ""}`}
                type="button"
                title={`${t.shortcuts} (/)`}
                aria-label={t.shortcuts}
                onClick={toggleShortcuts}
              >
                <QuestionIcon />
              </button>
              {shortcutsOpen && <ShortcutsPanel t={t} />}
            </div>
            <button className="icon-button viewport-reset" type="button" title={`${t.resetView} (R)`} aria-label={t.resetView} onClick={resetView}>
              <ResetIcon />
            </button>
          </div>
          <div className="category-jump">
            <button className="icon-button" type="button" title={t.prevCategory} aria-label={t.prevCategory} onClick={() => centerOnCategory(-1)}>
              <ChevronUpIcon />
            </button>
            <button className="icon-button" type="button" title={t.nextCategory} aria-label={t.nextCategory} onClick={() => centerOnCategory(1)}>
              <ChevronDownIcon />
            </button>
          </div>
        </div>
      </main>

      {!focusMode && (
        <Hand
          handRef={handRef}
          pinnedIds={pinnedIds}
          assetById={assetById}
          windowWidth={windowWidth}
          showOriginalTitle={showOriginalTitle}
          language={language}
          pinnedFan={pinnedFan}
          onRemove={(assetId) => togglePinned(assetId)}
          onDragStart={startHandDrag}
          t={t}
        />
      )}

      {handGhost && <HandGhost ghost={handGhost} showOriginalTitle={showOriginalTitle} language={language} t={t} />}
      {toast && <div className="toast is-visible">{toast}</div>}
    </div>
  );
}

function Toolbar({
  t,
  language,
  loadError,
  typeCounts,
  enabledTypes,
  onToggleType,
  queryInput,
  setQueryInput,
  searchSuggestion,
  searchHistoryMatches,
  onUseSearchHistory,
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
  lightweightCards,
  setLightweightCards,
  keyboardPanSpeed,
  setKeyboardPanSpeed,
  theme,
  setTheme,
  setLanguage,
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
  const searchInputRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const clearSearch = useCallback(() => {
    setQueryInput("");
    setSearchFocused(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [setQueryInput]);
  const showSearchHistory = searchFocused && searchHistoryMatches.length > 0;

  return (
    <header className={`toolbar ${categoryFilter ? "has-search-context" : ""}`}>
      <div className="brand">
        <span className="brand-mark">Q</span>
        <div>
          <strong>Material Canvas</strong>
          {loadError && <span>{t.loadError}</span>}
        </div>
      </div>

      <form className="search-bar" onSubmit={onSubmit}>
        <div
          className="search-input-wrap"
          onFocus={() => setSearchFocused(true)}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false);
          }}
        >
          <input
            ref={searchInputRef}
            value={queryInput}
            type="search"
            autoComplete="off"
            placeholder={t.searchPlaceholder}
            onChange={event => setQueryInput(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          {queryInput && (
            <button
              className="search-clear-button"
              type="button"
              title={t.clearSearch}
              aria-label={t.clearSearch}
              onPointerDown={event => event.preventDefault()}
              onClick={clearSearch}
            >
              <ClearIcon />
            </button>
          )}
          {searchSuggestion && (
            <div className="autocomplete-hint">
              <span>{searchSuggestion}</span>
              <kbd>Tab</kbd>
            </div>
          )}
          {showSearchHistory && (
            <div className="search-history-popover" aria-label={t.searchHistory}>
              <strong>{t.searchHistory}</strong>
              {searchHistoryMatches.map(query => (
                <button
                  key={query}
                  type="button"
                  onClick={() => {
                    setSearchFocused(false);
                    onUseSearchHistory(query);
                  }}
                >
                  {query}
                </button>
              ))}
            </div>
          )}
        </div>
        {queryInput.trim() && <button className="primary-button search-button" type="submit">{matchButtonLabel}</button>}
        <span className="match-count">{matchCount == null ? "" : `${matchCount.toLocaleString("ru-RU")} ${t.matches}`}</span>
        {categoryFilter && (
          <div className="search-context-row">
            <span>{t.selectedCategory}</span>
            <strong>{formatCategoryPath(categoryFilter, language)}</strong>
          </div>
        )}
      </form>

      <div className="toolbar-controls">
        <GitHubButton t={t} language={language} />
        <button
          className={`icon-button profiles-button ${profilesOpen ? "is-active" : ""}`}
          type="button"
          title={t.profiles}
          aria-label={t.profiles}
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
            t={t}
            language={language}
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
          title={t.settings}
          aria-label={t.settings}
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
            t={t}
            language={language}
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
            lightweightCards={lightweightCards}
            setLightweightCards={setLightweightCards}
            keyboardPanSpeed={keyboardPanSpeed}
            setKeyboardPanSpeed={setKeyboardPanSpeed}
            theme={theme}
            setTheme={setTheme}
            setLanguage={setLanguage}
            visibleAssetCount={visibleAssetCount}
            activeAssetCount={activeAssetCount}
          />
        )}
      </div>
    </header>
  );
}

function ShortcutsPanel({ t }) {
  return (
    <section className="shortcuts-popover" aria-label={t.shortcutsTitle} onPointerDown={event => event.stopPropagation()}>
      <strong>{t.shortcutsTitle}</strong>
      <div className="shortcut-list">
        {t.shortcutItems.map(item => (
          <div className="shortcut-row" key={item.keys}>
            <kbd>{item.keys}</kbd>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GitHubButton({ t, language }) {
  const [stars, setStars] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(GITHUB_REPOSITORY_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(response => {
        if (!response.ok) throw new Error("GitHub stars unavailable");
        return response.json();
      })
      .then(data => {
        if (!cancelled && Number.isFinite(data.stargazers_count)) {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {
        if (!cancelled) setStars(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const locale = language === "ru" ? "ru-RU" : "en-US";
  const starLabel = stars == null ? "..." : stars.toLocaleString(locale);
  const title = stars == null
    ? t.githubRepository
    : `${t.githubRepository} - ${starLabel} ${t.githubStars}`;

  return (
    <a
      className="github-button"
      href={GITHUB_REPOSITORY_URL}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={title}
    >
      <GitHubIcon />
      <span className="github-stars" aria-label={t.githubStars}>
        <StarIcon />
        <span>{starLabel}</span>
      </span>
    </a>
  );
}

function ProfilesPanel({
  profiles,
  t,
  language,
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
    <section className="profiles-popover" aria-label={t.profiles}>
      <div className="profile-current">
        <span>{t.selected}</span>
        <strong>{activeProfile?.name || t.noProfile}</strong>
        <small>{t.lastSaved} {formatProfileTime(activeProfile?.updatedAt, language)}</small>
        <button className="panel-button" type="button" onClick={onSaveProfile}>{t.save}</button>
      </div>

      <form className="profile-create" onSubmit={onCreateProfile}>
        <input
          value={profileNameInput}
          type="text"
          autoComplete="off"
          placeholder={t.profileName}
          onChange={event => setProfileNameInput(event.target.value)}
        />
        <button className="panel-button" type="submit">{t.create}</button>
      </form>

      <div className="profile-list">
        {profiles.map((profile, index) => {
          const isCurrent = profile.id === activeProfileId;
          return (
            <div className={`profile-row ${isCurrent ? "is-current" : ""}`} key={profile.id}>
              <div className="profile-row-info">
                {index < 9 && <span className="profile-hotkey">{index + 1}</span>}
                <div>
                  <strong>{profile.name}</strong>
                  <small>{formatProfileTime(profile.updatedAt, language)}</small>
                </div>
              </div>
              <div className="profile-row-actions">
                {isCurrent ? (
                  <span className="profile-current-badge">{t.current}</span>
                ) : (
                  <button className="panel-button small" type="button" onClick={() => onLoadProfile(profile.id)}>{t.load}</button>
                )}
                <button className="card-icon delete-button" type="button" title={t.deleteProfile} aria-label={t.deleteProfile} onClick={() => onDeleteProfile(profile.id)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="profile-file-actions">
        <button className="panel-button" type="button" onClick={() => profileFileInputRef.current?.click()}>{t.uploadProfiles}</button>
        <button className="panel-button" type="button" onClick={onDownloadProfiles}>{t.downloadJson}</button>
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
  t,
  language,
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
  lightweightCards,
  setLightweightCards,
  keyboardPanSpeed,
  setKeyboardPanSpeed,
  theme,
  setTheme,
  setLanguage,
  visibleAssetCount,
  activeAssetCount,
}) {
  const categoryOptions = useMemo(() => groupCategoryOptions(categories, language), [categories, language]);
  const keyboardPanSpeedIndex = getKeyboardPanSpeedIndex(keyboardPanSpeed);
  const keyboardPanSpeedOption = getKeyboardPanSpeedOption(keyboardPanSpeed);

  return (
    <section className="settings-popover" aria-label={t.settings}>
      <div className="settings-canvas-count">
        <span>{t.inCanvas}</span>
        <span>{visibleAssetCount.toLocaleString("ru-RU")} / {activeAssetCount.toLocaleString("ru-RU")}</span>
      </div>

      <div className="settings-section">
        <strong>{t.assetTypes}</strong>
        <div className="settings-type-list">
          {TYPE_ORDER.map(type => (
            <label key={type} className="settings-check">
              <input
                type="checkbox"
                checked={enabledTypes.has(type)}
                onChange={() => onToggleType(type)}
              />
              <span>{getTypeLabel(type, language)}</span>
              <small>{(typeCounts.get(type) || 0).toLocaleString("ru-RU")}</small>
            </label>
          ))}
        </div>
      </div>

      <label className="settings-section">
        <strong>{t.subcategory}</strong>
        <select
          value={categoryFilter}
          aria-label={t.subcategory}
          onChange={event => setCategoryFilter(event.target.value)}
        >
          <option value="">{t.allSubcategories}</option>
          {categoryOptions.standalone.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
          {categoryOptions.groups.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </optgroup>
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
          <span>{t.hideUnpurchased}</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={removePinnedOnDrag}
            onChange={event => setRemovePinnedOnDrag(event.target.checked)}
          />
          <span>{t.removePinnedOnDrag}</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={showOriginalTitle}
            onChange={event => setShowOriginalTitle(event.target.checked)}
          />
          <span>{t.showOriginalTitle}</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={pinnedFan}
            onChange={event => setPinnedFan(event.target.checked)}
          />
          <span>{t.pinnedFan}</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={staticGridBackground}
            onChange={event => setStaticGridBackground(event.target.checked)}
          />
          <span>{t.staticGridBackground}</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={lightweightCards}
            onChange={event => setLightweightCards(event.target.checked)}
          />
          <span>{t.lightweightCards}</span>
        </label>
      </div>

      <label className="settings-section settings-range">
        <div className="settings-range-head">
          <strong>{t.keyboardPanSpeed}</strong>
          <span>{t.keyboardPanSpeedValue(keyboardPanSpeedOption)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={KEYBOARD_PAN_SPEED_OPTIONS.length - 1}
          step={1}
          value={keyboardPanSpeedIndex}
          onChange={event => {
            const option = KEYBOARD_PAN_SPEED_OPTIONS[Number(event.target.value)] || keyboardPanSpeedOption;
            setKeyboardPanSpeed(option.speed);
          }}
        />
      </label>

      <label className="settings-section">
        <strong>{t.theme}</strong>
        <select
          value={theme}
          aria-label={t.theme}
          onChange={event => setTheme(normalizeTheme(event.target.value))}
        >
          {THEME_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{t[option.labelKey]}</option>
          ))}
        </select>
      </label>

      <label className="settings-section">
        <strong>{t.language}</strong>
        <select
          value={language}
          aria-label={t.language}
          onChange={event => setLanguage(normalizeLanguage(event.target.value))}
        >
          {LANGUAGE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </section>
  );
}

const GroupNote = memo(function GroupNote({ note, t, language, activeQuery, searchMatchCount }) {
  return (
    <section
      className={`group-note note-group-${note.listingType}`}
      style={{ transform: `translate(${note.x}px, ${note.y}px)`, width: note.width, height: note.height }}
    >
      <div>
        <span className={`note-type note-${note.listingType}`}>{getTypeLabel(note.listingType, language)}</span>
        <strong>{formatCategoryPath(note.title, language)}</strong>
      </div>
      <span>{activeQuery ? `${searchMatchCount} / ${note.count}` : `${note.count} ${note.count === 1 ? t.asset : t.assets}`}</span>
    </section>
  );
});

const AssetCard = memo(function AssetCard({
  asset,
  x,
  y,
  kind,
  isPinned,
  hasSearch,
  isSearchMatch,
  isCurrent,
  showOriginalTitle,
  language = DEFAULT_SETTINGS.language,
  isCompact = false,
  t,
  onTogglePinned,
  onDuplicate,
  onDelete,
  onStartFreeDrag,
  dragCopy,
  copyId,
}) {
  const className = [
    "asset-card",
    `asset-${asset.listingType}`,
    kind === "free" ? "is-free" : "",
    hasSearch && !isSearchMatch ? "search-dim" : "",
    hasSearch && isSearchMatch ? "search-match" : "",
    isCurrent ? "current-hit" : "",
    isCompact ? "is-compact" : "",
  ].filter(Boolean).join(" ");
  const { primaryTitle, secondaryTitle } = getAssetDisplayTitles(asset, language, showOriginalTitle);
  const cardStyle = {
    transform: `translate(${x}px, ${y}px)`,
    "--asset-preview": `url(${JSON.stringify(asset.preview || "")})`,
  };
  const handleTogglePinned = useCallback(() => {
    onTogglePinned?.(asset.id);
  }, [asset.id, onTogglePinned]);
  const handleDuplicate = useCallback(() => {
    onDuplicate?.(asset.id);
  }, [asset.id, onDuplicate]);
  const handleDelete = useCallback(() => {
    onDelete?.(copyId);
  }, [copyId, onDelete]);
  const handlePointerDown = useCallback((event) => {
    if (!onStartFreeDrag || !dragCopy) return;
    onStartFreeDrag(event, dragCopy);
  }, [dragCopy, onStartFreeDrag]);
  const openAsset = useCallback((event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("button, a")) return;
    event.preventDefault();
    event.stopPropagation();
    openListingUrl(asset.url);
  }, [asset.url]);

  if (isCompact) {
    return (
      <article
        className={className}
        style={cardStyle}
        data-asset-url={asset.url}
        title={primaryTitle}
        onPointerDown={handlePointerDown}
        onDoubleClick={openAsset}
      />
    );
  }

  return (
    <article
      className={className}
      style={cardStyle}
      data-asset-url={asset.url}
      onPointerDown={handlePointerDown}
      onDoubleClick={openAsset}
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
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="card-footer">
        <div className="card-actions">
          <button className={`card-icon star-button ${isPinned ? "is-pinned" : ""}`} type="button" title={t.pin} aria-label={t.pin} onClick={handleTogglePinned}>
            <StarIcon />
          </button>
          {kind === "free" ? (
            <button className="card-icon delete-button" type="button" title={t.deleteDuplicate} aria-label={t.deleteDuplicate} onClick={handleDelete}>
              <TrashIcon />
            </button>
          ) : (
            <button className="card-icon duplicate-button" type="button" title={t.duplicate} aria-label={t.duplicate} onClick={handleDuplicate}>
              <CopyIcon />
            </button>
          )}
          <a className="card-icon link-button" href={asset.url} target="_blank" rel="noreferrer" title={t.openFab} aria-label={t.openFab}>
            <ExternalIcon />
          </a>
        </div>
      </div>
    </article>
  );
});

function Hand({ handRef, pinnedIds, assetById, windowWidth, showOriginalTitle, language, pinnedFan, onRemove, onDragStart, t }) {
  const hoverTimeoutRef = useRef(null);
  const [activeHandCardId, setActiveHandCardId] = useState("");
  const pinnedAssets = Array.from(pinnedIds)
    .map(assetId => assetById.get(assetId))
    .filter(Boolean);
  const availableWidth = Math.max(280, windowWidth - 44);
  const step = pinnedAssets.length > 1
    ? clamp((availableWidth - 116) / (pinnedAssets.length - 1), 8, 104)
    : 0;
  const maxAngle = pinnedFan && pinnedAssets.length > 1 ? clamp(3 + pinnedAssets.length * 0.16, 3, 6.5) : 0;
  const maxLift = pinnedFan && pinnedAssets.length > 1 ? clamp(16 + pinnedAssets.length * 0.75, 18, 34) : 0;

  const keepHandCardActive = useCallback((assetId) => {
    window.clearTimeout(hoverTimeoutRef.current);
    setActiveHandCardId(assetId);
  }, []);

  const releaseHandCardActive = useCallback((assetId) => {
    window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setActiveHandCardId(current => current === assetId ? "" : current);
    }, 420);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(hoverTimeoutRef.current);
  }, []);

  return (
    <aside ref={handRef} className="hand" aria-label="Pinned assets">
      <div className="hand-cards" style={{ "--hand-count": pinnedAssets.length, "--hand-step": `${step}px` }}>
        {pinnedAssets.map((asset, index) => {
          const { primaryTitle, secondaryTitle } = getAssetDisplayTitles(asset, language, showOriginalTitle);
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
              className={`hand-card-slot ${activeHandCardId === asset.id ? "is-active" : ""}`}
              style={{
                "--hand-index": index,
                "--hand-x": `${index * step}px`,
                "--hand-y": `${-lift}px`,
                "--hand-angle": `${angle.toFixed(2)}deg`,
              }}
            >
              <div
                className="hand-card"
                onPointerEnter={() => keepHandCardActive(asset.id)}
                onPointerLeave={() => releaseHandCardActive(asset.id)}
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
                  <button className="card-icon unpin-button" type="button" title={t.unpin} aria-label={t.unpin} onPointerDown={event => event.stopPropagation()} onClick={(event) => {
                    event.stopPropagation();
                    onRemove(asset.id);
                  }}>
                    <UnpinIcon />
                  </button>
                  <a className="card-icon link-button" href={asset.url} target="_blank" rel="noreferrer" title={t.openFab} aria-label={t.openFab} onPointerDown={event => event.stopPropagation()}>
                    <ExternalIcon />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function HandGhost({ ghost, showOriginalTitle, language, t }) {
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
        language={language}
        t={t}
        onTogglePinned={() => {}}
        onDuplicate={() => {}}
      />
    </div>
  );
}

function ResetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.68V3h-5.68l1.93 1.93A10 10 0 1 0 22 14h-2a8 8 0 1 1-16-2Z" /></svg>;
}

function QuestionIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 13.25a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Zm.05-11.05c2.07 0 3.65 1.24 3.65 3.02 0 1.17-.55 1.93-1.62 2.68-.82.58-1.08.88-1.08 1.7v1.05h-2v-1.18c0-1.55.66-2.23 1.82-3.05.71-.5.88-.79.88-1.18 0-.6-.61-1.04-1.54-1.04-.98 0-1.67.48-2.19 1.25L8.35 8.32c.8-1.32 2.15-2.12 3.7-2.12Z" /></svg>;
}

function ClearIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg>;
}

function ProfilesIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a3 3 0 0 1 3-3h5.2a3 3 0 0 1 2.1.86L16.44 5H18a3 3 0 0 1 3 3v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V5h1Zm3-1a1 1 0 0 0-1 1v1h11.27l-2.39-2.39A1 1 0 0 0 14.17 3H7Zm-2 4v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5Zm7 2a2.4 2.4 0 0 1 1.9 3.86A4.2 4.2 0 0 1 16 17h-2a2 2 0 0 0-4 0H8a4.2 4.2 0 0 1 2.1-3.14A2.4 2.4 0 0 1 12 10Zm0 2a.4.4 0 1 0 0 .8.4.4 0 0 0 0-.8Z" /></svg>;
}

function GitHubIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2A10 10 0 0 0 8.84 21.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.88 1.51 2.31 1.07 2.87.82.09-.64.35-1.07.63-1.32-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 7.04c.85 0 1.7.11 2.5.33 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>;
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

function UnpinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.7 3.3 16 16-1.4 1.4-3.55-3.55V22h-2v-6.15l-1.9-1.9L7.1 18.7l-1.42-1.42 4.75-4.74L6.95 9.05 3.3 5.4l1.4-2.1Zm6.62 3.02 1.94 1.94V6.5h-2.62L8.9 4.76A3 3 0 0 1 11 4h5a3 3 0 0 1 3 3v4.17l-2-2V7a1 1 0 0 0-1-1h-4a1 1 0 0 0-.68.32ZM5 8.82 6.17 10H5V8.82ZM9.83 12H7.41l1.2-1.2L9.83 12Zm5.43 0H20v2h-2.73l-2.01-2Z" /></svg>;
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
