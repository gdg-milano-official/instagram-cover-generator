// node test.mjs — controlla il mapping del payload Sessionize "view/All".
import assert from 'node:assert';
import { mapSpeakers, topicTags } from './src/sessionize.js';

// In "view/All" gli id sessione sono stringhe, quelli dentro speaker.sessions numeri.
const payload = {
  sessions: [
    { id: '778899', title: 'Agenti che usano tool davvero', description: 'Un giro su MCP.', roomId: 84252 },
    { id: '778900', title: 'Flutter oltre il mobile', isConfirmed: true },
    { id: '778901', title: 'Talk ritirato', isConfirmed: false }
  ],
  speakers: [
    { id: 1, fullName: 'Zoe Bianchi', tagLine: 'Staff Engineer @ Acme', profilePicture: 'https://cdn.sessionize.com/image/abc-400o400o1-x.png', sessions: [{ id: 778899, name: 'titolo vecchio' }] },
    { id: 2, firstName: 'Ada', lastName: 'Verdi', tagLine: '', profilePicture: null, sessions: [{ id: 778900, name: 'Flutter oltre il mobile' }] },
    { id: 3, fullName: 'Non Confermato', tagLine: '', sessions: [{ id: 778901 }] },
    { id: 4, fullName: 'Tagline Lunga', tagLine: 'Google Developer Expert for Web | Speaker & Workshop Host (15+ DevFests) | Principal Consultant', profilePicture: null, sessions: [{ id: 778899 }] }
  ],
  rooms: [{ id: 84252, name: 'Nexus' }, { id: 84253, name: 'Workshop' }]
};

const mappati = mapSpeakers(payload);
const [ada, lunga, zoe] = mappati;

assert.strictEqual(zoe.name, 'Zoe Bianchi');
assert.strictEqual(ada.name, 'Ada Verdi', 'nome ricomposto da firstName/lastName');
assert.deepStrictEqual(mappati.map((s) => s.name), ['Ada Verdi', 'Tagline Lunga', 'Zoe Bianchi'],
  'ordine alfabetico, senza i non confermati');

// Il titolo autorevole e' quello della sessione, non il nome dentro lo speaker.
assert.strictEqual(zoe.talk, 'Agenti che usano tool davvero');

// Foto: proxy per non sporcare il canvas; senza foto stringa vuota -> iniziali.
assert.strictEqual(zoe.photo, '/img/abc-400o400o1-x.png', 'anche le URL su cdn.sessionize.com passano dal proxy');
assert.strictEqual(ada.photo, '');

// Sala risolta da rooms[] via roomId; assente finche' la schedule non e' pubblicata.
assert.strictEqual(zoe.room, 'Nexus');
assert.strictEqual(ada.room, '');

// Tagline chilometrica: tengo il primo segmento, che e' il ruolo vero.
assert.strictEqual(lunga.role, 'Google Developer Expert for Web');
assert.ok(mappati.every((s) => s.role.length <= 60));

// Hashtag: il titolo pesa piu' dell'abstract, e l'italiano deve contare.
assert.deepStrictEqual(zoe.tags.split(' '), ['#AIAgents', '#MCP']);
assert.ok(mappati.every((s) => s.tags.split(' ').filter(Boolean).length <= 3));
assert.deepStrictEqual(topicTags('AI On-Device con Gemini Nano', 'Parliamo anche di RAG e multimodal'),
  ['#Gemini', '#OnDeviceAI', '#AI'], 'il titolo vince sulla descrizione');
assert.ok(topicTags('Testing Agentico su Mobile', '').includes('#AIAgents'), 'anche i titoli italiani');

// L'AI riceve il materiale grezzo, non la versione accorciata per la locandina.
assert.strictEqual(lunga.roleFull.length, 95);
assert.strictEqual(zoe.abstract, 'Un giro su MCP.');

// Talk o workshop: nei dati non c'e' un flag, si deduce da sala e durata.
import { tipoSessione } from './src/sessionize.js';
assert.strictEqual(zoe.kind, 'Talk', 'senza orari e fuori dalla sala workshop resta un talk');
assert.strictEqual(tipoSessione({ startsAt: '2026-10-10T09:30:00', endsAt: '2026-10-10T11:00:00' }, 'Nexus'),
  'Workshop', '90 minuti sono un workshop anche in sala normale');
assert.strictEqual(tipoSessione({ startsAt: '2026-10-10T09:30:00', endsAt: '2026-10-10T10:15:00' }, 'Workshop'),
  'Workshop', 'la sala Workshop basta da sola');
assert.strictEqual(tipoSessione({ startsAt: '2026-10-10T09:30:00', endsAt: '2026-10-10T10:15:00' }, 'Nexus'),
  'Talk', '45 minuti in sala normale');

console.log('ok — mapping Sessionize');

assert.strictEqual(mapSpeakers({ speakers: [{ id: 1, fullName: 'fabkru' }] })[0].name, 'Fabian Krumbholz',
  'i nickname diventano nome e cognome');

assert.strictEqual(mapSpeakers({
  speakers: [{ id: 1, fullName: 'Seif', sessions: [{ id: 1353401 }] }],
  sessions: [{ id: 1353401, title: 'SAIF', isConfirmed: false }]
}).length, 1, 'una sessione confermata a mano entra anche se Sessionize dice di no');

// Motore dei reel e kit social sponsors
import { FRAMES, FPS, PARTNER, posa } from './src/reel.js';

assert.strictEqual(FRAMES / FPS, 16, 'reel di 16 secondi');
assert.strictEqual(posa(4, { in: 5 }), null, 'prima di entrare il pezzo non c’e’');
assert.deepStrictEqual(posa(8, { in: 5, da: [0, -100] }).map((v) => Math.round(v) + 0), [0, 0], 'dopo dur scatti e’ in posizione');
assert.strictEqual(posa(40, { in: 5, out: 36 }), null, 'dopo l’uscita sparisce');
for (const [id, p] of Object.entries(PARTNER)) {
  assert.strictEqual(p.immagini.length, 3, `${id}: tre immagini, una per post-it`);
  assert.deepStrictEqual(Object.keys(p.testi), Object.keys(PARTNER.bizzynow.testi), `${id}: stessi campi di testo`);
  assert.ok(p.caption({ eventName: 'DevFest Milano 2026', hashtag: '#DevFestMilano' }).includes('#DevFestMilano'));
}
console.log('ok — reel');

// Kit social speaker
import { captionAltra, captionCarta, captionKit, estratto, kitDa } from './src/carte.js';

assert.strictEqual(estratto('Breve.'), 'Breve.');
assert.strictEqual(estratto('Prima frase. Seconda frase molto lunga.', 15), 'Prima frase.', 'taglia a fine frase');
assert.ok(estratto('una sola frase senza punto che non finisce mai', 20).endsWith('…'));
const cap = captionCarta({ name: 'Ada Verdi', role: 'GDE', numero: '006/058', kind: 'Workshop', talk: 'Agenti con ADK',
  abstract: 'Agentic AI con Gemini.', ora: '09:30–11:00', room: 'Workshop', coSpeaker: ['Bea Neri'] },
  { eventName: 'DevFest Milano 2026', hashtag: '#DevFestMilano' });
assert.ok(cap.includes('il workshop "Agenti con ADK"') && cap.includes('insieme a Bea Neri') && cap.includes('#AIAgents'));
const altra = captionAltra({ name: 'Datwave', gruppo: 'partner', numero: '004/058' }, { eventName: 'DevFest Milano 2026', hashtag: '#DevFestMilano' });
assert.ok(altra.includes('Carta 004/058: Datwave') && altra.includes('partner della DevFest'));
assert.ok(!captionAltra({ name: 'Agent Swarm', gruppo: 'collezione', numero: '' }, { hashtag: '#X' }).includes('Carta :'), 'senza numero niente "Carta"');
const kit = kitDa([
  { id: 'demo', name: 'Demo', talk: 'x' },
  { id: '1', name: 'Bea', talk: 'Agenti', photo: '/img/b.png', inizio: '2026-10-10T11:30:00', fine: '2026-10-10T12:15:00', kind: 'Talk', room: 'Nexus' },
  { id: '2', name: 'Ada', talk: 'Agenti', photo: '/img/a.png', inizio: '2026-10-10T11:30:00', fine: '2026-10-10T12:15:00', kind: 'Talk', room: 'Nexus' }
]);
assert.deepStrictEqual(kit.map((s) => [s.name, s.ora, s.coSpeaker]), [['Ada', '11:30–12:15', ['Bea']], ['Bea', '11:30–12:15', ['Ada']]], 'niente demo, ora locale, co-speaker');
assert.ok(captionKit(kit[0], { eventName: 'DevFest Milano 2026', hashtag: '#DevFestMilano' }).startsWith("🎤 Sabato sul palco c'è Ada!"));
assert.strictEqual(tipoSessione({ title: 'UI Generativa', startsAt: '2026-10-10T09:30:00', endsAt: '2026-10-10T11:00:00' }, 'Secret Track'), 'Masterclass');
assert.strictEqual(tipoSessione({ title: 'The Bug Bash Playbook', startsAt: '2026-10-10T11:30:00', endsAt: '2026-10-10T11:50:00' }, 'Secret Track'), 'Talk', 'i 20 minuti in Secret Track sono talk');
console.log('ok — kit social speaker');

// Carte caricate dalla UI: nome e numero dal file, abbinamento per nome o a mano.
const { cartaDaFile, abbinamenti, kitCaricato } = await import('./src/carte.js');
assert.deepStrictEqual(cartaDaFile('07.Emanuele_Villa (holo).png'), { file: '07.Emanuele_Villa (holo).png', numero: '07', nome: 'Emanuele Villa' });
assert.strictEqual(cartaDaFile('Giulia Neri.jpg').nome, 'Giulia Neri');
const carte = ['07.Zoe_Bianchi.png', '12.Ada_Verdi (1).png', '30.Altra_Carta.png'].map((f) => ({ ...cartaDaFile(f), url: f }));
const sps = [{ id: 'z', name: 'Zoë Bianchi' }, { id: 'a', name: 'Ada Verdi' }];
assert.deepStrictEqual(abbinamenti(sps, carte, {}), { z: '07.Zoe_Bianchi.png', a: '12.Ada_Verdi (1).png' }, 'per nome, senza accenti');
assert.deepStrictEqual(abbinamenti(sps, carte, { a: '07.Zoe_Bianchi.png' }), { z: null, a: '07.Zoe_Bianchi.png' }, 'la carta presa a mano non si abbina ad altri');
assert.deepStrictEqual(abbinamenti(sps, carte, { z: null }), { z: null, a: '12.Ada_Verdi (1).png' }, 'scollegato apposta');
assert.deepStrictEqual(abbinamenti(sps, carte, { z: 'non-caricata.png' }).z, null);
const k = kitCaricato(sps, carte, {});
assert.strictEqual(k.speaker[0].numero, '007/030');
assert.strictEqual(k.speaker[0].foto, '');
assert.deepStrictEqual(k.altre.map((c) => c.name), ['Altra Carta']);
const { gruppoDi } = await import('./src/carte.js');
assert.strictEqual(gruppoDi('Google'), 'partner');
assert.strictEqual(gruppoDi('Altra Carta'), 'collezione');
const persone = {
  team: [{ id: 'team-a', name: 'Altra Carta', role: 'Organizzatore GDG Milano', carta: '/carte/vecchia.jpg' }, { id: 'team-b', name: 'Senza Carta', role: '', carta: '/carte/b.jpg' }],
  partner: [{ id: 'partner-x', name: 'Nessuno', role: '' }]
};
const conPersone = kitCaricato(sps, carte, {}, persone);
assert.strictEqual(conPersone.collegate['team-a'], '30.Altra_Carta.png', 'organizzatori abbinati per nome come gli speaker');
assert.strictEqual(conPersone.team[0].carta, '30.Altra_Carta.png', 'la carta caricata vince su quella di team.json');
assert.strictEqual(conPersone.team[1].carta, '/carte/b.jpg', 'senza carta caricata resta quella di team.json');
assert.deepStrictEqual(conPersone.altre.map((c) => [c.name, c.gruppo, c.role]), [['Altra Carta', 'team', 'Organizzatore GDG Milano']]);
console.log('ok — carte caricate');
