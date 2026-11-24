"""Remedy Explorer - browse the Ayurveda dataset (no AI needed)."""

from fastapi import APIRouter, HTTPException, Path, Query

from services import ayurveda_knowledge as kb

router = APIRouter(prefix="/api/conditions", tags=["Remedy Explorer"])


@router.get("")
def list_conditions(search: str = Query("", max_length=100),
                    limit: int = Query(60, ge=1, le=200)):
    """GET /api/conditions?search=cough  -> short cards"""
    return kb.list_conditions(search, limit)


@router.get("/{name}")
def condition_details(name: str = Path(..., min_length=1, max_length=120)):
    """GET /api/conditions/Diabetes  -> full Ayurvedic profile"""
    profile = kb.get_profile(name)
    if not profile:
        raise HTTPException(status_code=404, detail="Condition not found")
    return profile
