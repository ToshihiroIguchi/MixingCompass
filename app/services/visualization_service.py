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
    def create_solvent_points(solvent_data: List[Dict]) -> Dict[str, List]:
        """
        Create scatter points for solvents in HSP space

        Args:
            solvent_data: List of solvent test data with HSP values and solubility

        Returns:
            Dictionary with coordinates and metadata for scatter plot
        """
        good_solvents = {'x': [], 'y': [], 'z': [], 'names': [], 'solubility': []}
        bad_solvents = {'x': [], 'y': [], 'z': [], 'names': [], 'solubility': []}

        for solvent in solvent_data:
            if not all(key in solvent for key in ['delta_d', 'delta_p', 'delta_h', 'solubility']):
                continue

            point_data = {
                'x': solvent['delta_d'],
                'y': solvent['delta_p'],
                'z': solvent['delta_h'],
                'name': solvent.get('solvent_name', 'Unknown'),
                'solubility': solvent['solubility']
            }

            # Color-code based on solubility
            if solvent['solubility'] in ['soluble', 'partial']:
                good_solvents['x'].append(point_data['x'])
                good_solvents['y'].append(point_data['y'])
                good_solvents['z'].append(point_data['z'])
                good_solvents['names'].append(point_data['name'])
                good_solvents['solubility'].append(point_data['solubility'])
            else:
                bad_solvents['x'].append(point_data['x'])
                bad_solvents['y'].append(point_data['y'])
                bad_solvents['z'].append(point_data['z'])
                bad_solvents['names'].append(point_data['name'])
                bad_solvents['solubility'].append(point_data['solubility'])

        return {
            'good_solvents': good_solvents,
            'bad_solvents': bad_solvents
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

        # Generate sphere coordinates
        sphere_center = (hsp_result.delta_d, hsp_result.delta_p, hsp_result.delta_h)
        sphere_coords = cls.generate_sphere_coordinates(
            center=sphere_center,
            radius=hsp_result.radius,
            resolution=25
        )

        # Create solvent scatter points
        solvent_points = cls.create_solvent_points(solvent_data)

        # Build Plotly traces
        traces = []

        # Hansen sphere surface (wireframe)
        traces.append({
            'type': 'surface',
            'x': sphere_coords['x'],
            'y': sphere_coords['y'],
            'z': sphere_coords['z'],
            'name': 'Hansen Sphere',
            'opacity': 0.3,
            'colorscale': 'YlGn',  # Yellow-green colorscale
            'showscale': False,
            'hovertemplate': f'Hansen Sphere<br>Center: ({hsp_result.delta_d:.1f}, {hsp_result.delta_p:.1f}, {hsp_result.delta_h:.1f})<br>Radius: {hsp_result.radius:.1f}<extra></extra>'
        })

        # Good solvents (blue points, smaller size)
        if solvent_points['good_solvents']['x']:
            traces.append({
                'type': 'scatter3d',
                'mode': 'markers',
                'x': solvent_points['good_solvents']['x'],
                'y': solvent_points['good_solvents']['y'],
                'z': solvent_points['good_solvents']['z'],
                'name': 'Good Solvents',
                'marker': {
                    'size': 4,  # Reduced from 8 to 4
                    'color': 'blue',
                    'symbol': 'circle'
                },
                'text': solvent_points['good_solvents']['names'],
                'hovertemplate': '<b>%{text}</b><br>δD: %{x:.1f}<br>δP: %{y:.1f}<br>δH: %{z:.1f}<br>Solubility: %{customdata}<extra></extra>',
                'customdata': solvent_points['good_solvents']['solubility']
            })

        # Bad solvents (red points, smaller size)
        if solvent_points['bad_solvents']['x']:
            traces.append({
                'type': 'scatter3d',
                'mode': 'markers',
                'x': solvent_points['bad_solvents']['x'],
                'y': solvent_points['bad_solvents']['y'],
                'z': solvent_points['bad_solvents']['z'],
                'name': 'Poor Solvents',
                'marker': {
                    'size': 4,  # Reduced from 8 to 4
                    'color': 'red',
                    'symbol': 'circle'
                },
                'text': solvent_points['bad_solvents']['names'],
                'hovertemplate': '<b>%{text}</b><br>δD: %{x:.1f}<br>δP: %{y:.1f}<br>δH: %{z:.1f}<br>Solubility: %{customdata}<extra></extra>',
                'customdata': solvent_points['bad_solvents']['solubility']
            })

        # HSP center point (yellow-green circle, same size as other points)
        traces.append({
            'type': 'scatter3d',
            'mode': 'markers',
            'x': [hsp_result.delta_d],
            'y': [hsp_result.delta_p],
            'z': [hsp_result.delta_h],
            'name': 'Hansen Center',
            'marker': {
                'size': 4,  # Reduced from 12 to 4 (same as other points)
                'color': 'yellowgreen',  # Changed from blue to yellowgreen
                'symbol': 'circle'       # Changed from diamond to circle
            },
            'hovertemplate': f'<b>Hansen Center</b><br>δD: {hsp_result.delta_d:.1f}<br>δP: {hsp_result.delta_p:.1f}<br>δH: {hsp_result.delta_h:.1f}<br>Radius: {hsp_result.radius:.1f}<extra></extra>'
        })

        # Layout configuration
        layout = {
            'title': {
                'text': 'Hansen Solubility Parameters - 3D Visualization',
                'x': 0.5,
                'font': {'size': 16}
            },
            'scene': {
                'xaxis': {
                    'title': 'δD (Dispersion) [MPa<sup>0.5</sup>]',
                    'titlefont': {'size': 12}
                },
                'yaxis': {
                    'title': 'δP (Polarity) [MPa<sup>0.5</sup>]',
                    'titlefont': {'size': 12}
                },
                'zaxis': {
                    'title': 'δH (Hydrogen Bonding) [MPa<sup>0.5</sup>]',
                    'titlefont': {'size': 12}
                },
                'camera': {
                    'eye': {'x': 1.5, 'y': 1.5, 'z': 1.5}
                },
                'aspectmode': 'cube'
            },
            'width': width,
            'height': height,
            'margin': {'l': 0, 'r': 0, 't': 40, 'b': 0},
            'legend': {
                'x': 0.02,
                'y': 0.98,
                'bgcolor': 'rgba(255,255,255,0.8)',
                'bordercolor': 'rgba(0,0,0,0.2)',
                'borderwidth': 1
            }
        }

        return {
            'data': traces,
            'layout': layout
        }