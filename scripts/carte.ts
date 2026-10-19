// node scripts/carte.ts "<cartella delle carte>"
// Abbina le carte BizzyMagic (PNG 6,3x8,8 cm, "NN.Nome_Cognome (...).png") agli
// speaker della DevFest e scrive public/carte/speaker.json piu' le carte in JPG.
// I dati vengono dall'agenda del sito: e' la copia di Sessionize che il sito
// sincronizza, e resta raggiungibile anche quando l'API Sessionize non lo e'.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUOLI, gruppoDi } from '../src/carte.ts';
import { slug } from '../src/export.ts';
import type { Soggetto } from '../src/carte.ts';

// Quello che serve dell'agenda del sito.
interface SpeakerSito { id: string; fullName: string; tagLine?: string }
interface SessioneSito {
  title: string;
  description?: Record<string, string>;
  language: string;
  level?: string;
  tags?: string[];
  roomName: string;
  startsAt: string;
  endsAt: string;
  speakerIds?: string[];
}
interface CartaFile { file: string; aggiunta: boolean; numero: string; nome: string }

const SITO = 'https://2026.devfestmilano.it/it/agenda/';
const OUT = 'public/carte';

// Su Sessionize alcuni speaker hanno un nickname al posto del nome.
const ALIAS: Record<string, string> = { fabkru: 'Fabian Krumbholz', maeste: 'Stefano Maestri', Haz: 'Harry Zhang' };
// Nomi scritti diversamente sulla carta.
const SULLA_CARTA: Record<string, string> = { 'Emmanuele Villa': 'Emanuele Villa' };

// Sessionize li chiama "Talk (35min+Q&A)", "Lighting talk"...: sulla grafica basta il tipo.
const tipoSessione = (s: SessioneSito) => {
  const t = [...(s.tags || []), s.roomName].join(' ');
  return /workshop/i.test(t) ? 'Workshop' : /light(n)?ing/i.test(t) ? 'Lightning talk' : /demo/i.test(t) ? 'Talk + Demo' : 'Talk';
};

const cartella = process.argv[2];
if (!cartella) throw new Error('uso: node scripts/carte.ts "<cartella delle carte>"');

// Il payload React Server Components arriva a pezzi in self.__next_f.push([1, "..."]).
const html = await (await fetch(SITO)).text();
const rsc = Buffer.from([...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
  .map((m) => JSON.parse(m[1])).join(''), 'utf8');
const testo = rsc.toString('utf8');

// I testi lunghi sono righe "id:T<byte in hex>,<testo>" richiamate come "$id".
function riga(id: string) {
  const m = new RegExp(`(?:^|\\n|[^0-9a-f])${id}:T([0-9a-f]+),`).exec(testo);
  if (!m) return '';
  const inizio = Buffer.byteLength(testo.slice(0, m.index + m[0].length), 'utf8');
  return rsc.subarray(inizio, inizio + parseInt(m[1], 16)).toString('utf8');
}
const risolvi = (v: unknown): string => (typeof v === 'string' && /^\$[0-9a-f]+$/.test(v) ? riga(v.slice(1)) : String(v || ''));

function array<T>(chiave: string): T[] {
  let migliore: T[] = [];
  for (const m of testo.matchAll(new RegExp(`"${chiave}":\\[`, 'g'))) {
    let profondita = 0, i = m.index! + m[0].length - 1, inStringa = false;
    for (; i < testo.length; i++) {
      const c = testo[i];
      if (inStringa) { if (c === '\\') i++; else if (c === '"') inStringa = false; continue; }
      if (c === '"') inStringa = true;
      else if (c === '[' || c === '{') profondita++;
      else if ((c === ']' || c === '}') && --profondita === 0) break;
    }
    try {
      const v = JSON.parse(testo.slice(m.index! + m[0].length - 1, i + 1));
      if (v.length > migliore.length) migliore = v;
    } catch { /* un riferimento parziale, non l'array completo */ }
  }
  return migliore;
}

const speakers = array<SpeakerSito>('speakers');
const sessioni = array<SessioneSito>('sessions');
if (!speakers.length || !sessioni.length) throw new Error('agenda senza speaker o sessioni: il sito e\' cambiato?');

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z]/g, '');
// Le carte aggiunte dopo stanno in una sottocartella e hanno una numerazione loro.
const leggi = (dir: string, aggiunta: boolean): CartaFile[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? leggi(join(dir, d.name), true)
  : /^\d+\./.test(d.name) ? [{ file: join(dir, d.name), aggiunta, numero: d.name.match(/^(\d+)/)![1],
      nome: d.name.replace(/^\d+\.|\s*\(.*$|\.png$/g, '').replace(/_/g, ' ').replace(/\bCI CD\b/, 'CI/CD') }] : []);
const carte = leggi(cartella, false);
const totale = String(Math.max(...carte.filter((c) => !c.aggiunta).map((c) => Number(c.numero)))).padStart(3, '0');

function converti(c: CartaFile, file: string) {
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', c.file, '--out', join(OUT, file)], { stdio: 'ignore' });
    return file;
  } catch {
    copyFileSync(c.file, join(OUT, file.replace(/\.jpg$/, '.png')));
    return file.replace(/\.jpg$/, '.png');
  }
}


// Ora di Roma: l'agenda e' in UTC.
const ora = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

mkdirSync(OUT, { recursive: true });
const senzaCarta: string[] = [], usate = new Set<string>();
const voci: { numero: string; [campo: string]: unknown }[] = [];   // forma di speaker.json
for (const sp of speakers) {
  const nome = ALIAS[sp.fullName] || sp.fullName;
  const carta = carte.find((c) => norm(c.nome) === norm(SULLA_CARTA[nome] || nome));
  const sessione = sessioni.find((s) => (s.speakerIds || []).includes(sp.id));
  if (!sessione) continue;

  const descrizione = sessione.description || {};
  const tipo = tipoSessione(sessione);
  const dati = {
    id: sp.id,
    name: nome,
    role: (sp.tagLine || '').split('|')[0].trim(),
    talk: sessione.title,
    kind: tipo,
    abstract: risolvi(descrizione[sessione.language] || descrizione.it || descrizione.en).trim(),
    lingua: sessione.language,
    livello: sessione.level || '',
    tags: (sessione.tags || []).filter((t) => !/talk|workshop|demo/i.test(t)),
    room: sessione.roomName,
    ora: `${ora(sessione.startsAt)}–${ora(sessione.endsAt)}`,
    coSpeaker: speakers.filter((a) => a.id !== sp.id && (sessione.speakerIds || []).includes(a.id))
      .map((a) => ALIAS[a.fullName] || a.fullName)
  };

  if (!carta) { senzaCarta.push(nome); continue; }
  usate.add(carta.file);
  const file = converti(carta, `${slug(nome)}.jpg`);
  voci.push({ ...dati, carta: `/carte/${file}`, numero: `${carta.numero.padStart(3, '0')}/${totale}` });
}

voci.sort((a, b) => a.numero.localeCompare(b.numero));
writeFileSync(join(OUT, 'speaker.json'), `${JSON.stringify(voci, null, 2)}\n`);

const altre: Soggetto[] = carte.filter((c) => !usate.has(c.file)).sort((a, b) => Number(a.numero) - Number(b.numero)).map((c) => {
  const tipo = gruppoDi(c.nome);
  return {
    id: `carta-${c.numero}`,
    name: c.nome,
    role: RUOLI[tipo],
    gruppo: tipo,
    carta: `/carte/${converti(c, `${c.numero.padStart(3, '0')}-${slug(c.nome)}.jpg`)}`,
    // le aggiunte hanno gia' il loro numero stampato, diverso dal nome del file
    numero: c.aggiunta ? '' : `${c.numero.padStart(3, '0')}/${totale}`
  };
});
writeFileSync(join(OUT, 'altre.json'), `${JSON.stringify(altre, null, 2)}\n`);

console.log(`${voci.length} speaker con carta in ${OUT}/speaker.json`);
if (senzaCarta.length) console.log(`Speaker senza carta: ${senzaCarta.join(', ')}`);
console.log(`${altre.length} altre carte in ${OUT}/altre.json: ${altre.map((c) => `${c.name} (${c.gruppo})`).join(', ')}`);
