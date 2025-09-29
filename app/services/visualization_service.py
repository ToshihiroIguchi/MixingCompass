"""
Hansen Sphere Visualization Service
Generates Plotly-compatible 3D sphere data for Hansen Solubility Parameters
"""

import numpy as np
import plotly.graph_objects as go
from typing import Dict, List, Optional, Tuple
from ..models.hsp_models import HSPCalculationResult


class HansenSphereVisualizationService:
    """Service for generating Hansen sphere 3D visualizations using Plotly"""

    @staticmethod
    def generate_sphere_coordinates(center: Tuple[float, float, float],
                                  radius: float,
                                  resolution: int = 20) -> Dict[str, List[float]]:
        """
        Generate sphere coordinates for Hansen sphere visualization

        Args:
            center: Sphere center (delta_d, delta_p, delta_h)
            radius: Sphere radius (Ra value)
            resolution: Mesh resolution for sphere surface

        Returns:
            Dictionary with x, y, z coordinates for sphere surface
        """
        # Generate sphere surface using parametric equations
        u = np.linspace(0, 2 * np.pi, resolution)
        v = np.linspace(0, np.pi, resolution)
        u, v = np.meshgrid(u, v)

        # Parametric equations for sphere
        x = center[0] + radius * np.cos(u) * np.sin(v)
        y = center[1] + radius * np.sin(u) * np.sin(v)
        z = center[2] + radius * np.cos(v)

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

        # Calculate data bounds including both sphere and points
        # sphere_coords returns lists, not numpy arrays, so no need for flatten()
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

        sphere_bounds = {
            'x': [min(all_x), max(all_x)],
            'y': [min(all_y), max(all_y)],
            'z': [min(all_z), max(all_z)]
        }

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
                'text': f'HSP (δD: {hsp_result.delta_d:.1f}, δP: {hsp_result.delta_p:.1f}, δH: {hsp_result.delta_h:.1f}, Ra: {hsp_result.radius:.1f})',
                'x': 0.5,
                'font': {'size': 16}
            },
            'scene': {
                'xaxis': {
                    'title': 'δD (Dispersion) [MPa<sup>0.5</sup>]',
                    'titlefont': {'size': 12},
                    'range': [sphere_bounds['x'][0] - 1, sphere_bounds['x'][1] + 1]  # Add padding for visibility
                },
                'yaxis': {
                    'title': 'δP (Polarity) [MPa<sup>0.5</sup>]',
                    'titlefont': {'size': 12},
                    'range': [0, sphere_bounds['y'][1] + 1]  # Start from 0 to show hexane at (14.9, 0, 0)
                },
                'zaxis': {
                    'title': 'δH (Hydrogen Bonding) [MPa<sup>0.5</sup>]',
                    'titlefont': {'size': 12},
                    'range': [0, sphere_bounds['z'][1] + 1]  # Start from 0 to show hexane at (14.9, 0, 0)
                },
                'camera': {
                    'eye': {'x': 1.25, 'y': 1.25, 'z': 1.25}  # Optimized for perfect sphere visibility
                },
                'aspectmode': 'manual',  # Manual mode for explicit axis control
                'aspectratio': {'x': 1, 'y': 1, 'z': 1}  # Equal aspect ratio for proper sphere
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