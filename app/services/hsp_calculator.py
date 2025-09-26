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

                # Prepare data for fitting
                X = hsp_data[['D', 'P', 'H']].values
                y = hsp_data['Data'].values

                # Perform calculation using fit method
                hsp.fit(X, y)

                # Extract results from hsp_ attribute
                if hasattr(hsp, 'hsp_') and hsp.hsp_ is not None:
                    try:
                        hsp_info = hsp.hsp_[0]  # Get first Hansen sphere info
                        print(f"Debug: hsp_info = {hsp_info}")
                        print(f"Debug: hsp_info type = {type(hsp_info)}")

                        # Safely extract values with debugging
                        delta_d = float(hsp_info[0]) if hsp_info[0] is not None else 0.0
                        delta_p = float(hsp_info[1]) if hsp_info[1] is not None else 0.0
                        delta_h = float(hsp_info[2]) if hsp_info[2] is not None else 0.0
                        radius = float(hsp_info[3]) if hsp_info[3] is not None else 1.0

                        print(f"Debug: Extracted values - δd={delta_d}, δp={delta_p}, δh={delta_h}, radius={radius}")

                    except Exception as e:
                        print(f"Debug: Error extracting HSP values: {e}")
                        raise ValueError(f"Failed to extract HSP values: {e}")

                    # Calculate accuracy and other metrics safely
                    accuracy = 0.0
                    error = 0.0
                    data_fit = 0.0

                    # Try to get accuracy if available
                    if hasattr(hsp, 'accuracy_') and hsp.accuracy_ is not None:
                        try:
                            accuracy = float(hsp.accuracy_)
                        except (ValueError, TypeError):
                            accuracy = 0.0

                    # Try to get error if available
                    if hasattr(hsp, 'error_') and hsp.error_ is not None:
                        try:
                            error = float(hsp.error_)
                        except (ValueError, TypeError):
                            error = 0.0

                    # Try to get datafit if available
                    if hasattr(hsp, 'datafit_') and hsp.datafit_ is not None:
                        try:
                            data_fit = float(hsp.datafit_)
                        except (ValueError, TypeError):
                            data_fit = 0.0
                else:
                    raise ValueError("Failed to extract HSP results from fitted model")

                # Extract results
                result = HSPCalculationResult(
                    delta_d=delta_d,
                    delta_p=delta_p,
                    delta_h=delta_h,
                    radius=radius,
                    accuracy=accuracy,
                    error=error,
                    data_fit=data_fit,
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

            # Convert solubility to continuous float format
            data_value = self._convert_solubility_to_float(test.solubility)

            # Skip tests with unknown solubility (data_value is None)
            if data_value is None:
                continue

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

    def _convert_solubility_to_float(self, solubility) -> Optional[float]:
        """
        Convert solubility input to continuous float format for HSPiPy

        Args:
            solubility: Solubility status (string or float)
                      String: 'soluble', 'insoluble', 'partial'
                      Float: 0.0-1.0 range for custom values

        Returns:
            Continuous value (0.0-1.0 range, None for invalid input)
        """
        # Handle direct numerical input
        if isinstance(solubility, (int, float)):
            value = float(solubility)
            # Validate range
            if 0.0 <= value <= 1.0:
                return value
            else:
                return None  # Invalid range

        # Handle string input
        if isinstance(solubility, str):
            mapping = {
                'soluble': 1.0,    # Complete dissolution
                'partial': 0.5,    # Partial dissolution
                'insoluble': 0.0,  # No dissolution
            }
            return mapping.get(solubility, None)

        return None  # Invalid input type

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