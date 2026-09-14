# Fantacampionato Sammarinese

Fantacalcio sul Campionato Sammarinese di calcio: asta a crediti, rose, formazioni
settimanali, scontro diretto — **senza pagelle**. I voti (Voto Titano) sono calcolati da
eventi oggettivi del referto FSGC.

**App (PWA)** — installabile su iPhone/Android dalla schermata "Aggiungi a Home", funziona
offline dopo la prima apertura. Nessun backend nella stagione pilota: il listone e il
calendario sono generati in modo deterministico, formazioni ed eventi inseriti restano sul
dispositivo.

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html` · `manifest.webmanifest` · `sw.js` · `icons/` | Shell PWA, manifest, service worker, icone |
| `src/engine.js` | **Motore di scoring** puro (artt. 4–8, 10–12): `computeRating`, `computeLineupResult`, `computeStandings`, conversione in gol |
| `src/data.js` | Generatore della stagione pilota: 16 società, 400 tesserati, 30 giornate, eventi delle giornate giocate |
| `src/state.js` | Stato applicativo: dati generati + delta in `localStorage` (formazioni, eventi, congelamenti, contestazioni, registro) |
| `src/app.js` · `src/ui.js` · `src/views/` | Router hash, shell (app bar, drawer, bottom bar), componenti e le viste |
| `styles/app.css` | CSS dell'app, derivato dal design kit; i token vivono in `design/tokens/tokens.css` |
| `tests/engine.test.js` | Test dei casi limite del regolamento (17 test) |
| `design/` | Design kit: identità, sistema, architettura informativa, schermate, prototipo (`design/index.html`) |

## Sviluppo

```bash
npm test          # motore di scoring
npm start         # http://localhost:4173 (server statico)
python3 scripts/make-icons.py   # rigenera le icone
```

Deploy: statico su Vercel dal branch `main`; il design kit resta raggiungibile su `/design/`.

## Viste

Dashboard · Rosa · Formazione (moduli, capitano/vice, panchina ordinata, lock) · Calendario
(scontri di lega + partite reali con campo e Titani.TV) · Classifica · Voti (breakdown di ogni
fantavoto, segnalazione errori) · Live (campo lungo, panchina, totali) · Listone · Giocatore ·
Mercato libero · Regolamento · Scheda condivisibile · Impostazioni.

Giudice Dati: giornata (8 partite, avanzamento) · inserimento partita in 4 passi (risultato e
stato, chi ha giocato, eventi con tastiera, anteprima voti) · contestazioni · congelamento con
conferma digitata · registro modifiche.

## Riferimenti

- Regolamento: *Regolamento Fantacampionato Sammarinese — Sistema a Voto Titano* (bozza v1.0)
- README di prodotto: *Fantacampionato Sammarinese* (contesto, priorità, modello dati, motore)
