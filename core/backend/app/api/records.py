from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_user
from app.models.auth import User
from app.schemas.content import RecordCreate, RecordResponse, RecordTypeCreate, RecordTypeResponse, RecordTypeUpdate, RecordUpdate
from app.services.content import (
    ContentError,
    create_record,
    create_record_type,
    delete_record,
    delete_record_type,
    get_owned_record,
    list_records,
    list_record_types,
    list_target_tags,
    update_record,
    update_record_type,
)

router = APIRouter(tags=["records"])


@router.get("/record-types", response_model=list[RecordTypeResponse])
def get_record_types(
    include_disabled: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[RecordTypeResponse]:
    return [RecordTypeResponse.from_model(item) for item in list_record_types(db, current_user, include_disabled)]


@router.post("/record-types", response_model=RecordTypeResponse, status_code=status.HTTP_201_CREATED)
def post_record_type(
    payload: RecordTypeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RecordTypeResponse:
    try:
        return RecordTypeResponse.from_model(create_record_type(db, current_user, payload))
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/record-types/{record_type_id}", response_model=RecordTypeResponse)
def patch_record_type(
    record_type_id: int,
    payload: RecordTypeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RecordTypeResponse:
    try:
        return RecordTypeResponse.from_model(update_record_type(db, current_user, record_type_id, payload))
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/record-types/{record_type_id}", response_model=dict[str, bool])
def remove_record_type(
    record_type_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict[str, bool]:
    try:
        delete_record_type(db, current_user, record_type_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/records", response_model=list[RecordResponse])
def get_records(
    date_value: date | None = Query(default=None, alias="date"),
    start_date: date | None = None,
    end_date: date | None = None,
    record_type_id: int | None = None,
    tag_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[RecordResponse]:
    items = list_records(
        db,
        current_user,
        date_value=date_value,
        start_date=start_date,
        end_date=end_date,
        record_type_id=record_type_id,
        tag_id=tag_id,
    )
    return [RecordResponse.from_model(item, list_target_tags(db, current_user, "record", item.id)) for item in items]


@router.post("/records", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
def post_record(payload: RecordCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> RecordResponse:
    try:
        item = create_record(db, current_user, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RecordResponse.from_model(item, list_target_tags(db, current_user, "record", item.id))


@router.get("/records/{record_id}", response_model=RecordResponse)
def get_record(record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> RecordResponse:
    try:
        item = get_owned_record(db, current_user, record_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return RecordResponse.from_model(item, list_target_tags(db, current_user, "record", item.id))


@router.patch("/records/{record_id}", response_model=RecordResponse)
def patch_record(
    record_id: int,
    payload: RecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RecordResponse:
    try:
        item = update_record(db, current_user, record_id, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RecordResponse.from_model(item, list_target_tags(db, current_user, "record", item.id))


@router.delete("/records/{record_id}", response_model=dict[str, bool])
def remove_record(record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> dict[str, bool]:
    try:
        delete_record(db, current_user, record_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}
