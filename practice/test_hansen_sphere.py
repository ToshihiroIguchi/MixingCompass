#!/usr/bin/env python3
"""
Hansen Sphere Visualization Test
Test script to verify HSPiPy and Plotly integration for Hansen sphere visualization
"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.offline as pyo
from hspipy import HSP
import os


def create_test_dataset():
    """Create a test dataset with sample solvents"""
    data = {
        'name': ['Water', 'Ethanol', 'Toluene', 'Acetone', 'Chloroform', 'n-Hexane', 'DMF', 'DMSO'],
        'dd': [15.5, 15.8, 18.0, 15.5, 17.8, 14.9, 17.4, 18.4],
        'dp': [16.0, 8.8, 1.4, 10.4, 3.1, 0.0, 13.7, 16.4],
        'dh': [42.3, 19.4, 2.0, 7.0, 5.7, 0.0, 11.3, 10.2],
        'solubility': [1, 1, 1, 1, 1, 0, 1, 1]  # All good solvents for testing
    }
    return pd.DataFrame(data)


def create_hansen_sphere_data(center_dd, center_dp, center_dh, radius):
    """Create Hansen sphere surface data"""
    u = np.linspace(0, 2 * np.pi, 50)
    v = np.linspace(0, np.pi, 50)

    x = center_dd + radius * np.outer(np.cos(u), np.sin(v))
    y = center_dp + radius * np.outer(np.sin(u), np.sin(v))
    z = center_dh + radius * np.outer(np.ones(np.size(u)), np.cos(v))

    return x, y, z


def create_plotly_visualization(dataset, hsp_model=None):
    """Create Plotly 3D visualization of Hansen solubility parameters"""
    fig = go.Figure()

    # Add solvent points
    dd_values = dataset['dd'].values
    dp_values = dataset['dp'].values
    dh_values = dataset['dh'].values
    names = dataset['name'].values
    solubilities = dataset['solubility'].values

    # Color points by solubility
    colors = ['red' if s == 0 else 'blue' for s in solubilities]

    fig.add_trace(go.Scatter3d(
        x=dd_values,
        y=dp_values,
        z=dh_values,
        mode='markers+text',
        marker=dict(
            size=4,  # Reduced from 8 to 4 (half size)
            color=colors,
            symbol='circle'
        ),
        text=names,
        textposition="top center",
        name='Solvents',
        hovertemplate='<b>%{text}</b><br>' +
                      'δd: %{x:.1f}<br>' +
                      'δp: %{y:.1f}<br>' +
                      'δh: %{z:.1f}<br>' +
                      'Solubility: %{marker.color}<br>' +
                      '<extra></extra>'
    ))

    # Add Hansen sphere if HSP model is available
    if hsp_model and hasattr(hsp_model, 'hsp_') and hsp_model.hsp_ is not None:
        hsp_info = hsp_model.hsp_[0]  # Get first Hansen sphere info
        center_dd = hsp_info[0]  # δd
        center_dp = hsp_info[1]  # δp
        center_dh = hsp_info[2]  # δh
        radius = hsp_info[3]     # radius

        # Create sphere surface
        x, y, z = create_hansen_sphere_data(center_dd, center_dp, center_dh, radius)

        fig.add_trace(go.Surface(
            x=x, y=y, z=z,
            opacity=0.3,
            colorscale='YlGn',  # Changed from 'Reds' to yellow-green
            showscale=False,
            name='Hansen Sphere'
        ))

        # Add center point
        fig.add_trace(go.Scatter3d(
            x=[center_dd],
            y=[center_dp],
            z=[center_dh],
            mode='markers',
            marker=dict(
                size=4,              # Changed from 10 to 4 (same as solvent points)
                color='yellowgreen',  # Changed from 'red' to 'yellowgreen'
                symbol='circle'      # Changed from 'diamond' to 'circle'
            ),
            name='Hansen Center',
            hovertemplate='<b>Hansen Center</b><br>' +
                          'δd: %{x:.1f}<br>' +
                          'δp: %{y:.1f}<br>' +
                          'δh: %{z:.1f}<br>' +
                          f'Radius: {radius:.1f}<br>' +
                          '<extra></extra>'
        ))

    # Configure layout
    fig.update_layout(
        title='Hansen Solubility Parameter 3D Visualization Test',
        scene=dict(
            xaxis_title='δd (Dispersion)',
            yaxis_title='δp (Polar)',
            zaxis_title='δh (Hydrogen bonding)',
            aspectmode='cube'
        ),
        width=1000,
        height=800,
        margin=dict(l=0, r=0, b=0, t=40)
    )

    return fig


def main():
    """Main test function"""
    print("Hansen Sphere Visualization Test")
    print("=" * 40)

    # Create test dataset
    print("Creating test dataset...")
    dataset = create_test_dataset()
    print(f"Created dataset with {len(dataset)} solvents:")
    for idx, row in dataset.iterrows():
        print(f"  {row['name']}: δd={row['dd']}, δp={row['dp']}, δh={row['dh']}, soluble={row['solubility']}")

    print("\nCalculating Hansen sphere...")
    hsp_model = None
    try:
        # Create HSP model and fit to data
        hsp_model = HSP()
        X = dataset[['dd', 'dp', 'dh']].values
        y = dataset['solubility'].values

        # Fit the model
        hsp_model.fit(X, y)
        print("HSP model fitted successfully")

        # Check HSP results
        if hasattr(hsp_model, 'hsp_') and hsp_model.hsp_ is not None:
            hsp_info = hsp_model.hsp_[0]  # Get first Hansen sphere info
            center_dd = hsp_info[0]
            center_dp = hsp_info[1]
            center_dh = hsp_info[2]
            radius = hsp_info[3]
            print(f"Hansen sphere calculated successfully:")
            print(f"  Center: δd={center_dd:.1f}, δp={center_dp:.1f}, δh={center_dh:.1f}")
            print(f"  Radius: {radius:.1f}")
        else:
            print("No Hansen sphere information available in fitted model")
            # Check what attributes are available
            print("Available attributes:", [attr for attr in dir(hsp_model) if not attr.startswith('_')])

    except Exception as e:
        print(f"Error calculating Hansen sphere: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()

    print("\nCreating Plotly visualization...")
    try:
        # Create visualization
        fig = create_plotly_visualization(dataset, hsp_model)

        # Save to HTML file
        output_file = os.path.join(os.path.dirname(__file__), 'hansen_sphere_test.html')
        pyo.plot(fig, filename=output_file, auto_open=True)
        print(f"Visualization saved to: {output_file}")
        print("Opening in browser...")

    except Exception as e:
        print(f"Error creating visualization: {e}")
        import traceback
        traceback.print_exc()

    print("\nTest completed!")


if __name__ == "__main__":
    main()