#!/usr/bin/env python3
"""Conservative agricultural directory monitor with cadence and change detection."""
from __future__ import annotations
import csv, hashlib, io, json, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/directory-sources.json"
COVERAGE = ROOT / "config/directory-country-coverage.json"
PENDING = ROOT / "data/directories/pending"
STATE = PENDING / "directory-monitor-state.json"
FREQUENCY_HOURS = {"daily": 24, "weekly": 168, "monthly": 720}

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "GoOrganicAfrica-DirectoryBot/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()

def read_feed(url: str, method: str):
    blob = get(url)
    value = blob.decode("utf-8-sig", "ignore")
    if method == "json_feed" or value.lstrip().startswith(("{", "[")):
        obj = json.loads(value)
        return obj if isinstance(obj, list) else obj.get("listings", obj.get("data", []))
    return list(csv.DictReader(io.StringIO(value)))

def main():
    PENDING.mkdir(parents=True, exist_ok=True)
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    coverage = json.loads(COVERAGE.read_text(encoding="utf-8")) if COVERAGE.exists() else {"countries": []}
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {"sources": {}}
    source_state = state.setdefault("sources", {})
    stamp = datetime.now(timezone.utc)
    latest = PENDING / "directory-candidates-latest.json"
    try:
        old_queue = json.loads(latest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        old_queue = {}
    unresolved = {c.get("source_id"): c for c in old_queue.get("candidates", [])
                  if c.get("source_id") and c.get("status") == "needs_review"}
    candidates, errors = [], []
    active_sources = [s for s in config.get("sources", []) if s.get("status") == "active"]
    country_names = {c.get("name"): c for c in coverage.get("countries", []) if c.get("active", True)}
    exact_source_countries = {s.get("country") for s in active_sources if s.get("country") and s.get("country") != "MULTI"}
    coverage_summary = {
        "target_country_count": len(country_names),
        "countries_with_country_specific_source": sorted(n for n in country_names if n in exact_source_countries),
        "countries_without_country_specific_source": sorted(n for n in country_names if n not in exact_source_countries),
        "multi_country_source_count": sum(1 for s in active_sources if s.get("country") == "MULTI")
    }
    for src in active_sources:
        sid, method = src.get("id", ""), src.get("method")
        previous = source_state.get(sid, {})
        interval = FREQUENCY_HOURS.get(src.get("frequency", "weekly"), 168)
        last = previous.get("last_checked")
        if last:
            try:
                if stamp - datetime.fromisoformat(last.replace("Z", "+00:00")) < timedelta(hours=interval):
                    continue
            except (ValueError, TypeError):
                pass
        try:
            if method in {"json_feed", "csv_feed"}:
                rows = read_feed(src.get("url", ""), method)
                raw = json.dumps(rows, sort_keys=True, ensure_ascii=False).encode("utf-8")
                digest = hashlib.sha256(raw).hexdigest()[:16]
                changed = previous.get("fingerprint") != digest
                source_state[sid] = {"fingerprint": digest, "last_checked": stamp.isoformat()}
                if changed:
                    for row in rows:
                        if not isinstance(row, dict):
                            continue
                        title = row.get("title") or row.get("name")
                        if not title:
                            continue
                        candidates.append({
                            "source_id": sid, "action": "review",
                            "category": row.get("category") or src.get("category"),
                            "country": row.get("country") or src.get("country"),
                            "title": str(title), "official_source": src.get("publisher", ""),
                            "source_url": src.get("url", ""),
                            "verification_date": row.get("verification_date") or row.get("date") or stamp.date().isoformat(),
                            "status": "needs_review",
                            "reason": "Feed is new or changed. Verify programme status, eligibility, geography and source before publication.",
                            "notes": ""
                        })
            elif method == "official_page_review":
                raw = get(src.get("url", ""))
                digest = hashlib.sha256(raw).hexdigest()[:16]
                changed = previous.get("fingerprint") != digest
                source_state[sid] = {"fingerprint": digest, "last_checked": stamp.isoformat()}
                if changed:
                    candidates.append({
                        "source_id": sid, "action": "review", "category": src.get("category"),
                        "country": src.get("country"), "title": f"Review official source: {src.get('publisher')}",
                        "official_source": src.get("publisher", ""), "source_url": src.get("url", ""),
                        "verification_date": stamp.date().isoformat(), "status": "needs_review",
                        "reason": "Official page is new or its content changed. Check for new, changed or expired programmes before updating public listings.",
                        "notes": f"Source content fingerprint: {digest}"
                    })
        except Exception as exc:
            errors.append({"source": sid, "error": str(exc)})
    for candidate in candidates:
        unresolved[candidate["source_id"]] = candidate
    queue = sorted(unresolved.values(), key=lambda c: (str(c.get("country", "")), str(c.get("official_source", ""))))
    payload_obj = {
        "title": f"Directory review queue — {stamp.strftime('%Y-%m-%d %H:%M UTC')}",
        "generated_at": stamp.isoformat(), "candidate_count": len(queue), "candidates": queue,
        "errors": errors, "coverage_summary": coverage_summary
    }
    STATE.write_text(json.dumps({"updated_at": stamp.isoformat(), "sources": source_state}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    payload = json.dumps(payload_obj, ensure_ascii=False, indent=2) + "\n"
    if latest.exists():
        try:
            old = json.loads(latest.read_text(encoding="utf-8"))
            old["generated_at"], old["title"] = payload_obj["generated_at"], payload_obj["title"]
            if old == payload_obj:
                print(f"No queue changes; {len(queue)} unresolved review candidates, {len(errors)} source errors.")
                return
        except (json.JSONDecodeError, OSError):
            pass
    out = PENDING / f"directory-candidates-{stamp.strftime('%Y-%m-%d-%H%M%S')}.json"
    out.write_text(payload, encoding="utf-8")
    latest.write_text(payload, encoding="utf-8")
    print(f"Updated review queue: {len(queue)} unresolved candidates, {len(candidates)} changed-source candidates, {len(errors)} source errors.")

if __name__ == "__main__":
    main()
