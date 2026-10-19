import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Card from './Card.jsx';
import Carte from './Carte.jsx';
import CaricaCarte, { useCarteCaricate } from './CaricaCarte.jsx';
import Persone, { usePersone } from './Persone.jsx';
import Sponsor from './Sponsor.jsx';
import Team from './Team.jsx';
import { kitCaricato, kitDa } from './carte.js';
import { DEMO, fetchSpeakers } from './sessionize.js';
import { generaConAI, instagramPost, linkedinPost, plainEvent } from './posts.js';
import { FORMATI, esportaTutto, pngName, renderCard, save } from './export.js';

const DEFAULTS = {
  apiId: 'qcrth74k',
  eventName: 'DevFest Milano 2026',
  organizers: 'GDG Cloud Milano & GDG Milano',
  place: 'Milano | 10 Ottobre 2026',
  hashtag: '#DevFestMilano',
  ticketUrl: 'https://2026.devfestmilano.it'
};

// Sezione e sottosezione stanno nel percorso (/kit-social-speaker/foto): un link
// apre il tab giusto e avanti/indietro del browser funzionano.
const SEZIONI = [['organizzatori-sponsor', '👥 Organizzatori e sponsor'], ['carte', '📤 Carica carte'], ['speaker', '🎤 Locandine speaker'], ['kit-social-speaker', '🃏 Kit social speaker'], ['kit-social-sponsors', '🤝 Kit social sponsors'], ['kit-social-organizzatori', '🙌 Kit social organizzatori']];

const leggiPercorso = () => location.pathname.split('/').filter(Boolean);

function usePercorso() {
  const [parti, setParti] = useState(leggiPercorso);
  useEffect(() => {
    const aggiorna = () => setParti(leggiPercorso());
    addEventListener('popstate', aggiorna);
    return () => removeEventListener('popstate', aggiorna);
  }, []);
  // la query (?api=...) resta: cambiare tab non deve cambiare evento
  const vai = (...nuove) => {
    history.pushState(null, '', `/${nuove.join('/')}${location.search}`);
    setParti(nuove);
  };
  return [parti, vai];
}

// Instagram e Facebook hanno lo stesso formato: in anteprima basta una voce.
const ANTEPRIME = [['instagram', '4:5 · Instagram e Facebook'], ['linkedin', '1:1 · LinkedIn']];

const CAMPI = [
  ['apiId', 'Sessionize API ID', 'es. 4qmcvnlr'],
  ['eventName', 'Nome evento', 'DevFest Milano 2026'],
  ['organizers', 'Organizzatori', 'GDG Cloud Milano & GDG Milano'],
  ['place', 'Luogo e data', 'Milano | 10 Ottobre 2026'],
  ['hashtag', 'Hashtag principale', '#DevFestMilano'],
  ['ticketUrl', 'Link biglietti', 'https://2026.devfestmilano.it']
];

// Salvo solo quello che l'utente ha davvero confermato: scrivere i default al
// primo avvio li congelerebbe, e un default aggiornato non arriverebbe piu'.
const leggiCfg = () => {
  const salvato = JSON.parse(localStorage.getItem('devfest-cfg-v4') || '{}');
  const daUrl = new URLSearchParams(location.search).get('api');
  return { ...DEFAULTS, ...salvato, ...(daUrl ? { apiId: daUrl } : {}) };
};

// Una generazione AI e' ~25 secondi: in fila 23 speaker diventano dieci minuti.
async function inParallelo(elementi, quanti, lavoro) {
  const coda = [...elementi];
  const operaio = async () => { while (coda.length) await lavoro(coda.shift()); };
  await Promise.all(Array.from({ length: Math.min(quanti, elementi.length) }, operaio));
}

function Speaker({ speaker, post, cfg, prompt, anteprima, aiAttiva, onCampo, onPost, registra }) {
  const cardRef = useRef(null);

  const ai = useMutation({
    mutationFn: () => generaConAI(speaker, cfg, prompt),
    onSuccess: (testi) => onPost(testi)
  });

  const scarica = useMutation({
    mutationFn: async (formato) => {
      const canvas = await renderCard(cardRef.current, formato);
      await new Promise((r) => canvas.toBlob((b) => {
        save(b, pngName(cfg, speaker.name, document.body.classList.contains('dark'), formato));
        r();
      }));
    }
  });

  // il parent ha bisogno della card per lo ZIP e della mutation per "genera tutti"
  registra(speaker.id, { get card() { return cardRef.current; }, genera: ai.mutateAsync });

  return (
    <section className={`speaker${ai.isPending ? ' occupato' : ''}`}>
      <div className="card-col">
        <div className="card-scroll">
          <Card innerRef={cardRef} speaker={speaker} cfg={cfg} onChange={onCampo}
            formato={FORMATI.find((f) => f.id === anteprima)} />
        </div>
        <div className="card-download">
          {FORMATI.map((f) => (
            <button key={f.id} className="ghost" onClick={() => scarica.mutate(f)} disabled={scarica.isPending}>
              {scarica.isPending && scarica.variables === f ? 'Preparo…' : `⬇︎ ${f.nome}`}
              <small>{f.w}×{f.h}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="posts">
        {[['Instagram', 'instagram'], ['LinkedIn', 'linkedin']].map(([titolo, chiave]) => (
          <div className="post" key={chiave}>
            <div className="post-head">
              <h3>{titolo}</h3>
              <span>
                {aiAttiva && chiave === 'instagram' && (
                  <button className="ghost" onClick={() => ai.mutate()} disabled={ai.isPending}>
                    {ai.isPending ? '✨ Scrivo…' : '✨ Rigenera con AI'}
                  </button>
                )}
                <button className="ghost" onClick={(e) => {
                  navigator.clipboard.writeText(post[chiave]);
                  const b = e.currentTarget;
                  b.textContent = 'Copiato ✓';
                  setTimeout(() => (b.textContent = 'Copia'), 1500);
                }}>Copia</button>
              </span>
            </div>
            <textarea value={post[chiave]}
              onChange={(e) => onPost({ ...post, [chiave]: e.target.value })} />
          </div>
        ))}
        {ai.isError && <p className="errore">⚠️ {ai.error.message}</p>}
      </div>
    </section>
  );
}

export default function App() {
  const [cfg, setCfg] = useState(leggiCfg);
  const [bozza, setBozza] = useState(cfg);
  const [filtro, setFiltro] = useState('');
  const [scuro, setScuro] = useState(() => localStorage.getItem('devfest-theme') === 'dark');
  const [avanzamento, setAvanzamento] = useState('');
  const [prompt, setPrompt] = useState(() => localStorage.getItem('devfest-prompt') || '');
  const [anteprima, setAnteprima] = useState(() =>
    localStorage.getItem('devfest-anteprima') === 'linkedin' ? 'linkedin' : 'instagram');
  const [[sezione, sotto], vai] = usePercorso();
  // Qui e non nelle sezioni: carte e anagrafica le usano anche i kit.
  const carte = useCarteCaricate();
  const persone = usePersone();
  // percorso sconosciuto o radice: gli speaker
  const vista = SEZIONI.some(([id]) => id === sezione) ? sezione : 'speaker';

  // Stato modificabile, tenuto qui e non nelle card: serve per esportarlo tutto
  // insieme e, soprattutto, per poterlo riempire da un file importato.
  const [modifiche, setModifiche] = useState({});   // id -> campi della locandina
  const [testi, setTesti] = useState({});           // id -> { instagram, linkedin }
  const righe = useRef(new Map());

  useEffect(() => {
    document.body.classList.toggle('dark', scuro);
    localStorage.setItem('devfest-theme', scuro ? 'dark' : 'light');
  }, [scuro]);

  const stato = useQuery({
    queryKey: ['stato'],
    queryFn: async () => (await fetch('/stato')).json(),
    staleTime: Infinity
  });

  const speakers = useQuery({
    queryKey: ['speakers', cfg.apiId],
    queryFn: () => (cfg.apiId ? fetchSpeakers(cfg.apiId) : DEMO),
    staleTime: 5 * 60 * 1000
  });
  const kitSpeaker = useMemo(() => kitDa(speakers.data || []), [speakers.data]);
  const caricato = useMemo(() => kitCaricato(kitSpeaker, carte.carte, carte.scelte, persone.persone),
    [kitSpeaker, carte.carte, carte.scelte, persone.persone]);

  const elenco = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return (speakers.data || [])
      .map((sp) => ({ ...sp, ...modifiche[sp.id] }))
      .filter((sp) => !q || `${sp.name} ${sp.talk} ${sp.room} ${sp.tags}`.toLowerCase().includes(q));
  }, [speakers.data, modifiche, filtro]);

  const postDi = (sp) =>
    testi[sp.id] ?? { instagram: instagramPost(sp, cfg), linkedin: linkedinPost(sp, cfg) };

  const visibili = () => elenco.map((sp) => ({
    speaker: sp,
    post: postDi(sp),
    ...righe.current.get(sp.id)
  })).filter((v) => v.card);

  const generaTutti = useMutation({
    mutationFn: async () => {
      const voci = visibili();
      let fatti = 0, errori = 0;
      await inParallelo(voci, 3, async (voce) => {
        try { await voce.genera(); } catch { errori++; }
        setAvanzamento(`Scrivo ${++fatti}/${voci.length}…`);
      });
      setAvanzamento(`Testi generati${errori ? `, ${errori} falliti` : ''}.`);
    }
  });

  const zip = useMutation({
    mutationFn: () => esportaTutto({
      voci: visibili(),
      cfg,
      scuro,
      onProgress: (i, n) => setAvanzamento(`Preparo ${i}/${n}…`)
    }),
    onSuccess: () => setAvanzamento(`${elenco.length} speaker × ${FORMATI.length} formati + testi nello ZIP.`)
  });

  /* ---------- Esporta / importa il lavoro fatto ---------- */

  function esportaTesti() {
    const dati = {
      formato: 'devfest-post',
      versione: 1,
      esportatoIl: new Date().toISOString(),
      evento: cfg,
      speaker: elenco.map((sp) => ({
        id: sp.id,
        nome: sp.name,
        locandina: modifiche[sp.id] || {},
        post: postDi(sp)
      }))
    };
    save(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }),
      `${plainEvent(cfg).toLowerCase().replace(/\s+/g, '-')}-testi.json`);
    setAvanzamento(`${elenco.length} schede esportate.`);
  }

  async function importaTesti(file) {
    try {
      const dati = JSON.parse(await file.text());
      if (dati.formato !== 'devfest-post') throw new Error('non e’ un export di questa app');

      // Gli id valgono per lo stesso evento; se cambiano, ripiego sul nome.
      const perNome = new Map((speakers.data || []).map((sp) => [sp.name.toLowerCase(), sp.id]));
      const noviModifiche = {}, noviTesti = {};
      let presi = 0, saltati = 0;
      for (const voce of dati.speaker || []) {
        const id = (speakers.data || []).some((sp) => sp.id === voce.id)
          ? voce.id
          : perNome.get(String(voce.nome || '').toLowerCase());
        if (!id) { saltati++; continue; }
        if (voce.locandina && Object.keys(voce.locandina).length) noviModifiche[id] = voce.locandina;
        if (voce.post) noviTesti[id] = voce.post;
        presi++;
      }

      if (dati.evento) { setCfg(dati.evento); setBozza(dati.evento); }
      setModifiche((m) => ({ ...m, ...noviModifiche }));
      setTesti((t) => ({ ...t, ...noviTesti }));
      setAvanzamento(`Importate ${presi} schede${saltati ? `, ${saltati} senza corrispondenza` : ''}.`);
    } catch (err) {
      setAvanzamento(`Import fallito: ${err.message}`);
    }
  }

  const conferma = (e) => {
    e.preventDefault();
    localStorage.setItem('devfest-cfg-v4', JSON.stringify(bozza));
    setCfg(bozza);
  };

  const occupato = generaTutti.isPending || zip.isPending || speakers.isFetching;
  const messaggio = speakers.isFetching ? 'Carico da Sessionize…'
    : speakers.isError ? `Errore: ${speakers.error.message}`
    : avanzamento || (cfg.apiId ? `${elenco.length} speaker confermati.` : 'Nessun API ID: speaker di esempio.');

  return (
    <>
      <header className="topbar">
        <h1>DevFest post generator</h1>

        <form className="config" onSubmit={conferma}>
          {CAMPI.map(([nome, etichetta, placeholder]) => (
            <label key={nome}>
              {etichetta}
              <input value={bozza[nome]} placeholder={placeholder}
                onChange={(e) => setBozza({ ...bozza, [nome]: e.target.value })} />
            </label>
          ))}
          <div className="actions">
            <button type="submit">Carica speaker</button>
            <button type="button" className="ghost" onClick={() => setScuro((v) => !v)}>
              {scuro ? '☀️ Chiaro' : '🌙 Scuro'}
            </button>
          </div>
        </form>

        <nav className="sezioni">
          {SEZIONI.map(([id, etichetta]) => (
            <button key={id} type="button" aria-current={vista === id ? 'page' : undefined}
              onClick={() => vai(id)}>{etichetta}</button>
          ))}
        </nav>
      </header>

      <main>
        {vista === 'carte'
          ? <CaricaCarte speakers={kitSpeaker} persone={persone.persone} {...carte}
              onKit={() => vai('kit-social-speaker', 'carta')} onPersone={() => vai('organizzatori-sponsor')} />
          : vista === 'organizzatori-sponsor'
          ? <Persone {...persone} onCarte={() => vai('carte')} />
          : vista === 'kit-social-speaker'
          ? <Carte cfg={cfg} speakers={speakers.data || []} caricato={caricato}
              modo={sotto === 'foto' ? 'foto' : 'carta'} onModo={(m) => vai('kit-social-speaker', m)} />
          : vista === 'kit-social-sponsors'
          ? <Sponsor cfg={cfg} />
          : vista === 'kit-social-organizzatori'
          ? <Team cfg={cfg} team={caricato.team} modo={sotto === 'foto' ? 'foto' : 'carta'} onModo={(m) => vai('kit-social-organizzatori', m)} />
          : <>
            {/* Header uguale in ogni sezione: gli strumenti delle locandine stanno qui,
                nello stesso pannello che il kit usa per i suoi download. */}
            <section className="speaker download">
              <div className="giorno-head">
                <span className="giorno-data">⬇︎ Download</span>
                <h2>Scarica le locandine</h2>
                <span className="giorno-formato">PNG per Instagram, Facebook e LinkedIn e testi dei post</span>
              </div>

              <div className="campo">
                Anteprima
                <nav className="sottosezioni">
                  {ANTEPRIME.map(([id, etichetta]) => (
                    <button key={id} type="button" aria-pressed={anteprima === id} onClick={() => {
                      setAnteprima(id);
                      localStorage.setItem('devfest-anteprima', id);
                    }}>{etichetta}</button>
                  ))}
                </nav>
              </div>

              <div className="download-voci">
                <button className="download-voce download-tutto" onClick={() => zip.mutate()} disabled={occupato || !elenco.length}>
                  <strong>📦 Tutte le locandine + testi</strong>
                  <span>{FORMATI.map((f) => `${f.nome} ${f.w}×${f.h}`).join(' · ')} per {elenco.length} speaker, più testi-post.doc · ZIP</span>
                </button>
                {stato.data?.ai && (
                  <button className="download-voce ghost" onClick={() => generaTutti.mutate()} disabled={occupato || !elenco.length}>
                    <strong>✨ Genera tutti i testi con AI</strong>
                    <span>riscrive Instagram e LinkedIn, tre speaker alla volta</span>
                  </button>
                )}
                <button className="download-voce ghost" onClick={esportaTesti} disabled={!elenco.length}>
                  <strong>⬇︎ Esporta testi</strong>
                  <span>salva testi e modifiche in JSON</span>
                </button>
                <label className="download-voce importa">
                  <strong>⬆︎ Importa testi</strong>
                  <span>riprendi da un export JSON</span>
                  <input type="file" accept="application/json,.json"
                    onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importaTesti(f); }} />
                </label>
              </div>

              {stato.data?.ai && (
                <details className="prompt" open={Boolean(prompt)}>
                  <summary>✨ Prompt di generazione {prompt ? '(personalizzato)' : '(predefinito)'}</summary>
                  <textarea
                    value={prompt || stato.data.promptDefault || ''}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      localStorage.setItem('devfest-prompt', e.target.value);
                    }}
                  />
                  <div className="prompt-azioni">
                    <button type="button" className="ghost" disabled={!prompt}
                      onClick={() => { setPrompt(''); localStorage.removeItem('devfest-prompt'); }}>
                      Ripristina il predefinito
                    </button>
                    <span className="nota">Vale per "Rigenera con AI" e per la generazione in blocco.</span>
                  </div>
                </details>
              )}

              <p className={`status${occupato ? ' in-corso' : ''}${speakers.isError ? ' error' : ''}`}>
                {messaggio}
              </p>
            </section>

            <div className="sezione-titolo">
              <h2>Speaker uno per uno</h2>
              <span>locandina e testi del singolo speaker</span>
              <input value={filtro} placeholder="Filtra per nome, talk, sala o hashtag…"
                onChange={(e) => setFiltro(e.target.value)} />
            </div>

            {speakers.isPending
              ? [0, 1].map((i) => <section className="speaker scheletro" key={i} />)
              : elenco.map((sp) => (
                  <Speaker key={sp.id} speaker={sp} post={postDi(sp)} cfg={cfg} prompt={prompt}
                    anteprima={anteprima} aiAttiva={Boolean(stato.data?.ai)}
                    onCampo={(patch) => setModifiche((m) => ({ ...m, [sp.id]: { ...m[sp.id], ...patch } }))}
                    onPost={(nuovi) => setTesti((t) => ({ ...t, [sp.id]: nuovi }))}
                    registra={(id, voce) => righe.current.set(id, voce)} />
                ))}
          </>}
      </main>
    </>
  );
}
