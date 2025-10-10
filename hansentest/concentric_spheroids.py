"""
Concentric Spheroids Method for Hansen Solubility Parameters
Based on: Mihalovits, M. (2022). Journal of Molecular Liquids 364, 119911.
"""

import pandas as pd
import numpy as np
from scipy.optimize import differential_evolution
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D


class ConcentricSpheroidsHSP:
    """
    Hansen Solubility Parameters calculation using Concentric Spheroids Method

    Theory:
    -------
    The distance between two points in Hansen space is:
    Ra = √[4(δD1 - δD2)² + (δP1 - δP2)² + (δH1 - δH2)²]

    The objective function to minimize is:
    F(δD, δP, δH, R1, R2, ..., Rm) = Σ(j=1 to m) Σ(i=1 to n) [Rj - Raji]²

    where:
    - m: number of concentric spheroids
    - n: number of points on each spheroid
    - Rj: radius of jth spheroid
    - Raji: distance from center to ith point of jth system
    """

    def __init__(self):
        self.result = None

    def calculate_distance(self, delta_d1, delta_p1, delta_h1,
                          delta_d2, delta_p2, delta_h2):
        """
        Calculate Ra distance in Hansen space (Eq. 3)

        Ra = √[4(δD1 - δD2)² + (δP1 - δP2)² + (δH1 - δH2)²]

        The factor of 4 for the dispersion term accounts for the
        ellipsoidal shape of Hansen spheroids.
        """
        return np.sqrt(
            4 * (delta_d1 - delta_d2)**2 +
            (delta_p1 - delta_p2)**2 +
            (delta_h1 - delta_h2)**2
        )

    def objective_function(self, params, hsp_data_by_level):
        """
        Objective function to minimize (Eq. 14)

        F = Σ(j=1 to m) Σ(i=1 to n) [Rj - Raji]²

        Parameters:
        -----------
        params : array
            [δD_center, δP_center, δH_center, R1, R2, ..., Rm]
        hsp_data_by_level : list of DataFrames
            Each DataFrame contains HSP points at a given solubility level
        """
        delta_d_center = params[0]
        delta_p_center = params[1]
        delta_h_center = params[2]
        radii = params[3:]  # R1, R2, ..., Rm

        F = 0.0

        for j, (radius, df) in enumerate(zip(radii, hsp_data_by_level)):
            for i, row in df.iterrows():
                # Calculate distance from center to this point
                ra_ji = self.calculate_distance(
                    delta_d_center, delta_p_center, delta_h_center,
                    row['D'], row['P'], row['H']
                )

                # Add squared residual
                F += (radius - ra_ji)**2

        return F

    def calculate_mse(self, F_value, hsp_data_by_level, m):
        """
        Calculate Mean Square Error (Eq. 15)

        MSE = F / df
        where df = Σ(nj) - m (degrees of freedom)
        """
        total_points = sum(len(df) for df in hsp_data_by_level)
        df = total_points - m

        if df <= 0:
            return np.inf

        return F_value / df

    def fit(self, hsp_data_by_level, bounds=None):
        """
        Fit concentric spheroids to data

        Parameters:
        -----------
        hsp_data_by_level : list of DataFrames
            Each DataFrame should have columns ['D', 'P', 'H']
            representing HSP points at a given solubility level
        bounds : list of tuples, optional
            Bounds for optimization
            Default: [(10, 25), (0, 20), (0, 30), (0, 20), ...]

        Returns:
        --------
        result : dict
            Contains:
            - delta_d: δD of solute
            - delta_p: δP of solute
            - delta_h: δH of solute
            - radii: [R1, R2, ..., Rm]
            - F: objective function value
            - MSE: mean square error
            - m: number of spheroids
        """
        m = len(hsp_data_by_level)  # Number of concentric spheroids

        # Set default bounds if not provided
        if bounds is None:
            bounds = [
                (10, 25),  # δD
                (0, 20),   # δP
                (0, 30),   # δH
            ] + [(0, 20) for _ in range(m)]  # R1, R2, ..., Rm

        # Use differential evolution for global optimization
        result = differential_evolution(
            self.objective_function,
            bounds,
            args=(hsp_data_by_level,),
            seed=42,
            maxiter=2000,
            popsize=15,
            tol=1e-6
        )

        delta_d = result.x[0]
        delta_p = result.x[1]
        delta_h = result.x[2]
        radii = result.x[3:]
        F_value = result.fun

        mse = self.calculate_mse(F_value, hsp_data_by_level, m)

        self.result = {
            'delta_d': delta_d,
            'delta_p': delta_p,
            'delta_h': delta_h,
            'radii': radii.tolist(),
            'F': F_value,
            'MSE': mse,
            'm': m,
            'n_points': sum(len(df) for df in hsp_data_by_level),
            'success': result.success,
            'message': result.message
        }

        return self.result

    def plot_results(self, hsp_data_by_level, save_path=None):
        """
        Visualize the fitted concentric spheroids in 3D Hansen space
        """
        if self.result is None:
            raise ValueError("No results to plot. Run fit() first.")

        fig = plt.figure(figsize=(12, 10))
        ax = fig.add_subplot(111, projection='3d')

        delta_d = self.result['delta_d']
        delta_p = self.result['delta_p']
        delta_h = self.result['delta_h']
        radii = self.result['radii']

        # Plot center point
        ax.scatter([delta_d], [delta_p], [delta_h],
                  c='red', s=200, marker='*',
                  label=f'Center (δD={delta_d:.1f}, δP={delta_p:.1f}, δH={delta_h:.1f})')

        # Plot data points at each level
        colors = plt.cm.viridis(np.linspace(0, 1, len(hsp_data_by_level)))

        for i, (df, color, radius) in enumerate(zip(hsp_data_by_level, colors, radii)):
            ax.scatter(df['D'], df['P'], df['H'],
                      c=[color], s=100, alpha=0.6,
                      label=f'Level {i+1} (R={radius:.2f})')

        # Draw spheroids (simplified as spheres for visualization)
        u = np.linspace(0, 2 * np.pi, 20)
        v = np.linspace(0, np.pi, 20)

        for radius, alpha_val in zip(radii, np.linspace(0.1, 0.3, len(radii))):
            # For proper spheroid, x-radius is half of y and z radii
            x_radius = radius / 2
            y_radius = radius
            z_radius = radius

            x_sphere = delta_d + x_radius * np.outer(np.cos(u), np.sin(v))
            y_sphere = delta_p + y_radius * np.outer(np.sin(u), np.sin(v))
            z_sphere = delta_h + z_radius * np.outer(np.ones(np.size(u)), np.cos(v))

            ax.plot_surface(x_sphere, y_sphere, z_sphere,
                           alpha=alpha_val, color='gray')

        ax.set_xlabel('δD (MPa^0.5)')
        ax.set_ylabel('δP (MPa^0.5)')
        ax.set_zlabel('δH (MPa^0.5)')
        ax.set_title('Concentric Spheroids Method - Hansen Space')
        ax.legend()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        plt.show()

    def print_results(self):
        """
        Print detailed results
        """
        if self.result is None:
            print("No results available. Run fit() first.")
            return

        print("=" * 80)
        print("CONCENTRIC SPHEROIDS METHOD - RESULTS")
        print("=" * 80)
        print(f"\nHansen Solubility Parameters of Solute:")
        print(f"  δD (Dispersion):     {self.result['delta_d']:.2f} MPa^0.5")
        print(f"  δP (Polar):          {self.result['delta_p']:.2f} MPa^0.5")
        print(f"  δH (Hydrogen bond):  {self.result['delta_h']:.2f} MPa^0.5")

        print(f"\nSpheroid Radii:")
        for i, r in enumerate(self.result['radii'], 1):
            print(f"  R{i}: {r:.2f} MPa^0.5")

        print(f"\nFit Quality:")
        print(f"  Objective Function (F): {self.result['F']:.4f}")
        print(f"  Mean Square Error (MSE): {self.result['MSE']:.4f}")
        print(f"  Number of spheroids (m): {self.result['m']}")
        print(f"  Total data points: {self.result['n_points']}")
        print(f"  Degrees of freedom: {self.result['n_points'] - self.result['m']}")

        print(f"\nOptimization Status:")
        print(f"  Success: {self.result['success']}")
        print(f"  Message: {self.result['message']}")
        print("=" * 80)


def prepare_data_from_csv(csv_path, solubility_levels):
    """
    Prepare data for concentric spheroids method

    Parameters:
    -----------
    csv_path : str
        Path to CSV file with columns: Chemical, D, P, H, Data
    solubility_levels : list of float
        Solubility levels at which to extract spheroid surfaces
        (Only Data=1.0 and Data=0.5 will be selected based on levels)

    Returns:
    --------
    hsp_data_by_level : list of DataFrames
        Each DataFrame contains HSP points at a given solubility level
    """
    df = pd.read_csv(csv_path)

    # For binary classification data, we group by Data value
    hsp_data_by_level = []

    for level in solubility_levels:
        level_df = df[df['Data'] == level][['D', 'P', 'H']].copy()
        if len(level_df) > 0:
            hsp_data_by_level.append(level_df)

    return hsp_data_by_level


if __name__ == "__main__":
    # Example usage
    csv_path = "hansentest.csv"

    print("Loading data from:", csv_path)
    df = pd.read_csv(csv_path)
    print(f"\nData shape: {df.shape}")
    print(f"\nData value distribution:")
    print(df['Data'].value_counts().sort_index())

    # For the concentric spheroids method with binary/discrete data,
    # we can treat different Data values as different "solubility levels"
    # Data=1.0: Good solvents
    # Data=0.5: Partial solvents
    # Data=0.0: Poor solvents

    # We'll create spheroids for Good and Partial separately
    solubility_levels = [1.0, 0.5]

    hsp_data_by_level = prepare_data_from_csv(csv_path, solubility_levels)

    print(f"\nPrepared {len(hsp_data_by_level)} solubility levels:")
    for i, df_level in enumerate(hsp_data_by_level):
        print(f"  Level {i+1}: {len(df_level)} points")

    # Initialize and fit
    model = ConcentricSpheroidsHSP()
    result = model.fit(hsp_data_by_level)

    # Print results
    model.print_results()

    # Plot results
    model.plot_results(hsp_data_by_level, save_path='concentric_spheroids_result.png')
