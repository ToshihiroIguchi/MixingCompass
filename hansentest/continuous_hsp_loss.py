"""
Custom loss function for HSPiPy to handle continuous solubility values (0.0-1.0)
without using inside_limit threshold.
"""
import numpy as np

def hansen_distance(X, center):
    """Calculate Hansen distance from center."""
    return np.sqrt(np.sum((X - center)**2, axis=1))


class ContinuousHSPLoss:
    """
    Custom loss function that treats y as continuous weights (0.0-1.0)
    instead of binary classification.

    Loss encourages:
    - High y values (good solvents) to be close to center
    - Low y values (poor solvents) to be far from center
    - Continuous gradient between 0 and 1
    """

    def __init__(self, size_factor=None, debug=False):
        self.size_factor = size_factor
        self.y = None
        self.debug = debug
        self.call_count = 0
    
    def __call__(self, HSP, X, y):
        """
        Calculate continuous loss.

        Parameters:
        - HSP: [D, P, H, R] - center coordinates and radius
        - X: (n_samples, 3) - solvent HSP coordinates
        - y: (n_samples,) - continuous solubility scores (0.0-1.0)

        Returns:
        - loss: float (lower is better)
        """
        self.y = y
        D, P, H, R = HSP
        center = np.array([D, P, H])

        # Calculate distances from center
        dist = hansen_distance(X, center)

        # Normalize distances by radius (RED = Relative Energy Difference)
        red = dist / R

        # Continuous loss based on weighted distance
        # For good solvents (y close to 1): penalize if RED > 1
        # For poor solvents (y close to 0): penalize if RED < 1

        # Method 1: Squared error weighted by solubility
        # If y=1 (good), want RED < 1, so penalty = y * max(0, RED - 1)^2
        # If y=0 (poor), want RED > 1, so penalty = (1-y) * max(0, 1 - RED)^2

        good_penalty = y * np.maximum(0, red - 1)**2
        poor_penalty = (1 - y) * np.maximum(0, 1 - red)**2

        # Total loss (mean penalty)
        base_loss = np.mean(good_penalty + poor_penalty)

        # Optional: add size penalty to avoid overly large spheres
        # Use quadratic penalty to strongly discourage large radii
        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            loss = base_loss + size_penalty

            if self.debug and self.call_count % 100 == 0:
                print(f"Call {self.call_count}: R={R:.2f}, base_loss={base_loss:.6f}, size_penalty={size_penalty:.6f}, total_loss={loss:.6f}")
        else:
            loss = base_loss

        self.call_count += 1
        return loss


class WeightedDistanceLoss:
    """
    Alternative: Weighted distance from ideal RED.
    
    - Good solvents (y=1.0) should have RED ≈ 0.5 (well inside)
    - Poor solvents (y=0.0) should have RED ≈ 2.0 (well outside)
    - Partial solvents (y=0.5) should have RED ≈ 1.0 (on boundary)
    """
    
    def __init__(self, size_factor=None):
        self.size_factor = size_factor
        self.y = None
    
    def __call__(self, HSP, X, y):
        self.y = y
        D, P, H, R = HSP
        center = np.array([D, P, H])
        
        dist = hansen_distance(X, center)
        red = dist / R
        
        # Target RED based on solubility score
        # y=1.0 -> target RED=0.5, y=0.5 -> target RED=1.0, y=0.0 -> target RED=2.0
        target_red = 2.0 - 1.5 * y
        
        # Squared error to target
        loss = np.mean((red - target_red)**2)
        
        if self.size_factor is not None:
            loss += self.size_factor * R
        
        return loss


# Example usage:
if __name__ == "__main__":
    from hspipy import HSPEstimator
    import pandas as pd
    
    # Load data
    df = pd.read_csv('hansentest.csv')
    X = df[['D', 'P', 'H']].values
    y = df['Data'].values
    
    print('=== Custom Continuous Loss Functions ===\n')
    
    # Test 1: ContinuousHSPLoss
    print('--- Test 1: ContinuousHSPLoss ---')
    est1 = HSPEstimator(
        n_spheres=1,
        loss=ContinuousHSPLoss(),
        de_maxiter=2000,
        de_workers=-1
    )
    est1.fit(X, y)
    hsp1 = est1.hsp_[0]
    print(f'HSP: D={float(hsp1[0]):.2f}, P={float(hsp1[1]):.2f}, H={float(hsp1[2]):.2f}, Ra={float(hsp1[3]):.2f}')
    print(f'Error: {est1.error_:.6f}')
    
    # Test 2: WeightedDistanceLoss
    print('\n--- Test 2: WeightedDistanceLoss ---')
    est2 = HSPEstimator(
        n_spheres=1,
        loss=WeightedDistanceLoss(),
        de_maxiter=2000,
        de_workers=-1
    )
    est2.fit(X, y)
    hsp2 = est2.hsp_[0]
    print(f'HSP: D={float(hsp2[0]):.2f}, P={float(hsp2[1]):.2f}, H={float(hsp2[2]):.2f}, Ra={float(hsp2[3]):.2f}')
    print(f'Error: {est2.error_:.6f}')
    
    # Compare with standard method
    print('\n--- Comparison: Standard (inside_limit=0.5) ---')
    est3 = HSPEstimator(n_spheres=1, inside_limit=0.5, de_maxiter=2000)
    est3.fit(X, y)
    hsp3 = est3.hsp_[0]
    print(f'HSP: D={float(hsp3[0]):.2f}, P={float(hsp3[1]):.2f}, H={float(hsp3[2]):.2f}, Ra={float(hsp3[3]):.2f}')
    print(f'Error: {est3.error_:.6f}')
