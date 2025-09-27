"""
HSP Experimental API endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import time
import logging

logger = logging.getLogger(__name__)

from app.models.solvent_models import (
    SolventData,
    SolventSearchQuery,
    SolventSearchResponse
)
from app.models.hsp_models import (
    HSPExperimentData,
    HSPExperimentRequest,
    HSPExperimentListResponse,
    HSPCalculationRequest,
    HSPCalculationResult
)
from app.services.solvent_service import solvent_service
from app.services.data_manager import data_manager
from app.services.hsp_calculator import hsp_calculator
from app.services.visualization_service import HansenSphereVisualizationService

router = APIRouter()


@router.get("/solvents/search", response_model=SolventSearchResponse)
async def search_solvents(
    query: Optional[str] = Query(None, description="Search term"),
    delta_d_min: Optional[float] = Query(None, description="Minimum δD value", ge=0),
    delta_d_max: Optional[float] = Query(None, description="Maximum δD value", ge=0),
    delta_p_min: Optional[float] = Query(None, description="Minimum δP value", ge=0),
    delta_p_max: Optional[float] = Query(None, description="Maximum δP value", ge=0),
    delta_h_min: Optional[float] = Query(None, description="Minimum δH value", ge=0),
    delta_h_max: Optional[float] = Query(None, description="Maximum δH value", ge=0),
    has_smiles: Optional[bool] = Query(None, description="Filter by SMILES availability"),
    has_cas: Optional[bool] = Query(None, description="Filter by CAS availability"),
    limit: int = Query(50, description="Maximum results", ge=1, le=1000),
    offset: int = Query(0, description="Results offset", ge=0)
):
    """Search for solvents with various filters"""

    search_query = SolventSearchQuery(
        query=query,
        delta_d_min=delta_d_min,
        delta_d_max=delta_d_max,
        delta_p_min=delta_p_min,
        delta_p_max=delta_p_max,
        delta_h_min=delta_h_min,
        delta_h_max=delta_h_max,
        has_smiles=has_smiles,
        has_cas=has_cas,
        limit=limit,
        offset=offset
    )

    return solvent_service.search_solvents(search_query)


@router.get("/solvents/{solvent_name}", response_model=SolventData)
async def get_solvent_by_name(solvent_name: str):
    """Get solvent data by name"""

    solvent = solvent_service.get_solvent_by_name(solvent_name)
    if not solvent:
        raise HTTPException(status_code=404, detail=f"Solvent '{solvent_name}' not found")

    return solvent


@router.get("/solvents", response_model=List[str])
async def get_all_solvent_names():
    """Get list of all available solvent names"""

    return solvent_service.get_all_solvent_names()


@router.get("/solvents-info/stats")
async def get_solvent_stats():
    """Get statistical information about solvent database"""

    return {
        "data_info": solvent_service.get_data_info(),
        "hsp_stats": solvent_service.get_hsp_range_stats()
    }


@router.post("/experiments", response_model=dict)
async def create_experiment(experiment_request: HSPExperimentRequest):
    """Create new HSP experiment"""

    try:
        # Convert request to experiment data
        experiment_data = HSPExperimentData(
            sample_name=experiment_request.sample_name,
            description=experiment_request.description,
            solvent_tests=experiment_request.solvent_tests,
            experimenter=experiment_request.experimenter,
            notes=experiment_request.notes,
            tags=experiment_request.tags
        )

        # Save experiment
        experiment_id = data_manager.save_experiment(experiment_data)

        return {
            "id": experiment_id,
            "message": f"Experiment '{experiment_request.sample_name}' created successfully"
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error creating experiment: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error creating experiment: {str(e)}")


@router.get("/experiments", response_model=HSPExperimentListResponse)
async def list_experiments(
    limit: int = Query(50, description="Maximum results", ge=1, le=1000),
    offset: int = Query(0, description="Results offset", ge=0)
):
    """List all HSP experiments"""

    try:
        experiments_meta = data_manager.list_experiments(limit=limit, offset=offset)

        # Load full experiment data
        experiments = []
        for meta in experiments_meta:
            exp_data = data_manager.load_experiment(meta['id'])
            if exp_data:
                experiments.append(exp_data)

        # Get total count (simplified for now)
        total_count = len(data_manager.list_experiments(limit=1000))

        return HSPExperimentListResponse(
            experiments=experiments,
            total_count=total_count,
            page=offset // limit + 1,
            page_size=limit
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing experiments: {str(e)}")


@router.get("/experiments/{experiment_id}", response_model=HSPExperimentData)
async def get_experiment(experiment_id: str):
    """Get HSP experiment by ID"""

    experiment = data_manager.load_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

    return experiment


@router.put("/experiments/{experiment_id}", response_model=dict)
async def update_experiment(experiment_id: str, experiment_request: HSPExperimentRequest):
    """Update existing HSP experiment"""

    try:
        # Check if experiment exists
        existing = data_manager.load_experiment(experiment_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

        # Create updated experiment data
        updated_experiment = HSPExperimentData(
            sample_name=experiment_request.sample_name,
            description=experiment_request.description,
            solvent_tests=experiment_request.solvent_tests,
            experimenter=experiment_request.experimenter,
            notes=experiment_request.notes,
            tags=experiment_request.tags,
            created_at=existing.created_at  # Preserve original creation time
        )

        # Update experiment
        success = data_manager.update_experiment(experiment_id, updated_experiment)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update experiment")

        return {
            "id": experiment_id,
            "message": f"Experiment '{experiment_request.sample_name}' updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating experiment: {str(e)}")


@router.delete("/experiments/{experiment_id}", response_model=dict)
async def delete_experiment(experiment_id: str):
    """Delete HSP experiment"""

    try:
        # Check if experiment exists
        existing = data_manager.load_experiment(experiment_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

        # Delete experiment
        success = data_manager.delete_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete experiment")

        return {
            "id": experiment_id,
            "message": "Experiment deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting experiment: {str(e)}")


@router.get("/experiments/search/filter")
async def search_experiments(
    sample_name: Optional[str] = Query(None, description="Sample name filter"),
    experimenter: Optional[str] = Query(None, description="Experimenter filter"),
    has_results: Optional[bool] = Query(None, description="Filter by calculation results"),
    tags: Optional[str] = Query(None, description="Tags filter (comma-separated)")
):
    """Search experiments with filters"""

    try:
        tag_list = []
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',')]

        results = data_manager.search_experiments(
            sample_name=sample_name,
            experimenter=experimenter,
            has_results=has_results,
            tags=tag_list if tag_list else None
        )

        return {"experiments": results, "count": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching experiments: {str(e)}")


@router.post("/experiments/{experiment_id}/calculate", response_model=HSPCalculationResult)
async def calculate_hsp(experiment_id: str, calculation_request: Optional[HSPCalculationRequest] = None):
    """Calculate HSP values for an experiment"""

    try:
        # Load experiment
        experiment = data_manager.load_experiment(experiment_id)
        if not experiment:
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

        # Validate experiment data for HSP calculation
        validation = hsp_calculator.validate_test_data(experiment.solvent_tests)
        if not validation['valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid experiment data for HSP calculation: {'; '.join(validation['errors'])}"
            )

        # Perform HSP calculation
        result = hsp_calculator.calculate_hsp_from_tests(experiment.solvent_tests)
        if not result:
            raise HTTPException(
                status_code=500,
                detail="HSP calculation failed - insufficient or invalid data"
            )

        # Update experiment with calculated results
        experiment.calculated_hsp = result
        data_manager.update_experiment(experiment_id, experiment)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating HSP: {str(e)}")


@router.get("/experiments/{experiment_id}/export")
async def export_experiment(experiment_id: str, format: str = Query("json", description="Export format")):
    """Export experiment data"""

    try:
        export_data = data_manager.export_experiment(experiment_id, format)
        if not export_data:
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

        return export_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting experiment: {str(e)}")


@router.get("/data/stats")
async def get_data_stats():
    """Get data storage statistics"""

    return {
        "solvent_database": solvent_service.get_data_info(),
        "experiment_storage": data_manager.get_storage_stats()
    }


@router.get("/experiments/{experiment_id}/visualization")
async def get_hansen_sphere_visualization(
    experiment_id: str,
    width: int = Query(1000, description="Plot width", ge=400, le=1600),
    height: int = Query(700, description="Plot height", ge=300, le=1000)
):
    """Generate Hansen sphere 3D visualization for an experiment"""

    logger.info(f"🎯 Starting visualization generation for experiment: {experiment_id}")

    try:
        # Load experiment
        logger.debug(f"📂 Loading experiment data for: {experiment_id}")
        experiment = data_manager.load_experiment(experiment_id)
        if not experiment:
            logger.warning(f"❌ Experiment not found: {experiment_id}")
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

        logger.info(f"✅ Experiment loaded: {experiment.sample_name}")

        # Check if HSP has been calculated
        if not experiment.calculated_hsp:
            logger.warning(f"⚠️ HSP not calculated for experiment: {experiment_id}")
            raise HTTPException(
                status_code=400,
                detail="HSP has not been calculated for this experiment. Please calculate HSP first."
            )

        logger.info(f"📊 HSP values found: δD={experiment.calculated_hsp.delta_d:.2f}, δP={experiment.calculated_hsp.delta_p:.2f}, δH={experiment.calculated_hsp.delta_h:.2f}, R={experiment.calculated_hsp.radius:.2f}")

        # Prepare solvent data for visualization
        logger.debug(f"🧪 Processing {len(experiment.solvent_tests)} solvent tests")
        solvent_data = []
        for i, test in enumerate(experiment.solvent_tests):
            logger.debug(f"Processing test {i+1}: {test.solvent_name}, Solubility: {test.solubility}")

            # Get HSP values from manual input first, then solvent database
            delta_d = test.manual_delta_d
            delta_p = test.manual_delta_p
            delta_h = test.manual_delta_h

            # If no manual values, try to get from database
            if delta_d is None or delta_p is None or delta_h is None:
                try:
                    solvent_db_data = solvent_service.get_solvent_by_name(test.solvent_name)
                    if solvent_db_data:
                        delta_d = delta_d if delta_d is not None else solvent_db_data.delta_d
                        delta_p = delta_p if delta_p is not None else solvent_db_data.delta_p
                        delta_h = delta_h if delta_h is not None else solvent_db_data.delta_h
                        logger.debug(f"  🔍 Retrieved from database: δD={delta_d}, δP={delta_p}, δH={delta_h}")
                except Exception as e:
                    logger.warning(f"  ⚠️ Failed to retrieve solvent data for {test.solvent_name}: {e}")

            # If still no data from solvent_data attribute, try that too
            if (delta_d is None or delta_p is None or delta_h is None) and test.solvent_data:
                delta_d = delta_d if delta_d is not None else getattr(test.solvent_data, 'delta_d', None)
                delta_p = delta_p if delta_p is not None else getattr(test.solvent_data, 'delta_p', None)
                delta_h = delta_h if delta_h is not None else getattr(test.solvent_data, 'delta_h', None)

            logger.debug(f"  💧 HSP values: δD={delta_d}, δP={delta_p}, δH={delta_h}")
            logger.debug(f"  📝 Manual values: δD={test.manual_delta_d}, δP={test.manual_delta_p}, δH={test.manual_delta_h}")
            logger.debug(f"  🗃️ Solvent data present: {test.solvent_data is not None}")

            if test.solvent_name and delta_d is not None and delta_p is not None and delta_h is not None:
                solvent_entry = {
                    'solvent_name': test.solvent_name,
                    'delta_d': delta_d,
                    'delta_p': delta_p,
                    'delta_h': delta_h,
                    'solubility': test.solubility
                }
                solvent_data.append(solvent_entry)
                logger.debug(f"  ✅ Added to visualization: {solvent_entry}")
            else:
                logger.warning(f"  ❌ Skipped test {i+1} due to missing data: name={test.solvent_name}, δD={delta_d}, δP={delta_p}, δH={delta_h}")

        logger.info(f"📈 Prepared {len(solvent_data)} solvents for visualization")

        if not solvent_data:
            logger.error("⚠️ No valid solvent data found for visualization")
            raise HTTPException(
                status_code=400,
                detail="No valid solvent data found. Ensure solvents have HSP values."
            )

        # Generate Plotly visualization
        logger.debug(f"🎨 Generating Plotly visualization ({width}x{height})")
        plotly_data = HansenSphereVisualizationService.generate_plotly_visualization(
            hsp_result=experiment.calculated_hsp,
            solvent_data=solvent_data,
            width=width,
            height=height
        )

        logger.info(f"🎉 Visualization generated successfully for {experiment.sample_name}")

        response_data = {
            "experiment_id": experiment_id,
            "sample_name": experiment.sample_name,
            "hsp_parameters": {
                "delta_d": experiment.calculated_hsp.delta_d,
                "delta_p": experiment.calculated_hsp.delta_p,
                "delta_h": experiment.calculated_hsp.delta_h,
                "ra": experiment.calculated_hsp.radius
            },
            "plotly_config": plotly_data,
            "solvent_count": len(solvent_data)
        }

        logger.debug(f"📤 Sending response with {len(plotly_data['data'])} plot traces")
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"💥 Fatal error generating visualization for experiment {experiment_id}:")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error(f"Stack trace:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Error generating visualization: {str(e)}")


