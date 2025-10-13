"""
HSP Calculator Service using HSPiPy library
"""

import pandas as pd
import tempfile
import os
from typing import List, Dict, Optional, Tuple
from hspipy import HSP, HSPEstimator

from app.models.hsp_models import SolventTest, HSPCalculationResult
from app.services.theory_based_loss import get_loss_function


class HSPCalculator:
    """Hansen Solubility Parameter calculator using HSPiPy"""

    def __init__(self):
        self.hsp_engine = None

    def calculate_hsp_from_tests(
        self,
        solvent_tests: List[SolventTest],
        inside_limit: int = 1,
        loss_function: str = "cross_entropy",
        size_factor: float = 0.0
    ) -> Optional[HSPCalculationResult]:
        """
        Calculate HSP values from solvent test data

        Args:
            solvent_tests: List of solvent test data
            inside_limit: Minimum number of good solvents required (legacy parameter)
            loss_function: Loss function name (default: "cross_entropy")
                          Special mode: 'optimize_radius_only' - Uses Cross Entropy for center,
                          then optimizes R0 (interaction radius) only to maximize FIT
            size_factor: Size penalty factor (default: 0.0)

        Returns:
            HSPCalculationResult or None if calculation fails
        """

        # Check if this is radius-only optimization mode
        if loss_function == 'optimize_radius_only':
            return self._calculate_hsp_optimize_radius_only(solvent_tests)
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
                # Prepare data for fitting
                X = hsp_data[['D', 'P', 'H']].values
                y = hsp_data['Data'].values

                # Check if using HSPiPy default (classic DATAFIT method)
                if loss_function == 'hspipy_default':
                    # Use HSPiPy's default classic method (no custom loss function)
                    estimator = HSPEstimator(
                        n_spheres=1,
                        method='classic'
                    )
                else:
                    # Get custom loss function
                    loss_func = get_loss_function(loss_function, size_factor=size_factor if size_factor > 0 else None)

                    # Use HSPEstimator with custom loss function
                    estimator = HSPEstimator(
                        n_spheres=1,
                        method='differential_evolution',
                        loss=loss_func,
                        de_maxiter=3000,
                        de_workers=1
                    )

                # Perform calculation
                estimator.fit(X, y)

                # Use estimator results
                hsp = estimator

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

                # Determine optimization method name for display
                if loss_function == 'hspipy_default':
                    optimization_method = "classic"
                    method_display = "HSPiPy-default"
                else:
                    optimization_method = "differential_evolution"
                    method_display = f"HSPiPy-{loss_function}"

                # Extract results
                result = HSPCalculationResult(
                    delta_d=delta_d,
                    delta_p=delta_p,
                    delta_h=delta_h,
                    radius=radius,
                    accuracy=accuracy,
                    error=error,
                    data_fit=data_fit,
                    method=method_display,
                    solvent_count=len(solvent_tests),
                    good_solvents=len([t for t in solvent_tests if t.solubility == 'soluble']),
                    calculation_details={
                        "loss_function": loss_function,
                        "size_factor": size_factor,
                        "optimization_method": optimization_method,
                        "sphere_model": "single",
                        "maxiter": 3000 if optimization_method == "differential_evolution" else None
                    }
                )

                # Log temporary file location for debugging
                print(f"Debug: HSP calculation data saved to: {tmp_filename}")
                print(f"Debug: File contains {len(hsp_data)} records")

                return result

            finally:
                # Keep temporary file for debugging (do not delete)
                # if os.path.exists(tmp_filename):
                #     os.unlink(tmp_filename)
                pass

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

    def _calculate_hsp_optimize_radius_only(self, solvent_tests: List[SolventTest]) -> Optional[HSPCalculationResult]:
        """
        Optimize R0 (interaction radius) only with fixed center from Cross Entropy

        Strategy:
        1. Calculate center (δD, δP, δH) using Cross Entropy
        2. Fix the center
        3. Calculate R0_min = max distance to all good solvents
        4. Set R0_optimal = R0_min (minimum sphere covering all good solvents)

        Rationale:
        - Uses Cross Entropy only for center calculation (well-established method)
        - R0_min is the smallest interaction radius that covers all soluble points
        - This minimizes false positives (poor solvents inside sphere)
        - No arbitrary parameters

        This ensures:
        - All soluble points (solubility = 1.0) are inside the sphere
        - The sphere is as small as possible
        - False positives are minimized

        Classification rule:
        - solubility = 1.0 → good solvent → must be inside (RED < 1)
        - solubility < 1.0 → poor solvent → preferably outside (RED > 1)

        Note: RED = Ra / R0, where Ra is the Hansen distance and R0 is the interaction radius
        """

        try:
            print("\n=== Optimize Radius Only Mode ===")

            # Step 1: Calculate center using Cross Entropy
            print("Step 1: Calculate center using Cross Entropy")
            center_result = self.calculate_hsp_from_tests(
                solvent_tests,
                loss_function='cross_entropy',
                size_factor=0.0
            )

            if not center_result:
                print("Failed to calculate center with Cross Entropy")
                return None

            center_d = center_result.delta_d
            center_p = center_result.delta_p
            center_h = center_result.delta_h

            print(f"Center: δD={center_d:.4f}, δP={center_p:.4f}, δH={center_h:.4f}")

            # Step 2: Convert solvent tests to format with distances
            print("\nStep 2: Calculate Hansen distances")
            hsp_data = self._convert_tests_to_hsp_format(solvent_tests)

            if len(hsp_data) < 2:
                raise ValueError("At least 2 solvent tests are required")

            center = (center_d, center_p, center_h)

            solvents = []
            for _, row in hsp_data.iterrows():
                distance = self._calculate_hansen_distance(
                    (row['D'], row['P'], row['H']),
                    center
                )
                solvents.append({
                    'name': row['Chemical'],
                    'delta_d': row['D'],
                    'delta_p': row['P'],
                    'delta_h': row['H'],
                    'solubility': row['Data'],
                    'distance': distance
                })

            # Classify solvents
            good_solvents = [s for s in solvents if s['solubility'] == 1.0]
            poor_solvents = [s for s in solvents if s['solubility'] < 1.0]

            print(f"\nGood solvents (sol=1.0): {len(good_solvents)}")
            print(f"Poor solvents (sol<1.0): {len(poor_solvents)}")

            # Step 3: Calculate constraints
            print("\nStep 3: Calculate Ra constraints")

            if good_solvents:
                good_distances = [s['distance'] for s in good_solvents]
                Ra_min = max(good_distances)
                furthest_good = max(good_solvents, key=lambda x: x['distance'])
                print(f"Ra_min = {Ra_min:.4f} (furthest good: {furthest_good['name']})")
            else:
                Ra_min = 0.1
                furthest_good = None
                print(f"Ra_min = {Ra_min:.4f} (default, no good solvents)")

            if poor_solvents:
                poor_distances = [s['distance'] for s in poor_solvents]
                Ra_max = min(poor_distances)
                closest_poor = min(poor_solvents, key=lambda x: x['distance'])
                print(f"Ra_max = {Ra_max:.4f} (closest poor: {closest_poor['name']}, sol={closest_poor['solubility']})")
            else:
                Ra_max = float('inf')
                closest_poor = None
                print(f"Ra_max = inf (no poor solvents)")

            # Step 4: Optimize Ra (use minimum sphere covering all good solvents)
            print("\nStep 4: Optimize Ra (minimum sphere covering all good solvents)")

            cross_entropy_Ra = center_result.radius
            print(f"Reference: Cross Entropy Ra = {cross_entropy_Ra:.4f}")
            print(f"Ra_min (covers all good) = {Ra_min:.4f}")

            # Use Ra_min to minimize false positives
            # This ensures the smallest sphere that covers all soluble points
            Ra_optimal = Ra_min
            strategy = "ra_min_minimum_sphere"

            print(f"Strategy: Use Ra_min to minimize false positives")
            print(f"Final Ra_optimal = {Ra_optimal:.4f}")

            if cross_entropy_Ra > Ra_min:
                print(f"Note: Cross Entropy Ra is {cross_entropy_Ra - Ra_min:.4f} larger (may include more poor solvents)")

            # Check separation feasibility for reference
            feasible = Ra_min <= Ra_max
            if feasible:
                print(f"Note: Complete separation is possible (margin = {Ra_max - Ra_min:.4f})")
            else:
                print(f"Note: Complete separation not possible (overlap = {Ra_min - Ra_max:.4f})")

            # Step 5: Calculate final metrics
            print("\nStep 5: Calculate final metrics")

            correct = 0
            total = len(solvents)

            classification_details = []

            for s in solvents:
                RED = s['distance'] / Ra_optimal
                is_inside = RED < 1.0

                if s['solubility'] == 1.0:
                    # Good solvent
                    is_correct = is_inside
                else:
                    # Poor solvent
                    is_correct = not is_inside

                if is_correct:
                    correct += 1

                classification_details.append({
                    'name': s['name'],
                    'solubility': float(s['solubility']),
                    'distance': float(s['distance']),
                    'RED': float(RED),
                    'is_inside': bool(is_inside),
                    'is_correct': bool(is_correct)
                })

            fit = correct / total if total > 0 else 0.0

            print(f"FIT = {fit:.4f} ({correct}/{total} correct)")
            print(f"  = {fit*100:.1f}%")

            # Create result
            result = HSPCalculationResult(
                delta_d=center_d,
                delta_p=center_p,
                delta_h=center_h,
                radius=Ra_optimal,
                accuracy=fit,
                error=0.0,
                data_fit=fit,
                method="Cross Entropy → Ra Optimized (Cover All Soluble)",
                solvent_count=len(solvent_tests),
                good_solvents=len(good_solvents),
                calculation_details={
                    "optimization_method": "radius_only_minimum_sphere",
                    "base_center": "cross_entropy",
                    "classification_rule": "Ra = Ra_min (minimum sphere covering all good solvents)",
                    "strategy_used": strategy,
                    "radius_comparison": {
                        "cross_entropy_Ra": cross_entropy_Ra,
                        "Ra_min": Ra_min,
                        "Ra_optimal": Ra_optimal,
                        "difference": cross_entropy_Ra - Ra_min
                    },
                    "constraints": {
                        "Ra_min_required": Ra_min,
                        "Ra_max_allowed": Ra_max if Ra_max != float('inf') else None,
                        "feasible": feasible,
                        "margin": Ra_max - Ra_min if feasible and Ra_max != float('inf') else None,
                        "overlap": Ra_min - Ra_max if not feasible else None
                    },
                    "statistics": {
                        "total_solvents": total,
                        "good_solvents": len(good_solvents),
                        "poor_solvents": len(poor_solvents),
                        "correct_classifications": correct,
                        "incorrect_classifications": total - correct,
                        "FIT": fit
                    },
                    "boundary_info": {
                        "furthest_good": {
                            'name': furthest_good['name'],
                            'distance': furthest_good['distance']
                        } if furthest_good else None,
                        "closest_poor": {
                            'name': closest_poor['name'],
                            'distance': closest_poor['distance'],
                            'solubility': closest_poor['solubility']
                        } if closest_poor else None
                    },
                    "classification_details": classification_details
                }
            )

            print(f"\n[OK] Radius optimization completed")
            return result

        except Exception as e:
            print(f"Radius optimization error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _calculate_hansen_distance(self, point: Tuple[float, float, float], center: Tuple[float, float, float]) -> float:
        """
        Calculate Hansen distance (Ra) between two points in HSP space

        Hansen distance formula:
        Ra = √[4(ΔδD)² + (ΔδP)² + (ΔδH)²]

        Note: This calculates Ra (distance), not R0 (interaction radius).
        RED = Ra / R0 is used to determine solubility.
        """
        import math

        delta_D = point[0] - center[0]
        delta_P = point[1] - center[1]
        delta_H = point[2] - center[2]

        distance = math.sqrt(4 * delta_D**2 + delta_P**2 + delta_H**2)

        return distance

    def _optimize_radius_maximize_fit(
        self,
        Ra_min: float,
        Ra_max: float,
        good_solvents: List[Dict],
        poor_solvents: List[Dict]
    ) -> float:
        """
        Optimize R0 (interaction radius) to maximize FIT when complete separation is impossible

        Strategy:
        1. Search for R0 that maximizes FIT (correct classifications)
        2. If multiple R0 values have same FIT, choose the smallest (minimum sphere principle)

        Note: Parameter names Ra_min/Ra_max refer to R0 constraints (not Hansen distance).
        This follows the internal convention where 'radius' parameter represents R0.
        """

        import numpy as np

        print(f"\n  Searching optimal Ra in range [{Ra_max-1.0:.4f}, {Ra_min+1.0:.4f}]")

        # Search range
        epsilon = max(1.0, Ra_min - Ra_max)
        search_min = max(0.1, Ra_max - epsilon)
        search_max = Ra_min + epsilon

        # Grid search (0.01 step)
        best_Ra = Ra_min
        max_fit = 0.0

        Ra_values = np.arange(search_min, search_max + 0.01, 0.01)

        for Ra in Ra_values:
            # Count correct classifications
            correct = 0
            total = len(good_solvents) + len(poor_solvents)

            for s in good_solvents:
                RED = s['distance'] / Ra
                if RED < 1.0:  # Inside (correct)
                    correct += 1

            for s in poor_solvents:
                RED = s['distance'] / Ra
                if RED > 1.0:  # Outside (correct)
                    correct += 1

            fit = correct / total if total > 0 else 0.0

            if fit > max_fit:
                max_fit = fit
                best_Ra = Ra
            elif fit == max_fit and Ra < best_Ra:
                # Same FIT, prefer smaller Ra (minimum sphere principle)
                best_Ra = Ra

        print(f"  Max FIT = {max_fit:.4f} ({int(max_fit * (len(good_solvents) + len(poor_solvents)))}/{len(good_solvents) + len(poor_solvents)} correct)")
        print(f"  Best Ra = {best_Ra:.4f}")

        return best_Ra

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