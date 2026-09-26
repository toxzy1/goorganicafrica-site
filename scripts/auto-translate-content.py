#!/usr/bin/env python3
"""
GoOrganicAfrica multilingual content generator.

Uses Argos Translate locally inside GitHub Actions. No commercial translation API
and no API key are required. English Markdown remains the source of truth.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import argostranslate.package
import argostranslate.translate

LANGUAGES = {
    "fr": "French",
    "ar": "Arabic",
    "pt": "Portuguese",
    "sw": "Swahili",
}

ROOTS = (Path("src/blog/posts"), Path("src/ebooks"))
FIELD_KEYS = (
    "title",
    "description",
    "meta_title",
    "meta_description",
    "tagline",
    "bonus",
    "category",
)
LIST_KEYS = ("audience", "benefits", "search_terms", "keywords")


def changed_source_files() -> list[Path]:
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    if event == "workflow_dispatch":
        files = []
        for root in ROOTS:
            files.extend(root.glob("*.md"))
        return sorted(files)

    before = os.environ.get("GITHUB_EVENT_BEFORE", "")
    after = os.environ.get("GITHUB_SHA", "HEAD")
    if before and set(before) != {"0"}:
        result = subprocess.run(
            ["git", "diff", "--name-only", before, after, "--", "src/blog/posts", "src/ebooks"],
            check=True, text=True, capture_output=True,
        )
    else:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD^", "HEAD", "--", "src/blog/posts", "src/ebooks"],
            check=True, text=True, capture_output=True,
        )
    return [Path(x) for x in result.stdout.splitlines() if x.endswith(".md")]


def split_front_matter(source: str) -> tuple[str, str]:
    match = re.match(r"^---\n([\s\S]*?)\n---\n([\s\S]*)$", source)
    if not match:
        raise ValueError("Invalid Markdown front matter")
    return match.group(1), match.group(2)


def yaml_scalar(front: str, key: str) -> str:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*(.*)$", front)
    if not match:
        return ""
    value = match.group(1).strip()
    if value.startswith(("'", '"')) and value.endswith(value[0]):
        value = value[1:-1]
    return value


def yaml_quote(value: str) -> str:
    import json
    return json.dumps(value, ensure_ascii=False)


def replace_scalar(front: str, key: str, value: str) -> str:
    replacement = f"{key}: {yaml_quote(value)}"
    pattern = rf"(?m)^{re.escape(key)}:.*$"
    if re.search(pattern, front):
        return re.sub(pattern, replacement, front, count=1)
    return front + "\n" + replacement


def replace_simple_list(front: str, key: str, values: list[str]) -> str:
    pattern = rf"(?ms)^{re.escape(key)}:\n(?:  - .*\n?)+"
    block = f"{key}:\n" + "".join(f"  - {yaml_quote(v)}\n" for v in values)
    if re.search(pattern, front):
        return re.sub(pattern, block, front, count=1)
    return front + "\n" + block


def protect_markup(text: str) -> tuple[str, dict[str, str]]:
    protected: dict[str, str] = {}
    counter = 0

    def put(value: str) -> str:
        nonlocal counter
        token = f"GOATOKEN{counter}X"
        counter += 1
        protected[token] = value
        return token

    patterns = [
        r"https?://[^\s)\]<>\"']+",
        r"\x60[^\x60]+\x60",
        r"\[[^\]]+\]\([^\)]+\)",
        r"<[^>]+>",
        r"\{\{[^}]+\}\}",
        r"\{%[^%]+%\}",
    ]
    result = text
    for pattern in patterns:
        result = re.sub(pattern, lambda m: put(m.group(0)), result)
    return result, protected


def restore_markup(text: str, protected: dict[str, str]) -> str:
    result = text
    for token, value in protected.items():
        result = result.replace(token, value)
    return result


def translate_text(text: str, target: str, cache: dict[tuple[str, str], str]) -> str:
    if not text.strip() or not re.search(r"[A-Za-z]", text):
        return text

    key = (target, text)
    if key in cache:
        return cache[key]

    safe, protected = protect_markup(text)
    if not safe.strip():
        return text

    translated_chunks: list[str] = []
    chunks = re.split(r"(\n\s*\n)", safe)
    for chunk in chunks:
        if not chunk.strip():
            translated_chunks.append(chunk)
            continue
        if len(chunk) <= 1800:
            translated_chunks.append(argostranslate.translate.translate(chunk, "en", target))
            continue

        sentences = re.split(r"(?<=[.!?])\s+", chunk)
        current = ""
        for sentence in sentences:
            if len(current) + len(sentence) + 1 > 1500 and current:
                translated_chunks.append(argostranslate.translate.translate(current, "en", target))
                current = sentence
            else:
                current = f"{current} {sentence}".strip()
        if current:
            translated_chunks.append(argostranslate.translate.translate(current, "en", target))

    result = restore_markup("".join(translated_chunks), protected)
    cache[key] = result
    return result


def translate_body(body: str, target: str, cache: dict[tuple[str, str], str]) -> str:
    lines = body.splitlines(keepends=True)
    output: list[str] = []
    for line in lines:
        ending = "\n" if line.endswith("\n") else ""
        content = line[:-1] if ending else line
        if not content.strip():
            output.append(line)
            continue
        output.append(translate_text(content, target, cache) + ending)
    return "".join(output)


def install_models() -> None:
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}

    for target in LANGUAGES:
        if ("en", target) in installed:
            continue
        package = next((p for p in available if p.from_code == "en" and p.to_code == target), None)
        if package is None:
            raise RuntimeError(f"No Argos model found for en->{target}")
        print(f"Installing Argos model: en->{target}")
        package.install()


def translate_file(source_path: Path, target: str) -> None:
    source = source_path.read_text(encoding="utf-8")
    front, body = split_front_matter(source)

    if yaml_scalar(front, "language") not in ("", "en"):
        return

    group = yaml_scalar(front, "translation_group")
    source_slug = yaml_scalar(front, "slug")
    if not group or not source_slug:
        print(f"Skipping {source_path}: missing translation_group or slug")
        return

    output_path = source_path.parent / f"{source_slug}-{target}.md"
    if output_path.exists():
        print(f"Already exists, skipping: {output_path}")
        return

    print(f"Translating {source_path} -> {target}")
    cache: dict[tuple[str, str], str] = {}
    translated_front = front

    for key in FIELD_KEYS:
        value = yaml_scalar(front, key)
        if value:
            translated_front = replace_scalar(
                translated_front, key, translate_text(value, target, cache)
            )

    for key in LIST_KEYS:
        match = re.search(rf"(?ms)^{re.escape(key)}:\n(?:  - .*\n?)+", front)
        if match:
            values = [
                v.strip().strip('"').strip("'")
                for v in re.findall(r"(?m)^  - (.*)$", match.group(0))
            ]
            translated = [translate_text(v, target, cache) for v in values]
            translated_front = replace_simple_list(translated_front, key, translated)

    def translate_faq_q(match):
        value = match.group(2).strip().strip('"')
        return match.group(1) + " " + yaml_quote(translate_text(value, target, cache))

    def translate_faq_a(match):
        value = match.group(2).strip().strip('"')
        return match.group(1) + " " + yaml_quote(translate_text(value, target, cache))

    translated_front = re.sub(
        r"(?m)^(\s*- q:)\s*(.*)$",
        translate_faq_q,
        translated_front,
    )
    translated_front = re.sub(
        r"(?m)^(\s*a:)\s*(.*)$",
        translate_faq_a,
        translated_front,
    )

    translated_front = replace_scalar(translated_front, "language", target)
    translated_front = replace_scalar(translated_front, "source_language", "en")
    translated_front = replace_scalar(translated_front, "translation_group", group)
    translated_front = replace_scalar(translated_front, "translation_status", "in_review")
    translated_front = replace_scalar(translated_front, "slug", f"{source_slug}-{target}")

    related = yaml_scalar(front, "related_ebook_slug")
    if related:
        translated_front = replace_scalar(translated_front, "related_ebook_slug", f"{related}-{target}")

    translated_body = translate_body(body, target, cache)
    output_path.write_text(
        "---\n" + translated_front.rstrip() + "\n---\n" + translated_body.lstrip(),
        encoding="utf-8",
    )
    print(f"Created {output_path}")


def main() -> None:
    files = changed_source_files()
    if not files:
        print("No English Blog/eBook source files changed.")
        return

    install_models()
    for path in files:
        if path.exists():
            for target in LANGUAGES:
                translate_file(path, target)


if __name__ == "__main__":
    main()
