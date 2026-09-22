// Un comando solo per lo sviluppo: Vite (hot reload della UI) piu' il server
// Node in --watch (si riavvia da solo quando tocchi server.mjs).
import { spawn } from 'node:child_process';

// In Docker il server sta sulla 8080; in locale quella porta e' spesso occupata
// da altri progetti, quindi in sviluppo si sposta (deve combaciare con vite.config.js).
const PORT = process.env.PORT || '8091';

const figli = [
  ['backend', process.execPath, ['--env-file-if-exists=.env', '--watch', 'server.mjs']],
  ['vite', process.execPath, ['node_modules/vite/bin/vite.js']]
].map(([nome, comando, argomenti]) => {
  const figlio = spawn(comando, argomenti, { stdio: 'inherit', env: { ...process.env, PORT } });
  figlio.on('error', (e) => console.error(`[${nome}]`, e.message));
  return figlio;
});

let chiuso = false;
const chiudi = () => {
  if (chiuso) return;
  chiuso = true;
  for (const f of figli) f.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', chiudi);
process.on('SIGTERM', chiudi);
for (const f of figli) f.on('exit', chiudi);   // se uno muore, spegni anche l'altro
