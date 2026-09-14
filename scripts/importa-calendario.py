#!/usr/bin/env python3
"""
Calendario del Campionato Sammarinese da Transfermarkt.

Transfermarkt pubblica solo le giornate già disputate (a oggi 3 su 30), non
l'intera stagione. Quindi: le giornate vere vanno in testa così come sono —
accoppiamenti, date, orari e risultati — e le restanti vengono completate
attorno a quelle, in modo che ogni squadra incontri ogni altra due volte e
mai due volte nella stessa giornata.

Da rilanciare ogni settimana: le giornate che nel frattempo sono state
giocate smettono di essere generate e diventano reali.

Produce src/calendario-dati.js.
"""
import json, re, random, subprocess, sys, pathlib
from datetime import datetime, timedelta, timezone

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')
URL = 'https://www.transfermarkt.it/campionato-sammarinese/gesamtspielplan/wettbewerb/SMR1/saison_id/2026'
RADICE = pathlib.Path(__file__).resolve().parent.parent
GIORNATE = 30
TENTATIVI = 4
ROMA = timezone(timedelta(hours=2))          # ora legale italiana

# I nomi brevi che usa il calendario di Transfermarkt → i nostri id
CLUB = {
    'SS Folgore': 'folgore', 'Murata': 'murata', 'Juvenes-Dogana': 'juvenes',
    'Faetano': 'faetano', 'San Marino Ac.': 'academy', 'Fiorentino': 'fiorentino',
    'Cailungo': 'cailungo', 'Domagnano': 'domagnano', 'Cosmos': 'cosmos',
    'Libertas': 'libertas', 'San Giovanni': 'sangiovanni', 'Tre Penne': 'trepenne',
    'Tre Fiori': 'trefiori', 'Pennarossa': 'pennarossa', 'Virtus': 'virtus',
    'La Fiorita': 'lafiorita',
}
VENUES = ['Acquaviva', 'Serravalle', 'Domagnano', 'Montecchio', 'Dogana', 'Faetano', 'Fiorentino']


def prendi(url):
    ultimo = ''
    for t in range(TENTATIVI):
        r = subprocess.run(['curl', '-sS', '--fail', '-m', '40', '-A', UA,
                            '-H', 'Accept-Language: it-IT,it;q=0.9', url], capture_output=True)
        if r.returncode == 0:
            return r.stdout.decode('utf-8', 'replace')
        ultimo = r.stderr.decode()[:120]
        if t < TENTATIVI - 1:
            import time
            attesa = 15 * (2 ** t)
            print(f'  riprovo fra {attesa}s ({ultimo.strip()[-40:]})', flush=True)
            time.sleep(attesa)
    raise RuntimeError(f'calendario non scaricabile: {ultimo}')


def giornate_reali():
    from bs4 import BeautifulSoup
    s = BeautifulSoup(prendi(URL), 'lxml')
    fuori = {}
    for b in s.select('div.box'):
        t = b.select_one('.content-box-headline, h2')
        m = re.match(r'(\d+)\.Giornata', re.sub(r'\s+', ' ', t.get_text(' ', strip=True))) if t else None
        if not m:
            continue
        n = int(m.group(1)); quando = None
        for tr in b.select('table tr'):
            testo = re.sub(r'\s+', ' ', tr.get_text(' ', strip=True))
            dm = re.search(r'(\d{2}/\d{2}/\d{2})\s+(\d{2}:\d{2})', testo)
            if dm:
                quando = (dm.group(1), dm.group(2))
            sq = [a for a in tr.select('a[href*="/verein/"]') if a.get_text(strip=True)]
            if len(sq) < 2:
                continue
            casa, ospite = sq[0].get_text(strip=True), sq[-1].get_text(strip=True)
            if casa not in CLUB or ospite not in CLUB:
                print(f'  ATTENZIONE: società sconosciuta: {casa} / {ospite}', file=sys.stderr)
                continue
            # Il risultato sta nel link al referto: nel testo della riga ci sarebbe
            # anche l'orario, che un \d+:\d+ scambierebbe per un punteggio.
            gc = go = None
            ref = tr.select_one('a[href*="/spielbericht/"]')
            if ref:
                rm = re.match(r'^\s*(\d+):(\d+)\s*$', ref.get_text(strip=True))
                if rm:
                    gc, go = int(rm.group(1)), int(rm.group(2))
            iso = None
            if quando:
                d = datetime.strptime(f'{quando[0]} {quando[1]}', '%d/%m/%y %H:%M').replace(tzinfo=ROMA)
                iso = d.isoformat()
            fuori.setdefault(n, []).append([CLUB[casa], CLUB[ospite], iso, gc, go])
    return dict(sorted(fuori.items()))


def completa(fissate, squadre, seed):
    """
    Le restanti giornate attorno a quelle vere. Si accoppia sempre per prima la
    squadra con meno avversarie ancora disponibili: senza questo accorgimento
    l'ultimo accoppiamento di una giornata resta spesso impossibile.
    """
    rnd = random.Random(seed)
    restanti = {(a, b) for a in squadre for b in squadre if a != b}
    turni = []
    for blocco in fissate:
        for a, b in blocco:
            restanti.discard((a, b))
        turni.append(list(blocco))
    for _ in range(GIORNATE - len(fissate)):
        liberi = set(squadre); turno = []
        candidati = sorted(restanti); rnd.shuffle(candidati)
        while liberi:
            t = min(liberi, key=lambda s: sum(1 for (a, b) in candidati
                                              if (a == s or b == s) and a in liberi and b in liberi))
            opzioni = [(a, b) for (a, b) in candidati if (a == t or b == t) and a in liberi and b in liberi]
            if not opzioni:
                return None
            scelta = opzioni[0]
            turno.append(scelta); liberi.discard(scelta[0]); liberi.discard(scelta[1])
            candidati.remove(scelta)
        for p in turno:
            restanti.discard(p)
        turni.append(turno)
    return turni if not restanti else None


def main():
    reali = giornate_reali()
    print(f'giornate vere da Transfermarkt: {len(reali)} ({", ".join(map(str, reali))})')
    for n, v in reali.items():
        giocate = sum(1 for x in v if x[3] is not None)
        print(f'  giornata {n}: {len(v)} partite, {giocate} con risultato')
    squadre = sorted(CLUB.values())
    fissate = [sorted((a, b) for a, b, *_ in reali[n]) for n in sorted(reali)]
    for seed in range(500):
        turni = completa(fissate, squadre, seed)
        if turni:
            break
    else:
        raise SystemExit('nessun girone valido: controlla le giornate vere')

    tutte = [p for t in turni for p in t]
    assert len(tutte) == len(set(tutte)) == 240, 'girone irregolare'
    for i, t in enumerate(turni, 1):
        sq = [x for p in t for x in p]
        assert len(t) == 8 and len(set(sq)) == 16, f'giornata {i} irregolare'

    # date: quelle vere dove ci sono, poi si prosegue di sabato in sabato
    ultima = max((datetime.fromisoformat(x[2]) for v in reali.values() for x in v if x[2]), default=None)
    righe = []
    for n, turno in enumerate(turni, 1):
        veri = {(a, b): (iso, gc, go) for a, b, iso, gc, go in reali.get(n, [])}
        for i, (casa, ospite) in enumerate(turno):
            iso, gc, go = veri.get((casa, ospite), (None, None, None))
            if not iso:
                sab = (ultima + timedelta(days=7 * (n - len(reali)))).replace(hour=15, minute=0, second=0, microsecond=0)
                iso = (sab + timedelta(days=i % 2, hours=(i % 3) * 2)).isoformat()
            # Il campo non è nel calendario di Transfermarkt. Sulle giornate vere si
            # lascia vuoto invece di inventarlo: sarebbe l'unico dato finto in mezzo
            # a dati reali, e nessuno potrebbe distinguerlo.
            campo = None if n <= len(reali) else VENUES[(n + i) % len(VENUES)]
            righe.append('  [%d,%s,%s,%s,%s,%s,%s]' % (
                n, json.dumps(casa), json.dumps(ospite), json.dumps(iso),
                json.dumps(campo), 'null' if gc is None else gc, 'null' if go is None else go))

    testo = ('/**\n'
             ' * Calendario del Campionato Sammarinese.\n'
             ' *\n'
             ' * GENERATO da scripts/importa-calendario.py — non modificare a mano.\n'
             ' * Le prime %d giornate sono quelle VERE (accoppiamenti, date, orari e\n'
             ' * risultati da Transfermarkt); le altre completano il girone di andata e\n'
             ' * ritorno, perché la stagione non è ancora pubblicata per intero.\n'
             ' * Rilanciare lo script ogni settimana: le giornate giocate diventano vere.\n'
             ' *\n'
             ' * Forma: [giornata, casa, ospite, calcioInizioISO, campo, golCasa, golOspite]\n'
             ' */\n'
             'export const GIORNATE_REALI = %d;\n'
             'export const CALENDARIO = [\n%s,\n];\n') % (len(reali), len(reali), ',\n'.join(righe))
    f = RADICE / 'src' / 'calendario-dati.js'
    f.write_text(testo, encoding='utf-8')
    print(f'\nscritto {f.relative_to(RADICE)} — {len(righe)} partite su {GIORNATE} giornate, '
          f'{len(reali)} vere')


if __name__ == '__main__':
    main()
