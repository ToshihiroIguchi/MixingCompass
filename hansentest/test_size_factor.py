"""
Test size_factor implementation in ContinuousHSPLoss
"""
import pandas as pd
import numpy as np
from continuous_hsp_loss import ContinuousHSPLoss

# Load data
df = pd.read_csv('hansentest.csv')
X = df[['D', 'P', 'H']].values
y = df['Data'].values

# Test loss function with different size_factors
print("Testing ContinuousHSPLoss with different size_factors")
print("=" * 60)

# Sample HSP parameters
test_hsp = np.array([22.88, 13.04, 12.97, 16.13])  # [D, P, H, R]

for sf in [None, 0.0, 0.1, 0.5, 1.0, 2.0, 5.0]:
    loss_fn = ContinuousHSPLoss(size_factor=sf)
    loss = loss_fn(test_hsp, X, y)
    print(f"size_factor={sf}: loss={loss:.6f}")

print("\n" + "=" * 60)
print("Testing with smaller radius (R=10)")
print("=" * 60)

test_hsp_small = np.array([22.88, 13.04, 12.97, 10.0])  # [D, P, H, R]

for sf in [None, 0.0, 0.1, 0.5, 1.0, 2.0, 5.0]:
    loss_fn = ContinuousHSPLoss(size_factor=sf)
    loss = loss_fn(test_hsp_small, X, y)
    print(f"size_factor={sf}: loss={loss:.6f}")
