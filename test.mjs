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
