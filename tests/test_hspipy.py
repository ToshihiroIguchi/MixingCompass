"""
Test HSPiPy library functionality
"""

import pandas as pd
import numpy as np
from hspipy import HSP

def test_hspipy_basic():
    """Test basic HSPiPy functionality"""
    print("Testing HSPiPy basic functionality...")

    # Create sample solvent data
    sample_data = pd.DataFrame({
        'Solvent': ['Water', 'Ethanol', 'Acetone', 'Toluene', 'Hexane'],
        'δD': [15.5, 15.8, 15.5, 18.0, 14.9],
        'δP': [16.0, 8.8, 10.4, 1.4, 0.0],
        'δH': [42.3, 19.4, 7.0, 2.0, 0.0],
        'Solubility': [1, 1, 1, 0, 0]  # 1=soluble, 0=insoluble
    })

    print("Sample data:")
    print(sample_data)

    # Save to CSV for HSPiPy
    sample_data.to_csv('test_solvents.csv', index=False)

    # Test HSPiPy
    try:
        hsp = HSP()

        # Check available methods
        print("\nHSP object methods:")
        print([method for method in dir(hsp) if not method.startswith('_')])

        # Try to read data
        print("\nReading data...")
        hsp.read('test_solvents.csv')

        print("Data loaded successfully!")
        print(f"Columns: {hsp.data.columns.tolist()}")
        print(f"Shape: {hsp.data.shape}")

        return True

    except Exception as e:
        print(f"Error testing HSPiPy: {e}")
        return False

def test_hsp_calculation():
    """Test HSP calculation with proper data format"""
    print("\n" + "="*50)
    print("Testing HSP calculation...")

    # Create data in expected format
    # HSPiPy expects specific column names and format
    sample_data = pd.DataFrame({
        'Chemical': ['Water', 'Ethanol', 'Acetone', 'Toluene', 'Hexane'],
        'D': [15.5, 15.8, 15.5, 18.0, 14.9],
        'P': [16.0, 8.8, 10.4, 1.4, 0.0],
        'H': [42.3, 19.4, 7.0, 2.0, 0.0],
        'Data': [1, 1, 1, 0, 0]  # Solubility data
    })

    sample_data.to_csv('test_hsp_format.csv', index=False)

    try:
        hsp = HSP()
        hsp.read('test_hsp_format.csv')

        print("Attempting HSP calculation...")
        hsp.get(inside_limit=1)

        print(f"Calculated HSP: δD={hsp.d:.1f}, δP={hsp.p:.1f}, δH={hsp.h:.1f}")
        print(f"Sphere radius: {hsp.radius:.1f}")
        print(f"Accuracy: {hsp.accuracy:.3f}")

        return True

    except Exception as e:
        print(f"Error in HSP calculation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("HSPiPy Library Test")
    print("="*50)

    # Test basic functionality
    basic_success = test_hspipy_basic()

    # Test calculation
    calc_success = test_hsp_calculation()

    print("\n" + "="*50)
    print("Test Results:")
    print(f"Basic functionality: {'PASS' if basic_success else 'FAIL'}")
    print(f"HSP calculation: {'PASS' if calc_success else 'FAIL'}")