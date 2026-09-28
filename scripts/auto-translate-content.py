#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOTS = (Path("src/blog/posts"), Path("src/ebooks"))
SETTINGS = Path("src/_data/translationSettings.json")
DEFAULT_LANGUAGES = ("fr", "ar", "pt", "sw")
CACHE_FILE = Path(".translation-cache.json")
CACHE_VERSION = "v3"
FIELDS = ("title", "description", "meta_title", "meta_description", "tagline", "bonus", "category")
LISTS = ("audience", "benefits", "search_terms", "keywords")

BAD_ARTIFACTS = (
    "GOA_TOKEN", "GoA TOKEN", "GA TOKEN", "BAR BAR", "ENDGOA TOKEN",
    "\\pos(", "\\fnAdobe Arabic"
)

LANGUAGE_NAMES = {
    "fr": "French", "ar": "Arabic", "pt": "Portuguese", "sw": "Swahili",
}

GLOSSARY = {
    "fr": {
        r"\bscene\s+(\d+)\b": r"Étape \1",
        r"\bscène\s+(\d+)\b": r"Étape \1",
        r"\bvaccination\b": "inoculation",
        r"\bvacciner\b": "inoculer",
        r"\bflushes?\b": "récoltes successives",
        r"\bflush\b": "récolte",
    },
    "ar": {
        r"\bscene\s+(\d+)\b": r"الخطوة \1",
        r"\bscène\s+(\d+)\b": r"الخطوة \1",
        r"\bvaccination\b": "التلقيح",
        r"\bvacciner\b": "تلقيح",
        r"\bflushes?\b": "دفعات الحصاد",
        r"\bflush\b": "دفعة الحصاد",
    },
    "pt": {
        r"\bscene\s+(\d+)\b": r"Etapa \1",
        r"\bscène\s+(\d+)\b": r"Etapa \1",
        r"\bvaccination\b": "inoculação",
        r"\bvacciner\b": "inocular",
        r"\bflushes?\b": "colheitas sucessivas",
        r"\bflush\b": "colheita",
    },
    "sw": {
        r"\bscene\s+(\d+)\b": r"Hatua \1",
        r"\bscène\s+(\d+)\b": r"Hatua \1",
        r"\bvaccination\b": "uchanjaji",
        r"\bvacciner\b": "chanja",
        r"\bflushes?\b": "mawimbi ya mavuno",
        r"\bflush\b": "wimbi la mavuno",
    },
}

def load_settings():
    data = json.loads(SETTINGS.read_text(encoding="utf-8")) if SETTINGS.exists() else {}
    raw = data.get("target_languages", DEFAULT_LANGUAGES)
    langs = []
    for value in raw:
        code = str(value).strip().lower()
        if code and code != "en" and re.fullmatch(r"[a-z]{2,5}(?:-[a-z]{2,5})?", code) and code not in langs:
            langs.append(code)
    return data, tuple(langs or DEFAULT_LANGUAGES)

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

def _google_translate(text, target):
    import random
    import time
    from urllib.error import HTTPError
    from urllib.parse import quote
    from urllib.request import Request, urlopen

    url = ("https://translate.googleapis.com/translate_a/single"
           "?client=gtx&sl=en&tl=" + quote(target) + "&dt=t&q=" + quote(text))
    last_error = None
    for attempt in range(7):
        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json,text/plain,*/*",
            })
            with urlopen(req, timeout=45) as response:
                data = json.loads(response.read().decode("utf-8"))
            result = "".join(
                part[0] for part in data[0]
                if isinstance(part, list) and part and isinstance(part[0], str)
            )
            if result.strip():
                time.sleep(0.8)
                return result
            raise RuntimeError("Google returned an empty translation")
        except HTTPError as exc:
            last_error = exc
            retryable = exc.code == 429 or 500 <= exc.code < 600
            if not retryable or attempt == 6:
                break
            retry_after = exc.headers.get("Retry-After")
            try:
                delay = float(retry_after) if retry_after else min(90, 5 * (2 ** attempt))
            except (TypeError, ValueError):
                delay = min(90, 5 * (2 ** attempt))
            delay += random.uniform(0.5, 2.0)
            print(f"Google HTTP {exc.code} for {target}; retrying in {delay:.1f}s...")
            time.sleep(delay)
        except Exception as exc:
            last_error = exc
            if attempt == 6:
                break
            delay = min(30, 3 * (2 ** attempt)) + random.uniform(0.5, 1.5)
            print(f"Google translation error for {target}; retrying in {delay:.1f}s: {exc}")
            time.sleep(delay)
    raise RuntimeError(f"Google translation failed for {target}: {last_error}")

def _translate_chunk(chunk, target, cache):
    key = (CACHE_VERSION, target, chunk)
    if key in cache:
        return cache[key]
    result = _google_translate(chunk, target)
    if result.strip() == chunk.strip() and len(chunk.strip()) > 120:
        sentences = re.split(r"(?<=[.!?])\s+", chunk.strip())
        if len(sentences) > 1:
            result = "".join(_translate_chunk(s, target, cache) for s in sentences)
    cache[key] = result
    return result

# Protect numbers themselves, but NEVER protect English unit words such as
# "days", "weeks", "hours", or "tonnes". The translation engine must translate
# those words naturally in every target language.
NUMBER_RE = re.compile(
    r"(?<![A-Za-z])(?:\d{1,3}(?:[,\. ]\d{3})+|\d+(?:[\.,]\d+)?)"
)
BRAND_RE = re.compile(r"GoOrganicAfrica", re.I)
PLACEHOLDER_RE = re.compile(r"__GOA_(?:NUM|BRAND)_\d+__")

def _protect(text):
    values = []
    def num(m):
        values.append(m.group(0))
        return f"__GOA_NUM_{len(values)-1}__"
    protected = NUMBER_RE.sub(num, text)
    def brand(m):
        values.append(m.group(0))
        return f"__GOA_BRAND_{len(values)-1}__"
    protected = BRAND_RE.sub(brand, protected)
    return protected, values

def _restore(text, values):
    for i, value in enumerate(values):
        text = text.replace(f"__GOA_NUM_{i}__", value)
        text = text.replace(f"__GOA_BRAND_{i}__", value)
    return text

def _translate_plain_text(text, target, cache):
    if not text or not re.search(r"[A-Za-z]", text):
        return text
    protected, values = _protect(text)
    sentences = re.split(r"(?<=[.!?])(?=\s+|$)", protected)
    chunks, current, max_chars = [], "", 3500
    for sentence in sentences:
        if not sentence:
            continue
        if current and len(current) + len(sentence) > max_chars:
            chunks.append(current)
            current = ""
        if len(sentence) > max_chars:
            words, piece = sentence.split(), ""
            for word in words:
                if piece and len(piece) + len(word) + 1 > max_chars:
                    chunks.append(piece)
                    piece = ""
                piece += ("" if not piece else " ") + word
            if piece:
                chunks.append(piece)
        else:
            current += sentence
    if current:
        chunks.append(current)
    translated = "".join(
        _translate_chunk(c, target, cache) if c.strip() and re.search(r"[A-Za-z]", c) else c
        for c in chunks
    )
    return _restore(translated, values)

def translate_text(text, target, cache):
    return _translate_plain_text(text, target, cache) if text and re.search(r"[A-Za-z]", text) else text

def _translate_markdown_link(match, target, cache):
    prefix, label, destination = match.group(1), match.group(2), match.group(3)
    return prefix + translate_text(label, target, cache) + "](" + destination + ")"

def translate_markup(body, target, cache):
    # Translate visible Markdown link/image labels and preserve destinations.
    link_pattern = re.compile(r"(!?\[)([^\]]+)\]\(([^)]+)\)")
    parts = []
    last = 0
    for m in link_pattern.finditer(body):
        parts.append(translate_markup_plain(body[last:m.start()], target, cache))
        parts.append(_translate_markdown_link(m, target, cache))
        last = m.end()
    parts.append(translate_markup_plain(body[last:], target, cache))
    return "".join(parts)

def translate_markup_plain(text, target, cache):
    inline = chr(96)
    pattern = re.compile(
        r"(<!--(?:.|\n)*?-->|<[^>]+>|https?://[^\s)\]<>\"']+|"
        + re.escape(inline) + r"[^" + re.escape(inline) + r"]+" + re.escape(inline) + r"|"
        r"&(?:amp|lt|gt|quot|apos|nbsp);)", re.S)
    out = []
    for part in pattern.split(text):
        if not part:
            continue
        out.append(part if pattern.fullmatch(part) else translate_text(part, target, cache))
    return "".join(out)

def apply_glossary(text, target):
    for pattern, replacement in GLOSSARY.get(target, {}).items():
        text = re.sub(pattern, replacement, text, flags=re.I)
    return text

def numeric_signature(text):
    return Counter(NUMBER_RE.findall(text))

def url_signature(text):
    return Counter(re.findall(r"https?://[^\s)\]<>\"']+", text))

def tag_signature(text):
    return Counter(re.findall(r"</?[A-Za-z][^>]*>", text))

def quality_check(source, translated, path, target):
    for artifact in BAD_ARTIFACTS:
        if artifact in translated:
            raise RuntimeError(f"Translation artifact '{artifact}' detected in {path}")
    if numeric_signature(source) != numeric_signature(translated):
        raise RuntimeError(f"Numeric values changed or lost in {path} ({target})")
    if url_signature(source) != url_signature(translated):
        raise RuntimeError(f"URL changed or lost in {path} ({target})")
    if tag_signature(source) != tag_signature(translated):
        raise RuntimeError(f"HTML tags changed or lost in {path} ({target})")
    # Catch the exact class of spacing corruption seen in the previous drafts.
    if re.search(r"[A-Za-zÀ-ÿ]\d", translated) or re.search(r"\d[A-Za-zÀ-ÿ]", translated):
        compact = re.findall(r"[A-Za-zÀ-ÿ]\d|\d[A-Za-zÀ-ÿ]", translated)
        allowed = {"F1", "F2", "B2B", "H2", "H3", "H4", "CO2"}
        bad = [x for x in compact if x not in allowed]
        if bad:
            raise RuntimeError(f"Number/word spacing corruption in {path} ({target}): {bad[:5]}")

def translate_file(path, target, overwrite, status, cache):
    source = path.read_text(encoding="utf-8")
    front, body = split_front(source)
    if scalar(front, "language") not in ("", "en"):
        return False
    group, slug = scalar(front, "translation_group"), scalar(front, "slug")
    if not group or not slug:
        print("Skipping missing translation metadata:", path)
        return False
    output = path.parent / (slug + "-" + target + ".md")
    if output.exists() and not overwrite:
        return False

    tf = front
    for key in FIELDS:
        value = scalar(front, key)
        if value:
            tf = replace_scalar(tf, key, apply_glossary(translate_text(value, target, cache), target))

    for key in LISTS:
        pattern = r"(?ms)^" + re.escape(key) + r":\n(.*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:|\Z)"
        m = re.search(pattern, front)
        if not m:
            continue
        values = [
            line[4:].strip().strip("'\"")
            for line in m.group(1).splitlines()
            if re.match(r"^  - ", line)
        ]
        block = key + ":\n" + "".join(
            "  - " + quote(apply_glossary(translate_text(v, target, cache), target)) + "\n"
            for v in values
        )
        tf = re.sub(pattern, block, tf, count=1)

    faq_pattern = r"(?ms)^faqs:\n(.*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:|\Z)"
    faq_match = re.search(faq_pattern, front)
    if faq_match:
        faq_lines = []
        for q, a in re.findall(r"(?m)^  - q: (.*)\n    a: (.*)$", faq_match.group(1)):
            faq_lines += [
                "  - q: " + quote(apply_glossary(translate_text(q.strip().strip("'\""), target, cache), target)) + "\n",
                "    a: " + quote(apply_glossary(translate_text(a.strip().strip("'\""), target, cache), target)) + "\n",
            ]
        tf = re.sub(faq_pattern, "faqs:\n" + "".join(faq_lines), tf, count=1)

    tf = replace_scalar(tf, "language", target)
    tf = replace_scalar(tf, "source_language", "en")
    tf = replace_scalar(tf, "translation_group", group)
    tf = replace_scalar(tf, "translation_status", status)
    tf = replace_scalar(tf, "slug", slug + "-" + target)

    related = scalar(front, "related_ebook_slug")
    if related:
        tf = replace_scalar(tf, "related_ebook_slug", related + "-" + target)

    translated_body = apply_glossary(translate_markup(body, target, cache), target)
    if target != "en":
        translated_body = re.sub(
            r"/ebooks/([A-Za-z0-9-]+)(?=[/)\"'\s])",
            lambda m: "/ebooks/" + m.group(1)
            if m.group(1).endswith("-" + target)
            else "/ebooks/" + m.group(1) + "-" + target,
            translated_body
        )

    result = "---\n" + tf.rstrip() + "\n---\n" + translated_body.lstrip()
    quality_check(source, result, output, target)
    output.write_text(result, encoding="utf-8")
    print("Created/updated:", output)
    return True

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

    overwrite = bool(config.get("auto_update_existing_translations", True))
    status = config.get("mark_new_translations", "in_review")

    cache = {}
    if CACHE_FILE.exists():
        try:
            raw = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            for key, value in raw.items():
                parts = key.split("\n", 2)
                if len(parts) == 3:
                    version, target, chunk = parts
                    if version == CACHE_VERSION:
                        cache[(version, target, chunk)] = value
            print("Loaded cached translations:", len(cache))
        except Exception as exc:
            print("Ignoring unreadable translation cache:", exc)

    def save_cache():
        serialised = {
            version + "\n" + target + "\n" + chunk: value
            for (version, target, chunk), value in cache.items()
        }
        tmp = CACHE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(serialised, ensure_ascii=False), encoding="utf-8")
        tmp.replace(CACHE_FILE)

    generated = 0
    for path in files:
        for target in languages:
            if translate_file(path, target, overwrite, status, cache):
                generated += 1
            save_cache()

    print(f"Generated/updated translation files: {generated}")
    print(f"Expected multilingual files: {len(files) * len(languages)}")

if __name__ == "__main__":
    main()
