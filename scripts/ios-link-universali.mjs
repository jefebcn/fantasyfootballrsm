/**
 * Scrive .well-known/apple-app-site-association: il file che dice a iOS
 * «i link di fantatitano.site li apre l'app Fantatitano». Senza, un invito o
 * un link del sito toccato su iPhone apre Safari anche a chi ha l'app.
 *
 * Serve il Team ID dell'account Apple Developer (10 caratteri, in
 * developer.apple.com -> Account -> Membership). Va fatto una volta sola,
 * quando l'account esiste, e poi si pubblica il sito come sempre.
 *
 *   node scripts/ios-link-universali.mjs ABCDE12345
 */
import { writeFileSync, readFileSync } from 'node:fs';

const team = (process.argv[2] || '').trim().toUpperCase();
if (!/^[A-Z0-9]{10}$/.test(team)) {
  console.error('Serve il Team ID: 10 lettere e numeri. Esempio: node scripts/ios-link-universali.mjs ABCDE12345');
  process.exit(1);
}
const { appId } = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const file = {
  applinks: { details: [{ appIDs: [`${team}.${appId}`], components: [{ '/': '/*' }] }] },
  webcredentials: { apps: [`${team}.${appId}`] },
};
writeFileSync('.well-known/apple-app-site-association', `${JSON.stringify(file, null, 2)}\n`);
console.log(`Scritto .well-known/apple-app-site-association per ${team}.${appId}`);
