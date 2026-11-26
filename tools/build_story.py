"""Small helper to write Stringboard story files from compact Python tables.

Usage: python3 tools/build_story.py   (writes site/data/<id>.json and an empty site/data/<id>-images.json if missing)

Each story module below defines:
  META   dict merged into the top of the file (id, title, type, parts/unit for sagas, background ...)
  STEPS  list of (position, title, text, keywords)
  CHARS  list of (id, name, role, first_step_index_or_position, facts) ; facts = [(position, text)]
         optional extra keys via a dict as 6th item: {'dead': pos, 'main': True, 'grp': True, 'note': True, 'rs': [(pos, role)]}
  LINKS  list of (a, b, position)
  COUPLES list of (a, b, position)
Positions are story positions (chapter / S*100+E / part*1000+n); they are turned into step indexes here,
always rounding *up* to the first step at or after the position so nothing appears early.
"""
import json, math, os, importlib.util, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'site', 'data')
MATCHER = {"model": "Xenova/all-MiniLM-L6-v2", "sizeMB": 23, "language": "English"}


def build(mod):
    steps = [{"ch": p, "title": t, "text": x, "kw": kw} for p, t, x, kw in mod.STEPS]
    pos = [s["ch"] for s in steps]
    assert pos == sorted(pos), mod.META["id"] + ': steps out of order'

    def idx(p):
        for i, q in enumerate(pos):
            if q >= p:
                return i
        raise SystemExit(f'{mod.META["id"]}: position {p} is after the last step')

    chars, ids = [], set()
    n = len(mod.CHARS)
    cols = max(4, math.ceil(math.sqrt(n * 1.2)))
    for k, row in enumerate(mod.CHARS):
        cid, name, role, first, facts = row[:5]
        extra = row[5] if len(row) > 5 else {}
        assert cid not in ids, cid
        ids.add(cid)
        c = {"id": cid, "n": name, "r": role, "a": idx(first),
             "x": 60 + (k % cols) * (980 // cols), "y": 40 + (k // cols) * 200,
             "f": [[idx(p), t] for p, t in facts]}
        if extra.get('main'): c['main'] = True
        if extra.get('grp'): c['grp'] = True
        if extra.get('note'): c['note'] = True
        if 'dead' in extra: c['dead'] = idx(extra['dead'])
        if 'rs' in extra: c['rs'] = [[idx(p), r] for p, r in extra['rs']]
        for p, t in facts:
            assert idx(p) >= c['a'], f'{cid}: fact before the card appears'
        chars.append(c)
    links = []
    for a, b, p in mod.LINKS:
        assert a in ids and b in ids, (a, b)
        links.append([a, b, idx(p)])
    couples = [[a, b, idx(p)] for a, b, p in getattr(mod, 'COUPLES', [])]
    for a, b, _ in couples:
        assert a in ids and b in ids, (a, b)
    out = dict(mod.META)
    out.update({"matcher": MATCHER, "steps": steps, "chars": chars, "links": links, "couples": couples})
    sid = mod.META['id']
    with open(os.path.join(DATA, sid + '.json'), 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    img = os.path.join(DATA, sid + '-images.json')
    if not os.path.exists(img):
        with open(img, 'w') as f:
            json.dump({"_help": f"Default card images for {mod.META['title']}. Put a direct https link to an image you have the right to use in 'url' (png, jpg, webp or svg). Leave it empty to show the silhouette. 'credit' is optional and is shown in the card panel. The ids match the 'chars' in {sid}.json.",
                       "images": {c['id']: {"url": "", "credit": ""} for c in chars}}, f, ensure_ascii=False, indent=2)
    print(sid, len(steps), 'steps', len(chars), 'cards', len(links), 'strings')


if __name__ == '__main__':
    for name in sorted(os.listdir(os.path.join(HERE, 'stories'))):
        if name.endswith('.py'):
            spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(HERE, 'stories', name))
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            build(m)
