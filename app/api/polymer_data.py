"""
Polymer Data API endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import List
from app.services.polymer_service import polymer_service, PolymerData
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/test")
async def test_polymer_data():
    """Test endpoint for polymer data functionality"""
    return {"message": "Polymer Data API is working", "status": "ok"}


@router.get("/polymer-names", response_model=List[str])
async def get_polymer_names():
    """
    Get list of all polymer names for autocomplete

    Returns:
        List of polymer names
    """
    try:
        logger.info("Fetching polymer names")

        # Get all polymers
        all_polymers = polymer_service.get_all_polymers()

        # Extract just the names
        names = [polymer.polymer for polymer in all_polymers]

        return names

    except Exception as e:
        logger.error(f"Error fetching polymer names: {e}")
        return []


@router.get("/polymers", response_model=dict)
async def get_all_polymers():
    """
    Get all polymers from the database

    Returns:
        Dictionary with:
        - polymers: List of polymer data
        - total: Total number of polymers
    """
    try:
        logger.info("Fetching polymers list")

        # Get all polymers
        all_polymers = polymer_service.get_all_polymers()

        # Convert to dict format
        polymers = []
        for polymer in all_polymers:
            polymers.append({
                "polymer": polymer.polymer,
                "delta_d": polymer.delta_d,
                "delta_p": polymer.delta_p,
                "delta_h": polymer.delta_h,
                "ra": polymer.ra,
                "cas": polymer.cas,
                "source_file": polymer.source_file,
                "source_url": polymer.source_url
            })

        return {
            "polymers": polymers,
            "total": len(polymers)
        }

    except Exception as e:
        logger.error(f"Error fetching polymers list: {e}")
        return {
            "polymers": [],
            "total": 0,
            "error": str(e)
        }


@router.get("/polymer/{polymer_name}", response_model=dict)
async def get_polymer_by_name(polymer_name: str):
    """
    Get a specific polymer by name

    Args:
        polymer_name: Name of the polymer

    Returns:
        Polymer data
    """
    try:
        logger.info(f"Fetching polymer: {polymer_name}")

        polymer = polymer_service.get_polymer_by_name(polymer_name)

        if not polymer:
            raise HTTPException(status_code=404, detail=f"Polymer '{polymer_name}' not found")

        return {
            "polymer": polymer.polymer,
            "delta_d": polymer.delta_d,
            "delta_p": polymer.delta_p,
            "delta_h": polymer.delta_h,
            "ra": polymer.ra,
            "cas": polymer.cas,
            "source_file": polymer.source_file,
            "source_url": polymer.source_url
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching polymer: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching polymer: {str(e)}")
