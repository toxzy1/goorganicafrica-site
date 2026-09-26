#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import argostranslate.package
import argostranslate.translate

ROOTS = (Path("src/blog/posts"), Path("src/ebooks"))
SETTINGS = Path("src/_data/translationSettings.json")
DEFAULT_LANGUAGES = ("fr", "ar", "pt", "sw")
FIELDS = ("title", "description", "meta_title", "meta_description", "tagline", "bonus", "category")
LISTS = ("audience", "benefits", "search_terms", "keywords")


def load_settings():
    data = json.loads(SETTINGS.read_text(encoding="utf-8")) if SETTINGS.exists() else {}
    langs = tuple(x for x in data.get("target_languages", DEFAULT_LANGUAGES) if x in DEFAULT_LANGUAGES)
    return data, langs


def scalar(front, key):
    m = re.search(r"(?m)^" + re.escape(key) + r":\s*(.*)$", front)
    if not m:
        return ""
    v = m.group(1).strip()
    if len(v) >= 2 and v[0] in "'\"" and v[-1] == v[0]:
        v = v[1:-1]
    return v


def quote(v):
    return json.dumps(v, ensure_ascii=False)


def replace_scalar(front, key, value):
    p = r"(?m)^" + re.escape(key) + r":.*$"
    line = key + ": " + quote(value)
    return re.sub(p, line, front, count=1) if re.search(p, front) else front + "\n" + line


def split_front(source):
    m = re.match(r"^---\n([\s\S]*?)\n---\n([\s\S]*)$", source)
    if not m:
        raise ValueError("Invalid Markdown front matter")
    return m.group(1), m.group(2)


def source_files():
    files = []
    for root in ROOTS:
        files.extend(root.glob("*.md"))
    return sorted(files)


def install_models(languages):
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}
    for target in languages:
        if ("en", target) in installed:
            continue
        pkg = next((p for p in available if p.from_code == "en" and p.to_code == target), None)
        if pkg is None:
            raise RuntimeError("No Argos model found for en->" + target)
        print("Installing model en->" + target)
        pkg.install()


def protect(text):
    saved = {}
    n = 0

    def save(m):
        nonlocal n
        token = "GOA_TOKEN_" + str(n) + "_END"
        n += 1
        saved[token] = m.group(0)
        return token

    patterns = [
        r"<[^>]+>",
        r"\{\{[^}]+\}\}",
        r"\{%[^%]+%\}",
        r"\[[^\]]+\]\([^\)]+\)",
        r"\x60[^\x60]+\x60",
        r"https?://[^\s)\]<>\"']+",
    ]
    out = text
    for pattern in patterns:
        out = re.sub(pattern, save, out)
    return out, saved


def translate_text(text, target, cache):
    if not text.strip() or not re.search(r"[A-Za-z]", text):
        return text
    key = (target, text)
    if key in cache:
        return cache[key]
    safe, saved = protect(text)
    if not safe.strip():
        return text
    result = argostranslate.translate.translate(safe, "en", target)
    for token, value in saved.items():
        result = result.replace(token, value)
    cache[key] = result
    return result


def translate_body(body, target, cache):
    out = []
    for line in body.splitlines(keepends=True):
        ending = "\n" if line.endswith("\n") else ""
        content = line[:-1] if ending else line
        out.append(line if not content.strip() else translate_text(content, target, cache) + ending)
    return "".join(out)


def translate_file(path, target, overwrite, status):
    source = path.read_text(encoding="utf-8")
    front, body = split_front(source)
    if scalar(front, "language") not in ("", "en"):
        return

    group = scalar(front, "translation_group")
    slug = scalar(front, "slug")
    if not group or not slug:
        print("Skipping missing translation metadata:", path)
        return

    output = path.parent / (slug + "-" + target + ".md")
    if output.exists() and not overwrite:
        return

    cache = {}
    tf = front

    for key in FIELDS:
        value = scalar(front, key)
        if value:
            tf = replace_scalar(tf, key, translate_text(value, target, cache))

    for key in LISTS:
        m = re.search(r"(?ms)^" + re.escape(key) + r":\n(?:  - .*\n?)+", front)
        if m:
            values = [x.strip().strip("'\"") for x in re.findall(r"(?m)^  - (.*)$", m.group(0))]
            block = key + ":\n" + "".join("  - " + quote(translate_text(x, target, cache)) + "\n" for x in values)
            tf = re.sub(r"(?ms)^" + re.escape(key) + r":\n(?:  - .*\n?)+", block, tf, count=1)

    tf = replace_scalar(tf, "language", target)
    tf = replace_scalar(tf, "source_language", "en")
    tf = replace_scalar(tf, "translation_group", group)
    tf = replace_scalar(tf, "translation_status", status)
    tf = replace_scalar(tf, "slug", slug + "-" + target)

    related = scalar(front, "related_ebook_slug")
    if related:
        tf = replace_scalar(tf, "related_ebook_slug", related + "-" + target)

    output.write_text("---\n" + tf.rstrip() + "\n---\n" + translate_body(body, target, cache).lstrip(), encoding="utf-8")
    print("Created/updated:", output)


def main():
    config, languages = load_settings()
    if not config.get("enabled", True) or not config.get("automatic_generation", True):
        print("Translation automation disabled.")
        return
    files = source_files()
    print("English source files:", len(files))
    print("Target languages:", languages)
    if not files or not languages:
        return
    install_models(languages)
    overwrite = bool(config.get("auto_update_existing_translations", True))
    status = config.get("mark_new_translations", "in_review")
    for path in files:
        for target in languages:
            translate_file(path, target, overwrite, status)


if __name__ == "__main__":
    main()
