# Cosa c'è qui dentro, e cosa non c'è più

Le immagini dell'app sono **disegnate, non fotografate**: personaggi della
copertina, maglia e sfondi sono SVG generati dal codice
(`src/personaggio.js`, `src/maglia.js`, `src/sfondo.js`). Restano qui solo i
caratteri, le icone e il logo.

Prima c'erano dieci ritagli di immagini altrui come personaggi (calciatori veri
e personaggi di cartoni), due fotografie di sfondo e una maglia ricavata dalla
foto di una maglia vera. Fra amici in una lega privata passava; aprendo le
iscrizioni a chiunque no. Insieme a loro sono andati via anche
`scripts/make-avatar.py` e `scripts/make-maglia.py`, che servivano a ritagliarli,
e 176 KB di JPEG dall'avvio.

Il video di benvenuto (`intro.mp4`) è stato rimosso a suo tempo: la sezione che
lo descriveva è stata rimossa con lui.

# Logo

Originale in uso: **`media/logo.jfif`** (JPEG 736×736, nero su bianco).
Dopo averlo sostituito, rigenera gli asset:

```bash
python3 scripts/make-logo.py media/logo.jfif
```

Lo script ritaglia la sagoma, la centra e genera:

- `media/logo-mask.png` — usata come maschera CSS: l'app la colora con il colore corrente,
  così lo stesso file funziona bianco sull'hero scuro e azzurro sulla schermata d'accesso;
- `icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `maskable-512.png` — le
  icone della PWA, logo bianco sul gradiente Azzurro Titano.

- `styles/logo.css` — la maschera incorporata come data URI: nessuna richiesta in più,
  nessun riquadro pieno se l'immagine non arrivasse, e funziona offline.

Lo script accetta sia un originale nero su bianco (soglia automatica, così gli artefatti
JPEG non lasciano un velo sullo sfondo) sia un PNG già ritagliato con trasparenza.
