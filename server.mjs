// Server unico: statici, proxy verso Sessionize e generazione dei post.
// Il proxy serve per la CORS e perche' le foto devono arrivare same-origin,
// altrimenti html2canvas sporca il canvas e l'export PNG fallisce.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 8080;
const PUBLIC = fileURLToPath(new URL('./dist/', import.meta.url));  // build di Vite
// Un solo client per tutti: Gemini e Azure AI Foundry parlano entrambi
// chat/completions. Accetto anche i nomi AZURE_AI_FOUNDRY_* cosi' un .env
// gia' esistente si incolla senza rinominare niente.
const env = process.env;
// Accetto sia l'URL completo sia l'endpoint base della risorsa Azure.
const base = (env.AI_ENDPOINT || env.AZURE_AI_FOUNDRY_ENDPOINT || '').trim().replace(/\/+$/, '');
const ENDPOINT = !base || base.endsWith('/chat/completions') ? base : `${base}/openai/v1/chat/completions`;
const API_KEY = env.AI_API_KEY || env.AZURE_AI_FOUNDRY_API_KEY || '';
const MODEL = env.AI_MODEL || env.AZURE_AI_FOUNDRY_MODEL || '';
const AI = Boolean(ENDPOINT && API_KEY && MODEL);

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

/* ---------- Generazione dei post ---------- */

const SYSTEM = `Sei il social media manager di un DevFest, la conferenza per sviluppatori
organizzata dalle community Google Developer Group. Scrivi i post che annunciano i singoli
speaker, in italiano.

Ricevi, per ogni speaker: nome e cognome, ruolo, bio, tipo di sessione (Talk o Workshop),
titolo, abstract completo, sala e argomenti. Leggili tutti prima di scrivere.
Se il tipo e' Workshop chiamalo workshop, non talk: e' una sessione pratica e piu' lunga.

Regole che valgono per entrambi i post:
- Usa SOLO i fatti che ti vengono passati. Non inventare premi, aziende, numeri o argomenti
  che non compaiono nei dati: se un'informazione manca, scrivi il post senza.
- Il talk va raccontato partendo dall'ABSTRACT, non dal titolo: tira fuori il problema
  concreto di cui parla e cosa si porta a casa chi ascolta. Il titolo da solo non basta mai.
- Usa la BIO per presentare chi parla in mezza riga (da dove viene, di cosa si occupa,
  perche' ha titolo per parlarne). Non copiarla e non elencarla: riassumila.
- Chiama lo speaker con nome e cognome completi la prima volta, poi solo col nome.
- Niente superlativi da brochure ("imperdibile", "straordinario", "guru").
- Il titolo del talk va riportato esatto, tra virgolette.

Instagram: 500-900 caratteri. Tono diretto e sveglio, emoji per scandire le righe e non a
pioggia. I link non sono cliccabili: rimanda al link in bio. Chiudi con 8-12 hashtag su una
riga sola, inclusi quelli dell'evento e dell'argomento.

LinkedIn: 700-1300 caratteri. Tono professionale ma parlato, niente gergo da comunicato.
Tre o quattro paragrafi brevi, spiegando perche' il tema interessa a chi sviluppa. Includi il
link ai biglietti. Chiudi con 4-6 hashtag, non di piu'.

Rispondi SOLO con un oggetto JSON con esattamente due chiavi:
{"instagram": "<il post>", "linkedin": "<il post>"}`;

// Alcuni endpoint incartano il JSON in un blocco markdown anche quando non dovrebbero.
function estraiJson(testo) {
  const pulito = testo.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(pulito);
  } catch {
    const parentesi = pulito.match(/\{[\s\S]*\}/);
    if (!parentesi) throw new Error('il modello non ha risposto in JSON');
    return JSON.parse(parentesi[0]);
  }
}

async function generaPost({ prompt, ...dati }) {
  // Il prompt puo' arrivare dalla UI; se manca o e' vuoto uso quello di casa.
  const sistema = typeof prompt === 'string' && prompt.trim() ? prompt.trim().slice(0, 20_000) : SYSTEM;
  const risposta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Gemini vuole Bearer, Azure accetta sia Bearer sia api-key: li mando entrambi
      // alla stessa destinazione invece di ramificare sul provider.
      authorization: `Bearer ${API_KEY}`,
      'api-key': API_KEY
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: JSON.stringify(dati, null, 1) }
      ],
      response_format: { type: 'json_object' }
    })
  });

  const corpo = await risposta.json().catch(() => null);
  if (!risposta.ok)
    throw new Error(corpo?.error?.message || `il provider ha risposto ${risposta.status}`);

  const testo = corpo?.choices?.[0]?.message?.content;
  if (!testo) throw new Error('risposta del provider senza contenuto');

  const post = estraiJson(testo);
  if (typeof post.instagram !== 'string' || typeof post.linkedin !== 'string')
    throw new Error('JSON senza i campi instagram e linkedin');
  return { instagram: post.instagram, linkedin: post.linkedin };
}

function leggiCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    req.on('data', (c) => {
      corpo += c;
      if (corpo.length > 100_000) reject(new Error('richiesta troppo grande'));  // limite di sanita'
    });
    req.on('end', () => resolve(corpo));
    req.on('error', reject);
  });
}

/* ---------- Proxy e statici ---------- */

async function proxy(destinazione, res) {
  const upstream = await fetch(destinazione, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  });
  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
    'cache-control': 'public, max-age=300'
  });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

async function statico(percorso, res) {
  // normalize + prefisso: senza questo un ../ servirebbe file fuori da public/
  const rel = normalize(decodeURIComponent(percorso)).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(PUBLIC, rel === '/' || rel === '' ? 'index.html' : rel);
  if (!file.startsWith(PUBLIC)) return json(res, 403, { errore: 'percorso non ammesso' });
  try {
    const contenuto = await readFile(file);
    res.writeHead(200, { 'content-type': TIPI[extname(file)] || 'application/octet-stream' });
    res.end(contenuto);
  } catch {
    json(res, 404, { errore: 'non trovato' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/stato') return json(res, 200, { ai: AI, promptDefault: SYSTEM });

    if (url.pathname === '/genera') {
      if (req.method !== 'POST') return json(res, 405, { errore: 'usa POST' });
      if (!AI) return json(res, 503, { errore: 'AI non configurata: mancano AI_ENDPOINT, AI_API_KEY o AI_MODEL' });
      return json(res, 200, await generaPost(JSON.parse(await leggiCorpo(req))));
    }

    if (url.pathname.startsWith('/api/'))
      return await proxy('https://sessionize.com/api/v2/' + url.pathname.slice(5), res);

    if (url.pathname.startsWith('/img/'))
      return await proxy('https://cdn.sessionize.com/image/' + url.pathname.slice(5), res);

    await statico(url.pathname, res);
  } catch (err) {
    console.error(err);
    const rete = ['ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED'].includes(err.cause?.code)
      || err.name === 'TimeoutError';
    json(res, rete ? 502 : 500, { errore: rete ? `upstream non raggiungibile: ${err.message}` : err.message });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`La porta ${PORT} e' gia' occupata. Avvia con PORT=<altra> oppure libera quella porta.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () =>
  console.log(`In ascolto sulla porta ${PORT} — AI ${AI ? `attiva (${MODEL})` : 'non configurata'}`));
