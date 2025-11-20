"""
Solvent Search API endpoints
"""

from fastapi import APIRouter, Query, Request
from typing import List, Optional
import pandas as pd
import numpy as np
from pathlib import Path
import json

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

        # Add user-added solvents
        try:
            from ..services.solvent_service import SolventService
            solvent_service = SolventService()
            user_solvents = solvent_service.get_user_added_solvents()

            if user_solvents:
                print(f"[Solvent Search] Loading {len(user_solvents)} user-added solvents...")
                user_df_data = []
                for solvent in user_solvents:
                    # SolventData is a Pydantic model, access attributes directly
                    user_df_data.append({
                        'Solvent': solvent.solvent,
                        'delta_D': solvent.delta_d,
                        'delta_P': solvent.delta_p,
                        'delta_H': solvent.delta_h,
                        'CAS': solvent.cas,
                        'Tb': solvent.boiling_point,
                        'CHO': None,
                        'Density': solvent.density,
                        'MWt': solvent.molecular_weight,
                        'Cost': solvent.cost_per_ml,
                        'WGK': solvent.wgk_class,
                        'GHS': solvent.ghs_classification,
                        'source_url': None,
                        'source_file': 'user_added'
                    })

                user_df = pd.DataFrame(user_df_data)
                _solvent_db = pd.concat([_solvent_db, user_df], ignore_index=True)
                print(f"[Solvent Search] Successfully added {len(user_df)} user-added solvents to database")
        except Exception as e:
            print(f"Warning: Could not load user-added solvents: {e}")
            import traceback
            traceback.print_exc()

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


