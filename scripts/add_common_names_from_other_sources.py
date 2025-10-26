#!/usr/bin/env python3
"""
Add common names to JoshuaSchrier CSV by finding them in other source files
"""

import pandas as pd
import re
from pathlib import Path
from typing import Dict, Set

def extract_base_name(name: str) -> str:
    """Extract base name without common name in parentheses"""
    match = re.match(r'^(.+?)\s*\([^)]+\)\s*$', name)
    if match:
        base = match.group(1).strip()
        if base:
            return base
    return name

def load_all_solvents(input_dir: Path) -> Dict[str, str]:
    """
    Load all solvent names from all CSV files
    Returns a dict mapping base_name_lower -> full_name_with_common_name
    Prioritizes entries that have common names in parentheses
    """
    solvent_mapping = {}

    for csv_file in input_dir.glob("*.csv"):
        # Skip list.csv and JoshuaSchrier (we'll update that one)
        if csv_file.name in ['list.csv', 'JoshuaSchrier_Hansen-Solubility-Parameters.csv']:
            continue

        try:
            df = pd.read_csv(csv_file, encoding='utf-8-sig')

            # Find solvent column (could be 'Solvent' or 'Solvents')
            solvent_col = None
            for col in df.columns:
                if col.lower() in ['solvent', 'solvents']:
                    solvent_col = col
                    break

            if not solvent_col:
                continue

            print(f"Processing {csv_file.name}...")

            for solvent_name in df[solvent_col].dropna():
                solvent_name = str(solvent_name).strip()

                if not solvent_name or solvent_name.lower() == 'nan':
                    continue

                base_name = extract_base_name(solvent_name)
                base_name_lower = base_name.lower()

                # If this entry has a common name in parentheses, use it
                if base_name != solvent_name:
                    # This has a common name
                    if base_name_lower not in solvent_mapping:
                        solvent_mapping[base_name_lower] = solvent_name
                        print(f"  Found: {base_name} -> {solvent_name}")
                    # If already exists, keep the first one found

        except Exception as e:
            print(f"Error processing {csv_file.name}: {e}")

    return solvent_mapping

def update_joshua_schrier(joshua_file: Path, solvent_mapping: Dict[str, str]):
    """Update JoshuaSchrier CSV with common names from other sources"""

    print(f"\nUpdating {joshua_file.name}...")
    df = pd.read_csv(joshua_file)

    updated_count = 0

    for idx, row in df.iterrows():
        solvent_name = str(row['Solvent']).strip()

        if not solvent_name or solvent_name.lower() == 'nan':
            continue

        # Check if this solvent already has a common name
        base_name = extract_base_name(solvent_name)
        if base_name != solvent_name:
            # Already has a common name, skip
            continue

        # Check if we have a common name for this solvent from other sources (case-insensitive)
        base_name_lower = base_name.lower()
        if base_name_lower in solvent_mapping:
            new_name = solvent_mapping[base_name_lower]
            df.at[idx, 'Solvent'] = new_name
            updated_count += 1
            print(f"  Row {idx+2}: '{solvent_name}' -> '{new_name}'")

    print(f"\nUpdated {updated_count} entries")

    # Save updated CSV
    df.to_csv(joshua_file, index=False)
    print(f"Saved to {joshua_file}")

def main():
    """Main entry point"""

    # Get paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_dir = project_root / "data" / "original" / "solvents"
    joshua_file = input_dir / "JoshuaSchrier_Hansen-Solubility-Parameters.csv"

    print("Step 1: Finding common names from other source files...")
    solvent_mapping = load_all_solvents(input_dir)

    print(f"\nFound {len(solvent_mapping)} solvents with common names")

    print("\nStep 2: Updating JoshuaSchrier CSV...")
    update_joshua_schrier(joshua_file, solvent_mapping)

    print("\nCompleted!")

if __name__ == "__main__":
    main()
