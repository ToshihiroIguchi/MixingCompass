#!/usr/bin/env python3
"""
Add common names from old_name to Solvent column
Extracts common names in parentheses from old_name and adds them to Solvent column
"""

import pandas as pd
import re
from pathlib import Path

def extract_common_name(old_name):
    """
    Extract common name from old_name if it contains parentheses with alphabetic content
    Returns the common name in parentheses, or None if not found
    """
    if pd.isna(old_name):
        return None

    # Match parentheses with content
    match = re.search(r'\(([^)]+)\)', old_name)
    if not match:
        return None

    content = match.group(1).strip()

    # Check if content is primarily alphabetic (common name, not chemical formula)
    # Chemical formulas typically have numbers, hyphens with numbers, etc.
    # Common names are primarily letters and spaces

    # Count alphabetic vs numeric characters
    alpha_count = sum(c.isalpha() or c.isspace() or c == '-' for c in content)
    digit_count = sum(c.isdigit() for c in content)

    # If it's mostly alphabetic (and has some letters), treat it as common name
    if alpha_count > digit_count and any(c.isalpha() for c in content):
        return content

    return None

def update_solvent_column(csv_file):
    """Update Solvent column with common names from old_name"""

    print(f"Reading {csv_file}...")
    df = pd.read_csv(csv_file)

    print(f"Total rows: {len(df)}")

    updated_count = 0

    for idx, row in df.iterrows():
        old_name = row.get('old_name')
        solvent = row.get('Solvent')

        # Extract common name from old_name
        common_name = extract_common_name(old_name)

        if common_name:
            # Check if Solvent already has parentheses
            if '(' not in str(solvent):
                # Add common name to Solvent
                new_solvent = f"{solvent} ({common_name})"
                df.at[idx, 'Solvent'] = new_solvent
                updated_count += 1
                print(f"Row {idx+2}: Updated '{solvent}' -> '{new_solvent}'")
            else:
                print(f"Row {idx+2}: Solvent already has parentheses, skipping")

    print(f"\nUpdated {updated_count} entries")

    # Save updated CSV
    df.to_csv(csv_file, index=False)
    print(f"Saved to {csv_file}")

def main():
    """Main entry point"""

    # Get script directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    # Define path
    csv_file = project_root / "data" / "original" / "solvents" / "JoshuaSchrier_Hansen-Solubility-Parameters.csv"

    print(f"Processing: {csv_file}")

    if not csv_file.exists():
        print(f"Error: File not found: {csv_file}")
        return

    # Update solvent column
    update_solvent_column(csv_file)

    print("\nCompleted!")

if __name__ == "__main__":
    main()
