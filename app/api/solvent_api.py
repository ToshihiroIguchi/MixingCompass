"""
Unified Solvent API endpoints
Centralized solvent data access for all frontend components
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import time
import logging

from app.services.solvent_service import solvent_service
from app.models.solvent_models import SolventData

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/solvents")
async def get_solvents(
    full_data: bool = Query(False, description="Return full solvent data (true) or names only (false)")
):
    """
    Unified solvent endpoint

    - full_data=false: Returns names only (lightweight, for autocomplete)
    - full_data=true: Returns complete solvent data (for bulk caching)
    """
    start_time = time.time()

    try:
        if full_data:
            # Return full solvent data
            t1 = time.time()
            if not solvent_service._ensure_data_loaded():
                raise HTTPException(status_code=500, detail="Failed to load solvent database")
            load_time = (time.time() - t1) * 1000
            logger.info(f"[Solvent API] Data load check: {load_time:.2f}ms")
            print(f"[Solvent API] Data load check: {load_time:.2f}ms", flush=True)

            # Get all solvents from indexed data (deduplicated)
            t2 = time.time()
            seen_names = set()
            solvents = []
            for solvent_data in solvent_service._indexed_data.values():
                # Avoid duplicates (some solvents may be indexed by both name and CAS)
                if solvent_data.solvent not in seen_names:
                    seen_names.add(solvent_data.solvent)
                    solvents.append(solvent_data)
            dedup_time = (time.time() - t2) * 1000
            logger.info(f"[Solvent API] Deduplication: {dedup_time:.2f}ms ({len(solvents)} solvents)")
            print(f"[Solvent API] Deduplication: {dedup_time:.2f}ms ({len(solvents)} solvents)", flush=True)

            # Convert to dict
            t3 = time.time()
            solvents_dict = [
                {
                    'name': s.solvent,
                    'delta_d': s.delta_d,
                    'delta_p': s.delta_p,
                    'delta_h': s.delta_h,
                    'source_url': s.source_url,
                    'cas': s.cas,
                    'boiling_point': s.boiling_point,
                    'density': s.density,
                    'molecular_weight': s.molecular_weight,
                    'cost': s.cost_per_ml,
                    'cho': None,  # Not in SolventData model
                    'wgk': s.wgk_class,
                    'ghs': s.ghs_classification
                }
                for s in solvents
            ]
            dict_convert_time = (time.time() - t3) * 1000
            logger.info(f"[Solvent API] Dict conversion: {dict_convert_time:.2f}ms")
            print(f"[Solvent API] Dict conversion: {dict_convert_time:.2f}ms", flush=True)

            execution_time = (time.time() - start_time) * 1000
            logger.info(f"[Solvent API] TOTAL: {execution_time:.2f}ms ({len(solvents_dict)} solvents)")
            print(f"[Solvent API] TOTAL: {execution_time:.2f}ms ({len(solvents_dict)} solvents)", flush=True)

            return {
                'solvents': solvents_dict,
                'count': len(solvents_dict),
                'format': 'full',
                'execution_time_ms': round(execution_time, 2)
            }
        else:
            # Return names only
            names = solvent_service.get_all_solvent_names()
            execution_time = (time.time() - start_time) * 1000

            return {
                'solvents': names,
                'count': len(names),
                'format': 'names_only',
                'execution_time_ms': round(execution_time, 2)
            }

    except Exception as e:
        logger.error(f"Error in get_solvents: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/solvents/{solvent_name}", response_model=SolventData)
async def get_solvent_by_name(solvent_name: str):
    """
    Get individual solvent by name

    This endpoint provides backward compatibility with existing code
    and serves as a fallback for on-demand lookups
    """
    try:
        solvent = solvent_service.get_solvent_by_name(solvent_name)

        if not solvent:
            raise HTTPException(
                status_code=404,
                detail=f"Solvent '{solvent_name}' not found in database"
            )

        return solvent

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_solvent_by_name: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/solvents-stats")
async def get_solvent_statistics():
    """
    Get statistical information about the solvent database
    """
    try:
        return {
            "data_info": solvent_service.get_data_info(),
            "hsp_stats": solvent_service.get_hsp_range_stats()
        }

    except Exception as e:
        logger.error(f"Error in get_solvent_statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
