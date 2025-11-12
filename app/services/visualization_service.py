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

        return {
            'x': x.tolist(),
            'y': y.tolist(),
            'z': z.tolist()
        }

    @staticmethod
    def get_solubility_color(solubility) -> str:
        """
        Get color for solubility value using RdYlBu gradient (Red-Yellow-Blue)

        Args:
            solubility: Solubility value (categorical string or numerical 0-1)

        Returns:
            Color string for the solubility value (RGB hex format)
        """
        # Convert categorical to numerical
        if isinstance(solubility, str):
            value_map = {
                'insoluble': 0.0,
                'partial': 0.5,
                'soluble': 1.0
            }
            solubility = value_map.get(solubility, 0.5)

        # Ensure numerical value in range [0, 1]
        if not isinstance(solubility, (int, float)):
            return '#666666'  # Default gray

        solubility = max(0.0, min(1.0, float(solubility)))

        # RdYlBu gradient: Red (0.0) -> Yellow (0.5) -> Blue (1.0)
        if solubility <= 0.5:
            # Red to Yellow (0.0 to 0.5)
            t = solubility * 2  # Map 0-0.5 to 0-1
            r = 211  # Red component stays high
            g = int(50 + (235 - 50) * t)  # Interpolate from #d32f2f red to #ffeb3b yellow
            b = int(47 + (59 - 47) * t)
        else:
            # Yellow to Blue (0.5 to 1.0)
            t = (solubility - 0.5) * 2  # Map 0.5-1.0 to 0-1
            r = int(255 - (255 - 33) * t)  # Interpolate from #ffeb3b yellow to #2196f3 blue
            g = int(235 - (235 - 150) * t)
            b = int(59 + (243 - 59) * t)

        color = f'#{r:02x}{g:02x}{b:02x}'
        return color

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

        logger.info(f"create_solvent_points called with {len(solvent_data)} solvents")

        points = {'x': [], 'y': [], 'z': [], 'names': [], 'colors': [], 'solubility': []}

        for i, solvent in enumerate(solvent_data):
            logger.debug(f"Processing solvent {i}: {solvent}")

            if not all(key in solvent for key in ['delta_d', 'delta_p', 'delta_h', 'solubility']):
                logger.warning(f"Skipping solvent {i} - missing required keys")
                continue

            # Support both 'name' (new) and 'solvent_name' (legacy) field names
            solvent_name = solvent.get('name') or solvent.get('solvent_name', 'Unknown')
            logger.debug(f"Adding solvent: {solvent_name} at ({solvent['delta_d']}, {solvent['delta_p']}, {solvent['delta_h']}) - {solvent['solubility']}")

            points['x'].append(solvent['delta_d'])
            points['y'].append(solvent['delta_p'])
            points['z'].append(solvent['delta_h'])
            points['names'].append(solvent_name)

            color = HansenSphereVisualizationService.get_solubility_color(solvent['solubility'])
            points['colors'].append(color)
            points['solubility'].append(solvent['solubility'])

        logger.info(f"Final points: {len(points['x'])} total, colors: {points['colors']}, solubilities: {points['solubility']}")

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

        logger.info(f"generate_plotly_visualization called with {len(solvent_data)} solvents")
        logger.debug(f"Input solvent_data: {solvent_data}")

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

        # Fixed axis ranges (extended Hansen parameter ranges)
        # δD: 5-30 (covers wide range of solvents including fluorinated compounds)
        # δP: 0-50 (covers highly polar solvents)
        # δH: 0-50 (covers strong hydrogen bonding solvents like water)
        fixed_x_range = [5, 30]   # δD
        fixed_y_range = [0, 50]   # δP
        fixed_z_range = [0, 50]   # δH

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
            if not (5 <= delta_d <= 30 and 0 <= delta_p <= 50 and 0 <= delta_h <= 50):
                out_of_range_solvents.append(f"{solvent.get('name', 'Unknown')} (δD={delta_d:.1f}, δP={delta_p:.1f}, δH={delta_h:.1f})")

        if out_of_range_solvents:
            logger.info(f"Solvents outside extended range [δD:5-30, δP:0-50, δH:0-50]: {', '.join(out_of_range_solvents)}")

        logger.info(f"Fixed axis ranges: δD=[5, 30], δP=[0, 50], δH=[0, 50]")

        # Build Plotly traces
        traces = []

        # Hansen sphere as wireframe (lines) to allow hovering points inside
        # Draw multiple circular cross-sections of the ellipsoid
        sphere_lines_x = []
        sphere_lines_y = []
        sphere_lines_z = []

        # Extract center and radius
        center_d, center_p, center_h = hsp_result.delta_d, hsp_result.delta_p, hsp_result.delta_h
        r = radius

        # Number of latitude and longitude lines
        n_lat = 12  # latitude circles
        n_lon = 12  # longitude lines
        n_points = 50  # points per circle

        import numpy as np

        # Latitude circles (horizontal slices)
        for i in range(n_lat):
            phi = np.pi * i / (n_lat - 1)  # 0 to π
            circle_x = []
            circle_y = []
            circle_z = []
            for j in range(n_points + 1):
                theta = 2 * np.pi * j / n_points
                # Ellipsoid: δD has half radius
                x = center_d + (r / 2) * np.cos(theta) * np.sin(phi)
                y = center_p + r * np.sin(theta) * np.sin(phi)
                z = center_h + r * np.cos(phi)
                circle_x.append(x)
                circle_y.append(y)
                circle_z.append(z)
            sphere_lines_x.extend(circle_x + [None])  # None creates line break
            sphere_lines_y.extend(circle_y + [None])
            sphere_lines_z.extend(circle_z + [None])

        # Longitude lines (vertical slices)
        for i in range(n_lon):
            theta = 2 * np.pi * i / n_lon
            line_x = []
            line_y = []
            line_z = []
            for j in range(n_points + 1):
                phi = np.pi * j / n_points  # 0 to π
                x = center_d + (r / 2) * np.cos(theta) * np.sin(phi)
                y = center_p + r * np.sin(theta) * np.sin(phi)
                z = center_h + r * np.cos(phi)
                line_x.append(x)
                line_y.append(y)
                line_z.append(z)
            sphere_lines_x.extend(line_x + [None])
            sphere_lines_y.extend(line_y + [None])
            sphere_lines_z.extend(line_z + [None])

        traces.append({
            'type': 'scatter3d',
            'mode': 'lines',
            'x': sphere_lines_x,
            'y': sphere_lines_y,
            'z': sphere_lines_z,
            'name': 'Hansen Sphere',
            'line': {
                'color': 'rgba(76, 175, 80, 0.6)',
                'width': 2
            },
            'hoverinfo': 'skip',  # No hover on wireframe
            'showlegend': False  # Hide from legend (visually self-evident)
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
                'text': f'HSP (δD: {hsp_result.delta_d:.1f}, δP: {hsp_result.delta_p:.1f}, δH: {hsp_result.delta_h:.1f}, Ra: {hsp_result.radius:.1f})<br><sub>Range: δD[5-30], δP/δH[0-50] MPa<sup>0.5</sup></sub>',
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
                'text': '<b>Solubility</b><br>' +
                        '<span style="color:#2196f3">■</span> 1.0 High<br>' +
                        '<span style="color:#ffeb3b">■</span> 0.5 Medium<br>' +
                        '<span style="color:#d32f2f">■</span> 0.0 Low<br>' +
                        '<span style="font-size:9px">(Continuous gradient)</span><br>' +
                        '● <span style="color:#32CD32">Hansen Center</span>',
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