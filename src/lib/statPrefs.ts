// Lets someone hide stat cards they don't want (e.g. "Show-up rate") and bring
// them back later, per page. Stored as a hidden-keys deny-list rather than a
// shown-keys allow-list so that if a new stat is added to a page's catalog in
// the future, it shows up by default for everyone instead of staying invisible
// until they happen to reopen the customize panel.
const STORAGE_KEY = 'agave-dashboard:statPrefs:v1';

export type StatPage = 'account' | 'investor';

interface StatPrefs {
  hidden: Partial<Record<StatPage, string[]>>;
}

function loadPrefs(): StatPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hidden: {} };
    const parsed = JSON.parse(raw) as Partial<StatPrefs> | null;
    return { hidden: parsed?.hidden ?? {} };
  } catch {
    return { hidden: {} };
  }
}

function savePrefs(prefs: StatPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable (private browsing) — preference just won't persist.
  }
}

export function getHiddenKeys(page: StatPage): string[] {
  return loadPrefs().hidden[page] ?? [];
}

export function setHiddenKeys(page: StatPage, keys: string[]): void {
  const prefs = loadPrefs();
  prefs.hidden[page] = keys;
  savePrefs(prefs);
}
