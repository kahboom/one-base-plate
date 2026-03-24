import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initStorage, seedIfNeeded, runMigrationIfNeeded, runRecipeRefMigrationIfNeeded, loadHouseholds } from "./storage";
import { initTheme } from "./theme";
import { AuthProvider } from "./auth/AuthContext";
import { initOnlineListeners, setLoadHouseholdsRef } from "./sync/sync-engine";
import "./app.css";

initTheme();

void (async () => {
  await initStorage();
  await seedIfNeeded();
  runMigrationIfNeeded();
  runRecipeRefMigrationIfNeeded();

  setLoadHouseholdsRef(loadHouseholds);
  initOnlineListeners();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>,
  );
})();
