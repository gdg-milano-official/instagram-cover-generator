// Lettura e normalizzazione dei dati Sessionize. Nessun DOM qui dentro,
// cosi' il mapping resta testabile da node (vedi test.ts).

export type Tipo = 'Talk' | 'Workshop' | 'Masterclass';

// Quello che serve dal payload "view/All": il resto lo ignoro.
export interface SessioneSessionize {
  id: string | number;
  title?: string;
  description?: string | null;
  roomId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isConfirmed?: boolean;
}

export interface SpeakerSessionize {
  id: string | number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  tagLine?: string | null;
  bio?: string | null;
  profilePicture?: string | null;
  sessions?: ({ id: string | number; name?: string } | string | number)[];
}

export interface PayloadSessionize {
  sessions?: SessioneSessionize[];
  speakers?: SpeakerSessionize[];
  rooms?: { id: string | number; name: string }[];
}

// Dati della locandina di uno speaker.
export interface Speaker {
  id: string;
  name: string;
  role: string;
  photo: string;
  talk: string;
  room: string;
  kind: string;   // modificabile a mano sulla locandina
  inizio: string;
  fine: string;
  tags: string;
  roleFull: string;
  bio: string;
  abstract: string;
}

// Le foto passano dal proxy del server, altrimenti html2canvas sporca il
// canvas e l'export PNG fallisce.
export const proxyPhoto = (url: string | null | undefined) =>
  (url || '').replace(/^https:\/\/(cdn\.)?sessionize\.com\/image\//, '/img/');

// Hashtag per argomento, dedotti da titolo + abstract del talk.
// Ordine = priorita'; #AI in fondo fa da rete di sicurezza. Max 3 per locandina.
export const TOPIC_TAGS: [RegExp, string][] = [
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
export function topicTags(title: string, description: string) {
  const hits = (text: string) => TOPIC_TAGS.filter(([re]) => re.test(text)).map(([, tag]) => tag);
  return [...new Set([...hits(title), ...hits(description)])].slice(0, 3);
}

// Le tagline reali arrivano a 165 caratteri separati da "|": tengo il primo
// pezzo, che e' sempre il ruolo vero. Il campo resta editabile sulla card.
export function shortRole(role: string) {
  if (role.length <= 60) return role;
  const first = role.split(/\s*[|•·]\s*/)[0].trim();
  return first.length <= 60 ? first : first.slice(0, 57).trimEnd() + '…';
}

// Alcuni speaker su Sessionize hanno solo il nickname: sulla locandina va il nome vero.
export const NOMI_COMPLETI: Record<string, string> = {
  fabkru: 'Fabian Krumbholz',
  maeste: 'Stefano Maestri',
  haz: 'Harry Zhang',
  seif: 'Seifeddin Mansri'
};

// Sessioni gia' sicure ma non ancora confermate su Sessionize: le tengo lo stesso.
export const CONFERMATE_A_MANO = new Set([
  '1353401'   // Manage AI security posture with the Secure AI Framework
]);

const primaSessione = (sp: SpeakerSessionize) => {
  const s = sp.sessions?.[0];
  return typeof s === 'object' ? s : undefined;
};

const nomeCompleto = (nome: string) => NOMI_COMPLETI[nome.trim().toLowerCase()] || nome;

// Payload "view/All" -> dati della locandina.
// Sessionize non marca i workshop. Nei dati reali stanno nella sala "Workshop"
// e durano 90-135 minuti contro i 45 dei talk: uso entrambi i segnali, cosi'
// regge anche se le sale cambiano nome.
export function tipoSessione(session: Pick<SessioneSessionize, 'title' | 'startsAt' | 'endsAt'> | undefined, sala: string): Tipo {
  const durata = session?.startsAt && session?.endsAt
    ? (Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60000
    : 0;
  // La masterclass sta nella Secret Track ed e' lunga come un workshop, ma non lo e'.
  // Nella stessa sala ci sono anche talk da 20 minuti: quelli restano talk.
  if (/masterclass/i.test(session?.title || '') || (/secret track/i.test(sala) && durata >= 60)) return 'Masterclass';
  return /workshop|\blab\b|hands.?on/i.test(`${sala} ${session?.title || ''}`) || durata >= 60
    ? 'Workshop'
    : 'Talk';
}

export function mapSpeakers(data: PayloadSessionize): Speaker[] {
  const roomName = new Map((data.rooms || []).map((r) => [String(r.id), r.name]));
  const sessions = (data.sessions || []).filter((s) => s.isConfirmed !== false || CONFERMATE_A_MANO.has(String(s.id)));
  const byId = new Map(sessions.map((s) => [String(s.id), s]));

  return (data.speakers || [])
    .map((sp): Speaker | null => {
      const session = (sp.sessions || []).map((s) => byId.get(String(typeof s === 'object' ? s.id : s))).find(Boolean);
      // Speaker senza sessione confermata = non confermato, salvo endpoint senza sessioni.
      if (sessions.length && !session) return null;
      const room = roomName.get(String(session?.roomId)) || '';
      return {
        id: String(sp.id),
        name: nomeCompleto(sp.fullName || `${sp.firstName || ''} ${sp.lastName || ''}`.trim()),
        role: shortRole(sp.tagLine || ''),
        photo: proxyPhoto(sp.profilePicture),
        talk: session?.title || primaSessione(sp)?.name || '',
        room,
        kind: tipoSessione(session, room),
        inizio: session?.startsAt || '',
        fine: session?.endsAt || '',
        tags: topicTags(session?.title || '', session?.description || '').join(' '),
        // non compaiono sulla locandina: servono all'AI per scrivere i post
        roleFull: sp.tagLine || '',
        bio: sp.bio || '',
        abstract: session?.description || ''
      };
    })
    .filter((sp) => sp !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export async function fetchSpeakers(apiId: string) {
  const res = await fetch(`/api/${encodeURIComponent(apiId)}/view/All`);
  if (!res.ok) throw new Error(`Sessionize ha risposto ${res.status}`);
  return mapSpeakers(await res.json());
}

export const DEMO: Speaker[] = [{
  id: 'demo',
  name: 'Mario Rossi',
  role: 'Lead AI Engineer @ TechCompany',
  roleFull: 'Lead AI Engineer @ TechCompany',
  photo: '',
  talk: 'Building Scalable GenAI Applications with Cloud Architecture',
  room: 'Sala Google',
  kind: 'Talk',
  inizio: '',
  fine: '',
  tags: '#AIAgents #Gemini #Cloud',
  bio: '',
  abstract: "Come si porta in produzione un'applicazione GenAI senza farsi male."
}];
