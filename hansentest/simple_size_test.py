"""
Simple test to verify size_factor works
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss

# Load data
df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print("Test 1: size_factor=0.0")
print("=" * 60)
est1 = HSPEstimator(
    n_spheres=1,
    loss=ContinuousHSPLoss(size_factor=None),
    de_maxiter=1000,
    de_workers=1,
    de_init='random',  # Force different initialization
    de_popsize=20
)
est1.fit(X, y)
hsp1 = est1.hsp_[0]
print(f"D={float(hsp1[0]):.2f}, P={float(hsp1[1]):.2f}, H={float(hsp1[2]):.2f}, Ra={float(hsp1[3]):.2f}")
print(f"Error: {est1.error_:.6f}")

print("\nTest 2: size_factor=100.0 (very large penalty)")
print("=" * 60)
est2 = HSPEstimator(
    n_spheres=1,
    loss=ContinuousHSPLoss(size_factor=100.0),
    de_maxiter=1000,
    de_workers=1,
    de_init='random',  # Force different initialization
    de_popsize=20
)
est2.fit(X, y)
hsp2 = est2.hsp_[0]
print(f"D={float(hsp2[0]):.2f}, P={float(hsp2[1]):.2f}, H={float(hsp2[2]):.2f}, Ra={float(hsp2[3]):.2f}")
print(f"Error: {est2.error_:.6f}")

print("\n" + "=" * 60)
print("Comparison:")
print(f"  Radius change: {float(hsp1[3]):.2f} -> {float(hsp2[3]):.2f}")
print(f"  Difference: {float(hsp1[3]) - float(hsp2[3]):.2f} MPa^0.5")
