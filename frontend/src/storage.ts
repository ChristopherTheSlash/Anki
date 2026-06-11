import type { SessionStats, Settings } from "./types";

const SETTINGS_KEY = "anki-phone-pwa.settings";
const SELECTED_DECK_KEY = "anki-phone-pwa.selectedDeckId";

export const defaultSettings: Settings = {
  apiUrl: import.meta.env.VITE_DEFAULT_API_URL || "",
  token: "",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSelectedDeckId(): number | undefined {
  const raw = localStorage.getItem(SELECTED_DECK_KEY);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function saveSelectedDeckId(deckId: number | undefined): void {
  if (deckId === undefined) {
    localStorage.removeItem(SELECTED_DECK_KEY);
    return;
  }
  localStorage.setItem(SELECTED_DECK_KEY, String(deckId));
}

export function emptyStats(): SessionStats {
  return { answered: 0, again: 0, hard: 0, good: 0, easy: 0 };
}
