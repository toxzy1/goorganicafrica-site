#!/usr/bin/env python3
"""Conservative directory monitor.

Checks approved machine-readable sources and records candidates for human review.
It does not publish directory listings automatically.
"""
from __future__ import annotations
import csv, io, json, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/directory-sources.json"
PENDING = ROOT / "data/directories/pending"

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "GoOrganicAfrica-DirectoryBot/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()

def read_feed(url: str, method: str):
    blob = get(url)
    text = blob.decode("utf-8-sig", "ignore")
    if method == "json_feed" or text.lstrip().startswith(("{", "[")):
        obj = json.loads(text)
        return obj if isinstance(obj, list) else obj.get("listings", obj.get("data", []))
    return list(csv.DictReader(io.StringIO(text)))

def main():
    PENDING.mkdir(parents=True, exist_ok=True)
    config = json.loads(CONFIG.read_text())
    candidates, errors = [], []
    for src in config.get("sources", []):
        if src.get("status") != "active" or src.get("method") not in {"json_feed", "csv_feed"}:
            continue
        try:
            rows = read_feed(src.get("url", ""), src.get("method"))
            for row in rows:
                if not isinstance(row, dict):
                    continue
                title = row.get("title") or row.get("name")
                if not title:
                    continue
                candidates.append({
                    "action": "review",
                    "category": row.get("category") or src.get("category"),
                    "country": row.get("country") or src.get("country"),
                    "title": str(title),
                    "official_source": src.get("publisher", ""),
                    "source_url": src.get("url", ""),
                    "verification_date": row.get("verification_date") or row.get("date") or "",
                    "status": "needs_review",
                    "reason": "Validate programme status, eligibility, geography and source before publication.",
                    "notes": ""
                })
        except Exception as exc:
            errors.append({"source": src.get("id"), "error": str(exc)})
    stamp = datetime.now(timezone.utc)
    out = PENDING / f"directory-candidates-{stamp.strftime('%Y-%m-%d-%H%M%S')}.json"
    out.write_text(json.dumps({
        "title": f"Directory review queue — {stamp.strftime('%Y-%m-%d %H:%M UTC')}",
        "generated_at": stamp.isoformat(),
        "candidate_count": len(candidates),
        "candidates": candidates,
        "errors": errors
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"Created {out}: {len(candidates)} candidates, {len(errors)} source errors")

if __name__ == "__main__":
    main()
