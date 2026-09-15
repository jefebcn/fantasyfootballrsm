/** esc() da solo: maglia.js e ui.js si userebbero a vicenda, e l'anello di
 *  import lascerebbe una delle due a metà caricamento. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
