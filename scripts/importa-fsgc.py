#!/usr/bin/env python3
"""
Calendario, risultati, stadi, formazioni ed eventi dal sito della FSGC.

Perché qui e non da Transfermarkt: è la fonte autorevole, pubblica l'intero
calendario (26 giornate, non solo quelle giocate), riporta gli stadi veri e
la cronaca minuto per minuto con il link al giocatore — e non blocca per
indirizzo IP dopo quaranta richieste.

Due passaggi:
  1. la pagina del campionato (una richiesta) → calendario, risultati, stadi
  2. la pagina di ogni partita giocata → formazioni ed eventi

Produce src/calendario-dati.js e src/eventi-dati.js.
Da rilanciare ogni settimana. Salva a ogni partita e riprende da dove si è
interrotto, così un'interruzione non costa il lavoro già fatto.

    python3 scripts/importa-fsgc.py
"""
import json, re, subprocess, sys, time, unicodedata, pathlib

BASE = 'https://www.fsgc.sm'
CAMPIONATO = f'{BASE}/it/campionato/campionato-sammarinese/1'
RADICE = pathlib.Path(__file__).resolve().parent.parent
PAUSA = 2.0
TENTATIVI = 4

# I nomi con cui la FSGC chiama le società → i nostri id
CLUB = {
    'Folgore': 'folgore', 'Murata': 'murata', 'Juvenes-Dogana': 'juvenes', 'Juvenes Dogana': 'juvenes',
    'Faetano': 'faetano', 'San Marino Academy': 'academy', 'Fiorentino': 'fiorentino',
    'Cailungo': 'cailungo', 'Domagnano': 'domagnano', 'Cosmos': 'cosmos',
    'Libertas': 'libertas', 'San Giovanni': 'sangiovanni', 'Tre Penne': 'trepenne',
    'Tre Fiori': 'trefiori', 'Pennarossa': 'pennarossa', 'Virtus': 'virtus',
    'La Fiorita': 'lafiorita',
}
RUOLI = {'Portiere': 'P', 'Difensore': 'D', 'Centrocampista': 'C', 'Attaccante': 'A'}


def prendi(url):
    ultimo = ''
    for t in range(TENTATIVI):
        r = subprocess.run(['curl', '-sS', '--fail', '-L', '-m', '40', url], capture_output=True)
        if r.returncode == 0:
            return r.stdout.decode('utf-8', 'replace')
        ultimo = r.stderr.decode()[:120]
        if t < TENTATIVI - 1:
            time.sleep(5 * (2 ** t))
    raise RuntimeError(f'non scaricabile: {ultimo}')


def senza_accenti(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def chiavi(nome):
    """
    Due chiavi per lo stesso nome, perché le due fonti lo scrivono diverso:
    la FSGC usa a volte «cognome-nome» e a volte il contrario, e fonde o separa
    i cognomi composti («depaoli» contro «De Paoli», «dangeli» contro «D'Angeli»).
    La prima chiave è l'insieme ordinato delle parole, la seconda tutte le
    lettere di seguito: la seconda cattura quelle differenze di scrittura.
    """
    pulito = re.sub(r'[^a-z\s]', ' ', senza_accenti(str(nome)).lower())
    parole = [w for w in pulito.split() if w]
    return tuple(sorted(w for w in parole if len(w) > 1)), ''.join(sorted(''.join(parole)))


def calendario():
    from bs4 import BeautifulSoup
    s = BeautifulSoup(prendi(CAMPIONATO), 'lxml')
    fuori = []
    for t in s.select('table'):
        intestazione = ' '.join(x.get_text(' ', strip=True) for x in t.select('tr')[:1])
        if 'Squadra in Casa' not in intestazione or 'Stadio' not in intestazione:
            continue
        prev = t.find_previous(string=re.compile(r'Giornata\s*\d+'))
        m = re.search(r'Giornata\s*(\d+)', str(prev)) if prev else None
        if not m:
            continue
        g = int(m.group(1))
        for tr in t.select('tr'):
            tds = tr.find_all('td')
            if len(tds) < 5 or tds[0].get_text(strip=True) == 'Data':
                continue
            c = [re.sub(r'\s+', ' ', x.get_text(' ', strip=True)) for x in tds]
            casa, osp = CLUB.get(c[1]), CLUB.get(c[3])
            if not (casa and osp):
                print(f'  ATTENZIONE: società sconosciuta: {c[1]} / {c[3]}', file=sys.stderr)
                continue
            ris = re.match(r'^(\d+)\s*-\s*(\d+)$', c[2].strip())
            quando = re.match(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}:\d{2})', c[0])
            iso = (f'{quando.group(3)}-{quando.group(2)}-{quando.group(1)}T{quando.group(4)}:00+02:00'
                   if quando else None)
            a = tr.select_one('a[href*="/it/partita/"]')
            fuori.append({'g': g, 'casa': casa, 'ospite': osp, 'quando': iso,
                          'stadio': None if c[4] in ('TBD', '') else c[4],
                          'gc': int(ris.group(1)) if ris else None,
                          'go': int(ris.group(2)) if ris else None,
                          'url': a['href'] if a else None})
    return fuori


def tabellino(url, indice, squadre):
    """Formazioni ed eventi di una partita. indice: chiave nome → nostro id giocatore."""
    from bs4 import BeautifulSoup
    s = BeautifulSoup(prendi(url), 'lxml')
    tab = s.select('.tab-pane')
    mancanti = {}; etichette_ignote = {}

    def risolvi(a, club=None, ruolo=None):
        slug = a['href'].split('/it/giocatore/')[-1]
        nome = slug.rsplit('/', 1)[0]
        k1, k2 = chiavi(nome)
        # Prima si cerca dentro la società: fra sedici rose gli omonimi esistono,
        # dentro una sola quasi mai. Solo se lì non c'è si allarga a tutto il listone.
        for dove in ([indice['per_club'].get(club, {})] if club else []) + [indice['tutti']]:
            p = dove.get(k1) or dove.get(k2)
            if p:
                return p
        # Ultimo tentativo, solo dentro la società: le parole del referto tutte
        # contenute nel nostro nome. Copre i secondi nomi che una fonte riporta
        # e l'altra no («Brian Joel Ruiz» contro «ruiz-brian»).
        if club:
            cand = [(pk, pid) for pk, pid in indice['per_club'].get(club, {}).items()
                    if isinstance(pk, tuple) and set(k1) <= set(pk)]
            if len({pid for _, pid in cand}) == 1:
                return cand[0][1]
        mancanti[nome] = {'nome': nome, 'club': club, 'ruolo': ruolo}
        return None

    titolari = [[], []]
    if len(tab) > 1:
        t = tab[1].select_one('table')
        dentro_titolari = False
        for tr in (t.select('tr') if t else []):
            testo = tr.get_text(' ', strip=True)
            if 'Titolari' in testo:
                dentro_titolari = True
                continue
            if 'Panchina' in testo:
                dentro_titolari = False
                continue
            if not dentro_titolari:
                continue
            celle = [re.sub(r'\s+', ' ', x.get_text(' ', strip=True)) for x in tr.find_all('td')]
            for i, a in enumerate(tr.select('a[href*="/it/giocatore/"]')):
                lato = 0 if i == 0 else 1
                testo = celle[1] if (lato == 0 and len(celle) > 1) else (celle[2] if len(celle) > 2 else '')
                ruolo = next((v for k, v in RUOLI.items() if k in testo), None)
                p = risolvi(a, squadre[lato], ruolo)
                if p:
                    titolari[lato].append(p)

    eventi, cambi = [], []
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
                    icone = ' '.join(c for i in blocco.select('i') for c in (i.get('class') or []))
                    link = blocco.select('a[href*="/it/giocatore/"]')
                    testo = re.sub(r'\s+', ' ', blocco.get_text(' ', strip=True))
                    if 'fa-arrows-to-line' in icone and len(link) >= 2:
                        dentro, fuoriP = risolvi(link[0], squadre[lato]), risolvi(link[1], squadre[lato])
                        if dentro and fuoriP:
                            cambi.append([dentro, fuoriP, minuto])
                        continue
                    if not link:
                        continue
                    p = risolvi(link[0], squadre[lato])
                    if not p:
                        continue
                    et = blocco.find('span')
                    etichetta = re.sub(r'\s+', ' ', et.get_text(' ', strip=True)) if et else ''
                    tipo = {
                        'Autogol': 'own_goal', 'Rigore Sbagliato': 'pen_missed',
                        'Gol': 'goal', 'Gol (Rig.)': 'goal', 'Assist': 'assist',
                        'Espulsione': 'red_direct', 'Ammonizione': 'yellow',
                    }.get(etichetta)
                    if not tipo:
                        if etichetta:
                            etichette_ignote[etichetta] = etichette_ignote.get(etichetta, 0) + 1
                        continue
                    eventi.append([p, minuto, tipo])
    arb = s.find(string=re.compile(r'^\s*Arbitro\s*$'))
    arbitro = None
    if arb:
        riga = arb.find_parent('tr')
        succ = riga.find_next_sibling('tr') if riga else None
        if succ:
            arbitro = re.sub(r'\s+', ' ', succ.get_text(' ', strip=True)) or None
    return {'titolari': titolari, 'eventi': eventi, 'cambi': cambi,
            'arbitro': arbitro, 'mancanti': mancanti, 'ignote': etichette_ignote}


def indice_giocatori():
    """Chiavi nome → id nostro, dal listone reale; anche divise per società."""
    d = json.loads((RADICE / 'data' / 'listone.json').read_text(encoding='utf-8'))
    mappa = json.loads((RADICE / 'data' / 'mappa-giocatori.json').read_text(encoding='utf-8'))
    tutti, per_club = {}, {}
    for c in d['societa']:
        for g in c['giocatori']:
            nostro = mappa.get(g['tmId'])
            if not nostro:
                continue
            club = nostro.split('_')[0]
            for k in chiavi(g['nome']):
                tutti.setdefault(k, nostro)
                per_club.setdefault(club, {}).setdefault(k, nostro)
    # Gli extra della passata precedente: data.js li numera dopo i tesserati
    # Transfermarkt, società per società, nello stesso ordine. Senza indicizzarli
    # qui, i loro gol resterebbero senza marcatore a ogni riesecuzione.
    f = RADICE / 'data' / 'extra.json'
    if f.exists():
        coda = {}
        for c in d['societa']:
            club = None
            for g in c['giocatori']:
                nostro = mappa.get(g['tmId'])
                if nostro:
                    club = nostro.split('_')[0]
                    coda[club] = max(coda.get(club, 0), int(nostro.split('_')[1]))
        for e in json.loads(f.read_text(encoding='utf-8')):
            coda[e['club']] = coda.get(e['club'], 0) + 1
            nostro = f"{e['club']}_{coda[e['club']]}"
            for k in chiavi(e['slug']):
                tutti.setdefault(k, nostro)
                per_club.setdefault(e['club'], {}).setdefault(k, nostro)
    return {'tutti': tutti, 'per_club': per_club}


def main():
    idx = indice_giocatori()
    print(f"listone indicizzato: {len(idx['tutti'])} chiavi su {len(idx['per_club'])} società")
    cal = calendario()
    giocate = [x for x in cal if x['gc'] is not None and x['url']]
    print(f'calendario: {len(cal)} partite, {len({x["g"] for x in cal})} giornate, '
          f'{len(giocate)} già giocate')

    f = RADICE / 'data' / 'tabellini.json'
    fatti = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    tutti_mancanti = {}
    for i, p in enumerate(giocate, 1):
        k = f"{p['g']}:{p['casa']}:{p['ospite']}"
        if k in fatti:
            continue
        try:
            t = tabellino(p['url'], idx, (p['casa'], p['ospite']))
        except Exception as e:
            print(f"  [{i}/{len(giocate)}] {k}: ERRORE {e}", file=sys.stderr)
            continue
        fatti[k] = t
        f.write_text(json.dumps(fatti, ensure_ascii=False), encoding='utf-8')
        for nome, info in t['mancanti'].items():
            v = tutti_mancanti.setdefault(nome, {**info, 'volte': 0})
            v['volte'] += 1
            if info.get('ruolo') and not v.get('ruolo'):
                v['ruolo'] = info['ruolo']
        gol = sum(1 for e in t['eventi'] if e[2] in ('goal', 'own_goal'))
        print(f"  [{i}/{len(giocate)}] {p['casa']}–{p['ospite']} (g{p['g']})  "
              f"{len(t['eventi'])} eventi ({gol} gol, attesi {p['gc'] + p['go']}), "
              f"titolari {len(t['titolari'][0])}+{len(t['titolari'][1])}")
        time.sleep(PAUSA)

    if tutti_mancanti:
        print(f'\ngiocatori del referto non presenti nel listone: {len(tutti_mancanti)}')
        for n, v in sorted(tutti_mancanti.items(), key=lambda x: -x[1]['volte'])[:12]:
            print(f"   {v['volte']:>3} × {n} ({v.get('club') or '?'}, {v.get('ruolo') or 'ruolo ignoto'})")

    scrivi(cal, fatti, tutti_mancanti)


def scrivi(cal, fatti, mancanti=None):
    righe = []
    for p in cal:
        righe.append('  [%d,%s,%s,%s,%s,%s,%s]' % (
            p['g'], json.dumps(p['casa']), json.dumps(p['ospite']), json.dumps(p['quando']),
            json.dumps(p['stadio']), 'null' if p['gc'] is None else p['gc'],
            'null' if p['go'] is None else p['go']))
    giornate = len({p['g'] for p in cal})
    (RADICE / 'src' / 'calendario-dati.js').write_text(
        '/**\n'
        ' * Calendario del Campionato Sammarinese: quello vero, per intero.\n'
        ' *\n'
        ' * GENERATO da scripts/importa-fsgc.py — non modificare a mano.\n'
        ' * Fonte: FSGC, la federazione. Rilanciare ogni settimana.\n'
        ' *\n'
        ' * Forma: [giornata, casa, ospite, calcioInizioISO, stadio, golCasa, golOspite]\n'
        ' */\n'
        f'export const GIORNATE = {giornate};\n'
        'export const CALENDARIO = [\n%s,\n];\n' % ',\n'.join(righe), encoding='utf-8')
    print(f'\nscritto src/calendario-dati.js — {len(cal)} partite, {giornate} giornate')

    voci = []
    for k, t in sorted(fatti.items(), key=lambda x: (int(x[0].split(':')[0]), x[0])):
        g, casa, ospite = k.split(':')
        voci.append('  {g:%s,casa:%s,ospite:%s,arbitro:%s,titolari:%s,eventi:%s,cambi:%s}' % (
            g, json.dumps(casa), json.dumps(ospite), json.dumps(t['arbitro']),
            json.dumps(t['titolari']), json.dumps(t['eventi']), json.dumps(t['cambi'])))
    (RADICE / 'src' / 'eventi-dati.js').write_text(
        '/**\n'
        ' * Tabellini veri del Campionato Sammarinese: formazioni, marcatori, assist,\n'
        ' * cartellini e sostituzioni, col minuto.\n'
        ' *\n'
        ' * GENERATO da scripts/importa-fsgc.py — non modificare a mano.\n'
        ' * Fonte: FSGC. Rilanciare ogni settimana dopo le partite.\n'
        ' *\n'
        ' * eventi: [idGiocatore, minuto, tipo] · cambi: [entra, esce, minuto]\n'
        ' * titolari: [undici di casa, undici ospiti]\n'
        ' */\n'
        'export const REFERTI = [\n%s,\n];\n' % ',\n'.join(voci), encoding='utf-8')
    tot = sum(len(t['eventi']) for t in fatti.values())
    print(f'scritto src/eventi-dati.js — {len(fatti)} tabellini, {tot} eventi')

    # Chi ha giocato ma su Transfermarkt non c'è: la copertura sammarinese è
    # parziale. Senza questi, un gol vero resterebbe senza chi lo ha segnato.
    f_extra = RADICE / 'data' / 'extra.json'
    noti = {e['slug']: e for e in (json.loads(f_extra.read_text(encoding='utf-8')) if f_extra.exists() else [])}
    for nome, v in (mancanti or {}).items():
        if v.get('club') and nome not in noti:
            noti[nome] = {'slug': nome, 'club': v['club'], 'ruolo': v.get('ruolo') or 'C'}
    extra = []; elenco_extra = []
    for nome, v in sorted(noti.items()):
        if not v.get('club'):
            continue
        parole = [w.capitalize() for w in re.split(r'[-_\s]+', v['slug']) if w]
        cognome = parole[-1] if len(parole) > 1 else parole[0]
        primo = ' '.join(parole[:-1]) or parole[0]
        extra.append('  [%s,%s,%s,%s]' % (json.dumps(v['club']), json.dumps(primo),
                                          json.dumps(cognome), json.dumps(v.get('ruolo') or 'C')))
        elenco_extra.append({'slug': nome, 'club': v['club'], 'ruolo': v.get('ruolo') or 'C'})
    (RADICE / 'src' / 'listone-extra.js').write_text(
        '/**\n'
        ' * Tesserati presenti nei tabellini FSGC ma assenti dalle rose di\n'
        ' * Transfermarkt, la cui copertura sammarinese è parziale.\n'
        ' *\n'
        ' * GENERATO da scripts/importa-fsgc.py — non modificare a mano.\n'
        ' * Senza di loro un gol vero resterebbe senza marcatore.\n'
        ' * Quotazione: la minima del ruolo, non avendo un valore di mercato.\n'
        ' *\n'
        ' * Forma: [clubId, nome, cognome, ruolo]\n'
        ' */\n'
        'export const LISTONE_EXTRA = [\n%s,\n];\n' % ',\n'.join(extra), encoding='utf-8')
    f_extra.write_text(json.dumps(elenco_extra, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'scritto src/listone-extra.js — {len(extra)} tesserati recuperati dalla FSGC')


if __name__ == '__main__':
    main()
