"""
Solvent Search API endpoints
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/test")
async def test_solvent_search():
    """Test endpoint for solvent search functionality"""
    return {"message": "Solvent Search API is working", "status": "ok"}