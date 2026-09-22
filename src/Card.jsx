// La locandina. Ogni testo e' modificabile a mano: contentEditable non
// controllato, l'eventuale modifica sale al parent sul blur.
const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Titoli lunghi: scala il corpo invece di sbordare dalla card.
const fit = (text, base, max) =>
  text.length > max ? Math.max(14, Math.round((base * max) / text.length)) : base;

// L'anno finale prende i quattro colori Google, come sul sito.
function Brand({ nome }) {
  const pezzi = nome.split(/(\*[^*]+\*)|(\b\d{4}\b)/g).filter(Boolean);
  return (
    <div className="brand">
      {pezzi.map((pezzo, i) => {
        if (/^\*.+\*$/.test(pezzo)) return <span className="hl" key={i}>{pezzo.slice(1, -1)}</span>;
        if (/^\d{4}$/.test(pezzo))
          return [...pezzo].map((cifra, k) => <span className={`y${k + 1}`} key={`${i}-${k}`}>{cifra}</span>);
        return <span key={i}>{pezzo}</span>;
      })}
    </div>
  );
}

function Campo({ className, style, valore, onChange }) {
  return (
    <div
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        const testo = e.currentTarget.textContent;
        if (testo !== valore) onChange(testo);
      }}
    >
      {valore}
    </div>
  );
}

export default function Card({ innerRef, speaker, cfg, onChange }) {
  return (
    <div className="card" ref={innerRef}>
      <div className="accent-bar" />

      <div className="header">
        <div>
          <div className="eyebrow">
            <span className="dots"><i /><i /><i /><i /></span>
            {cfg.organizers}
          </div>
          <Brand nome={cfg.eventName} />
        </div>
        <Campo className="chip-room" valore={speaker.room} onChange={(v) => onChange({ room: v })} />
      </div>

      <div className="content">
        <div className="avatar-container">
          {speaker.photo
            ? (
              // Foto come background e non <img>: html2canvas non ritaglia in modo
              // affidabile un <img> con border-radius, e la foto esce dal cerchio.
              <div className="avatar-frame">
                <div className="avatar-foto" role="img" aria-label={speaker.name}
                  style={{ backgroundImage: `url("${speaker.photo}")` }} />
              </div>
            )
            : <div className="avatar-initials">{initials(speaker.name)}</div>}
        </div>
        <div className="speaker-details">
          <Campo className="speaker-name" style={{ fontSize: fit(speaker.name, 34, 19) }}
            valore={speaker.name} onChange={(v) => onChange({ name: v })} />
          <Campo className="speaker-role" style={{ fontSize: fit(speaker.role, 16, 44) }}
            valore={speaker.role} onChange={(v) => onChange({ role: v })} />
        </div>
      </div>

      <div className="talk-box">
        <Campo className="talk-label" valore={speaker.kind || 'Talk'}
          onChange={(v) => onChange({ kind: v })} />
        <Campo className="talk-title" style={{ fontSize: fit(speaker.talk, 20, 64) }}
          valore={speaker.talk} onChange={(v) => onChange({ talk: v })} />
      </div>

      <Campo className="talk-tags" valore={speaker.tags} onChange={(v) => onChange({ tags: v })} />

      <div className="footer">
        <div className="event-date">{cfg.place}</div>
        <div className="hashtag">{cfg.hashtag}</div>
      </div>
    </div>
  );
}
