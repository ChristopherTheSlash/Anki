from __future__ import annotations

import os
import shutil
import subprocess
import time
from collections import defaultdict, deque
from datetime import datetime
from importlib.metadata import version
from pathlib import Path
from threading import RLock
from typing import Annotated

from anki.collection import Collection
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
import logging


PROJECT_DIR = Path(os.environ.get("ANKI_PROJECT_DIR", Path(__file__).resolve().parents[1]))
DEFAULT_PROFILE = Path.home() / "Library/Application Support/Anki2/User 1"
logger = logging.getLogger("anki_private_api")
logging.basicConfig(
    level=os.environ.get("ANKI_API_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


class Settings(BaseModel):
    collection_source: Path = Path(
        os.environ.get("ANKI_API_COLLECTION", DEFAULT_PROFILE / "collection.anki2")
    )
    media_source: Path = Path(
        os.environ.get("ANKI_API_MEDIA", DEFAULT_PROFILE / "collection.media")
    )
    workdir: Path = Path(os.environ.get("ANKI_API_WORKDIR", PROJECT_DIR / "data/api"))
    token: str = os.environ.get("ANKI_API_TOKEN", "")
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.environ.get("ANKI_API_CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]
    rate_limit_per_minute: int = int(os.environ.get("ANKI_API_RATE_LIMIT_PER_MINUTE", "120"))

    @property
    def working_collection(self) -> Path:
        return self.workdir / "collection.anki2"


settings = Settings()


class DeckOut(BaseModel):
    id: int
    name: str
    card_count: int


class ReviewCardOut(BaseModel):
    card_id: int
    note_id: int
    deck_id: int
    question_html: str
    answer_html: str
    buttons: list[int]


class AnswerIn(BaseModel):
    ease: int = Field(ge=1, le=4)


class SyncOut(BaseModel):
    collection: str
    copied_from: str


class PushOut(BaseModel):
    collection: str
    copied_to: str
    backup: str


class CollectionStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._collection: Collection | None = None

    def pull(self) -> SyncOut:
        with self._lock:
            self.close()
            if not settings.collection_source.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Collection source does not exist: {settings.collection_source}",
                )
            settings.workdir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(settings.collection_source, settings.working_collection)
            return SyncOut(
                collection=str(settings.working_collection),
                copied_from=str(settings.collection_source),
            )

    def push(self) -> PushOut:
        with self._lock:
            self.close()
            if not settings.working_collection.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Working collection does not exist: {settings.working_collection}",
                )
            if not settings.collection_source.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Collection source does not exist: {settings.collection_source}",
                )
            if path_is_open(settings.collection_source):
                raise HTTPException(
                    status_code=409,
                    detail="Close Anki Desktop before pushing phone review progress.",
                )

            backup_dir = settings.workdir.parent / "backups"
            backup_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup = backup_dir / f"desktop-collection-before-api-push-{stamp}.anki2"
            shutil.copy2(settings.collection_source, backup)
            shutil.copy2(settings.working_collection, settings.collection_source)
            return PushOut(
                collection=str(settings.working_collection),
                copied_to=str(settings.collection_source),
                backup=str(backup),
            )

    def collection(self) -> Collection:
        with self._lock:
            if self._collection is None:
                if not settings.working_collection.exists():
                    self.pull()
                self._collection = Collection(str(settings.working_collection))
            return self._collection

    def close(self) -> None:
        if self._collection is not None:
            self._collection.close()
            self._collection = None


store = CollectionStore()
app = FastAPI(title="Private Anki Review API", version="0.1.0")
rate_limit_buckets: defaultdict[str, deque[float]] = defaultdict(deque)
rate_limit_lock = RLock()

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )


def rate_limit_key(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    client = request.client.host if request.client else "unknown"
    return f"{client}:{authorization}"


def path_is_open(path: Path) -> bool:
    if shutil.which("lsof") is None:
        return False
    result = subprocess.run(
        ["lsof", str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


@app.middleware("http")
async def rate_limit_and_log(request: Request, call_next):
    started = time.monotonic()
    if settings.rate_limit_per_minute > 0:
        now = time.monotonic()
        key = rate_limit_key(request)
        with rate_limit_lock:
            bucket = rate_limit_buckets[key]
            while bucket and now - bucket[0] > 60:
                bucket.popleft()
            if len(bucket) >= settings.rate_limit_per_minute:
                logger.warning(
                    "request_rate_limited method=%s path=%s client=%s",
                    request.method,
                    request.url.path,
                    request.client.host if request.client else "unknown",
                )
                return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
            bucket.append(now)

    response = await call_next(request)
    duration_ms = round((time.monotonic() - started) * 1000, 2)
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    if not settings.token:
        return
    expected = f"Bearer {settings.token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid API token")


Auth = Annotated[None, Depends(require_token)]


@app.on_event("shutdown")
def shutdown() -> None:
    store.close()


@app.get("/health")
def health() -> dict[str, str | bool | int]:
    return {
        "ok": True,
        "collection_loaded": store._collection is not None,
        "collection_source_exists": settings.collection_source.exists(),
        "working_collection_exists": settings.working_collection.exists(),
        "media_source_exists": settings.media_source.exists(),
        "working_collection": str(settings.working_collection),
        "anki_package_version": version("anki"),
        "rate_limit_per_minute": settings.rate_limit_per_minute,
    }


@app.post("/sync/pull", response_model=SyncOut)
def sync_pull(_: Auth) -> SyncOut:
    return store.pull()


@app.post("/sync/push", response_model=PushOut)
def sync_push(_: Auth) -> PushOut:
    return store.push()


@app.get("/decks", response_model=list[DeckOut])
def decks(_: Auth) -> list[DeckOut]:
    col = store.collection()
    output: list[DeckOut] = []
    for deck in col.decks.all_names_and_ids():
        deck_id = int(deck.id)
        card_count = len(col.find_cards(f'deck:"{deck.name}"'))
        output.append(DeckOut(id=deck_id, name=deck.name, card_count=card_count))
    return output


@app.get("/review/next", response_model=ReviewCardOut | None)
def review_next(_: Auth, deck_id: int | None = Query(default=None)) -> ReviewCardOut | None:
    col = store.collection()
    if deck_id is not None:
        col.decks.select(deck_id)
    card = col.sched.getCard()
    if card is None:
        return None
    card.start_timer()
    buttons = list(range(1, col.sched.answerButtons(card) + 1))
    return ReviewCardOut(
        card_id=int(card.id),
        note_id=int(card.nid),
        deck_id=int(card.did),
        question_html=card.question(),
        answer_html=card.answer(),
        buttons=buttons,
    )


@app.post("/review/{card_id}/answer")
def answer_card(card_id: int, payload: AnswerIn, _: Auth) -> dict[str, int | str]:
    col = store.collection()
    card = col.get_card(card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.timer_started is None:
        card.start_timer()
    col.sched.answerCard(card, payload.ease)
    col.save()
    return {"card_id": card_id, "ease": payload.ease, "status": "answered"}


@app.get("/media/{filename:path}")
def media(filename: str, _: Auth) -> FileResponse:
    if filename.startswith("/") or ".." in Path(filename).parts:
        raise HTTPException(status_code=400, detail="Invalid media path")
    path = settings.media_source / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Media not found")
    return FileResponse(path)
