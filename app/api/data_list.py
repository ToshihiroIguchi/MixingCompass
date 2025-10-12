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


@router.get("/user-solvents", response_model=List[SolventData])
async def get_user_added_solvents():
    """
    Get all user-added solvents

    Returns:
        List of user-added solvent data
    """
    try:
        logger.info("Fetching user-added solvents")
        solvents = solvent_service.get_user_added_solvents()
        logger.info(f"Found {len(solvents)} user-added solvents")
        return solvents

    except Exception as e:
        logger.error(f"Error fetching user-added solvents: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching user-added solvents: {str(e)}")


@router.put("/user-solvents/{solvent_name}", response_model=dict)
async def update_user_solvent(solvent_name: str, solvent_data: SolventData):
    """
    Update a user-added solvent

    Args:
        solvent_name: Original solvent name
        solvent_data: Updated solvent data

    Returns:
        Success message
    """
    try:
        logger.info(f"Updating user solvent: {solvent_name}")

        # Validate required fields
        if not solvent_data.solvent or not solvent_data.solvent.strip():
            raise HTTPException(status_code=400, detail="Solvent name is required")

        if solvent_data.delta_d is None or solvent_data.delta_p is None or solvent_data.delta_h is None:
            raise HTTPException(status_code=400, detail="HSP values (δD, δP, δH) are required")

        # Update solvent
        success = solvent_service.update_solvent(solvent_name, solvent_data)
        if not success:
            raise HTTPException(status_code=404, detail=f"Solvent '{solvent_name}' not found or cannot be updated")

        return {
            "success": True,
            "message": f"Solvent '{solvent_name}' updated successfully",
            "solvent_name": solvent_data.solvent
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user solvent: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating solvent: {str(e)}")


@router.delete("/user-solvents/{solvent_name}", response_model=dict)
async def delete_user_solvent(solvent_name: str):
    """
    Delete a user-added solvent

    Args:
        solvent_name: Name of the solvent to delete

    Returns:
        Success message
    """
    try:
        logger.info(f"Deleting user solvent: {solvent_name}")

        # Delete solvent
        success = solvent_service.delete_solvent(solvent_name)
        if not success:
            raise HTTPException(status_code=404, detail=f"Solvent '{solvent_name}' not found or cannot be deleted")

        return {
            "success": True,
            "message": f"Solvent '{solvent_name}' deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user solvent: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting solvent: {str(e)}")