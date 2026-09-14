# Video della schermata di benvenuto

Attuale: `intro.mp4` — 7,2 s, 576×1024, 1,47 MB, H.264 con `moov` in testa.

Metti qui il filmato di sfondo della presentazione (`src/views/onboarding.js`).
Se i file non ci sono, l'app usa uno sfondo animato di riserva: non si rompe nulla.

| File | Ruolo |
|---|---|
| `intro.mp4` | il video (H.264, richiesto) |
| `intro.webm` | stessa clip in VP9, facoltativa: pesa meno dove è supportata |
| `intro.jpg` | primo fotogramma, mostrato mentre il video carica |

Consigli: **verticale 1080×1920**, 6–10 secondi che ripartono senza stacco, **senza audio**
(l'app lo riproduce comunque muto, ma la traccia è peso inutile), **sotto i 3 MB**. L'app lo sfoca e lo scurisce, quindi non serve che sia nitido: funzionano
meglio inquadrature larghe e lente — un campo, le torri, la curva — che primi piani.

Esempio di conversione:

```bash
ffmpeg -i originale.mov -an -t 8 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -c:v libx264 -crf 30 -preset slow -movflags +faststart media/intro.mp4
ffmpeg -i media/intro.mp4 -an -c:v libvpx-vp9 -crf 40 -b:v 0 media/intro.webm
ffmpeg -i media/intro.mp4 -vframes 1 -q:v 4 media/intro.jpg
```


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
