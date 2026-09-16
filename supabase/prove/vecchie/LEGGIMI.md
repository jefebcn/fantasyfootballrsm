# Le migrazioni com'erano prima delle correzioni

Queste non si eseguono mai in produzione: servono a **ricostruire il database
di chi le ha applicate quando erano ancora sbagliate**, che è la situazione
peggiore da correggere e l'unica che conti davvero.

Un database vuoto non dice niente di utile: le migrazioni nuove ci passano
sopra per costruzione. I guai stanno nel mezzo — colonne rimaste `uuid`,
chiavi già sciolte da un tentativo morto a metà, policy scritte sulla vecchia
identità, funzioni con un tipo di ritorno che non si può sostituire.

`da-vecchio.sh` parte da qui, applica la catena attuale e controlla che si
arrivi esattamente dove arriva un database partito da zero.

Sono una fotografia, non codice vivo: si aggiornano solo se si scopre un altro
stato intermedio che rompe qualcosa. Vengono da `eac7505^`, l'ultimo commit
prima che le migrazioni venissero corrette.
