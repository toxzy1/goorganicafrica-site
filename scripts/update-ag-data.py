#!/usr/bin/env python3
"""GoOrganicAfrica agricultural data monitor.

The monitor is deliberately conservative: it can collect machine-readable data
from configured government, market and relevant-agency sources, but uncertain
changes are stored as candidates for review instead of silently overwriting the
live calculator. This makes the system scalable across countries and protects
against changed units, columns, varieties, regions and currencies.
"""
from __future__ import annotations
import csv, io, json, re, zipfile, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'config/ag-data-sources.json'
PENDING = ROOT / 'data/ag-data/pending'
NBS_PAGE = 'https://microdata.nigerianstat.gov.ng/index.php/catalog/162/related-materials'
ALIASES = {
    'maize': ['maize', 'corn'], 'beans': ['beans', 'cowpea'], 'rice': ['rice'],
    'cassava': ['cassava'], 'yam': ['yam'], 'groundnut': ['groundnut', 'peanut'],
    'soybean': ['soybean', 'soya bean', 'soya']
}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'GoOrganicAfrica-DataBot/2.0'})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def latest_nbs_zip(html: str) -> str:
    links = re.findall(r'href=["\']([^"\']*?/download/\d+)["\']', html, re.I)
    if not links:
        raise RuntimeError('No NBS download link found on the official catalog page.')
    return urllib.parse.urljoin(NBS_PAGE, links[0])


def nbs_rows(blob: bytes):
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError('openpyxl is required')
    z = zipfile.ZipFile(io.BytesIO(blob))
    names = [n for n in z.namelist() if n.lower().endswith(('.xlsx', '.xlsm'))]
    if not names:
        raise RuntimeError('No Excel workbook found in NBS archive.')
    with z.open(names[0]) as f:
        wb = openpyxl.load_workbook(f, data_only=True, read_only=True)
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                yield ws.title, [str(v).strip() if v is not None else '' for v in row]


def candidates_from_nbs():
    page = get(NBS_PAGE).decode('utf-8', 'ignore')
    url = latest_nbs_zip(page)
    rows = list(nbs_rows(get(url)))
    out = []
    for cid, aliases in ALIASES.items():
        for sheet, vals in rows:
            text = ' | '.join(vals).lower()
            if any(a in text for a in aliases):
                nums = []
                for i, v in enumerate(vals):
                    x = v.replace(',', '').replace(' ', '')
                    if re.fullmatch(r'[-+]?\d+(?:\.\d+)?', x):
                        nums.append({'column_index': i, 'value': float(x)})
                if nums:
                    out.append({
                        'commodity_id': cid, 'country': 'NG', 'data_type': 'commodity_price',
                        'source_type': 'government',
                        'source': 'National Bureau of Statistics (Nigeria) — Selected Food Price Watch',
                        'source_url': NBS_PAGE, 'download_url': url, 'sheet': sheet,
                        'matched_row': vals, 'numeric_cells': nums,
                        'retrieved_at': datetime.now(timezone.utc).isoformat(),
                        'status': 'needs_review',
                        'reason': 'Verify the correct national-average price column and unit before publishing.'
                    })
                    break
    return out


def read_machine_feed(url: str):
    blob = get(url)
    text = blob.decode('utf-8-sig', 'ignore')
    if url.lower().endswith('.json') or text.lstrip().startswith(('{', '[')):
        obj = json.loads(text)
        return obj if isinstance(obj, list) else obj.get('prices', obj.get('data', []))
    return list(csv.DictReader(io.StringIO(text)))


def candidates_from_configured_feeds(config):
    out = []
    supported = {'csv_json_feed', 'json_feed', 'csv_feed'}
    for src in config.get('sources', []):
        url = (src.get('url') or '').strip()
        if not url or src.get('method') not in supported:
            continue
        rows = read_machine_feed(url)
        for row in rows:
            if not isinstance(row, dict):
                continue
            commodity_id = row.get('commodity_id') or row.get('commodity') or row.get('enterprise_id')
            country = row.get('country') or src.get('country')
            price = row.get('price') or row.get('price_expected') or row.get('value')
            if not commodity_id or price in (None, '') or not country:
                continue
            try:
                numeric_price = float(str(price).replace(',', ''))
            except ValueError:
                continue
            out.append({
                'commodity_id': str(commodity_id),
                'country': str(country),
                'region': row.get('region') or src.get('region', ''),
                'data_type': row.get('data_type') or src.get('data_type'),
                'source_type': src.get('source_type', 'market'),
                'publisher': src.get('publisher', ''),
                'source': src.get('publisher', 'Configured source'),
                'source_url': src.get('url'),
                'variety': row.get('variety', ''),
                'brand': row.get('brand', ''),
                'pack_size': row.get('pack_size', ''),
                'price': numeric_price,
                'unit': row.get('unit', ''),
                'as_of': row.get('as_of') or row.get('date') or '',
                'retrieved_at': datetime.now(timezone.utc).isoformat(),
                'status': 'needs_review',
                'reason': 'Validate source, unit, geography, period and mapping before publication.'
            })
    return out


def main():
    PENDING.mkdir(parents=True, exist_ok=True)
    config = json.loads(CONFIG.read_text())
    candidates, errors = [], []
    try:
        candidates += candidates_from_nbs()
    except Exception as e:
        errors.append({'source': 'NBS Selected Food Price Watch', 'error': str(e)})
    try:
        candidates += candidates_from_configured_feeds(config)
    except Exception as e:
        errors.append({'source': 'configured machine-readable feeds', 'error': str(e)})

    stamp = datetime.now(timezone.utc)
    out = PENDING / f'ag-data-candidates-{stamp.strftime("%Y-%m")}.json'
    out.write_text(json.dumps({
        'generated_at': stamp.isoformat(),
        'candidate_count': len(candidates),
        'candidates': candidates,
        'errors': errors
    }, ensure_ascii=False, indent=2) + '\n')
    print(f'Created {out}: {len(candidates)} candidates, {len(errors)} source errors')


if __name__ == '__main__':
    main()
