# Material Canvas

Material Canvas is a static React/Vite reference board for browsing a large material library. It is built for artists who need to search, compare, pin, and arrange materials while working on different project profiles.

![Material Canvas English UI](docs/screenshots/material-canvas-en.png)

## Features

- Large zoomable canvas with material cards grouped by category.
- Search with autocomplete, highlighted matches, and next-result navigation.
- Per-profile Local Storage persistence for zoom, viewport position, pinned cards, free canvas copies, search state, filters, theme, and language.
- Pinned hand, draggable duplicate cards, category jump controls, and compact cards at far zoom levels.
- Asset type filtering for Materials, Decals, and Brushes.
- English and Russian UI switcher.
- Static hosting friendly: no backend server is required.

## Local Development

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. The app loads asset data from:

```text
public/data/assets.json
```

## Build

```bash
npm run build
npm run preview
```

The production site is emitted into `dist/`.

## GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

1. Push the repository to GitHub.
2. In the repository settings, open **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `master` or run the workflow manually.

The Vite config uses `base: "./"`, so the build works from GitHub Pages project URLs such as:

```text
https://username.github.io/material_canvas/
```

## Data Notes

The demo data in `public/data/assets.json` intentionally includes purchased-state examples. Profiles and user changes are not uploaded anywhere; they are saved only in the browser's Local Storage. Artists can export and import profile JSON files from the profile menu.

---

# Material Canvas на русском

Material Canvas — статический React/Vite-инструмент для просмотра большой библиотеки материалов. Он помогает художнику искать, сравнивать, закреплять и раскладывать материалы по отдельным рабочим профилям.

![Material Canvas Russian UI](docs/screenshots/material-canvas-ru.png)

## Возможности

- Большой zoomable canvas с карточками материалов и группировкой по категориям.
- Поиск с автодополнением, подсветкой совпадений и переходом к следующему результату.
- Профили в Local Storage: сохраняются zoom, позиция canvas, закрепленные карточки, свободные копии, поиск, фильтры, тема и язык.
- Pinned-рука, перетаскиваемые дубликаты, переходы по категориям и упрощенные карточки на дальнем зуме.
- Фильтры по типам ассетов: Materials, Decals и Brushes.
- Переключение интерфейса между английским и русским.
- Можно хостить как обычный статический сайт, backend не нужен.

## Локальный запуск

```bash
npm ci
npm run dev
```

Открой локальный URL, который покажет Vite. Данные ассетов загружаются из:

```text
public/data/assets.json
```

## Сборка

```bash
npm run build
npm run preview
```

Готовый сайт появится в папке `dist/`.

## GitHub Pages

В репозитории уже есть workflow `.github/workflows/pages.yml`.

1. Залей репозиторий на GitHub.
2. В настройках репозитория открой **Pages**.
3. В **Source** выбери **GitHub Actions**.
4. Сделай push в `master` или запусти workflow вручную.

В `vite.config.js` стоит `base: "./"`, поэтому сборка работает из project URL GitHub Pages, например:

```text
https://username.github.io/material_canvas/
```

## Данные

Файл `public/data/assets.json` намеренно содержит пример списка ассетов со статусом покупки. Профили и изменения пользователя никуда не отправляются: они сохраняются только в Local Storage браузера. Профили можно экспортировать и импортировать JSON-файлом из меню профилей.
