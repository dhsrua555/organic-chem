"""표본을 PubChem IUPAC 이름과 나란히 놓고 본다 (표기 관례 확인용, 초당 4회 이하)."""
import sys, json, time, random, urllib.request, urllib.parse
from pathlib import Path
from rdkit import Chem, RDLogger
RDLogger.DisableLog('rdApp.*')
random.seed(7)
rows = []
for f in sys.argv[2:]:
    for line in [l for l in Path(f).read_text(encoding="utf-8").splitlines() if not l.startswith("#")]:
        subs, name, mb = line.split('\t')
        if subs.count(':') <= 2: rows.append((name, mb.replace('|', '\n')))
seen = {}; 
for name, mb in rows:
    m = Chem.MolFromMolBlock(mb); s = Chem.MolToSmiles(m)
    seen.setdefault(s, name)
items = list(seen.items()); random.shuffle(items)
n = int(sys.argv[1]); same = diff = miss = 0
for smi, name in items[:n]:
    url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/IUPACName/JSON?smiles=' + urllib.parse.quote(smi)
    try:
        d = json.load(urllib.request.urlopen(url, timeout=20))
        pc = d['PropertyTable']['Properties'][0].get('IUPACName')
    except Exception as e:
        pc = None
    time.sleep(0.3)
    if not pc: miss += 1; continue
    if pc == name: same += 1
    else: diff += 1; print(f'{name:55s} | {pc}')
print(f'same {same}, differ {diff}, not in PubChem {miss}')
