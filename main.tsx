import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { hydrateStaticMedia, installStaticApiFallback } from './lib/staticFallback';
import App from './App.tsx';
import './index.css';

installStaticApiFallback();
registerSW({ immediate: true });

async function boot() {
  try {
    await Promise.race([
      hydrateStaticMedia(),
      new Promise<void>((resolve) => setTimeout(resolve, 450)),
    ]);
  } catch {
    // proceed even if IndexedDB is restricted
  }
  createRoot(document.getElementById('root')!).render(<App />);
}

void boot();
