from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_user
from app.models.auth import User
from app.schemas.content import JournalCreate, JournalResponse, JournalUpdate, JournalVersionResponse
from app.services.content import (
    ContentError,
    create_journal,
    delete_journal,
    get_journal_version,
    get_owned_journal,
    list_journal_versions,
    list_journals,
    list_target_tags,
    update_journal,
)

router = APIRouter(prefix="/journals", tags=["journals"])


@router.get("", response_model=list[JournalResponse])
def get_journals(
    date_value: date | None = Query(default=None, alias="date"),
    start_date: date | None = None,
    end_date: date | None = None,
    tag_id: int | None = None,
    keyword: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[JournalResponse]:
    items = list_journals(db, current_user, date_value=date_value, start_date=start_date, end_date=end_date, tag_id=tag_id, keyword=keyword)
    return [JournalResponse.from_model(item, list_target_tags(db, current_user, "journal_entry", item.id)) for item in items]


@router.post("", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
def post_journal(payload: JournalCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> JournalResponse:
    try:
        item = create_journal(db, current_user, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return JournalResponse.from_model(item, list_target_tags(db, current_user, "journal_entry", item.id))


@router.get("/{journal_id}", response_model=JournalResponse)
def get_journal(journal_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> JournalResponse:
    try:
        item = get_owned_journal(db, current_user, journal_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return JournalResponse.from_model(item, list_target_tags(db, current_user, "journal_entry", item.id))


@router.patch("/{journal_id}", response_model=JournalResponse)
def patch_journal(
    journal_id: int,
    payload: JournalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> JournalResponse:
    try:
        item = update_journal(db, current_user, journal_id, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return JournalResponse.from_model(item, list_target_tags(db, current_user, "journal_entry", item.id))


@router.delete("/{journal_id}", response_model=dict[str, bool])
def remove_journal(journal_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> dict[str, bool]:
    try:
        delete_journal(db, current_user, journal_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/{journal_id}/versions", response_model=list[JournalVersionResponse])
def get_versions(journal_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> list[JournalVersionResponse]:
    try:
        versions = list_journal_versions(db, current_user, journal_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [JournalVersionResponse.from_model(version) for version in versions]


@router.get("/{journal_id}/versions/{version_id}", response_model=JournalVersionResponse)
def get_version(
    journal_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> JournalVersionResponse:
    try:
        version = get_journal_version(db, current_user, journal_id, version_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return JournalVersionResponse.from_model(version)
