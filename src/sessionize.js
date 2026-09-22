// Lettura e normalizzazione dei dati Sessionize. Nessun DOM qui dentro,
// cosi' il mapping resta testabile da node (vedi test.mjs).

// Le foto passano dal proxy del server, altrimenti html2canvas sporca il
// canvas e l'export PNG fallisce.
export const proxyPhoto = (url) =>
  (url || '').replace(/^https:\/\/(cdn\.)?sessionize\.com\/image\//, '/img/');

// Hashtag per argomento, dedotti da titolo + abstract del talk.
// Ordine = priorita'; #AI in fondo fa da rete di sicurezza. Max 3 per locandina.
export const TOPIC_TAGS = [
  [/agentic|\bagent[ei]?s?\b/i, '#AIAgents'],
  [/\bmcp\b|model context protocol/i, '#MCP'],
  [/gemini|gemma/i, '#Gemini'],
  [/\brag\b|retrieval|embedding/i, '#RAG'],
  [/multimodal/i, '#Multimodal'],
  [/on-device|edge ai|offline/i, '#OnDeviceAI'],
  [/\bandroid\b|jetpack|kotlin/i, '#Android'],
  [/flutter|\bdart\b/i, '#Flutter'],
  [/firebase|firestore/i, '#Firebase'],
  [/observab|promql|monitoring|\bsre\b|incident/i, '#Observability'],
  [/security|threat|vulnerab|\brischi?o?\b|risk/i, '#Security'],
  [/testing|\bqa\b|quality/i, '#Testing'],
  [/vibe coding|prompt|spec-driven/i, '#VibeCoding'],
  [/open.?source/i, '#OpenSource'],
  [/kubernetes|serverless|\bcloud\b|infrastructur/i, '#Cloud'],
  [/\bweb\b|frontend|browser/i, '#WebDev'],
  [/\bmobile\b/i, '#Mobile'],
  [/backend|legacy|spring|\bjava\b/i, '#Backend'],
  [/\bai\b|\bia\b|genai|\bllm\b|machine learning|modell?i?/i, '#AI']
];

// Il titolo pesa piu' dell'abstract: "AI On-Device" deve dare #OnDeviceAI,
// non un #RAG pescato da una riga qualsiasi della descrizione.
export function topicTags(title, description) {
  const hits = (text) => TOPIC_TAGS.filter(([re]) => re.test(text)).map(([, tag]) => tag);
  return [...new Set([...hits(title), ...hits(description)])].slice(0, 3);
}

// Le tagline reali arrivano a 165 caratteri separati da "|": tengo il primo
// pezzo, che e' sempre il ruolo vero. Il campo resta editabile sulla card.
export function shortRole(role) {
  if (role.length <= 60) return role;
  const first = role.split(/\s*[|•·]\s*/)[0].trim();
  return first.length <= 60 ? first : first.slice(0, 57).trimEnd() + '…';
}

// Payload "view/All" -> dati della locandina.
// Sessionize non marca i workshop. Nei dati reali stanno nella sala "Workshop"
// e durano 90-135 minuti contro i 45 dei talk: uso entrambi i segnali, cosi'
// regge anche se le sale cambiano nome.
export function tipoSessione(session, sala) {
  const durata = session?.startsAt && session?.endsAt
    ? (new Date(session.endsAt) - new Date(session.startsAt)) / 60000
    : 0;
  return /workshop|\blab\b|hands.?on/i.test(`${sala} ${session?.title || ''}`) || durata >= 60
    ? 'Workshop'
    : 'Talk';
}

export function mapSpeakers(data) {
  const roomName = new Map((data.rooms || []).map((r) => [String(r.id), r.name]));
  const sessions = (data.sessions || []).filter((s) => s.isConfirmed !== false);
  const byId = new Map(sessions.map((s) => [String(s.id), s]));

  return (data.speakers || [])
    .map((sp) => {
      const session = (sp.sessions || []).map((s) => byId.get(String(s.id ?? s))).find(Boolean);
      // Speaker senza sessione confermata = non confermato, salvo endpoint senza sessioni.
      if (sessions.length && !session) return null;
      const room = roomName.get(String(session?.roomId)) || '';
      return {
        id: String(sp.id),
        name: sp.fullName || `${sp.firstName || ''} ${sp.lastName || ''}`.trim(),
        role: shortRole(sp.tagLine || ''),
        photo: proxyPhoto(sp.profilePicture),
        talk: session?.title || sp.sessions?.[0]?.name || '',
        room,
        kind: tipoSessione(session, room),
        tags: topicTags(session?.title || '', session?.description || '').join(' '),
        // non compaiono sulla locandina: servono all'AI per scrivere i post
        roleFull: sp.tagLine || '',
        bio: sp.bio || '',
        abstract: session?.description || ''
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export async function fetchSpeakers(apiId) {
  const res = await fetch(`/api/${encodeURIComponent(apiId)}/view/All`);
  if (!res.ok) throw new Error(`Sessionize ha risposto ${res.status}`);
  return mapSpeakers(await res.json());
}

export const DEMO = [{
  id: 'demo',
  name: 'Mario Rossi',
  role: 'Lead AI Engineer @ TechCompany',
  roleFull: 'Lead AI Engineer @ TechCompany',
  photo: '',
  talk: 'Building Scalable GenAI Applications with Cloud Architecture',
  room: 'Sala Google',
  kind: 'Talk',
  tags: '#AIAgents #Gemini #Cloud',
  bio: '',
  abstract: "Come si porta in produzione un'applicazione GenAI senza farsi male."
}];
