"""
Debug: Check if loss function is actually being called differently
"""
import pandas as pd
import numpy as np
from hspipy import HSPEstimator
from continuous_hsp_loss import ContinuousHSPLoss

# Load data
df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

print("Creating two different loss functions...")
loss1 = ContinuousHSPLoss(size_factor=None, debug=True)
loss2 = ContinuousHSPLoss(size_factor=100.0, debug=True)

print("\nTest 1: size_factor=None")
print("=" * 60)
est1 = HSPEstimator(
    n_spheres=1,
    loss=loss1,
    de_maxiter=200,
    de_workers=1
)
est1.fit(X, y)
print(f"\nLoss1 was called {loss1.call_count} times")
hsp1 = est1.hsp_[0]
print(f"Result: D={float(hsp1[0]):.2f}, P={float(hsp1[1]):.2f}, H={float(hsp1[2]):.2f}, Ra={float(hsp1[3]):.2f}")
print(f"Error: {est1.error_:.6f}")

print("\n\nTest 2: size_factor=100.0")
print("=" * 60)
est2 = HSPEstimator(
    n_spheres=1,
    loss=loss2,
    de_maxiter=200,
    de_workers=1
)
est2.fit(X, y)
print(f"\nLoss2 was called {loss2.call_count} times")
hsp2 = est2.hsp_[0]
print(f"Result: D={float(hsp2[0]):.2f}, P={float(hsp2[1]):.2f}, H={float(hsp2[2]):.2f}, Ra={float(hsp2[3]):.2f}")
print(f"Error: {est2.error_:.6f}")

print("\n" + "=" * 60)
print("Direct loss comparison with same HSP parameters:")
print("=" * 60)
test_hsp = np.array([22.88, 13.04, 12.97, 16.13])
loss_val1 = loss1(test_hsp, X, y)
loss_val2 = loss2(test_hsp, X, y)
print(f"Loss1 (size_factor=None):  {loss_val1:.6f}")
print(f"Loss2 (size_factor=100.0): {loss_val2:.6f}")
print(f"Difference: {loss_val2 - loss_val1:.6f}")
