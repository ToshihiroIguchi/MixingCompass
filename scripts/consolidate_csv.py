#!/usr/bin/env python3
"""
CSV Consolidation Script for MixingCompass
Consolidates multiple CSV files with data richness priority handling for duplicates.
"""

import pandas as pd
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class CSVConsolidator:
    """Consolidates multiple CSV files with intelligent duplicate handling"""

    def __init__(self, input_dir: str, output_file: str):
        self.input_dir = Path(input_dir)
        self.output_file = Path(output_file)
        self.consolidated_data = []
        self.duplicate_stats = {}

    def load_csv_files(self) -> Dict[str, pd.DataFrame]:
        """Load all CSV files from input directory"""
        csv_files = {}

        for csv_file in self.input_dir.glob("*.csv"):
            try:
                df = pd.read_csv(csv_file, encoding='utf-8-sig')
                csv_files[csv_file.stem] = df
                logger.info(f"Loaded {csv_file.name}: {len(df)} rows, {len(df.columns)} columns")
            except Exception as e:
                logger.error(f"Error loading {csv_file.name}: {e}")

        return csv_files

    def normalize_column_names(self, df: pd.DataFrame, file_name: str) -> pd.DataFrame:
        """Normalize column names to standard format"""
        df = df.copy()

        # Column mapping for different files
        column_mapping = {
            # Common mappings
            'Solvents': 'Solvent',
            'dD': 'delta_D',
            'dP': 'delta_P',
            'dH': 'delta_H',
            'δt': 'delta_total',
            'Volume': 'MVol',
            'MWt (g/mol)': 'MWt',
            'MVol (cm³/mol)': 'MVol',
            'Tv     (°C)': 'Tv',
            'Pv  (hPa)': 'Pv',
            'Density     (g/cm³)': 'Density',
            'Cost      (€/mL)': 'Cost'
        }

        # Apply mappings
        df.columns = [column_mapping.get(col, col) for col in df.columns]

        # Ensure essential columns exist
        essential_columns = ['Solvent', 'delta_D', 'delta_P', 'delta_H']
        for col in essential_columns:
            if col not in df.columns:
                logger.warning(f"Missing essential column '{col}' in {file_name}")

        return df

    def calculate_priority_score(self, file_name: str, row_index: int,
                               total_rows: int, completeness_ratio: float) -> int:
        """Calculate priority score for duplicate resolution"""

        # File priority weights (higher = better)
        file_weights = {
            'JoshuaSchrier_Hansen-Solubility-Parameters': 3000,
            'HSP_Calculations': 2000,
            'Solvent List for calc': 1000
        }

        # Get base file weight
        base_weight = file_weights.get(file_name, 500)

        # Row position bonus (earlier rows get higher priority)
        position_bonus = total_rows - row_index

        # Data completeness bonus
        completeness_bonus = int(completeness_ratio * 100)

        # File size bonus (more data = higher priority)
        size_bonus = total_rows * 10

        total_score = base_weight + position_bonus + completeness_bonus + size_bonus

        return total_score

    def calculate_completeness(self, row: pd.Series, essential_cols: List[str]) -> float:
        """Calculate data completeness ratio for a row"""
        if not essential_cols:
            return 1.0

        non_null_count = sum(1 for col in essential_cols if col in row.index and pd.notna(row[col]))
        return non_null_count / len(essential_cols)

    def consolidate_files(self, csv_files: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Consolidate all CSV files with duplicate handling"""

        all_data = []
        solvent_registry = {}  # Track solvents and their priority scores

        essential_cols = ['delta_D', 'delta_P', 'delta_H']

        # Process each file
        for file_name, df in csv_files.items():
            logger.info(f"Processing {file_name}...")

            # Normalize column names
            df = self.normalize_column_names(df, file_name)

            # Skip if no Solvent column
            if 'Solvent' not in df.columns:
                logger.warning(f"No 'Solvent' column found in {file_name}, skipping...")
                continue

            total_rows = len(df)

            # Process each row
            for idx, row in df.iterrows():
                solvent_name = str(row['Solvent']).strip()

                # Skip empty solvent names
                if not solvent_name or solvent_name.lower() in ['nan', '']:
                    continue

                # Calculate completeness and priority
                completeness = self.calculate_completeness(row, essential_cols)
                priority_score = self.calculate_priority_score(
                    file_name, idx, total_rows, completeness
                )

                # Add source information
                row_dict = row.to_dict()
                row_dict['source_file'] = file_name
                row_dict['source_row'] = idx + 2  # +2 for header and 0-based index
                row_dict['priority_score'] = priority_score
                row_dict['completeness'] = completeness

                # Handle duplicates
                if solvent_name in solvent_registry:
                    existing_score = solvent_registry[solvent_name]['priority_score']

                    if priority_score > existing_score:
                        # Replace with higher priority data
                        logger.debug(f"Replacing {solvent_name}: {existing_score} -> {priority_score}")
                        solvent_registry[solvent_name] = row_dict

                        # Update duplicate stats
                        if solvent_name not in self.duplicate_stats:
                            self.duplicate_stats[solvent_name] = {'count': 0, 'sources': []}
                        self.duplicate_stats[solvent_name]['count'] += 1
                        self.duplicate_stats[solvent_name]['sources'].append(
                            f"{file_name}:{idx+2} (score: {priority_score})"
                        )
                    else:
                        # Log duplicate found but not used
                        logger.debug(f"Duplicate found for {solvent_name}, keeping existing (higher priority)")
                        if solvent_name not in self.duplicate_stats:
                            self.duplicate_stats[solvent_name] = {'count': 0, 'sources': []}
                        self.duplicate_stats[solvent_name]['count'] += 1
                        self.duplicate_stats[solvent_name]['sources'].append(
                            f"{file_name}:{idx+2} (score: {priority_score}) [REJECTED]"
                        )
                else:
                    # First occurrence
                    solvent_registry[solvent_name] = row_dict

        # Convert to list for DataFrame creation
        final_data = list(solvent_registry.values())

        # Create consolidated DataFrame
        if final_data:
            consolidated_df = pd.DataFrame(final_data)

            # Sort by priority score (highest first)
            consolidated_df = consolidated_df.sort_values('priority_score', ascending=False)

            # Clean up temporary columns
            columns_to_remove = ['priority_score']
            consolidated_df = consolidated_df.drop(columns=[col for col in columns_to_remove if col in consolidated_df.columns])

            return consolidated_df
        else:
            logger.error("No valid data found in any CSV files")
            return pd.DataFrame()

    def save_consolidated_data(self, df: pd.DataFrame):
        """Save consolidated data to output file"""
        if df.empty:
            logger.error("No data to save")
            return

        try:
            # Ensure output directory exists
            self.output_file.parent.mkdir(parents=True, exist_ok=True)

            # Save to CSV
            df.to_csv(self.output_file, index=False, encoding='utf-8-sig')
            logger.info(f"Consolidated data saved to {self.output_file}")
            logger.info(f"Total records: {len(df)}")

            # Log column information
            logger.info(f"Columns: {list(df.columns)}")

        except Exception as e:
            logger.error(f"Error saving consolidated data: {e}")

    def log_duplicate_stats(self):
        """Log statistics about duplicate handling"""
        if not self.duplicate_stats:
            logger.info("No duplicates found")
            return

        logger.info(f"Duplicate processing summary:")
        logger.info(f"Total solvents with duplicates: {len(self.duplicate_stats)}")

        for solvent, stats in self.duplicate_stats.items():
            logger.info(f"  {solvent}: {stats['count']} duplicates")
            for source in stats['sources']:
                logger.debug(f"    - {source}")

    def run(self):
        """Main consolidation process"""
        logger.info("Starting CSV consolidation...")

        # Load CSV files
        csv_files = self.load_csv_files()
        if not csv_files:
            logger.error("No CSV files found to consolidate")
            return

        # Consolidate data
        consolidated_df = self.consolidate_files(csv_files)

        # Save results
        self.save_consolidated_data(consolidated_df)

        # Log statistics
        self.log_duplicate_stats()

        logger.info("CSV consolidation completed")


def main():
    """Main entry point"""

    # Get script directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    # Define paths
    input_dir = project_root / "data" / "original"
    output_file = project_root / "data" / "hsp.csv"

    logger.info(f"Input directory: {input_dir}")
    logger.info(f"Output file: {output_file}")

    # Check if input directory exists
    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        sys.exit(1)

    # Run consolidation
    consolidator = CSVConsolidator(input_dir, output_file)
    consolidator.run()


if __name__ == "__main__":
    main()