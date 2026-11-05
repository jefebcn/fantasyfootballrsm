/**
 * SCEGLIERE UNA PASSWORD NUOVA: dopo il link «Password dimenticata?», o da
 * Impostazioni.
 *
 * Alex, 23/10, e i log dello stesso giorno: chi apriva il link del recupero
 * entrava nell'app, e l'app non gli chiedeva niente. La password restava
 * quella vecchia, quella dimenticata. La persona riapriva il link («gia'
 * usato»), poi provava a entrare con la password vecchia e sbagliava di
 * nuovo. Ora, tornati dal link, si apre subito questo foglio: due campi, le
 * regole che si spuntano mentre si scrive, e il salvataggio.
 */
import * as S from '../state.js';
import { icon, esc, t } from '../ui.js';
import { REGOLE, erroreRegole } from '../password.js';

const SEGNO = 'fcs:recupero-password';
/** Il ritorno dal link del recupero, ricordato finche' la password non e' cambiata. */
export function segnaRecupero() { try { sessionStorage.setItem(SEGNO, '1'); } catch { /* niente memoria: si chiede solo adesso */ } }
export function recuperoInCorso() { try { return sessionStorage.getItem(SEGNO) === '1'; } catch { return false; } }
function chiudiRecupero() { try { sessionStorage.removeItem(SEGNO); } catch { /* niente */ } }

const campo = (id, ph, ac) => `<div class="np-campo"><input class="field-input" id="${id}" type="password" autocomplete="${ac}" placeholder="${ph}" autocapitalize="off" spellcheck="false">
  <button type="button" class="occhio" data-vedi="${id}" aria-label="${t('Mostra la password')}">${icon('eye', 'ic sm')}</button></div>`;

/**
 * Apre il foglio. `ui` = { sheet, toast } (dell'app o del ctx di una vista).
 * `recupero`: si arriva dal link dell'e-mail, e lo si dice.
 */
export function apriNuovaPassword(ui, { recupero = false } = {}) {
  const email = S.currentUser()?.email || '';
  ui.sheet(`<h3>${recupero ? t('Scegli la nuova password') : t('Cambia password')}</h3>
    ${recupero ? `<p class="auth-hint">${email
    ? t('Sei entrato con il link dell\'e-mail come <b>{email}</b>. Adesso scegli la password nuova: da qui in poi entri con questa, anche dall\'app sulla schermata Home.', { email: esc(email) })
    : t('Sei entrato con il link dell\'e-mail. Adesso scegli la password nuova: da qui in poi entri con questa, anche dall\'app sulla schermata Home.')}</p>` : ''}
    <label class="lbl" for="np1">${t('Nuova password')}</label>${campo('np1', t('la password nuova'), 'new-password')}
    <ul class="np-regole" aria-live="polite">${REGOLE.map((r) => `<li data-regola="${r.k}">${icon('check', 'ic sm')}${t(r.testo)}</li>`).join('')}</ul>
    <label class="lbl" for="np2">${t('Riscrivila')}</label>${campo('np2', t('la stessa, per sicurezza'), 'new-password')}
    <p class="np-uguali" aria-live="polite"></p>
    <button class="a-btn" id="np-salva" style="margin-top:12px">${t('Salva la nuova password')}</button>
    ${recupero ? `<button class="sottile centro np-dopo" id="np-dopo">${t('Più tardi: la cambio da Impostazioni')}</button>` : ''}`);
  const sh = document.getElementById('sheet');
  const v = (id) => sh.querySelector(`#${id}`)?.value || '';
  const aggiorna = () => {
    const p = v('np1');
    for (const r of REGOLE) sh.querySelector(`[data-regola="${r.k}"]`)?.classList.toggle('ok', r.ok(p));
    const u = sh.querySelector('.np-uguali');
    if (u) u.textContent = v('np2') && v('np2') !== p ? t('Le due password non sono uguali.') : '';
  };
  sh.oninput = aggiorna;
  sh.onclick = async (e) => {
    const occhio = e.target.closest('[data-vedi]');
    if (occhio) { const c = sh.querySelector(`#${occhio.dataset.vedi}`); const vis = c.type === 'text'; c.type = vis ? 'password' : 'text'; occhio.setAttribute('aria-label', vis ? t('Mostra la password') : t('Nascondi la password')); return; }
    if (e.target.closest('#np-dopo')) { chiudiRecupero(); ui.sheet(null); ui.toast(t('La cambi quando vuoi da Impostazioni → Cambia password')); return; }
    const salva = e.target.closest('#np-salva'); if (!salva) return;
    const p = v('np1');
    const err = erroreRegole(p) || (v('np2') !== p ? 'Le due password non sono uguali: riscrivila uguale.' : '');
    if (err) { ui.toast(t(err)); aggiorna(); return; }
    salva.disabled = true; salva.textContent = t('Salvo…');
    try {
      await S.updatePassword(p);
      chiudiRecupero(); ui.sheet(null);
      ui.toast(recupero ? t('Fatto: d\'ora in poi entri con la nuova password') : t('Password aggiornata'));
    } catch (er) { salva.disabled = false; salva.textContent = t('Salva la nuova password'); ui.toast(t(er.message)); }
  };
  setTimeout(() => sh.querySelector('#np1')?.focus(), 250);
}
