// Per ogni speaker: storia, post, carosello, reel e caption, con la carta
// BizzyMagic (caricata nella sezione Carica carte, altrimenti da speaker.json)
// oppure con la foto Sessionize (modo 'foto'). Tutto disegnato su canvas (reel.ts / carte.ts),
// niente html2canvas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import JSZip from 'jszip';
import type JSZipT from 'jszip';
import { FPS, registraReel } from './reel.ts';
import { FRAMES_CARTA, LATO, SLIDE, captionAltra, captionCarta, captionKit, disegnaCarosello, disegnaPost, disegnaReelCarta, disegnaStoria, kitDa, preparaCarta } from './carte.ts';
import { save, slug } from './export.ts';
import type { AssetCarta, Immagine, KitCaricato, KitSpeaker, Modo, Soggetto } from './carte.ts';
import { plainEvent } from './posts.ts';
import type { Cfg } from './posts.ts';
import type { Speaker } from './sessionize.ts';

// Le immagini di uno speaker: nome del file e come disegnarla.
const IMMAGINI: Immagine[] = [
  ['storia', 'storia', (c, a, sp, cfg) => disegnaStoria(c, a, sp, cfg)],
  ['post', 'post', (c, a, sp, cfg) => disegnaPost(c, a, sp, cfg)],
  ...Array.from({ length: SLIDE }, (_, i) =>
    [`carosello-${i + 1}`, 'carosello', (c, a, sp, cfg) => disegnaCarosello(c, i, a, sp, cfg)] satisfies Immagine)
];

const cartella = (sp: Soggetto) => sp.foto ? slug(sp.name) : sp.numero ? `${sp.numero.slice(0, 3)}-${slug(sp.name)}` : `${sp.id.replace('carta-', '').padStart(3, '0')}-${slug(sp.name)}`;

function tela(formato: Immagine[1]) {
  const c = document.createElement('canvas');
  [c.width, c.height] = LATO[formato];
  return c;
}

// JPEG e non PNG: la grana della carta fa pesare un PNG 3 MB, e Instagram ricomprime comunque.
const jpg = (canvas: HTMLCanvasElement) => new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), 'image/jpeg', 0.92));

const modoDi = (sp: Soggetto): Modo => (sp.foto ? 'foto' : 'carta');

interface Miniatura { nome: string; src: string }

async function anteprime(sp: Soggetto, cfg: Cfg) {
  const a: AssetCarta = await preparaCarta(sp, modoDi(sp));
  const out: Miniatura[] = [];
  for (const [nome, formato, disegna] of IMMAGINI) {
    const grande = tela(formato);
    disegna(grande.getContext('2d')!, a, sp, cfg);
    const piccola = document.createElement('canvas');
    piccola.width = grande.width / 4;
    piccola.height = grande.height / 4;
    piccola.getContext('2d')!.drawImage(grande, 0, 0, piccola.width, piccola.height);
    out.push({ nome, src: piccola.toDataURL('image/jpeg', 0.85) });
    await new Promise((r) => setTimeout(r));   // lascia respirare la pagina
  }
  return out;
}

function Speaker({ sp, cfg, caption, onCaption, onReel, occupato }: {
  sp: KitSpeaker; cfg: Cfg; caption: string; onCaption: (v: string) => void; onReel: () => void; occupato: boolean;
}) {
  const [miniature, setMiniature] = useState<Miniatura[]>([]);
  useEffect(() => {
    let attivo = true;
    anteprime(sp, cfg).then((m) => attivo && setMiniature(m));
    return () => { attivo = false; };
  }, [sp.id, sp.carta, sp.foto, sp.numero, cfg]);   // nel modo 'carica' l'oggetto si ricrea a ogni abbinamento

  const scarica = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      await aggiungiImmagini(zip, sp, cfg, caption);
      save(await zip.generateAsync({ type: 'blob' }), `${cartella(sp)}.zip`);
    }
  });

  return (
    <section className="speaker carta-speaker">
      <div className="giorno-head">
        <span className="giorno-data">{sp.numero ? `Carta ${sp.numero}` : sp.room}</span>
        <h2>{sp.name}</h2>
        <span className="giorno-formato">{sp.kind} · {sp.ora} · {sp.room}</span>
      </div>
      <p className="carta-talk">{sp.talk}</p>

      <div className="carta-miniature">
        {miniature.map((m) => (
          <figure key={m.nome}>
            <img src={m.src} alt={`${m.nome} di ${sp.name}`} />
            <figcaption>{m.nome}</figcaption>
          </figure>
        ))}
      </div>

      <div className="slide-azioni">
        <button onClick={() => scarica.mutate()} disabled={scarica.isPending || occupato}>
          {scarica.isPending ? 'Preparo…' : '📦 Immagini + caption'}
        </button>
        <button className="ghost" onClick={onReel} disabled={occupato}>🎬 Reel</button>
      </div>

      <div className="post">
        <div className="post-head">
          <h3>Caption Instagram</h3>
          <span>
            <button className="ghost" onClick={(e) => {
              navigator.clipboard.writeText(caption);
              const b = e.currentTarget;
              b.textContent = 'Copiato ✓';
              setTimeout(() => (b.textContent = 'Copia'), 1500);
            }}>Copia</button>
          </span>
        </div>
        <textarea value={caption} onChange={(e) => onCaption(e.target.value)} />
      </div>
    </section>
  );
}

async function aggiungiImmagini(zip: JSZipT, sp: Soggetto, cfg: Cfg, caption: string) {
  const a = await preparaCarta(sp, modoDi(sp));
  const dir = zip.folder(cartella(sp))!;
  for (const [nome, formato, disegna] of IMMAGINI) {
    const c = tela(formato);
    disegna(c.getContext('2d')!, a, sp, cfg);
    dir.file(`${nome}.jpg`, await jpg(c));
  }
  dir.file('caption.txt', caption);
}

// `modo` arriva dal percorso: /kit-social-speaker/carta o /kit-social-speaker/foto.
// `caricato` sono le carte della sezione Carica carte gia' abbinate (kitCaricato).
export default function Carte({ cfg, speakers, caricato, modo, onModo }: {
  cfg: Cfg; speakers: Speaker[]; caricato: KitCaricato; modo: Modo; onModo: (m: Modo) => void;
}) {
  const dati = useQuery<KitSpeaker[]>({
    queryKey: ['carte'],
    queryFn: async () => {
      const res = await fetch('/carte/speaker.json');
      if (!res.ok) throw new Error('manca public/carte/speaker.json: lancia scripts/carte.ts');
      return res.json();
    },
    staleTime: Infinity
  });
  const altre = useQuery<Soggetto[]>({
    queryKey: ['altre-carte'],
    queryFn: async () => {
      const res = await fetch('/carte/altre.json');
      return res.ok ? res.json() : [];
    },
    staleTime: Infinity
  });
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [avanzamento, setAvanzamento] = useState('');
  const [inScena, setInScena] = useState<Soggetto | null>(null);   // lo speaker del reel sul canvas
  const canvas = useRef<HTMLCanvasElement>(null);
  const foto = modo === 'foto';
  const daFile = !foto && !caricato.vuoto;
  const kit = useMemo(() => kitDa(speakers), [speakers]);
  const elenco: KitSpeaker[] = foto ? kit : daFile ? caricato.speaker : dati.data || [];
  const captionDi = (sp: KitSpeaker) => captions[`${modo}:${sp.id}`] ?? (foto ? captionKit(sp, cfg) : captionCarta(sp, cfg));
  const suffisso = foto ? 'kit' : 'carte';

  // Registra un reel sul canvas visibile: MediaRecorder vuole un canvas che si aggiorna.
  async function reel(sp: Soggetto) {
    setInScena(sp);
    const a = await preparaCarta(sp, modoDi(sp));
    const tela = canvas.current!;
    return registraReel(tela, (f) => disegnaReelCarta(tela.getContext('2d')!, f, a, sp, cfg),
      (f, n) => setAvanzamento(`Reel di ${sp.name}: ${Math.ceil(f / FPS)}/${n / FPS} s…`), FRAMES_CARTA);
  }

  const unReel = useMutation({
    mutationFn: async (sp: Soggetto) => {
      const { blob, estensione } = await reel(sp);
      save(blob, `${cartella(sp)}-reel.${estensione}`);
    },
    onSuccess: () => setAvanzamento('Reel salvato.'),
    onError: (e) => setAvanzamento(`Reel fallito: ${e.message}`)
  });

  const tutteImmagini = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      for (const [i, sp] of elenco.entries()) {
        setAvanzamento(`Immagini ${i + 1}/${elenco.length}: ${sp.name}…`);
        await aggiungiImmagini(zip, sp, cfg, captionDi(sp));
      }
      setAvanzamento('Comprimo lo ZIP…');
      save(await zip.generateAsync({ type: 'blob' }), `${slug(plainEvent(cfg))}-${suffisso}-immagini.zip`);
    },
    onSuccess: () => setAvanzamento(`${elenco.length} speaker: storia, post, carosello e caption nello ZIP.`)
  });

  const tuttiReel = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      for (const [i, sp] of elenco.entries()) {
        const { blob, estensione } = await reel(sp);
        zip.folder(cartella(sp))!.file(`reel.${estensione}`, blob);
        setAvanzamento(`Reel ${i + 1}/${elenco.length} fatti.`);
      }
      setAvanzamento('Comprimo lo ZIP…');
      save(await zip.generateAsync({ type: 'blob' }), `${slug(plainEvent(cfg))}-${suffisso}-reel.zip`);
    },
    onSuccess: () => setAvanzamento(`${elenco.length} reel nello ZIP.`),
    onError: (e) => setAvanzamento(`Reel falliti: ${e.message}`)
  });

  const elencoAltre: Soggetto[] = daFile ? caricato.altre : altre.data || [];
  const reelAltre = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      for (const [i, c] of elencoAltre.entries()) {
        const { blob, estensione } = await reel(c);
        const dir = zip.folder(cartella(c))!;
        dir.file(`reel.${estensione}`, blob);
        dir.file('caption.txt', captionAltra(c, cfg));
        setAvanzamento(`Altre carte: ${i + 1}/${elencoAltre.length} reel fatti.`);
      }
      setAvanzamento('Comprimo lo ZIP…');
      save(await zip.generateAsync({ type: 'blob' }), `${slug(plainEvent(cfg))}-altre-carte-reel.zip`);
    },
    onSuccess: () => setAvanzamento(`${elencoAltre.length} reel delle altre carte nello ZIP.`),
    onError: (e) => setAvanzamento(`Reel falliti: ${e.message}`)
  });

  // Tutto in un solo ZIP: per ogni speaker immagini, caption e reel nella stessa
  // cartella, e con la carta anche i reel delle altre carte in altre-carte/.
  const tutto = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      for (const [i, sp] of elenco.entries()) {
        setAvanzamento(`Speaker ${i + 1}/${elenco.length}: ${sp.name}, immagini…`);
        await aggiungiImmagini(zip, sp, cfg, captionDi(sp));
        const { blob, estensione } = await reel(sp);
        zip.folder(cartella(sp))!.file(`reel.${estensione}`, blob);
      }
      const altreDaFare = foto ? [] : elencoAltre;
      for (const [i, c] of altreDaFare.entries()) {
        const { blob, estensione } = await reel(c);
        const dir = zip.folder('altre-carte')!.folder(cartella(c))!;
        dir.file(`reel.${estensione}`, blob);
        dir.file('caption.txt', captionAltra(c, cfg));
        setAvanzamento(`Altre carte: ${i + 1}/${altreDaFare.length} reel fatti.`);
      }
      setAvanzamento('Comprimo lo ZIP…');
      save(await zip.generateAsync({ type: 'blob' }), `${slug(plainEvent(cfg))}-${suffisso}-completo.zip`);
      return altreDaFare.length;
    },
    onSuccess: (altreFatte) => setAvanzamento(`${elenco.length} speaker${altreFatte ? ` e ${altreFatte} altre carte` : ''} nello ZIP completo.`),
    onError: (e) => setAvanzamento(`Download completo fallito: ${e.message}`)
  });

  const occupato = tutto.isPending || tutteImmagini.isPending || tuttiReel.isPending || unReel.isPending || reelAltre.isPending;
  const minuti = Math.ceil((elenco.length * FRAMES_CARTA) / FPS / 60);
  const minutiAltre = Math.ceil((elencoAltre.length * FRAMES_CARTA) / FPS / 60);

  return (
    <>
      <nav className="sottosezioni">
        {([['carta', '🃏 Con la carta'], ['foto', '📸 Da Sessionize (foto)']] as const).map(([id, etichetta]) => (
          <button key={id} type="button" aria-pressed={modo === id} disabled={occupato} onClick={() => {
            onModo(id);
            setAvanzamento('');
          }}>{etichetta}</button>
        ))}
      </nav>

      <section className="speaker download">
        <div className="giorno-head">
          <span className="giorno-data">⬇︎ Download</span>
          <h2>Scarica il kit completo</h2>
          <span className="giorno-formato">
            {elenco.length} speaker {foto ? 'da Sessionize' : daFile ? 'con la carta caricata' : 'con la carta BizzyMagic'} · file ZIP, una cartella per speaker
          </span>
        </div>

        <div className="download-voci">
          <button className="download-voce download-tutto" onClick={() => tutto.mutate()} disabled={occupato || !elenco.length}>
            <strong>⬇︎ Tutto il kit</strong>
            <span>immagini, caption e reel di ogni speaker{foto ? '' : ` + i reel delle altre ${elencoAltre.length} carte`} · circa {foto ? minuti : minuti + minutiAltre} min</span>
          </button>
          <button className="download-voce ghost" onClick={() => tutteImmagini.mutate()} disabled={occupato || !elenco.length}>
            <strong>📦 Immagini + caption</strong>
            <span>storia, post, carosello e testo · pochi secondi</span>
          </button>
          <button className="download-voce ghost" onClick={() => tuttiReel.mutate()} disabled={occupato || !elenco.length}>
            <strong>🎬 Reel degli speaker</strong>
            <span>un video per speaker · circa {minuti} min</span>
          </button>
          {!foto && <button className="download-voce ghost" onClick={() => reelAltre.mutate()} disabled={occupato || !elencoAltre.length}>
            <strong>🃏 Reel delle altre {elencoAltre.length} carte</strong>
            <span>evento, partner, team · circa {minutiAltre} min</span>
          </button>}
        </div>

        <p className={`status${occupato ? ' in-corso' : ''}${!foto && !daFile && dati.isError ? ' error' : ''}`}>
          {!foto && !daFile && dati.isError ? dati.error.message
            : avanzamento || (foto && !elenco.length
              ? 'Nessuno speaker da Sessionize: inserisci l’API ID in alto e premi Carica speaker.'
              : daFile && !elenco.length
              ? 'Nessuna delle carte caricate è collegata a uno speaker: collegale nella sezione Carica carte.'
              : 'I reel si registrano in tempo reale: tieni la scheda in primo piano finché lo ZIP non parte.')}
        </p>
      </section>

      <section className={`speaker carta-regia${inScena ? '' : ' nascosta'}`}>
        <canvas ref={canvas} width={LATO.reel[0]} height={LATO.reel[1]} className="reel-canvas" />
        <p className="nota">{inScena ? `In registrazione: ${inScena.name}` : ''}</p>
      </section>

      {elenco.length > 0 && (
        <div className="sezione-titolo">
          <h2>Speaker uno per uno</h2>
          <span>{elenco.length} schede · anteprima, download e caption del singolo speaker</span>
        </div>
      )}

      {elenco.map((sp) => (
        <Speaker key={sp.id} sp={sp} cfg={cfg} caption={captionDi(sp)} occupato={occupato}
          onCaption={(v) => setCaptions((c) => ({ ...c, [`${modo}:${sp.id}`]: v }))}
          onReel={() => unReel.mutate(sp)} />
      ))}

      {!foto && elencoAltre.length > 0 && (
        <section className="speaker carta-speaker">
          <div className="giorno-head">
            <h2>Altre carte</h2>
            <span className="giorno-formato">evento, partner, team e collezione · solo reel e caption</span>
          </div>
          <div className="carta-altre">
            {elencoAltre.map((c) => (
              <figure key={c.id}>
                <img src={c.carta} alt={c.name} loading="lazy" />
                <figcaption>{c.name}</figcaption>
                <button className="ghost" onClick={() => unReel.mutate(c)} disabled={occupato}>🎬 Reel</button>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
