"""
HSP Experimental API endpoints
"""

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
import time
import logging
import io
import zipfile
import csv
import json
from datetime import datetime

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
from app.services.visualization_service import HansenSphereVisualizationService  # Force reload

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
async def calculate_hsp(
    experiment_id: str,
    calc_params: Dict[str, Any] = Body(default={})
):
    """Calculate HSP values for an experiment"""

    logger.info(f"Calculate HSP called with experiment_id={experiment_id}, calc_params={calc_params}")

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

        # Extract parameters from body or use defaults
        loss_function = calc_params.get('loss_function', 'cross_entropy')
        size_factor = calc_params.get('size_factor', 0.0)

        # Perform HSP calculation with custom loss function and size_factor
        result = hsp_calculator.calculate_hsp_from_tests(
            experiment.solvent_tests,
            loss_function=loss_function,
            size_factor=size_factor
        )
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
    print(f"VISUALIZATION CALLED FOR: {experiment_id}")

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

        # DEBUG: Log input solvent data
        logger.info(f"🧪 INPUT SOLVENT DATA DEBUG:")
        logger.info(f"   Total solvents: {len(solvent_data)}")
        for i, solvent in enumerate(solvent_data):
            logger.info(f"   Solvent {i}: {solvent}")

        # Generate Plotly visualization
        logger.debug(f"🎨 Generating Plotly visualization ({width}x{height})")
        plotly_data = HansenSphereVisualizationService.generate_plotly_visualization(
            hsp_result=experiment.calculated_hsp,
            solvent_data=solvent_data,
            width=width,
            height=height
        )

        logger.info(f"🎉 Visualization generated successfully for {experiment.sample_name}")

        # DEBUG: Log Plotly data details
        logger.info(f"📊 PLOTLY DATA DEBUG:")
        logger.info(f"   Number of traces: {len(plotly_data['data'])}")
        for i, trace in enumerate(plotly_data['data']):
            trace_type = trace.get('type')
            trace_name = trace.get('name', 'unnamed')
            logger.info(f"   Trace {i}: {trace_type} - {trace_name}")

            if trace_type == 'scatter3d' and trace_name == 'Solvent Points':
                x_points = trace.get('x', [])
                y_points = trace.get('y', [])
                z_points = trace.get('z', [])
                colors = trace.get('marker', {}).get('color', [])
                names = trace.get('text', [])
                solubility = trace.get('customdata', [])

                logger.info(f"     - Points count: {len(x_points)}")
                logger.info(f"     - Coordinates: {list(zip(x_points, y_points, z_points))}")
                logger.info(f"     - Colors: {colors}")
                logger.info(f"     - Names: {names}")
                logger.info(f"     - Solubility: {solubility}")

        # Generate 2D projections
        logger.debug(f"🎨 Generating 2D projections")
        projections_2d = HansenSphereVisualizationService.generate_2d_projections(
            hsp_result=experiment.calculated_hsp,
            solvent_data=solvent_data,
            width=240,
            height=240
        )

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
            "projections_2d": projections_2d,
            "solvent_count": len(solvent_data)
        }

        logger.debug(f"📤 Sending response with {len(plotly_data['data'])} plot traces and 3 2D projections")
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


@router.get("/test-sphere-distortion")
async def test_sphere_distortion():
    """Test different approaches to fix sphere distortion with real data"""
    # Use real HSP data that causes distortion
    hsp_center = (15.6, 8.067, 13.0)
    hsp_radius = 6.454

    # Real solvent data that causes the problem
    solvent_data = [
        {'delta_d': 15.5, 'delta_p': 10.4, 'delta_h': 7.0, 'solvent_name': 'acetone', 'solubility': 'soluble'},
        {'delta_d': 15.8, 'delta_p': 8.8, 'delta_h': 19.4, 'solvent_name': 'ethanol', 'solubility': 'soluble'},
        {'delta_d': 15.8, 'delta_p': 5.3, 'delta_h': 7.2, 'solvent_name': 'ethyl acetate', 'solubility': 'partial'},
        {'delta_d': 14.9, 'delta_p': 0, 'delta_h': 0, 'solvent_name': 'hexane', 'solubility': 'insoluble'},
        {'delta_d': 18.0, 'delta_p': 1.4, 'delta_h': 2.0, 'solvent_name': 'toluene', 'solubility': 'insoluble'}
    ]

    approaches = {}

    # Approach 1: Current (cube mode) - what's currently being used
    approaches['current_cube'] = create_sphere_test('cube', hsp_center, hsp_radius, solvent_data)

    # Approach 2: Manual with calculated equal ranges
    approaches['manual_equal_ranges'] = create_sphere_test('manual_equal', hsp_center, hsp_radius, solvent_data)

    # Approach 3: Data mode (Plotly auto-calculated)
    approaches['data_mode'] = create_sphere_test('data', hsp_center, hsp_radius, solvent_data)

    # Approach 4: Manual with forced larger ranges
    approaches['manual_forced'] = create_sphere_test('manual_forced', hsp_center, hsp_radius, solvent_data)

    return {
        "message": "Sphere distortion test approaches generated",
        "hsp_center": hsp_center,
        "hsp_radius": hsp_radius,
        "approaches": approaches,
        "solvent_count": len(solvent_data)
    }


def create_sphere_test(approach_type: str, center, radius, solvent_data):
    """Create sphere visualization with different approaches"""

    # Generate sphere coordinates
    sphere_coords = generate_test_sphere(center, radius, 25)

    # Create traces
    traces = []

    # Sphere surface
    traces.append({
        'type': 'surface',
        'x': sphere_coords['x'],
        'y': sphere_coords['y'],
        'z': sphere_coords['z'],
        'name': 'Hansen Sphere',
        'opacity': 0.35,
        'colorscale': [[0, 'rgba(76, 175, 80, 0.3)'], [1, 'rgba(76, 175, 80, 0.3)']],
        'showscale': False,
        'hovertemplate': f'Hansen Sphere<br>Center: ({center[0]:.1f}, {center[1]:.1f}, {center[2]:.1f})<br>Radius: {radius:.1f}<extra></extra>'
    })

    # Solvent points
    solvent_x = [s['delta_d'] for s in solvent_data]
    solvent_y = [s['delta_p'] for s in solvent_data]
    solvent_z = [s['delta_h'] for s in solvent_data]
    colors = [get_solubility_color(s['solubility']) for s in solvent_data]
    names = [s['solvent_name'] for s in solvent_data]

    traces.append({
        'type': 'scatter3d',
        'mode': 'markers',
        'x': solvent_x,
        'y': solvent_y,
        'z': solvent_z,
        'name': 'Solvents',
        'marker': {'size': 6, 'color': colors, 'opacity': 0.9},
        'text': names,
        'showlegend': False
    })

    # Center point
    traces.append({
        'type': 'scatter3d',
        'mode': 'markers',
        'x': [center[0]],
        'y': [center[1]],
        'z': [center[2]],
        'name': 'Center',
        'marker': {'size': 8, 'color': '#32CD32', 'opacity': 1.0},
        'showlegend': False
    })

    # Calculate ranges based on approach
    layout = create_layout_for_approach(approach_type, center, radius, solvent_data)

    return {
        'data': traces,
        'layout': layout,
        'approach_description': get_approach_description(approach_type)
    }


def create_layout_for_approach(approach_type: str, center, radius, solvent_data):
    """Create layout configuration for different approaches"""

    base_layout = {
        'title': f'Approach: {approach_type}',
        'width': 700,
        'height': 500,
        'scene': {
            'camera': {'eye': {'x': 1.25, 'y': 1.25, 'z': 1.25}},
            'xaxis': {'title': 'δD [MPa^0.5]'},
            'yaxis': {'title': 'δP [MPa^0.5]'},
            'zaxis': {'title': 'δH [MPa^0.5]'}
        }
    }

    if approach_type == 'cube':
        # Current approach: cube mode with corrected δD axis range
        # δD axis should be 9.5 ~ 22.5 (or extend if data exceeds this range)
        # Note: ellipsoid is generated with radius/2 in δD direction (Euclidean space)
        all_delta_d = [s['delta_d'] for s in solvent_data]
        all_delta_d.append(center[0] - radius/2)  # ellipsoid extends ±radius/2 in δD
        all_delta_d.append(center[0] + radius/2)

        min_delta_d = min(9.5, min(all_delta_d))
        max_delta_d = max(22.5, max(all_delta_d))

        if min_delta_d < 9.5:
            print(f"Warning: δD minimum ({min(all_delta_d):.2f}) is below 9.5, extending range to {min_delta_d:.2f}")
        if max_delta_d > 22.5:
            print(f"Warning: δD maximum ({max(all_delta_d):.2f}) is above 22.5, extending range to {max_delta_d:.2f}")

        base_layout['scene']['aspectmode'] = 'data'  # Use data aspect ratio
        base_layout['scene']['xaxis']['range'] = [min_delta_d, max_delta_d]

    elif approach_type == 'manual_equal':
        # Manual with calculated equal ranges
        all_x = [center[0] - radius, center[0] + radius] + [s['delta_d'] for s in solvent_data]
        all_y = [center[1] - radius, center[1] + radius] + [s['delta_p'] for s in solvent_data]
        all_z = [center[2] - radius, center[2] + radius] + [s['delta_h'] for s in solvent_data]

        x_span = max(all_x) - min(all_x)
        y_span = max(all_y) - min(all_y)
        z_span = max(all_z) - min(all_z)
        max_span = max(x_span, y_span, z_span)

        base_layout['scene']['aspectmode'] = 'manual'
        base_layout['scene']['aspectratio'] = {'x': 1, 'y': 1, 'z': 1}
        base_layout['scene']['xaxis']['range'] = [center[0] - max_span/2, center[0] + max_span/2]
        base_layout['scene']['yaxis']['range'] = [center[1] - max_span/2, center[1] + max_span/2]
        base_layout['scene']['zaxis']['range'] = [center[2] - max_span/2, center[2] + max_span/2]

    elif approach_type == 'data':
        # Let Plotly calculate automatically
        base_layout['scene']['aspectmode'] = 'data'

    elif approach_type == 'manual_forced':
        # Force large equal ranges
        range_size = 25.0  # Force large range
        base_layout['scene']['aspectmode'] = 'manual'
        base_layout['scene']['aspectratio'] = {'x': 1, 'y': 1, 'z': 1}
        base_layout['scene']['xaxis']['range'] = [center[0] - range_size/2, center[0] + range_size/2]
        base_layout['scene']['yaxis']['range'] = [center[1] - range_size/2, center[1] + range_size/2]
        base_layout['scene']['zaxis']['range'] = [center[2] - range_size/2, center[2] + range_size/2]

    return base_layout


def get_approach_description(approach_type: str) -> str:
    """Get description of the approach"""
    descriptions = {
        'cube': 'aspectmode: cube (current method)',
        'manual_equal': 'aspectmode: manual + calculated equal ranges',
        'data': 'aspectmode: data (Plotly auto-calculated)',
        'manual_forced': 'aspectmode: manual + forced large equal ranges'
    }
    return descriptions.get(approach_type, 'Unknown approach')


def generate_test_sphere(center, radius, resolution=20):
    """
    Generate Hansen spheroid coordinates

    Hansen spheroid is an ELLIPSOID in Euclidean space.
    Ra = √[4(δD1 - δD2)² + (δP1 - δP2)² + (δH1 - δH2)²]

    The factor of 4 for δD means in Euclidean space:
    - δD direction: radius / 2 (compressed)
    - δP direction: radius (normal)
    - δH direction: radius (normal)

    We generate the ellipsoid directly using parametric equations with
    different radii for each axis.
    """
    import numpy as np

    u = np.linspace(0, 2 * np.pi, resolution)
    v = np.linspace(0, np.pi, resolution)
    u, v = np.meshgrid(u, v)

    # Generate ellipsoid in Euclidean space
    # δD direction has HALF the radius due to factor of 4 in distance formula
    x = center[0] + (radius / 2) * np.cos(u) * np.sin(v)  # δD: half radius
    y = center[1] + radius * np.sin(u) * np.sin(v)        # δP: full radius
    z = center[2] + radius * np.cos(v)                     # δH: full radius

    print(f"DEBUG generate_test_sphere: center={center}, radius={radius}")
    print(f"DEBUG generate_test_sphere: δD range=[{x.min():.2f}, {x.max():.2f}] (radius/2={radius/2:.2f})")
    print(f"DEBUG generate_test_sphere: δP range=[{y.min():.2f}, {y.max():.2f}] (radius={radius:.2f})")
    print(f"DEBUG generate_test_sphere: δH range=[{z.min():.2f}, {z.max():.2f}] (radius={radius:.2f})")

    return {
        'x': x.tolist(),
        'y': y.tolist(),
        'z': z.tolist()
    }


def get_solubility_color(solubility: str) -> str:
    """Get color for solubility"""
    color_map = {
        'soluble': '#1976d2',
        'partial': '#ff9800',
        'insoluble': '#d32f2f'
    }
    return color_map.get(solubility, '#666666')


@router.get("/experiments/{experiment_id}/export-graphs")
async def export_graphs_as_zip(experiment_id: str):
    """Export visualization graphs and data as ZIP package"""

    try:
        # Load experiment
        experiment = data_manager.load_experiment(experiment_id)
        if not experiment:
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

        # Check if HSP has been calculated
        if not experiment.calculated_hsp:
            raise HTTPException(
                status_code=400,
                detail="HSP has not been calculated for this experiment"
            )

        # Prepare solvent data
        solvent_data = []
        for test in experiment.solvent_tests:
            delta_d = test.manual_delta_d
            delta_p = test.manual_delta_p
            delta_h = test.manual_delta_h

            if delta_d is None or delta_p is None or delta_h is None:
                try:
                    solvent_db_data = solvent_service.get_solvent_by_name(test.solvent_name)
                    if solvent_db_data:
                        delta_d = delta_d if delta_d is not None else solvent_db_data.delta_d
                        delta_p = delta_p if delta_p is not None else solvent_db_data.delta_p
                        delta_h = delta_h if delta_h is not None else solvent_db_data.delta_h
                except Exception:
                    pass

            if test.solvent_name and delta_d is not None and delta_p is not None and delta_h is not None:
                solvent_entry = {
                    'solvent_name': test.solvent_name,
                    'delta_d': delta_d,
                    'delta_p': delta_p,
                    'delta_h': delta_h,
                    'solubility': test.solubility
                }
                solvent_data.append(solvent_entry)

        if not solvent_data:
            raise HTTPException(
                status_code=400,
                detail="No valid solvent data found"
            )

        # Create ZIP file in memory
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Generate 3D HTML
            plotly_3d = HansenSphereVisualizationService.generate_plotly_visualization(
                hsp_result=experiment.calculated_hsp,
                solvent_data=solvent_data,
                width=1000,
                height=700
            )

            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Hansen Sphere 3D - {experiment.sample_name}</title>
    <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
</head>
<body>
    <div id="plot"></div>
    <script>
        var data = {json.dumps(plotly_3d['data'])};
        var layout = {json.dumps(plotly_3d['layout'])};
        Plotly.newPlot('plot', data, layout, {{responsive: true}});
    </script>
</body>
</html>"""
            zip_file.writestr('graphs/hansen_sphere_3d.html', html_content)

            # 1b. Generate 3D PNG
            try:
                import plotly.graph_objects as go
                fig_3d = go.Figure(data=plotly_3d['data'], layout=plotly_3d['layout'])
                png_3d_bytes = fig_3d.to_image(format='png', width=1200, height=800, scale=2)
                zip_file.writestr('graphs/hansen_sphere_3d.png', png_3d_bytes)
            except Exception as e:
                logger.warning(f"Failed to generate 3D PNG: {e}")

            # 1c. Generate 2D projections PNG
            try:
                projections_2d = HansenSphereVisualizationService.generate_2d_projections(
                    hsp_result=experiment.calculated_hsp,
                    solvent_data=solvent_data,
                    width=600,
                    height=600
                )

                # Create combined 2D projection image using plotly
                from plotly.subplots import make_subplots

                fig_2d = make_subplots(
                    rows=1, cols=3,
                    subplot_titles=('δD vs δP', 'δD vs δH', 'δP vs δH'),
                    horizontal_spacing=0.12
                )

                # Add δD vs δP
                for trace in projections_2d['dd_dp']['data']:
                    fig_2d.add_trace(trace, row=1, col=1)

                # Add δD vs δH
                for trace in projections_2d['dd_dh']['data']:
                    fig_2d.add_trace(trace, row=1, col=2)

                # Add δP vs δH
                for trace in projections_2d['dp_dh']['data']:
                    fig_2d.add_trace(trace, row=1, col=3)

                # Update layout
                fig_2d.update_xaxes(title_text="δD [MPa<sup>0.5</sup>]", row=1, col=1)
                fig_2d.update_yaxes(title_text="δP [MPa<sup>0.5</sup>]", row=1, col=1, scaleanchor="x", scaleratio=1)

                fig_2d.update_xaxes(title_text="δD [MPa<sup>0.5</sup>]", row=1, col=2)
                fig_2d.update_yaxes(title_text="δH [MPa<sup>0.5</sup>]", row=1, col=2, scaleanchor="x2", scaleratio=1)

                fig_2d.update_xaxes(title_text="δP [MPa<sup>0.5</sup>]", row=1, col=3)
                fig_2d.update_yaxes(title_text="δH [MPa<sup>0.5</sup>]", row=1, col=3, scaleanchor="x3", scaleratio=1)

                fig_2d.update_layout(
                    height=600,
                    width=1800,
                    showlegend=False,
                    title_text=f"Hansen Solubility Parameters 2D Projections - {experiment.sample_name}"
                )

                png_2d_bytes = fig_2d.to_image(format='png', width=1800, height=600, scale=2)
                zip_file.writestr('graphs/hansen_projections_2d.png', png_2d_bytes)
            except Exception as e:
                logger.warning(f"Failed to generate 2D PNG: {e}")

            # 2. Generate CSV
            csv_buffer = io.StringIO()
            csv_writer = csv.writer(csv_buffer)

            # Header section
            csv_writer.writerow(['Sample Name', experiment.sample_name])
            csv_writer.writerow(['Calculated Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            csv_writer.writerow(['δD (MPa^0.5)', f'{experiment.calculated_hsp.delta_d:.2f}'])
            csv_writer.writerow(['δP (MPa^0.5)', f'{experiment.calculated_hsp.delta_p:.2f}'])
            csv_writer.writerow(['δH (MPa^0.5)', f'{experiment.calculated_hsp.delta_h:.2f}'])
            csv_writer.writerow(['Ra (MPa^0.5)', f'{experiment.calculated_hsp.radius:.2f}'])
            csv_writer.writerow(['Method', experiment.calculated_hsp.method])
            csv_writer.writerow(['Accuracy (%)', f'{experiment.calculated_hsp.accuracy * 100:.1f}'])
            csv_writer.writerow([])

            # Solvent data section
            csv_writer.writerow(['Solvent Name', 'δD', 'δP', 'δH', 'Solubility'])
            for solvent in solvent_data:
                csv_writer.writerow([
                    solvent['solvent_name'],
                    f"{solvent['delta_d']:.1f}",
                    f"{solvent['delta_p']:.1f}",
                    f"{solvent['delta_h']:.1f}",
                    solvent['solubility']
                ])

            zip_file.writestr('data/hsp_results.csv', csv_buffer.getvalue())

            # 3. Generate JSON
            json_data = {
                'sample_name': experiment.sample_name,
                'calculation_date': datetime.now().isoformat(),
                'hsp_parameters': {
                    'delta_d': experiment.calculated_hsp.delta_d,
                    'delta_p': experiment.calculated_hsp.delta_p,
                    'delta_h': experiment.calculated_hsp.delta_h,
                    'radius': experiment.calculated_hsp.radius
                },
                'calculation_details': {
                    'method': experiment.calculated_hsp.method,
                    'accuracy': experiment.calculated_hsp.accuracy,
                    'error': experiment.calculated_hsp.error,
                    'good_solvents': experiment.calculated_hsp.good_solvents,
                    'total_solvents': experiment.calculated_hsp.solvent_count
                },
                'solvents': solvent_data
            }
            zip_file.writestr('data/hsp_results.json', json.dumps(json_data, indent=2))

            # 4. Generate README
            readme_content = f"""Hansen Solubility Parameters Analysis Results
Sample: {experiment.sample_name}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

HSP Parameters:
- δD = {experiment.calculated_hsp.delta_d:.1f} MPa^0.5
- δP = {experiment.calculated_hsp.delta_p:.1f} MPa^0.5
- δH = {experiment.calculated_hsp.delta_h:.1f} MPa^0.5
- Ra = {experiment.calculated_hsp.radius:.1f} MPa^0.5

Calculation Details:
- Method: {experiment.calculated_hsp.method}
- Accuracy: {experiment.calculated_hsp.accuracy * 100:.1f}%
- Good Solvents: {experiment.calculated_hsp.good_solvents}/{experiment.calculated_hsp.solvent_count}

Files:
- graphs/hansen_sphere_3d.html: Interactive 3D visualization
- graphs/hansen_sphere_3d.png: Static 3D visualization (if available)
- graphs/hansen_projections_2d.png: 2D projection plots (if available)
- data/hsp_results.csv: Data in CSV format
- data/hsp_results.json: Data in JSON format

Generated by MixingCompass
"""
            zip_file.writestr('README.txt', readme_content)

        # Prepare response
        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{experiment.sample_name}_hansen_graphs.zip"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting graphs: {e}")
        raise HTTPException(status_code=500, detail=f"Error exporting graphs: {str(e)}")


