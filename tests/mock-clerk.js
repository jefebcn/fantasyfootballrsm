/* Finto clerk-js: serve a verificare il cablaggio dell'app, non Clerk. */
(function () {
  const listeners = [];
  const user = { id: 'user_2mock', fullName: 'Alex Conti', firstName: 'Alex', primaryEmailAddress: { emailAddress: 'contiale2001@gmail.com' } };
  window.Clerk = {
    user: null,
    session: { getToken: async () => 'clerk.jwt.mock' },
    async load() { return this; },
    addListener(fn) { listeners.push(fn); },
    mountSignIn(el) { el.innerHTML = '<div data-mock-clerk>Accedi con Clerk</div>'; },
    mountSignUp(el) { el.innerHTML = '<div data-mock-clerk>Registrati</div>'; },
    unmountSignIn() {}, unmountSignUp() {},
    openUserProfile() { window.__profileOpened = true; },
    async signOut() { window.Clerk.user = null; listeners.forEach((f) => f()); },
  };
  window.__mockClerkSignIn = () => { window.Clerk.user = user; listeners.forEach((f) => f()); };
})();
