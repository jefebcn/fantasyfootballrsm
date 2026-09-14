# 03 — Architettura informativa

## Ruoli utente

| Ruolo | Chi | Cosa vede in più |
|---|---|---|
| **Fantallenatore** | Ogni partecipante | Dashboard, Rosa, Calendario, Classifica, Voti, Listone, Mercato libero |
| **Admin di lega** | Chi crea la lega | Drawer › Setup completo, Partecipanti, Regolamento ed opzioni, Asta |
| **Giudice Dati** | Una persona per stagione (art. 9.4) | Drawer › *Giudice Dati*: Inserisci eventi, Punteggi provvisori, Contestazioni, Congela giornata, Archivio precedenti |
| **Tesserato FSGC** | Giocatore/tecnico/dirigente reale (art. 13) | Come fantallenatore, con la propria società bloccata in asta e mercato |

Le tre viste (pubblica, lega, admin) condividono la stessa shell: cambia solo il drawer.

## Bottom bar (5 voci, come Leghe Fantacalcio)

| # | Voce | Icona | Schermata | Sostituisce |
|---|---|---|---|---|
| 1 | **Dashboard** | casa | Hero squadra, stat, fase settimana, live/prossima giornata | Dashboard |
| 2 | **Rosa** | maglia | La mia rosa (25) + tab *Formazione* | Squadre |
| 3 | **Calendario** | 31 | Giornate fanta + partite reali della giornata, con campo e link Titani.TV | Calendario |
| 4 | **Classifica** | medaglia | Classifica con criteri di spareggio a vista | Classifica |
| 5 | **Voti** | scheda | Voto Titano della giornata, tutti i giocatori, filtri società/ruolo | Video |

*Perché Voti al posto di Video*: il README fissa come priorità 3 la "vista pubblica
settimanale: classifica, voti, scontri diretti". Il video resta un link per partita (icona
play) dentro Calendario e dentro il data entry, non una destinazione.

## Drawer (hamburger)

```
[header gradiente]  username (oro) · e-mail · LOGOUT
[lega corrente]     I SUDATI DEL TITANO              (+)
[CTA]               SCHIERA LA FORMAZIONE · lock dom 15:00

Setup
  ├ Profilo lega
  ├ Partecipanti
  ├ Regolamento ed opzioni   ← parametri §6: soglia/passo, tetto società, eventi liv. 2, voto 5,5
  ├ Competizioni             ← Campionato · Coppa Titano Fanta (play-off)
  └ Asta                     ← chiamata libera / buste chiuse; log acquisti

Gioca
  ├ Listone                  ← ~400 tesserati, filtro società/ruolo/quotazione
  ├ Mercato libero           ← rilancio a 24h (art. 3.4), crediti da rimborso 50%
  ├ Fuori dal campionato     ← rimossi d'ufficio (art. 3.3)
  ├ Fantallenatore dell'anno
  └ Scheda condivisibile     ← immagine PNG della giornata (README §9)

Giudice Dati                 (solo ruolo Giudice Dati / Admin)
  ├ Inserisci eventi         ← data entry per partita (05-admin-voto-titano.md)
  ├ Punteggi provvisori      ← ricalcolo, pubblicazione dom 23:59
  ├ Contestazioni            ← coda con evento+minuto, scadenza mar 18:00
  ├ Congela giornata         ← azione irreversibile mar 20:00
  ├ Archivio precedenti      ← decisioni art. 9.4
  └ Registro modifiche       ← chi/quando/cosa su ogni evento
```

## Mappa di navigazione

```
Dashboard ─┬─ Hero › Condividi scheda (bottom sheet › immagine)
           ├─ Hero › Impostazioni squadra
           ├─ Hero › Mercato libero
           ├─ Stat › Classifica
           ├─ Fase settimana › Voti (se provvisorio/congelato) · Formazione (se aperta)
           ├─ Live/Prossima giornata › Dettaglio partita fanta
           └─ Card contestazioni › Contestazioni (se Giudice Dati) · Regolamento (se utente)

Rosa ──────┬─ Tab Rosa › Dettaglio giocatore (storico voti, quotazione, società)
           └─ Tab Formazione › Modulo › Campo › Panchina ordinata › Capitano/Vice › Conferma

Calendario ─┬─ Giornata fanta (scontri) › Dettaglio partita fanta
            └─ Partite reali della giornata › Play Titani.TV

Classifica ─── Riga squadra › Dettaglio squadra avversaria (rosa pubblica dopo il lock)

Voti ──────┬─ Badge stato dato
           ├─ Filtri: società · ruolo · solo miei
           └─ Riga giocatore › Breakdown voto (bottom sheet)

Dettaglio partita fanta ── Undici + panchina per squadra, sostituzioni automatiche evidenziate,
                           totale › conversione in gol con soglia e passo
```

## Fase della settimana (stato globale)

Il prodotto ha cinque fasi che governano CTA, badge e cosa può fare chi:

| Fase | Quando | Dashboard mostra | Formazione | Dati |
|---|---|---|---|---|
| **Aperta** | Da mar 20:00 a lock | CTA oro "Schiera la formazione" + countdown | modificabile | giornata precedente congelata |
| **Live** | Dal lock all'ultimo fischio | "Live in corso" con puntino verde | sola lettura | eventi in inserimento |
| **Provvisorio** | Dom 23:59 → mar 18:00 | Badge ambra + card "Contestazioni aperte" | sola lettura | modificabile dal Giudice Dati, loggato |
| **Chiusura** | Mar 18:00 → 20:00 | Badge ambra "in chiusura" | sola lettura | solo Giudice Dati, decisioni finali |
| **Congelato** | Mar 20:00 | Badge azzurro con lucchetto | si riapre la successiva | immutabile |

Se una gara è rinviata (art. 10.1) la fase resta *Provvisorio* con nota "recupero entro
mar 18:00" e i giocatori coinvolti mostrano `S.V. · rinviata`.
