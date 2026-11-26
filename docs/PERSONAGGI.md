# Personaggi somiglianti dei calciatori

Deciso con Alex il 26/11. Al posto dell'avatar generico (`src/avatar.js`), chi
lo chiede ha un personaggio a fumetto che gli somiglia, disegnato da due sue
foto. Una caricatura riconoscibile è immagine della persona (art. 10 c.c.,
artt. 96-97 L. 633/1941) e l'app ha sponsor e shop: quindi solo col consenso,
e solo per QUEL disegno.

## Le regole (valgono in tutti i passi)

- Consenso: casella facoltativa nel testo v2 (`consensi_testi`, 072), solo
  con il «Ci sto» verificato, solo maggiorenni (niente U18 nemmeno col genitore).
- Foto: le manda il calciatore dalla pagina (bucket privato `selfie`, cartella
  = suo codice). Mai foto da FSGC, giornali o social. Si cancellano entro 30
  giorni (`selfie_da_cancellare()`), anche dal servizio usato per disegnare.
- Disegno: Gemini via API a pagamento (o Vertex/Workspace), MAI l'app consumer
  (addestramento e revisione umana). Stile fisso, maglia nei colori della
  squadra, niente stemmi o marchi ufficiali.
- Approvazione: il calciatore vede il disegno col suo codice e risponde
  (`personaggio_rispondi`: si / rifare / no). Ogni disegno nuovo si riapprova.
- Mai nel repo (è pubblico, un ritiro non si toglie da git): i disegni stanno
  nel bucket pubblico `personaggi`, nome `<player_id>-<16 hex>`, in due misure
  (`-256.webp`, `-512.webp`). Un disegno nuovo è un nome nuovo.
- Cosa mostrare lo decide il database: `personaggi_attivi()` (approvati, consenso
  valido adesso, non esclusi, nomi brevi spenti). Ritiro, «Non voglio
  comparire», «Ci sto» senza personaggio o esclusione 041 → «ritirato» da solo.
- Mai shop, merchandising, pubblicità a pagamento. Con sponsor solo se c'è
  anche la casella sponsor.

## I passi

| # | Passo | Stato |
|---|---|---|
| 1 | Migrazione 072 (testo v2, casella, `personaggi`, funzioni, ritiro automatico, bucket) + `supabase/prove/personaggi.sql` | fatto (26/11), da applicare col via di Alex |
| 2 | Modulo `#/giocatori`: testo v2, casella, caricamento delle 2 foto ricodificate (senza EXIF), «ritiro solo il personaggio» (= «Ci sto» senza casella) | da fare |
| 3 | Admin: coda delle foto, caricamento del disegno, foglio di controllo; pagina del calciatore per approvare col codice | da fare |
| 4 | `scripts/personaggio.py`: scontorno (come `make-avatar.py`), webp 256/512, nome con 16 hex, caricamento con cache corta | da fare |
| 5 | App: `avatar()` usa `personaggi_attivi()` con ritorno all'avatar generico, segno distintivo, cache del service worker ≤ 3 giorni, card da condividere | da fare |
| 6 | Prova con 20-30 calciatori, poi «Vuoi il tuo personaggio?» | dopo il legale |

## A mano (Alex)

- Testo v2 (in 072) a Elisa. Finché nessuno ci aderisce, si corregge
  rieseguendo la 072.
- Attivare Gemini via API e salvare la scheda di stile con 2-3 riferimenti da `media/avatar`.
- Cancellare le foto dal proprio computer e dalla cronologia del servizio dopo ogni disegno.

## Scheda di stile (prove del 26/11)

Lo stile è quello dei personaggi 101-230 di `media/avatar`: figura intera in
azione di gioco, testa grande ma non enorme (circa 1/4 dell'altezza), corpo
atletico, pittura digitale tipo figurina, contorno scuro sottile, maglia a tinta
unita col numero, niente fondo. Bocciati: mezzibusti, vettoriale piatto,
giocattolo 3D, fumetto a inchiostro. Il solo testo si avvicina ma non basta
(testa troppo grande, viso troppo fotografico, alone chiaro attorno): servono
le immagini di riferimento, quindi Gemini Pro (Nano Banana Pro) con allegati.

Allegati fissi: `media/avatar/149.webp`, `173.webp`, `205.webp` (stile) + le 2
foto del calciatore (somiglianza). Per le prove: un volto inventato o la propria
foto, mai un calciatore senza consenso. Con le foto vere solo via API (regole sopra).

Prompt (inglese, rende meglio; cambiare solo le parti tra < >):

    Use the first three images ONLY as the art style reference: same full-body
    chibi sports-sticker look, same head-to-body ratio (head about one quarter
    of total height), same digital painting, soft cel shading, glossy hair
    highlights and the same thin dark outline. Do not copy their faces or kits.
    Use the other images ONLY for the person's likeness: face shape, hairline and
    hairstyle, beard, skin tone, eyes, nose, ears. Keep a friendly, flattering
    caricature, never grotesque.
    Pose: <dribbling with the ball at his feet | goal celebration, knee slide |
    pointing to the sky | shooting>. Three-quarter view, whole body in frame.
    Kit: plain <colour> shirt with <colour> trim, white number <n> on chest and
    shorts, <colour> shorts and socks. No logos, no badges, no sponsors, no
    brand marks anywhere, including boots. Plain coloured boots.
    Background: flat solid #1A1230, no ground shadow, nothing else. Square image.

Controllo prima di approvare: si riconosce a 34x40 px (misura delle liste)?
Niente marchi su maglia e scarpe (il 230 ha un baffo sul petto: mai come
riferimento)? Proporzioni uguali agli altri? Poi `make-avatar.py`-style
scontorno sul fondo piatto.
