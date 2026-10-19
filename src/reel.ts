// Reel in stop motion per i partner: 1080x1920, 12 pose al secondo. Ogni
// pezzo e' un ritaglio di carta che entra a scatti e trema un po' tra una posa
// e l'altra, come spostato a mano. Il tremolio e' deterministico: la stessa
// posa esce uguale in anteprima e nel video. Il DOM serve solo a runtime.
// Le scene sono le stesse per tutti; cosa cambia sta in PARTNER.
import { plainEvent } from './posts.ts';
import type { Cfg } from './posts.ts';

export type Ctx = CanvasRenderingContext2D;
export type Disegno = (ctx: Ctx) => void;

export const W = 1080;
export const H = 1920;
export const FPS = 12;
export const FRAMES = 16 * FPS;

export const C = {
  ink: '#17150f', paper: '#f4efe4',
  blue: '#4285f4', red: '#ea4335', yellow: '#fbbc04', green: '#34a853'
};
export const GOOGLE = [C.blue, C.red, C.yellow, C.green];
export const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
export const BODY = '"Hanken Grotesk", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface TestiPartner {
  kicker: string; claim: string; titolo: string;
  punto1: string; punto2: string; punto3: string;
  cta: string; ctaSub: string; data: string;
}

export interface Partner {
  nome: string;
  asset: string;
  logo: { file: string; ratio: number; simbolo: number[]; perno: number[]; gradi: number[] };
  immagini: string[];
  cornice: 'telefono' | 'foto';
  colori: { ink: string; accento: string; postit: string[] };
  testi: TestiPartner;
  caption: (cfg: Cfg) => string;
}

// logo: SVG con le proporzioni del viewBox e il riquadro del simbolo che si
// anima da solo (frazioni del logo), col perno della rotazione nel riquadro.
// cornice: 'telefono' per le schermate dell'app, 'foto' per immagini qualsiasi.
export const PARTNER: Record<string, Partner> = {
  bizzynow: {
    nome: 'BizzyNow',
    asset: '/partner/bizzynow',
    logo: { file: 'logo.svg', ratio: 1294.67 / 345.57, simbolo: [0, 0, 0.24, 1], perno: [0.5, 0.85], gradi: [12, -10] },
    immagini: ['nearby.png', 'contacts.png', 'chat.png'],
    cornice: 'telefono',
    colori: { ink: '#243569', accento: '#ec691c', postit: ['#ffd45b', '#90d1ff', '#ff9996'] },
    testi: {
      kicker: 'Il nostro partner',
      claim: 'Networking in tempo reale per professionisti',
      titolo: 'Incontra le persone giuste',
      punto1: '📍 Scopri chi c’è vicino a te all’evento',
      punto2: '🤝 Match per contesto e obiettivi comuni',
      punto3: '💬 Salva i contatti e scrivi in chat',
      cta: 'Scarica BizzyNow',
      ctaSub: 'e fai networking alla DevFest!',
      data: 'Sabato 10 ottobre · Randstad Box'
    },
    caption: (cfg) => `Networking alla ${plainEvent(cfg)}? C'è BizzyNow! 👋🤝

Siamo felici di avere BizzyNow al nostro fianco: l'app per il networking in tempo reale tra professionisti. Scopri chi c'è all'evento, fai match con le persone giuste in base al contesto e ai tuoi obiettivi, salva i contatti e continua la conversazione in chat.

📲 Scaricala prima di sabato e arriva pronto: ci vediamo il 10 ottobre al Randstad Box!
🔗 bizzynow.com

${cfg.hashtag} #DevFest #GDG #BizzyNow #Networking`
  },
  datwave: {
    nome: 'Datwave',
    asset: '/partner/datwave',
    // il simbolo e' l'onda in alto a destra: dondola come una tavola da surf
    logo: { file: 'logo.svg', ratio: 211 / 56, simbolo: [0.725, 0, 1, 0.62], perno: [0.5, 1], gradi: [9, -7] },
    immagini: ['partner-of-the-year-2026.png', 'competency-ai.png', 'competency-gemini.png'],
    cornice: 'foto',
    colori: { ink: '#230028', accento: '#4285f5', postit: ['#9fe7eb', '#ffd45b', '#c9d8ff'] },
    testi: {
      kicker: 'Il nostro partner',
      claim: 'Surfing through innovation',
      titolo: 'AI, Data e Google Cloud',
      punto1: '🤖 Agentic AI: dalle decisioni alle azioni',
      punto2: '☁️ Premier Partner di Google Cloud',
      punto3: '📊 Data Platform, Analytics e GenAI',
      cta: 'Scopri Datwave',
      ctaSub: 'ci vediamo alla DevFest!',
      data: 'Sabato 10 ottobre · Randstad Box'
    },
    caption: (cfg) => `Alla ${plainEvent(cfg)} c'è anche Datwave! 🌊

Datwave, parte di BIP Group, è Premier Partner di Google Cloud: progetta e costruisce soluzioni di Agentic AI, Generative AI, Data e Cloud per accompagnare le aziende nella trasformazione digitale. E quest'anno è Google Cloud Partner of the Year EMEA Alps 2026.

Grazie per essere al nostro fianco! Ci vediamo sabato 10 ottobre al Randstad Box. 🚀
🔗 datwave.ai

${cfg.hashtag} #DevFest #GDG #Datwave #GoogleCloud #AgenticAI`
  }
};

/* ---------- Tempi ---------- */

// Rumore deterministico in [0, 1).
export const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const tremolio = (f: number, id: number, amp: number) => (rnd(f * 131 + id * 7.13) - 0.5) * 2 * amp;
const backOut = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

// Spostamento del pezzo al fotogramma f, o null se non e' in scena. Entra da
// `da` in `dur` scatti con un piccolo rimbalzo, esce verso `a` da `out`.
// Senza `in` il pezzo e' gia' in posa: le immagini statiche.
export interface Tempi { in?: number; out?: number; da?: number[]; a?: number[]; dur?: number }

export function posa(f: number, { in: inizio = -Infinity, out = Infinity, da = [0, 0], a = [-1400, 0], dur = 4 }: Tempi): [number, number] | null {
  if (f < inizio || f >= out + dur) return null;
  let dx = 0, dy = 0;
  if (f < inizio + dur) {
    const t = backOut((f - inizio + 1) / dur);
    dx = da[0] * (1 - t); dy = da[1] * (1 - t);
  }
  if (f >= out) {
    const t = ((f - out + 1) / dur) ** 2;
    dx += a[0] * t; dy += a[1] * t;
  }
  return [dx, dy];
}

/* ---------- Asset ---------- */

export const carica = (src: string) => new Promise<HTMLImageElement>((ok, ko) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ko(new Error(`immagine mancante: ${src}`));
  img.src = src;
});

export function tela(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Il logo SVG ha solo il viewBox: lo rasterizzo una volta e stacco il
// simbolo, che si muove per conto suo, dal resto del logo.
const LOGO_W = 1800;

export const caricaFont = () => Promise.all([
  document.fonts.load(`800 100px ${DISPLAY}`),
  document.fonts.load(`700 40px ${BODY}`),
  document.fonts.load(`500 30px ${MONO}`)
]);

// Grana della carta: piu' grande del fotogramma, la sposto a ogni posa.
// Una sola per pagina, costa qualche decina di millisecondi.
let granaPronta: HTMLCanvasElement | undefined;
export function grana() {
  if (granaPronta) return granaPronta;
  granaPronta = tela(W + 40, H + 40);
  const g = granaPronta.getContext('2d')!;
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(${rnd(i) > 0.5 ? '60,45,20' : '255,255,255'},${0.04 + rnd(i + 0.5) * 0.08})`;
    g.fillRect(rnd(i + 0.1) * (W + 40), rnd(i + 0.2) * (H + 40), 1 + rnd(i + 0.3) * 2.5, 1 + rnd(i + 0.4) * 2.5);
  }
  return granaPronta;
}

export type Asset = Awaited<ReturnType<typeof preparaAsset>>;

export async function preparaAsset(partner: Partner) {
  await caricaFont();
  const { asset, logo: l } = partner;
  const [svg, ...immagini] = await Promise.all(
    [l.file, ...partner.immagini].map((n) => carica(`${asset}/${n}`)));

  const lh = Math.round(LOGO_W / l.ratio);
  const base = tela(LOGO_W, lh);
  const b = base.getContext('2d')!;
  b.drawImage(svg, 0, 0, LOGO_W, lh);
  const [x0, y0, x1, y1] = [l.simbolo[0] * LOGO_W, l.simbolo[1] * lh, l.simbolo[2] * LOGO_W, l.simbolo[3] * lh].map(Math.round);
  const simbolo = tela(x1 - x0, y1 - y0);
  simbolo.getContext('2d')!.drawImage(base, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  b.clearRect(x0, y0, x1 - x0, y1 - y0);

  return { partner, base, simbolo, riquadro: [x0, y0], immagini, grana: grana() };
}

/* ---------- Primitive di carta ---------- */

export interface Pezzo extends Tempi { x: number; y: number; rot?: number; scala?: number }

export function pezzo(ctx: Ctx, f: number, id: number, { x, y, rot = 0, scala = 1, ...tempi }: Pezzo, disegna: Disegno) {
  const p = posa(f, tempi);
  if (!p) return;
  ctx.save();
  ctx.translate(x + p[0] + tremolio(f, id, 2.5), y + p[1] + tremolio(f, id + 50, 2.5));
  ctx.rotate(((rot + tremolio(f, id + 99, 0.7)) * Math.PI) / 180);
  ctx.scale(scala, scala);
  disegna(ctx);
  ctx.restore();
}

export function carta(ctx: Ctx, w: number, h: number, colore = '#fff', r = 8) {
  ctx.save();
  ctx.shadowColor = 'rgba(40,30,10,.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.restore();
}

// Nastro adesivo semitrasparente sopra un pezzo.
export function nastro(ctx: Ctx, x: number, y: number, rot = -8) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.fillStyle = 'rgba(255,250,235,.62)';
  ctx.fillRect(-60, -18, 120, 36);
  ctx.restore();
}

export function righe(ctx: Ctx, s: string, maxW: number) {
  const out: string[] = [];
  for (const par of String(s).split('\n')) {
    let riga = '';
    for (const parola of par.split(' ')) {
      const prova = riga ? `${riga} ${parola}` : parola;
      if (riga && ctx.measureText(prova).width > maxW) { out.push(riga); riga = parola; } else riga = prova;
    }
    out.push(riga);
  }
  return out;
}

// Testo centrato sull'origine, a capo entro maxW.
export interface Stile { size: number; weight?: number; font?: string; color?: string; maxW?: number; lh?: number; colore?: string }

export function scritta(ctx: Ctx, s: string, { size, weight = 800, font = DISPLAY, color = C.ink, maxW = 900, lh = 1.12 }: Stile) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const r = righe(ctx, s, maxW);
  r.forEach((riga, i) => ctx.fillText(riga, 0, (i - (r.length - 1) / 2) * size * lh));
  return r.length;
}

// Striscia di carta ritagliata attorno a un testo.
export function striscia(ctx: Ctx, s: string, { size, colore = '#fff', color = C.ink, font = DISPLAY, weight = 800, maxW = 900 }: Stile) {
  ctx.font = `${weight} ${size}px ${font}`;
  const r = righe(ctx, s, maxW);
  const w = Math.max(...r.map((t) => ctx.measureText(t).width)) + size * 0.9;
  const h = r.length * size * 1.12 + size * 0.6;
  carta(ctx, w, h, colore, 4);
  scritta(ctx, s, { size, color, font, weight, maxW });
}

// Logo del partner largo `w`: il simbolo oscilla attorno al perno quando `anima`.
function logo(ctx: Ctx, a: Asset, w: number, f: number, anima: boolean) {
  const { perno, gradi } = a.partner.logo;
  const s = w / LOGO_W;
  const h = a.base.height * s;
  ctx.drawImage(a.base, -w / 2, -h / 2, w, h);
  const sw = a.simbolo.width * s, sh = a.simbolo.height * s;
  ctx.save();
  ctx.translate(-w / 2 + a.riquadro[0] * s + sw * perno[0], -h / 2 + a.riquadro[1] * s + sh * perno[1]);
  if (anima) ctx.rotate(((Math.floor(f / 3) % 2 ? gradi[0] : gradi[1]) * Math.PI) / 180);
  ctx.drawImage(a.simbolo, -sw * perno[0], -sh * perno[1], sw, sh);
  ctx.restore();
}

/* ---------- Fotogramma ---------- */

export function sfondo(ctx: Ctx, f: number, a: { grana: HTMLCanvasElement }, w = W, h = H) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(a.grana, -Math.floor(rnd(f) * 40), -Math.floor(rnd(f + 1) * 40));
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(60,40,10,.22)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // la luce del set non e' mai identica tra due scatti
  ctx.fillStyle = `rgba(0,0,0,${rnd(f * 3) * 0.035})`;
  ctx.fillRect(0, 0, w, h);
}

// Scena 1 (0-3s): i quattro pallini e il nome dell'evento a lettere ritagliate.
function scenaEvento(ctx: Ctx, f: number, cfg: Cfg) {
  const out = 36;
  GOOGLE.forEach((colore, i) => pezzo(ctx, f, 10 + i,
    { x: 405 + i * 90, y: 560, in: 1 + i * 2, da: [0, -700], out: out + (i % 2) }, (c) => {
      c.save();
      c.shadowColor = 'rgba(40,30,10,.3)'; c.shadowBlur = 12; c.shadowOffsetY = 6;
      c.fillStyle = colore;
      c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill();
      c.restore();
    }));

  const nome = plainEvent(cfg).toUpperCase().split(/\s+/);
  let n = 0;
  nome.forEach((parola, riga) => {
    const anno = /^\d{4}$/.test(parola);
    const lato = Math.min(128, 980 / parola.length);
    [...parola].forEach((lettera, i) => {
      const id = 100 + n;
      const colore = anno ? GOOGLE[i % 4] : rnd(id) > 0.72 ? GOOGLE[n % 4] : '#fff';
      pezzo(ctx, f, id, {
        x: W / 2 + (i - (parola.length - 1) / 2) * lato, y: 800 + riga * 170,
        rot: (rnd(id + 0.3) - 0.5) * 12, in: 9 + n, da: [0, -90], dur: 2, out: out + (n % 3)
      }, (c) => {
        carta(c, lato - 12, 150, colore, 6);
        scritta(c, lettera, { size: 104, color: colore === '#fff' ? C.ink : '#fff' });
      });
      n++;
    });
  });

  pezzo(ctx, f, 300, { x: W / 2, y: 1370, rot: -2, in: 9 + n + 2, da: [0, 300], out }, (c) =>
    striscia(c, cfg.organizers, { size: 38, font: MONO, weight: 500, colore: C.ink, color: '#fff' }));
}

// Scena 2 (3,5-7s): post-it, logo col simbolo che si muove, claim.
function scenaPartner(ctx: Ctx, f: number, a: Asset, t: TestiPartner) {
  const { colori } = a.partner;
  const out = 80;
  pezzo(ctx, f, 400, { x: W / 2, y: 700, rot: -5, in: 40, da: [0, -900], out }, (c) => {
    carta(c, 560, 160, colori.postit[0], 2);
    nastro(c, 0, -80, 3);
    scritta(c, t.kicker, { size: 62, color: colori.ink, maxW: 500 });
  });
  pezzo(ctx, f, 401, { x: W / 2, y: 1000, rot: 2, in: 45, da: [1300, 0], dur: 5, out }, (c) => {
    carta(c, 960, 330, '#fff', 10);
    nastro(c, -420, -150, -20);
    nastro(c, 420, -150, 20);
    logo(c, a, 820, f, f > 52);
  });
  pezzo(ctx, f, 402, { x: W / 2, y: 1350, rot: -1.5, in: 56, da: [0, 500], out }, (c) =>
    striscia(c, t.claim, { size: 60, color: colori.ink, maxW: 780 }));
}

// Il telefono con la schermata dell'app, o una polaroid con l'immagine dentro.
function cornice(c: Ctx, a: Asset, img: HTMLImageElement) {
  c.save();
  c.shadowColor = 'rgba(40,30,10,.35)'; c.shadowBlur = 30; c.shadowOffsetX = 8; c.shadowOffsetY = 16;
  if (a.partner.cornice === 'telefono') {
    c.drawImage(img, -295, -594, 590, 1188);
    c.restore();
    return;
  }
  c.fillStyle = '#fff';
  c.fillRect(-290, -400, 580, 800);
  c.restore();
  const [bw, bh] = [500, 640];
  const s = Math.min(bw / img.width, bh / img.height);
  c.drawImage(img, -img.width * s / 2, -360 + (bh - img.height * s) / 2, img.width * s, img.height * s);
}

// Scena 3 (7-12s): telefono o polaroid che cambia immagine, un post-it per punto.
function scenaDettagli(ctx: Ctx, f: number, a: Asset, t: TestiPartner) {
  const { colori } = a.partner;
  const out = 144;
  pezzo(ctx, f, 500, { x: W / 2, y: 380, rot: -1, in: 84, da: [0, -500], out }, (c) =>
    striscia(c, t.titolo, { size: 64, colore: colori.ink, color: '#fff' }));

  // Cambio immagine: per due scatti la cornice si solleva, come presa in mano.
  const cambi = [106, 126];
  const quale = Math.min(cambi.filter((c) => f >= c).length, a.immagini.length - 1);
  const sollevato = cambi.some((c) => f >= c && f < c + 2);
  pezzo(ctx, f, 501, {
    x: 335, y: 1060, rot: sollevato ? -6 : -2, scala: sollevato ? 1.05 : 1,
    in: 86, da: [0, 1400], dur: 5, out
  }, (c) => cornice(c, a, a.immagini[quale]));

  ([[t.punto1, 94, 4], [t.punto2, 108, -4], [t.punto3, 128, 3]] as const)
    .forEach(([testo, inizio, rot], i) =>
      pezzo(ctx, f, 510 + i, { x: 800, y: 640 + i * 320, rot, in: inizio, da: [700, 0], out: out + i }, (c) => {
        carta(c, 420, 270, colori.postit[i], 2);
        nastro(c, 0, -135, rot * -2);
        scritta(c, testo, { size: 44, weight: 700, font: BODY, color: colori.ink, maxW: 360 });
      }));
}

// Scena 4 (12-16s): DevFest × partner e l'invito finale.
function scenaCta(ctx: Ctx, f: number, a: Asset, t: TestiPartner, cfg: Cfg) {
  const { colori } = a.partner;
  pezzo(ctx, f, 600, { x: W / 2, y: 520, rot: -2, in: 148, da: [-1300, 0] }, (c) => {
    carta(c, 820, 140, '#fff', 6);
    const nome = plainEvent(cfg);
    const [testo, anno] = nome.match(/^(.*?)\s*(\d{4})?$/)!.slice(1);
    c.font = `800 72px ${DISPLAY}`;
    const wt = c.measureText(testo).width, wa = anno ? c.measureText(` ${anno}`).width : 0;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = C.ink;
    c.fillText(testo, -(wt + wa) / 2, 4);
    if (anno) [...` ${anno}`].reduce((x, cifra, i) => {
      c.fillStyle = GOOGLE[(i + 3) % 4];
      c.fillText(cifra, x, 4);
      return x + c.measureText(cifra).width;
    }, -(wt + wa) / 2 + wt);
  });
  pezzo(ctx, f, 601, { x: W / 2, y: 660, rot: 8, in: 151, da: [0, -300], dur: 2 }, (c) =>
    scritta(c, '×', { size: 110, color: colori.accento }));
  pezzo(ctx, f, 602, { x: W / 2, y: 820, rot: 1.5, in: 153, da: [1300, 0] }, (c) => {
    carta(c, 820, 260, '#fff', 10);
    logo(c, a, 700, f, f > 158);
  });
  pezzo(ctx, f, 603, { x: W / 2, y: 1110, rot: -3, in: 160, da: [0, -120], dur: 2 }, (c) =>
    striscia(c, t.cta, { size: 96, colore: colori.accento, color: '#fff' }));
  pezzo(ctx, f, 604, { x: W / 2, y: 1260, rot: 1.5, in: 164, da: [0, 200] }, (c) =>
    striscia(c, t.ctaSub, { size: 54, color: colori.ink }));
  pezzo(ctx, f, 605, { x: W / 2, y: 1420, rot: -1, in: 170, da: [-1300, 0] }, (c) =>
    striscia(c, t.data, { size: 44, font: MONO, weight: 500, colore: C.blue, color: '#fff' }));
  pezzo(ctx, f, 606, { x: W / 2, y: 1550, rot: 2, in: 175, da: [0, 300], dur: 3 }, (c) =>
    scritta(c, cfg.hashtag, { size: 46, font: MONO, weight: 700, color: C.ink }));
}

// `a` viene da preparaAsset(partner) e si porta dietro il partner.
export function disegnaReel(ctx: Ctx, f: number, a: Asset, testi: TestiPartner, cfg: Cfg) {
  sfondo(ctx, f, a);
  scenaEvento(ctx, f, cfg);
  scenaPartner(ctx, f, a, testi);
  scenaDettagli(ctx, f, a, testi);
  scenaCta(ctx, f, a, testi, cfg);
}

/* ---------- Video ---------- */

const FORMATI = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
const FORMATI_AUDIO = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
export const formatoVideo = (audio = false) => (audio ? FORMATI_AUDIO : FORMATI).find((t) => MediaRecorder.isTypeSupported(t));

// MediaRecorder registra in tempo reale: ridisegno la posa corrente a ogni
// frame del browser, cosi' il video esce a frequenza costante con le pose a 12 fps.
// `suono(actx, dest, t0)`, se c'e', programma l'audio da mixare nel video.
export type Suono = (actx: AudioContext, dest: MediaStreamAudioDestinationNode, t0: number) => void;

export async function registraReel(
  canvas: HTMLCanvasElement, disegna: (f: number) => void, onProgress?: (f: number, n: number) => void,
  frames = FRAMES, suono?: Suono
) {
  const tipo = formatoVideo(Boolean(suono));
  if (!tipo) throw new Error('questo browser non sa registrare video dal canvas');
  const stream = canvas.captureStream(30);
  const actx = suono ? new AudioContext() : undefined;
  let dest: MediaStreamAudioDestinationNode | undefined;
  if (actx) {
    await actx.resume();
    dest = actx.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 16_000_000 });
  const pezzi: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) pezzi.push(e.data); };
  const fermo = new Promise((ok) => (rec.onstop = ok));

  disegna(0);
  rec.start();
  if (suono && actx && dest) suono(actx, dest, actx.currentTime);
  const t0 = performance.now();
  await new Promise<void>((fine) => {
    let ultimo = -1;
    const passo = () => {
      const f = Math.floor(((performance.now() - t0) * FPS) / 1000);
      if (f >= frames) return fine();
      if (f !== ultimo) { disegna(f); onProgress?.(f + 1, frames); ultimo = f; }
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
  rec.stop();
  await fermo;
  stream.getTracks().forEach((tr) => tr.stop());
  await actx?.close();
  return { blob: new Blob(pezzi, { type: tipo.split(';')[0] }), estensione: tipo.startsWith('video/mp4') ? 'mp4' : 'webm' };
}
