/**
 * Notizie del calcio sammarinese da San Marino RTV.
 *
 * Perché passa di qui e non direttamente dal browser: il feed di
 * sanmarinortv.sm non manda `access-control-allow-origin`, quindi una fetch
 * dalla pagina verrebbe bloccata dal browser. Questa funzione fa il salto
 * lato server, converte l'RSS in JSON e lo tiene in cache sul bordo di
 * Vercel: la loro origine viene interrogata al massimo ogni 15 minuti,
 * qualunque sia il nostro traffico.
 *
 * Non è un proxy generico: l'indirizzo è fisso qui dentro e non arriva mai
 * dalla richiesta, così nessuno può usarlo per raggiungere altri siti.
 */
const FEED = 'https://www.sanmarinortv.sm/sport/calcio-sammarinese-c15.xml';
const FONTE = 'San Marino RTV';
const MAX = 12;
const CON_FOTO = 6;   // quante notizie meritano il giro in più per la foto

/**
 * L'originale di og:image pesa mezzo mega: su una dashboard con cinque foto
 * sarebbero 2,5 MB di dati mobili. Il loro sito espone già le versioni
 * ridimensionate sotto /media/cache/<formato>/, 127 KB e 27 KB: usiamo quelle.
 */
const GRANDE = 'fe_article_detail_full_half';   // 960x540
const MINI = 'fe_article_home_small';           // 420x239
function ridimensiona(src, formato) {
  if (!src) return null;
  const senzaQuery = src.split('?')[0];
  const m = senzaQuery.match(/^https:\/\/www\.sanmarinortv\.sm\/(uploads\/.+)$/);
  if (!m) return senzaQuery;                    // già in cache o forma inattesa: si lascia com'è
  return `https://www.sanmarinortv.sm/media/cache/${formato}/${m[1]}`;
}

const dentro = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
};
/** CDATA via, entità sciolte, tag HTML rimossi: nei titoli RSS capitano tutti e tre. */
const pulisci = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

export default async function handler(req, res) {
  try {
    const r = await fetch(FEED, {
      headers: { 'user-agent': 'Fantatitano (+https://fantasyfootballrsm.vercel.app)', accept: 'application/rss+xml, text/xml' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`feed ${r.status}`);
    const xml = await r.text();

    const notizie = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .map((m) => m[1])
      .map((it) => {
        const data = pulisci(dentro(it, 'pubDate'));
        const t = Date.parse(data);
        return {
          titolo: pulisci(dentro(it, 'title')),
          link: pulisci(dentro(it, 'link')),
          sommario: pulisci(dentro(it, 'description')).slice(0, 240),
          sezione: pulisci(dentro(it, 'category')),
          data: Number.isNaN(t) ? null : new Date(t).toISOString(),
        };
      })
      .filter((n) => n.titolo && /^https:\/\/www\.sanmarinortv\.sm\//.test(n.link))
      .slice(0, MAX);

    if (!notizie.length) throw new Error('nessuna notizia riconosciuta nel feed');

    // Il feed non porta immagini, ma ogni articolo espone og:image. Le prendiamo
    // solo per le prime CON_FOTO, in parallelo e con poca pazienza: se una non
    // arriva, quella notizia resta senza foto e il resto non ne risente.
    for (const n of notizie.slice(0, CON_FOTO)) {
      try {
        const a = await fetch(n.link, {
          headers: { 'user-agent': 'Fantatitano (+https://fantasyfootballrsm.vercel.app)' },
          signal: AbortSignal.timeout(7000),
        });
        if (!a.ok) continue;
        const html = await a.text();
        const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        const src = m && m[1];
        if (src && /^https:\/\/www\.sanmarinortv\.sm\//.test(src)) {
          n.foto = ridimensiona(src, GRANDE);
          n.fotoMini = ridimensiona(src, MINI);
        }
      } catch { /* niente foto per questa: non è un motivo per far fallire tutto */ }
    }

    // 15 minuti sul bordo, e fino a un'ora si può servire il vecchio mentre si rinfresca.
    res.setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.status(200).json({ fonte: FONTE, fonteUrl: 'https://www.sanmarinortv.sm/sport/calcio-sammarinese-c15', notizie });
  } catch (e) {
    // Meglio una sezione che non compare che una dashboard rotta.
    res.setHeader('cache-control', 's-maxage=60');
    return res.status(502).json({ errore: String(e?.message || e), notizie: [] });
  }
}
