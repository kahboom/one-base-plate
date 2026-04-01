import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import {
  initStorage,
  seedIfNeeded,
  backfillBundledSeedIngredientImageUrls,
  runMigrationIfNeeded,
  runRecipeRefMigrationIfNeeded,
  runStripWholeMealTagsIfNeeded,
  runStripThemeRecipeTagsIfNeeded,
} from './storage';
import { initTheme } from './theme';
import { AuthProvider } from './auth/AuthContext';
import { initOnlineListeners } from './sync/sync-engine';
import './app.css';

initTheme();

void (async () => {
  await initStorage();
  await seedIfNeeded();
  backfillBundledSeedIngredientImageUrls();
  runMigrationIfNeeded();
  runRecipeRefMigrationIfNeeded();
  runStripWholeMealTagsIfNeeded();
  runStripThemeRecipeTagsIfNeeded();

  initOnlineListeners();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>,
  );
})();
