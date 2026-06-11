import type { Deck, ReviewCard, Settings } from "./types";

type ApiOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, "");
}

export function hasApiSettings(settings: Settings): boolean {
  return Boolean(normalizeApiUrl(settings.apiUrl));
}

export function apiUrl(settings: Settings, path: string): string {
  return `${normalizeApiUrl(settings.apiUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch<T>(
  settings: Settings,
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (settings.token.trim()) {
    headers.Authorization = `Bearer ${settings.token.trim()}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(apiUrl(settings, path), {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        message = Array.isArray(payload.detail) ? payload.detail[0]?.msg || message : payload.detail;
      }
    } catch {
      // Keep the status text.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getHealth(settings: Settings): Promise<{ ok: boolean; collection_loaded: boolean }> {
  return apiFetch(settings, "/health");
}

export function getDecks(settings: Settings): Promise<Deck[]> {
  return apiFetch(settings, "/decks");
}

export function pullSync(settings: Settings): Promise<{ collection: string; copied_from: string }> {
  return apiFetch(settings, "/sync/pull", { method: "POST" });
}

export function pushSync(settings: Settings): Promise<{ collection: string; copied_to: string; backup: string }> {
  return apiFetch(settings, "/sync/push", { method: "POST" });
}

export function getNextCard(settings: Settings, deckId?: number): Promise<ReviewCard | null> {
  const path = deckId ? `/review/next?deck_id=${encodeURIComponent(deckId)}` : "/review/next";
  return apiFetch(settings, path);
}

export function answerCard(settings: Settings, cardId: number, ease: number): Promise<void> {
  return apiFetch(settings, `/review/${cardId}/answer`, {
    method: "POST",
    body: { ease },
  });
}

export async function fetchMediaBlobUrl(
  settings: Settings,
  filename: string,
  signal?: AbortSignal,
): Promise<string> {
  const headers: HeadersInit = {};
  if (settings.token.trim()) {
    headers.Authorization = `Bearer ${settings.token.trim()}`;
  }
  const response = await fetch(apiUrl(settings, `/media/${filename.replace(/^\/+/, "")}`), {
    headers,
    signal,
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Media ${filename} failed to load`);
  }
  return URL.createObjectURL(await response.blob());
}
