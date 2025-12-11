"""
Solvent Search API endpoints
"""

from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from scipy.optimize import minimize
from pathlib import Path
import json
from datetime import datetime
import io
import zipfile
import csv

from app.services.solvent_service import solvent_service


class SolventComponent(BaseModel):
    """Solvent component for optimization"""
    name: str
    delta_d: float
    delta_p: float
    delta_h: float


class OptimizeRequest(BaseModel):
    """Request model for mixture optimization"""
    solvents: List[SolventComponent]
    target_delta_d: float
    target_delta_p: float
    target_delta_h: float
    min_ratio: Optional[float] = 0.0  # Minimum ratio per solvent (0-1)

router = APIRouter()

# Load solvent database
DATA_DIR = Path(__file__).parent.parent.parent / "data"
SOLVENT_DB_PATH = DATA_DIR / "solvents.csv"

# Cache the solvent database
_solvent_db = None
_cache_timestamp = None

def get_solvent_database(request: Request = None):
    """
    Load and cache the solvent database including user-added solvents and saved mixtures
    Cache is reset when request includes ?reload=true
    """
    global _solvent_db, _cache_timestamp
    import time

    # Check if cache should be reset
    should_reload = False
    if request and request.query_params.get('reload') == 'true':
        should_reload = True

    current_time = time.time()
    # Also auto-reload if cache is older than 60 seconds
    if _cache_timestamp and (current_time - _cache_timestamp) > 60:
        should_reload = True

    if _solvent_db is None or should_reload:
        # Load main database
        _solvent_db = pd.read_csv(SOLVENT_DB_PATH, encoding='utf-8-sig')

        # Note: User-added solvents are now managed in frontend localStorage
        # and are no longer loaded from backend CSV

        # Add saved mixtures from localStorage (need to get from client, skip for now)
        # Mixtures will be added by client-side filtering

        _cache_timestamp = current_time

    return _solvent_db


def calculate_red(delta_d1, delta_p1, delta_h1, delta_d2, delta_p2, delta_h2, ra=1.0):
    """
    Calculate Relative Energy Difference (RED)

    RED = sqrt((4*(δD1-δD2)² + (δP1-δP2)² + (δH1-δH2)²)) / Ra

    RED < 1: Good solubility
    RED ≈ 1: Partial solubility
    RED > 1: Poor solubility
    """
    distance = np.sqrt(
        4 * (delta_d1 - delta_d2)**2 +
        (delta_p1 - delta_p2)**2 +
        (delta_h1 - delta_h2)**2
    )
    return distance / ra if ra > 0 else distance


def safe_float_convert(value):
    """
    Safely convert a value to float, returning None if conversion fails
    """
    numeric_val = pd.to_numeric(value, errors='coerce')
    return float(numeric_val) if pd.notna(numeric_val) else None


def convert_row_to_dict(row, include_distance=False):
    """
    Convert a DataFrame row to a dictionary with safe type conversions

    Args:
        row: pandas Series representing a row from the solvent database
        include_distance: whether to include distance/RED fields

    Returns:
        dict with solvent properties
    """
    result = {
        'name': row['Solvent'],
        'delta_d': float(row['delta_D']) if pd.notna(row['delta_D']) else None,
        'delta_p': float(row['delta_P']) if pd.notna(row['delta_P']) else None,
        'delta_h': float(row['delta_H']) if pd.notna(row['delta_H']) else None,
        'cho': bool(row['CHO']) if pd.notna(row['CHO']) else None,
        'boiling_point': safe_float_convert(row['Tb']),
        'density': safe_float_convert(row['Density']),
        'molecular_weight': safe_float_convert(row['MWt']),
        'cost': safe_float_convert(row['Cost']),
        'cas': row['CAS'] if pd.notna(row['CAS']) else None,
        'wgk': safe_float_convert(row['WGK']),
        'ghs': row['GHS'] if pd.notna(row['GHS']) else None,
        'source_url': row['source_url'] if pd.notna(row['source_url']) else None,
    }

    if include_distance:
        result['distance'] = float(row['distance'])
        result['red'] = float(row['distance'])
        result['source_file'] = row['source_file'] if pd.notna(row['source_file']) else None

    return result


@router.get("/solvents")
async def get_all_solvents():
    """Get all solvents from database"""
    df = get_solvent_database()

    # Convert to list of dictionaries
    solvents = [convert_row_to_dict(row) for _, row in df.iterrows()]

    return {'solvents': solvents, 'count': len(solvents)}


@router.post("/search")
async def search_solvents(
    request: Request,
    target_delta_d: float = Query(...),
    target_delta_p: float = Query(...),
    target_delta_h: float = Query(...),
    target_radius: Optional[float] = Query(None),
    bp_min: Optional[float] = Query(None),
    bp_max: Optional[float] = Query(None),
    cost_min: Optional[float] = Query(None),
    cost_max: Optional[float] = Query(None),
    wgk_filter: Optional[List[int]] = Query(None),
    max_results: int = Query(default=10000, le=10000)
):
    """
    Search for solvents matching target HSP values

    Args:
        target_delta_d: Target dispersion parameter
        target_delta_p: Target polarity parameter
        target_delta_h: Target hydrogen bonding parameter
        target_radius: Maximum distance (RED) for inclusion (optional)
        bp_min: Minimum boiling point filter
        bp_max: Maximum boiling point filter
        cost_min: Minimum cost filter
        cost_max: Maximum cost filter
        wgk_filter: WGK (water hazard class) filter
        max_results: Maximum number of results to return
    """
    df = get_solvent_database(request)

    # Filter out rows with missing HSP values
    df = df.dropna(subset=['delta_D', 'delta_P', 'delta_H'])

    # Calculate distance for each solvent
    df['distance'] = calculate_red(
        target_delta_d, target_delta_p, target_delta_h,
        df['delta_D'], df['delta_P'], df['delta_H'],
        ra=target_radius if target_radius else 1.0
    )

    # Apply boiling point filter
    if bp_min is not None:
        df = df[df['Tb'] >= bp_min]
    if bp_max is not None:
        df = df[df['Tb'] <= bp_max]

    # Apply cost filter
    if cost_min is not None:
        df = df[df['Cost'] >= cost_min]
    if cost_max is not None:
        df = df[df['Cost'] <= cost_max]

    # Apply WGK filter
    if wgk_filter and 'all' not in [str(w) for w in wgk_filter]:
        df = df[df['WGK'].isin(wgk_filter)]

    # Sort by distance
    df = df.sort_values('distance')

    # Limit results
    df = df.head(max_results)

    # Convert to list of dictionaries
    results = [convert_row_to_dict(row, include_distance=True) for _, row in df.iterrows()]

    return {
        'results': results,
        'count': len(results),
        'target': {
            'delta_d': target_delta_d,
            'delta_p': target_delta_p,
            'delta_h': target_delta_h,
            'radius': target_radius
        }
    }


@router.post("/blend-search")
async def search_blend_solvents(
    target_delta_d: float,
    target_delta_p: float,
    target_delta_h: float,
    target_radius: Optional[float] = None,
    max_results: int = Query(default=50, le=200)
):
    """
    Search for 2-component solvent blends matching target HSP values

    Uses weighted average: δ_blend = x1*δ1 + x2*δ2 where x1 + x2 = 1
    """
    df = get_solvent_database()

    # Filter out rows with missing HSP values
    df = df.dropna(subset=['delta_D', 'delta_P', 'delta_H'])

    results = []

    # Search for best blends
    n_solvents = len(df)

    for i in range(n_solvents):
        solvent1 = df.iloc[i]

        for j in range(i+1, n_solvents):
            solvent2 = df.iloc[j]

            # Try different ratios (0.1 to 0.9 in 0.1 increments)
            for ratio in np.arange(0.1, 1.0, 0.1):
                blend_delta_d = ratio * solvent1['delta_D'] + (1-ratio) * solvent2['delta_D']
                blend_delta_p = ratio * solvent1['delta_P'] + (1-ratio) * solvent2['delta_P']
                blend_delta_h = ratio * solvent1['delta_H'] + (1-ratio) * solvent2['delta_H']

                distance = calculate_red(
                    target_delta_d, target_delta_p, target_delta_h,
                    blend_delta_d, blend_delta_p, blend_delta_h,
                    ra=target_radius if target_radius else 1.0
                )

                # Only include blends within target radius
                if target_radius is None or distance <= 1.0:
                    results.append({
                        'solvent1': {
                            'name': solvent1['Solvent'],
                            'delta_d': float(solvent1['delta_D']),
                            'delta_p': float(solvent1['delta_P']),
                            'delta_h': float(solvent1['delta_H']),
                        },
                        'solvent2': {
                            'name': solvent2['Solvent'],
                            'delta_d': float(solvent2['delta_D']),
                            'delta_p': float(solvent2['delta_P']),
                            'delta_h': float(solvent2['delta_H']),
                        },
                        'ratio': round(ratio, 2),
                        'blend_hsp': {
                            'delta_d': float(blend_delta_d),
                            'delta_p': float(blend_delta_p),
                            'delta_h': float(blend_delta_h),
                        },
                        'distance': float(distance),
                        'red': float(distance),
                    })

    # Sort by distance
    results.sort(key=lambda x: x['distance'])

    # Limit results
    results = results[:max_results]

    return {
        'results': results,
        'count': len(results),
        'target': {
            'delta_d': target_delta_d,
            'delta_p': target_delta_p,
            'delta_h': target_delta_h,
            'radius': target_radius
        }
    }


@router.post("/optimize-mixture")
async def optimize_mixture(request: OptimizeRequest):
    """
    Optimize solvent mixture ratios to minimize Ra (distance) to target HSP.

    Uses constrained optimization (SLSQP) to find optimal volume fractions.
    The objective function (Ra²) is convex, guaranteeing a global optimum.

    Args:
        request: OptimizeRequest containing solvents and target HSP

    Returns:
        Optimized ratios and resulting HSP values
    """
    solvents = request.solvents
    n = len(solvents)

    if n < 2:
        return {
            'success': False,
            'error': 'At least 2 solvents are required for optimization'
        }

    # Extract HSP values as numpy arrays for efficiency
    delta_d = np.array([s.delta_d for s in solvents])
    delta_p = np.array([s.delta_p for s in solvents])
    delta_h = np.array([s.delta_h for s in solvents])

    target = np.array([request.target_delta_d, request.target_delta_p, request.target_delta_h])

    def objective(phi):
        """Ra² = 4*(ΔδD)² + (ΔδP)² + (ΔδH)²"""
        mix_d = np.dot(phi, delta_d)
        mix_p = np.dot(phi, delta_p)
        mix_h = np.dot(phi, delta_h)
        return 4 * (mix_d - target[0])**2 + (mix_p - target[1])**2 + (mix_h - target[2])**2

    # Constraint: sum of ratios = 1
    constraints = {'type': 'eq', 'fun': lambda phi: np.sum(phi) - 1}

    # Bounds: min_ratio <= phi <= 1
    min_ratio = max(0.0, min(request.min_ratio or 0.0, 1.0 / n))
    bounds = [(min_ratio, 1.0) for _ in range(n)]

    # Initial guess: equal ratios
    x0 = np.ones(n) / n

    # Optimize using SLSQP (Sequential Least Squares Programming)
    result = minimize(
        objective,
        x0,
        method='SLSQP',
        bounds=bounds,
        constraints=constraints,
        options={'ftol': 1e-10, 'maxiter': 1000}
    )

    if not result.success:
        return {
            'success': False,
            'error': f'Optimization failed: {result.message}'
        }

    # Calculate optimized mixture HSP
    optimal_ratios = result.x
    mix_delta_d = float(np.dot(optimal_ratios, delta_d))
    mix_delta_p = float(np.dot(optimal_ratios, delta_p))
    mix_delta_h = float(np.dot(optimal_ratios, delta_h))

    # Calculate Ra
    ra = float(np.sqrt(result.fun))

    # Build response with solvent details
    solvent_results = []
    for i, solvent in enumerate(solvents):
        ratio = float(optimal_ratios[i])
        # Round very small ratios to 0
        if ratio < 0.001:
            ratio = 0.0
        solvent_results.append({
            'name': solvent.name,
            'delta_d': solvent.delta_d,
            'delta_p': solvent.delta_p,
            'delta_h': solvent.delta_h,
            'ratio': round(ratio, 4)
        })

    return {
        'success': True,
        'solvents': solvent_results,
        'mixture_hsp': {
            'delta_d': round(mix_delta_d, 2),
            'delta_p': round(mix_delta_p, 2),
            'delta_h': round(mix_delta_h, 2)
        },
        'target_hsp': {
            'delta_d': request.target_delta_d,
            'delta_p': request.target_delta_p,
            'delta_h': request.target_delta_h
        },
        'ra': round(ra, 3),
        'min_ratio_used': min_ratio
    }


class MixtureComponent(BaseModel):
    """Component in a solvent mixture"""
    solvent: str = Field(..., description="Solvent name")
    volume: float = Field(..., description="Volume ratio/percentage")


class MixtureExportInput(BaseModel):
    """Input model for exporting mixture as ZIP package"""
    mixture_name: str = Field(..., description="Name of the mixture")
    components: List[MixtureComponent] = Field(..., description="List of mixture components")
    delta_d: float = Field(..., description="Mixture δD")
    delta_p: float = Field(..., description="Mixture δP")
    delta_h: float = Field(..., description="Mixture δH")
    mode: Optional[str] = Field("calculate", description="Mode: 'calculate' or 'optimize'")
    target_delta_d: Optional[float] = Field(None, description="Target δD (for optimize mode)")
    target_delta_p: Optional[float] = Field(None, description="Target δP (for optimize mode)")
    target_delta_h: Optional[float] = Field(None, description="Target δH (for optimize mode)")
    ra: Optional[float] = Field(None, description="Distance to target (for optimize mode)")


@router.post("/export-mixture")
async def export_mixture_as_zip(data: MixtureExportInput):
    """
    Export mixture composition and results as a ZIP package containing:
    - CSV file with mixture composition
    - JSON file with complete data
    - README file with summary
    """
    try:
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Generate CSV
            csv_buffer = io.StringIO()
            csv_writer = csv.writer(csv_buffer)

            # Header section
            csv_writer.writerow(['Mixture Name', data.mixture_name])
            csv_writer.writerow(['Mode', data.mode.capitalize()])
            csv_writer.writerow(['Export Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            csv_writer.writerow([])

            # Mixture HSP
            csv_writer.writerow(['Mixture Hansen Solubility Parameters'])
            csv_writer.writerow(['Parameter', 'Value', 'Unit'])
            csv_writer.writerow(['δD (Dispersion)', f'{data.delta_d:.2f}', 'MPa^0.5'])
            csv_writer.writerow(['δP (Polar)', f'{data.delta_p:.2f}', 'MPa^0.5'])
            csv_writer.writerow(['δH (H-bonding)', f'{data.delta_h:.2f}', 'MPa^0.5'])
            csv_writer.writerow([])

            # Target HSP and Ra (for optimize mode)
            if data.mode == 'optimize' and data.target_delta_d is not None:
                csv_writer.writerow(['Target Hansen Solubility Parameters'])
                csv_writer.writerow(['Parameter', 'Value', 'Unit'])
                csv_writer.writerow(['Target δD', f'{data.target_delta_d:.2f}', 'MPa^0.5'])
                csv_writer.writerow(['Target δP', f'{data.target_delta_p:.2f}', 'MPa^0.5'])
                csv_writer.writerow(['Target δH', f'{data.target_delta_h:.2f}', 'MPa^0.5'])
                csv_writer.writerow(['Ra (Distance)', f'{data.ra:.3f}' if data.ra is not None else '-', 'MPa^0.5'])
                csv_writer.writerow([])

            # Mixture composition
            csv_writer.writerow(['Mixture Composition'])
            csv_writer.writerow(['Solvent', 'Volume Ratio', 'Percentage'])
            total_volume = sum(c.volume for c in data.components)
            for comp in data.components:
                percentage = (comp.volume / total_volume * 100) if total_volume > 0 else 0
                csv_writer.writerow([comp.solvent, f'{comp.volume:.2f}', f'{percentage:.1f}%'])
            csv_writer.writerow(['Total', f'{total_volume:.2f}', '100.0%'])

            zip_file.writestr('data/mixture.csv', csv_buffer.getvalue())

            # 2. Generate JSON
            json_data = {
                'mixture_name': data.mixture_name,
                'mode': data.mode,
                'export_date': datetime.now().isoformat(),
                'mixture_hsp': {
                    'delta_d': data.delta_d,
                    'delta_p': data.delta_p,
                    'delta_h': data.delta_h
                },
                'components': [
                    {
                        'solvent': comp.solvent,
                        'volume': comp.volume,
                        'percentage': (comp.volume / total_volume * 100) if total_volume > 0 else 0
                    }
                    for comp in data.components
                ]
            }

            # Add target and Ra for optimize mode
            if data.mode == 'optimize' and data.target_delta_d is not None:
                json_data['target_hsp'] = {
                    'delta_d': data.target_delta_d,
                    'delta_p': data.target_delta_p,
                    'delta_h': data.target_delta_h
                }
                json_data['ra'] = data.ra

            zip_file.writestr('data/mixture.json', json.dumps(json_data, indent=2))

            # 3. Generate README
            readme_content = f"""Solvent Mixture Analysis Results
Mixture: {data.mixture_name}
Mode: {data.mode.capitalize()}
Export Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Mixture Hansen Solubility Parameters:
- δD (Dispersion)  = {data.delta_d:.2f} MPa^0.5
- δP (Polar)       = {data.delta_p:.2f} MPa^0.5
- δH (H-bonding)   = {data.delta_h:.2f} MPa^0.5
"""

            if data.mode == 'optimize' and data.target_delta_d is not None:
                readme_content += f"""
Target Hansen Solubility Parameters:
- Target δD        = {data.target_delta_d:.2f} MPa^0.5
- Target δP        = {data.target_delta_p:.2f} MPa^0.5
- Target δH        = {data.target_delta_h:.2f} MPa^0.5
- Ra (Distance)    = {data.ra:.3f} MPa^0.5
"""

            readme_content += f"""
Mixture Composition:
"""
            for comp in data.components:
                percentage = (comp.volume / total_volume * 100) if total_volume > 0 else 0
                readme_content += f"- {comp.solvent}: {comp.volume:.2f} ({percentage:.1f}%)\n"

            readme_content += f"""
Package Contents:
- data/mixture.csv       : Mixture composition and HSP data (CSV format)
- data/mixture.json      : Complete mixture data (JSON format)
- README.txt             : This file

Notes:
- HSP values are in MPa^0.5 units
- Volume ratios are normalized to percentages
- Ra (distance) measures how close the mixture is to the target HSP
"""
            zip_file.writestr('README.txt', readme_content)

        # Prepare ZIP for download
        zip_buffer.seek(0)

        # Generate filename with sanitized mixture name
        safe_name = "".join(c for c in data.mixture_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        date_str = datetime.now().strftime('%Y%m%d')
        filename = f"{safe_name}_mixture_{date_str}.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

