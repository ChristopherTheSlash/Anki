import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Eye,
  Loader2,
  RefreshCcw,
  Save,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  answerCard,
  getDecks,
  getHealth,
  getNextCard,
  hasApiSettings,
  pullSync,
  pushSync,
} from "./api";
import { renderCardHtml } from "./cardHtml";
import { emptyStats, loadSelectedDeckId, loadSettings, saveSelectedDeckId, saveSettings } from "./storage";
import type { Deck, ReviewCard, SessionStats, Settings } from "./types";
import "./styles.css";

type View = "review" | "settings";

const answerNames: Record<number, keyof SessionStats> = {
  1: "again",
  2: "hard",
  3: "good",
  4: "easy",
};

function pickDeckId(decks: Deck[], preferredDeckId?: number): number | undefined {
  if (preferredDeckId !== undefined && decks.some((deck) => deck.id === preferredDeckId)) {
    return preferredDeckId;
  }
  return decks[0]?.id;
}

function syncTimestamp(label: string): string {
  return `${label} ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
  }
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function CardFace({ html }: { html: string }) {
  return <div className="card-html" dangerouslySetInnerHTML={{ __html: html }} />;
}

function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [draftSettings, setDraftSettings] = useState<Settings>(() => loadSettings());
  const [view, setView] = useState<View>(() => (hasApiSettings(loadSettings()) ? "review" : "settings"));
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | undefined>(() => loadSelectedDeckId());
  const [card, setCard] = useState<ReviewCard | null>(null);
  const [questionHtml, setQuestionHtml] = useState("");
  const [answerHtml, setAnswerHtml] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [healthOk, setHealthOk] = useState(false);
  const [stats, setStats] = useState<SessionStats>(() => emptyStats());
  const [syncStatus, setSyncStatus] = useState("");
  const online = useOnlineStatus();

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId),
    [decks, selectedDeckId],
  );

  const clearError = () => setError("");

  const applyDecks = useCallback((nextDecks: Deck[], preferredDeckId?: number) => {
    const nextSelectedDeckId = pickDeckId(nextDecks, preferredDeckId);
    setDecks(nextDecks);
    setSelectedDeckId(nextSelectedDeckId);
    saveSelectedDeckId(nextSelectedDeckId);
    return nextSelectedDeckId;
  }, []);

  const loadDecks = useCallback(async (preferredDeckId = selectedDeckId) => {
    if (!hasApiSettings(settings)) {
      return { decks: [] as Deck[], selectedDeckId: undefined };
    }
    const nextDecks = await getDecks(settings);
    const nextSelectedDeckId = applyDecks(nextDecks, preferredDeckId);
    return { decks: nextDecks, selectedDeckId: nextSelectedDeckId };
  }, [applyDecks, selectedDeckId, settings]);

  const loadNext = useCallback(
    async (deckId = selectedDeckId) => {
      if (!hasApiSettings(settings)) {
        return;
      }
      setBusy(true);
      clearError();
      try {
        const nextCard = await getNextCard(settings, deckId);
        setCard(nextCard);
        setShowAnswer(false);
        setQuestionHtml("");
        setAnswerHtml("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the next card.");
      } finally {
        setBusy(false);
      }
    },
    [selectedDeckId, settings],
  );

  useEffect(() => {
    if (!hasApiSettings(settings)) {
      return;
    }
    let cancelled = false;
    const preferredDeckId = loadSelectedDeckId();
    setBusy(true);
    clearError();
    async function initializeReview() {
      try {
        const [health, nextDecks] = await Promise.all([getHealth(settings), getDecks(settings)]);
        if (cancelled) {
          return;
        }
        setHealthOk(Boolean(health.ok));
        const nextSelectedDeckId = applyDecks(nextDecks, preferredDeckId);
        if (nextSelectedDeckId !== undefined) {
          const nextCard = await getNextCard(settings, nextSelectedDeckId);
          if (!cancelled) {
            setCard(nextCard);
            setShowAnswer(false);
            setQuestionHtml("");
            setAnswerHtml("");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setHealthOk(false);
          setError(err instanceof Error ? err.message : "Could not reach the API.");
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }
    void initializeReview();
    return () => {
      cancelled = true;
    };
  }, [applyDecks, settings]);

  useEffect(() => {
    if (!card) {
      return;
    }
    const controller = new AbortController();
    void renderCardHtml(settings, card.question_html, controller.signal)
      .then(setQuestionHtml)
      .catch(() => setQuestionHtml(card.question_html));
    void renderCardHtml(settings, card.answer_html, controller.signal)
      .then(setAnswerHtml)
      .catch(() => setAnswerHtml(card.answer_html));
    return () => controller.abort();
  }, [card, settings]);

  const saveSettingsForm = (event: FormEvent) => {
    event.preventDefault();
    const normalized = {
      apiUrl: draftSettings.apiUrl.trim().replace(/\/+$/, ""),
      token: draftSettings.token.trim(),
    };
    saveSettings(normalized);
    setSettings(normalized);
    setView("review");
  };

  const handlePull = async () => {
    setBusy(true);
    clearError();
    try {
      await pullSync(settings);
      const refreshed = await loadDecks(selectedDeckId);
      setStats(emptyStats());
      await loadNext(refreshed.selectedDeckId);
      setSyncStatus(syncTimestamp("Pulled"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync pull failed.");
    } finally {
      setBusy(false);
    }
  };

  const handlePush = async () => {
    setBusy(true);
    clearError();
    try {
      await pushSync(settings);
      const refreshed = await loadDecks(selectedDeckId);
      await loadNext(refreshed.selectedDeckId);
      setSyncStatus(syncTimestamp("Pushed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync push failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (ease: number) => {
    if (!card) {
      return;
    }
    setBusy(true);
    clearError();
    try {
      await answerCard(settings, card.card_id, ease);
      const key = answerNames[ease];
      setStats((current) => ({
        ...current,
        answered: current.answered + 1,
        [key]: Number(current[key]) + 1,
      }));
      const refreshed = await loadDecks(selectedDeckId);
      await loadNext(refreshed.selectedDeckId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the answer.");
    } finally {
      setBusy(false);
    }
  };

  const chooseDeck = (deckId: number) => {
    setSelectedDeckId(deckId);
    saveSelectedDeckId(deckId);
    setCard(null);
    setStats(emptyStats());
    void loadNext(deckId);
  };

  const statusLabel = online ? (healthOk ? "Connected" : "API check needed") : "Offline";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Private review</p>
          <h1>Anki</h1>
        </div>
        <div className="topbar-actions">
          <span className={`status ${online && healthOk ? "good" : "warn"}`}>
            {online && healthOk ? <Cloud size={16} /> : <CloudOff size={16} />}
            {statusLabel}
          </span>
          <button className="icon-button" type="button" onClick={() => setView(view === "settings" ? "review" : "settings")} aria-label="Settings">
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {error && (
        <section className="banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </section>
      )}

      {view === "settings" ? (
        <section className="panel settings-panel">
          <div className="section-heading">
            <h2>Settings</h2>
            <p>Stored only in this browser.</p>
          </div>
          <form onSubmit={saveSettingsForm} className="settings-form">
            <label>
              API URL
              <input
                type="url"
                placeholder="https://your-mac.tailnet-name.ts.net"
                value={draftSettings.apiUrl}
                onChange={(event) => setDraftSettings((current) => ({ ...current, apiUrl: event.target.value }))}
                required
              />
            </label>
            <label>
              API token
              <input
                type="password"
                placeholder="Optional"
                value={draftSettings.token}
                onChange={(event) => setDraftSettings((current) => ({ ...current, token: event.target.value }))}
              />
            </label>
            <button className="primary-button" type="submit">
              <Save size={18} />
              Save
            </button>
          </form>
        </section>
      ) : (
        <div className="review-layout">
          <aside className="deck-rail" aria-label="Decks">
            <div className="section-heading compact">
              <h2>Decks</h2>
              <button className="icon-button" type="button" onClick={() => void loadDecks()} aria-label="Refresh decks" disabled={busy}>
                <RefreshCcw size={18} />
              </button>
            </div>
            <div className="deck-list">
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  className={`deck-row ${deck.id === selectedDeckId ? "selected" : ""}`}
                  type="button"
                  onClick={() => chooseDeck(deck.id)}
                >
                  <span className="deck-name">{deck.name}</span>
                  <span className="deck-counts">
                    <strong>{deck.due_count}</strong>
                    <small>
                      {deck.new_count} new / {deck.learn_count} learn / {deck.review_count} review
                    </small>
                  </span>
                </button>
              ))}
              {!decks.length && !busy && <p className="empty-copy">No decks loaded.</p>}
            </div>
          </aside>

          <section className="review-panel">
            <div className="review-toolbar">
              <div>
                <p className="eyebrow">{selectedDeck?.name || "Review queue"}</p>
                <h2>{card ? `Card ${card.card_id}` : "Ready"}</h2>
              </div>
              <div className="sync-cluster">
                <div className="sync-actions">
                  <button className="secondary-button" type="button" onClick={handlePull} disabled={busy || !hasApiSettings(settings)}>
                    {busy ? <Loader2 className="spin" size={18} /> : <RefreshCcw size={18} />}
                    Pull
                  </button>
                  <button className="secondary-button" type="button" onClick={handlePush} disabled={busy || !hasApiSettings(settings)}>
                    {busy ? <Loader2 className="spin" size={18} /> : <Cloud size={18} />}
                    Push
                  </button>
                </div>
                {syncStatus && <span className="sync-status">{syncStatus}</span>}
              </div>
            </div>

            <div className="stats-strip deck-stats" aria-label="Deck stats">
              <span><strong>{selectedDeck?.due_count ?? 0}</strong> due</span>
              <span><strong>{selectedDeck?.new_count ?? 0}</strong> new</span>
              <span><strong>{selectedDeck?.learn_count ?? 0}</strong> learn</span>
              <span><strong>{selectedDeck?.review_count ?? 0}</strong> review</span>
              <span><strong>{selectedDeck?.total_including_children ?? 0}</strong> total</span>
            </div>

            <div className="stats-strip session-stats" aria-label="Session stats">
              <span><strong>{stats.answered}</strong> done</span>
              <span><strong>{stats.again}</strong> again</span>
              <span><strong>{stats.hard}</strong> hard</span>
              <span><strong>{stats.good}</strong> good</span>
              <span><strong>{stats.easy}</strong> easy</span>
            </div>

            <article className="review-card">
              {busy && !card ? (
                <div className="center-state"><Loader2 className="spin" size={28} /> Loading</div>
              ) : card ? (
                <>
                  <CardFace html={questionHtml || card.question_html} />
                  {showAnswer ? (
                    <div className="answer-face">
                      <div className="divider" />
                      <CardFace html={answerHtml || card.answer_html} />
                    </div>
                  ) : (
                    <button className="show-answer-button" type="button" onClick={() => setShowAnswer(true)}>
                      <Eye size={18} />
                      Show answer
                    </button>
                  )}
                </>
              ) : (
                <div className="center-state">
                  <CheckCircle2 size={30} />
                  No card is due in this deck.
                </div>
              )}
            </article>

            <div className="answer-bar">
              {(card?.buttons.length ? card.buttons : [1, 2, 3, 4]).map((ease) => (
                <button
                  key={ease}
                  className={`answer-button ease-${ease}`}
                  type="button"
                  onClick={() => void submitAnswer(ease)}
                  disabled={!card || !showAnswer || busy}
                >
                  {answerNames[ease] || `Ease ${ease}`}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

registerServiceWorker();

createRoot(document.getElementById("root") || document.body).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
