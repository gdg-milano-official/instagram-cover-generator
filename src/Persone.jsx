// Anagrafica di organizzatori e sponsor: la usano Carica carte (per abbinare le
// carte) e il kit organizzatori. Finche' non la tocchi viene da public/carte/team.json
// e dai partner di reel.js; alla prima modifica resta nel localStorage.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSalvato } from './CaricaCarte.jsx';
import { PARTNER } from './reel.js';

const SPONSOR = Object.entries(PARTNER).map(([id, p]) => ({ id: `partner-${id}`, name: p.nome, role: '' }));
const nuovoId = (gruppo) => `${gruppo}-${crypto.randomUUID().slice(0, 8)}`;

export function usePersone() {
  const [salvate, setSalvate] = useSalvato('devfest-persone', null);
  const team = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await fetch('/carte/team.json');
      return res.ok ? res.json() : [];
    },
    staleTime: Infinity
  });
  // stabile tra un render e l'altro: i kit rifanno le anteprime quando cambia
  const persone = useMemo(() => salvate || { team: team.data || [], partner: SPONSOR }, [salvate, team.data]);
  return {
    persone,
    modificata: Boolean(salvate),
    setPersone: (f) => setSalvate(f(persone)),
    ripristina: () => setSalvate(null)
  };
}

// La foto finisce nel localStorage: la rimpicciolisco a 600 px e la salvo in JPEG.
function fotoDa(file) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * s;
      c.height = img.height * s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => ko(new Error(`immagine non leggibile: ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

const CAMPI = {
  team: [['name', 'Nome e cognome'], ['role', 'Ruolo, es. Organizzatore GDG Milano'], ['lavoro', 'Lavoro, es. CTO @ Azienda']],
  partner: [['name', 'Nome'], ['role', 'Sottotitolo, es. Gold sponsor']]
};

export default function Persone({ persone, setPersone, modificata, ripristina, onCarte }) {
  const cambia = (gruppo, id, patch) =>
    setPersone((p) => ({ ...p, [gruppo]: p[gruppo].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const togli = (gruppo, id) => setPersone((p) => ({ ...p, [gruppo]: p[gruppo].filter((x) => x.id !== id) }));
  const aggiungi = (gruppo) => setPersone((p) => ({ ...p, [gruppo]: [...p[gruppo], { id: nuovoId(gruppo), name: '', role: '' }] }));

  return (
    <section className="speaker persone">
      <div className="giorno-head">
        <span className="giorno-data">👥 Anagrafica</span>
        <h2>Organizzatori e sponsor</h2>
        <span className="giorno-formato">
          {persone.team.length} organizzatori · {persone.partner.length} sponsor · {modificata ? 'modificata a mano' : 'da team.json e partner'}
        </span>
      </div>

      {[['team', '🧑‍💻 Organizzatori', 'organizzatore'], ['partner', '🤝 Sponsor', 'sponsor']].map(([gruppo, titolo, uno]) => (
        <div key={gruppo} className="persone-gruppo">
          <h3 className="carica-titolo">{titolo}</h3>
          {persone[gruppo].map((p) => (
            <div key={p.id} className="persone-riga">
              {gruppo === 'team' && (
                <label className="persone-foto" title="Cambia foto">
                  {p.foto ? <img src={p.foto} alt="" /> : <span>+ foto</span>}
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) cambia(gruppo, p.id, { foto: await fotoDa(file) });
                  }} />
                </label>
              )}
              {CAMPI[gruppo].map(([campo, segnaposto]) => (
                <input key={campo} value={p[campo] || ''} placeholder={segnaposto}
                  onChange={(e) => cambia(gruppo, p.id, { [campo]: e.target.value })} />
              ))}
              <button type="button" className="ghost" title={`Togli ${uno}`} onClick={() => togli(gruppo, p.id)}>✕</button>
            </div>
          ))}
          <div className="slide-azioni">
            <button type="button" className="ghost" onClick={() => aggiungi(gruppo)}>+ Aggiungi {uno}</button>
          </div>
        </div>
      ))}

      <div className="slide-azioni">
        <button type="button" className="ghost" onClick={ripristina} disabled={!modificata}>↺ Ripristina da team.json e partner</button>
        <button type="button" onClick={onCarte}>📤 Abbina le carte</button>
      </div>
      <p className="nota">Il kit organizzatori usa questo elenco; la carta di ognuno è quella abbinata in Carica carte
        o, se non c'è, quella di team.json. Il kit sponsors resta sui partner di reel.js: logo, immagini e colori non stanno qui.</p>
    </section>
  );
}
