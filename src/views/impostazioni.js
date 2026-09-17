import * as S from '../state.js';
import { esc, icon, pic } from '../ui.js';
import { applyTheme } from '../app.js';
import { CONTATTO, LINGUE } from '../config.js';
import * as AV from '../notifiche.js';
import * as diagnostica from '../diagnostica.js';
import { scaricaMieiDati } from '../miei-dati.js';
import { misure } from '../schermo.js';

const row = (ic, title, sub, action = '', cls = '') => `<button class="setting ${cls}" ${action ? `data-act="${action}"` : 'disabled style="cursor:default"'}><i class="ico${typeof ic === 'object' ? ' illus' : ''}">${typeof ic === 'object' ? pic(ic.m, 'menu') : icon(ic)}</i><span class="txt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${action ? icon('chev', 'ic sm chev') : ''}</button>`;
/**
 * Preferenze notifiche. Il permesso lo chiede davvero il browser, e il testo
 * dice fino a dove arrivano: il promemoria ad app aperta scatta all'apertura
 * della dashboard; a telefono chiuso servono le push, che ora hanno la chiave
 * VAPID e quindi l'iscrizione avviene per davvero. Il foglio dice a che punto
 * è QUESTO dispositivo — chiave presente, permesso dato, iscrizione viva sono
 * tre cose diverse — invece di promettere in blocco.
 */
function apriAvvisi(ctx) {
  // getSubscription() e' una promessa, il foglio si disegna subito: si parte da
  // "non iscritto", si chiede, e si ridisegna solo se la risposta cambia le cose.
  let iscritto = false;
  const disegna = () => {
    const d = S.store.get(); const on = d.avvisi !== false;
    const perm = AV.permesso();
    const motivo = AV.motivoNonSupportate();
    ctx.sheet(`<h3>Preferenze notifiche</h3>
      <button class="setting" data-avvisi="${on ? 'off' : 'on'}"><i class="ico">${icon('bell')}</i>
        <span class="txt"><b>Promemoria della formazione</b><span>Un avviso quando manca poco al lock e non hai ancora schierato</span></span>
        <span class="sw${on ? ' on' : ''}"></span></button>
      ${on && perm === 'default' ? `<button class="a-btn" data-avvisi="permesso" style="margin-top:10px">Consenti le notifiche</button>` : ''}
      ${perm === 'denied' ? `<p class="auth-hint">Le notifiche sono bloccate dalle impostazioni del telefono per questo sito: vanno riattivate da lì.</p>` : ''}
      ${motivo === 'ios-nel-browser' ? `<p class="auth-hint avvisi-ios"><b>Su iPhone le notifiche funzionano solo con l'app installata.</b> Tocca <b>Condividi</b> (il quadrato con la freccia in basso a Safari), poi <b>Aggiungi alla schermata Home</b>, e apri l'app da lì: qui comparirà il bottone per consentirle.</p>` : ''}
      ${motivo === 'browser-senza' ? `<p class="auth-hint">Questo browser non supporta le notifiche: da qui l'avviso arriva solo ad app aperta.</p>` : ''}
      ${on && perm === 'granted' ? `<button class="a-btn sec" data-avvisi="prova" style="margin-top:10px">Mandami un avviso di prova</button>` : ''}
      <p class="auth-hint"><b>Ad app aperta</b> l'avviso arriva${perm === 'granted' ? '' : ' appena dai il permesso'}: si controlla ogni volta che apri la dashboard, e ne arriva uno solo per giornata.</p>
      <p class="auth-hint"><b>A telefono chiuso</b> ${!AV.pushConfigurato()
    ? 'servono le notifiche push, e la chiave non è ancora configurata. Il codice c\'è tutto — i passi che restano stanno in <code>supabase/functions/promemoria/README.md</code> — ma finché la chiave manca questa parte è spenta, e preferiamo dirlo che lasciartelo scoprire.'
    : iscritto ? 'questo dispositivo è iscritto alle notifiche push.'
      : perm === 'granted' ? 'le push sono configurate ma questo dispositivo non risulta iscritto: spegni e riaccendi il promemoria qui sopra.'
        : perm === 'denied' ? 'le push sono configurate, ma le notifiche per questo sito sono bloccate dal telefono: finché non le riattivi da lì non arriva niente.'
          : 'le push sono configurate: appena dai il permesso, questo dispositivo si iscrive.'}</p>`);
    const sh = document.getElementById('sheet');
    sh.onclick = async (e) => {
      const b = e.target.closest('[data-avvisi]'); if (!b) return;
      const v = b.dataset.avvisi;
      if (v === 'prova') {
        // Una prova vera, non un finto "ok": se le notifiche non funzionano su
        // questo telefono e' meglio saperlo adesso che la settimana del lock.
        const fatta = await AV.avvisaFormazione(
          { giornata: 0, ore: 24 },
          { giaAvvisato: null, segna: () => {} },
        );
        ctx.toast(fatta ? 'Avviso mandato: guarda le notifiche' : 'Non è stato possibile mostrare la notifica');
        return;
      }
      if (v === 'permesso') {
        const esito = await AV.chiediPermesso();
        if (esito === 'granted') await S.iscriviAvvisi().catch(() => { /* push non configurate */ });
        disegna(); riallinea(); return;
      }
      S.store.set({ avvisi: v === 'on' });
      if (v === 'on') {
        if (AV.permesso() === 'default') {
          const esito = await AV.chiediPermesso();
          if (esito === 'granted') await S.iscriviAvvisi().catch(() => {});
        } else if (AV.permesso() === 'granted') { await S.iscriviAvvisi().catch(() => {}); }
      } else { await S.disiscriviAvvisi().catch(() => {}); }
      disegna(); riallinea();
    };
  };
  const riallinea = () => AV.iscrittoPush().then((v) => {
    if (v !== iscritto) { iscritto = v; disegna(); }
  }).catch(() => {});
  disegna();
  riallinea();
}

const group = (title, inner) => `<section class="group"><h3>${title}</h3>${inner}</section>`;

/** Il sottotitolo della riga nel profilo: guarda la preferenza e il permesso,
 *  che è quello che l'utente può cambiare da qui. */
const avvisiSottotitolo = (d) => {
  const on = d.avvisi !== false;
  const perm = AV.permesso();
  if (!on) return 'Spenti';
  if (perm === 'granted') return 'Promemoria della formazione attivi';
  if (perm === 'denied') return 'Bloccati dal telefono';
  // "Da attivare" su un iPhone dentro Safari era una promessa senza bottone.
  if (AV.motivoNonSupportate() === 'ios-nel-browser') return 'Installa l\'app sulla schermata Home per attivarli';
  return 'Da attivare';
};

export const impostazioni = {
  title: 'Profilo', appbar: 'back', sub: () => 'Account, preferenze e privacy',
  render() {
    const d = S.store.get(); const u = S.currentUser(); const p = S.profileInfo(); const me = S.me();

    const ruolo = p?.is_judge ? 'Giudice Dati' : me?.role === 'admin' ? 'Amministratore di lega' : me ? 'Fantallenatore' : 'Nessuna lega';
    const iniziale = (p?.display_name || u?.email || '?').trim()[0]?.toUpperCase() || '?';

    const testa = `<div class="pf-testa">
      <span class="pf-av" style="--c:${me?.color || 'var(--primary)'}">${esc(iniziale)}</span>
      <div class="pf-dati">
        <span class="pf-et">E-mail</span><b>${esc(u?.email || '—')}</b>
        <span class="pf-et">Nome</span><b>${esc(p?.display_name || '—')}</b>
        <span class="pf-et">Profilo</span><b>${esc(ruolo)}</b>
      </div>
      <button class="pf-pen" data-act="name" aria-label="Cambia nome">${icon('edit', 'ic sm')}</button>
    </div>`;

    const generale = group('Generale', `
      ${row('globe', 'Impostazione lingua', LINGUE.find(([k]) => k === (d.lingua || 'it'))?.[1] || 'Italiano', 'lingua')}
      ${row('bell', 'Preferenze notifiche', avvisiSottotitolo(d), 'avvisi')}
      ${row('chat', 'Contattaci', CONTATTO || 'Indirizzo non ancora impostato', 'contatto')}
      ${row('gear', 'Impostazioni avanzate', 'Tema, lega, server e diagnostica', 'avanzate')}`);

    const conto = group('Account', `
      ${row('shield', 'Privacy e dati', 'Cosa salva l\'app, chi lo vede, come si cancella', 'privacy')}
      ${row('down', 'Scarica i tuoi dati', 'Un file con account, squadra, rosa e formazioni', 'esporta')}
      ${row('warn', 'Segnala un problema', diagnostica.quantiErrori() ? `${diagnostica.quantiErrori()} errori in questa sessione` : 'Manda com\'è fatto il telefono e cos\'è andato storto', 'segnala')}
      ${row('book', 'Termini d\'uso', 'Com\'è fatto il gioco e cosa ci si aspetta', 'termini')}
      ${row('lock', 'Cookie e memoria locale', 'Nessun cookie: cosa resta su questo telefono', 'archiviazione')}
      ${row('img', 'Licenze e crediti', 'Da dove vengono dati, immagini e codice', 'licenze')}
      ${S.authKind() === 'clerk' ? row('gear', 'Gestisci account', 'Nome, e-mail, password e accessi collegati', 'clerk-profile')
    : row('lock', 'Cambia password', 'Imposta una nuova password per questo account', 'password')}
      ${row('out', 'Esci', 'Torni alla schermata di accesso', 'logout', 'danger')}
      ${row('trash', 'Cancella il profilo', 'Via account, squadre, rose e formazioni. Non si torna indietro', 'elimina-profilo', 'danger')}`);

    return `<main class="a-body">${testa}${generale}${conto}
      <p class="auth-foot">Versione 0.5 · motore ${S.rules().engineVersion}</p></main>`;
  },

  mount(root, ctx) {
    const prompt2 = (title, label, attrs, onSave) => {
      ctx.sheet(`<h3>${title}</h3><label class="lbl" for="pv">${label}</label><input class="field-input" id="pv" ${attrs}><button class="a-btn" id="pv-save" style="margin-top:12px">Salva</button>`);
      document.getElementById('pv-save').onclick = () => onSave(document.getElementById('pv').value.trim());
    };
    root.querySelector('main').addEventListener('click', async (e) => {
      // button[data-theme] e non [data-theme]: applyTheme() scrive data-theme
      // sull'<html>, quindi closest('[data-theme]') risaliva fino alla radice
      // e trovava SEMPRE qualcosa. Ogni tocco su una riga delle impostazioni
      // veniva preso per un cambio di tema e la funzione tornava subito:
      // con il tema su Chiaro o Scuro NESSUNA riga funzionava piu' — ne'
      // Privacy, ne' Lingua, ne' il server, ne' il caricamento delle giornate.
      // Con il tema su "Sistema" l'attributo non c'e' e sembrava tutto a posto,
      // ed e' per questo che non salta all'occhio.
      const t = e.target.closest('button[data-theme]'); if (t) { S.store.set({ theme: t.dataset.theme }); applyTheme(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'logout') { await S.signOut(); ctx.go('login'); return; }
      if (act === 'avanzate') { ctx.go('impostazioni/avanzate'); return; }
      if (act === 'sfondo') { S.store.set({ sfondoFoto: !S.store.get().sfondoFoto }); ctx.render(); return; }
      if (act === 'privacy') { ctx.go('privacy'); return; }
      if (act === 'esporta') {
        // Il file si costruisce qui e non passa da nessun server: e' roba tua,
        // non c'e' motivo di farla viaggiare per consegnartela.
        const dati = scaricaMieiDati();
        const quante = dati.legaAperta ? dati.legaAperta.formazioniConsegnate.length : 0;
        ctx.toast(`Scaricato: ${dati.legheACuiPartecipi.length} leghe, ${quante} formazioni`);
        return;
      }
      if (act === 'segnala') {
        const testo = diagnostica.rapporto({ versione: await diagnostica.versioneInCache() });
        if (CONTATTO) {
          location.href = `mailto:${CONTATTO}?subject=${encodeURIComponent('Fantatitano — segnalazione')}`
            + `&body=${encodeURIComponent(testo)}`;
          return;
        }
        // Senza un indirizzo a cui mandarlo, almeno te lo mettiamo negli
        // appunti: cosi' lo incolli dove vuoi invece di non poterlo dare a
        // nessuno.
        try { await navigator.clipboard.writeText(testo); ctx.toast('Segnalazione copiata'); }
        catch { ctx.sheet(`<h3>Segnalazione</h3><pre class="sm-link">${esc(testo)}</pre>`); }
        return;
      }
      if (act === 'elimina-profilo') {
        ctx.sheet(`<h3>Cancellare il profilo?</h3>
          <p class="auth-hint">Spariscono account, squadre in ogni lega, rose, formazioni consegnate e contestazioni.
          Le leghe in cui sei rimasto solo se ne vanno con te. <b>Non si torna indietro.</b></p>
          <p class="auth-hint">Resta il registro delle modifiche ai voti, senza più il tuo nome attaccato:
          è la prova di come è venuto fuori un punteggio e serve agli altri della lega.</p>
          <button class="a-btn sec" data-conferma="no" style="margin-top:10px">Lascia stare</button>
          <button class="a-btn danger" data-conferma="si" style="margin-top:8px">Sì, cancella tutto</button>`);
        const foglio = document.getElementById('sheet');
        foglio.onclick = async (ev) => {
          const b = ev.target.closest('[data-conferma]'); if (!b) return;
          if (b.dataset.conferma === 'no') { ctx.sheet(''); return; }
          try {
            const esito = await S.eliminaProfilo();
            ctx.toast(esito || 'Profilo cancellato');
            await S.signOut();
          } catch (err) { ctx.toast(err?.message || 'Non è stato possibile cancellare'); }
        };
        return;
      }
      if (act === 'termini') { ctx.go('termini'); return; }
      if (act === 'lock-cal') {
        // Il calendario dei lock lo scrive solo il Giudice Dati: se manca, un
        // amministratore di lega puo' accorgersene ma non rimediare, e il
        // messaggio deve dire a chi tocca invece di lasciarlo indovinare.
        const n = S.lockDaSistemare();
        if (!n) { ctx.sheet(`<h3>Calendario dei lock</h3><p class="auth-hint">Tutte le 30 giornate sul server hanno la stessa data di chiusura che usa l'app. È così che deve stare.</p>`); return; }
        if (S.isJudge()) {
          ctx.sheet(`<h3>Calendario dei lock</h3><p class="auth-hint">${n} giornate sul server hanno una data di chiusura diversa da quella dell'app. Finché è così, le formazioni degli avversari non si vedono quando dovrebbero.</p>
            <button class="a-btn" id="allinea" style="margin-top:12px">${icon('check', 'ic sm')}Allinea ora</button>`);
          document.getElementById('allinea').onclick = async (ev) => {
            ev.target.disabled = true;
            try { const q = await S.sincronizzaLock({ forza: true }); ctx.sheet(null); ctx.toast(`Allineate ${q} giornate`); }
            catch (err) { ctx.toast(err.message || 'Non è stato possibile allineare'); }
            ctx.render();
          };
          return;
        }
        // Per chi non e' giudice non c'e' un comando da incollare: il
        // calendario arriva con la migrazione 012, e se qui manca e' il
        // progetto a non averla, non l'utente a dover fare qualcosa. Il foglio
        // con l'SQL da copiare c'era, ed era una cosa da non dare in mano a
        // chi crea una lega.
        ctx.sheet(`<h3>Calendario dei lock</h3><p class="auth-hint">${n} giornate sul server hanno una data di chiusura diversa da quella dell'app. Finché è così, le formazioni degli avversari non si vedono quando dovrebbero.</p>
          <p class="auth-hint">Non dipende da te: il calendario si installa con il database (migrazione <code>012-calendario-lock.sql</code>) e si allinea da sé quando il Giudice Dati apre l'app. Se resta così, segnalalo a chi gestisce il progetto.</p>`);
        return;
      }
      if (act === 'archiviazione') { ctx.go('archiviazione'); return; }
      if (act === 'licenze') { ctx.go('licenze'); return; }
      if (act === 'lingua') {
        ctx.sheet(`<h3>Lingua</h3>${LINGUE.map(([k, l]) => `<button class="setting" data-lingua="${k}"><i class="ico">${icon('check')}</i><span class="txt"><b>${l}</b></span></button>`).join('')}
          <p class="auth-hint">Per ora l'app parla solo italiano. Non è una scelta definitiva: quando ci sarà una seconda lingua comparirà qui.</p>`);
        return;
      }
      if (act === 'contatto') {
        if (CONTATTO) { location.href = `mailto:${CONTATTO}?subject=${encodeURIComponent('Fantatitano')}`; return; }
        ctx.sheet(`<h3>Contattaci</h3><p class="auth-hint">Non c'è ancora un indirizzo a cui scrivere: si imposta in <code>src/config.js</code>, alla voce <code>CONTATTO</code>. Finché resta vuoto questa voce non manda niente, invece di aprire una mail verso il nulla.</p>`);
        return;
      }
      if (act === 'avvisi') { apriAvvisi(ctx); return; }
      if (act === 'clerk-profile') { S.clerkProfile(); return; }
      if (act === 'lega') { ctx.go('lega'); return; }
      if (act === 'leghe') { ctx.go('leghe'); return; }
      if (act === 'regolamento') { ctx.go('regolamento'); return; }
      if (act === 'admin') { ctx.go('admin'); return; }
      if (act === 'diagnostica') {
        ctx.sheet('<h3>Diagnostica accessi</h3><p class="auth-hint">Lettura in corso dal progetto\u2026</p>');
        let esiti; try { esiti = await S.checkSetup(); } catch (err) { ctx.sheet(`<h3>Diagnostica accessi</h3><p class="auth-hint">${esc(err?.message || String(err))}</p>`); return; }
        const segno = { ok: '\u2713', attenzione: '!', errore: '\u2715', info: 'i' };
        ctx.sheet(`<h3>Diagnostica accessi</h3>
          <div class="diag">${esiti.map((r) => `<div class="d-r ${r.livello}"><i>${segno[r.livello]}</i><span><b>${esc(r.voce)}</b><span>${esc(r.esito)}</span>${r.dove ? `<small>${esc(r.dove)}</small>` : ''}</span></div>`).join('')}</div>
          <p class="auth-hint">Gli interruttori stanno nel pannello Supabase: qui si legge soltanto come sono messi adesso.</p>`);
        return;
      }
      if (act === 'schermo') {
        // I numeri veri del telefono: nel sandbox Chromium dvh, lvh e svh
        // coincidono sempre e le tacche non esistono, quindi la fascia
        // scoperta in fondo si vede solo da qui.
        const { righe, testo } = await misure();
        ctx.sheet(`<h3>Misure dello schermo</h3>
          <div class="diag">${righe.map(([k, v]) => `<div class="d-r info"><i>i</i><span><b>${esc(k)}</b><span>${esc(String(v))}</span></span></div>`).join('')}</div>
          <button class="a-btn sec" id="mis-copia" style="margin-top:12px">Copia le misure</button>
          <p class="auth-hint">«Scoperto sotto» è quanto resta fra la barra in basso e il bordo dello schermo: deve essere <b>0</b>. Le tacche sono lo spazio che il telefono si tiene per l'isola e per la barretta di casa.</p>`);
        document.getElementById('mis-copia').onclick = async () => {
          try { await navigator.clipboard.writeText(testo); ctx.toast('Misure copiate'); }
          catch { ctx.toast('Copia non permessa: fai uno screenshot'); }
        };
        return;
      }
      if (act === 'server') {
        ctx.sheet(`<h3>Server della lega</h3><p class="auth-hint">Valori pubblici del progetto Supabase (Settings → API). Cambiarli scollega questo dispositivo dalla lega attuale.</p>
          <label class="lbl" for="sv-url" style="margin-top:8px">Project URL</label><input class="field-input" id="sv-url" value="${esc(S.serverUrl() || '')}" autocomplete="off">
          <label class="lbl" for="sv-key" style="margin-top:8px">Publishable / anon key</label><input class="field-input" id="sv-key" placeholder="lascia vuoto per non cambiarla" autocomplete="off">
          <button class="a-btn" id="sv-save" style="margin-top:12px">Collega</button>`);
        document.getElementById('sv-save').onclick = () => {
          const url = document.getElementById('sv-url').value.trim().replace(/\/$/, ''); const key = document.getElementById('sv-key').value.trim() || S.serverKey();
          if (!/^https:\/\/.+\.supabase\.co$/.test(url) || !key || key.length < 20) { ctx.toast('URL o chiave non validi'); return; }
          S.setSupabaseConfig(url, key);
        };
        return;
      }
      if (act === 'seed') { if (!confirm('Caricare nel database le giornate già giocate, con formazioni ed eventi veri presi dai tabellini della FSGC?')) return; try { await S.seedSampleData(); ctx.toast('Giornate giocate caricate'); } catch (err) { ctx.toast(err.message); } return; }
      if (act === 'password') { prompt2('Cambia password', 'Nuova password', 'type="password" autocomplete="new-password" placeholder="almeno 6 caratteri"', async (v) => { if (v.length < 6) { ctx.toast('Almeno 6 caratteri'); return; } try { await S.updatePassword(v); ctx.sheet(null); ctx.toast('Password aggiornata'); } catch (err) { ctx.toast(err.message); } }); return; }
      if (act === 'name') { prompt2('Cambia nome', 'Come ti chiami', `maxlength="24" value="${esc(S.profileInfo()?.display_name || '')}"`, async (v) => { if (!v) { ctx.toast('Scrivi un nome'); return; } try { await S.updateDisplayName(v); ctx.sheet(null); ctx.toast('Nome aggiornato'); } catch (err) { ctx.toast(err.message); } }); }
    });
  },
};

/** Tutto il tecnico che prima stava in mezzo ai dati dell'account. */
export const avanzate = {
  title: 'Impostazioni avanzate', appbar: 'back', sub: () => 'Tema, lega, server e diagnostica',
  render() {
    const d = S.store.get(); const p = S.profileInfo();

    const look = group('Aspetto', `<div class="a-card"><label class="lbl">Tema</label><div class="seg">${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button class="${d.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>
      <button class="setting" data-act="sfondo"><i class="ico">${icon('img')}</i>
        <span class="txt"><b>Foto in copertina</b><span>Lo stadio dietro la maglia, invece della tinta piena</span></span>
        <span class="sw${d.sfondoFoto ? ' on' : ''}"></span></button>`);

    const league = S.hasLeague() ? group('Lega', `
      ${row({ m: 'squadre' }, esc(S.base.league.name), `${S.base.managers.length} partecipanti${S.base.league.inviteCode ? ` · codice ${esc(S.base.league.inviteCode)}` : ''}`, 'lega')}
      ${row({ m: 'leghe' }, 'Cambia o crea lega', `${S.myLeagues().length} ${S.myLeagues().length === 1 ? 'lega' : 'leghe'} · entra con un codice invito`, 'leghe')}
      ${row({ m: 'guide' }, 'Regolamento ed opzioni', 'Voto Titano, bonus, soglie di conversione', 'regolamento')}`)
      : group('Lega', row({ m: 'leghe' }, 'Entra in una lega', 'Crea la tua oppure usa un codice invito', 'leghe'));

    const judge = p?.is_judge ? group('Giudice Dati', `
      ${row({ m: 'voti' }, 'Inserisci eventi', `Giornata ${S.currentMatchday()}`, 'admin')}
      ${row({ m: 'statistiche' }, 'Carica le giornate giocate', 'Formazioni, marcatori, assist e cartellini veri dai tabellini FSGC', 'seed')}`) : '';

    const data = group('Dati', `
      ${row({ m: 'quotazioni' }, 'Da dove vengono i dati', 'Lega, formazioni e voti sul server; listone e calendario generati dall\'app')}
      ${row('shield', 'Atleti e società', 'Nomi e prestazioni useranno dati reali solo previo accordo con la FSGC')}
      ${S.isLeagueAdmin() ? row('clock', 'Calendario dei lock',
    S.lockDaSistemare() === 0 ? 'Allineato: il server chiude le formazioni quando le chiude l\'app'
      : `${S.lockDaSistemare()} giornate da allineare — toccami`, 'lock-cal',
    S.lockDaSistemare() === 0 ? '' : 'danger') : ''}
      ${row('gear', 'Server della lega', esc(S.serverHost() || '—'), 'server')}
      ${row('shield', 'Diagnostica accessi', 'Controlla sul progetto cosa manca ancora per far entrare la gente', 'diagnostica')}
      ${row('calc', 'Misure dello schermo', 'Quanto occupa davvero l\'app su questo telefono, tacche comprese', 'schermo')}`);

    return `<main class="a-body">${look}${league}${judge}${data}
      <p class="auth-foot">Versione 0.5 · motore ${S.rules().engineVersion}</p></main>`;
  },
  mount: (root, ctx) => impostazioni.mount(root, ctx),
};
