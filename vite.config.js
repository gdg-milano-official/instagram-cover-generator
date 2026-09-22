import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In sviluppo Vite serve la UI e gira le chiamate al server Node (npm run server).
const backend = `http://localhost:${process.env.PORT || 8091}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(['/api', '/img', '/genera', '/stato'].map((p) => [p, backend]))
  }
});
