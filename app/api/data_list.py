"""
Data List API endpoints
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from app.services.solvent_service import solvent_service
from app.models.solvent_models import SolventData
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/test")
async def test_data_list():
    """Test endpoint for data list functionality"""
    return {"message": "Data List API is working", "status": "ok"}


@router.get("/solvents", response_model=dict)
async def get_all_solvents_list(
    search: Optional[str] = Query(None, description="Search query for solvent name, CAS, or SMILES"),
    limit: Optional[int] = Query(1000, ge=1, le=10000, description="Maximum number of results"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination")
):
    """
    Get all solvents from the database with optional search and pagination

    Args:
        search: Optional search query to filter by name, CAS, or SMILES
        limit: Maximum number of results to return (default 1000, max 10000)
        offset: Number of results to skip (default 0)

    Returns:
        Dictionary with:
        - solvents: List of solvent data
        - total: Total number of solvents matching the search
        - limit: Applied limit
        - offset: Applied offset
    """
    try:
        logger.info(f"Fetching solvents list - search: {search}, limit: {limit}, offset: {offset}")

        # Get all solvent names
        all_names = solvent_service.get_all_solvent_names()

        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            filtered_names = []
            for name in all_names:
                solvent_data = solvent_service.get_solvent_by_name(name)
                if solvent_data:
                    # Search in name, CAS, or SMILES
                    if (search_lower in name.lower() or
                        (solvent_data.cas and search_lower in solvent_data.cas.lower()) or
                        (solvent_data.smiles and search_lower in solvent_data.smiles.lower())):
                        filtered_names.append(name)
        else:
            filtered_names = all_names

        total = len(filtered_names)

        # Apply pagination
        paginated_names = filtered_names[offset:offset + limit]

        # Get full data for paginated results
        solvents = []
        for name in paginated_names:
            solvent_data = solvent_service.get_solvent_by_name(name)
            if solvent_data:
                solvents.append({
                    "solvent": solvent_data.solvent,
                    "delta_d": solvent_data.delta_d,
                    "delta_p": solvent_data.delta_p,
                    "delta_h": solvent_data.delta_h,
                    "cas": solvent_data.cas,
                    "smiles": solvent_data.smiles,
                    "boiling_point": solvent_data.boiling_point,
                    "source_file": solvent_data.source_file,
                    "source_url": solvent_data.source_url
                })

        return {
            "solvents": solvents,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Error fetching solvents list: {e}")
        return {
            "solvents": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
            "error": str(e)
        }


# Note: User-added solvent endpoints have been removed.
# User solvents are now managed entirely in frontend localStorage.
# See static/js/user_solvents.js for the client-side implementation.