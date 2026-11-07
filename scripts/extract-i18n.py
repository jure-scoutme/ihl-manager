# Zbere vsa slovenska besedila (UI t('...') in predloge iz motorja) v src/i18n/source.json
import re, glob, json
keys = []
def add(k):
    k = k.strip('\n')
    if k and k not in keys and re.search(r'[A-Za-zČŠŽčšž]', k): keys.append(k)

# 1) UI: t('...') klici
for f in glob.glob('src/app/**/*.tsx', recursive=True) + glob.glob('src/components/*.tsx'):
    s = open(f).read()
    for m in re.finditer(r"\bt\('((?:[^'\\]|\\.)*)'", s): add(m.group(1).replace("\\'", "'"))
    for m in re.finditer(r'\bt\("((?:[^"\\]|\\.)*)"', s): add(m.group(1))

# 1b) UI: ostali nizi in predloge (oznake, sporočila)
def tpl0(t):
    exprs = {}
    def rep(m):
        e = m.group(1)
        if e not in exprs: exprs[e] = len(exprs)
        return '{%d}' % exprs[e]
    return re.sub(r'\$\{((?:[^{}]|\{[^{}]*\})*)\}', rep, t)
CSS = re.compile(r"var\(--|px|solid|gradient|color-mix|rgba|repeat\(|1fr|ease|sans-serif|^/|\.(png|jpg|svg)|^use client$|toUpperCase|=>")
for f in glob.glob('src/app/**/*.tsx', recursive=True) + glob.glob('src/components/*.tsx'):
    s = open(f).read()
    for m in re.finditer(r"(?<![\w.])'((?:[^'\\\n])*)'|`([^`]*)`", s):
        t = m.group(1) if m.group(1) is not None else tpl0(m.group(2))
        if CSS.search(t) or not re.search(r'[a-zčšž]{3,}', t): continue
        if re.fullmatch(r'[a-z_\-]+', t): continue
        if not (' ' in t.strip() or re.search('[čšžČŠŽ]', t) or t[:1].isupper()): continue
        if re.search(r"[<>]|\{[a-z]", t) and not re.search(r"\{\d", t) and '{' in t and not re.search(r"\{\w+\}", t): continue
        add(t)

for f in glob.glob('src/app/**/*.tsx', recursive=True) + glob.glob('src/components/*.tsx'):
    for m in re.finditer(r'label="([^"]+)"', open(f).read()): add(m.group(1))

# 2) motor: predloge iz template literalov in slovenski nizi
def tpl(t):
    exprs = {}
    def rep(m):
        e = m.group(1)
        if e not in exprs: exprs[e] = len(exprs)
        return '{%d}' % exprs[e]
    return re.sub(r'\$\{((?:[^{}]|\{[^{}]*\})*)\}', rep, t)
for f in sorted(glob.glob('src/engine/*.ts')):
    if f.endswith(('types.ts', 'data.ts', 'rng.ts')): continue
    s = open(f).read()
    if f.endswith('press.ts'):
        for m in re.finditer(r"'((?:[^'\\]|\\.)*)'", s):
            t = m.group(1)
            if re.search(r'[a-zčšž]{3,}', t) and ' ' in t and not t.startswith('pre_') and not t.startswith('post_'): add(t)
        continue
    for m in re.finditer(r"`([^`]*)`|'((?:[^'\\]|\\.)*)'", s):
        t = m.group(1) if m.group(1) is not None else m.group(2)
        if not re.search(r'[a-zčšžA-ZČŠŽ]{3,}', t): continue
        if re.fullmatch(r'[a-zA-Z_\-]+', t) and not re.search(r'[čšž]', t):
            continue  # identifikatorji
        if m.group(1) is not None: t = tpl(t)
        if re.search(r'[a-zčšž]', t) and (' ' in t or re.search(r'[čšžČŠŽ]', t) or t[0].isupper()):
            add(t)

# 3) ročni dodatki (besede iz ternarnih izrazov in kratke oznake)
extra = ['Zmaga proti {0} {1}:{2}{3}', 'Poraz proti {0} {1}:{2}{3}', 'Obisk: {0} gledalcev. Streli: {1}:{2}.',
 ' po kazenskih strelih', ' po podaljšku', ' (3 na 3)', 'zadetek', 'zgreši', 'GOL! {0} {1}:{2}. {3}{4}{5}.', ', podaja {0}',
 'naslov', 'finale', 'polfinale', 'končnica', 'napadalni', 'uravnotezen', 'obrambni', 'spotikanje', 'oviranje', 'grobost', 'kavljanje',
 'Kazen: {0} ({1}), {2}, {3} min.', 'Konec {0}. tretjine: {1}:{2}', 'Drsanje', 'Strel', 'Podaja', 'Buliji', 'Pozicioniranje', 'Delavnost', 'Vodstvo', 'Agresivnost', 'Hitrost', 'Refleksi', 'Postavljanje',
 'Profesionalec', 'Ambiciozen', 'Temperamenten', 'Vodja', 'Individualist', 'Delaven', 'Nezanesljiv', 'Center', 'Levo krilo', 'Desno krilo', 'Branilec', 'Golman',
 'Vstopnice', 'Bar in dresi', 'Sponzorji', 'Potovanja', 'Odpravnine', 'Investicije', 'trening', 'mentor', 'profesionalnost', 'starost',
 'garderoba', 'uprava', 'liga', 'tekma', 'prestopi', 'mediji', 'klub', 'Tekma', 'Liga', 'Prestopi', 'Klub', 'Interes visok', 'Interes srednji', 'Interes nizek', 'Ne pride',
 'Hat-trick: {0}', '{0}. gol: {1}', '{0}. nastop: {1}', 'brez podaje', 'izjemen', 'visok', 'srednji', 'nizek']
for e in extra: add(e)
json.dump(keys, open('src/i18n/source.json', 'w'), ensure_ascii=False, indent=0)
print(len(keys))
