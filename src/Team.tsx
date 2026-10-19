// Kit social degli organizzatori: per ognuno storia, post, carosello, reel e
// caption, con la carta BizzyMagic o con la foto del sito (modo 'foto'). Gli
// organizzatori vengono dall'anagrafica (Persone.tsx, di partenza team.json di
// scripts/team.ts) con la carta di Carica carte; il disegno e' in carte.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import JSZip from 'jszip';
import type JSZipT from 'jszip';
import { FPS, registraReel } from './reel.ts';
import { FRAMES_CARTA, LATO, SLIDE, captionTeam, disegnaCaroselloTeam, disegnaPostTeam, disegnaReelCarta, disegnaStoriaTeam, preparaCarta } from './carte.ts';
import { save, slug } from './export.ts';
import type { Immagine, Modo, Soggetto } from './carte.ts';
import { plainEvent } from './posts.ts';
import type { Cfg } from './posts.ts';

const IMMAGINI: Immagine[] = [
  ['storia', 'storia', disegnaStoriaTeam],
  ['post', 'post', disegnaPostTeam],
  ...Array.from({ length: SLIDE }, (_, i) =>
    [`carosello-${i + 1}`, 'carosello', (c, a, sp, cfg) => disegnaCaroselloTeam(c, i, a, sp, cfg)] satisfies Immagine)
];

const cartella = (sp: Soggetto, modo: Modo) => (modo === 'carta' && sp.numero ? `${sp.numero.slice(0, 3)}-${slug(sp.name)}` : slug(sp.name));

function tela(formato: Immagine[1]) {
  const c = document.createElement('canvas');
  [c.width, c.height] = LATO[formato];
  return c;
}

const jpg = (canvas: HTMLCanvasElement) => new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), 'image/jpeg', 0.92));

// A grandezza piena il canvas, per lo ZIP; rimpicciolita la miniatura.
interface Uscita { nome: string; canvas?: HTMLCanvasElement; src?: string }

async function immagini(sp: Soggetto, cfg: Cfg, modo: Modo, scala = 1) {
  const a = await preparaCarta(sp, modo);
  const out: Uscita[] = [];
  for (const [nome, formato, disegna] of IMMAGINI) {
    const grande = tela(formato);
    disegna(grande.getContext('2d')!, a, sp, cfg);
    if (scala === 1) { out.push({ nome, canvas: grande }); continue; }
    const piccola = document.createElement('canvas');
    piccola.width = grande.width * scala;
    piccola.height = grande.height * scala;
    piccola.getContext('2d')!.drawImage(grande, 0, 0, piccola.width, piccola.height);
    out.push({ nome, src: piccola.toDataURL('image/jpeg', 0.85) });
    await new Promise((r) => setTimeout(r));   // lascia respirare la pagina
  }
  return out;
}

async function aggiungiImmagini(zip: JSZipT, sp: Soggetto, cfg: Cfg, modo: Modo, caption: string) {
  const dir = zip.folder(cartella(sp, modo))!;
  for (const { nome, canvas } of await immagini(sp, cfg, modo)) dir.file(`${nome}.jpg`, await jpg(canvas!));
  dir.file('caption.txt', caption);
}

function Organizzatore({ sp, cfg, modo, caption, onCaption, onReel, occupato }: {
  sp: Soggetto; cfg: Cfg; modo: Modo; caption: string; onCaption: (v: string) => void; onReel: () => void; occupato: boolean;
}) {
  const [miniature, setMiniature] = useState<Uscita[]>([]);
  useEffect(() => {
    let attivo = true;
    immagini(sp, cfg, modo, 1 / 4).then((m) => attivo && setMiniature(m));
    return () => { attivo = false; };
  }, [sp, cfg, modo]);

  const scarica = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      await aggiungiImmagini(zip, sp, cfg, modo, caption);
      save(await zip.generateAsync({ type: 'blob' }), `${cartella(sp, modo)}.zip`);
    }
  });

  return (
    <section className="speaker carta-speaker">
      <div className="giorno-head">
        <span className="giorno-data">{modo === 'carta' && sp.numero ? `Carta ${sp.numero}` : 'Team'}</span>
        <h2>{sp.name}</h2>
        <span className="giorno-formato">{sp.role}</span>
      </div>
      {sp.lavoro && <p className="carta-talk">{sp.lavoro}</p>}

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

// `modo` arriva dal percorso: /kit-social-organizzatori/carta o /foto.
// `team` e' l'anagrafica con le carte caricate gia' abbinate (kitCaricato).
export default function Team({ cfg, team, modo, onModo }: {
  cfg: Cfg; team: Soggetto[]; modo: Modo; onModo: (m: Modo) => void;
}) {
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [avanzamento, setAvanzamento] = useState('');
  const [inScena, setInScena] = useState<Soggetto | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const conCarta = modo === 'carta';
  // con la foto il numero della carta non c'entra
  const elenco = useMemo(() => team.filter((sp) => sp.name && (conCarta ? sp.carta : sp.foto))
    .map((sp) => (conCarta ? sp : { ...sp, numero: '' })), [team, conCarta]);
  const captionDi = (sp: Soggetto) => captions[`${modo}:${sp.id}`] ?? captionTeam(sp, cfg, conCarta);

  // MediaRecorder vuole un canvas visibile che si aggiorna.
  async function reel(sp: Soggetto) {
    setInScena(sp);
    const a = await preparaCarta(sp, modo);
    const tela = canvas.current!;
    return registraReel(tela, (f) => disegnaReelCarta(tela.getContext('2d')!, f, a, sp, cfg),
      (f, n) => setAvanzamento(`Reel di ${sp.name}: ${Math.ceil(f / FPS)}/${n / FPS} s…`), FRAMES_CARTA);
  }

  const unReel = useMutation({
    mutationFn: async (sp: Soggetto) => {
      const { blob, estensione } = await reel(sp);
      save(blob, `${cartella(sp, modo)}-reel.${estensione}`);
    },
    onSuccess: () => setAvanzamento('Reel salvato.'),
    onError: (e) => setAvanzamento(`Reel fallito: ${e.message}`)
  });

  // Un solo ZIP; con `conReel` registra anche i reel, in tempo reale.
  const zip = useMutation({
    mutationFn: async (conReel: boolean) => {
      const z = new JSZip();
      for (const [i, sp] of elenco.entries()) {
        setAvanzamento(`Organizzatore ${i + 1}/${elenco.length}: ${sp.name}…`);
        await aggiungiImmagini(z, sp, cfg, modo, captionDi(sp));
        if (conReel) {
          const { blob, estensione } = await reel(sp);
          z.folder(cartella(sp, modo))!.file(`reel.${estensione}`, blob);
        }
      }
      setAvanzamento('Comprimo lo ZIP…');
      save(await z.generateAsync({ type: 'blob' }), `${slug(plainEvent(cfg))}-team-${modo}${conReel ? '-completo' : '-immagini'}.zip`);
    },
    onSuccess: () => setAvanzamento(`${elenco.length} organizzatori nello ZIP.`),
    onError: (e) => setAvanzamento(`Download fallito: ${e.message}`)
  });

  const occupato = zip.isPending || unReel.isPending;
  const minuti = Math.ceil((elenco.length * FRAMES_CARTA) / FPS / 60);

  return (
    <>
      <nav className="sottosezioni">
        {([['carta', '🃏 Con la carta'], ['foto', '📸 Con la foto']] as const).map(([id, etichetta]) => (
          <button key={id} type="button" aria-pressed={modo === id} disabled={occupato} onClick={() => {
            onModo(id);
            setAvanzamento('');
          }}>{etichetta}</button>
        ))}
      </nav>

      <section className="speaker download">
        <div className="giorno-head">
          <span className="giorno-data">⬇︎ Download</span>
          <h2>Scarica il kit del team</h2>
          <span className="giorno-formato">
            {elenco.length} organizzatori {conCarta ? 'con la carta BizzyMagic' : 'con la foto del sito'} · file ZIP, una cartella a testa
          </span>
        </div>

        <div className="download-voci">
          <button className="download-voce download-tutto" onClick={() => zip.mutate(true)} disabled={occupato || !elenco.length}>
            <strong>⬇︎ Tutto il kit</strong>
            <span>immagini, caption e reel di ogni organizzatore · circa {minuti} min</span>
          </button>
          <button className="download-voce ghost" onClick={() => zip.mutate(false)} disabled={occupato || !elenco.length}>
            <strong>📦 Immagini + caption</strong>
            <span>storia, post, carosello e testo · pochi secondi</span>
          </button>
        </div>

        <p className={`status${occupato ? ' in-corso' : ''}`}>
          {avanzamento || (elenco.length
            ? 'I reel si registrano in tempo reale: tieni la scheda in primo piano finché lo ZIP non parte.'
            : `Nessun organizzatore ${conCarta ? 'con la carta' : 'con la foto'}: aggiungili in Organizzatori e sponsor${conCarta ? ' e abbina le carte in Carica carte' : ''}.`)}
        </p>
      </section>

      <section className={`speaker carta-regia${inScena ? '' : ' nascosta'}`}>
        <canvas ref={canvas} width={LATO.reel[0]} height={LATO.reel[1]} className="reel-canvas" />
        <p className="nota">{inScena ? `In registrazione: ${inScena.name}` : ''}</p>
      </section>

      {elenco.length > 0 && (
        <div className="sezione-titolo">
          <h2>Organizzatori uno per uno</h2>
          <span>{elenco.length} schede · anteprima, download e caption</span>
        </div>
      )}

      {elenco.map((sp) => (
        <Organizzatore key={sp.id} sp={sp} cfg={cfg} modo={modo} caption={captionDi(sp)} occupato={occupato}
          onCaption={(v) => setCaptions((c) => ({ ...c, [`${modo}:${sp.id}`]: v }))}
          onReel={() => unReel.mutate(sp)} />
      ))}
    </>
  );
}
