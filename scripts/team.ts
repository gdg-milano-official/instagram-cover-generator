// node scripts/team.ts
// Il kit degli organizzatori: legge il team da 2026.devfestmilano.it, scarica le
// foto e abbina a ognuno la sua carta tra quelle di public/carte/altre.json
// (le scrive scripts/carte.ts). Scrive public/carte/team.json.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { slug } from '../src/export.ts';
import type { Persona, Soggetto } from '../src/carte.ts';

const SITO = 'https://2026.devfestmilano.it/it/team/';
const OUT = 'public/carte';

const html = await (await fetch(SITO)).text();
const entita = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"');

// La pagina e' renderizzata dal server: ogni persona e' una foto, un <h3> col nome
// e un <p> con "Organizzatore GDG ... · lavoro".
const foto = new Map([...html.matchAll(/<img alt="([^"]+)"[^>]*src="([^"]+images%2Fteam[^"]+)"/g)]
  .map(([, nome, src]) => [entita(nome), entita(src)]));
const membri = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3><p[^>]*>([^<]+)<\/p>/g)]
  .map(([, nome, ruolo]) => ({ nome: entita(nome), ruolo: entita(ruolo) }))
  .filter((m) => foto.has(m.nome));
if (!membri.length) throw new Error('nessun organizzatore nella pagina del team: il sito e\' cambiato?');

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z]/g, '');
const carte: Soggetto[] = JSON.parse(readFileSync(join(OUT, 'altre.json'), 'utf8'));

// Same-origin come le carte, altrimenti il canvas si sporca e l'export fallisce.
async function scarica(url: string, nome: string) {
  const ext = decodeURIComponent(new URL(url).pathname).match(/\.\w+$/)?.[0] || '.jpg';
  const file = join(OUT, `team-${nome}`);
  writeFileSync(`${file}${ext}`, Buffer.from(await (await fetch(url)).arrayBuffer()));
  if (ext === '.jpg') return `/carte/team-${nome}.jpg`;
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', `${file}${ext}`, '--out', `${file}.jpg`], { stdio: 'ignore' });
    unlinkSync(`${file}${ext}`);
    return `/carte/team-${nome}.jpg`;
  } catch {
    return `/carte/team-${nome}${ext}`;   // senza sips resta l'originale
  }
}

const team: (Persona & { gruppo: 'team' })[] = [];
for (const m of membri) {
  const [gdg, ...lavoro] = m.ruolo.split(' · ');
  const carta = carte.find((c) => norm(c.name) === norm(m.nome));
  const nome = slug(m.nome);
  team.push({
    id: `team-${nome}`,
    name: m.nome,
    role: gdg,
    lavoro: lavoro.join(' · '),
    gruppo: 'team',
    foto: await scarica(foto.get(m.nome)!, nome),
    carta: carta?.carta || '',
    numero: carta?.numero || ''
  });
}

writeFileSync(join(OUT, 'team.json'), `${JSON.stringify(team, null, 2)}\n`);
console.log(`${team.length} organizzatori in ${OUT}/team.json`);
const senza = team.filter((t) => !t.carta).map((t) => t.name);
if (senza.length) console.log(`Senza carta: ${senza.join(', ')}`);
