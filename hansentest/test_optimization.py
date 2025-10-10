"""
Test HSPEstimator optimization with size_factor
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss

# Load data
df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print("=" * 80)
print("Testing HSPEstimator with size_factor=1.0 (debug mode)")
print("=" * 80)

est = HSPEstimator(
    n_spheres=1,
    loss=ContinuousHSPLoss(size_factor=1.0, debug=True),
    de_maxiter=500,  # Reduced for faster testing
    de_workers=1     # Single worker for clear debug output
)
est.fit(X, y)

hsp = est.hsp_[0]
print(f"\nResult: D={float(hsp[0]):.2f}, P={float(hsp[1]):.2f}, H={float(hsp[2]):.2f}, Ra={float(hsp[3]):.2f}")
print(f"Error: {est.error_:.6f}")
