import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initStorage, seedIfNeeded, runMigrationIfNeeded } from "./storage";
import { initTheme } from "./theme";
import "./app.css";

initTheme();

void (async () => {
  await initStorage();
  seedIfNeeded();
  runMigrationIfNeeded();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
})();
