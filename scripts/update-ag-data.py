#!/usr/bin/env python3
"""GoOrganicAfrica agricultural data monitor.

Official-source discovery is automatic. Candidate changes are stored for review
rather than silently overwriting live calculator values. This protects the site
from unit/region/table changes in government spreadsheets.
"""
from __future__ import annotations
import csv, io, json, re, zipfile, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'config/ag-data-sources.json'
PENDING=ROOT/'data/ag-data/pending'
NBS_PAGE='https://microdata.nigerianstat.gov.ng/index.php/catalog/162/related-materials'
ALIASES={'maize':['maize','corn'],'beans':['beans','cowpea'],'rice':['rice'],'cassava':['cassava'],'yam':['yam'],'groundnut':['groundnut','peanut'],'soybean':['soybean','soya bean','soya']}

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'GoOrganicAfrica-DataBot/1.0'})
    with urllib.request.urlopen(req,timeout=45) as r:return r.read()

def latest_nbs_zip(html):
    links=re.findall(r'href=["\']([^"\']*?/download/\d+)["\']',html,re.I)
    if not links: raise RuntimeError('No NBS download link found on the official catalog page.')
    return urllib.parse.urljoin(NBS_PAGE,links[0])

def nbs_rows(blob):
    try: import openpyxl
    except ImportError: raise RuntimeError('openpyxl is required')
    z=zipfile.ZipFile(io.BytesIO(blob)); names=[n for n in z.namelist() if n.lower().endswith(('.xlsx','.xlsm'))]
    if not names: raise RuntimeError('No Excel workbook found in NBS archive.')
    with z.open(names[0]) as f:
        wb=openpyxl.load_workbook(f,data_only=True,read_only=True)
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True): yield ws.title,[str(v).strip() if v is not None else '' for v in row]

def candidates_from_nbs():
    page=get(NBS_PAGE).decode('utf-8','ignore'); url=latest_nbs_zip(page); rows=list(nbs_rows(get(url))); out=[]
    for cid,aliases in ALIASES.items():
        for sheet,vals in rows:
            text=' | '.join(vals).lower()
            if any(a in text for a in aliases):
                nums=[]
                for i,v in enumerate(vals):
                    x=v.replace(',','').replace(' ','')
                    if re.fullmatch(r'[-+]?\d+(?:\.\d+)?',x): nums.append({'column_index':i,'value':float(x)})
                if nums:
                    out.append({'commodity_id':cid,'country':'NG','data_type':'commodity_price','source':'National Bureau of Statistics (Nigeria) — Selected Food Price Watch','source_url':NBS_PAGE,'download_url':url,'sheet':sheet,'matched_row':vals,'numeric_cells':nums,'retrieved_at':datetime.now(timezone.utc).isoformat(),'status':'needs_review','reason':'Verify the correct national-average price column and unit before publishing.'}); break
    return out

def candidates_from_seed_feeds(config):
    out=[]
    for src in config.get('sources',[]):
        if src.get('data_type')!='seed_price' or not src.get('url'): continue
        blob=get(src['url']); text=blob.decode('utf-8-sig','ignore')
        rows=[]
        if src['url'].lower().endswith('.json') or text.lstrip().startswith(('{','[')):
            obj=json.loads(text); rows=obj if isinstance(obj,list) else obj.get('prices',[])
        else: rows=list(csv.DictReader(io.StringIO(text)))
        for r in rows:
            if not r.get('commodity_id') or not r.get('price'): continue
            out.append({'commodity_id':r['commodity_id'],'country':r.get('country',src.get('country','NG')),'data_type':'seed_price','variety':r.get('variety',''),'brand':r.get('brand',''),'pack_size':r.get('pack_size',''),'price':float(str(r['price']).replace(',','')),'unit':r.get('unit',''),'source':src.get('publisher','Configured seed-price source'),'source_url':src['url'],'retrieved_at':datetime.now(timezone.utc).isoformat(),'status':'needs_review'})
    return out

def main():
    PENDING.mkdir(parents=True,exist_ok=True); config=json.loads(CONFIG.read_text())
    candidates=[]; errors=[]
    try: candidates+=candidates_from_nbs()
    except Exception as e: errors.append({'source':'NBS Selected Food Price Watch','error':str(e)})
    try: candidates+=candidates_from_seed_feeds(config)
    except Exception as e: errors.append({'source':'configured seed-price feeds','error':str(e)})
    stamp=datetime.now(timezone.utc); out=PENDING/f'ag-data-candidates-{stamp.strftime("%Y-%m")}.json'
    out.write_text(json.dumps({'generated_at':stamp.isoformat(),'candidates':candidates,'errors':errors},ensure_ascii=False,indent=2)+'\n')
    print(f'Created {out}: {len(candidates)} candidates, {len(errors)} source errors')
if __name__=='__main__': main()
