export const THEME_STORAGE_KEY = 'onebaseplate-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

export function loadThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function applyThemeToDocument(pref: ThemePreference): void {
  document.documentElement.dataset.theme = pref;
  if (pref === 'light') {
    document.documentElement.style.colorScheme = 'light';
  } else if (pref === 'dark') {
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.style.colorScheme = 'light dark';
  }
}

export function saveThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  applyThemeToDocument(pref);
}

function onStorageTheme(e: StorageEvent): void {
  if (e.key !== THEME_STORAGE_KEY || e.newValue == null) return;
  if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
    applyThemeToDocument(e.newValue);
  }
}

/** Call once at startup (after HTML inline script). Keeps other tabs in sync. */
export function initTheme(): void {
  applyThemeToDocument(loadThemePreference());
  window.addEventListener('storage', onStorageTheme);
}
