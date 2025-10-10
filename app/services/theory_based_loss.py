"""
Theory-based loss functions with NO arbitrary parameters
All based purely on Hansen solubility theory (RED=1 boundary)
"""
import numpy as np


def hansen_distance(X, center):
    """Calculate Hansen distance from center."""
    return np.sqrt(np.sum((X - center)**2, axis=1))


class BoundaryDistanceLoss:
    """
    Pure boundary distance loss - NO arbitrary parameters

    Theory:
    - Hansen theory defines RED=1 as the solubility boundary
    - Good solvents should be inside (RED < 1)
    - Poor solvents should be outside (RED > 1)
    - Partial solvents should be ON the boundary (RED ≈ 1)

    Loss = distance from ideal position on/around the boundary
    - For y=1.0: loss = distance from boundary inward = max(0, RED-1)
    - For y=0.0: loss = distance from boundary outward = max(0, 1-RED)
    - For y=0.5: loss = distance from boundary = |RED-1|

    This is pure L1 distance to the theoretically correct region.
    """

    def __init__(self, size_factor=None):
        self.size_factor = size_factor

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Distance from theoretically correct position
        loss_per_sample = np.zeros(len(y))

        for i in range(len(y)):
            if y[i] == 1.0:  # Good: should be inside (RED < 1)
                loss_per_sample[i] = np.maximum(0, red[i] - 1)
            elif y[i] == 0.0:  # Poor: should be outside (RED > 1)
                loss_per_sample[i] = np.maximum(0, 1 - red[i])
            else:  # Partial (0.5): should be on boundary (RED = 1)
                loss_per_sample[i] = np.abs(red[i] - 1)

        base_loss = np.mean(loss_per_sample)

        if self.size_factor is not None and self.size_factor > 0:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class ProportionalBoundaryLoss:
    """
    Proportional boundary loss - NO arbitrary parameters

    Theory:
    - y values represent solubility level: 0.0 (poor), 0.5 (partial), 1.0 (good)
    - Use y directly as weight for boundary-based penalties
    - Good solvents (high y): penalize being outside
    - Poor solvents (low y): penalize being inside

    Loss = y × penalty_outside + (1-y) × penalty_inside

    where:
    - penalty_outside = max(0, RED-1)  # how far outside boundary
    - penalty_inside = max(0, 1-RED)   # how far inside boundary

    No arbitrary parameters - uses y values directly as natural weights.
    Can handle ANY y value (not just 0.0, 0.5, 1.0) continuously.
    """

    def __init__(self, size_factor=None):
        self.size_factor = size_factor

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Boundary violations
        penalty_outside = np.maximum(0, red - 1)  # RED > 1
        penalty_inside = np.maximum(0, 1 - red)   # RED < 1

        # Weight by solubility score (no arbitrary parameters)
        loss_per_sample = y * penalty_outside + (1 - y) * penalty_inside

        base_loss = np.mean(loss_per_sample)

        if self.size_factor is not None and self.size_factor > 0:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class LogBarrierLoss:
    """
    Logarithmic barrier loss - NO arbitrary parameters

    Theory:
    - Uses logarithmic barrier to enforce RED constraints
    - Good solvents: -log(1 - RED) pushes RED < 1
    - Poor solvents: -log(RED - 1) pushes RED > 1
    - Partial solvents: symmetric barrier around RED=1

    This is a standard optimization technique (interior point method)
    with natural mathematical form, no arbitrary constants.

    Note: Requires small epsilon to avoid log(0)
    """

    def __init__(self, size_factor=None, epsilon=1e-6):
        self.size_factor = size_factor
        self.epsilon = epsilon  # Technical parameter to avoid log(0), not arbitrary

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        loss_per_sample = np.zeros(len(y))

        for i in range(len(y)):
            if y[i] == 1.0:  # Good: enforce RED < 1
                if red[i] < 1 - self.epsilon:
                    loss_per_sample[i] = -np.log(1 - red[i] + self.epsilon)
                else:
                    # Heavy penalty if constraint violated
                    loss_per_sample[i] = 10.0 * (red[i] - 1 + self.epsilon)

            elif y[i] == 0.0:  # Poor: enforce RED > 1
                if red[i] > 1 + self.epsilon:
                    loss_per_sample[i] = -np.log(red[i] - 1 + self.epsilon)
                else:
                    # Heavy penalty if constraint violated
                    loss_per_sample[i] = 10.0 * (1 + self.epsilon - red[i])

            else:  # Partial: minimize distance from boundary
                loss_per_sample[i] = np.abs(red[i] - 1)

        base_loss = np.mean(loss_per_sample)

        if self.size_factor is not None and self.size_factor > 0:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class NormalizedDistanceLoss:
    """
    Normalized distance loss - NO arbitrary parameters

    Theory:
    - Use RED itself as the natural normalized distance
    - Good solvents: minimize RED (want RED → 0)
    - Poor solvents: maximize RED (want RED → ∞, but penalize 1/RED → 0)
    - Partial solvents: minimize |RED - 1|

    Loss formulation:
    - For y=1.0: loss = RED (want small RED)
    - For y=0.0: loss = 1/RED (want large RED, so small 1/RED)
    - For y=0.5: loss = |RED - 1| (want RED = 1)

    Pure mathematical form using only the natural RED metric.
    """

    def __init__(self, size_factor=None):
        self.size_factor = size_factor

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        loss_per_sample = np.zeros(len(y))

        for i in range(len(y)):
            if y[i] == 1.0:  # Good: minimize RED
                loss_per_sample[i] = red[i]
            elif y[i] == 0.0:  # Poor: maximize RED (minimize 1/RED)
                loss_per_sample[i] = 1.0 / (red[i] + 1e-6)
            else:  # Partial: RED should be 1
                loss_per_sample[i] = np.abs(red[i] - 1)

        base_loss = np.mean(loss_per_sample)

        if self.size_factor is not None and self.size_factor > 0:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


class CrossEntropyStyleLoss:
    """
    Cross-entropy inspired loss - NO arbitrary parameters

    Theory:
    - Treat RED as a probability-like quantity via sigmoid
    - p(soluble) = 1 / (1 + RED²)
    - This naturally maps:
      - RED=0 → p=1 (definitely soluble)
      - RED=1 → p=0.5 (boundary, 50/50)
      - RED→∞ → p=0 (definitely insoluble)

    Loss = cross-entropy between predicted p(soluble) and actual y:
    - loss = -[y·log(p) + (1-y)·log(1-p)]

    Pure information-theoretic formulation with natural mapping.
    Uses RED² in sigmoid for symmetry in Hansen space.
    Can handle ANY y value (not just 0.0, 0.5, 1.0) continuously.
    """

    def __init__(self, size_factor=None):
        self.size_factor = size_factor

    def __call__(self, HSP, X, y):
        D, P, H, R = HSP
        center = np.array([D, P, H])

        dist = hansen_distance(X, center)
        red = dist / R

        # Map RED to probability of being soluble
        # p(soluble) = 1 / (1 + RED²)
        p_soluble = 1.0 / (1.0 + red**2)

        # Clip to avoid log(0)
        epsilon = 1e-7
        p_soluble = np.clip(p_soluble, epsilon, 1 - epsilon)

        # Cross-entropy loss
        loss_per_sample = -(y * np.log(p_soluble) + (1 - y) * np.log(1 - p_soluble))

        base_loss = np.mean(loss_per_sample)

        if self.size_factor is not None and self.size_factor > 0:
            size_penalty = self.size_factor * (R ** 2)
            return base_loss + size_penalty

        return base_loss


# Available loss functions
LOSS_FUNCTIONS = {
    'boundary_distance': BoundaryDistanceLoss,
    'proportional_boundary': ProportionalBoundaryLoss,
    'log_barrier': LogBarrierLoss,
    'normalized_distance': NormalizedDistanceLoss,
    'cross_entropy': CrossEntropyStyleLoss,
}


def get_loss_function(name: str, size_factor=None):
    """
    Get loss function by name

    Args:
        name: Loss function name
        size_factor: Size penalty factor (default: None)

    Returns:
        Loss function instance

    Available loss functions:
    - 'boundary_distance': Pure L1 boundary distance (default, recommended for accuracy)
    - 'proportional_boundary': y-weighted boundary penalties (recommended for continuous values)
    - 'log_barrier': Logarithmic barrier method
    - 'normalized_distance': Direct RED optimization
    - 'cross_entropy': Information-theoretic approach (recommended for continuous values)
    """
    if name not in LOSS_FUNCTIONS:
        raise ValueError(
            f"Unknown loss function: {name}. "
            f"Available: {', '.join(LOSS_FUNCTIONS.keys())}"
        )

    return LOSS_FUNCTIONS[name](size_factor=size_factor)
