import csv
import json
import pathlib
import re

from title_translation import translate_title


ROOT = pathlib.Path(__file__).resolve().parents[2]
CSV_ROOT = ROOT / "fab_quixel_csv"
INCLUDE_TYPES = ("material", "decal", "brush")
PUBLIC_DATA_DIR = ROOT / "material_canvas" / "public" / "data"
LEGACY_DATA_DIR = ROOT / "material_canvas" / "data"
OUT_FILE = PUBLIC_DATA_DIR / "assets.json"
LEGACY_ASSETS_FILE = LEGACY_DATA_DIR / "assets.json"
LEGACY_MATERIALS_FILE = LEGACY_DATA_DIR / "materials.json"


def product_id(url: str, fallback: str) -> str:
    match = re.search(r"/listings/([^/?#]+)", url or "")
    return match.group(1) if match else fallback


def clean(value: str) -> str:
    return (value or "").strip()


def main() -> None:
    assets = []
    for listing_type in INCLUDE_TYPES:
        csv_dir = CSV_ROOT / listing_type
        for csv_path in sorted(csv_dir.glob("*.csv")):
            read_csv(csv_path, assets)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    LEGACY_DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    OUT_FILE.write_text(payload, encoding="utf-8")
    LEGACY_ASSETS_FILE.write_text(payload, encoding="utf-8")
    LEGACY_MATERIALS_FILE.write_text(
        json.dumps([asset for asset in assets if asset["listingType"] == "material"], ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(assets)} assets to {OUT_FILE}")


def read_csv(csv_path: pathlib.Path, assets: list[dict]) -> None:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_index, row in enumerate(reader, 1):
            categories = [
                clean(row.get("Категория 1")),
                clean(row.get("Категория 2")),
                clean(row.get("Категория 3")),
                clean(row.get("Категория 4")),
            ]
            categories = [value for value in categories if value]
            full_path = clean(row.get("Полный путь категории"))
            category_short = " > ".join(categories) if categories else full_path
            url = clean(row.get("Ссылка на товар"))
            title = clean(row.get("Название продукта"))
            asset = {
                "id": product_id(url, f"{csv_path.stem}-{row_index}"),
                "title": title,
                "title_ru": translate_title(title),
                "purchased": clean(row.get("Куплен ли")).lower() in {"да", "yes", "true", "1"},
                "preview": clean(row.get("Ссылка на превью картинки")),
                "url": url,
                "assetType": clean(row.get("Тип продукта")),
                "listingType": clean(row.get("Listing type")),
                "categoryPath": full_path,
                "categoryShort": category_short,
                "categoryLeaf": categories[-1] if categories else "",
                "slug": clean(row.get("Category slug")),
                "sourceCsv": csv_path.name,
            }
            assets.append(asset)


if __name__ == "__main__":
    main()
