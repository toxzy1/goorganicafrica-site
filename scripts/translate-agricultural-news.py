#!/usr/bin/env python3
"""Create free offline agricultural-news translation drafts for human review.

This script only fills missing translations. Existing translated fields are never
overwritten. The workflow opens/updates a pull request; it does not publish drafts
directly to the production branch.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import argostranslate.package
import argostranslate.translate

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    ROOT / "src/_data/agriculturalNews.json",
    ROOT / "src/_data/agriculturalNewsSupplement.json",
)
LANGUAGES = ("fr", "ar", "pt", "sw")
MAX_RECORDS = 25
URL_RE = re.compile(r"https?://[^\s)\]<>\"']+")
NUMBER_RE = re.compile(r"(?<![A-Za-z])\d[\d.,%/-]*(?![A-Za-z])")


def install_models() -> None:
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}

    # Preflight every required language pair before downloading anything. This
    # avoids a half-installed run if one model is missing from the free index.
    to_install = []
    missing = []
    for target in LANGUAGES:
        if ("en", target) in installed:
            continue
        package = next((p for p in available if p.from_code == "en" and p.to_code == target), None)
        if package is None:
            missing.append(target)
        else:
            to_install.append((target, package))
    if missing:
        raise RuntimeError(
            "No free Argos Translate model found for: "
            + ", ".join(f"en->{target}" for target in missing)
        )

    for target, package in to_install:
        print(f"Installing offline model en->{target}")
        package.install()


def translate_value(value: str, target: str, cache: dict[tuple[str, str], str]) -> str:
    if not isinstance(value, str) or not value.strip():
        return value
    key = (target, value)
    if key in cache:
        return cache[key]
    protected: dict[str, str] = {}
    counter = 0

    def save(match: re.Match[str]) -> str:
        nonlocal counter
        token = f"GOAKEEP{counter}TOKEN"
        counter += 1
        protected[token] = match.group(0)
        return token

    safe = URL_RE.sub(save, value)
    safe = NUMBER_RE.sub(save, safe)
    translated = argostranslate.translate.translate(safe, "en", target)
    for token, original in protected.items():
        translated = translated.replace(token, original)
    translated = translated.strip()
    cache[key] = translated if translated else value
    return cache[key]


def records_for(data: dict, filename: Path):
    if filename.name == "agriculturalNews.json":
        for country in data.get("countries", []):
            for article in country.get("articles", []):
                yield article, f"{country.get('code', '??')} — {article.get('title', 'untitled')}"
    else:
        for article in data.get("records", []):
            yield article, f"{article.get('country_code', '??')} — {article.get('title', 'untitled')}"


def main() -> None:
    install_models()
    cache: dict[tuple[str, str], str] = {}
    candidates: list[tuple[dict, str, Path]] = []
    data_by_file: dict[Path, dict] = {}
    for filename in FILES:
        data = json.loads(filename.read_text(encoding="utf-8"))
        data_by_file[filename] = data
        for record, label in records_for(data, filename):
            title = record.get("title") or record.get("headline") or ""
            summary = record.get("summary") or record.get("description") or ""
            if not title.strip() or not summary.strip():
                continue
            translations = record.get("translations") or {}
            missing = any(
                not ((translations.get(lang) or {}).get("title", "").strip()
                     and (translations.get(lang) or {}).get("summary", "").strip())
                for lang in LANGUAGES
            )
            if missing:
                candidates.append((record, label, filename))

    print(f"Records needing at least one complete translation: {len(candidates)}")
    changed_by_file: dict[Path, int] = {}
    for record, label, filename in candidates[:MAX_RECORDS]:
        translations = record.setdefault("translations", {})
        title = record.get("title") or record.get("headline") or ""
        summary = record.get("summary") or record.get("description") or ""
        changed = False
        for lang in LANGUAGES:
            item = translations.setdefault(lang, {})
            if not str(item.get("title", "")).strip():
                item["title"] = translate_value(title, lang, cache)
                changed = True
            if not str(item.get("summary", "")).strip():
                item["summary"] = translate_value(summary, lang, cache)
                changed = True
        if changed:
            record["translation_review_status"] = "pending_human_review"
            changed_by_file[filename] = changed_by_file.get(filename, 0) + 1
            print("Drafted:", label)

    for filename, count in changed_by_file.items():
        filename.write_text(json.dumps(data_by_file[filename], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Saved {count} translated records to {filename.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
