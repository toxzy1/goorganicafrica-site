#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

import argostranslate.package
import argostranslate.translate

ROOTS = (Path("src/blog/posts"), Path("src/ebooks"))
SETTINGS = Path("src/_data/translationSettings.json")
DEFAULT_LANGUAGES = ("fr", "ar", "pt", "sw")
FIELDS = ("title", "description", "meta_title", "meta_description", "tagline", "bonus", "category")
LISTS = ("audience", "benefits", "search_terms", "keywords")

BAD_ARTIFACTS = (
    "GOA_TOKEN",
    "GoA TOKEN",
    "GA TOKEN",
    "BAR BAR",
    "FIM",
    "ENDGOA TOKEN",
    "\\pos(",
    "\\fnAdobe Arabic",
)


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


def translate_text(text, target, cache):
    """Translate plain text only. Never inject synthetic placeholder tokens into Argos."""
    if not text or not text.strip() or not re.search(r"[A-Za-z]", text):
        return text
    key = (target, text)
    if key in cache:
        return cache[key]
    result = argostranslate.translate.translate(text, "en", target)
    cache[key] = result
    return result


def translate_markup(body, target, cache):
    """
    Translate visible text while preserving HTML/Markdown structure exactly.
    The old generator inserted GOA_TOKEN placeholders. Argos tokenized those
    markers, causing markers and neighbouring language fragments to leak out.
    """
    inline = chr(96)
    pattern = re.compile(
        r"(<!--(?:.|\n)*?-->|<[^>]+>|https?://[^\s)\]<>\"']+|"
        r"\[[^\]]+\]\([^\)]+\)|" + re.escape(inline) + r"[^" + re.escape(inline) + r"]+" + re.escape(inline) + r"|"
        r"&(?:amp|lt|gt|quot|apos|nbsp);)",
        re.S,
    )

    parts = pattern.split(body)
    out = []
    for part in parts:
        if not part:
            continue
        if pattern.fullmatch(part):
            out.append(part)
        else:
            out.append(translate_text(part, target, cache))
    return "".join(out)


def clean_check(text, path):
    for artifact in BAD_ARTIFACTS:
        if artifact in text:
            raise RuntimeError(f"Translation artifact '{artifact}' detected in {path}")


def translate_file(path, target, overwrite, status, cache):
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
        existing = output.read_text(encoding="utf-8")
        try:
            clean_check(existing, output)
        except RuntimeError:
            print("Replacing corrupted translation:", output)
        else:
            return

    tf = front

    for key in FIELDS:
        value = scalar(front, key)
        if value:
            tf = replace_scalar(tf, key, translate_text(value, target, cache))

    for key in LISTS:
        pattern = r"(?ms)^" + re.escape(key) + r":\n(.*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:|\Z)"
        m = re.search(pattern, front)
        if not m:
            continue
        values = []
        for line in m.group(1).splitlines():
            if re.match(r"^  - ", line):
                values.append(line[4:].strip().strip("'\""))
        block = key + ":\n" + "".join(
            "  - " + quote(translate_text(value, target, cache)) + "\n"
            for value in values
        )
        tf = re.sub(pattern, block, tf, count=1)

    faq_pattern = r"(?ms)^faqs:\n(.*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:|\Z)"
    faq_match = re.search(faq_pattern, front)
    if faq_match:
        faq_lines = []
        for q, a in re.findall(r"(?m)^  - q: (.*)\n    a: (.*)$", faq_match.group(1)):
            q = q.strip().strip("'\"")
            a = a.strip().strip("'\"")
            faq_lines.append("  - q: " + quote(translate_text(q, target, cache)) + "\n")
            faq_lines.append("    a: " + quote(translate_text(a, target, cache)) + "\n")
        block = "faqs:\n" + "".join(faq_lines)
        tf = re.sub(faq_pattern, block, tf, count=1)

    tf = replace_scalar(tf, "language", target)
    tf = replace_scalar(tf, "source_language", "en")
    tf = replace_scalar(tf, "translation_group", group)
    tf = replace_scalar(tf, "translation_status", status)
    tf = replace_scalar(tf, "slug", slug + "-" + target)

    related = scalar(front, "related_ebook_slug")
    if related:
        tf = replace_scalar(tf, "related_ebook_slug", related + "-" + target)

    translated_body = translate_markup(body, target, cache)
    result = "---\n" + tf.rstrip() + "\n---\n" + translated_body.lstrip()
    clean_check(result, output)

    output.write_text(result, encoding="utf-8")
    print("Created/updated:", output)


def main():
    config, languages = load_settings()
    if not config.get("enabled", True) or not config.get("automatic_generation", True):
        print("Translation automation disabled.")
        return

    files = []
    for path in source_files():
        front, _ = split_front(path.read_text(encoding="utf-8"))
        if scalar(front, "language") in ("", "en"):
            files.append(path)

    print("English source files:", len(files))
    print("Target languages:", languages)

    if not files or not languages:
        return

    install_models(languages)
    overwrite = bool(config.get("auto_update_existing_translations", True))
    status = config.get("mark_new_translations", "in_review")
    cache = {}

    for path in files:
        for target in languages:
            translate_file(path, target, overwrite, status, cache)


if __name__ == "__main__":
    main()
