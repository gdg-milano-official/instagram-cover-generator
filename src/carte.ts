// Contenuti per ogni speaker: storia, post, carosello e reel in stop motion.
// Due soggetti: la carta BizzyMagic (public/carte/speaker.json) oppure la foto
// profilo di Sessionize in una polaroid (dati Sessionize caricati dall'app, vedi
// kitDa). Primitive di carta in reel.ts; speaker.json lo genera scripts/carte.ts.
import { BODY, C, DISPLAY, FPS, GOOGLE, H, MONO, W, carica, caricaFont, carta, grana, nastro, pezzo, righe, scritta, sfondo } from './reel.ts';
import type { Ctx, Disegno, Tempi } from './reel.ts';
import { plainEvent } from './posts.ts';
import type { Cfg } from './posts.ts';
import { topicTags } from './sessionize.ts';
import type { Speaker } from './sessionize.ts';

export type Gruppo = 'evento' | 'partner' | 'location' | 'team' | 'collezione';
export type Modo = 'carta' | 'foto';

// Chi finisce su storia, post, carosello e reel: uno speaker del kit, un
// organizzatore o una carta qualsiasi. Senza talk e' una carta "altra".
export interface Soggetto {
  id: string;
  name: string;
  role: string;
  foto?: string;
  carta?: string;
  numero?: string;
  gruppo?: Gruppo;
  kind?: string;
  talk?: string;
  room?: string;
  ora?: string;
  abstract?: string;
  bio?: string;
  coSpeaker?: string[];
  lavoro?: string;
}

export interface KitSpeaker extends Speaker {
  foto: string;
  ora: string;
  coSpeaker: string[];
  carta?: string;
  numero?: string;
  gruppo?: Gruppo;
}

// Organizzatore o sponsor dell'anagrafica.
export interface Persona {
  id: string;
  name: string;
  role: string;
  lavoro?: string;
  foto?: string;
  carta?: string;
  numero?: string;
}
export interface Persone { team: Persona[]; partner: Persona[] }

// Una carta caricata: numero e nome vengono dal nome del file.
export interface Carta { file: string; numero: string; nome: string; url: string }
export type Scelte = Record<string, string | null>;

// Cosa disegnare al posto del soggetto: la carta o la polaroid con la foto.
export type AssetCarta = { grana: HTMLCanvasElement } & (
  | { foto: HTMLImageElement; carta?: undefined }
  | { carta: HTMLImageElement; foto?: undefined });

export const LATO: Record<'storia' | 'post' | 'carosello' | 'reel', [number, number]> = { storia: [W, H], post: [W, 1350], carosello: [W, 1350], reel: [W, H] };
export const SLIDE = 4;

// Un'immagine del kit: nome del file, formato e come disegnarla.
export type Immagine = [nome: string, formato: keyof typeof LATO, disegna: (c: Ctx, a: AssetCarta, sp: Soggetto, cfg: Cfg) => void];
export const FRAMES_CARTA = 12 * FPS;

const RAPPORTO = 1039 / 744;   // le carte sono 6,3x8,8 cm
const FERMO = 500;             // un fotogramma qualsiasi a pezzi gia' in posa
const GIALLO = '#ffd45b', AZZURRO = '#90d1ff';
const KICKER = 'Nuova carta sbloccata!';
const GIORNO = 'Sab 10 ottobre';

// modo 'foto': polaroid con la foto Sessionize al posto della carta.
export async function preparaCarta(sp: Soggetto, modo: Modo = 'carta'): Promise<AssetCarta> {
  await caricaFont();
  return modo === 'foto'
    ? { grana: grana(), foto: await carica(sp.foto || '') }
    : { grana: grana(), carta: await carica(sp.carta || '') };
}

const kicker = (a: AssetCarta, sp: Soggetto) => (!a.foto ? KICKER : sp.gruppo === 'team' ? 'Ti presentiamo il team!'
  : ['Workshop', 'Masterclass'].includes(sp.kind || '') ? `${sp.kind} di sabato!` : 'Sul palco sabato!');

/* ---------- Pezzi ---------- */

// La carta da gioco, con gli angoli tondi delle carte vere.
function cartaGioco(c: Ctx, img: HTMLImageElement, w: number) {
  const h = w * RAPPORTO;
  c.save();
  c.shadowColor = 'rgba(30,20,5,.4)'; c.shadowBlur = 28; c.shadowOffsetX = 6; c.shadowOffsetY = 14;
  c.fillStyle = '#111';
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, w * 0.04); c.fill();
  c.restore();
  c.save();
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, w * 0.04); c.clip();
  c.drawImage(img, -w / 2, -h / 2, w, h);
  c.restore();
}

// La polaroid con la foto profilo. `sviluppo` da 0 a 1: nel reel si sviluppa a scatti.
function polaroid(c: Ctx, img: HTMLImageElement, w: number, sviluppo = 1) {
  const h = w * 1.18, lato = w * 0.88, x = -lato / 2, y = -h / 2 + (w - lato) / 2;
  carta(c, w, h, '#fbfaf5', 3);
  c.fillStyle = '#2b2a28';
  c.fillRect(x, y, lato, lato);
  c.save();
  c.globalAlpha = sviluppo;
  c.drawImage(img, x, y, lato, lato);
  c.restore();
  if (sviluppo < 1) {
    c.fillStyle = `rgba(120,90,40,${(1 - sviluppo) * 0.35})`;
    c.fillRect(x, y, lato, lato);
  }
}

// Carta o polaroid, a seconda di cosa c'e' in `a`.
const soggetto = (c: Ctx, a: AssetCarta, w: number) => (a.foto ? polaroid(c, a.foto, w) : cartaGioco(c, a.carta, w));

// Il dorso, prima che la carta si giri.
function dorso(c: Ctx, w: number) {
  const h = w * RAPPORTO;
  c.save();
  c.shadowColor = 'rgba(30,20,5,.4)'; c.shadowBlur = 28; c.shadowOffsetY = 14;
  c.fillStyle = '#15182b';
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, w * 0.04); c.fill();
  c.restore();
  c.strokeStyle = '#c9a75a'; c.lineWidth = w * 0.02;
  c.beginPath(); c.roundRect(-w / 2 + w * 0.06, -h / 2 + w * 0.06, w * 0.88, h - w * 0.12, w * 0.03); c.stroke();
  GOOGLE.forEach((col, i) => {
    c.fillStyle = col;
    c.beginPath(); c.arc((i - 1.5) * w * 0.14, -h * 0.06, w * 0.045, 0, Math.PI * 2); c.fill();
  });
  scritta(c, 'BizzyMagic', { size: w * 0.09, color: '#c9a75a', font: MONO, weight: 700 });
  c.translate(0, h * 0.09);
  scritta(c, 'DevFest Milano 2026', { size: w * 0.05, color: '#f4efe4', font: MONO, weight: 500 });
}

// Striscia di carta o post-it attorno a un testo: altezza nota prima di disegnarla,
// cosi' i pezzi si impilano senza sovrapporsi qualunque sia la lunghezza del titolo.
interface Blocco { h: number; draw: Disegno }
interface Voce extends Blocco, Partial<Tempi> { id?: number; x?: number; rot?: number }
// `cond && voce`: quelle false restano fuori dalla pila.
type Forse<T> = T | false | '' | 0 | null | undefined;
const presenti = (voci: Forse<Voce>[]) => voci.filter((v): v is Voce => Boolean(v));

function blocco(ctx: Ctx, s: string, { size, font = DISPLAY, weight = 800, maxW = 900, colore = '#fff', color = C.ink, postit = false }: {
  size: number; font?: string; weight?: number; maxW?: number; colore?: string; color?: string; postit?: boolean;
}): Blocco {
  ctx.font = `${weight} ${size}px ${font}`;
  const r = righe(ctx, s, maxW);
  const w = Math.max(...r.map((t) => ctx.measureText(t).width)) + size * (postit ? 1.6 : 0.9);
  const h = r.length * size * 1.12 + size * (postit ? 1.2 : 0.6);
  return {
    h,
    draw: (c) => {
      carta(c, w, h, colore, postit ? 2 : 4);
      if (postit) nastro(c, 0, -h / 2, 4);
      scritta(c, s, { size, color, font, weight, maxW });
    }
  };
}

// Pezzi uno sotto l'altro a partire da y; restituisce dove finisce la pila.
function pila(ctx: Ctx, f: number, { x = W / 2, y, gap = 20 }: { x?: number; y: number; gap?: number }, voci: Forse<Voce>[]) {
  let cima = y;
  presenti(voci).forEach((v, i) => {
    pezzo(ctx, f, v.id ?? 900 + i, {
      x: v.x ?? x, y: cima + v.h / 2, rot: v.rot ?? 0, in: v.in ?? 0, da: v.da, dur: v.dur, out: v.out
    }, v.draw);
    cima += v.h + gap;
  });
  return cima;
}

// Il pezzo si porta dietro posizione e tempi.
const con = (b: Blocco, opz: Omit<Voce, keyof Blocco>): Voce => ({ ...b, ...opz });

function testata(ctx: Ctx, f: number, cfg: Cfg, y: number, inizio = 0, larghezza = W) {
  GOOGLE.forEach((colore, i) => pezzo(ctx, f, 10 + i,
    { x: larghezza / 2 + (i - 1.5) * 70, y, in: inizio + i, da: [0, -500], dur: 3 }, (c) => {
      c.save();
      c.shadowColor = 'rgba(40,30,10,.3)'; c.shadowBlur = 10; c.shadowOffsetY = 5;
      c.fillStyle = colore;
      c.beginPath(); c.arc(0, 0, 24, 0, Math.PI * 2); c.fill();
      c.restore();
    }));
  const b = blocco(ctx, plainEvent(cfg), { size: 34, font: MONO, weight: 700, colore: C.ink, color: '#fff' });
  pezzo(ctx, f, 20, { x: larghezza / 2, y: y + 70, rot: -1.5, in: inizio + 4, da: [0, -400] }, b.draw);
}

const numero = (ctx: Ctx, sp: Soggetto, size = 28) =>
  blocco(ctx, `Carta ${sp.numero}`, { size, font: MONO, weight: 700, colore: C.ink, color: '#fff' });
const info = (ctx: Ctx, sp: Soggetto, size: number, maxW = 900) =>
  blocco(ctx, `${GIORNO} · ${sp.ora} · ${sp.room}`, { size, font: MONO, weight: 500, colore: C.blue, color: '#fff', maxW });
const tipo = (ctx: Ctx, sp: Soggetto, size: number) => blocco(ctx, `🎤 ${sp.kind}`, { size, colore: AZZURRO, postit: true });
const titolo = (ctx: Ctx, sp: Soggetto, size: number, maxW: number) => blocco(ctx, sp.talk || '', { size, maxW });

// Le prime frasi dell'abstract, senza superare `max` caratteri.
export function estratto(testo: string | null | undefined, max = 280) {
  const pulito = String(testo || '').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
  if (pulito.length <= max) return pulito;
  const frasi = pulito.match(/[^.!?]+[.!?]+/g) || [];
  let out = '';
  for (const fr of frasi) { if ((out + fr).length > max) break; out += fr; }
  return out.trim() || `${pulito.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/* ---------- Reel (12 s) ---------- */

export function disegnaReelCarta(ctx: Ctx, f: number, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  sfondo(ctx, f, a);
  testata(ctx, f, cfg, 200, 1);

  // La carta arriva coperta e si gira in sei scatti; la polaroid si sviluppa in sei.
  const giro = [1, 0.55, 0.12, 0.12, 0.55, 1];
  const sx = f >= 22 && f < 28 ? giro[f - 22] : 1;
  pezzo(ctx, f, 700, { x: W / 2, y: 830, rot: -2, in: 10, da: [0, 1300], dur: 5 }, (c) => {
    if (a.foto) return polaroid(c, a.foto, 620, Math.min(1, Math.max(0, Math.floor((f - 14) / 3) / 6)));
    c.scale(sx, 1);
    if (f >= 25) cartaGioco(c, a.carta, 600); else dorso(c, 600);
  });
  pezzo(ctx, f, 701, { x: W / 2 - 30, y: 410, rot: -5, in: 30, da: [0, -700] },
    blocco(ctx, kicker(a, sp), { size: 54, colore: GIALLO, postit: true }).draw);
  if (sp.numero) pezzo(ctx, f, 702, { x: 790, y: 1235, rot: 7, in: 36, da: [400, 0], dur: 3 }, numero(ctx, sp, 30).draw);

  // Prima chi e', poi cosa porta.
  // Gli speaker lasciano il posto al talk; le altre carte tengono il nome fino alla fine.
  const fineNome = pila(ctx, f, { y: 1300 }, [
    con(blocco(ctx, sp.name, { size: 70, maxW: 940 }), { id: 703, rot: -1.5, in: 44, da: [-1300, 0], out: sp.talk ? 80 : Infinity }),
    sp.role && con(blocco(ctx, sp.role, { size: 34, font: BODY, weight: 700, maxW: 880 }), { id: 704, rot: 1, in: 49, da: [1300, 0], out: sp.talk ? 81 : Infinity })
  ]);
  const hashtag = con(blocco(ctx, cfg.hashtag, { size: 36, font: MONO, weight: 700, colore: 'rgba(0,0,0,0)' }), { id: 708, rot: 2, in: 108, da: [0, 300], dur: 3 });
  // Le carte senza talk (evento, partner, team, collezione) chiudono con l'invito sotto il nome.
  pila(ctx, f, { y: sp.talk ? 1300 : fineNome + 10, gap: 18 }, sp.talk ? [
    con(tipo(ctx, sp, 40), { id: 705, rot: -3, in: 86, da: [0, -300], dur: 3 }),
    con(titolo(ctx, sp, 46, 920), { id: 706, rot: 1, in: 90, da: [1300, 0] }),
    con(info(ctx, sp, 32), { id: 707, rot: -1, in: 100, da: [-1300, 0] }),
    hashtag
  ] : [
    con(blocco(ctx, 'Sab 10 ottobre · Randstad Box, Milano', { size: 34, font: MONO, weight: 700, colore: C.blue, color: '#fff' }), { id: 706, rot: 1, in: 86, da: [-1300, 0] }),
    con(sp.gruppo === 'team' ? volontari(ctx, cfg, 38) : blocco(ctx, '🎟️ Biglietti al link in bio', { size: 42, colore: C.red, color: '#fff' }),
      { id: 707, rot: -2, in: 100, da: [0, -200], dur: 3 }),
    hashtag
  ]);
}

/* ---------- Storia (1080x1920, statica) ---------- */

export function disegnaStoria(ctx: Ctx, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  const f = FERMO;
  sfondo(ctx, f, a);
  testata(ctx, f, cfg, 290);
  pezzo(ctx, f, 701, { x: W / 2, y: a.foto ? 870 : 900, rot: -2 }, (c) => soggetto(c, a, a.foto ? 600 : 540));
  pezzo(ctx, f, 702, { x: W / 2 - 20, y: 500, rot: -5 }, blocco(ctx, kicker(a, sp), { size: 50, colore: GIALLO, postit: true }).draw);
  if (sp.numero) pezzo(ctx, f, 703, { x: 780, y: 1245, rot: 7 }, numero(ctx, sp).draw);
  pila(ctx, f, { y: 1310, gap: 16 }, [
    con(blocco(ctx, sp.name, { size: 58, maxW: 940 }), { id: 704, rot: -1.5 }),
    con(blocco(ctx, `${sp.kind} · ${sp.talk}`, { size: 38, maxW: 900 }), { id: 705, rot: 1 }),
    con(info(ctx, sp, 30), { id: 706, rot: -1 })
  ]);
}

/* ---------- Post (1080x1350) ---------- */

export function disegnaPost(ctx: Ctx, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  const f = FERMO, [w, h] = LATO.post;
  sfondo(ctx, f, a, w, h);
  testata(ctx, f, cfg, 90);
  pezzo(ctx, f, 701, { x: 300, y: 740, rot: -4 }, (c) => soggetto(c, a, 500));
  if (sp.numero) pezzo(ctx, f, 702, { x: 420, y: 1130, rot: 6 }, numero(ctx, sp, 26).draw);
  pila(ctx, f, { x: 800, y: 250, gap: 22 }, [
    con(blocco(ctx, kicker(a, sp), { size: 40, colore: GIALLO, postit: true, maxW: 360 }), { id: 703, rot: 4 }),
    con(blocco(ctx, sp.name, { size: 56, maxW: 430 }), { id: 704, rot: -2 }),
    sp.role && con(blocco(ctx, sp.role, { size: 30, font: BODY, weight: 700, maxW: 420 }), { id: 705, rot: 1 }),
    con(tipo(ctx, sp, 32), { id: 706, rot: -3 }),
    con(titolo(ctx, sp, 40, 430), { id: 707, rot: 1.5 }),
    con(info(ctx, sp, 26, 430), { id: 708, rot: -1 })
  ]);
  pezzo(ctx, f, 709, { x: w / 2, y: 1285 }, (c) => scritta(c, cfg.hashtag, { size: 30, font: MONO, weight: 700 }));
}

/* ---------- Carosello (4 slide 1080x1350) ---------- */

export function disegnaCarosello(ctx: Ctx, i: number, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  const f = FERMO + i * 7, [w, h] = LATO.carosello;
  sfondo(ctx, f, a, w, h);

  if (i === 0) {
    testata(ctx, f, cfg, 90);
    pezzo(ctx, f, 701, { x: w / 2, y: a.foto ? 780 : 790, rot: 3 }, (c) => soggetto(c, a, a.foto ? 640 : 600));
    pezzo(ctx, f, 702, { x: w / 2 - 20, y: 300, rot: -4 }, blocco(ctx, kicker(a, sp), { size: 54, colore: GIALLO, postit: true }).draw);
    pezzo(ctx, f, 703, { x: w / 2, y: 1270, rot: -1 },
      blocco(ctx, 'Scorri per scoprire chi è 👉', { size: 30, font: MONO, weight: 700, colore: C.ink, color: '#fff' }).draw);
    return;
  }

  if (i === 1 && a.foto) {
    // Senza carta: chi e', con la bio di Sessionize.
    pezzo(ctx, f, 710, { x: 270, y: 320, rot: -5 }, (c) => polaroid(c, a.foto, 400));
    const voci = [
      con(blocco(ctx, sp.name, { size: 66, maxW: 520 }), { id: 711, rot: -1.5, x: 750 }),
      sp.role && con(blocco(ctx, sp.role, { size: 32, font: BODY, weight: 700, maxW: 500 }), { id: 712, rot: 1, x: 750 })
    ].filter(Boolean);
    pila(ctx, f, { y: 180 }, voci);
    pila(ctx, f, { y: 640, gap: 26 }, [
      sp.coSpeaker?.length && con(blocco(ctx, `insieme a ${sp.coSpeaker.join(' e ')}`, { size: 34, colore: GIALLO, postit: true }), { id: 713, rot: -3 }),
      sp.bio && con(blocco(ctx, estratto(sp.bio, 420), { size: 40, font: BODY, weight: 500, maxW: 920 }), { id: 714, rot: -0.8 })
    ]);
    return;
  }

  if (i === 1) {
    // Polaroid col ritratto: e' la parte illustrata della carta.
    pezzo(ctx, f, 710, { x: w / 2, y: 450, rot: -2.5 }, (c) => {
      carta(c, 820, 660, '#fff', 3);
      c.drawImage(a.carta!, 40, 135, 664, 465, -380, -300, 760, 532);
      nastro(c, -330, -330, -25);
      nastro(c, 330, -330, 25);
    });
    pila(ctx, f, { y: 830 }, [
      con(blocco(ctx, sp.name, { size: 74, maxW: 960 }), { id: 711, rot: -1.5 }),
      sp.role && con(blocco(ctx, sp.role, { size: 34, font: BODY, weight: 700, maxW: 900 }), { id: 712, rot: 1 }),
      sp.coSpeaker?.length && con(blocco(ctx, `insieme a ${sp.coSpeaker.join(' e ')}`, { size: 34, colore: GIALLO, postit: true }), { id: 713, rot: -3 }),
      sp.numero && con(numero(ctx, sp, 30), { id: 714, rot: 3 })
    ]);
    return;
  }

  if (i === 2) {
    const voci = presenti([
      con(tipo(ctx, sp, 48), { id: 720, rot: -3 }),
      con(titolo(ctx, sp, 64, 960), { id: 721, rot: 1 }),
      sp.abstract && con(blocco(ctx, estratto(sp.abstract, 300), { size: 38, font: BODY, weight: 500, maxW: 900 }), { id: 722, rot: -0.8 }),
      con(info(ctx, sp, 34, 960), { id: 723, rot: 1.5 })
    ]);
    const alto = voci.reduce((n, v) => n + v.h + 28, -28);
    pila(ctx, f, { y: Math.max(50, (h - alto) / 2), gap: 28 }, voci);
    return;
  }

  testata(ctx, f, cfg, 90);
  if (a.foto) pezzo(ctx, f, 730, { x: w / 2, y: 490, rot: -5 }, (c) => polaroid(c, a.foto, 400));
  else {
    pezzo(ctx, f, 730, { x: 330, y: 520, rot: -9 }, (c) => cartaGioco(c, a.carta, 340));
    pezzo(ctx, f, 731, { x: 720, y: 540, rot: 7 }, (c) => dorso(c, 340));
  }
  pila(ctx, f, { y: 820 }, [
    con(blocco(ctx, 'Ci vediamo sabato 10 ottobre!', { size: 56, maxW: 940 }), { id: 732, rot: -1.5 }),
    con(blocco(ctx, 'Randstad Box · Milano', { size: 34, font: MONO, weight: 700, colore: C.blue, color: '#fff' }), { id: 733, rot: 1 }),
    con(blocco(ctx, '🎟️ Biglietti al link in bio', { size: 40, colore: C.red, color: '#fff' }), { id: 734, rot: -2 })
  ]);
  pezzo(ctx, f, 735, { x: w / 2, y: 1285 }, (c) => scritta(c, cfg.hashtag, { size: 30, font: MONO, weight: 700 }));
}

/* ---------- Caption ---------- */

const ARTICOLI: Record<string, string> = { Workshop: 'il workshop', Masterclass: 'la masterclass', 'Lightning talk': 'il lightning talk' };
const articolo = (kind: string) => ARTICOLI[kind] || 'il talk';

export function captionCarta(sp: KitSpeaker, cfg: Cfg) {
  const insieme = sp.coSpeaker?.length ? ` insieme a ${sp.coSpeaker.join(' e ')}` : '';
  const tags = [cfg.hashtag, '#DevFest', '#GDG', '#BizzyMagic', ...topicTags(sp.talk, sp.abstract)];
  return `🃏 ${KICKER}${sp.numero ? ` Carta ${sp.numero}:` : ''} ${sp.name}

${sp.name}${sp.role ? `, ${sp.role},` : ''} porta alla ${plainEvent(cfg)}${insieme} ${articolo(sp.kind)} "${sp.talk}".

📅 Sabato 10 ottobre · 🕘 ${sp.ora} · 📍 Sala ${sp.room}, Randstad Box
🎟️ Biglietti al link in bio

${[...new Set(tags)].join(' ')}`;
}

// Gli speaker Sessionize nella forma che usano storia, post, carosello e reel.
// Sessionize da' gli orari gia' in ora locale ("2026-10-10T09:30:00").
export function kitDa(speakers: Speaker[]): KitSpeaker[] {
  const ora = (iso: string) => String(iso).slice(11, 16);
  return speakers.filter((sp) => sp.id !== 'demo' && sp.talk).map((sp) => ({
    ...sp,
    foto: sp.photo,
    ora: `${ora(sp.inizio)}–${ora(sp.fine)}`,
    coSpeaker: speakers.filter((a) => a.id !== sp.id && a.talk === sp.talk).map((a) => a.name)
  })).sort((a, b) => a.inizio.localeCompare(b.inizio) || a.name.localeCompare(b.name, 'it'));
}

/* ---------- Carte caricate dalla UI ---------- */

// Le carte che non sono di uno speaker: il gruppo decide sottotitolo e caption.
// Per nome valgono questi, usati anche da scripts/carte.ts; nella sezione
// Carica carte organizzatori e sponsor vengono invece dall'anagrafica.
export const RUOLI: Record<Gruppo, string> = {
  evento: 'La carta dell’evento',
  partner: 'Partner della DevFest Milano 2026',
  location: 'La location della DevFest Milano 2026',
  team: 'Team DevFest Milano',
  collezione: 'Una carta BizzyMagic della DevFest Milano 2026'
};
const GRUPPI: [RegExp, Gruppo][] = [
  [/^(DevFest Milano|DevFest Milano HOLO)$/, 'evento'],
  [/^(BizzyNow|Google|Datwave)$/, 'partner'],
  [/^Randstad Box$/, 'location'],
  [/^(Manuel Caldarese|Davide Tresoldi|Daniele Bonaldo|Lorenzo De Francesco|Matteo Rocco)$/, 'team']
];
export const gruppoDi = (nome: string): Gruppo => GRUPPI.find(([re]) => re.test(nome))?.[1] || 'collezione';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z]/g, '');

// "NN.Nome_Cognome (...).png", come in scripts/carte.ts: numero e nome dal file.
export function cartaDaFile(file: string) {
  return {
    file,
    numero: file.match(/^(\d+)\./)?.[1] || '',
    nome: file.replace(/^\d+\.|\s*\(.*$|\.\w+$/g, '').replace(/_/g, ' ').trim()
  };
}

// id speaker -> file della carta. `scelte` sono gli abbinamenti fatti a mano
// (null = scollegato apposta); gli altri speaker si abbinano per nome.
export function abbinamenti(speakers: { id: string; name: string }[], carte: Carta[], scelte: Scelte): Scelte {
  const caricata = (file: string | null): file is string => carte.some((c) => c.file === file);
  const prese = new Set(Object.values(scelte).filter(caricata));
  return Object.fromEntries(speakers.map((sp) => [sp.id, sp.id in scelte
    ? (caricata(scelte[sp.id]) ? scelte[sp.id] : null)
    : carte.find((c) => !prese.has(c.file) && norm(c.nome) === norm(sp.name))?.file || null]));
}

// Speaker, organizzatori e sponsor con la carta caricata e le carte rimaste,
// nella forma che usano i kit. `speakers` da kitDa, `persone` dall'anagrafica.
export function kitCaricato<S extends { id: string; name: string }>(speakers: S[], carte: Carta[], scelte: Scelte, persone: Persone = { team: [], partner: [] }) {
  const team = persone.team.map((p) => ({ ...p, gruppo: 'team' as const }));
  const partner = persone.partner.map((p) => ({ ...p, gruppo: 'partner' as const }));
  const collegate = abbinamenti([...speakers, ...team, ...partner], carte, scelte);
  const totale = String(Math.max(0, ...carte.map((c) => Number(c.numero)))).padStart(3, '0');
  const numero = (c: Carta) => (c.numero ? `${c.numero.padStart(3, '0')}/${totale}` : '');
  const perFile = new Map(carte.map((c) => [c.file, c]));
  const conCarta = (sp: { id: string }) => {
    const c = perFile.get(collegate[sp.id] ?? '');
    return c && { carta: c.url, numero: numero(c) };
  };
  const usate = new Set(Object.values(collegate));
  const altre: Soggetto[] = [
    ...[...team, ...partner].filter((p) => collegate[p.id]).map((p) => ({
      id: p.id, name: p.name, role: p.role || RUOLI[p.gruppo], gruppo: p.gruppo, ...conCarta(p)
    })),
    ...carte.filter((c) => !usate.has(c.file)).map((c, i) => {
      const gruppo = gruppoDi(c.nome);
      return { id: `carta-${i + 1}`, name: c.nome, role: RUOLI[gruppo], gruppo, carta: c.url, numero: numero(c) };
    })
  ];
  return {
    collegate,
    vuoto: !carte.length,
    // foto vuota: senza, il kit disegnerebbe la polaroid al posto della carta
    speaker: speakers.filter((sp) => collegate[sp.id]).map((sp) => ({ ...sp, foto: '', ...conCarta(sp) })),
    // senza carta caricata un organizzatore tiene quella che ha gia' (team.json)
    team: team.map((p) => ({ ...p, ...conCarta(p) })),
    altre
  };
}

export type KitCaricato = ReturnType<typeof kitCaricato<KitSpeaker>>;

// Caption del kit senza carta.
export function captionKit(sp: KitSpeaker, cfg: Cfg) {
  const insieme = sp.coSpeaker?.length ? ` insieme a ${sp.coSpeaker.join(' e ')}` : '';
  const tags = [cfg.hashtag, '#DevFest', '#GDG', ...topicTags(sp.talk, sp.abstract)];
  const apertura = sp.kind === 'Workshop' ? `🛠️ Sabato c'è il workshop di ${sp.name}!`
    : sp.kind === 'Masterclass' ? `✨ Sabato c'è la masterclass di ${sp.name}!` : `🎤 Sabato sul palco c'è ${sp.name}!`;
  return `${apertura}

${sp.name}${sp.role ? `, ${sp.role},` : ''} porta alla ${plainEvent(cfg)}${insieme} ${articolo(sp.kind)} "${sp.talk}".

📅 Sabato 10 ottobre · 🕘 ${sp.ora} · 📍 Sala ${sp.room}, Randstad Box
🎟️ Biglietti al link in bio

${[...new Set(tags)].join(' ')}`;
}

// Caption delle carte che non sono di uno speaker: dipende dal gruppo.
const PRESENTA: Record<Gruppo, (c: Soggetto) => string> = {
  evento: () => `è la carta dell'evento: ci vediamo sabato 10 ottobre al Randstad Box!`,
  partner: (c) => `${c.name} è partner della DevFest Milano 2026. Grazie per essere al nostro fianco! 💙`,
  location: () => `il Randstad Box è la casa della DevFest Milano 2026: Via San Vigilio 5, Milano, M2 Famagosta.`,
  team: (c) => `${c.name} fa parte del team che organizza la DevFest Milano 2026. Lo trovi sabato tra un talk e l'altro!`,
  collezione: (c) => `${c.name} è una delle carte BizzyMagic della DevFest Milano 2026.`
};

export function captionAltra(c: Soggetto, cfg: Cfg) {
  return `🃏 ${KICKER}${c.numero ? ` Carta ${c.numero}:` : ''} ${c.name}

${PRESENTA[c.gruppo || 'collezione'](c)}

📅 Sabato 10 ottobre · 📍 Randstad Box, Milano
🎟️ Biglietti al link in bio

${cfg.hashtag} #DevFest #GDG #BizzyMagic`;
}

/* ---------- Organizzatori (public/carte/team.json, da scripts/team.ts) ---------- */

// Niente talk: chi e', che GDG organizza e cosa fa di lavoro. I testi non dicono
// "ci vediamo sabato", cosi' il kit si puo' usare anche dopo l'evento.
const DOVE = 'Sab 10 ottobre · Randstad Box, Milano';
const dove = (ctx: Ctx, size: number, maxW = 900) => blocco(ctx, DOVE, { size, font: MONO, weight: 700, colore: C.blue, color: '#fff', maxW });
const lavoro = (ctx: Ctx, sp: Soggetto, size: number, maxW: number) => blocco(ctx, sp.lavoro || '', { size, font: BODY, weight: 700, maxW });
const squadra = (ctx: Ctx, size: number, maxW?: number) => blocco(ctx, '🙌 Team DevFest Milano', { size, colore: AZZURRO, postit: true, maxW });
function volontari(ctx: Ctx, cfg: Cfg, size: number) {
  return blocco(ctx, `Volontari di ${cfg.organizers}`, { size, colore: C.red, color: '#fff', maxW: 960 });
}

export function disegnaStoriaTeam(ctx: Ctx, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  const f = FERMO;
  sfondo(ctx, f, a);
  testata(ctx, f, cfg, 290);
  pezzo(ctx, f, 701, { x: W / 2, y: a.foto ? 870 : 900, rot: -2 }, (c) => soggetto(c, a, a.foto ? 600 : 540));
  pezzo(ctx, f, 702, { x: W / 2 - 20, y: 500, rot: -5 }, blocco(ctx, kicker(a, sp), { size: 50, colore: GIALLO, postit: true }).draw);
  if (sp.numero) pezzo(ctx, f, 703, { x: 780, y: 1245, rot: 7 }, numero(ctx, sp).draw);
  pila(ctx, f, { y: 1310, gap: 16 }, [
    con(blocco(ctx, sp.name, { size: 58, maxW: 940 }), { id: 704, rot: -1.5 }),
    con(blocco(ctx, sp.role, { size: 38, maxW: 900 }), { id: 705, rot: 1 }),
    sp.lavoro && con(lavoro(ctx, sp, 30, 880), { id: 706, rot: -1 }),
    con(dove(ctx, 30), { id: 707, rot: 1 })
  ]);
}

export function disegnaPostTeam(ctx: Ctx, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  const f = FERMO, [w] = LATO.post;
  sfondo(ctx, f, a, w, LATO.post[1]);
  testata(ctx, f, cfg, 90);
  pezzo(ctx, f, 701, { x: 300, y: 740, rot: -4 }, (c) => soggetto(c, a, 500));
  if (sp.numero) pezzo(ctx, f, 702, { x: 420, y: 1130, rot: 6 }, numero(ctx, sp, 26).draw);
  pila(ctx, f, { x: 800, y: 280, gap: 22 }, [
    con(blocco(ctx, kicker(a, sp), { size: 40, colore: GIALLO, postit: true, maxW: 360 }), { id: 703, rot: 4 }),
    con(blocco(ctx, sp.name, { size: 56, maxW: 430 }), { id: 704, rot: -2 }),
    con(blocco(ctx, sp.role, { size: 34, maxW: 430 }), { id: 705, rot: 1 }),
    sp.lavoro && con(lavoro(ctx, sp, 28, 420), { id: 706, rot: -1.5 }),
    con(squadra(ctx, 32, 400), { id: 707, rot: -3 }),
    con(dove(ctx, 26, 430), { id: 708, rot: 1 })
  ]);
  pezzo(ctx, f, 709, { x: w / 2, y: 1285 }, (c) => scritta(c, cfg.hashtag, { size: 30, font: MONO, weight: 700 }));
}

export function disegnaCaroselloTeam(ctx: Ctx, i: number, a: AssetCarta, sp: Soggetto, cfg: Cfg) {
  const f = FERMO + i * 7, [w, h] = LATO.carosello;
  // copertina uguale a quella degli speaker
  if (i === 0) return disegnaCarosello(ctx, 0, a, sp, cfg);
  sfondo(ctx, f, a, w, h);

  if (i === 1) {
    // Il ritratto: la polaroid con la foto, o la parte illustrata della carta.
    pezzo(ctx, f, 710, { x: w / 2, y: 450, rot: -2.5 }, a.foto ? (c) => polaroid(c, a.foto, 560) : (c) => {
      carta(c, 820, 660, '#fff', 3);
      c.drawImage(a.carta, 40, 135, 664, 465, -380, -300, 760, 532);
      nastro(c, -330, -330, -25);
      nastro(c, 330, -330, 25);
    });
    pila(ctx, f, { y: 830 }, [
      con(blocco(ctx, sp.name, { size: 74, maxW: 960 }), { id: 711, rot: -1.5 }),
      con(blocco(ctx, sp.role, { size: 40, maxW: 900 }), { id: 712, rot: 1 }),
      sp.lavoro && con(lavoro(ctx, sp, 34, 900), { id: 713, rot: -1 }),
      sp.numero && con(numero(ctx, sp, 30), { id: 714, rot: 3 })
    ]);
    return;
  }

  if (i === 2) {
    const voci = [
      con(squadra(ctx, 48), { id: 720, rot: -3 }),
      con(blocco(ctx, `${sp.name.split(' ')[0]} è tra chi organizza la ${plainEvent(cfg)}`, { size: 64, maxW: 960 }), { id: 721, rot: 1 }),
      con(blocco(ctx, `La DevFest Milano è organizzata interamente da volontari di ${cfg.organizers}.`,
        { size: 38, font: BODY, weight: 500, maxW: 900 }), { id: 722, rot: -0.8 }),
      con(dove(ctx, 34, 960), { id: 723, rot: 1.5 })
    ];
    const alto = voci.reduce((n, v) => n + v.h + 28, -28);
    pila(ctx, f, { y: Math.max(50, (h - alto) / 2), gap: 28 }, voci);
    return;
  }

  testata(ctx, f, cfg, 90);
  if (a.foto) pezzo(ctx, f, 730, { x: w / 2, y: 490, rot: -5 }, (c) => polaroid(c, a.foto, 400));
  else {
    pezzo(ctx, f, 730, { x: 330, y: 520, rot: -9 }, (c) => cartaGioco(c, a.carta, 340));
    pezzo(ctx, f, 731, { x: 720, y: 540, rot: 7 }, (c) => dorso(c, 340));
  }
  pila(ctx, f, { y: 820 }, [
    con(blocco(ctx, 'Grazie a tutto il team! 💙', { size: 56, maxW: 940 }), { id: 732, rot: -1.5 }),
    con(dove(ctx, 34), { id: 733, rot: 1 }),
    con(volontari(ctx, cfg, 34), { id: 734, rot: -2 })
  ]);
  pezzo(ctx, f, 735, { x: w / 2, y: 1285 }, (c) => scritta(c, cfg.hashtag, { size: 30, font: MONO, weight: 700 }));
}

// `carta`: se il kit usa la carta BizzyMagic o la foto del sito.
export function captionTeam(sp: Soggetto, cfg: Cfg, carta: boolean) {
  const gdg = sp.role.replace(/^Organizzat\w+\s+/i, '');
  const tags = [cfg.hashtag, '#DevFest', '#GDG', `#${gdg.replace(/\s+/g, '')}`, ...(carta ? ['#BizzyMagic'] : [])];
  const apertura = carta ? `🃏 ${KICKER}${sp.numero ? ` Carta ${sp.numero}:` : ''} ${sp.name}` : `🙌 Ti presentiamo il team: ${sp.name}`;
  return `${apertura}

Dietro la ${plainEvent(cfg)} c'è anche ${sp.name}: organizza ${gdg}${sp.lavoro ? ` ed è ${sp.lavoro}` : ''}.

La DevFest Milano è organizzata interamente da volontari di ${cfg.organizers}. 💙

📅 Sabato 10 ottobre · 📍 Randstad Box, Milano

${[...new Set(tags)].join(' ')}`;
}
