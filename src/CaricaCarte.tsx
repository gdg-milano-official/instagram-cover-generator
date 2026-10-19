// Sezione "Carica carte": le immagini delle carte arrivano dal disco e si
// collegano a speaker Sessionize, organizzatori o sponsor (questi ultimi dalla
// sezione Organizzatori e sponsor). I kit le usano al posto di public/carte/.
// Per nome si abbinano da sole, il resto si trascina (o si clicca la carta e poi
// la riga). Le carte vivono solo nella scheda; gli abbinamenti a mano restano nel
// localStorage per nome di file, cosi' ricaricando la stessa cartella tornano a posto.
import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { abbinamenti, cartaDaFile } from './carte.ts';
import type { Carta, KitSpeaker, Persone, Scelte } from './carte.ts';

const ordine = (c: Carta) => Number(c.numero) || Infinity;

function salvato<T>(chiave: string, iniziale: T): T {
  try {
    return JSON.parse(localStorage.getItem(chiave) ?? 'null') ?? iniziale;
  } catch {
    return iniziale;
  }
}

export function useSalvato<T>(chiave: string, iniziale: T) {
  const [valore, setValore] = useState(() => salvato(chiave, iniziale));
  useEffect(() => localStorage.setItem(chiave, JSON.stringify(valore)), [chiave, valore]);
  return [valore, setValore] as const;
}

// Lo stato sta in App: le carte servono anche fuori da questa sezione.
export function useCarteCaricate() {
  const [carte, setCarte] = useState<Carta[]>([]);
  const [scelte, setScelte] = useSalvato<Scelte>('carte-scelte', {});   // id -> file, a mano
  return { carte, setCarte, scelte, setScelte };
}

type Riga = { id: string; name: string; role: string; foto?: string };

export default function CaricaCarte({ speakers, persone, carte, setCarte, scelte, setScelte, onKit, onPersone }:
  ReturnType<typeof useCarteCaricate> & { speakers: KitSpeaker[]; persone: Persone; onKit: () => void; onPersone: () => void }) {
  const gruppi: [string, Riga[], (r: Riga) => string][] = [
    ['🎤 Speaker', speakers, (sp) => (sp as KitSpeaker).talk],
    ['🧑‍💻 Organizzatori', persone.team, (p) => p.role],
    ['🤝 Sponsor', persone.partner, (p) => p.role]
  ];
  const collegate = abbinamenti(gruppi.flatMap(([, elenco]) => elenco), carte, scelte);
  const [presa, setPresa] = useState<string | null>(null);   // carta scelta col click, aspetta la riga
  const [sopra, setSopra] = useState<string | null>(null);   // dove sta passando il trascinamento
  const perFile = new Map(carte.map((c) => [c.file, c]));
  const usate = new Set(Object.values(collegate));
  const libere = carte.filter((c) => !usate.has(c.file));
  const conta = (elenco: Riga[]) => `${elenco.filter((sp) => collegate[sp.id]).length}/${elenco.length}`;

  function aggiungi(files: FileList) {
    const nuove = [...files].filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ ...cartaDaFile(f.name), url: URL.createObjectURL(f) }));
    setCarte((prima) => [...prima.filter((c) => !nuove.some((n) => n.file === c.file)), ...nuove]
      .sort((a, b) => ordine(a) - ordine(b) || a.nome.localeCompare(b.nome, 'it')));
  }

  // Una carta va a una sola riga: chi l'aveva a mano torna all'abbinamento per nome.
  function collega(id: string, file: string | null) {
    setScelte((s) => ({ ...Object.fromEntries(Object.entries(s).filter(([, f]) => !file || f !== file)), [id]: file }));
    setPresa(null);
  }

  const trascina = (file: string) => ({ draggable: true, onDragStart: (e: DragEvent) => e.dataTransfer.setData('text/plain', file) });
  // Sullo stesso bersaglio possono cadere file dal disco o una carta della pagina.
  const bersaglio = (id: string, azione: (file: string) => void) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); setSopra(id); },
    onDragLeave: () => setSopra((s) => (s === id ? null : s)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setSopra(null);
      if (e.dataTransfer.files.length) return aggiungi(e.dataTransfer.files);
      const file = e.dataTransfer.getData('text/plain');
      if (perFile.has(file)) azione(file);
    }
  });

  return (
    <section className="speaker carica-carte">
      <div className="giorno-head">
        <span className="giorno-data">📤 Carica carte</span>
        <h2>Abbina ogni carta a speaker, organizzatori o sponsor</h2>
        <span className="giorno-formato">
          {gruppi.map(([titolo, elenco]) => `${conta(elenco)} ${titolo.split(' ')[1].toLowerCase()}`).join(' · ')} · {libere.length} libere
        </span>
      </div>

      <label className={`carica-zona${sopra === 'zona' ? ' sopra' : ''}`} {...bersaglio('zona', () => {})}>
        <input type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) aggiungi(e.target.files); e.target.value = ''; }} />
        <strong>Trascina qui le carte o clicca per sceglierle</strong>
        <span>file "NN.Nome_Cognome (...).png": numero e nome li leggo dal file e abbino per nome</span>
      </label>

      {carte.length > 0 && (
        <div className={`carica-libere${sopra === 'libere' ? ' sopra' : ''}`} {...bersaglio('libere', (file) => {
          const id = Object.keys(collegate).find((k) => collegate[k] === file);
          if (id) collega(id, null);
        })}>
          {libere.length ? libere.map((c) => (
            <figure key={c.file} className={presa === c.file ? 'presa' : ''} {...trascina(c.file)}
              onClick={() => setPresa(presa === c.file ? null : c.file)}>
              <img src={c.url} alt={c.nome} />
              <figcaption>{c.numero && `${c.numero} · `}{c.nome}</figcaption>
            </figure>
          )) : <p className="nota">Nessuna carta libera: trascina qui una carta per scollegarla.</p>}
        </div>
      )}

      {gruppi.map(([titolo, elenco, sotto]) => (
        <div key={titolo} className="carica-gruppo">
          <h3 className="carica-titolo">{titolo} · {conta(elenco)}</h3>
          {elenco.length ? (
            <ol className="carica-elenco">
              {elenco.map((sp) => {
                const c = perFile.get(collegate[sp.id] ?? '');
                return (
                  <li key={sp.id} className={`${c ? 'collegato' : ''}${sopra === sp.id ? ' sopra' : ''}${presa ? ' in-attesa' : ''}`}
                    {...bersaglio(sp.id, (file) => collega(sp.id, file))}
                    onClick={() => presa && collega(sp.id, presa)}>
                    {sp.foto ? <img className="carica-foto" src={sp.foto} alt="" /> : <span className="carica-foto" />}
                    <div className="carica-chi">
                      <strong>{sp.name}</strong>
                      <span>{sotto(sp)}</span>
                    </div>
                    <span className="carica-filo" />
                    {c ? (
                      <figure className="carica-slot" {...trascina(c.file)} title={c.file}>
                        <img src={c.url} alt={c.nome} />
                        <button type="button" className="ghost" title="Scollega"
                          onClick={(e) => { e.stopPropagation(); collega(sp.id, null); }}>✕</button>
                        {!(sp.id in scelte) && <small>per nome</small>}
                      </figure>
                    ) : <span className="carica-slot vuoto">{presa ? 'clicca qui' : 'trascina qui'}</span>}
                  </li>
                );
              })}
            </ol>
          ) : elenco === speakers
            ? <p className="nota">Nessuno speaker da Sessionize: inserisci l’API ID in alto e premi Carica speaker.</p>
            : <p className="nota">Nessuno in elenco: aggiungili nella sezione Organizzatori e sponsor.</p>}
        </div>
      ))}

      <div className="slide-azioni">
        <button type="button" className="ghost" onClick={() => setScelte({})}>↺ Riabbina tutto per nome</button>
        <button type="button" className="ghost" onClick={() => { setCarte([]); setPresa(null); }} disabled={!carte.length}>Togli le carte</button>
        <button type="button" className="ghost" onClick={onPersone}>👥 Modifica organizzatori e sponsor</button>
        <button type="button" onClick={onKit} disabled={!carte.length}>🃏 Vai al kit social</button>
      </div>
      <p className="nota">Le carte restano solo in questa scheda: ricaricando la pagina vanno riscelte, gli abbinamenti fatti a mano invece restano.
        Finché ci sono, i kit usano queste al posto di quelle generate dagli script.</p>
    </section>
  );
}
