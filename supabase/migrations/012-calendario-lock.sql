-- Il calendario dei lock, dentro il database dal primo giorno.
--
-- GENERATO da scripts/genera-lock.mjs a partire dal calendario dell'app
-- (src/data.js): non si modifica a mano, si rigenera. La prova
-- tests/calendario-lock.test.js diventa rossa se il file e' indietro.
--
-- Prima queste righe arrivavano al server solo quando un Giudice Dati apriva
-- l'app (migrazione 004). Su un progetto senza giudice la tabella restava
-- vuota: le policy, prudenti, non facevano vedere le formazioni degli
-- avversari nemmeno a partita finita, e l'app chiedeva a chi amministra la
-- lega di incollare SQL. Un dato derivato, uguale per tutte le leghe, deve
-- stare nel database come una tabella, non arrivare per mano di qualcuno.
--
-- Ripetibile: riscrive solo le righe con una data diversa. updated_by resta
-- nullo, e' giusto: non l'ha scritto una persona.

insert into public.matchday_locks (matchday, lock_at) values
  (1, '2026-08-28T13:00:00.000Z'),
  (2, '2026-09-04T13:00:00.000Z'),
  (3, '2026-09-11T13:00:00.000Z'),
  (4, '2026-09-18T13:00:00.000Z'),
  (5, '2026-10-09T13:00:00.000Z'),
  (6, '2026-10-23T13:00:00.000Z'),
  (7, '2026-10-30T14:00:00.000Z'),
  (8, '2026-11-07T14:00:00.000Z'),
  (9, '2026-11-14T14:00:00.000Z'),
  (10, '2026-11-21T14:00:00.000Z'),
  (11, '2026-11-28T14:00:00.000Z'),
  (12, '2026-12-05T14:00:00.000Z'),
  (13, '2026-12-12T14:00:00.000Z'),
  (14, '2026-12-19T14:00:00.000Z'),
  (15, '2026-12-26T14:00:00.000Z'),
  (16, '2027-01-02T14:00:00.000Z'),
  (17, '2027-01-09T14:00:00.000Z'),
  (18, '2027-01-16T14:00:00.000Z'),
  (19, '2027-01-23T14:00:00.000Z'),
  (20, '2027-01-30T14:00:00.000Z'),
  (21, '2027-02-06T14:00:00.000Z'),
  (22, '2027-02-13T14:00:00.000Z'),
  (23, '2027-02-20T14:00:00.000Z'),
  (24, '2027-02-27T14:00:00.000Z'),
  (25, '2027-03-06T14:00:00.000Z'),
  (26, '2027-03-13T14:00:00.000Z'),
  (27, '2027-03-20T14:00:00.000Z'),
  (28, '2027-03-27T14:00:00.000Z'),
  (29, '2027-04-03T13:00:00.000Z'),
  (30, '2027-04-10T13:00:00.000Z')
on conflict (matchday) do update
  set lock_at = excluded.lock_at, updated_at = now(), updated_by = null
  where public.matchday_locks.lock_at is distinct from excluded.lock_at;
