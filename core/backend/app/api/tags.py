from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_user
from app.models.auth import User
from app.schemas.content import TagCreate, TagLinkRequest, TagResponse, TagUpdate
from app.services.content import ContentError, create_tag, create_tag_link, delete_tag, delete_tag_link, list_tags, update_tag

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
def get_tags(
    include_archived: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[TagResponse]:
    return [TagResponse.model_validate(tag) for tag in list_tags(db, current_user, include_archived)]


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def post_tag(payload: TagCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> TagResponse:
    try:
        return TagResponse.model_validate(create_tag(db, current_user, payload))
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{tag_id}", response_model=TagResponse)
def patch_tag(tag_id: int, payload: TagUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> TagResponse:
    try:
        return TagResponse.model_validate(update_tag(db, current_user, tag_id, payload))
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{tag_id}", response_model=dict[str, bool])
def remove_tag(tag_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> dict[str, bool]:
    try:
        delete_tag(db, current_user, tag_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/{tag_id}/links", response_model=dict[str, int], status_code=status.HTTP_201_CREATED)
def post_tag_link(
    tag_id: int,
    payload: TagLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict[str, int]:
    try:
        link = create_tag_link(db, current_user, tag_id, payload.target_type, payload.target_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"id": link.id}


@router.delete("/{tag_id}/links/{link_id}", response_model=dict[str, bool])
def remove_tag_link(
    tag_id: int,
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict[str, bool]:
    _ = tag_id
    try:
        delete_tag_link(db, current_user, link_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}
