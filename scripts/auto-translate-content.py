#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOTS = (Path("src/blog/posts"), Path("src/ebooks"))
SETTINGS = Path("src/_data/translationSettings.json")
DEFAULT_LANGUAGES = ("fr", "ar", "pt", "sw")
CACHE_FILE = Path(".translation-cache.json")
FIELDS = ("title", "description", "meta_title", "meta_description", "tagline", "bonus", "category")
LISTS = ("audience", "benefits", "search_terms", "keywords")

BAD_ARTIFACTS = ("GOA_TOKEN","GoA TOKEN","GA TOKEN","BAR BAR","ENDGOA TOKEN","\\pos(","\\fnAdobe Arabic")

def load_settings():
    data = json.loads(SETTINGS.read_text(encoding="utf-8")) if SETTINGS.exists() else {}
    langs = tuple(x for x in data.get("target_languages", DEFAULT_LANGUAGES) if x in DEFAULT_LANGUAGES)
    return data, langs

def scalar(front, key):
    m = re.search(r"(?m)^" + re.escape(key) + r":\s*(.*)$", front)
    if not m: return ""
    v = m.group(1).strip()
    if len(v) >= 2 and v[0] in "'\"" and v[-1] == v[0]: v = v[1:-1]
    return v

def quote(v): return json.dumps(v, ensure_ascii=False)

def replace_scalar(front, key, value):
    p = r"(?m)^" + re.escape(key) + r":.*$"
    line = key + ": " + quote(value)
    return re.sub(p, line, front, count=1) if re.search(p, front) else front + "\n" + line

def split_front(source):
    m = re.match(r"^---\n([\s\S]*?)\n---\n([\s\S]*)$", source)
    if not m: raise ValueError("Invalid Markdown front matter")
    return m.group(1), m.group(2)

def source_files():
    files = []
    for root in ROOTS: files.extend(root.glob("*.md"))
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

    # The free Google endpoint can return 429 when requests arrive too quickly.
    # Use Retry-After when supplied, otherwise exponential backoff with jitter.
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
                # Small pacing delay prevents a successful burst from immediately
                # triggering the next rate limit.
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
    key = (target, chunk)
    if key in cache:
        return cache[key]
    result = _google_translate(chunk, target)
    # A short unchanged result can be a proper noun, acronym or technical term.
    # For a longer unchanged result, retry sentence-by-sentence before preserving it.
    if result.strip() == chunk.strip() and len(chunk.strip()) > 120:
        sentences = re.split(r"(?<=[.!?])\s+", chunk.strip())
        if len(sentences) > 1:
            result = "".join(_translate_chunk(s, target, cache) for s in sentences)
    cache[key] = result
    return result

PROTECTED_TOKEN_RE = re.compile(
    r"GoOrganicAfrica|(?:₦|NGN|\$|€|£|¥)?(?:\d{1,3}(?:[,\. ]\d{3})*(?:\.\d+)?|\d+(?:[\. ]\d+)?)(?:%|\s*(?:kg|g|mg|ml|L|ha|ac|acre|acres|tons?|tonnes?|days?|weeks?|hours?|minutes?|\$|€|£|¥|₦|NGN))?",
    re.I
)

def _translate_plain_text(text, target, cache):
    sentences = re.split(r"(?<=[.!?])(?=\s+|$)", text)
    chunks, current, max_chars = [], "", 3500
    for sentence in sentences:
        if not sentence: continue
        if current and len(current) + len(sentence) > max_chars:
            chunks.append(current); current = ""
        if len(sentence) > max_chars:
            words, piece = sentence.split(), ""
            for word in words:
                if piece and len(piece) + len(word) + 1 > max_chars:
                    chunks.append(piece); piece = ""
                piece += ("" if not piece else " ") + word
            if piece: chunks.append(piece)
        else:
            current += sentence
    if current: chunks.append(current)
    return "".join(_translate_chunk(c, target, cache) if c.strip() and re.search(r"[A-Za-z]", c) else c for c in chunks)

def translate_text(text, target, cache):
    if not text or not text.strip() or not re.search(r"[A-Za-z]", text): return text

    # Translate around protected tokens rather than inserting placeholders.
    # This prevents the translation service from changing currencies, figures,
    # measurements, percentages, or the GoOrganicAfrica brand.
    parts = PROTECTED_TOKEN_RE.split(text)
    matches = PROTECTED_TOKEN_RE.findall(text)
    translated_parts = []
    mi = 0
    for part in parts:
        if part:
            translated_parts.append(_translate_plain_text(part, target, cache) if re.search(r"[A-Za-z]", part) else part)
        if mi < len(matches):
            translated_parts.append(matches[mi])
            mi += 1
    translated = "".join(translated_parts)

    if target == "ar":
        def localise_num(match):
            return match.group(0).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))
        translated = re.sub(r"(?<![A-Za-z])\d+(?:[.,]\d+)?", localise_num, translated)

    return translated

def translate_markup(body, target, cache):
    inline = chr(96)
    pattern = re.compile(
        r"(<!--(?:.|\n)*?-->|<[^>]+>|https?://[^\s)\]<>\"']+|"
        r"\[[^\]]+\]\([^\)]+\)|" + re.escape(inline) + r"[^" + re.escape(inline) + r"]+" + re.escape(inline) + r"|"
        r"&(?:amp|lt|gt|quot|apos|nbsp);)", re.S)
    out = []
    for part in pattern.split(body):
        if not part: continue
        out.append(part if pattern.fullmatch(part) else translate_text(part, target, cache))
    return "".join(out)

def clean_check(text, path):
    for artifact in BAD_ARTIFACTS:
        if artifact in text: raise RuntimeError(f"Translation artifact '{artifact}' detected in {path}")

def translate_file(path, target, overwrite, status, cache):
    source = path.read_text(encoding="utf-8")
    front, body = split_front(source)
    if scalar(front, "language") not in ("", "en"): return
    group, slug = scalar(front, "translation_group"), scalar(front, "slug")
    if not group or not slug:
        print("Skipping missing translation metadata:", path); return
    output = path.parent / (slug + "-" + target + ".md")
    if output.exists() and not overwrite:
        existing = output.read_text(encoding="utf-8")
        try: clean_check(existing, output)
        except RuntimeError: print("Replacing corrupted translation:", output)
        else: return
    tf = front
    for key in FIELDS:
        value = scalar(front, key)
        if value: tf = replace_scalar(tf, key, translate_text(value, target, cache))
    for key in LISTS:
        pattern = r"(?ms)^" + re.escape(key) + r":\n(.*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:|\Z)"
        m = re.search(pattern, front)
        if not m: continue
        values = [line[4:].strip().strip("'\"") for line in m.group(1).splitlines() if re.match(r"^  - ", line)]
        block = key + ":\n" + "".join("  - " + quote(translate_text(v, target, cache)) + "\n" for v in values)
        tf = re.sub(pattern, block, tf, count=1)
    faq_pattern = r"(?ms)^faqs:\n(.*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:|\Z)"
    faq_match = re.search(faq_pattern, front)
    if faq_match:
        faq_lines = []
        for q, a in re.findall(r"(?m)^  - q: (.*)\n    a: (.*)$", faq_match.group(1)):
            faq_lines += ["  - q: " + quote(translate_text(q.strip().strip("'\""), target, cache)) + "\n",
                          "    a: " + quote(translate_text(a.strip().strip("'\""), target, cache)) + "\n"]
        tf = re.sub(faq_pattern, "faqs:\n" + "".join(faq_lines), tf, count=1)
    tf = replace_scalar(tf, "language", target)
    tf = replace_scalar(tf, "source_language", "en")
    tf = replace_scalar(tf, "translation_group", group)
    tf = replace_scalar(tf, "translation_status", status)
    tf = replace_scalar(tf, "slug", slug + "-" + target)
    related = scalar(front, "related_ebook_slug")
    if related: tf = replace_scalar(tf, "related_ebook_slug", related + "-" + target)
    translated_body = translate_markup(body, target, cache)
    if target != "en":
        translated_body = re.sub(
            r"/ebooks/([A-Za-z0-9-]+)(?=[/)\"'\s])",
            lambda m: "/ebooks/" + m.group(1) if m.group(1).endswith("-" + target) else "/ebooks/" + m.group(1) + "-" + target,
            translated_body)
    result = "---\n" + tf.rstrip() + "\n---\n" + translated_body.lstrip()
    clean_check(result, output)
    output.write_text(result, encoding="utf-8")
    print("Created/updated:", output)

def main():
    config, languages = load_settings()
    if not config.get("enabled", True) or not config.get("automatic_generation", True):
        print("Translation automation disabled."); return
    files = []
    for path in source_files():
        front, _ = split_front(path.read_text(encoding="utf-8"))
        if scalar(front, "language") in ("", "en"): files.append(path)
    print("English source files:", len(files))
    print("Target languages:", languages)
    if not files or not languages: return
    overwrite = bool(config.get("auto_update_existing_translations", True))
    status = config.get("mark_new_translations", "in_review")

    # Persist successful chunk translations between workflow runs. This is
    # especially important for the free Google endpoint because a rerun should
    # not immediately repeat hundreds of already-completed requests.
    cache = {}
    if CACHE_FILE.exists():
        try:
            raw = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            for key, value in raw.items():
                target, chunk = key.split("\\n", 1)
                cache[(target, chunk)] = value
            print("Loaded cached translations:", len(cache))
        except Exception as exc:
            print("Ignoring unreadable translation cache:", exc)

    def save_cache():
        serialised = {target + "\\n" + chunk: value for (target, chunk), value in cache.items()}
        tmp = CACHE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(serialised, ensure_ascii=False), encoding="utf-8")
        tmp.replace(CACHE_FILE)

    for path in files:
        for target in languages:
            translate_file(path, target, overwrite, status, cache)
            save_cache()

if __name__ == "__main__":
    main()
