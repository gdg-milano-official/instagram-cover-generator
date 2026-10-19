import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { plainEvent } from './posts.js';

export const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// La locandina e' larga 600 nel DOM e alta in proporzione al formato: la
// dimensione finale e' solo un fattore di scala. Instagram e Facebook rendono
// meglio in verticale 4:5, LinkedIn in quadrato.
export const LATO_CSS = 600;
export const FORMATI = [
  { id: 'instagram', nome: 'Instagram', w: 1080, h: 1350 },
  { id: 'facebook', nome: 'Facebook', w: 1080, h: 1350 },
  { id: 'linkedin', nome: 'LinkedIn', w: 1200, h: 1200 }
];
export const altezzaCss = ({ w, h }) => Math.round((LATO_CSS * h) / w);

export const pngName = (cfg, nome, scuro, f) =>
  `${slug(plainEvent(cfg))}-${slug(nome)}-${f.id}-${f.w}x${f.h}${scuro ? '-dark' : ''}.png`;

export async function renderCard(cardEl, formato = FORMATI[0]) {
  await document.fonts.ready;
  const alto = altezzaCss(formato);
  cardEl.classList.add('exporting');   // nasconde i segnaposto dei campi vuoti
  try {
    return await html2canvas(cardEl, {
      scale: formato.w / LATO_CSS, width: LATO_CSS, height: alto, useCORS: true, backgroundColor: null,
      // il formato cambia solo nella copia che html2canvas disegna: in pagina resta l'anteprima scelta
      onclone: (_doc, copia) => {
        copia.style.height = `${alto}px`;
        copia.classList.toggle('verticale', formato.h > formato.w);
      }
    });
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

// Una cartella per piattaforma, con dentro la locandina di ogni speaker.
export async function esportaTutto({ voci, cfg, scuro, onProgress }) {
  const zip = new JSZip();
  const blocchi = [];
  for (const [i, voce] of voci.entries()) {
    onProgress?.(i + 1, voci.length);
    for (const f of FORMATI) {
      const canvas = await renderCard(voce.card, f);
      zip.folder(f.id).file(pngName(cfg, voce.speaker.name, scuro, f),
        canvas.toDataURL('image/png').split(',')[1], { base64: true });
    }
    blocchi.push({ ...voce.speaker, ...voce.post });
  }
  zip.file('testi-post.doc', wordDoc(blocchi, cfg));
  save(await zip.generateAsync({ type: 'blob' }),
    `${slug(plainEvent(cfg))}-locandine${scuro ? '-dark' : ''}.zip`);
}
