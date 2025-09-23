"""
HSP Calculation API endpoints
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/test")
async def test_calculation():
    """Test endpoint for HSP calculation functionality"""
    return {"message": "HSP Calculation API is working", "status": "ok"}