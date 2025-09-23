"""
Data List API endpoints
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/test")
async def test_data_list():
    """Test endpoint for data list functionality"""
    return {"message": "Data List API is working", "status": "ok"}