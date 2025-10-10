"""
Alternative custom loss functions for HSP calculation
"""
import numpy as np


def hansen_distance(X, center):
    """Calculate Hansen distance from center."""
    return np.sqrt(np.sum((X - center)**2, axis=1))


class ExponentialLoss:
    """
    Exponential penalty loss: Stronger penalty for severe violations

    Uses exponential weighting to heavily penalize:
    - Good solvents far outside the sphere
    - Poor solvents deep inside the sphere
    """

    def __init__(self, size_factor=None, penalty_strength=2.0):
        """
        Parameters:
        - size_factor: Penalty for large radius
        - penalty_strength: Exponential penalty strength (higher = stronger)
        """
        self.size_factor = size_factor
        self.penalty_strength = penalty_strength

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Exponential penalties
        # Good solvents (y=1): exponentially penalize RED > 1
        good_violation = np.maximum(0, red - 1)
        good_penalty = y * (np.exp(self.penalty_strength * good_violation) - 1)

        # Poor solvents (y=0): exponentially penalize RED < 1
        poor_violation = np.maximum(0, 1 - red)
        poor_penalty = (1 - y) * (np.exp(self.penalty_strength * poor_violation) - 1)

        base_loss = np.mean(good_penalty + poor_penalty)

        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class AdaptiveWeightLoss:
    """
    Adaptive weight loss: Weights penalties by distance from ideal

    Gives higher weight to samples that are clearly misclassified
    """

    def __init__(self, size_factor=None):
        self.size_factor = size_factor

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Define ideal RED for each y value
        # y=1.0 -> ideal RED = 0.5 (well inside)
        # y=0.5 -> ideal RED = 1.0 (on boundary)
        # y=0.0 -> ideal RED = 1.5 (well outside)
        ideal_red = np.where(y >= 0.5,
                             0.5,  # good/partial solvents
                             1.5)  # poor solvents

        # Special handling for y=0.5 (boundary solvents)
        ideal_red = np.where(y == 0.5, 1.0, ideal_red)

        # Squared error with adaptive weighting
        error = (red - ideal_red) ** 2

        # Weight errors more if they're severe violations
        weights = np.where(y >= 0.5,
                          1 + 2 * np.maximum(0, red - 1),  # good: weight increases if outside
                          1 + 2 * np.maximum(0, 1 - red))  # poor: weight increases if inside

        base_loss = np.mean(weights * error)

        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class HuberLoss:
    """
    Huber loss: Combines L2 (quadratic) for small errors and L1 (linear) for large errors

    More robust to outliers than pure quadratic loss.
    Good for datasets with some noisy/uncertain measurements.
    """

    def __init__(self, size_factor=None, delta=0.5):
        """
        Parameters:
        - size_factor: Penalty for large radius
        - delta: Threshold for switching from L2 to L1 (smaller = more robust)
        """
        self.size_factor = size_factor
        self.delta = delta

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Target RED based on y
        target_red = np.where(y >= 0.5, 0.5, 1.5)
        target_red = np.where(y == 0.5, 1.0, target_red)

        # Huber loss
        error = np.abs(red - target_red)
        huber = np.where(error <= self.delta,
                        0.5 * error**2,  # Quadratic for small errors
                        self.delta * (error - 0.5 * self.delta))  # Linear for large errors

        base_loss = np.mean(huber)

        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class LogCoshLoss:
    """
    Log-Cosh loss: log(cosh(error))

    Smooth approximation to L1 loss that is twice differentiable.
    More robust than L2, smoother than L1.
    """

    def __init__(self, size_factor=None):
        self.size_factor = size_factor

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Target RED based on y
        target_red = np.where(y >= 0.5, 0.5, 1.5)
        target_red = np.where(y == 0.5, 1.0, target_red)

        # Log-cosh loss
        error = red - target_red
        base_loss = np.mean(np.log(np.cosh(error)))

        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class QuantileLoss:
    """
    Quantile loss (asymmetric loss): Different penalties for over/under prediction

    Useful when you want to be more conservative (e.g., prefer excluding borderline
    good solvents rather than including borderline poor solvents).
    """

    def __init__(self, size_factor=None, quantile=0.5):
        """
        Parameters:
        - size_factor: Penalty for large radius
        - quantile: 0.5 = symmetric, >0.5 = penalize under-prediction more
        """
        self.size_factor = size_factor
        self.quantile = quantile

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # For good solvents: penalize being outside (RED > 1)
        # For poor solvents: penalize being inside (RED < 1)

        good_error = red - 1  # Positive if outside
        poor_error = 1 - red  # Positive if inside

        # Asymmetric quantile loss
        good_penalty = y * np.where(good_error > 0,
                                   self.quantile * good_error,
                                   (1 - self.quantile) * (-good_error))

        poor_penalty = (1 - y) * np.where(poor_error > 0,
                                         self.quantile * poor_error,
                                         (1 - self.quantile) * (-poor_error))

        base_loss = np.mean(good_penalty + poor_penalty)

        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class HingeLoss:
    """
    Hinge loss: SVM-style margin-based loss

    Creates a "margin" around RED=1 boundary.
    Only penalizes violations beyond the margin.
    """

    def __init__(self, size_factor=None, margin=0.1):
        """
        Parameters:
        - size_factor: Penalty for large radius
        - margin: Safety margin around RED=1 (larger = more tolerant)
        """
        self.size_factor = size_factor
        self.margin = margin

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Hinge loss with margin
        # Good solvents: want RED < 1-margin
        good_penalty = y * np.maximum(0, red - (1 - self.margin))

        # Poor solvents: want RED > 1+margin
        poor_penalty = (1 - y) * np.maximum(0, (1 + self.margin) - red)

        base_loss = np.mean(good_penalty + poor_penalty)

        if self.size_factor is not None:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss
