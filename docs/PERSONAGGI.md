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
