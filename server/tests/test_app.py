from pathlib import Path

import pytest
from anki.collection import Collection
from fastapi.testclient import TestClient

import server.app as api


def create_collection(path: Path) -> int:
    col = Collection(str(path))
    deck_id = col.decks.id("Test Deck")
    notetype = col.models.by_name("Basic")
    note = col.new_note(notetype)
    note.fields[0] = "Front"
    note.fields[1] = "Back"
    col.add_note(note, deck_id)
    col.close()
    return int(deck_id)


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    source = tmp_path / "source.anki2"
    media = tmp_path / "media"
    media.mkdir()
    create_collection(source)

    api.store.close()
    api.rate_limit_buckets.clear()
    monkeypatch.setattr(api.settings, "collection_source", source)
    monkeypatch.setattr(api.settings, "media_source", media)
    monkeypatch.setattr(api.settings, "workdir", tmp_path / "work")
    monkeypatch.setattr(api.settings, "token", "test-token")
    monkeypatch.setattr(api.settings, "rate_limit_per_minute", 120)

    with TestClient(api.app) as test_client:
        yield test_client

    api.store.close()
    api.rate_limit_buckets.clear()


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def test_token_is_required(client: TestClient) -> None:
    response = client.get("/decks")

    assert response.status_code == 401


def test_review_answer_updates_scheduler_state(client: TestClient) -> None:
    assert client.post("/sync/pull", headers=auth_headers()).status_code == 200

    decks = client.get("/decks", headers=auth_headers()).json()
    test_deck = next(deck for deck in decks if deck["name"] == "Test Deck")
    assert test_deck["card_count"] == 1

    card = client.get(
        f"/review/next?deck_id={test_deck['id']}",
        headers=auth_headers(),
    ).json()
    assert card["question_html"]
    assert card["answer_html"]
    assert card["buttons"] == [1, 2, 3, 4]

    answer = client.post(
        f"/review/{card['card_id']}/answer",
        headers=auth_headers(),
        json={"ease": 3},
    )
    assert answer.status_code == 200

    api.store.close()
    col = Collection(str(api.settings.working_collection))
    reviewed = col.get_card(card["card_id"])
    col.close()
    assert reviewed.reps == 1
    assert reviewed.queue == 3
    assert reviewed.type == 1


def test_sync_push_copies_reviewed_state_to_source(client: TestClient) -> None:
    assert client.post("/sync/pull", headers=auth_headers()).status_code == 200

    deck = next(deck for deck in client.get("/decks", headers=auth_headers()).json() if deck["name"] == "Test Deck")
    card = client.get(f"/review/next?deck_id={deck['id']}", headers=auth_headers()).json()
    assert client.post(
        f"/review/{card['card_id']}/answer",
        headers=auth_headers(),
        json={"ease": 3},
    ).status_code == 200

    response = client.post("/sync/push", headers=auth_headers())
    assert response.status_code == 200
    payload = response.json()
    assert Path(payload["backup"]).exists()

    col = Collection(str(api.settings.collection_source))
    reviewed = col.get_card(card["card_id"])
    col.close()
    assert reviewed.reps == 1
    assert reviewed.queue == 3
    assert reviewed.type == 1


def test_rate_limit_returns_429(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(api.settings, "rate_limit_per_minute", 1)

    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 429
