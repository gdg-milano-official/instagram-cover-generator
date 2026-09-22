import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { plainEvent } from './posts.js';

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// La locandina e' 600x600 nel DOM: la dimensione finale e' solo un fattore di scala.
export const LATO_CSS = 600;
export const MISURE = [1080, 1350, 1620, 2160];

export const pngName = (cfg, nome, scuro, lato) =>
  `${slug(plainEvent(cfg))}-${slug(nome)}-${lato}${scuro ? '-dark' : ''}.png`;

export async function renderCard(cardEl, lato = 1080) {
  await document.fonts.ready;
  cardEl.classList.add('exporting');   // nasconde i segnaposto dei campi vuoti
  try {
    return await html2canvas(cardEl, { scale: lato / LATO_CSS, useCORS: true, backgroundColor: null });
  } finally {
    cardEl.classList.remove('exporting');
  }
}

export function save(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// .doc in HTML: Word lo apre nativamente e costa dieci righe invece di un
// generatore OOXML. Da Word si fa "salva come .docx" se serve il formato vero.
export function wordDoc(blocchi, cfg) {
  const par = (t) => esc(t).split('\n').map((r) => `<p>${r || '&nbsp;'}</p>`).join('');
  const corpo = blocchi.map((b) => `
    <h1>${esc(b.name)}</h1>
    <p><i>${esc(b.role)}</i>${b.room ? ` &mdash; ${esc(b.room)}` : ''}</p>
    <h2>Instagram</h2>${par(b.instagram)}
    <h2>LinkedIn</h2>${par(b.linkedin)}
    <hr>`).join('');
  return new Blob([`<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
    <title>${esc(plainEvent(cfg))} — testi dei post</title>
    <style>body{font-family:Calibri,sans-serif} h1{font-size:18pt} h2{font-size:12pt;color:#4285f4}</style>
    </head><body><h1>${esc(plainEvent(cfg))} — testi dei post</h1>${corpo}</body></html>`],
    { type: 'application/msword' });
}

export async function esportaTutto({ voci, cfg, scuro, lato = 1080, onProgress }) {
  const zip = new JSZip();
  const blocchi = [];
  for (const [i, voce] of voci.entries()) {
    onProgress?.(i + 1, voci.length);
    const canvas = await renderCard(voce.card, lato);
    zip.file(pngName(cfg, voce.speaker.name, scuro, lato),
      canvas.toDataURL('image/png').split(',')[1], { base64: true });
    blocchi.push({ ...voce.speaker, ...voce.post });
  }
  zip.file('testi-post.doc', wordDoc(blocchi, cfg));
  save(await zip.generateAsync({ type: 'blob' }),
    `${slug(plainEvent(cfg))}-${lato}${scuro ? '-dark' : ''}.zip`);
}
