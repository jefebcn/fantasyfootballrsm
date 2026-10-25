#!/usr/bin/env python3
"""
Futsal: calendario, distinte ed eventi dal sito della FSGC.

Stessa fonte e stesse pagine del calcio (scripts/importa-fsgc.py), con due
differenze che semplificano:
  - niente Transfermarkt: il listone nasce dalle distinte stesse, e ogni
    giocatore ha l'id della sua scheda FSGC (/it/giocatore/<nome>/<id>), che
    distingue gli omonimi («A. Ercolani» sono due persone in due squadre);
  - niente cambi: la FSGC mette tutti i convocati sotto «Titolari» e non
    registra chi entra. Si salva la distinta intera (FUTSAL.md § 2).

Produce src/futsal-dati.js. Da rilanciare dopo ogni giornata (lun-gio):

    python3 scripts/importa-futsal.py
"""
import importlib.util, json, re, sys, time, pathlib
from collections import Counter

RADICE = pathlib.Path(__file__).resolve().parent.parent
CAMPIONATO = 'https://www.fsgc.sm/it/campionato/campionato-sammarinese-di-futsal/4'
PAUSA = 2.0

# prendi(), stato_partita() e finita() sono quelli del calcio: stesso sito,
# stessi tentativi, stessa regola sul «Concluso».
_spec = importlib.util.spec_from_file_location('fsgc', RADICE / 'scripts' / 'importa-fsgc.py')
fsgc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fsgc)

CLUB = {
    'Folgore': 'folgore', 'Murata': 'murata', 'Juvenes Dogana': 'juvenes', 'Juvenes-Dogana': 'juvenes',
    'Faetano': 'faetano', 'Fiorentino': 'fiorentino', 'Cailungo': 'cailungo', 'Domagnano': 'domagnano',
    'Cosmos': 'cosmos', 'Libertas': 'libertas', 'San Giovanni': 'sangiovanni', 'Tre Penne': 'trepenne',
    'Tre Fiori': 'trefiori', 'Pennarossa': 'pennarossa', 'Virtus': 'virtus', 'La Fiorita': 'lafiorita',
}
RUOLI_FSGC = ('Portiere', 'Centrale', 'Laterale', 'Universale', 'Pivot')
EVENTI = {'Gol': 'goal', 'Gol (Rig.)': 'goal', 'Autogol': 'own_goal', 'Rigore Sbagliato': 'pen_missed',
          'Assist': 'assist', 'Ammonizione': 'yellow', 'Espulsione': 'red'}


def club(nome):
    return CLUB.get(re.sub(r'\s*Futsal\s*$', '', nome.strip()))


def calendario():
    from bs4 import BeautifulSoup
    s = BeautifulSoup(fsgc.prendi(CAMPIONATO), 'lxml')
    fuori = []
    for t in s.select('table'):
        if 'Squadra in Casa' not in ' '.join(x.get_text(' ', strip=True) for x in t.select('tr')[:1]):
            continue
        prev = t.find_previous(string=re.compile(r'Giornata\s*\d+'))
        m = re.search(r'Giornata\s*(\d+)', str(prev)) if prev else None
        if not m:
            continue
        for tr in t.select('tr'):
            tds = tr.find_all('td')
            if len(tds) < 5 or tds[0].get_text(strip=True) == 'Data':
                continue
            c = [re.sub(r'\s+', ' ', x.get_text(' ', strip=True)) for x in tds]
            casa, osp = club(c[1]), club(c[3])
            if not (casa and osp):
                print(f'  ATTENZIONE: società sconosciuta: {c[1]} / {c[3]}', file=sys.stderr)
                continue
            ris = re.match(r'^(\d+)\s*-\s*(\d+)$', c[2].strip())
            q = re.match(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}:\d{2})', c[0])
            # ora legale fino all'ultima domenica di ottobre, poi solare
            iso = None
            if q:
                gg, mm, aa = int(q.group(1)), int(q.group(2)), int(q.group(3))
                iso = f'{aa}-{mm:02d}-{gg:02d}T{q.group(4)}:00{fuso(aa, mm, gg)}'
            a = tr.select_one('a[href*="/it/partita/"]')
            fuori.append({'g': int(m.group(1)), 'casa': casa, 'ospite': osp, 'quando': iso,
                          'impianto': None if c[4] in ('TBD', '') else c[4],
                          'gc': int(ris.group(1)) if ris else None, 'go': int(ris.group(2)) if ris else None,
                          'url': a['href'] if a else None})
    return fuori


def fuso(aa, mm, gg):
    """+02:00 con l'ora legale europea, +01:00 senza (cambi l'ultima domenica di marzo e di ottobre)."""
    from datetime import date, timedelta
    def ultima_domenica(mese):
        d = date(aa, mese, 31)
        return d - timedelta(days=(d.weekday() + 1) % 7)
    return '+02:00' if ultima_domenica(3) <= date(aa, mm, gg) < ultima_domenica(10) else '+01:00'


def id_giocatore(a):
    """'/it/giocatore/bucci-daniele/1243' -> ('f1243', 'bucci-daniele')."""
    slug, num = a['href'].rstrip('/').split('/it/giocatore/')[-1].rsplit('/', 1)
    return f'f{num}', slug


def nome_completo(slug, abbreviato):
    """
    Il referto scrive «M. De Angelis», la scheda «de-angelis-marco». Il cognome
    si prende dal referto, che ha le maiuscole giuste; il nome è quello che
    resta dello slug.
    """
    cognome = re.sub(r'^[A-Z]\.\s*', '', abbreviato).strip()
    resto = slug.split('-')
    for w in re.split(r"[\s']+", cognome.lower()):
        if w in resto:
            resto.remove(w)
    return ' '.join(w.capitalize() for w in resto), cognome


def tabellino(url, squadre):
    from bs4 import BeautifulSoup
    html = fsgc.prendi(url)
    s = BeautifulSoup(html, 'lxml')
    tab = s.select('.tab-pane')
    distinte, giocatori, ignote = [[], []], {}, Counter()
    if len(tab) > 1:
        t = tab[1].select_one('table')
        for tr in (t.select('tr') if t else []):
            # Quattro celle: [numero casa, giocatore casa, giocatore ospite,
            # numero ospite]. Il lato si legge dalla CELLA, non dall'ordine dei
            # link: quando una distinta è più corta dell'altra, nelle ultime
            # righe c'è un link solo, e contarlo come «primo = casa» metteva
            # gli ospiti in più nella squadra di casa (Lotti della Virtus,
            # 2ª giornata, finito nella distinta della Murata).
            tds = tr.find_all('td')
            if len(tds) != 4:
                continue
            for lato, cella, num in ((0, tds[1], tds[0]), (1, tds[2], tds[3])):
                a = cella.select_one('a[href*="/it/giocatore/"]')
                if not a:
                    continue
                pid, slug = id_giocatore(a)
                testo = cella.get_text(' ', strip=True)
                ruolo = next((r for r in RUOLI_FSGC if r in testo), None)
                numero = re.search(r'\d+', num.get_text(' ', strip=True))
                nome, cognome = nome_completo(slug, a.get_text(' ', strip=True))
                distinte[lato].append(pid)
                giocatori[pid] = {'club': squadre[lato], 'nome': nome, 'cognome': cognome, 'ruolo': ruolo,
                                  'numero': int(numero.group()) if numero else None}
    eventi = []
    if tab:
        t = tab[0].select_one('table')
        for tr in (t.select('tr') if t else []):
            tds = tr.find_all('td')
            if len(tds) != 3:
                continue
            mm = re.search(r"(\d+)'(?:\s*\+\s*(\d+)')?", tds[1].get_text(' ', strip=True))
            if not mm:
                continue
            minuto = int(mm.group(1)) + (int(mm.group(2)) if mm.group(2) else 0)
            for lato, td in ((0, tds[0]), (1, tds[2])):
                for blocco in td.find_all('div', recursive=False):
                    link = blocco.select('a[href*="/it/giocatore/"]')
                    if not link:
                        continue
                    et = blocco.find('span')
                    etichetta = re.sub(r'\s+', ' ', et.get_text(' ', strip=True)) if et else ''
                    tipo = EVENTI.get(etichetta)
                    if not tipo:
                        ignote[etichetta] += 1
                        continue
                    pid, _ = id_giocatore(link[0])
                    eventi.append([pid, minuto, tipo])
    return {'stato': fsgc.stato_partita(html), 'distinte': distinte, 'eventi': eventi,
            'giocatori': giocatori, 'ignote': dict(ignote)}


def main():
    cal = calendario()
    giocate = [p for p in cal if p['gc'] is not None and p['url']]
    print(f'calendario futsal: {len(cal)} partite, {len({p["g"] for p in cal})} giornate, {len(giocate)} giocate')
    f = RADICE / 'data' / 'futsal-tabellini.json'
    fatti = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    ora = time.time()
    for i, p in enumerate(giocate, 1):
        k = f"{p['g']}:{p['casa']}:{p['ospite']}"
        if not fsgc.da_riscaricare(fatti.get(k), p['quando'], ora):
            continue
        try:
            t = tabellino(p['url'], (p['casa'], p['ospite']))
        except Exception as e:
            print(f'  [{i}/{len(giocate)}] {k}: ERRORE {e}', file=sys.stderr)
            continue
        if not fsgc.finita(p['quando'], t['stato'], ora):
            print(f'  [{i}/{len(giocate)}] {k}: in corso, aspetto il fischio finale')
            p['gc'] = p['go'] = None
            fatti.pop(k, None)
            continue
        t['finita'] = True
        fatti[k] = t
        gol = sum(1 for e in t['eventi'] if e[2] in ('goal', 'own_goal'))
        avviso = '' if gol == p['gc'] + p['go'] else '  <-- gol diversi dal risultato'
        print(f"  [{i}/{len(giocate)}] {p['casa']}–{p['ospite']} (g{p['g']}) {p['gc']}-{p['go']}: "
              f"distinte {len(t['distinte'][0])}+{len(t['distinte'][1])}, {len(t['eventi'])} eventi{avviso}")
        if t['ignote']:
            print(f"      voci sconosciute: {t['ignote']}")
        f.write_text(json.dumps(fatti, ensure_ascii=False), encoding='utf-8')
        time.sleep(PAUSA)
    # le partite tornate «in corso» escono dai risultati
    for p in cal:
        if p['gc'] is not None and f"{p['g']}:{p['casa']}:{p['ospite']}" not in fatti:
            p['gc'] = p['go'] = None
    f.write_text(json.dumps(fatti, ensure_ascii=False), encoding='utf-8')
    scrivi(cal, fatti)


def scrivi(cal, fatti):
    # Listone: chi è comparso almeno una volta in distinta. Ruolo = quello che
    # la FSGC gli dà più spesso (3 su 201 cambiano fra una partita e l'altra).
    # in ordine di giornata: chi cambia squadra resta in listone con l'ultima
    ruoli, info, presenze = {}, {}, Counter()
    for _, t in sorted(fatti.items(), key=lambda x: int(x[0].split(':')[0])):
        for pid, g in t['giocatori'].items():
            info[pid] = g
            presenze[pid] += 1
            if g['ruolo']:
                ruoli.setdefault(pid, Counter())[g['ruolo']] += 1
    righe_g = []
    for pid in sorted(info, key=lambda x: (info[x]['club'], info[x]['cognome'], info[x]['nome'])):
        g = info[pid]
        ruolo = ruoli[pid].most_common(1)[0][0] if pid in ruoli else None
        righe_g.append('  [%s,%s,%s,%s,%s,%s]' % (json.dumps(pid), json.dumps(g['club']), json.dumps(g['nome']),
                                                 json.dumps(g['cognome']), json.dumps(ruolo),
                                                 'null' if g['numero'] is None else g['numero']))
    righe_c = ['  [%d,%s,%s,%s,%s,%s,%s]' % (
        p['g'], json.dumps(p['casa']), json.dumps(p['ospite']), json.dumps(p['quando']), json.dumps(p['impianto']),
        'null' if p['gc'] is None else p['gc'], 'null' if p['go'] is None else p['go']) for p in cal]
    righe_r = []
    for k, t in sorted(fatti.items(), key=lambda x: (int(x[0].split(':')[0]), x[0])):
        g, casa, ospite = k.split(':')
        righe_r.append('  {g:%s,casa:%s,ospite:%s,distinte:%s,eventi:%s}' % (
            g, json.dumps(casa), json.dumps(ospite), json.dumps(t['distinte']), json.dumps(t['eventi'])))
    (RADICE / 'src' / 'futsal-dati.js').write_text(
        '/**\n'
        ' * Campionato Sammarinese di Futsal: calendario, listone e referti.\n'
        ' *\n'
        ' * GENERATO da scripts/importa-futsal.py — non modificare a mano.\n'
        ' * Fonte: FSGC. Rilanciare dopo ogni giornata (lunedì-giovedì).\n'
        ' *\n'
        ' * CALENDARIO: [giornata, casa, ospite, inizioISO, impianto, golCasa, golOspite]\n'
        ' * GIOCATORI:  [id, club, nome, cognome, ruoloFSGC, numero]  (id = scheda FSGC)\n'
        ' * REFERTI:    distinte: [convocati casa, convocati ospiti] · eventi: [id, minuto, tipo]\n'
        ' */\n'
        f'export const GIORNATE = {len({p["g"] for p in cal})};\n'
        'export const CALENDARIO = [\n%s,\n];\n' % ',\n'.join(righe_c) +
        'export const GIOCATORI = [\n%s,\n];\n' % ',\n'.join(righe_g) +
        'export const REFERTI = [\n%s,\n];\n' % ',\n'.join(righe_r), encoding='utf-8')
    print(f'\nscritto src/futsal-dati.js — {len(cal)} partite, {len(info)} giocatori, {len(fatti)} referti')
    # listone e chiusure anche per il database (supabase/migrations/futsal-02-dati.sql)
    import subprocess
    subprocess.run(['node', str(RADICE / 'scripts' / 'genera-futsal-sql.mjs')], check=True)


if __name__ == '__main__':
    main()
