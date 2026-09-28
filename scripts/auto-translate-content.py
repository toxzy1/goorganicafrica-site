
    # Detect newly introduced ASCII digit/letter collisions only.
    # Arabic and other scripts legitimately place letters next to numbers
    # (for example Arabic "و2"), so Unicode-letter matching creates false
    # positives. We only need to catch Latin/ASCII corruption such as
    # 300tonnes, 2024et, 35%protéines, while allowing source forms like 3rd/5th.
    collision_pattern = r"[A-Za-z]\d|\d[A-Za-z]|\d[%.,][A-Za-z]"
    source_compact = set(re.findall(collision_pattern, source_visible))
    translated_compact = re.findall(collision_pattern, translated_visible)
    bad = [x for x in translated_compact if x not in source_compact]
    if bad:
        raise RuntimeError(f"Number/word spacing corruption in {path} ({target}): {bad[:5]}")

def translate_file(path, target, overwrite, status, cache):
    source = path.read_text(encoding="utf-8")
    front, body = split_front(source)
    if scalar(front, "language") not in ("", "en"):