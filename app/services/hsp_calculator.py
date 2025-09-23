"""
HSP Calculator Service using HSPiPy library
"""

import pandas as pd
import tempfile
import os
from typing import List, Dict, Optional, Tuple
from hspipy import HSP

from app.models.hsp_models import SolventTest, HSPCalculationResult


class HSPCalculator:
    """Hansen Solubility Parameter calculator using HSPiPy"""

    def __init__(self):
        self.hsp_engine = None

    def calculate_hsp_from_tests(
        self,
        solvent_tests: List[SolventTest],
        inside_limit: int = 1
    ) -> Optional[HSPCalculationResult]:
        """
        Calculate HSP values from solvent test data

        Args:
            solvent_tests: List of solvent test data
            inside_limit: Minimum number of good solvents required

        Returns:
            HSPCalculationResult or None if calculation fails
        """
        try:
            # Convert solvent tests to HSPiPy format
            hsp_data = self._convert_tests_to_hsp_format(solvent_tests)

            if len(hsp_data) < 2:
                raise ValueError("At least 2 solvent tests are required for HSP calculation")

            # Create temporary CSV file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
                tmp_filename = tmp_file.name
                hsp_data.to_csv(tmp_filename, index=False)

            try:
                # Initialize HSPiPy
                hsp = HSP()

                # Load data
                hsp.read(tmp_filename)

                # Perform calculation
                hsp.get(inside_limit=inside_limit)

                # Extract results
                result = HSPCalculationResult(
                    delta_d=float(hsp.d),
                    delta_p=float(hsp.p),
                    delta_h=float(hsp.h),
                    radius=float(hsp.radius),
                    accuracy=float(hsp.accuracy),
                    error=float(hsp.error),
                    data_fit=float(hsp.DATAFIT),
                    method="HSPiPy",
                    solvent_count=len(solvent_tests),
                    good_solvents=len([t for t in solvent_tests if t.solubility == 'soluble']),
                    calculation_details={
                        "inside_limit": inside_limit,
                        "optimization_method": "differential_evolution",
                        "sphere_model": "single"
                    }
                )

                return result

            finally:
                # Clean up temporary file
                if os.path.exists(tmp_filename):
                    os.unlink(tmp_filename)

        except Exception as e:
            print(f"HSP calculation error: {e}")
            return None

    def _convert_tests_to_hsp_format(self, solvent_tests: List[SolventTest]) -> pd.DataFrame:
        """
        Convert MixingCompass solvent test data to HSPiPy format

        Args:
            solvent_tests: List of solvent test data

        Returns:
            DataFrame in HSPiPy format
        """
        hsp_rows = []

        for test in solvent_tests:
            # Get HSP values (from manual entry or database lookup)
            delta_d, delta_p, delta_h = self._extract_hsp_values(test)

            if delta_d is None or delta_p is None or delta_h is None:
                continue  # Skip tests without complete HSP data

            # Convert solubility to binary format
            data_value = self._convert_solubility_to_binary(test.solubility)

            hsp_rows.append({
                'Chemical': test.solvent_name,
                'D': delta_d,
                'P': delta_p,
                'H': delta_h,
                'Data': data_value
            })

        return pd.DataFrame(hsp_rows)

    def _extract_hsp_values(self, test: SolventTest) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """
        Extract HSP values from solvent test data

        Args:
            test: Solvent test data

        Returns:
            Tuple of (delta_d, delta_p, delta_h) or (None, None, None) if not available
        """
        # Check for manual HSP values first
        if hasattr(test, 'manual_delta_d') and test.manual_delta_d is not None:
            return (test.manual_delta_d, test.manual_delta_p, test.manual_delta_h)

        # Check for database HSP values
        if hasattr(test, 'solvent_data') and test.solvent_data:
            solvent_data = test.solvent_data
            if all(key in solvent_data for key in ['delta_d', 'delta_p', 'delta_h']):
                return (
                    solvent_data['delta_d'],
                    solvent_data['delta_p'],
                    solvent_data['delta_h']
                )

        # If no stored data, try to lookup from database using solvent name
        if hasattr(test, 'solvent_name') and test.solvent_name:
            try:
                from app.services.solvent_service import solvent_service
                solvent_data = solvent_service.get_solvent_by_name(test.solvent_name)
                if solvent_data and all(hasattr(solvent_data, attr) for attr in ['delta_d', 'delta_p', 'delta_h']):
                    return (solvent_data.delta_d, solvent_data.delta_p, solvent_data.delta_h)
            except Exception as e:
                print(f"Failed to lookup solvent {test.solvent_name}: {e}")

        return (None, None, None)

    def _convert_solubility_to_binary(self, solubility: str) -> int:
        """
        Convert solubility string to binary format for HSPiPy

        Args:
            solubility: Solubility status ('soluble', 'insoluble', 'partial', 'unknown')

        Returns:
            Binary value (1 for good solvent, 0 for poor solvent)
        """
        good_solvents = ['soluble', 'partial']
        return 1 if solubility in good_solvents else 0

    def validate_test_data(self, solvent_tests: List[SolventTest]) -> Dict[str, any]:
        """
        Validate solvent test data for HSP calculation

        Args:
            solvent_tests: List of solvent test data

        Returns:
            Validation result dictionary
        """
        validation = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'stats': {
                'total_tests': len(solvent_tests),
                'with_hsp_data': 0,
                'good_solvents': 0,
                'poor_solvents': 0
            }
        }

        if len(solvent_tests) < 2:
            validation['valid'] = False
            validation['errors'].append("At least 2 solvent tests are required")
            return validation

        hsp_data_count = 0
        good_solvents = 0
        poor_solvents = 0

        for test in solvent_tests:
            # Check HSP data availability
            delta_d, delta_p, delta_h = self._extract_hsp_values(test)
            if all(val is not None for val in [delta_d, delta_p, delta_h]):
                hsp_data_count += 1

            # Count solvent types
            if test.solubility in ['soluble', 'partial']:
                good_solvents += 1
            else:
                poor_solvents += 1

        validation['stats']['with_hsp_data'] = hsp_data_count
        validation['stats']['good_solvents'] = good_solvents
        validation['stats']['poor_solvents'] = poor_solvents

        # Validation checks
        if hsp_data_count < 2:
            validation['valid'] = False
            validation['errors'].append(f"At least 2 tests with complete HSP data required (found {hsp_data_count})")

        if good_solvents == 0:
            validation['valid'] = False
            validation['errors'].append("At least 1 good solvent (soluble/partial) is required")

        if poor_solvents == 0:
            validation['warnings'].append("No poor solvents found - calculation may be less accurate")

        return validation

    def get_calculation_parameters(self) -> Dict[str, any]:
        """
        Get available calculation parameters and their descriptions

        Returns:
            Dictionary of calculation parameters
        """
        return {
            'inside_limit': {
                'description': 'Minimum number of good solvents required inside sphere',
                'default': 1,
                'range': [1, 10],
                'type': 'integer'
            },
            'sphere_model': {
                'description': 'Sphere model type',
                'default': 'single',
                'options': ['single', 'double'],
                'type': 'string'
            },
            'optimization_method': {
                'description': 'Optimization algorithm',
                'default': 'differential_evolution',
                'options': ['differential_evolution'],
                'type': 'string'
            }
        }


# Global instance
hsp_calculator = HSPCalculator()