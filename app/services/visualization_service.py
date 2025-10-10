"""
Hansen Sphere Visualization Service
Generates Plotly-compatible 3D sphere data for Hansen Solubility Parameters
"""

import logging
import numpy as np
import plotly.graph_objects as go
from typing import Dict, List, Optional, Tuple
from ..models.hsp_models import HSPCalculationResult

logger = logging.getLogger(__name__)


class HansenSphereVisualizationService:
    """Service for generating Hansen sphere 3D visualizations using Plotly"""
    # ELLIPSOID FIX APPLIED

    @staticmethod
    def generate_sphere_coordinates(center: Tuple[float, float, float],
                                  radius: float,
                                  resolution: int = 20) -> Dict[str, List[float]]:
        """
        Generate Hansen spheroid coordinates for visualization

        Hansen spheroid is an ELLIPSOID in Euclidean space.
        Ra = √[4(δD1 - δD2)² + (δP1 - δP2)² + (δH1 - δH2)²]

        The factor of 4 for δD means in Euclidean space:
        - δD direction: radius / 2 (compressed)
        - δP direction: radius (normal)
        - δH direction: radius (normal)

        Args:
            center: Sphere center (delta_d, delta_p, delta_h)
            radius: Sphere radius (Ra value)
            resolution: Mesh resolution for sphere surface

        Returns:
            Dictionary with x, y, z coordinates for ellipsoid surface
        """
        # Generate sphere surface using parametric equations
        u = np.linspace(0, 2 * np.pi, resolution)
        v = np.linspace(0, np.pi, resolution)
        u, v = np.meshgrid(u, v)

        # Parametric equations for Hansen spheroid (ellipsoid in Euclidean space)
        # δD direction has HALF the radius due to factor of 4 in distance formula
        x = center[0] + (radius / 2) * np.cos(u) * np.sin(v)  # δD: half radius
        y = center[1] + radius * np.sin(u) * np.sin(v)        # δP: full radius
        z = center[2] + radius * np.cos(v)                     # δH: full radius

        # Clip to 0 (Hansen parameters cannot be negative)
        x = np.maximum(x, 0)
        y = np.maximum(y, 0)
        z = np.maximum(z, 0)

        print(f"DEBUG generate_sphere_coordinates CALLED: center={center}, radius={radius}")
        print(f"DEBUG deltaD range: [{x.min():.2f}, {x.max():.2f}]")
        print(f"DEBUG deltaP range: [{y.min():.2f}, {y.max():.2f}]")
        print(f"DEBUG deltaH range: [{z.min():.2f}, {z.max():.2f}]")

        return {
            'x': x.tolist(),
            'y': y.tolist(),
            'z': z.tolist()
        }

    @staticmethod
    def get_solubility_color(solubility) -> str:
        """
        Get color for solubility value based on scientific standards

        Args:
            solubility: Solubility value (categorical string or numerical 0-1)

        Returns:
            Color string for the solubility value
        """
        if isinstance(solubility, str):
            color_map = {
                'soluble': '#1976d2',     # Blue (Good solvents)
                'partial': '#ff9800',     # Orange (Partial solvents)
                'insoluble': '#d32f2f'    # Red (Poor solvents)
            }
            return color_map.get(solubility, '#666666')

        # Numerical solubility (0.0 - 1.0)
        if isinstance(solubility, (int, float)):
            if solubility >= 0.7:
                return '#1976d2'    # Blue (Good: >= 0.7)
            elif solubility >= 0.3:
                return '#ff9800'    # Orange (Partial: 0.3-0.7)
            else:
                return '#d32f2f'    # Red (Poor: < 0.3)

        return '#666666'  # Default gray

    @staticmethod
    def create_solvent_points(solvent_data: List[Dict]) -> Dict[str, List]:
        """
        Create scatter points for solvents in HSP space with scientific color coding

        Args:
            solvent_data: List of solvent test data with HSP values and solubility

        Returns:
            Dictionary with coordinates, colors, and metadata for scatter plot
        """
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"🔍 create_solvent_points called with {len(solvent_data)} solvents")

        points = {'x': [], 'y': [], 'z': [], 'names': [], 'colors': [], 'solubility': []}

        for i, solvent in enumerate(solvent_data):
            logger.info(f"🔍 Processing solvent {i}: {solvent}")

            if not all(key in solvent for key in ['delta_d', 'delta_p', 'delta_h', 'solubility']):
                logger.warning(f"⚠️ Skipping solvent {i} - missing required keys")
                continue

            logger.info(f"✅ Adding solvent: {solvent.get('solvent_name', 'Unknown')} at ({solvent['delta_d']}, {solvent['delta_p']}, {solvent['delta_h']}) - {solvent['solubility']}")

            points['x'].append(solvent['delta_d'])
            points['y'].append(solvent['delta_p'])
            points['z'].append(solvent['delta_h'])
            points['names'].append(solvent.get('solvent_name', 'Unknown'))
            points['colors'].append(HansenSphereVisualizationService.get_solubility_color(solvent['solubility']))
            points['solubility'].append(solvent['solubility'])

        logger.info(f"🔍 Final points: {len(points['x'])} total, colors: {points['colors']}, solubilities: {points['solubility']}")

        return points

    @staticmethod
    def generate_circle_coordinates(center: Tuple[float, float],
                                   radius: float,
                                   resolution: int = 100) -> Tuple[List[float], List[float]]:
        """
        Generate circle coordinates for 2D projection

        Args:
            center: Circle center (x, y)
            radius: Circle radius
            resolution: Number of points for circle

        Returns:
            Tuple of (x_coords, y_coords) for circle
        """
        theta = np.linspace(0, 2 * np.pi, resolution)
        x = center[0] + radius * np.cos(theta)
        y = center[1] + radius * np.sin(theta)
        return x.tolist(), y.tolist()

    @staticmethod
    def generate_ellipse_coordinates(center: Tuple[float, float],
                                    semi_axis_x: float,
                                    semi_axis_y: float,
                                    resolution: int = 100) -> Tuple[List[float], List[float]]:
        """
        Generate ellipse coordinates for 2D projection

        For Hansen sphere projections involving δD:
        - δD direction has semi-axis = radius / 2 (due to factor of 4 in distance formula)
        - δP, δH directions have semi-axis = radius (full radius)

        Args:
            center: Ellipse center (x, y)
            semi_axis_x: Semi-axis length in x direction
            semi_axis_y: Semi-axis length in y direction
            resolution: Number of points for ellipse

        Returns:
            Tuple of (x_coords, y_coords) for ellipse
        """
        theta = np.linspace(0, 2 * np.pi, resolution)
        x = center[0] + semi_axis_x * np.cos(theta)
        y = center[1] + semi_axis_y * np.sin(theta)
        return x.tolist(), y.tolist()

    @staticmethod
    def generate_2d_projections(hsp_result: HSPCalculationResult,
                                solvent_data: List[Dict],
                                width: int = 400,
                                height: int = 400) -> Dict:
        """
        Generate 2D projection plots for Hansen space

        Args:
            hsp_result: HSP calculation result with center and radius
            solvent_data: Solvent test data for plotting points
            width: Plot width in pixels
            height: Plot height in pixels

        Returns:
            Dictionary with three 2D projection plots (dd_dp, dd_dh, dp_dh)
        """
        center_d = hsp_result.delta_d
        center_p = hsp_result.delta_p
        center_h = hsp_result.delta_h
        radius = hsp_result.radius

        # Extract solvent points
        solvent_points = HansenSphereVisualizationService.create_solvent_points(solvent_data)

        # Calculate axis maximum for consistent ranges with origin at (0,0)
        all_values = (
            solvent_points['x'] + solvent_points['y'] + solvent_points['z'] +
            [center_d, center_p, center_h] +
            [center_d + radius, center_p + radius, center_h + radius]
        )
        axis_max = max(25.0, max(all_values) + 2) if all_values else 25.0

        # 1. δD vs δP (fixing δH)
        # δD has semi-axis radius/2, δP has semi-axis radius (ellipse)
        ellipse_x, ellipse_y = HansenSphereVisualizationService.generate_ellipse_coordinates(
            (center_d, center_p), radius / 2, radius
        )

        dd_dp = {
            'data': [
                # Ellipse (δD compressed by factor of 2)
                {
                    'x': ellipse_x,
                    'y': ellipse_y,
                    'mode': 'lines',
                    'name': 'Hansen Ellipse',
                    'line': {'color': 'rgba(76, 175, 80, 0.6)', 'width': 2},
                    'fill': 'toself',
                    'fillcolor': 'rgba(76, 175, 80, 0.1)',
                    'hoverinfo': 'skip'
                },
                # Solvent points
                {
                    'x': solvent_points['x'],
                    'y': solvent_points['y'],
                    'mode': 'markers',
                    'name': 'Solvents',
                    'marker': {
                        'size': 8,
                        'color': solvent_points['colors'],
                        'line': {'width': 1, 'color': 'white'}
                    },
                    'text': solvent_points['names'],
                    'hovertemplate': '<b>%{text}</b><br>δD: %{x:.1f}<br>δP: %{y:.1f}<extra></extra>'
                },
                # Center point
                {
                    'x': [center_d],
                    'y': [center_p],
                    'mode': 'markers',
                    'name': 'Center',
                    'marker': {'size': 10, 'color': '#32CD32', 'symbol': 'cross', 'line': {'width': 2, 'color': '#228B22'}},
                    'hovertemplate': f'<b>Center</b><br>δD: {center_d:.1f}<br>δP: {center_p:.1f}<extra></extra>'
                }
            ],
            'layout': {
                'title': {'text': 'δD vs δP Projection', 'font': {'size': 14}},
                'width': width,
                'height': height,
                'xaxis': {'title': 'δD [MPa<sup>0.5</sup>]', 'range': [0, axis_max]},
                'yaxis': {'title': 'δP [MPa<sup>0.5</sup>]', 'range': [0, axis_max]},
                'hovermode': 'closest',
                'showlegend': False,
                'margin': {'l': 50, 'r': 20, 't': 40, 'b': 50}
            }
        }

        # 2. δD vs δH (fixing δP)
        # δD has semi-axis radius/2, δH has semi-axis radius (ellipse)
        ellipse_x, ellipse_y = HansenSphereVisualizationService.generate_ellipse_coordinates(
            (center_d, center_h), radius / 2, radius
        )

        dd_dh = {
            'data': [
                {
                    'x': ellipse_x,
                    'y': ellipse_y,
                    'mode': 'lines',
                    'name': 'Hansen Ellipse',
                    'line': {'color': 'rgba(76, 175, 80, 0.6)', 'width': 2},
                    'fill': 'toself',
                    'fillcolor': 'rgba(76, 175, 80, 0.1)',
                    'hoverinfo': 'skip'
                },
                {
                    'x': solvent_points['x'],
                    'y': solvent_points['z'],
                    'mode': 'markers',
                    'name': 'Solvents',
                    'marker': {
                        'size': 8,
                        'color': solvent_points['colors'],
                        'line': {'width': 1, 'color': 'white'}
                    },
                    'text': solvent_points['names'],
                    'hovertemplate': '<b>%{text}</b><br>δD: %{x:.1f}<br>δH: %{y:.1f}<extra></extra>'
                },
                {
                    'x': [center_d],
                    'y': [center_h],
                    'mode': 'markers',
                    'name': 'Center',
                    'marker': {'size': 10, 'color': '#32CD32', 'symbol': 'cross', 'line': {'width': 2, 'color': '#228B22'}},
                    'hovertemplate': f'<b>Center</b><br>δD: {center_d:.1f}<br>δH: {center_h:.1f}<extra></extra>'
                }
            ],
            'layout': {
                'title': {'text': 'δD vs δH Projection', 'font': {'size': 14}},
                'width': width,
                'height': height,
                'xaxis': {'title': 'δD [MPa<sup>0.5</sup>]', 'range': [0, axis_max]},
                'yaxis': {'title': 'δH [MPa<sup>0.5</sup>]', 'range': [0, axis_max]},
                'hovermode': 'closest',
                'showlegend': False,
                'margin': {'l': 50, 'r': 20, 't': 40, 'b': 50}
            }
        }

        # 3. δP vs δH (fixing δD)
        circle_x, circle_y = HansenSphereVisualizationService.generate_circle_coordinates((center_p, center_h), radius)

        dp_dh = {
            'data': [
                {
                    'x': circle_x,
                    'y': circle_y,
                    'mode': 'lines',
                    'name': 'Hansen Circle',
                    'line': {'color': 'rgba(76, 175, 80, 0.6)', 'width': 2},
                    'fill': 'toself',
                    'fillcolor': 'rgba(76, 175, 80, 0.1)',
                    'hoverinfo': 'skip'
                },
                {
                    'x': solvent_points['y'],
                    'y': solvent_points['z'],
                    'mode': 'markers',
                    'name': 'Solvents',
                    'marker': {
                        'size': 8,
                        'color': solvent_points['colors'],
                        'line': {'width': 1, 'color': 'white'}
                    },
                    'text': solvent_points['names'],
                    'hovertemplate': '<b>%{text}</b><br>δP: %{x:.1f}<br>δH: %{y:.1f}<extra></extra>'
                },
                {
                    'x': [center_p],
                    'y': [center_h],
                    'mode': 'markers',
                    'name': 'Center',
                    'marker': {'size': 10, 'color': '#32CD32', 'symbol': 'cross', 'line': {'width': 2, 'color': '#228B22'}},
                    'hovertemplate': f'<b>Center</b><br>δP: {center_p:.1f}<br>δH: {center_h:.1f}<extra></extra>'
                }
            ],
            'layout': {
                'title': {'text': 'δP vs δH Projection', 'font': {'size': 14}},
                'width': width,
                'height': height,
                'xaxis': {'title': 'δP [MPa<sup>0.5</sup>]', 'range': [0, axis_max]},
                'yaxis': {'title': 'δH [MPa<sup>0.5</sup>]', 'range': [0, axis_max], 'scaleanchor': 'x', 'scaleratio': 1},
                'hovermode': 'closest',
                'showlegend': False,
                'margin': {'l': 50, 'r': 20, 't': 40, 'b': 50}
            }
        }

        return {
            'dd_dp': dd_dp,
            'dd_dh': dd_dh,
            'dp_dh': dp_dh
        }

    @classmethod
    def generate_plotly_visualization(cls,
                                    hsp_result: HSPCalculationResult,
                                    solvent_data: List[Dict],
                                    width: int = 800,
                                    height: int = 600) -> Dict:
        """
        Generate complete Plotly visualization data for Hansen sphere

        Args:
            hsp_result: HSP calculation result with center and radius
            solvent_data: Solvent test data for plotting points
            width: Plot width in pixels
            height: Plot height in pixels

        Returns:
            Complete Plotly figure configuration
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🚀 generate_plotly_visualization called with {len(solvent_data)} solvents")
        logger.info(f"🚀 Input solvent_data: {solvent_data}")

        # Generate sphere data - cube mode will handle equal ranges automatically
        sphere_center = (hsp_result.delta_d, hsp_result.delta_p, hsp_result.delta_h)
        radius = hsp_result.radius

        # Generate sphere coordinates using original center and radius
        sphere_coords = cls.generate_sphere_coordinates(
            center=sphere_center,
            radius=radius,
            resolution=25
        )

        # Create solvent scatter points using original data
        solvent_points = cls.create_solvent_points(solvent_data)

        # Fixed axis ranges (standard Hansen parameter ranges)
        # δD: 10-25 (typical organic solvents range from 14-22)
        # δP: 0-30 (covers most polar interactions)
        # δH: 0-30 (covers hydrogen bonding range)
        fixed_x_range = [10, 25]  # δD
        fixed_y_range = [0, 30]   # δP
        fixed_z_range = [0, 30]   # δH

        # Check for out-of-range data and log warnings
        all_x = []
        for row in sphere_coords['x']:
            all_x.extend(row if isinstance(row, list) else [row])
        all_x.extend(solvent_points['x'])

        all_y = []
        for row in sphere_coords['y']:
            all_y.extend(row if isinstance(row, list) else [row])
        all_y.extend(solvent_points['y'])

        all_z = []
        for row in sphere_coords['z']:
            all_z.extend(row if isinstance(row, list) else [row])
        all_z.extend(solvent_points['z'])

        # Identify out-of-range solvents
        out_of_range_solvents = []
        for i, solvent in enumerate(solvent_data):
            delta_d = solvent.get('delta_d', 0)
            delta_p = solvent.get('delta_p', 0)
            delta_h = solvent.get('delta_h', 0)
            if not (10 <= delta_d <= 25 and 0 <= delta_p <= 30 and 0 <= delta_h <= 30):
                out_of_range_solvents.append(f"{solvent.get('name', 'Unknown')} (δD={delta_d:.1f}, δP={delta_p:.1f}, δH={delta_h:.1f})")

        if out_of_range_solvents:
            logger.info(f"Solvents outside standard range [δD:10-25, δP:0-30, δH:0-30]: {', '.join(out_of_range_solvents)}")

        logger.info(f"Fixed axis ranges: δD=[10, 25], δP=[0, 30], δH=[0, 30]")

        # Build Plotly traces
        traces = []

        # Hansen sphere surface (transparent green - scientific standard)
        traces.append({
            'type': 'surface',
            'x': sphere_coords['x'],
            'y': sphere_coords['y'],
            'z': sphere_coords['z'],
            'name': 'Hansen Sphere',
            'opacity': 0.35,  # Optimal transparency for scientific visualization
            'colorscale': [[0, 'rgba(76, 175, 80, 0.3)'], [1, 'rgba(76, 175, 80, 0.3)']],  # Uniform green
            'showscale': False,
            'hovertemplate': f'Hansen Sphere<br>Center: ({hsp_result.delta_d:.1f}, {hsp_result.delta_p:.1f}, {hsp_result.delta_h:.1f})<br>Radius: {hsp_result.radius:.1f}<extra></extra>'
        })

        # Solvent points with scientific color coding
        if solvent_points['x']:
            traces.append({
                'type': 'scatter3d',
                'mode': 'markers',
                'x': solvent_points['x'],
                'y': solvent_points['y'],
                'z': solvent_points['z'],
                'name': 'Solvent Points',
                'showlegend': False,  # Hide from legend to avoid clutter
                'marker': {
                    'size': 3,  # Optimal UI size for 3D - prevents overlapping and clutter
                    'color': solvent_points['colors'],  # Individual colors per point
                    'symbol': 'circle',
                    'opacity': 0.9,  # Higher opacity for better visibility
                    'line': {
                        'width': 0.5,
                        'color': 'rgba(255,255,255,0.6)'  # Subtle white border for definition
                    }
                },
                'text': solvent_points['names'],
                'hovertemplate': '<b>%{text}</b><br>δD: %{x:.1f}<br>δP: %{y:.1f}<br>δH: %{z:.1f}<br>Solubility: %{customdata}<extra></extra>',
                'customdata': solvent_points['solubility']
            })

        # HSP center point (lime green - HSPiP standard)
        traces.append({
            'type': 'scatter3d',
            'mode': 'markers',
            'x': [hsp_result.delta_d],
            'y': [hsp_result.delta_p],
            'z': [hsp_result.delta_h],
            'name': 'Hansen Center',
            'showlegend': False,  # Hide from legend for unified legend system
            'marker': {
                'size': 3,  # Same size as solvent points per HSPiP standard
                'color': '#32CD32',  # Lime green - HSPiP standard color
                'symbol': 'circle',  # Standard circle shape per HSPiP
                'opacity': 1.0,  # Full opacity for emphasis
                'line': {
                    'width': 0.5,
                    'color': 'rgba(50,205,50,0.8)'  # Lime green border for definition
                }
            },
            'hovertemplate': f'<b>Hansen Center</b><br>δD: {hsp_result.delta_d:.1f}<br>δP: {hsp_result.delta_p:.1f}<br>δH: {hsp_result.delta_h:.1f}<br>Ra: {hsp_result.radius:.1f}<extra></extra>'
        })

        # Layout configuration
        layout = {
            'title': {
                'text': f'HSP (δD: {hsp_result.delta_d:.1f}, δP: {hsp_result.delta_p:.1f}, δH: {hsp_result.delta_h:.1f}, Ra: {hsp_result.radius:.1f})<br><sub>Range: δD[10-25], δP/δH[0-30] MPa<sup>0.5</sup></sub>',
                'x': 0.5,
                'font': {'size': 16}
            },
            'scene': {
                'xaxis': {
                    'title': {'text': 'δD (Dispersion) [MPa<sup>0.5</sup>]', 'font': {'size': 12}},
                    'range': fixed_x_range
                },
                'yaxis': {
                    'title': {'text': 'δP (Polarity) [MPa<sup>0.5</sup>]', 'font': {'size': 12}},
                    'range': fixed_y_range
                },
                'zaxis': {
                    'title': {'text': 'δH (Hydrogen Bonding) [MPa<sup>0.5</sup>]', 'font': {'size': 12}},
                    'range': fixed_z_range
                },
                'camera': {
                    'eye': {'x': 1.25, 'y': 1.25, 'z': 1.25}  # Optimized for visibility
                },
                'aspectmode': 'cube'  # Force cube display for equal visual axis lengths
            },
            'width': width,
            'height': height,
            'margin': {'l': 0, 'r': 0, 't': 40, 'b': 0},
            'showlegend': True,
            'legend': {
                'x': 0.02,
                'y': 0.98,
                'bgcolor': 'rgba(255,255,255,0.95)',
                'bordercolor': 'rgba(0,0,0,0.2)',
                'borderwidth': 1,
                'font': {'size': 11},
                'itemsizing': 'constant',
                'itemwidth': 30
            },
            'annotations': [{
                'text': '<b>Solubility Legend</b><br>' +
                        '🔴 <span style="color:#d32f2f">Poor</span> (< 0.3)<br>' +
                        '🟠 <span style="color:#ff9800">Partial</span> (0.3-0.7)<br>' +
                        '🔵 <span style="color:#1976d2">Good</span> (≥ 0.7)<br>' +
                        '🟢 <span style="color:#32CD32">Hansen Center</span><br>' +
                        '<span style="color:#4caf50">⬛ Hansen Sphere</span>',
                'showarrow': False,
                'xref': 'paper',
                'yref': 'paper',
                'x': 0.02,
                'y': 0.35,
                'xanchor': 'left',
                'yanchor': 'top',
                'bgcolor': 'rgba(255,255,255,0.95)',
                'bordercolor': 'rgba(0,0,0,0.2)',
                'borderwidth': 1,
                'font': {'size': 11},
                'align': 'left'
            }]
        }

        return {
            'data': traces,
            'layout': layout
        }