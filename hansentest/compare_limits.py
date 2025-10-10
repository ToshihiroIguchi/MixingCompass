"""
Compare inside_limit=0.9 vs inside_limit=1.0 to understand the difference
"""

import pandas as pd
import numpy as np
from hspipy import HSPEstimator

# Load solvent test data
df = pd.read_csv('hansentest.csv')

X = df[['D', 'P', 'H']].to_numpy()
y = df['Data'].to_numpy()

print("=" * 80)
print("Comparing inside_limit behavior")
print("=" * 80)

# Show data distribution
print("\nData value distribution:")
print(f"  Data=0.0: {len(df[df['Data'] == 0.0])} solvents")
print(f"  Data=0.5: {len(df[df['Data'] == 0.5])} solvents")
print(f"  Data=1.0: {len(df[df['Data'] == 1.0])} solvents")

print("\n" + "=" * 80)
print("Test 1: inside_limit=1.0 (default)")
print("=" * 80)
print("According to docs: 0 < y <= 1.0 → inside")
print("Expected: Data=0.5 and Data=1.0 → inside, Data=0.0 → outside")

est1 = HSPEstimator(inside_limit=1.0, n_spheres=1)
est1.fit(X, y)

print(f"\nResult: δD={est1.hsp_[0][0]:.2f}, δP={est1.hsp_[0][1]:.2f}, δH={est1.hsp_[0][2]:.2f}, Ra={est1.hsp_[0][3]:.2f}")
print(f"Accuracy: {est1.score(X, y):.4f}")

print("\n" + "=" * 80)
print("Test 2: inside_limit=0.9")
print("=" * 80)
print("According to docs: 0 < y <= 0.9 → inside")
print("Expected: Data=0.5 → inside, Data=1.0 and Data=0.0 → outside")

est2 = HSPEstimator(inside_limit=0.9, n_spheres=1)
est2.fit(X, y)

print(f"\nResult: δD={est2.hsp_[0][0]:.2f}, δP={est2.hsp_[0][1]:.2f}, δH={est2.hsp_[0][2]:.2f}, Ra={est2.hsp_[0][3]:.2f}")
print(f"Accuracy: {est2.score(X, y):.4f}")

# Count how many solvents should be inside for each case
print("\n" + "=" * 80)
print("Analysis:")
print("=" * 80)

print("\nWith inside_limit=1.0:")
count_inside = len(df[(df['Data'] > 0) & (df['Data'] <= 1.0)])
count_outside = len(df[(df['Data'] == 0) | (df['Data'] > 1.0)])
print(f"  Should be inside: {count_inside} solvents (Data=0.5 and Data=1.0)")
print(f"  Should be outside: {count_outside} solvents (Data=0.0)")

print("\nWith inside_limit=0.9:")
count_inside = len(df[(df['Data'] > 0) & (df['Data'] <= 0.9)])
count_outside = len(df[(df['Data'] == 0) | (df['Data'] > 0.9)])
print(f"  Should be inside: {count_inside} solvents (Data=0.5)")
print(f"  Should be outside: {count_outside} solvents (Data=0.0 and Data=1.0)")

# List which solvents would be affected
print("\nSolvents that change classification:")
print("  inside_limit=1.0 → inside, but inside_limit=0.9 → outside:")
affected = df[df['Data'] == 1.0]
for idx, row in affected.iterrows():
    print(f"    - {row['Chemical']}")

print("\n" + "=" * 80)
