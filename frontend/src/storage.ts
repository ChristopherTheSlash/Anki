import type { SessionStats, Settings } from "./types";

const SETTINGS_KEY = "anki-phone-pwa.settings";

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

export function emptyStats(): SessionStats {
  return { answered: 0, again: 0, hard: 0, good: 0, easy: 0 };
}
