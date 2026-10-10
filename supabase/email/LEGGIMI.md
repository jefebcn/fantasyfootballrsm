# Le e-mail dell'accesso, in italiano

Supabase di suo manda le e-mail in inglese («Confirm your email address»):
chi si iscrive non le riconosce, Gmail le mette fra gli Aggiornamenti e
sembrano mai arrivate. Questi modelli si incollano a mano nel pannello:
**Supabase → Authentication → Emails → Templates**.

| Modello in Supabase | Oggetto | File |
|---|---|---|
| Confirm signup | `Conferma la tua e-mail · Fantatitano` | `conferma-registrazione.html` |
| Magic Link | `Il tuo link per entrare in Fantatitano` | `link-accesso.html` |
| Reset Password | `Nuova password per Fantatitano` | `reset-password.html` |
| Change Email Address | `Conferma il nuovo indirizzo · Fantatitano` | `cambio-email.html` |

Per ognuno: apri il modello, scrivi l'oggetto, nel riquadro del messaggio
cancella tutto e incolla il contenuto del file, **Save**.

`{{ .ConfirmationURL }}` e `{{ .Token }}` li riempie Supabase: il primo è il
link, il secondo il codice a 6 cifre che l'app accetta quando il link si apre
nel browser sbagliato.

Già che ci sei, in **Authentication → Emails → SMTP Settings** il *Sender
name* va messo a `Fantatitano`: nella casella si legge quello, non
`no-reply`.
