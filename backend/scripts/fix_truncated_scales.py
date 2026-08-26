import sys, os, json, re, argparse, statistics
sys.path.insert(0, '.')
sys.path.insert(0, os.path.dirname(os.path.abspath('.')))
from database import SessionLocal
from sqlalchemy import text
from pipeline_utils import parse_indonesian_number

import importlib, main
importlib.reload(main)
from main import _format_scaled_indo_number

def norm_table_key(name):
    if not name:
        return ''
    s = name
    s = re.sub(r'^Tabel\s+[\d.]+\s*-?\s*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\(Hal[^)]*\)', '', s)
    s = re.sub(r'\([^)]*\)', '', s)
    s = re.sub(r'\b(19|20)\d{2}\b', '', s)
    s = re.sub(r'\s+', ' ', s).strip().lower()
    s = re.sub(r'[^a-z0-9 ]', '', s)
    return s

def norm_header(h):
    if not h:
        return ''
    s = re.sub(r'\([^)]*\)', '', h)
    s = re.sub(r'[^a-z0-9 ]', '', h.lower())
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def norm_entity(e):
    if not e:
        return ''
    s = re.sub(r'[^a-z0-9 ]', '', str(e).lower())
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def parse(v):
    return parse_indonesian_number(str(v).strip())

def scale_value(raw, factor):
    n = parse(raw)
    if n is None:
        return raw
    scaled = n * factor
    return _format_scaled_indo_number(scaled)

def main_run(apply=False):
    db = SessionLocal()
    tables = db.execute(text(
        'SELECT id, document_id, table_name, headers, years, units FROM extracted_tables')).fetchall()
    groups = {}
    for t in tables:
        key = norm_table_key(t.table_name)
        if key:
            groups.setdefault(key, []).append(t)

    update_plan = []
    changes = []
    summary = []

    for key, tbls in groups.items():
        if len(tbls) < 2:
            continue
        docs_data = {}
        for t in tbls:
            headers = json.loads(t.headers) if t.headers else []
            if not headers:
                continue
            ent_hdr = headers[0]
            rows = db.execute(text('SELECT id, data FROM table_rows WHERE table_id=:tid'),
                              {'tid': t.id}).fetchall()
            recs = []
            for r in rows:
                d = json.loads(r.data)
                ek = norm_entity(d.get(ent_hdr, ''))
                if not ek:
                    continue
                recs.append({'row_id': r.id, 'ent': ek, 'data': d})
            docs_data[t.document_id] = {'headers': headers, 'recs': recs, 'tid': t.id}

        # all normalized value columns across docs in this group
        all_nh = set()
        for did, dd in docs_data.items():
            for h in dd['headers'][1:]:
                all_nh.add(norm_header(h))

        for nh in all_nh:
            # which docs have a column with this normalized header
            docs_with = {}
            for did, dd in docs_data.items():
                ah = [h for h in dd['headers'][1:] if norm_header(h) == nh]
                if ah:
                    docs_with[did] = ah
            if len(docs_with) < 2:
                continue
            # reference doc = largest median for this column
            ref_doc = None
            ref_med = None
            for did, ah in docs_with.items():
                vals = []
                for h in ah:
                    for x in docs_data[did]['recs']:
                        v = parse(x['data'].get(h, ''))
                        if v:
                            vals.append(v)
                if vals:
                    m = statistics.median(vals)
                    if ref_med is None or m > ref_med:
                        ref_med = m
                        ref_doc = did
            if ref_doc is None:
                continue
            ref_ah = docs_with[ref_doc][0]
            ref_ent_vals = {x['ent']: parse(x['data'].get(ref_ah, '')) for x in docs_data[ref_doc]['recs']}

            for did, ah_list in docs_with.items():
                if did == ref_doc:
                    continue
                doc_ah = ah_list[0]
                doc_ent_vals = {x['ent']: parse(x['data'].get(doc_ah, '')) for x in docs_data[did]['recs']}
                ratios = [ref_ent_vals[e] / doc_ent_vals[e]
                          for e in ref_ent_vals
                          if ref_ent_vals[e] and doc_ent_vals.get(e)]
                factor = None
                # Method 1: entity-paired (accurate)
                if len(ratios) >= 3:
                    med_ratio = statistics.median(ratios)
                    inb = sum(1 for r in ratios if 500 <= r <= 2000)
                    inbl = sum(1 for r in ratios if 0.0005 <= r <= 0.002)
                    if inb / len(ratios) >= 0.6:
                        factor = 1000.0
                    elif inbl / len(ratios) >= 0.6:
                        factor = 0.001
                # Method 2: column-median fallback vs ref
                if factor is None:
                    rvals = [v for v in ref_ent_vals.values() if v]
                    dvals = [v for v in doc_ent_vals.values() if v]
                    if len(rvals) >= 3 and len(dvals) >= 3:
                        cr = statistics.median(rvals) / statistics.median(dvals)
                        if 700 <= cr <= 1500:
                            factor = 1000.0
                        elif 0.00067 <= cr <= 0.00143:
                            factor = 0.001
                if factor is None:
                    continue
                # apply to all actual headers for this doc
                for ah in ah_list:
                    for x in docs_data[did]['recs']:
                        old = x['data'].get(ah, '')
                        new = scale_value(old, factor)
                        if new != old:
                            update_plan.append((x['row_id'], ah, old, new, docs_data[did]['tid'], did, factor))
                            changes.append({'row_id': x['row_id'], 'table_id': docs_data[did]['tid'], 'doc': did,
                                            'col': ah, 'old': old, 'new': new, 'factor': factor})
                summary.append({'table': key[:38], 'doc': did, 'ref': ref_doc,
                                'col': nh[:28], 'ratio': round(med_ratio, 2) if ratios else 0,
                                'factor': factor, 'pairs': len(ratios)})

    db.close()
    print(f'{"DRY-RUN" if not apply else "APPLY"} mode')
    print(f'Table groups scanned: {len(groups)}')
    print(f'Columns flagged: {len(set((s["table"], s["doc"], s["col"]) for s in summary))}')
    print(f'Total cell updates: {len(update_plan)}')
    from collections import Counter
    fc = Counter(round(c["factor"], 4) for c in changes)
    print(f'Factor distribution: {dict(fc)}')
    print('\nSample (first 20):')
    seen = set()
    for s in summary:
        k = (s['table'], s['doc'], s['col'])
        if k in seen:
            continue
        seen.add(k)
        print(f'  {s["table"]:36s}|doc{s["doc"]} vs ref{s["ref"]}|{s["col"]:26s}|ratio{s["ratio"]} x{s["factor"]} ({s["pairs"]}p)')
        if len(seen) >= 20:
            break

    log_path = r'D:\Kuliah\KP\project_bps_tasik\backend\truncated_fix_changelog.json'
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(changes, f, ensure_ascii=False, indent=2)
    print(f'\nChangelog: {log_path} ({len(changes)} entries)')

    if apply:
        db = SessionLocal()
        upd = 0
        skipped = 0
        for row_id, col, old, new, tid, doc, factor in update_plan:
            if factor != 1000.0:
                skipped += 1
                continue
            row = db.execute(text('SELECT data FROM table_rows WHERE id=:id'), {'id': row_id}).fetchone()
            if not row:
                continue
            data = json.loads(row.data)
            data[col] = new
            db.execute(text('UPDATE table_rows SET data=:d WHERE id=:id'),
                       {'d': json.dumps(data, ensure_ascii=False), 'id': row_id})
            upd += 1
            if upd % 500 == 0:
                db.commit()
        db.commit()
        db.close()
        print(f'\nApplied {upd} multiply updates. Skipped {skipped} divide cases.')
        try:
            main._clear_ttl_cache(["timeseries-anomalies"])
        except Exception:
            pass

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    main_run(apply=args.apply)
