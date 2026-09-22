// Testi di partenza, generati da template. L'AI, quando c'e', li sostituisce.

export const plainEvent = (cfg) => cfg.eventName.replace(/\*/g, '');

export const instagramPost = (sp, cfg) => `🎤 SPEAKER ANNOUNCEMENT

Diamo il benvenuto a ${sp.name} sul palco di ${plainEvent(cfg)}!
${sp.role}

🗣️ ${sp.kind || 'Talk'}: «${sp.talk}»${sp.room ? `\n🏛️ ${sp.room}` : ''}
📍 ${cfg.place}

🎟️ Biglietti: link in bio

${cfg.hashtag} #DevFest #GDG #GDGMilano #GoogleDevelopers #TechConference #DeveloperCommunity #Milano ${sp.tags}`;

export const linkedinPost = (sp, cfg) => `👏 Un altro speaker confermato per ${plainEvent(cfg)}: ${sp.name}.

${sp.role ? sp.role + '.\n\n' : ''}Sul palco porterà ${(sp.kind || 'Talk') === 'Workshop' ? 'il workshop' : 'il talk'} "${sp.talk}"${sp.room ? `, in ${sp.room}` : ''}.

${plainEvent(cfg)} è la conferenza della community GDG: una giornata di talk tecnici, networking e confronto tra chi costruisce software ogni giorno.

📍 ${cfg.place}
🎟️ Biglietti e programma: ${cfg.ticketUrl}

${cfg.hashtag} #DevFest #GDG #GoogleDevelopers #TechCommunity ${sp.tags}`;

// La chiave sta sul server: qui si passa solo il materiale grezzo di Sessionize.
export async function generaConAI(sp, cfg, prompt) {
  const res = await fetch('/genera', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      evento: {
        nome: plainEvent(cfg),
        quando: cfg.place,
        organizzatori: cfg.organizers,
        hashtagPrincipale: cfg.hashtag,
        biglietti: cfg.ticketUrl
      },
      speaker: {
        nome: sp.name,
        ruolo: sp.roleFull || sp.role,
        bio: sp.bio,
        tipo: sp.kind,
        talk: sp.talk,
        abstract: sp.abstract,
        sala: sp.room,
        argomenti: sp.tags
      }
    })
  });
  const dati = await res.json();
  if (!res.ok) throw new Error(dati.errore || `il server ha risposto ${res.status}`);
  return dati;
}
