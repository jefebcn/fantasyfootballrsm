# Design — Fantatitano

Progettazione visiva e funzionale dell'app, costruita **sulla grammatica di interfaccia di
"Leghe Fantacalcio"** (drawer a sezioni, dashboard con hero-maglia, barra statistiche a
quattro colonne, card partita, bottom bar a cinque voci) e **riscritta sul Voto Titano**:
il fantacalcio senza pagelle definito in `regolamento-fantacampionato-sammarinese`.

Regola di precedenza: in caso di divergenza fra questi documenti e il regolamento, vale il
regolamento. In caso di divergenza fra questi documenti e il README di prodotto, vale il README.

| File | Contenuto |
|---|---|
| [01-identita-visiva.md](01-identita-visiva.md) | Perché azzurro Titano + oro corona, cosa si tiene e cosa si cambia rispetto a Leghe Fantacalcio |
| [02-design-system.md](02-design-system.md) | Colori, tipografia, spaziatura, componenti, stati, motion, accessibilità |
| [03-architettura-informativa.md](03-architettura-informativa.md) | Mappa di navigazione: bottom bar, drawer, ruoli utente, permessi |
| [04-schermate.md](04-schermate.md) | Specifica schermata per schermata, con le funzionalità e i dati mostrati |
| [05-admin-voto-titano.md](05-admin-voto-titano.md) | L'area admin di data entry: la priorità n.1 del prodotto |
| [tokens/tokens.css](tokens/tokens.css) | Token CSS (fonte di verità) — tema chiaro + scuro |
| [tokens/tokens.json](tokens/tokens.json) | Stessi token in JSON, per tooling |
| [index.html](index.html) | Prototipo visivo navigabile: design kit + schermate in cornice telefono |

## Le cinque decisioni di design

1. **Lo stato del dato è sempre visibile.** Ogni punteggio, classifica e voto porta il badge
   `PROVVISORIO` (ambra) o `CONGELATO` (azzurro, lucchetto). È l'unico elemento nuovo
   di prima grandezza rispetto all'app italiana e nasce dagli artt. 9.1–9.2.
2. **Il voto si spiega da solo.** Il fantavoto non è mai un numero nudo: si espande sempre in
   `base 6,0 + esito ±0,5 + eventi`. La credibilità del gioco sta nella trasparenza.
3. **Nessun casa/trasferta per le squadre reali.** Le partite del campionato sammarinese si
   mostrano come `Squadra A — Squadra B @ campo`, mai con freccia casa/fuori.
4. **Il ciclo settimanale è una timeline di prodotto.** Domenica 23:59 → martedì 18:00 →
   martedì 20:00: la dashboard mostra sempre in quale fase siamo.
5. **Admin di data entry mobile-first, sotto i 10 minuti a partita.** Prima schermata da
   costruire, non l'ultima.
