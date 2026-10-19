// Kit social degli sponsor: una scheda per partner, uno sotto l'altro, con
// l'anteprima del reel in loop, i testi modificabili e la caption. I video si
// registrano su un canvas di regia a parte, come nel kit speaker.
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import JSZip from 'jszip';
import { FPS, FRAMES, H, PARTNER, W, disegnaReel, preparaAsset, registraReel } from './reel.ts';
import type { Asset, Partner, TestiPartner } from './reel.ts';
import { save, slug } from './export.ts';
import { plainEvent } from './posts.ts';
import type { Cfg } from './posts.ts';

const ETICHETTE: Record<keyof TestiPartner, string> = {
  kicker: 'Post-it', claim: 'Claim', titolo: 'Titolo terza scena', punto1: 'Post-it 1', punto2: 'Post-it 2',
  punto3: 'Post-it 3', cta: 'Invito', ctaSub: 'Sotto l’invito', data: 'Data e luogo'
};

const VOCI = Object.entries(PARTNER);
const SECONDI = FRAMES / FPS;

// Anteprima in loop: ferma mentre si registra, per non rubare tempo al video.
function Scheda({ p, cfg, testi, caption, onTesti, onCaption, onReel, occupato }: {
  p: Partner; cfg: Cfg; testi: TestiPartner; caption: string; occupato: boolean;
  onTesti: (t: TestiPartner | undefined) => void; onCaption: (v: string) => void; onReel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [errore, setErrore] = useState('');
  const attuali = useRef({ testi, cfg });
  attuali.current = { testi, cfg };

  useEffect(() => {
    let attivo = true;
    preparaAsset(p).then((a) => attivo && setAsset(a), (e) => attivo && setErrore(e.message));
    return () => { attivo = false; };
  }, [p]);

  useEffect(() => {
    if (!asset || occupato) return;
    let f = 0;
    const timer = setInterval(() => {
      disegnaReel(canvas.current!.getContext('2d')!, f, asset, attuali.current.testi, attuali.current.cfg);
      f = (f + 1) % FRAMES;
    }, 1000 / FPS);
    return () => clearInterval(timer);
  }, [asset, occupato]);

  return (
    <section className="speaker">
      <div className="card-col">
        <canvas ref={canvas} width={W} height={H} className="reel-canvas" />
        <button onClick={onReel} disabled={!asset || occupato}>🎬 Reel {p.nome}</button>
        {errore && <p className="status error">{errore}</p>}
      </div>

      <div className="posts">
        <div className="giorno-head">
          <span className="giorno-data">Sponsor</span>
          <h2>{p.nome}</h2>
          <span className="giorno-formato">reel {W}×{H} · {SECONDI} s</span>
        </div>

        <div className="post reel-campi">
          <div className="post-head"><h3>Testi del reel</h3>
            <span><button className="ghost" onClick={() => onTesti(undefined)}>Ripristina</button></span>
          </div>
          {(Object.keys(p.testi) as (keyof TestiPartner)[]).map((k) => (
            <label key={k}>
              {ETICHETTE[k]}
              <input value={testi[k]} onChange={(e) => onTesti({ ...testi, [k]: e.target.value })} />
            </label>
          ))}
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
      </div>
    </section>
  );
}

export default function Sponsor({ cfg }: { cfg: Cfg }) {
  const regia = useRef<HTMLCanvasElement>(null);
  const [inScena, setInScena] = useState<string | null>(null);     // lo sponsor del reel sul canvas di regia
  const [modifiche, setModifiche] = useState<Record<string, TestiPartner | undefined>>({});   // id partner -> testi
  const [captions, setCaptions] = useState<Record<string, string>>({});     // id partner -> caption
  const [avanzamento, setAvanzamento] = useState('');
  const testiDi = (chiave: string) => modifiche[chiave] ?? PARTNER[chiave].testi;
  const captionDi = (chiave: string) => captions[chiave] ?? PARTNER[chiave].caption(cfg);

  const registra = async (chiave: string, prefisso = '') => {
    const p = PARTNER[chiave];
    const a = await preparaAsset(p);
    setInScena(p.nome);
    try {
      const tela = regia.current!;
      return await registraReel(tela,
        (f) => disegnaReel(tela.getContext('2d')!, f, a, testiDi(chiave), cfg),
        (f, n) => setAvanzamento(`${prefisso}Registro ${p.nome} ${Math.ceil(f / FPS)}/${n / FPS} s…`));
    } finally {
      setInScena(null);
    }
  };

  const unReel = useMutation({
    mutationFn: async (chiave: string) => {
      const { blob, estensione } = await registra(chiave);
      save(blob, `${slug(plainEvent(cfg))}-reel-${chiave}.${estensione}`);
      return PARTNER[chiave].nome;
    },
    onSuccess: (nome) => setAvanzamento(`Reel ${nome} salvato.`),
    onError: (e) => setAvanzamento(`Registrazione fallita: ${e.message}`)
  });

  const tutto = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      for (const [i, [chiave]] of VOCI.entries()) {
        const { blob, estensione } = await registra(chiave, `${i + 1}/${VOCI.length} · `);
        const dir = zip.folder(chiave)!;
        dir.file(`reel.${estensione}`, blob);
        dir.file('caption.txt', captionDi(chiave));
      }
      setAvanzamento('Comprimo lo ZIP…');
      save(await zip.generateAsync({ type: 'blob' }), `${slug(plainEvent(cfg))}-sponsor-completo.zip`);
    },
    onSuccess: () => setAvanzamento(`${VOCI.length} sponsor nello ZIP completo.`),
    onError: (e) => setAvanzamento(`Download completo fallito: ${e.message}`)
  });

  const occupato = unReel.isPending || tutto.isPending;

  return (
    <>
      <section className="speaker download">
        <div className="giorno-head">
          <span className="giorno-data">⬇︎ Download</span>
          <h2>Scarica il kit sponsor</h2>
          <span className="giorno-formato">{VOCI.length} sponsor · reel {W}×{H} da {SECONDI} s e caption</span>
        </div>

        <div className="download-voci">
          <button className="download-voce download-tutto" onClick={() => tutto.mutate()} disabled={occupato}>
            <strong>⬇︎ Tutto il kit</strong>
            <span>reel e caption di ogni sponsor · ZIP, una cartella per sponsor · circa {Math.ceil((VOCI.length * SECONDI) / 60)} min</span>
          </button>
        </div>

        <p className={`status${occupato ? ' in-corso' : ''}`}>
          {avanzamento || 'I reel si registrano in tempo reale (MP4 o WebM, muti): tieni la scheda in primo piano finché il download non parte.'}
        </p>
      </section>

      <section className={`speaker carta-regia${inScena ? '' : ' nascosta'}`}>
        <canvas ref={regia} width={W} height={H} className="reel-canvas" />
        <p className="nota">{inScena ? `In registrazione: ${inScena}` : ''}</p>
      </section>

      <div className="sezione-titolo">
        <h2>Sponsor uno per uno</h2>
        <span>{VOCI.length} schede · anteprima, testi del reel e caption del singolo sponsor</span>
      </div>

      {VOCI.map(([chiave, p]) => (
        <Scheda key={chiave} p={p} cfg={cfg} occupato={occupato}
          testi={testiDi(chiave)} caption={captionDi(chiave)}
          onTesti={(t) => setModifiche((m) => ({ ...m, [chiave]: t }))}
          onCaption={(v) => setCaptions((c) => ({ ...c, [chiave]: v }))}
          onReel={() => unReel.mutate(chiave)} />
      ))}
    </>
  );
}
