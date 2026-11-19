# Stato – Fantatitano

Aggiornato: 2026-11-19 (prima versione, ricostruita da git: da confermare con Alex alla prossima ripartenza)

## Dove siamo
- App online su fantatitano.site, iPhone (Capacitor, widget Home, notifiche, recensione) e link in bio su fantatitano.site/link (al posto di Linktree).
- Lavoro di sviluppo sul ramo `claude/fantacalcio-sammarinese-design-xlxzd3`, unito a `main` con PR; dopo ogni modifica all'app parte il commit «versione: fcs-v4.2.x».
- Dati del campionato: import automatico (`dati: import automatico`), catalogo foto giocatori (249 giocatori, 769 foto dagli album FSGC).
- Stemmi di fantasia per le 16 squadre (scelti da Alex il 17/11), con la nota nei Termini.

## Aperto / in corso
- FantaTitano Futsal: annunciato nel link in bio per il 1° dicembre (PR #118). Stato dello sviluppo da verificare con Alex.
- Migrazione 057 (carriera di La Partita sull'account), 18/11: da verificare se è applicata su Supabase.

## Prossimo passo consigliato
- Da decidere con Alex alla prima ripartenza.

## Decisioni recenti di Alex ancora valide
- Sull'iPhone tutto porta all'app, non al sito.
- Niente riga «non affiliato» nel link in bio: resta nei Termini.

## Attenzione
- Il deploy parte solo se `npm test` è verde.
