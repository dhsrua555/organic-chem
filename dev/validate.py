"""이름 → 구조 되돌리기 검사: 우리 이름을 OPSIN 으로 풀어 RDKit 정규 SMILES 로 원래 구조와 비교.
사용: python dev/validate.py dev/out/enum_*.tsv"""
import sys, subprocess, collections
from pathlib import Path
import jdk4py
from rdkit import Chem, RDLogger
RDLogger.DisableLog('rdApp.*')
JAR = Path(__file__).parent / 'tools' / 'opsin.jar'

rows = []
for f in sys.argv[1:]:
    for line in Path(f).read_text(encoding='utf-8').splitlines():
        subs, name, mb = line.split('\t')
        rows.append((Path(f).stem, subs, name, mb.replace('|', '\n')))
names = [r[2].replace('′', "'").replace('″', "''") for r in rows]
res = subprocess.run([str(jdk4py.JAVA), '-jar', str(JAR), '-osmi'], input='\n'.join(names) + '\n', capture_output=True, text=True, encoding='utf-8')
smis = res.stdout.split('\n')
bad = collections.Counter(); shown = 0; ok = 0; seen = {}
dup = []
for (src, subs, name, mb), smi in zip(rows, smis):
    ref = Chem.MolFromMolBlock(mb)
    want = Chem.MolToSmiles(ref) if ref else None
    got = None
    if smi.strip():
        m = Chem.MolFromSmiles(smi.strip())
        got = Chem.MolToSmiles(m) if m else None
    if want and got == want:
        ok += 1
        # 같은 이름이 서로 다른 구조에 붙었는지 / 같은 구조가 다른 이름을 받았는지
        if want in seen and seen[want] != name: dup.append((src, subs, name, seen[want]))
        seen.setdefault(want, name)
        continue
    kind = 'opsin-fail' if not got else 'mismatch'
    bad[kind] += 1
    if shown < 60 and ("methane" not in src or shown < 3):
        print(f'{kind:10s} {src} {subs:40s} {name}\n           want {want}\n           got  {got}')
        shown += 1
print(f'\n{ok} ok, {dict(bad)} of {len(rows)}')
print(f'same structure, different names: {len(dup)}')
for d in dup[:30]: print('  ', d)
